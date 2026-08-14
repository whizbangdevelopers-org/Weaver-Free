// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Prometheus exposition for per-workload and host metrics.
 *
 * This exporter deliberately publishes **raw cumulative counters**, not the percentages the UI
 * shows. `rate()` is what turns a counter into a rate, and doing that arithmetic here would mean
 * exporting a number whose meaning depends on when it was sampled — unusable for any query with a
 * different window than the one baked in. The in-process ring buffer keeps computing percentages
 * for the existing API; this is a second, independent reader of the same cgroup files.
 *
 * It reads cgroups **at scrape time** rather than serving the ring buffer. The buffer holds
 * derived, tier-clamped, gap-filled samples on a 30-second clock; a scrape wants the counter as it
 * is now. Coupling them would make the scrape interval a function of the retention policy.
 *
 * The vCPU gauge is here for one reason worth stating: CPU seconds alone cannot be normalised.
 * `rate(weaver_workload_cpu_usage_seconds_total[5m])` yields core-seconds per second, so a 4-vCPU
 * workload pinned flat reads 4, not 1. The UI divides by the workload's vCPU allocation so that
 * 100% means "saturating what it was given"; exporting the divisor lets any other consumer —
 * a Grafana dashboard especially — reach the same number instead of inventing a different one.
 *
 * Cardinality: workload name is the only label, and it is bounded per host (dozens). Nothing
 * unbounded — no container id, no provisioning run id, no per-request dimension — may become a
 * label here. Unbounded labels are Prometheus's characteristic failure, and this exporter is now
 * the place that rule binds.
 */

import {
  parseCpuUsageUsec,
  parseMemoryCurrent,
  parseIoStat,
  cgroupPathFor,
  type CgroupReader,
} from './metrics.js'

/** One exported sample: a metric value with its (bounded) labels. */
export interface Sample {
  labels: Record<string, string>
  value: number
}

export interface MetricFamily {
  name: string
  help: string
  type: 'counter' | 'gauge'
  samples: Sample[]
}

/**
 * Escape a label VALUE per the exposition format: backslash, double-quote and newline.
 *
 * Workload names are already validated against `^[a-z][a-z0-9-]*$` before they reach any system
 * call, so nothing here can currently contain a metacharacter. That is exactly why the escaping is
 * written anyway: the guarantee lives in a validator three layers away, and an exporter that
 * assumes its inputs were sanitised elsewhere is one refactor from emitting a malformed — or
 * forged — line. Cheap here, invisible later.
 */
export function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

/** Render one metric family in the Prometheus text exposition format. */
export function renderFamily(family: MetricFamily): string {
  if (family.samples.length === 0) return ''
  const lines = [`# HELP ${family.name} ${family.help}`, `# TYPE ${family.name} ${family.type}`]
  for (const s of family.samples) {
    const labels = Object.entries(s.labels)
      .map(([k, v]) => `${k}="${escapeLabelValue(v)}"`)
      .join(',')
    lines.push(labels ? `${family.name}{${labels}} ${s.value}` : `${family.name} ${s.value}`)
  }
  return lines.join('\n')
}

/**
 * Render a full exposition document.
 *
 * Families that produced no samples are dropped rather than emitted with a bare HELP/TYPE header.
 * A family with no series is not "zero" — it means nothing was measurable — and publishing the
 * header alone invites a dashboard to render an empty panel as a flat line at zero, which is the
 * same "plausible wrong number" this codebase refuses everywhere else.
 */
export function renderExposition(families: MetricFamily[]): string {
  const rendered = families.map(renderFamily).filter(Boolean)
  return rendered.length ? `${rendered.join('\n\n')}\n` : ''
}

export interface WorkloadTarget {
  name: string
  /** vCPU allocation — the divisor a consumer needs to normalise CPU seconds. */
  vcpu: number
}

/** Host readings, already gathered by the host-info service. All optional: absent ≠ zero. */
export interface HostReadings {
  loadAvg1?: number
  loadAvg5?: number
  loadAvg15?: number
  totalMemBytes?: number
  freeMemBytes?: number
  cpuCount?: number
}

/**
 * Read every workload's cgroup once and build the metric families.
 *
 * A workload whose cgroup is unreadable contributes NO samples rather than zeros — it is stopped,
 * or the controller is not enabled. Emitting 0 would assert a measurement that was never taken,
 * and unlike a null in the UI contract, a zero in Prometheus is indistinguishable from real idle.
 */
export async function collectWorkloadFamilies(opts: {
  read: CgroupReader
  workloads: WorkloadTarget[]
  cgroupRoot?: string
}): Promise<MetricFamily[]> {
  const cpu: Sample[] = []
  const memory: Sample[] = []
  const diskRead: Sample[] = []
  const diskWrite: Sample[] = []
  const vcpus: Sample[] = []

  for (const w of opts.workloads) {
    const base = opts.cgroupRoot ? cgroupPathFor(w.name, opts.cgroupRoot) : cgroupPathFor(w.name)
    const labels = { workload: w.name }

    const [cpuRaw, memRaw, ioRaw] = await Promise.all([
      opts.read(`${base}/cpu.stat`),
      opts.read(`${base}/memory.current`),
      opts.read(`${base}/io.stat`),
    ])

    const usec = cpuRaw === null ? null : parseCpuUsageUsec(cpuRaw)
    if (usec !== null) cpu.push({ labels, value: usec / 1_000_000 })

    const mem = memRaw === null ? null : parseMemoryCurrent(memRaw)
    if (mem !== null) memory.push({ labels, value: mem })

    const io = ioRaw === null ? null : parseIoStat(ioRaw)
    if (io !== null) {
      diskRead.push({ labels, value: io.readBytes })
      diskWrite.push({ labels, value: io.writeBytes })
    }

    // Published even when the cgroup is unreadable: the allocation is a fact about the workload's
    // definition, not a measurement of it, and a consumer normalising CPU needs the divisor to
    // exist independently of whether the workload happens to be running.
    if (w.vcpu > 0) vcpus.push({ labels, value: w.vcpu })
  }

  return [
    {
      name: 'weaver_workload_cpu_usage_seconds_total',
      help: 'Cumulative CPU time consumed by the workload, in seconds.',
      type: 'counter',
      samples: cpu,
    },
    {
      name: 'weaver_workload_memory_bytes',
      help: 'Current memory usage of the workload, in bytes.',
      type: 'gauge',
      samples: memory,
    },
    {
      name: 'weaver_workload_disk_read_bytes_total',
      help: 'Cumulative bytes read from disk by the workload.',
      type: 'counter',
      samples: diskRead,
    },
    {
      name: 'weaver_workload_disk_write_bytes_total',
      help: 'Cumulative bytes written to disk by the workload.',
      type: 'counter',
      samples: diskWrite,
    },
    {
      name: 'weaver_workload_vcpus',
      help: 'vCPUs allocated to the workload. Divide a CPU-seconds rate by this to normalise.',
      type: 'gauge',
      samples: vcpus,
    },
  ]
}

/** Build the host metric families from readings the host-info service already produces. */
export function collectHostFamilies(host: HostReadings): MetricFamily[] {
  const gauge = (name: string, help: string, value: number | undefined): MetricFamily => ({
    name,
    help,
    type: 'gauge',
    samples: value === undefined || !Number.isFinite(value) ? [] : [{ labels: {}, value }],
  })

  return [
    gauge('weaver_host_load1', 'Host 1-minute load average.', host.loadAvg1),
    gauge('weaver_host_load5', 'Host 5-minute load average.', host.loadAvg5),
    gauge('weaver_host_load15', 'Host 15-minute load average.', host.loadAvg15),
    gauge('weaver_host_memory_total_bytes', 'Total host memory, in bytes.', host.totalMemBytes),
    gauge('weaver_host_memory_free_bytes', 'Free host memory, in bytes.', host.freeMemBytes),
    gauge('weaver_host_cpu_count', 'Host CPU core count.', host.cpuCount),
  ]
}

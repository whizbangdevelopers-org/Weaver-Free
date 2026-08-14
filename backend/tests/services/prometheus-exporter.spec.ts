// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// The exposition is a contract with a system that will happily record a wrong number forever.
// Prometheus has no nulls: an absent series and a zero are different assertions, and only one of
// them can be un-said later. So the cases below are mostly about what must NOT be emitted.
import { describe, it, expect } from 'vitest'
import {
  escapeLabelValue,
  renderFamily,
  renderExposition,
  collectWorkloadFamilies,
  collectHostFamilies,
  type MetricFamily,
} from '../../src/services/prometheus-exporter.js'
import { isLoopback } from '../../src/routes/metrics.js'

const ROOT = '/fake/cgroup'
const cg = (n: string, f: string) => `${ROOT}/system.slice/microvm@${n}.service/${f}`

function fakeFs(files: Record<string, string>) {
  return async (path: string) => (path in files ? files[path]! : null)
}

describe('escapeLabelValue', () => {
  it('escapes the three characters the exposition format reserves', () => {
    expect(escapeLabelValue('plain')).toBe('plain')
    expect(escapeLabelValue('a"b')).toBe('a\\"b')
    expect(escapeLabelValue('a\\b')).toBe('a\\\\b')
    expect(escapeLabelValue('a\nb')).toBe('a\\nb')
  })

  it('escapes the backslash BEFORE the quote', () => {
    // Order matters: escaping the quote first would then double-escape the backslash it added,
    // producing a line Prometheus rejects. Cheap to get wrong, invisible until a scrape fails.
    expect(escapeLabelValue('a\\"b')).toBe('a\\\\\\"b')
  })
})

describe('renderFamily', () => {
  it('emits HELP, TYPE and one line per sample', () => {
    const out = renderFamily({
      name: 'weaver_test_total',
      help: 'A test counter.',
      type: 'counter',
      samples: [{ labels: { workload: 'web' }, value: 4 }],
    })
    expect(out).toBe(
      '# HELP weaver_test_total A test counter.\n' +
      '# TYPE weaver_test_total counter\n' +
      'weaver_test_total{workload="web"} 4',
    )
  })

  it('omits the brace block entirely when there are no labels', () => {
    const out = renderFamily({ name: 'g', help: 'h', type: 'gauge', samples: [{ labels: {}, value: 1 }] })
    expect(out.split('\n')[2]).toBe('g 1')
  })

  it('renders NOTHING for a family with no samples', () => {
    // A bare HELP/TYPE header with no series invites a dashboard to draw an empty panel as a flat
    // line at zero — a measurement that was never taken, rendered as one that was.
    expect(renderFamily({ name: 'g', help: 'h', type: 'gauge', samples: [] })).toBe('')
  })
})

describe('renderExposition', () => {
  it('drops empty families and ends with a newline', () => {
    const families: MetricFamily[] = [
      { name: 'a', help: 'h', type: 'gauge', samples: [{ labels: {}, value: 1 }] },
      { name: 'b', help: 'h', type: 'gauge', samples: [] },
    ]
    const out = renderExposition(families)
    expect(out).toContain('a 1')
    expect(out).not.toContain('b')
    expect(out.endsWith('\n')).toBe(true)
  })

  it('returns an empty string when nothing was measurable', () => {
    expect(renderExposition([{ name: 'a', help: 'h', type: 'gauge', samples: [] }])).toBe('')
  })
})

describe('collectWorkloadFamilies', () => {
  const workloads = [{ name: 'web', vcpu: 4 }]

  it('exports RAW cumulative counters, converting CPU to seconds', () => {
    // Not a percentage. rate() is what turns this into one, and baking a window in here would make
    // the value meaningless to any query using a different window.
    return collectWorkloadFamilies({
      read: fakeFs({
        [cg('web', 'cpu.stat')]: 'usage_usec 2500000',
        [cg('web', 'memory.current')]: '1048576',
        [cg('web', 'io.stat')]: '8:0 rbytes=4096 wbytes=512',
      }),
      workloads,
      cgroupRoot: ROOT,
    }).then(families => {
      const by = (n: string) => families.find(f => f.name === n)!
      expect(by('weaver_workload_cpu_usage_seconds_total').samples[0]!.value).toBe(2.5)
      expect(by('weaver_workload_memory_bytes').samples[0]!.value).toBe(1048576)
      expect(by('weaver_workload_disk_read_bytes_total').samples[0]!.value).toBe(4096)
      expect(by('weaver_workload_disk_write_bytes_total').samples[0]!.value).toBe(512)
    })
  })

  it('exports the vCPU divisor, which is the whole point of the gauge', async () => {
    // rate(cpu_seconds[5m]) yields core-seconds/sec: a 4-vCPU workload pinned flat reads 4, not 1.
    // Without this series a Grafana panel cannot reach the same axis the product UI shows.
    const families = await collectWorkloadFamilies({
      read: fakeFs({ [cg('web', 'cpu.stat')]: 'usage_usec 1' }),
      workloads,
      cgroupRoot: ROOT,
    })
    expect(families.find(f => f.name === 'weaver_workload_vcpus')!.samples[0]!.value).toBe(4)
  })

  it('emits NO sample — never a zero — for an unreadable cgroup', async () => {
    // A stopped workload has no cgroup. Prometheus has no null, so a 0 here is indistinguishable
    // from a genuinely idle workload and would be recorded as fact forever.
    const families = await collectWorkloadFamilies({
      read: fakeFs({}),
      workloads,
      cgroupRoot: ROOT,
    })
    for (const name of [
      'weaver_workload_cpu_usage_seconds_total',
      'weaver_workload_memory_bytes',
      'weaver_workload_disk_read_bytes_total',
    ]) {
      expect(families.find(f => f.name === name)!.samples).toEqual([])
    }
  })

  it('still publishes vCPUs for a stopped workload', async () => {
    // The allocation is a fact about the DEFINITION, not a measurement of the process. A consumer
    // normalising CPU needs the divisor whether or not the workload happens to be running.
    const families = await collectWorkloadFamilies({ read: fakeFs({}), workloads, cgroupRoot: ROOT })
    expect(families.find(f => f.name === 'weaver_workload_vcpus')!.samples).toHaveLength(1)
  })

  it('reports each workload independently — one unreadable cgroup does not hide the others', async () => {
    const families = await collectWorkloadFamilies({
      read: fakeFs({ [cg('b', 'memory.current')]: '2048' }),
      workloads: [{ name: 'a', vcpu: 1 }, { name: 'b', vcpu: 1 }],
      cgroupRoot: ROOT,
    })
    const mem = families.find(f => f.name === 'weaver_workload_memory_bytes')!
    expect(mem.samples).toHaveLength(1)
    expect(mem.samples[0]!.labels.workload).toBe('b')
  })
})

describe('collectHostFamilies', () => {
  it('omits a reading that is absent rather than exporting zero', () => {
    const families = collectHostFamilies({ loadAvg1: 1.5 })
    expect(families.find(f => f.name === 'weaver_host_load1')!.samples[0]!.value).toBe(1.5)
    expect(families.find(f => f.name === 'weaver_host_load5')!.samples).toEqual([])
  })

  it('omits a non-finite reading', () => {
    // NaN/Infinity serialise into the exposition as tokens Prometheus will either reject or ingest
    // as a special value; neither is what an unavailable reading means.
    const families = collectHostFamilies({ loadAvg1: NaN, loadAvg5: Infinity })
    expect(families.find(f => f.name === 'weaver_host_load1')!.samples).toEqual([])
    expect(families.find(f => f.name === 'weaver_host_load5')!.samples).toEqual([])
  })
})

describe('isLoopback — the boundary that makes an unauthenticated /metrics safe', () => {
  it('accepts the loopback forms, including IPv4-mapped IPv6', () => {
    // ::ffff:127.0.0.1 is what Node reports on a dual-stack socket receiving a v4 connection. It is
    // the form most commonly missed, and missing it breaks scraping on an ordinary host.
    expect(isLoopback('127.0.0.1')).toBe(true)
    expect(isLoopback('::1')).toBe(true)
    expect(isLoopback('::ffff:127.0.0.1')).toBe(true)
    expect(isLoopback('127.0.0.53')).toBe(true)
  })

  it('refuses every remote address, including RFC1918 and the mapped form', () => {
    for (const addr of ['192.168.1.10', '10.0.0.5', '172.16.0.1', '::ffff:192.168.1.10', '8.8.8.8', '::ffff:10.0.0.1']) {
      expect(isLoopback(addr)).toBe(false)
    }
  })

  it('refuses an absent address', () => {
    expect(isLoopback(undefined)).toBe(false)
    expect(isLoopback('')).toBe(false)
  })

  it('is not fooled by an address that merely CONTAINS a loopback literal', () => {
    // A prefix check written as `includes` would accept these. They are ordinary routable hosts.
    expect(isLoopback('10.0.0.1:127.0.0.1')).toBe(false)
    expect(isLoopback('1127.0.0.1')).toBe(false)
    expect(isLoopback('foo127.0.0.1')).toBe(false)
  })
})

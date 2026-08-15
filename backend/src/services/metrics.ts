// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Per-workload resource metrics — cgroup v2 parsing, and the tier window rule.
 *
 * **Everything here is PURE**: text in, numbers out. Nothing in this file reads a file, holds
 * state, or owns a timer. That is what makes the counter-rollover and cold-start cases testable,
 * and those are the two that produce a plausible wrong number rather than an error.
 *
 * It was not always pure. Until the Prometheus migration retired them, this file also held
 * `MetricRingBuffer` and `MetricsCollector` — an in-process store sampling every workload's cgroup
 * on a 30-second timer and keeping an hour (Free) or a day (paid) of history in memory. Prometheus
 * now holds the history and `services/promql.ts` reads it, so the buffer was a second store of the
 * same numbers with worse durability: it lost everything on restart, which is precisely what
 * phase 2 demonstrated when 16 samples survived a Prometheus restart that the buffer would have
 * dropped. Two backends for one fact is the state the migration existed to leave.
 *
 * What reads cgroups now is `services/prometheus-exporter.ts`, at scrape time, using the parsers
 * below. It is a pull, so there is no sampling loop to own.
 *
 * The whole feature exists because "open Proxmox, see graphs; open Weaver, see nothing" is the
 * single biggest credibility gap for a home-lab user. A graph that is subtly wrong is worse than
 * no graph at all — it is the same gap, plus a reason to distrust everything else on the page.
 */

/** One sample. `null` value means "could not be determined", which is NOT the same as zero. */
export interface MetricSample {
  timestamp: number
  cpuPercent: number | null
  memoryBytes: number | null
  /**
   * Disk THROUGHPUT, bytes per second, derived from `io.stat`'s cumulative counters.
   *
   * This replaces a `diskBytes` *usage* field that was declared at v1.1 and never populated —
   * `diskBytes: null, // not wired yet`. Usage was the wrong quantity for this chart: a VM image
   * size sampled every 30 seconds draws a flat line, which is plausibly why nobody ever wired it,
   * and it needs a separate expensive source (`qemu-img info`) on a different clock. Throughput is
   * what `io.stat` already exposes, and what the chart has always been designed to show.
   */
  diskReadBps: number | null
  diskWriteBps: number | null
}

/** Cumulative disk byte counters for one cgroup, summed across every backing device. */
export interface IoCounters {
  readBytes: number
  writeBytes: number
}

/**
 * Sample spacing, in ms.
 *
 * Once the collector's own timer, and now two things that must agree: the Prometheus scrape
 * interval the NixOS module configures, and the step the PromQL grid is materialised on
 * (`buildGrid`). A step finer than the scrape interval invents empty slots between real samples;
 * a coarser one throws real samples away.
 */
export const SAMPLE_INTERVAL_MS = 30_000

// ---------------------------------------------------------------------------
// cgroup v2 parsing — pure
// ---------------------------------------------------------------------------

/**
 * `usage_usec` out of a cgroup v2 `cpu.stat`, in microseconds of CPU time.
 *
 * Returns null when the key is absent rather than 0. A cgroup that exists but has not been
 * accounted yet, and a workload using no CPU, are different facts; collapsing them means the
 * first sample after start reads as a real 0% instead of "not known yet".
 */
export function parseCpuUsageUsec(content: string): number | null {
  for (const line of content.split('\n')) {
    const [key, value] = line.trim().split(/\s+/)
    if (key === 'usage_usec') {
      const n = Number(value)
      return Number.isFinite(n) && n >= 0 ? n : null
    }
  }
  return null
}

/**
 * CPU percent from two cumulative samples, normalised by the workload's vCPU allocation.
 *
 * Normalising is what makes the number mean what a Proxmox user reads it as: 100% is "saturating
 * everything it was given", not "one core busy". Without it a 4-vCPU workload pinned flat out
 * reports 400% and a 1-vCPU one reports 100% for the same *relative* load.
 *
 * Returns null — never a number — in the three cases where a delta is meaningless:
 *
 *   - no previous sample (cold start)
 *   - non-positive elapsed time (clock adjustment, or two reads inside the same tick)
 *   - the counter went BACKWARDS, which means the cgroup was recreated: the unit restarted
 *     between samples. Treating that delta as real produces a spike of arbitrary size at exactly
 *     the moment a user is looking to see what happened, and the spike is indistinguishable from
 *     a genuine load event.
 */
export function computeCpuPercent(opts: {
  previousUsec: number | null
  currentUsec: number | null
  elapsedMs: number
  vcpus: number
}): number | null {
  const { previousUsec, currentUsec, elapsedMs, vcpus } = opts
  if (previousUsec === null || currentUsec === null) return null
  if (!(elapsedMs > 0)) return null
  if (currentUsec < previousUsec) return null // counter reset — unit restarted
  if (!(vcpus > 0)) return null

  const deltaUsec = currentUsec - previousUsec
  const availableUsec = elapsedMs * 1000 * vcpus
  return clampCpuPercent((deltaUsec / availableUsec) * 100)
}

/**
 * Present a raw CPU percentage the way the chart expects it.
 *
 * Clamps the top because accounting granularity can put a busy workload marginally over 100, and a
 * graph that peaks at 103% invites the reader to distrust the axis rather than the sample.
 *
 * **Extracted so the two metrics backends cannot drift.** The ring buffer computes this from two
 * cgroup reads; the PromQL proxy computes it from a `rate()` divided by `weaver_workload_vcpus`.
 * The arithmetic differs by construction, but the *presentation* must not — a chart that rounds to
 * two places on one backend and not the other reads as a bug in the data. Sharing the function
 * makes that agreement structural rather than a coincidence maintained by hand.
 */
export function clampCpuPercent(pct: number): number {
  if (!Number.isFinite(pct)) return 0
  return Math.max(0, Math.min(100, Number(pct.toFixed(2))))
}

/**
 * Present a raw bytes-per-second rate.
 *
 * No ceiling, deliberately — unlike CPU percent there is no meaningful maximum for I/O, and an
 * invented one would silently flatten exactly the spike the chart exists to show. Shared with the
 * PromQL proxy for the same reason as `clampCpuPercent`.
 */
export function roundBps(bps: number): number {
  if (!Number.isFinite(bps)) return 0
  return Math.max(0, Number(bps.toFixed(2)))
}

/**
 * A single-integer cgroup file (`memory.current`, `memory.peak`).
 *
 * The empty-string check is load-bearing and not defensive padding: `Number('')` is **0**, not
 * NaN, so without it an empty or unreadable cgroup file parses as a confident "0 bytes" — a
 * workload rendered as using no memory at all. That is the signature failure of this whole file:
 * a plausible number where there is no measurement. Caught by the corpus on the first run.
 */
export function parseMemoryCurrent(content: string): number | null {
  const raw = content.trim()
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * `memory.max`, where the literal string `max` means "no limit".
 *
 * Returned as null for unlimited, so a caller falls back to the workload's declared memory rather
 * than rendering a percentage against Infinity — which formats as `NaN%` or `0%` depending on the
 * arithmetic, both of which look like a working readout.
 */
export function parseMemoryMax(content: string): number | null {
  const raw = content.trim()
  if (raw === 'max') return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * `io.stat` — cumulative byte counters, summed across every backing device.
 *
 * The format is one line per device, `MAJ:MIN key=value key=value …`:
 *
 *     8:0 rbytes=4096 wbytes=0 rios=1 wios=0 dbytes=0 dios=0
 *
 * Summing across devices is deliberate. A workload's disk is frequently more than one device — an
 * overlay plus its backing image, a separate data volume — and reporting only the first line would
 * silently under-report by whatever the others carry, which is a plausible number rather than an
 * error. The same reason the memory parser refuses an empty string.
 *
 * Returns null when NO device line yields a counter, rather than `{0, 0}`. A stopped workload has
 * no cgroup at all, and a running one that has not yet touched its disk is a different fact from
 * one doing no I/O — collapsing them makes the first sample after start read as a real zero.
 *
 * Unparseable devices are skipped rather than failing the whole read: one malformed line must not
 * discard the counters of every other device in the file.
 */
export function parseIoStat(content: string): IoCounters | null {
  let readBytes = 0
  let writeBytes = 0
  let sawAny = false

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue

    let sawOnThisLine = false
    let r = 0
    let w = 0
    for (const field of trimmed.split(/\s+/)) {
      const eq = field.indexOf('=')
      if (eq <= 0) continue // the `MAJ:MIN` device token, or a malformed field
      const key = field.slice(0, eq)
      if (key !== 'rbytes' && key !== 'wbytes') continue
      const n = Number(field.slice(eq + 1))
      if (!Number.isFinite(n) || n < 0) continue
      if (key === 'rbytes') r = n
      else w = n
      sawOnThisLine = true
    }
    if (sawOnThisLine) {
      readBytes += r
      writeBytes += w
      sawAny = true
    }
  }

  return sawAny ? { readBytes, writeBytes } : null
}

/**
 * Disk throughput in bytes per second from two cumulative samples.
 *
 * Refuses in exactly the same cases as `computeCpuPercent`, for the same reasons — cold start, a
 * non-positive elapsed time, and a counter that went BACKWARDS because the cgroup was recreated
 * when the unit restarted. The refusal is deliberate rather than smoothed: a restart is
 * operationally significant, and a visible gap is the cheapest way to show it.
 *
 * Read and write are judged INDEPENDENTLY. They are separate counters on the same reset, so a
 * workload that only ever reads would have its read line discarded by a write counter that never
 * moves if a single shared verdict were used.
 *
 * There is no clamp. Unlike CPU percent there is no meaningful ceiling on bytes per second, and an
 * invented one would silently flatten exactly the I/O spike the chart exists to show.
 */
export function computeDiskBps(opts: {
  previous: IoCounters | null
  current: IoCounters | null
  elapsedMs: number
}): { readBps: number | null; writeBps: number | null } {
  const { previous, current, elapsedMs } = opts
  const none = { readBps: null, writeBps: null }
  if (previous === null || current === null) return none
  if (!(elapsedMs > 0)) return none

  const seconds = elapsedMs / 1000
  const rate = (prev: number, curr: number): number | null => {
    if (curr < prev) return null // counter reset — unit restarted between samples
    return roundBps((curr - prev) / seconds)
  }

  return {
    readBps: rate(previous.readBytes, current.readBytes),
    writeBps: rate(previous.writeBytes, current.writeBytes),
  }
}

/**
 * cgroup v2 path for a workload's systemd unit.
 *
 * **The `system-microvm.slice` component is systemd's, not ours, and omitting it is why this
 * function returned a path that exists on no host.** systemd places instances of a template unit
 * `foo@.service` into an implicit slice named `system-foo.slice`, without the unit file saying so
 * — verified on a live host, where `microvm@.service` carries no `Slice=` line at all yet
 * `systemctl show -p Slice` reports `system-microvm.slice`. The same host shows
 * `getty@tty1.service` in `system-getty.slice` and `user@0.service` in `user-0.slice`, so this is
 * the general rule for template units rather than anything microvm.nix does.
 *
 * The consequence of the old path was **silent and total**: every read returned null, and both
 * consumers treat an unreadable cgroup as "no measurement" by design — which is right for a
 * stopped workload and indistinguishable from a wrong path. So the chart drew nothing and the
 * exporter published nothing, on every real host, with no error anywhere.
 *
 * Nothing caught it because the unit tests supply their own fake cgroupfs and assert that the
 * reader reads the path this function builds. That is a closed loop: it can only ever confirm the
 * two halves of our own code agree. The missing assertion was against systemd, which is why
 * `collectWorkloadFamilies` now reports when it can read none of them.
 */
export function cgroupPathFor(name: string, root = '/sys/fs/cgroup'): string {
  return `${root}/system.slice/system-microvm.slice/microvm@${name}.service`
}

/**
 * Reads one cgroup file. Returns null when it cannot be read for ANY reason.
 *
 * A workload that is stopped has no cgroup at all, so ENOENT is the ordinary case rather than an
 * error worth logging — logging it would emit a line per stopped workload every 30 seconds
 * forever, which is how a log becomes something nobody reads.
 *
 * Kept after the collector was retired (phase 4) because the Prometheus exporter is the reader
 * now, and it needs the same contract.
 */
export type CgroupReader = (path: string) => Promise<string | null>

// ---------------------------------------------------------------------------
// Tier windows
// ---------------------------------------------------------------------------
//
// These were RETENTION_FREE = 120 and RETENTION_PAID = 2880 — counts of 30-second samples, sized
// for a ring buffer that no longer exists. They were doing two jobs at once: capacity of the
// in-process store, and the cap on what a tier may ASK to see. Only the second is a product rule,
// so it is now stated in the unit it is actually enforced in.
//
// The values are unchanged: 120 x 30s = 1 hour, 2880 x 30s = 24 hours. What changed is that the
// tier lever no longer implies anything about where the samples live. Prometheus retention is a
// HOST storage setting (services.weaver.metrics.retention, default 7d) and deliberately longer
// than any window the API will serve.

/** Longest window Free may request. */
export const MAX_WINDOW_MS_FREE = 60 * 60 * 1000

/** Longest window any paid tier may request. */
export const MAX_WINDOW_MS_PAID = 24 * 60 * 60 * 1000

/**
 * Window length a tier may request, in ms.
 *
 * "Anything not Free gets the long window", never an enumeration of the paid tiers. A list has to
 * be revisited every time a tier is added and silently gives the new one Free's window when it is
 * not — which is the wrong direction for that mistake to fall. The demo's own gate was written as
 * `SOLO || FABRICK` and excluded **Team** for exactly this reason.
 */
export function maxWindowMsForTier(tier: string): number {
  return tier === 'free' ? MAX_WINDOW_MS_FREE : MAX_WINDOW_MS_PAID
}

/**
 * Resolve a requested window against what the tier is allowed to see.
 *
 * Clamps rather than rejects: a Free user asking for 24h gets the hour they are entitled to, not
 * an error. The response reports the window actually served so the UI can label the axis
 * honestly instead of drawing an hour of data under a 24-hour heading.
 */
export function resolveWindowMs(requested: string | undefined, tier: string): number {
  const max = maxWindowMsForTier(tier)
  if (!requested) return max
  const m = requested.match(/^(\d+)(m|h)$/)
  if (!m) return max
  const value = Number(m[1])
  const ms = m[2] === 'h' ? value * 3_600_000 : value * 60_000
  if (!(ms > 0)) return max
  return Math.min(ms, max)
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Per-workload resource metrics — cgroup v2 parsing and the in-memory ring buffer.
 *
 * Everything in this file above `MetricsCollector` is PURE: text in, numbers out. The cgroup
 * pseudo-files are the only input, and they are read by the collector, not by the parsers. That
 * split is what makes the counter-rollover and cold-start cases testable, and those are the two
 * that produce a plausible wrong number rather than an error.
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
  diskBytes: number | null
}

/** Retention, in samples, by tier. 30s resolution: 120 = 1 hour, 2880 = 24 hours. */
export const RETENTION_FREE = 120
export const RETENTION_PAID = 2880

/** Sampling interval. Deliberately not the 2s status broadcast — reading cgroups is heavier. */
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
  const pct = (deltaUsec / availableUsec) * 100

  // Clamp the top: accounting granularity can put a busy workload marginally over 100, and a
  // graph that peaks at 103% invites the reader to distrust the axis rather than the sample.
  return Math.max(0, Math.min(100, Number(pct.toFixed(2))))
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

/** cgroup v2 path for a workload's systemd unit. */
export function cgroupPathFor(name: string, root = '/sys/fs/cgroup'): string {
  return `${root}/system.slice/microvm@${name}.service`
}

// ---------------------------------------------------------------------------
// Ring buffer — pure
// ---------------------------------------------------------------------------

/**
 * Fixed-capacity circular buffer of samples.
 *
 * Capacity is set at construction from the tier and never grows. An unbounded array here would be
 * a slow memory leak on a long-lived host — the collector appends every 30 seconds forever, which
 * is 2,880 samples a day per workload whether or not anyone ever opens the page.
 */
export class MetricRingBuffer {
  private readonly buffer: MetricSample[] = []
  private writeIndex = 0

  constructor(readonly capacity: number) {
    if (!(capacity > 0)) throw new Error('MetricRingBuffer capacity must be positive')
  }

  push(sample: MetricSample): void {
    if (this.buffer.length < this.capacity) {
      this.buffer.push(sample)
      this.writeIndex = this.buffer.length % this.capacity
      return
    }
    this.buffer[this.writeIndex] = sample
    this.writeIndex = (this.writeIndex + 1) % this.capacity
  }

  /** Samples in chronological order, oldest first. */
  toArray(): MetricSample[] {
    if (this.buffer.length < this.capacity) return [...this.buffer]
    // Full: the oldest entry is the one about to be overwritten.
    return [...this.buffer.slice(this.writeIndex), ...this.buffer.slice(0, this.writeIndex)]
  }

  get size(): number {
    return this.buffer.length
  }

  /**
   * Samples no older than `windowMs`, chronological.
   *
   * Filtered by timestamp rather than by count, because a collector that was paused (host asleep,
   * service restarted) leaves a buffer whose Nth-from-last sample is not N intervals ago. Counting
   * back would silently present hours-old data as the last hour.
   */
  window(windowMs: number, now: number): MetricSample[] {
    const cutoff = now - windowMs
    return this.toArray().filter(s => s.timestamp >= cutoff)
  }
}

/** Retention for a tier. Anything paid gets the long window. */
export function retentionForTier(tier: string): number {
  return tier === 'free' ? RETENTION_FREE : RETENTION_PAID
}

/** Window length a tier may request, in ms. Free is capped at its buffer's worth of data. */
export function maxWindowMsForTier(tier: string): number {
  return retentionForTier(tier) * SAMPLE_INTERVAL_MS
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

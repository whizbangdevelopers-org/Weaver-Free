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
    return Math.max(0, Number(((curr - prev) / seconds).toFixed(2)))
  }

  return {
    readBps: rate(previous.readBytes, current.readBytes),
    writeBps: rate(previous.writeBytes, current.writeBytes),
  }
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

// ---------------------------------------------------------------------------
// Collector — the one stateful piece
// ---------------------------------------------------------------------------

/**
 * Reads one cgroup file. Returns null when it cannot be read for ANY reason.
 *
 * A workload that is stopped has no cgroup at all, so ENOENT is the ordinary case rather than an
 * error worth logging — logging it would emit a line per stopped workload every 30 seconds
 * forever, which is how a log becomes something nobody reads.
 */
export type CgroupReader = (path: string) => Promise<string | null>

interface WorkloadState {
  buffer: MetricRingBuffer
  lastCpuUsec: number | null
  lastIo: IoCounters | null
  /**
   * One timestamp PER COUNTER, not one per sample.
   *
   * `cpu.stat` and `io.stat` fail independently — a cgroup with no io controller enabled has no
   * `io.stat` while `cpu.stat` reads perfectly — so a single shared clock lets one file's success
   * advance the other's baseline. The delta would then be measured over a shorter interval than
   * the counter actually spans, and both rates read HIGH: a plausible wrong number, which is the
   * one failure mode this file is written to avoid.
   */
  lastCpuAt: number | null
  lastIoAt: number | null
}

/**
 * Samples cgroup v2 into per-workload ring buffers on a timer.
 *
 * The reader and the clock are injected. That is not ceremony: the interesting behaviour of this
 * class is what it does across TIME (counter resets, gaps, wraps) and against a filesystem that
 * may not have the files, and neither is reachable in a test that has to use the real ones.
 */
export class MetricsCollector {
  private readonly states = new Map<string, WorkloadState>()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly opts: {
      read: CgroupReader
      now?: () => number
      cgroupRoot?: string
      retention?: number
    },
  ) {}

  private now(): number {
    return this.opts.now ? this.opts.now() : Date.now()
  }

  private stateFor(name: string): WorkloadState {
    let s = this.states.get(name)
    if (!s) {
      s = {
        buffer: new MetricRingBuffer(this.opts.retention ?? RETENTION_PAID),
        lastCpuUsec: null,
        lastIo: null,
        lastCpuAt: null,
        lastIoAt: null,
      }
      this.states.set(name, s)
    }
    return s
  }

  /** Take one sample for one workload. Exposed so a test drives it without a timer. */
  async sampleOne(name: string, vcpus: number): Promise<MetricSample> {
    const state = this.stateFor(name)
    const base = this.opts.cgroupRoot
      ? cgroupPathFor(name, this.opts.cgroupRoot)
      : cgroupPathFor(name)
    const timestamp = this.now()

    const [cpuRaw, memRaw, ioRaw] = await Promise.all([
      this.opts.read(`${base}/cpu.stat`),
      this.opts.read(`${base}/memory.current`),
      this.opts.read(`${base}/io.stat`),
    ])

    const currentUsec = cpuRaw === null ? null : parseCpuUsageUsec(cpuRaw)
    const cpuPercent = computeCpuPercent({
      previousUsec: state.lastCpuUsec,
      currentUsec,
      elapsedMs: state.lastCpuAt === null ? 0 : timestamp - state.lastCpuAt,
      vcpus,
    })

    const currentIo = ioRaw === null ? null : parseIoStat(ioRaw)
    const { readBps, writeBps } = computeDiskBps({
      previous: state.lastIo,
      current: currentIo,
      elapsedMs: state.lastIoAt === null ? 0 : timestamp - state.lastIoAt,
    })

    const sample: MetricSample = {
      timestamp,
      cpuPercent,
      memoryBytes: memRaw === null ? null : parseMemoryCurrent(memRaw),
      diskReadBps: readBps,
      diskWriteBps: writeBps,
    }

    // Advance the CPU baseline ONLY on a real reading. Storing null here would make the next
    // sample look like another cold start, so a workload whose cgroup is briefly unreadable would
    // never produce a CPU number again — it would just silently stop having a CPU line.
    if (currentUsec !== null) {
      state.lastCpuUsec = currentUsec
      state.lastCpuAt = timestamp
    }

    // Each counter advances its own value AND its own clock, together. Advancing one file's clock
    // on the other file's success is what would make a rate read high (see WorkloadState).
    if (currentIo !== null) {
      state.lastIo = currentIo
      state.lastIoAt = timestamp
    }

    state.buffer.push(sample)
    return sample
  }

  /** Samples every workload passed in. Failures are per-workload and never abort the round. */
  async sampleAll(workloads: { name: string; vcpu: number }[]): Promise<void> {
    // allSettled, not all: one unreadable cgroup must not cancel the sampling of every other
    // workload in the same tick.
    await Promise.allSettled(workloads.map(w => this.sampleOne(w.name, w.vcpu)))
  }

  /** Samples within a window, oldest first. Empty for an unknown workload. */
  getSamples(name: string, windowMs: number): MetricSample[] {
    return this.states.get(name)?.buffer.window(windowMs, this.now()) ?? []
  }

  /** Drop a workload's history — call when one is deleted, or the map grows without bound. */
  forget(name: string): void {
    this.states.delete(name)
  }

  get trackedCount(): number {
    return this.states.size
  }

  start(listWorkloads: () => Promise<{ name: string; vcpu: number }[]>): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void (async () => {
        try {
          const workloads = await listWorkloads()
          await this.sampleAll(workloads)
          // Forget anything that has gone away, so a host that creates and destroys workloads
          // does not accumulate a buffer per name that ever existed.
          const live = new Set(workloads.map(w => w.name))
          for (const name of this.states.keys()) {
            if (!live.has(name)) this.forget(name)
          }
        } catch {
          // A failed round is skipped, never fatal — the collector must outlive a transient fault.
        }
      })()
    }, SAMPLE_INTERVAL_MS)
    // Do not hold the process open for a metrics timer.
    this.timer.unref?.()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
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

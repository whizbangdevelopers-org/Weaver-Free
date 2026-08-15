// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * PromQL read path — the source of metric history.
 *
 * Serves `MetricSample[]`, the same shape the in-process ring buffer served until phase 4 deleted
 * it. The gate for this phase was that the UI does not move: `WorkloadMetricsChart.vue`
 * and `useWorkloadMetrics.ts` are the specification, and every decision below exists because the
 * *rendered product* demands it rather than because Prometheus offers it.
 *
 * Four things here are NOT a port of the buffer's arithmetic. They are the whole phase:
 *
 *   1. **vCPU normalisation** — `rate()` yields core-seconds per second. The chart's axis means
 *      "100% = saturating the vCPUs it was given", so the rate is divided by
 *      `weaver_workload_vcpus` IN PromQL (§2.1), not in this file. Doing the join in the query
 *      means a Grafana deep-dive reuses one expression instead of showing a 400% axis
 *      where the quick view shows 100%.
 *   2. **Gap materialisation** — Prometheus omits absent points; the chart needs an explicit
 *      `null` at every step or it cannot tell a stopped workload from a still-loading one. See
 *      `materialiseSeries`, which the plan calls the single highest-risk piece of the migration.
 *   3. **Counter-reset refusal** — `rate()` *corrects* for resets and returns a plausible number.
 *      That forgiveness is exactly what the product refuses: a restart is operationally
 *      significant and the gap is the cheapest way to make it visible. A separate `resets()`
 *      query nulls those slots (§2.3).
 *   4. **The API stays in front** — this module is called by the route, never by the browser.
 *      Prometheus has no notion of Weaver's per-VM ACLs, and `resolveWindowMs` is the tier gate.
 *
 * Presentation (rounding, clamping) is deliberately NOT reimplemented here — `clampCpuPercent`
 * and `roundBps` are imported from `services/metrics.ts`, which is now the pure-arithmetic module
 * they always were. Sharing them is what kept the two backends from drifting while both existed,
 * and it is what keeps this path and the exporter agreeing now that one of them is gone.
 */

import { clampCpuPercent, roundBps, SAMPLE_INTERVAL_MS, type MetricSample } from './metrics.js'

/** One `matrix` series as Prometheus returns it: `[unixSeconds, decimalString]` pairs. */
export interface PromSeries {
  metric: Record<string, string>
  values: Array<[number, string]>
}

/** The `data` object of a successful `/api/v1/query_range` response. */
export interface PromMatrix {
  resultType: string
  result: PromSeries[]
}

/**
 * Transport for a Prometheus range query, injected so every behaviour below is testable without
 * a server. Implementations must THROW on a non-200 or a `status != "success"` body — see
 * `PromqlMetricsSource` for why a failure must never be absorbed into an empty series.
 */
export type RangeQuery = (opts: {
  query: string
  startSec: number
  endSec: number
  stepSec: number
}) => Promise<PromMatrix>

/**
 * Escape a label value for a PromQL matcher.
 *
 * Workload names reaching this module are already constrained to `^[a-z][a-z0-9-]*$` by the
 * route's param schema, so nothing here can currently contain a quote or a backslash. That is
 * exactly why the escaping is written now rather than later: the constraint lives in a different
 * file, and a future caller (a fleet-side aggregation, a label that is not a workload name) would
 * inherit an injection with no local sign that one was possible.
 */
export function escapeMatcherValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

/**
 * The step grid a response is built on, in unix SECONDS.
 *
 * Aligned to whole multiples of the step rather than to "now", so two polls a few seconds apart
 * return points at the SAME timestamps for the overlapping region. Without alignment every poll
 * would shift the whole series by a few seconds and the chart would jitter horizontally while
 * showing identical data.
 *
 * Length is `windowMs / stepMs` points ending at the aligned now — the count the ring buffer held
 * for a tier, kept deliberately after the buffer went. Emitting the extra boundary point would put
 * one more sample on the chart than the buffer ever did, which is precisely the kind of visible
 * difference the migration's gate forbade.
 */
export function buildGrid(opts: { nowMs: number; windowMs: number; stepMs?: number }): number[] {
  const stepMs = opts.stepMs ?? SAMPLE_INTERVAL_MS
  const stepSec = Math.max(1, Math.round(stepMs / 1000))
  const count = Math.max(1, Math.floor(opts.windowMs / stepMs))

  const endSec = Math.floor(opts.nowMs / 1000 / stepSec) * stepSec
  const grid: number[] = []
  for (let i = count - 1; i >= 0; i--) grid.push(endSec - i * stepSec)
  return grid
}

/**
 * Index a matrix response by timestamp.
 *
 * Takes the FIRST series only. Every query this module builds is matched to a single workload, so
 * a second series would mean a label collision — two cgroups reporting the same `workload` label —
 * and silently summing or averaging them would invent a number that describes neither. Taking the
 * first is not a preference between them; it keeps the failure visible as "one workload's data"
 * rather than hiding it inside an aggregate.
 *
 * A non-finite value (`NaN`, `+Inf`, which Prometheus serialises as strings) is DROPPED rather
 * than coerced. Dropping produces a null in the materialised series — "could not be determined" —
 * which is true. Coercing would produce a 0, which is a measurement claim nobody made.
 */
export function indexSeries(matrix: PromMatrix | null | undefined): Map<number, number> {
  const out = new Map<number, number>()
  const series = matrix?.result?.[0]
  if (!series) return out

  for (const [ts, raw] of series.values) {
    const value = Number(raw)
    if (!Number.isFinite(value)) continue
    out.set(Math.round(ts), value)
  }
  return out
}

/** Everything `materialiseSeries` needs, one map per query, all keyed by unix seconds. */
export interface SeriesInputs {
  grid: number[]
  /** `rate(cpu_seconds) / vcpus` — a FRACTION of allocated capacity, not a percentage. */
  cpu: Map<number, number>
  memoryBytes: Map<number, number>
  diskReadBps: Map<number, number>
  diskWriteBps: Map<number, number>
  /** `resets(...)` over the same step. Non-zero means the counter restarted inside the slot. */
  cpuResets: Map<number, number>
  diskReadResets: Map<number, number>
  diskWriteResets: Map<number, number>
}

/**
 * Build one `MetricSample` per grid slot — the gap materialisation the whole phase turns on.
 *
 * **Why this is the highest-risk piece in the migration.** A Prometheus range query returns only
 * the points that exist, so a naive `values.map(...)` yields a *shorter* array rather than an
 * array with holes. Every existing test still passes — the samples that are present are correct,
 * the response schema validates, the chart renders — and the chart quietly stops being able to
 * distinguish "this workload was stopped for ten minutes" from "we have less history than you
 * asked for". `metrics-no-readings` and `metrics-empty` exist precisely to separate those states,
 * and both survive only if absent points arrive as explicit nulls at their real timestamps.
 *
 * So the walk is over the GRID, never over the response.
 *
 * Read and write disk are judged INDEPENDENTLY, matching `computeDiskBps`: they are separate
 * counters that reset together but move separately, so a workload that only ever reads would have
 * its read line discarded by a write counter that never moves if one shared verdict were used.
 */
export function materialiseSeries(inputs: SeriesInputs): MetricSample[] {
  const { grid, cpu, memoryBytes, diskReadBps, diskWriteBps } = inputs

  /** A slot whose counter restarted is refused, even though Prometheus offers a plausible rate. */
  const reset = (resets: Map<number, number>, sec: number): boolean => (resets.get(sec) ?? 0) > 0

  return grid.map((sec): MetricSample => {
    const rawCpu = cpu.get(sec)
    const rawRead = diskReadBps.get(sec)
    const rawWrite = diskWriteBps.get(sec)
    const rawMem = memoryBytes.get(sec)

    return {
      timestamp: sec * 1000,
      cpuPercent:
        rawCpu === undefined || reset(inputs.cpuResets, sec) ? null : clampCpuPercent(rawCpu * 100),
      // Memory is a GAUGE, so a reset is meaningless for it — a restarted workload simply reports
      // its new usage, and that reading is true. Only the rate-derived lanes consult resets.
      memoryBytes: rawMem === undefined ? null : Math.round(rawMem),
      diskReadBps:
        rawRead === undefined || reset(inputs.diskReadResets, sec) ? null : roundBps(rawRead),
      diskWriteBps:
        rawWrite === undefined || reset(inputs.diskWriteResets, sec) ? null : roundBps(rawWrite),
    }
  })
}

/**
 * The seven expressions a workload's chart needs.
 *
 * The CPU expression carries the §2.1 join. `group_left()` is a many-to-one match on the
 * `workload` label: the rate is the "many" side (one series per workload) and the vCPU gauge the
 * "one". Written with an explicit `on(workload)` rather than a bare `/` because the two metrics
 * carry different label sets once Prometheus adds `instance` and `job` at scrape time — a bare
 * division would match nothing and return an empty result, which materialises as a chart of
 * unbroken nulls: the failure that looks exactly like an idle workload.
 *
 * The rate window is `[2 * step]` rather than `[step]`. A rate needs at least two samples inside
 * its window, and at a scrape interval EQUAL to the step a one-step window frequently contains
 * exactly one — so roughly every other point would be absent and the chart would render a comb of
 * alternating gaps. Two steps is the standard minimum and costs nothing but a slightly smoother
 * first derivative.
 */
export function buildQueries(name: string, stepSec: number): {
  cpu: string
  memory: string
  diskRead: string
  diskWrite: string
  cpuResets: string
  diskReadResets: string
  diskWriteResets: string
} {
  const m = `{workload="${escapeMatcherValue(name)}"}`
  const w = `${stepSec * 2}s`

  return {
    cpu:
      `rate(weaver_workload_cpu_usage_seconds_total${m}[${w}])` +
      ` / on(workload) group_left() weaver_workload_vcpus${m}`,
    memory: `weaver_workload_memory_bytes${m}`,
    diskRead: `rate(weaver_workload_disk_read_bytes_total${m}[${w}])`,
    diskWrite: `rate(weaver_workload_disk_write_bytes_total${m}[${w}])`,
    cpuResets: `resets(weaver_workload_cpu_usage_seconds_total${m}[${w}])`,
    diskReadResets: `resets(weaver_workload_disk_read_bytes_total${m}[${w}])`,
    diskWriteResets: `resets(weaver_workload_disk_write_bytes_total${m}[${w}])`,
  }
}

/**
 * Reads a workload's series from Prometheus.
 *
 * Shaped like the retired `MetricsCollector.getSamples` — which is why phase 4 deleted the buffer
 * by removing a branch from the route rather than rewriting the handler.
 *
 * **This class never absorbs a query failure.** `getSamples` returning `[]` on an unreachable
 * Prometheus would be indistinguishable from a workload with no history, so a broken monitoring
 * stack would render as a perfectly normal empty chart. A condition that changes the answer is
 * refused rather than absorbed: it throws, and the route turns that into an error the UI can
 * show.
 */
export class PromqlMetricsSource {
  constructor(
    private readonly rangeQuery: RangeQuery,
    private readonly stepMs: number = SAMPLE_INTERVAL_MS
  ) {}

  async getSamples(name: string, windowMs: number, nowMs = Date.now()): Promise<MetricSample[]> {
    const stepSec = Math.max(1, Math.round(this.stepMs / 1000))
    const grid = buildGrid({ nowMs, windowMs, stepMs: this.stepMs })
    const startSec = grid[0]!
    const endSec = grid[grid.length - 1]!

    const q = buildQueries(name, stepSec)
    const run = (query: string) => this.rangeQuery({ query, startSec, endSec, stepSec })

    // Issued together: seven sequential round-trips on a 60/min-budget endpoint would make the
    // proxy slower than the buffer it replaces for no reason. Any rejection propagates.
    const [cpu, memory, diskRead, diskWrite, cpuResets, diskReadResets, diskWriteResets] =
      await Promise.all([
        run(q.cpu),
        run(q.memory),
        run(q.diskRead),
        run(q.diskWrite),
        run(q.cpuResets),
        run(q.diskReadResets),
        run(q.diskWriteResets),
      ])

    return materialiseSeries({
      grid,
      cpu: indexSeries(cpu),
      memoryBytes: indexSeries(memory),
      diskReadBps: indexSeries(diskRead),
      diskWriteBps: indexSeries(diskWrite),
      cpuResets: indexSeries(cpuResets),
      diskReadResets: indexSeries(diskReadResets),
      diskWriteResets: indexSeries(diskWriteResets),
    })
  }
}

/**
 * HTTP transport against a Prometheus `/api/v1/query_range`.
 *
 * Throws on transport failure, on a non-200, and on a body whose `status` is not `"success"`.
 * Prometheus answers a *syntactically invalid query* with HTTP 400 and `status: "error"`, so
 * without the body check a typo in an expression above would arrive here as a rejected promise
 * only by luck of the status code.
 */
export function httpRangeQuery(baseUrl: string, timeoutMs = 10_000): RangeQuery {
  const root = baseUrl.replace(/\/+$/, '')

  return async ({ query, startSec, endSec, stepSec }) => {
    const url = new URL(`${root}/api/v1/query_range`)
    url.searchParams.set('query', query)
    url.searchParams.set('start', String(startSec))
    url.searchParams.set('end', String(endSec))
    url.searchParams.set('step', String(stepSec))

    const signal = AbortSignal.timeout(timeoutMs)
    const res = await fetch(url, { signal })
    if (!res.ok) {
      throw new Error(`Prometheus query failed: HTTP ${res.status}`)
    }

    const body = (await res.json()) as { status?: string; data?: PromMatrix; error?: string }
    if (body.status !== 'success' || !body.data) {
      // The upstream `error` field names the bad expression, which is a server-side diagnostic:
      // logged by the caller, never returned to a client — a raw system error leaks internal
      // paths and topology.
      throw new Error(`Prometheus query rejected: ${body.error ?? 'unknown error'}`)
    }
    return body.data
  }
}

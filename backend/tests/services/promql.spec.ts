// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * Phase-3 PromQL read path.
 *
 * The suite is weighted deliberately towards `materialiseSeries`, which the migration plan calls
 * the single highest-risk piece: a wrong implementation returns a SHORTER array of correct
 * samples, so the response still validates, the chart still renders, and every pre-existing test
 * still passes while the product quietly loses the ability to distinguish a stopped workload from
 * an unobserved one.
 *
 * Several tests below are written as the negative — they assert the shape a naive
 * `values.map(...)` would produce is NOT what comes out. Those are the ones that can actually
 * fail; a test that only checks the present points cannot.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  buildGrid,
  buildQueries,
  escapeMatcherValue,
  indexSeries,
  materialiseSeries,
  httpRangeQuery,
  PromqlMetricsSource,
  type PromMatrix,
  type RangeQuery,
} from '../../src/services/promql.js'
import { SAMPLE_INTERVAL_MS } from '../../src/services/metrics.js'

/** A matrix carrying one series built from `[unixSeconds, value]` pairs. */
const matrix = (pairs: Array<[number, number | string]>): PromMatrix => ({
  resultType: 'matrix',
  result: pairs.length ? [{ metric: { workload: 'web-nginx' }, values: pairs.map(([t, v]) => [t, String(v)] as [number, string]) }] : [],
})

const empty: PromMatrix = { resultType: 'matrix', result: [] }

const noResets = new Map<number, number>()

describe('buildGrid', () => {
  it('emits windowMs / stepMs points — the count the ring buffer used to hold', () => {
    // Free: 1 hour at 30s = 120 slots, which is exactly what RETENTION_FREE sized the buffer to
    // hold before phase 4 deleted it. 121 points would put one MORE sample on the chart than the
    // buffer ever did — the visible difference the migration's gate forbade, and still the reason
    // the boundary point is excluded.
    const grid = buildGrid({ nowMs: 1_800_000_000_000, windowMs: 3_600_000 })
    expect(grid).toHaveLength(120)
  })

  it('aligns to whole steps so successive polls agree on timestamps', () => {
    // Two polls 7 seconds apart inside the same 30s slot must produce the SAME grid, or the chart
    // shifts horizontally on every refresh while showing identical data.
    const a = buildGrid({ nowMs: 1_800_000_004_000, windowMs: 600_000 })
    const b = buildGrid({ nowMs: 1_800_000_011_000, windowMs: 600_000 })
    expect(a).toEqual(b)
    expect(a.every(sec => sec % 30 === 0)).toBe(true)
  })

  it('is ascending and evenly spaced', () => {
    const grid = buildGrid({ nowMs: 1_800_000_000_000, windowMs: 300_000 })
    const gaps = grid.slice(1).map((sec, i) => sec - grid[i]!)
    expect(new Set(gaps)).toEqual(new Set([30]))
    expect(grid).toEqual([...grid].sort((x, y) => x - y))
  })

  it('never returns an empty grid, even for a nonsense window', () => {
    // An empty grid would materialise as zero samples, which the UI reads as `metrics-empty` —
    // "no data yet" — rather than as the bad input it is.
    expect(buildGrid({ nowMs: 1_800_000_000_000, windowMs: 0 })).toHaveLength(1)
  })
})

describe('indexSeries', () => {
  it('indexes the first series by rounded unix seconds', () => {
    expect(indexSeries(matrix([[100, 1.5], [130, 2.5]]))).toEqual(new Map([[100, 1.5], [130, 2.5]]))
  })

  it('returns an empty map for an empty result rather than throwing', () => {
    expect(indexSeries(empty).size).toBe(0)
    expect(indexSeries(null).size).toBe(0)
  })

  it('DROPS a non-finite value instead of coercing it to 0', () => {
    // Prometheus serialises these as strings. `Number('NaN')` is NaN and `Number('+Inf')` is
    // Infinity — but the trap is that a dropped point becomes a null ("could not be determined",
    // true) while a coerced one becomes 0 (a measurement claim nobody made).
    const m = indexSeries(matrix([[100, 'NaN'], [130, '+Inf'], [160, 4]]))
    expect(m.has(100)).toBe(false)
    expect(m.has(130)).toBe(false)
    expect(m.get(160)).toBe(4)
  })

  it('takes only the first series when labels collide', () => {
    const two: PromMatrix = {
      resultType: 'matrix',
      result: [
        { metric: { workload: 'a' }, values: [[100, '1']] },
        { metric: { workload: 'a' }, values: [[100, '99']] },
      ],
    }
    expect(indexSeries(two).get(100)).toBe(1)
  })
})

describe('materialiseSeries — gap materialisation', () => {
  const grid = [100, 130, 160, 190]

  it('emits one sample per GRID slot, not one per returned point', () => {
    // THE test for this phase. Prometheus returned 2 points; the chart must receive 4.
    const out = materialiseSeries({
      grid,
      cpu: new Map([[100, 0.5], [190, 0.25]]),
      memoryBytes: new Map(),
      diskReadBps: new Map(),
      diskWriteBps: new Map(),
      cpuResets: noResets,
      diskReadResets: noResets,
      diskWriteResets: noResets,
    })

    expect(out).toHaveLength(4)
    expect(out.map(s => s.timestamp)).toEqual([100_000, 130_000, 160_000, 190_000])
    expect(out.map(s => s.cpuPercent)).toEqual([50, null, null, 25])
  })

  it('puts the gap at the RIGHT timestamp, not merely somewhere', () => {
    // A implementation that padded the array to the correct length with trailing nulls would pass
    // the length assertion above. This one pins the hole to the slot it actually belongs in.
    const out = materialiseSeries({
      grid,
      cpu: new Map([[100, 0.1], [160, 0.2], [190, 0.3]]),
      memoryBytes: new Map(),
      diskReadBps: new Map(),
      diskWriteBps: new Map(),
      cpuResets: noResets,
      diskReadResets: noResets,
      diskWriteResets: noResets,
    })
    expect(out[1]).toMatchObject({ timestamp: 130_000, cpuPercent: null })
    expect(out[2]).toMatchObject({ timestamp: 160_000, cpuPercent: 20 })
  })

  it('distinguishes a fully absent series from a series of real zeros', () => {
    // The two states the UI separates as `metrics-no-readings` vs a flat idle chart. Collapsing
    // null into 0 anywhere in this path erases the distinction irrecoverably.
    const absent = materialiseSeries({
      grid, cpu: new Map(), memoryBytes: new Map(), diskReadBps: new Map(), diskWriteBps: new Map(),
      cpuResets: noResets, diskReadResets: noResets, diskWriteResets: noResets,
    })
    const idle = materialiseSeries({
      grid,
      cpu: new Map(grid.map(t => [t, 0])),
      memoryBytes: new Map(grid.map(t => [t, 0])),
      diskReadBps: new Map(), diskWriteBps: new Map(),
      cpuResets: noResets, diskReadResets: noResets, diskWriteResets: noResets,
    })

    expect(absent.every(s => s.cpuPercent === null)).toBe(true)
    expect(idle.every(s => s.cpuPercent === 0)).toBe(true)
    expect(absent).not.toEqual(idle)
  })

  it('normalises a fraction to a percentage and clamps at 100', () => {
    const out = materialiseSeries({
      grid: [100, 130],
      cpu: new Map([[100, 1.03], [130, 0.4712]]),
      memoryBytes: new Map(), diskReadBps: new Map(), diskWriteBps: new Map(),
      cpuResets: noResets, diskReadResets: noResets, diskWriteResets: noResets,
    })
    expect(out[0]!.cpuPercent).toBe(100)
    expect(out[1]!.cpuPercent).toBe(47.12)
  })

  it('rounds memory to whole bytes', () => {
    const out = materialiseSeries({
      grid: [100],
      cpu: new Map(), memoryBytes: new Map([[100, 1048576.4]]),
      diskReadBps: new Map(), diskWriteBps: new Map(),
      cpuResets: noResets, diskReadResets: noResets, diskWriteResets: noResets,
    })
    expect(out[0]!.memoryBytes).toBe(1048576)
  })
})

describe('materialiseSeries — counter resets', () => {
  const grid = [100, 130, 160]

  it('nulls a CPU slot whose counter reset, despite rate() offering a number', () => {
    // §2.3: `rate()` corrects for resets and returns something plausible. The product refuses it —
    // a restart is operationally significant and the gap is how it stays visible.
    const out = materialiseSeries({
      grid,
      cpu: new Map([[100, 0.2], [130, 0.9], [160, 0.3]]),
      memoryBytes: new Map(), diskReadBps: new Map(), diskWriteBps: new Map(),
      cpuResets: new Map([[130, 1]]),
      diskReadResets: noResets, diskWriteResets: noResets,
    })
    expect(out.map(s => s.cpuPercent)).toEqual([20, null, 30])
  })

  it('judges disk read and write INDEPENDENTLY', () => {
    // Matches computeDiskBps. A shared verdict would discard a read-only workload's read line
    // because its write counter never moves.
    const out = materialiseSeries({
      grid: [100],
      cpu: new Map(),
      memoryBytes: new Map(),
      diskReadBps: new Map([[100, 1000]]),
      diskWriteBps: new Map([[100, 2000]]),
      cpuResets: noResets,
      diskReadResets: noResets,
      diskWriteResets: new Map([[100, 1]]),
    })
    expect(out[0]!.diskReadBps).toBe(1000)
    expect(out[0]!.diskWriteBps).toBeNull()
  })

  it('does NOT null memory on a reset — a gauge has no reset semantics', () => {
    // A restarted workload reports its new usage, and that reading is true. Only the rate-derived
    // lanes consult resets; treating a gauge the same way would blank a correct measurement.
    const out = materialiseSeries({
      grid: [100],
      cpu: new Map([[100, 0.5]]),
      memoryBytes: new Map([[100, 4096]]),
      diskReadBps: new Map(), diskWriteBps: new Map(),
      cpuResets: new Map([[100, 2]]),
      diskReadResets: noResets, diskWriteResets: noResets,
    })
    expect(out[0]!.cpuPercent).toBeNull()
    expect(out[0]!.memoryBytes).toBe(4096)
  })

  it('treats a zero reset count as no reset', () => {
    // `resets()` returns 0 for every healthy slot, so a truthiness check on the map's presence
    // rather than its value would blank the entire series.
    const out = materialiseSeries({
      grid: [100],
      cpu: new Map([[100, 0.5]]),
      memoryBytes: new Map(), diskReadBps: new Map(), diskWriteBps: new Map(),
      cpuResets: new Map([[100, 0]]),
      diskReadResets: new Map([[100, 0]]), diskWriteResets: new Map([[100, 0]]),
    })
    expect(out[0]!.cpuPercent).toBe(50)
  })
})

describe('buildQueries', () => {
  it('joins the vCPU gauge with an explicit on(workload) group_left()', () => {
    // A bare `/` matches on the FULL label set, and Prometheus adds `instance` + `job` at scrape
    // time — so it would match nothing and return an empty result, which materialises as a chart
    // of unbroken nulls: the failure that looks exactly like an idle workload.
    const q = buildQueries('web-nginx', 30)
    expect(q.cpu).toContain('on(workload) group_left()')
    expect(q.cpu).toContain('weaver_workload_vcpus{workload="web-nginx"}')
    expect(q.cpu).toContain('rate(weaver_workload_cpu_usage_seconds_total')
  })

  it('uses a rate window of two steps, not one', () => {
    // A rate needs two samples inside its window. At a scrape interval equal to the step, a
    // one-step window frequently holds exactly one — producing a comb of alternating gaps.
    expect(buildQueries('x', 30).cpu).toContain('[60s]')
    expect(buildQueries('x', 15).diskRead).toContain('[30s]')
  })

  it('queries resets over the same counters it rates', () => {
    const q = buildQueries('x', 30)
    expect(q.cpuResets).toContain('resets(weaver_workload_cpu_usage_seconds_total')
    expect(q.diskReadResets).toContain('resets(weaver_workload_disk_read_bytes_total')
    expect(q.diskWriteResets).toContain('resets(weaver_workload_disk_write_bytes_total')
  })

  it('reads memory as a plain gauge with no rate', () => {
    expect(buildQueries('x', 30).memory).toBe('weaver_workload_memory_bytes{workload="x"}')
  })
})

describe('escapeMatcherValue', () => {
  it('escapes quotes and backslashes so a matcher cannot be broken out of', () => {
    expect(escapeMatcherValue('a"b')).toBe('a\\"b')
    expect(escapeMatcherValue('a\\b')).toBe('a\\\\b')
    expect(escapeMatcherValue('a\nb')).toBe('a\\nb')
  })

  it('leaves a legal workload name untouched', () => {
    expect(escapeMatcherValue('web-nginx-01')).toBe('web-nginx-01')
  })
})

describe('PromqlMetricsSource', () => {
  it('issues every query over the same start/end/step window', () => {
    const seen: Array<{ startSec: number; endSec: number; stepSec: number }> = []
    const rq: RangeQuery = async ({ startSec, endSec, stepSec }) => {
      seen.push({ startSec, endSec, stepSec })
      return empty
    }

    return new PromqlMetricsSource(rq).getSamples('web-nginx', 600_000, 1_800_000_000_000).then(() => {
      expect(seen).toHaveLength(7)
      expect(new Set(seen.map(s => JSON.stringify(s))).size).toBe(1)
      expect(seen[0]!.stepSec).toBe(SAMPLE_INTERVAL_MS / 1000)
    })
  })

  it('returns a full-length series of nulls when Prometheus has nothing', () => {
    // Not an empty array. 20 minutes at 30s is 40 slots, every one explicitly unknown — which is
    // what lets the UI say "no readings" rather than "still loading".
    const rq: RangeQuery = async () => empty
    return new PromqlMetricsSource(rq).getSamples('x', 1_200_000, 1_800_000_000_000).then(out => {
      expect(out).toHaveLength(40)
      expect(out.every(s => s.cpuPercent === null && s.memoryBytes === null)).toBe(true)
    })
  })

  it('assembles a real series across all four lanes', async () => {
    const now = 1_800_000_000_000
    const grid = buildGrid({ nowMs: now, windowMs: 120_000 })
    const rq: RangeQuery = async ({ query }) => {
      if (query.startsWith('resets(')) return empty
      if (query.includes('cpu_usage')) return matrix([[grid[0]!, 0.25], [grid[2]!, 0.5]])
      if (query.includes('memory_bytes')) return matrix(grid.map(t => [t, 2048] as [number, number]))
      if (query.includes('disk_read')) return matrix([[grid[1]!, 512]])
      if (query.includes('disk_write')) return matrix([[grid[3]!, 1024]])
      return empty
    }

    const out = await new PromqlMetricsSource(rq).getSamples('web-nginx', 120_000, now)

    expect(out).toHaveLength(4)
    expect(out.map(s => s.cpuPercent)).toEqual([25, null, 50, null])
    expect(out.map(s => s.memoryBytes)).toEqual([2048, 2048, 2048, 2048])
    expect(out.map(s => s.diskReadBps)).toEqual([null, 512, null, null])
    expect(out.map(s => s.diskWriteBps)).toEqual([null, null, null, 1024])
  })

  it('THROWS when a query fails — it must never look like an empty chart', async () => {
    // The refuse-vs-absorb split: an unreachable Prometheus changes the answer, so it is refused.
    // Returning [] here would render a broken monitoring stack as a normal idle workload.
    const rq: RangeQuery = async () => { throw new Error('connect ECONNREFUSED') }
    await expect(new PromqlMetricsSource(rq).getSamples('x', 600_000)).rejects.toThrow(/ECONNREFUSED/)
  })
})

describe('httpRangeQuery', () => {
  const okBody = { status: 'success', data: { resultType: 'matrix', result: [] } }

  it('sends query/start/end/step as query parameters', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(okBody), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await httpRangeQuery('http://127.0.0.1:9090')({ query: 'up', startSec: 10, endSec: 40, stepSec: 30 })

    const url = new URL(fetchMock.mock.calls[0]![0] as unknown as string)
    expect(url.pathname).toBe('/api/v1/query_range')
    expect(url.searchParams.get('query')).toBe('up')
    expect(url.searchParams.get('start')).toBe('10')
    expect(url.searchParams.get('end')).toBe('40')
    expect(url.searchParams.get('step')).toBe('30')
    vi.unstubAllGlobals()
  })

  it('strips a trailing slash from the base URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(okBody), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await httpRangeQuery('http://127.0.0.1:9090/')({ query: 'up', startSec: 1, endSec: 2, stepSec: 1 })
    expect(new URL(fetchMock.mock.calls[0]![0] as unknown as string).pathname).toBe('/api/v1/query_range')
    vi.unstubAllGlobals()
  })

  it('throws on a non-200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })))
    await expect(
      httpRangeQuery('http://x')({ query: 'up', startSec: 1, endSec: 2, stepSec: 1 })
    ).rejects.toThrow(/HTTP 503/)
    vi.unstubAllGlobals()
  })

  it('throws on a 200 whose body reports status:error', async () => {
    // Prometheus answers an invalid expression with 400 + status:error, but a proxy in front can
    // return 200 with the same body. Without the body check a typo in an expression would surface
    // as an empty chart rather than as a failure.
    const body = { status: 'error', error: 'parse error: unexpected ")"' }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
    await expect(
      httpRangeQuery('http://x')({ query: 'bad(', startSec: 1, endSec: 2, stepSec: 1 })
    ).rejects.toThrow(/parse error/)
    vi.unstubAllGlobals()
  })
})

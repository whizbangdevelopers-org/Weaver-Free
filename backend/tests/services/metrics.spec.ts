// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// The pure half of resource metrics.
//
// Every case below is one where the wrong implementation returns a PLAUSIBLE NUMBER rather than
// an error — which is the whole risk profile of a graph. A crash gets fixed; a chart that reads
// 0% for a busy workload, or spikes to 100% because a unit restarted, gets believed. The feature
// exists to close a credibility gap, so a subtly wrong graph is worse than no graph: it is the
// same gap plus a reason to distrust the rest of the page.
import { describe, it, expect } from 'vitest'
import {
  parseCpuUsageUsec,
  computeCpuPercent,
  parseMemoryCurrent,
  parseMemoryMax,
  cgroupPathFor,
  MetricRingBuffer,
  retentionForTier,
  resolveWindowMs,
  maxWindowMsForTier,
  RETENTION_FREE,
  RETENTION_PAID,
  SAMPLE_INTERVAL_MS,
  MetricsCollector,
  type MetricSample,
  type CgroupReader,
} from '../../src/services/metrics.js'

const sample = (timestamp: number, cpu: number | null = 1): MetricSample => ({
  timestamp,
  cpuPercent: cpu,
  memoryBytes: 1024,
  diskBytes: null,
})

describe('cpu.stat parsing', () => {
  const REAL = [
    'usage_usec 123456789',
    'user_usec 100000000',
    'system_usec 23456789',
    'nr_periods 0',
    'nr_throttled 0',
    'throttled_usec 0',
  ].join('\n')

  it('extracts usage_usec from a real cpu.stat', () => {
    expect(parseCpuUsageUsec(REAL)).toBe(123456789)
  })

  it('is not confused by user_usec appearing first', () => {
    const reordered = ['user_usec 100000000', 'usage_usec 42', 'system_usec 7'].join('\n')
    // A naive "first number on a line containing usec" would return 100000000 here.
    expect(parseCpuUsageUsec(reordered)).toBe(42)
  })

  it('tolerates trailing whitespace and blank lines', () => {
    expect(parseCpuUsageUsec('\n  usage_usec   99  \n\n')).toBe(99)
  })

  it('returns null when the key is absent — not 0', () => {
    // Zero would render as a real "idle" reading for a cgroup that has not been accounted yet.
    expect(parseCpuUsageUsec('user_usec 5\nsystem_usec 5')).toBeNull()
  })

  it('returns null on a garbage value', () => {
    expect(parseCpuUsageUsec('usage_usec not-a-number')).toBeNull()
  })

  it('returns null on empty input', () => {
    expect(parseCpuUsageUsec('')).toBeNull()
  })
})

describe('computeCpuPercent', () => {
  it('computes a straightforward single-vCPU reading', () => {
    // 15s of CPU over 30s of wall clock on 1 vCPU = 50%.
    expect(computeCpuPercent({
      previousUsec: 0, currentUsec: 15_000_000, elapsedMs: 30_000, vcpus: 1,
    })).toBe(50)
  })

  it('normalises by vCPU count', () => {
    // The same 15s of CPU across 2 vCPUs is half the allocation → 25%.
    // Without normalisation a 4-vCPU workload at full tilt reads 400%, and two workloads under
    // identical relative load report different numbers.
    expect(computeCpuPercent({
      previousUsec: 0, currentUsec: 15_000_000, elapsedMs: 30_000, vcpus: 2,
    })).toBe(25)
  })

  it('reports 100% for a fully saturated allocation', () => {
    expect(computeCpuPercent({
      previousUsec: 0, currentUsec: 60_000_000, elapsedMs: 30_000, vcpus: 2,
    })).toBe(100)
  })

  it('clamps marginally-over readings to 100 rather than showing 103%', () => {
    expect(computeCpuPercent({
      previousUsec: 0, currentUsec: 31_000_000, elapsedMs: 30_000, vcpus: 1,
    })).toBe(100)
  })

  // --- the cases that would otherwise produce a believable wrong number ---

  it('returns null with no previous sample, not 0', () => {
    // The cold-start case. 0 here draws a flat idle line for the first interval of every
    // workload's life, which is exactly when someone is watching it boot.
    expect(computeCpuPercent({
      previousUsec: null, currentUsec: 15_000_000, elapsedMs: 30_000, vcpus: 1,
    })).toBeNull()
  })

  it('returns null when the counter goes backwards — the unit restarted', () => {
    // cgroup recreated: usage_usec restarts at 0. A raw delta is negative; an abs() or a clamp
    // would invent a spike at precisely the moment a user is looking to see what happened.
    expect(computeCpuPercent({
      previousUsec: 900_000_000, currentUsec: 1_000, elapsedMs: 30_000, vcpus: 1,
    })).toBeNull()
  })

  it('returns null on non-positive elapsed time', () => {
    // Clock stepped backwards, or two reads inside one tick — a division by ~0 produces Infinity.
    expect(computeCpuPercent({ previousUsec: 0, currentUsec: 5, elapsedMs: 0, vcpus: 1 })).toBeNull()
    expect(computeCpuPercent({ previousUsec: 0, currentUsec: 5, elapsedMs: -1000, vcpus: 1 })).toBeNull()
  })

  it('returns null on a nonsensical vCPU count', () => {
    expect(computeCpuPercent({ previousUsec: 0, currentUsec: 5, elapsedMs: 30_000, vcpus: 0 })).toBeNull()
  })

  it('reports a genuinely idle workload as 0, distinct from null', () => {
    // The counterpart to the cold-start case: a real zero must survive as a zero.
    expect(computeCpuPercent({
      previousUsec: 500, currentUsec: 500, elapsedMs: 30_000, vcpus: 1,
    })).toBe(0)
  })
})

describe('memory parsing', () => {
  it('reads memory.current', () => {
    expect(parseMemoryCurrent('268435456\n')).toBe(268435456)
  })

  it('returns null on garbage rather than NaN', () => {
    expect(parseMemoryCurrent('')).toBeNull()
    expect(parseMemoryCurrent('nonsense')).toBeNull()
  })

  it('treats memory.max of "max" as no limit', () => {
    // Rendering a percentage against this would be NaN% or 0% depending on the arithmetic —
    // both of which look like a working readout.
    expect(parseMemoryMax('max\n')).toBeNull()
  })

  it('reads a real memory.max', () => {
    expect(parseMemoryMax('536870912\n')).toBe(536870912)
  })

  it('treats a zero limit as no limit', () => {
    expect(parseMemoryMax('0')).toBeNull()
  })

  it('returns null on empty input — currently safe only via the > 0 guard', () => {
    // `Number('')` is 0, so this passes only because the limit guard is `> 0` rather than `>= 0`.
    // Its sibling parseMemoryCurrent uses `>= 0` (a zero reading is legitimate there) and DID
    // ship this bug. Pinned so nobody harmonises the two guards and reintroduces it.
    expect(parseMemoryMax('')).toBeNull()
    expect(parseMemoryMax('   ')).toBeNull()
  })
})

describe('cgroupPathFor', () => {
  it('builds the systemd unit path', () => {
    expect(cgroupPathFor('web-nginx')).toBe('/sys/fs/cgroup/system.slice/microvm@web-nginx.service')
  })

  it('accepts an alternate root, so tests need no real cgroupfs', () => {
    expect(cgroupPathFor('db', '/tmp/cg')).toBe('/tmp/cg/system.slice/microvm@db.service')
  })
})

describe('MetricRingBuffer', () => {
  it('rejects a non-positive capacity', () => {
    expect(() => new MetricRingBuffer(0)).toThrow()
  })

  it('accumulates below capacity, oldest first', () => {
    const buf = new MetricRingBuffer(5)
    buf.push(sample(1))
    buf.push(sample(2))
    expect(buf.toArray().map(s => s.timestamp)).toEqual([1, 2])
    expect(buf.size).toBe(2)
  })

  it('overwrites the oldest once full and preserves chronological order', () => {
    const buf = new MetricRingBuffer(3)
    for (const t of [1, 2, 3, 4, 5]) buf.push(sample(t))
    // The wrap is where a hand-rolled ring buffer usually returns the right VALUES in the wrong
    // ORDER, which draws a graph that jumps backwards in time mid-line.
    expect(buf.toArray().map(s => s.timestamp)).toEqual([3, 4, 5])
    expect(buf.size).toBe(3)
  })

  it('stays correct across several full wraps', () => {
    const buf = new MetricRingBuffer(3)
    for (let t = 1; t <= 10; t++) buf.push(sample(t))
    expect(buf.toArray().map(s => s.timestamp)).toEqual([8, 9, 10])
  })

  it('is exactly correct at the boundary where it first fills', () => {
    const buf = new MetricRingBuffer(3)
    for (const t of [1, 2, 3]) buf.push(sample(t))
    expect(buf.toArray().map(s => s.timestamp)).toEqual([1, 2, 3])
    buf.push(sample(4))
    expect(buf.toArray().map(s => s.timestamp)).toEqual([2, 3, 4])
  })

  it('never exceeds capacity — the leak this class exists to prevent', () => {
    const buf = new MetricRingBuffer(10)
    for (let t = 0; t < 5000; t++) buf.push(sample(t))
    expect(buf.size).toBe(10)
  })

  describe('window()', () => {
    it('filters by timestamp, not by count', () => {
      const buf = new MetricRingBuffer(10)
      const now = 1_000_000
      buf.push(sample(now - 7_200_000)) // 2h ago
      buf.push(sample(now - 1_800_000)) // 30m ago
      buf.push(sample(now - 60_000))    // 1m ago

      expect(buf.window(3_600_000, now).map(s => s.timestamp))
        .toEqual([now - 1_800_000, now - 60_000])
    })

    it('excludes stale samples after a collection gap', () => {
      // The collector was paused — host asleep, service restarted. Counting back N samples would
      // present hours-old data under a "last hour" heading; only a timestamp filter can tell.
      const buf = new MetricRingBuffer(10)
      const now = 10_000_000
      for (const ago of [50_000_000, 49_000_000, 48_000_000]) buf.push(sample(now - ago))
      expect(buf.window(3_600_000, now)).toEqual([])
    })

    it('includes a sample exactly on the boundary', () => {
      const buf = new MetricRingBuffer(4)
      const now = 5_000_000
      buf.push(sample(now - 3_600_000))
      expect(buf.window(3_600_000, now)).toHaveLength(1)
    })
  })
})

describe('tier retention', () => {
  it('gives Free one hour and paid tiers 24', () => {
    expect(retentionForTier('free')).toBe(RETENTION_FREE)
    expect(retentionForTier('weaver')).toBe(RETENTION_PAID)
    expect(retentionForTier('team')).toBe(RETENTION_PAID)
    expect(retentionForTier('fabrick')).toBe(RETENTION_PAID)
  })

  it('the sample counts really are an hour and a day at the sampling interval', () => {
    // Guards the constants against each other: changing SAMPLE_INTERVAL_MS without changing the
    // retention counts silently redefines what "1 hour" means in the UI.
    expect(RETENTION_FREE * SAMPLE_INTERVAL_MS).toBe(3_600_000)
    expect(RETENTION_PAID * SAMPLE_INTERVAL_MS).toBe(86_400_000)
  })

  it('caps the window a tier may see', () => {
    expect(maxWindowMsForTier('free')).toBe(3_600_000)
    expect(maxWindowMsForTier('weaver')).toBe(86_400_000)
  })
})

describe('resolveWindowMs', () => {
  it('parses hours and minutes', () => {
    expect(resolveWindowMs('24h', 'weaver')).toBe(86_400_000)
    expect(resolveWindowMs('30m', 'weaver')).toBe(1_800_000)
  })

  it('clamps a Free request to its entitlement rather than erroring', () => {
    // Serving the hour they are entitled to beats a 403 for asking. The response reports the
    // window actually served, so the axis can be labelled honestly.
    expect(resolveWindowMs('24h', 'free')).toBe(3_600_000)
  })

  it('defaults to the tier maximum when unspecified', () => {
    expect(resolveWindowMs(undefined, 'free')).toBe(3_600_000)
    expect(resolveWindowMs(undefined, 'weaver')).toBe(86_400_000)
  })

  it('falls back to the maximum on unparseable input rather than 0', () => {
    // A 0-length window returns an empty series, which renders as an empty graph — visually
    // identical to "this workload has no data", for what is actually a malformed query string.
    expect(resolveWindowMs('bogus', 'weaver')).toBe(86_400_000)
    expect(resolveWindowMs('0h', 'weaver')).toBe(86_400_000)
    expect(resolveWindowMs('-5m', 'weaver')).toBe(86_400_000)
  })
})

/**
 * The collector — the stateful half.
 *
 * Its interesting behaviour is all across TIME (counter resets, gaps, restarts) and against a
 * filesystem that may not have the files at all, so both the reader and the clock are injected.
 * A test that used the real cgroupfs could not express a single case below.
 */
describe('MetricsCollector', () => {
  /** A fake cgroupfs. Missing key = the file does not exist, which is the stopped-workload case. */
  function fakeFs(files: Record<string, string>) {
    const reads: string[] = []
    return {
      reads,
      files,
      read: async (path: string) => {
        reads.push(path)
        return path in files ? files[path]! : null
      },
    }
  }

  const ROOT = '/fake/cgroup'
  const cpuPath = (n: string) => `${ROOT}/system.slice/microvm@${n}.service/cpu.stat`
  const memPath = (n: string) => `${ROOT}/system.slice/microvm@${n}.service/memory.current`

  function makeClock(start = 1_000_000) {
    let t = start
    return { now: () => t, advance: (ms: number) => { t += ms } }
  }

  it('produces no CPU number on the first sample, but does record memory', () => {
    // Cold start: there is no previous counter to difference against. Memory is an absolute
    // reading and is available immediately — the two must not share a fate.
    const fs = fakeFs({ [cpuPath('a')]: 'usage_usec 1000', [memPath('a')]: '2048' })
    const clock = makeClock()
    const c = new MetricsCollector({ read: fs.read, now: clock.now, cgroupRoot: ROOT })

    return c.sampleOne('a', 1).then(s => {
      expect(s.cpuPercent).toBeNull()
      expect(s.memoryBytes).toBe(2048)
    })
  })

  it('computes CPU on the second sample', async () => {
    const fs = fakeFs({ [cpuPath('a')]: 'usage_usec 0', [memPath('a')]: '2048' })
    const clock = makeClock()
    const c = new MetricsCollector({ read: fs.read, now: clock.now, cgroupRoot: ROOT })

    await c.sampleOne('a', 1)
    clock.advance(30_000)
    fs.files[cpuPath('a')] = 'usage_usec 15000000' // 15s of CPU over 30s on 1 vCPU
    const second = await c.sampleOne('a', 1)
    expect(second.cpuPercent).toBe(50)
  })

  it('returns null for the interval spanning a unit restart, then recovers', async () => {
    const fs = fakeFs({ [cpuPath('a')]: 'usage_usec 900000000', [memPath('a')]: '2048' })
    const clock = makeClock()
    const c = new MetricsCollector({ read: fs.read, now: clock.now, cgroupRoot: ROOT })

    await c.sampleOne('a', 1)

    // The unit restarts: the cgroup is recreated and the counter goes back to near zero.
    clock.advance(30_000)
    fs.files[cpuPath('a')] = 'usage_usec 1000'
    expect((await c.sampleOne('a', 1)).cpuPercent).toBeNull()

    // The NEXT interval must work again — the baseline has to have been re-anchored to the new
    // counter. If the reset left the old baseline in place, every subsequent sample would also be
    // null and the workload would simply stop having a CPU line after any restart.
    clock.advance(30_000)
    fs.files[cpuPath('a')] = 'usage_usec 15001000'
    expect((await c.sampleOne('a', 1)).cpuPercent).toBe(50)
  })

  it('does not advance the baseline on an unreadable cgroup', async () => {
    // A transient read failure must not permanently break CPU for that workload. Storing null as
    // the baseline would make every later sample look like another cold start.
    const fs = fakeFs({ [cpuPath('a')]: 'usage_usec 0', [memPath('a')]: '1' })
    const clock = makeClock()
    const c = new MetricsCollector({ read: fs.read, now: clock.now, cgroupRoot: ROOT })

    await c.sampleOne('a', 1)

    clock.advance(30_000)
    delete fs.files[cpuPath('a')] // vanished for one round
    expect((await c.sampleOne('a', 1)).cpuPercent).toBeNull()

    clock.advance(30_000)
    fs.files[cpuPath('a')] = 'usage_usec 60000000' // 60s of CPU since the last REAL reading (60s ago)
    expect((await c.sampleOne('a', 1)).cpuPercent).toBe(100)
  })

  it('records a sample even when nothing could be read', async () => {
    // A stopped workload has no cgroup. It still gets a timestamped sample with null values, so
    // the graph shows a gap rather than silently omitting the period.
    const fs = fakeFs({})
    const c = new MetricsCollector({ read: fs.read, cgroupRoot: ROOT })
    const s = await c.sampleOne('ghost', 1)
    expect(s.cpuPercent).toBeNull()
    expect(s.memoryBytes).toBeNull()
    expect(c.getSamples('ghost', 3_600_000)).toHaveLength(1)
  })

  it('keeps per-workload state separate', async () => {
    const fs = fakeFs({
      [cpuPath('a')]: 'usage_usec 0', [memPath('a')]: '100',
      [cpuPath('b')]: 'usage_usec 0', [memPath('b')]: '200',
    })
    const clock = makeClock()
    const c = new MetricsCollector({ read: fs.read, now: clock.now, cgroupRoot: ROOT })

    await c.sampleAll([{ name: 'a', vcpu: 1 }, { name: 'b', vcpu: 1 }])
    clock.advance(30_000)
    fs.files[cpuPath('a')] = 'usage_usec 30000000' // a is pinned
    fs.files[cpuPath('b')] = 'usage_usec 0'        // b is idle
    await c.sampleAll([{ name: 'a', vcpu: 1 }, { name: 'b', vcpu: 1 }])

    expect(c.getSamples('a', 3_600_000).at(-1)!.cpuPercent).toBe(100)
    expect(c.getSamples('b', 3_600_000).at(-1)!.cpuPercent).toBe(0)
  })

  it('one unreadable workload does not abort the others in the same round', async () => {
    // Promise.all would reject the whole round on a single throwing read, so every other
    // workload would silently lose that interval.
    const throwing: CgroupReader = async (path: string) => {
      if (path.includes('broken')) throw new Error('EACCES')
      return path.endsWith('cpu.stat') ? 'usage_usec 0' : '512'
    }
    const c = new MetricsCollector({ read: throwing, cgroupRoot: ROOT })
    await c.sampleAll([{ name: 'broken', vcpu: 1 }, { name: 'fine', vcpu: 1 }])
    expect(c.getSamples('fine', 3_600_000)).toHaveLength(1)
  })

  it('honours the retention cap it was constructed with', async () => {
    const fs = fakeFs({ [cpuPath('a')]: 'usage_usec 0', [memPath('a')]: '1' })
    const clock = makeClock()
    const c = new MetricsCollector({ read: fs.read, now: clock.now, cgroupRoot: ROOT, retention: 3 })
    for (let i = 0; i < 10; i++) {
      await c.sampleOne('a', 1)
      clock.advance(30_000)
    }
    expect(c.getSamples('a', 86_400_000)).toHaveLength(3)
  })

  it('forgets a workload on request', async () => {
    const fs = fakeFs({ [cpuPath('a')]: 'usage_usec 0', [memPath('a')]: '1' })
    const c = new MetricsCollector({ read: fs.read, cgroupRoot: ROOT })
    await c.sampleOne('a', 1)
    expect(c.trackedCount).toBe(1)
    c.forget('a')
    expect(c.trackedCount).toBe(0)
    expect(c.getSamples('a', 3_600_000)).toEqual([])
  })

  it('reads from the real cgroup root when none is injected', async () => {
    const fs = fakeFs({})
    const c = new MetricsCollector({ read: fs.read })
    await c.sampleOne('web', 1)
    expect(fs.reads).toContain('/sys/fs/cgroup/system.slice/microvm@web.service/cpu.stat')
  })
})

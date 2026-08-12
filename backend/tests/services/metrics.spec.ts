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
  type MetricSample,
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

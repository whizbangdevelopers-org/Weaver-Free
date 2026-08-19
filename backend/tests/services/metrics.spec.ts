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
  parseIoStat,
  computeDiskBps,
  parseMemoryCurrent,
  parseMemoryMax,
  cgroupPathFor,
  resolveWindowMs,
  maxWindowMsForTier,
  MAX_WINDOW_MS_FREE,
  MAX_WINDOW_MS_PAID,
  SAMPLE_INTERVAL_MS,
} from '../../src/services/metrics.js'

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

describe('io.stat parsing', () => {
  const ONE_LINE = '8:0 rbytes=4096 wbytes=512 rios=1 wios=2 dbytes=0 dios=0'

  it('reads rbytes and wbytes off a single device', () => {
    expect(parseIoStat(ONE_LINE)).toEqual({ readBytes: 4096, writeBytes: 512 })
  })

  it('SUMS across devices rather than taking the first', () => {
    // A workload's disk is routinely more than one device — an overlay plus its backing image, or
    // a separate data volume. Reporting only the first line under-reports by whatever the rest
    // carry, and it under-reports as a plausible number rather than as an error.
    const two = `${ONE_LINE}\n253:0 rbytes=1000 wbytes=2000 rios=3 wios=4 dbytes=0 dios=0`
    expect(parseIoStat(two)).toEqual({ readBytes: 5096, writeBytes: 2512 })
  })

  it('returns null — not zero — when the file has no counters at all', () => {
    // A cgroup with no io controller and a workload doing no I/O are different facts. Collapsing
    // them makes the first sample after start read as a real zero.
    expect(parseIoStat('')).toBeNull()
    expect(parseIoStat('\n  \n')).toBeNull()
    expect(parseIoStat('8:0 rios=1 wios=2')).toBeNull()
  })

  it('skips a malformed device line without discarding the others', () => {
    const mixed = `garbage-with-no-fields\n${ONE_LINE}`
    expect(parseIoStat(mixed)).toEqual({ readBytes: 4096, writeBytes: 512 })
  })

  it('ignores a negative or non-numeric counter rather than trusting it', () => {
    expect(parseIoStat('8:0 rbytes=-5 wbytes=100')).toEqual({ readBytes: 0, writeBytes: 100 })
    expect(parseIoStat('8:0 rbytes=abc wbytes=100')).toEqual({ readBytes: 0, writeBytes: 100 })
  })
})

describe('computeDiskBps', () => {
  const prev = { readBytes: 1000, writeBytes: 2000 }

  it('computes bytes per second across the interval', () => {
    const r = computeDiskBps({ previous: prev, current: { readBytes: 3000, writeBytes: 2000 }, elapsedMs: 2000 })
    expect(r.readBps).toBe(1000) // 2000 bytes over 2s
    expect(r.writeBps).toBe(0)   // genuinely idle, and that IS zero rather than null
  })

  it('returns null on a cold start', () => {
    expect(computeDiskBps({ previous: null, current: prev, elapsedMs: 30_000 }))
      .toEqual({ readBps: null, writeBps: null })
  })

  it('returns null when the cgroup is unreadable this tick', () => {
    expect(computeDiskBps({ previous: prev, current: null, elapsedMs: 30_000 }))
      .toEqual({ readBps: null, writeBps: null })
  })

  it('returns null on a non-positive interval', () => {
    // Two reads inside one clock tick, or a clock adjustment. Dividing by it yields Infinity,
    // which formats as a readable-looking rate.
    expect(computeDiskBps({ previous: prev, current: prev, elapsedMs: 0 }))
      .toEqual({ readBps: null, writeBps: null })
  })

  it('REFUSES across a counter reset rather than smoothing it', () => {
    // The cgroup was recreated — the unit restarted between samples. A delta here is not a rate,
    // and the restart is the thing the reader most needs to see.
    const r = computeDiskBps({ previous: prev, current: { readBytes: 10, writeBytes: 20 }, elapsedMs: 30_000 })
    expect(r).toEqual({ readBps: null, writeBps: null })
  })

  it('judges read and write INDEPENDENTLY', () => {
    // A read-only workload's write counter never moves. Under a single shared verdict its read
    // line would be discarded along with the write one.
    const r = computeDiskBps({
      previous: prev,
      current: { readBytes: 5000, writeBytes: 5 }, // read advanced, write reset
      elapsedMs: 1000,
    })
    expect(r.readBps).toBe(4000)
    expect(r.writeBps).toBeNull()
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
  /**
   * These assertions are about SYSTEMD, not about us, and that is the whole point.
   *
   * The previous version of this block asserted
   * `/sys/fs/cgroup/system.slice/microvm@web-nginx.service` — the path the function built, checked
   * against the path the function built. It passed for as long as it existed while naming a
   * directory that exists on no host, because the rest of the suite supplies a fake cgroupfs at
   * whatever path this function returns. A closed loop cannot fail.
   *
   * The missing component is systemd's implicit slice for template units: an instance of
   * `foo@.service` is placed in `system-foo.slice` with no `Slice=` line in the unit file.
   * Verified on a live host — `microvm@discover-probe.service` → `system-microvm.slice`, and on
   * the same host `getty@tty1.service` → `system-getty.slice`, `user@0.service` → `user-0.slice`.
   */
  it('includes the implicit template slice systemd puts instance units in', () => {
    expect(cgroupPathFor('web-nginx')).toBe(
      '/sys/fs/cgroup/system.slice/system-microvm.slice/microvm@web-nginx.service'
    )
  })

  it('does NOT use the flat system.slice path, which exists on no host', () => {
    // Written as its own negative case so a "simplification" back to the flat path fails loudly
    // rather than reintroducing a silent, total loss of workload metrics.
    expect(cgroupPathFor('web-nginx')).not.toBe(
      '/sys/fs/cgroup/system.slice/microvm@web-nginx.service'
    )
  })

  it('accepts an alternate root, so tests need no real cgroupfs', () => {
    expect(cgroupPathFor('db', '/tmp/cg')).toBe(
      '/tmp/cg/system.slice/system-microvm.slice/microvm@db.service'
    )
  })
})

describe('tier windows', () => {
  // These were RETENTION_FREE/RETENTION_PAID — sample counts sizing a ring buffer that phase 4
  // deleted. The product rule they also encoded (Free sees an hour, paid sees a day) survives,
  // now stated in milliseconds because that is the unit it is enforced in.
  it('gives Free one hour and every paid tier 24', () => {
    expect(maxWindowMsForTier('free')).toBe(3_600_000)
    expect(maxWindowMsForTier('solo')).toBe(86_400_000)
    expect(maxWindowMsForTier('team')).toBe(86_400_000)
    expect(maxWindowMsForTier('fabrick')).toBe(86_400_000)
  })

  it('treats an UNKNOWN tier as paid, not as Free', () => {
    // Deliberate: the rule is "not Free", never an enumeration. A tier added later gets the paid
    // window by default rather than silently inheriting Free's — the demo's own gate enumerated
    // SOLO || FABRICK and excluded Team, a paying tier, for exactly this reason.
    expect(maxWindowMsForTier('tier-invented-next-year')).toBe(86_400_000)
  })

  it('the constants really are an hour and a day', () => {
    expect(MAX_WINDOW_MS_FREE).toBe(3_600_000)
    expect(MAX_WINDOW_MS_PAID).toBe(86_400_000)
  })

  it('the window is still a whole number of sample intervals', () => {
    // Not arithmetic for its own sake: a window that is not a multiple of the scrape interval
    // makes the last grid slot a partial one, which materialises as a null nobody can explain.
    expect(MAX_WINDOW_MS_FREE % SAMPLE_INTERVAL_MS).toBe(0)
    expect(MAX_WINDOW_MS_PAID % SAMPLE_INTERVAL_MS).toBe(0)
  })
})

describe('resolveWindowMs', () => {
  it('parses hours and minutes', () => {
    expect(resolveWindowMs('24h', 'solo')).toBe(86_400_000)
    expect(resolveWindowMs('30m', 'solo')).toBe(1_800_000)
  })

  it('clamps a Free request to its entitlement rather than erroring', () => {
    // Serving the hour they are entitled to beats a 403 for asking. The response reports the
    // window actually served, so the axis can be labelled honestly.
    expect(resolveWindowMs('24h', 'free')).toBe(3_600_000)
  })

  it('defaults to the tier maximum when unspecified', () => {
    expect(resolveWindowMs(undefined, 'free')).toBe(3_600_000)
    expect(resolveWindowMs(undefined, 'solo')).toBe(86_400_000)
  })

  it('falls back to the maximum on unparseable input rather than 0', () => {
    // A 0-length window returns an empty series, which renders as an empty graph — visually
    // identical to "this workload has no data", for what is actually a malformed query string.
    expect(resolveWindowMs('bogus', 'solo')).toBe(86_400_000)
    expect(resolveWindowMs('0h', 'solo')).toBe(86_400_000)
    expect(resolveWindowMs('-5m', 'solo')).toBe(86_400_000)
  })
})

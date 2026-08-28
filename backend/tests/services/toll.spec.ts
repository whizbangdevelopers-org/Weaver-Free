// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Toll pure seam — unit tests.
 *
 * Every test here pins a DESIGN CHOICE, not just a behaviour, and states it inline. A test that
 * only asserts what the code does today is a transcription; one that names the choice fails
 * loudly when someone reverses it by accident.
 *
 * The four worth reading first, because each guards a choice that is easy to "simplify" back:
 *   - a LAPSED allocation keeps its seat — a lapse degrades entitlement, never access
 *   - an UNPARSEABLE expiry counts as expired (fail closed, not open)
 *   - seats are a PROJECTION of an append-only log, never a mutable flag
 *   - `null` seatsTotal is unlimited; `0` is none (two different licences, one easy conflation)
 */
import { describe, it, expect } from 'vitest'
import {
  activeAllocations,
  allocationRejectionReason,
  fcfsOrder,
  ineligibleReason,
  isExpired,
  lapsedAllocations,
  seatsFree,
  seatsUsed,
  selectToll,
  type TollAllocation,
  type TollRecord,
  type TollRequest,
} from '../../src/services/toll.js'

const NOW = new Date('2026-08-26T12:00:00.000Z')

function toll(over: Partial<TollRecord> & Pick<TollRecord, 'id'>): TollRecord {
  return {
    vendor: 'Microsoft',
    product: 'Windows 11 Pro',
    model: 'per-device',
    seatsTotal: 5,
    ...over,
  }
}

function alloc(over: Partial<TollAllocation> & Pick<TollAllocation, 'tollId'>): TollAllocation {
  return {
    workloadName: 'w1',
    allocatedAt: '2026-08-01T00:00:00.000Z',
    allocatedBy: 'admin',
    ...over,
  }
}

function req(over: Partial<TollRequest> = {}): TollRequest {
  return {
    product: 'Windows 11 Pro',
    workloadName: 'win-app',
    requestedBy: 'admin',
    stamp: { receivedAt: NOW.toISOString(), seq: 1n, allocatorId: 'a', requestId: 'r1' },
    ...over,
  }
}

describe('seat accounting is a projection of the append-only log', () => {
  it('counts only unreleased allocations', () => {
    const a = [
      alloc({ tollId: 't1', workloadName: 'w1' }),
      alloc({ tollId: 't1', workloadName: 'w2', releasedAt: '2026-08-10T00:00:00.000Z' }),
      alloc({ tollId: 't1', workloadName: 'w3' }),
      alloc({ tollId: 't2', workloadName: 'w4' }),
    ]
    expect(seatsUsed(a, 't1')).toBe(2)
    expect(activeAllocations(a, 't1').map((x) => x.workloadName)).toEqual(['w1', 'w3'])
  })

  it('a released allocation stays in the log — history is the compliance artifact', () => {
    const a = [alloc({ tollId: 't1', releasedAt: '2026-08-10T00:00:00.000Z' })]
    // The row is still there. An auditor asking "who held this in August" can answer.
    expect(a).toHaveLength(1)
    expect(seatsUsed(a, 't1')).toBe(0)
  })

  it('distinguishes unlimited (null) from none (0) — two different licences', () => {
    const site = toll({ id: 't1', seatsTotal: null })
    const none = toll({ id: 't2', seatsTotal: 0 })
    expect(seatsFree(site, [])).toBeNull()
    expect(seatsFree(none, [])).toBe(0)
    expect(ineligibleReason(site, [], req(), NOW)).toBeNull()
    expect(ineligibleReason(none, [], req(), NOW)).toMatch(/no seats free/)
  })

  it('never reports negative seats free', () => {
    const t = toll({ id: 't1', seatsTotal: 1 })
    const a = [alloc({ tollId: 't1', workloadName: 'w1' }), alloc({ tollId: 't1', workloadName: 'w2' })]
    expect(seatsFree(t, a)).toBe(0)
  })
})

describe('expiry fails CLOSED', () => {
  it('an expiry in the past is expired; in the future is not', () => {
    expect(isExpired(toll({ id: 't', expiresAt: '2026-08-25T00:00:00Z' }), NOW)).toBe(true)
    expect(isExpired(toll({ id: 't', expiresAt: '2026-09-01T00:00:00Z' }), NOW)).toBe(false)
  })

  it('no expiry set means perpetual, not expired', () => {
    expect(isExpired(toll({ id: 't' }), NOW)).toBe(false)
    expect(isExpired(toll({ id: 't', expiresAt: null }), NOW)).toBe(false)
  })

  it('an UNPARSEABLE expiry counts as EXPIRED — a typo must not extend an entitlement', () => {
    // The direction matters: treating garbage as valid would silently grant a licence forever,
    // which is the direction that costs money at an audit.
    expect(isExpired(toll({ id: 't', expiresAt: 'next tuesday' }), NOW)).toBe(true)
  })

  it('expiry exactly at now is expired', () => {
    expect(isExpired(toll({ id: 't', expiresAt: NOW.toISOString() }), NOW)).toBe(true)
  })
})

describe('a lapsed allocation warns — it never stops a workload or frees a seat', () => {
  it('is reported as lapsed', () => {
    const t = [toll({ id: 't1', expiresAt: '2026-08-01T00:00:00Z' })]
    const a = [alloc({ tollId: 't1', workloadName: 'prod-db' })]
    expect(lapsedAllocations(t, a, NOW).map((x) => x.workloadName)).toEqual(['prod-db'])
  })

  it('KEEPS its seat — the workload is still consuming the entitlement', () => {
    // Releasing the seat would under-report the exact number an auditor asks for, and is
    // the tempting "cleanup" that makes the register wrong in the reassuring direction.
    const t = toll({ id: 't1', seatsTotal: 2, expiresAt: '2026-08-01T00:00:00Z' })
    const a = [alloc({ tollId: 't1', workloadName: 'prod-db' })]
    expect(seatsUsed(a, 't1')).toBe(1)
    expect(seatsFree(t, a)).toBe(1)
  })

  it('a released allocation on an expired Toll is not lapsed — it is finished', () => {
    const t = [toll({ id: 't1', expiresAt: '2026-08-01T00:00:00Z' })]
    const a = [alloc({ tollId: 't1', releasedAt: '2026-07-01T00:00:00Z' })]
    expect(lapsedAllocations(t, a, NOW)).toEqual([])
  })
})

describe('eligibility', () => {
  it('rejects a product mismatch, a hold, an expiry and a full Toll — each with its own reason', () => {
    expect(ineligibleReason(toll({ id: 't', product: 'RHEL 9' }), [], req(), NOW))
      .toMatch(/product mismatch/)
    expect(ineligibleReason(toll({ id: 't', held: true }), [], req(), NOW))
      .toMatch(/administratively held/)
    expect(ineligibleReason(toll({ id: 't', expiresAt: '2026-01-01T00:00:00Z' }), [], req(), NOW))
      .toMatch(/expired/)
    const full = toll({ id: 't', seatsTotal: 1 })
    expect(ineligibleReason(full, [alloc({ tollId: 't' })], req(), NOW)).toMatch(/no seats free/)
  })

  it('accepts a matching, unheld, unexpired Toll with a seat', () => {
    expect(ineligibleReason(toll({ id: 't' }), [], req(), NOW)).toBeNull()
  })
})

describe('selection prefers the SOONEST expiry', () => {
  it('takes the one expiring first, so value is not lost to waiting', () => {
    const tolls = [
      toll({ id: 'later', expiresAt: '2027-01-01T00:00:00Z' }),
      toll({ id: 'sooner', expiresAt: '2026-09-01T00:00:00Z' }),
    ]
    expect(selectToll(tolls, [], req(), NOW)?.id).toBe('sooner')
  })

  it('sorts a perpetual Toll LAST — it cannot be wasted by waiting', () => {
    const tolls = [toll({ id: 'perpetual' }), toll({ id: 'dated', expiresAt: '2026-12-01T00:00:00Z' })]
    expect(selectToll(tolls, [], req(), NOW)?.id).toBe('dated')
  })

  it('breaks a true tie deterministically, so a replay yields the same result', () => {
    const tolls = [
      toll({ id: 'b', expiresAt: '2026-12-01T00:00:00Z' }),
      toll({ id: 'a', expiresAt: '2026-12-01T00:00:00Z' }),
    ]
    expect(selectToll(tolls, [], req(), NOW)?.id).toBe('a')
    expect(selectToll([...tolls].reverse(), [], req(), NOW)?.id).toBe('a')
  })

  it('skips a sooner-expiring Toll that has no seats and takes the next', () => {
    const tolls = [
      toll({ id: 'full', seatsTotal: 1, expiresAt: '2026-09-01T00:00:00Z' }),
      toll({ id: 'open', seatsTotal: 1, expiresAt: '2027-01-01T00:00:00Z' }),
    ]
    expect(selectToll(tolls, [alloc({ tollId: 'full' })], req(), NOW)?.id).toBe('open')
  })

  it('returns null when nothing is eligible', () => {
    expect(selectToll([toll({ id: 't', held: true })], [], req(), NOW)).toBeNull()
  })
})

describe('FCFS ordering', () => {
  it('orders by seq — the monotonic stamp, not the wall clock', () => {
    const rs = [
      req({ stamp: { receivedAt: 'x', seq: 30n, allocatorId: 'a', requestId: 'r3' } }),
      req({ stamp: { receivedAt: 'x', seq: 10n, allocatorId: 'a', requestId: 'r1' } }),
      req({ stamp: { receivedAt: 'x', seq: 20n, allocatorId: 'a', requestId: 'r2' } }),
    ]
    expect(fcfsOrder(rs).map((r) => r.stamp.requestId)).toEqual(['r1', 'r2', 'r3'])
  })

  it('handles bigints a Number() cast would COLLAPSE — hrtime values are large', () => {
    // The pair matters. 2^53 and 2^53+1 are the smallest two integers Number() cannot tell
    // apart: both round to 9007199254740992, so a `Number(a) - Number(b)` comparator returns 0
    // and silently keeps input order. An earlier version of this test used 2^53+1 and 2^53+2,
    // which DO survive the cast — so it passed against a deliberately broken comparator and was
    // not a guard at all. Found by negative-testing, not by reading.
    const collapsing = 2n ** 53n
    const rs = [
      req({ stamp: { receivedAt: 'x', seq: collapsing + 1n, allocatorId: 'a', requestId: 'second' } }),
      req({ stamp: { receivedAt: 'x', seq: collapsing, allocatorId: 'a', requestId: 'first' } }),
    ]
    expect(Number(collapsing)).toBe(Number(collapsing + 1n)) // the premise, asserted
    expect(fcfsOrder(rs).map((r) => r.stamp.requestId)).toEqual(['first', 'second'])
  })

  it('total-orders a tie by allocatorId then requestId', () => {
    const rs = [
      req({ stamp: { receivedAt: 'x', seq: 1n, allocatorId: 'b', requestId: 'r1' } }),
      req({ stamp: { receivedAt: 'x', seq: 1n, allocatorId: 'a', requestId: 'r2' } }),
      req({ stamp: { receivedAt: 'x', seq: 1n, allocatorId: 'a', requestId: 'r1' } }),
    ]
    expect(fcfsOrder(rs).map((r) => `${r.stamp.allocatorId}/${r.stamp.requestId}`))
      .toEqual(['a/r1', 'a/r2', 'b/r1'])
  })

  it('does not mutate its input', () => {
    const rs = [
      req({ stamp: { receivedAt: 'x', seq: 2n, allocatorId: 'a', requestId: 'r2' } }),
      req({ stamp: { receivedAt: 'x', seq: 1n, allocatorId: 'a', requestId: 'r1' } }),
    ]
    fcfsOrder(rs)
    expect(rs.map((r) => r.stamp.requestId)).toEqual(['r2', 'r1'])
  })
})

describe('the guard fails CLOSED', () => {
  it('refuses when no Toll is recorded for the product at all', () => {
    const why = allocationRejectionReason([], [], req(), NOW)
    expect(why).toMatch(/No Toll recorded for 'Windows 11 Pro'/)
  })

  it('refuses when every candidate is ineligible, and names WHY per Toll', () => {
    // "no seat available" alone leaves the operator unable to tell an expiry from a shortfall
    // from a hold — three different purchases.
    const tolls = [
      toll({ id: 'expired-one', expiresAt: '2026-01-01T00:00:00Z' }),
      toll({ id: 'full-one', seatsTotal: 1 }),
    ]
    const why = allocationRejectionReason(tolls, [alloc({ tollId: 'full-one' })], req(), NOW)
    expect(why).toMatch(/expired-one: expired/)
    expect(why).toMatch(/full-one: no seats free/)
    expect(why).toMatch(/win-app/)
  })

  it('permits when a seat is available', () => {
    expect(allocationRejectionReason([toll({ id: 't' })], [], req(), NOW)).toBeNull()
  })

  it('a full Toll and an open one for the same product permits — it is not all-or-nothing', () => {
    const tolls = [toll({ id: 'full', seatsTotal: 1 }), toll({ id: 'open', seatsTotal: 1 })]
    expect(allocationRejectionReason(tolls, [alloc({ tollId: 'full' })], req(), NOW)).toBeNull()
  })
})

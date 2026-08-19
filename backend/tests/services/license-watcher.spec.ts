// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// Runtime licence resolution.
//
// Every behaviour here is one the START-UP-only design could not have: the same key resolving to
// a different tier because time passed, a pushed key taking effect without a restart, a warning
// that does not repeat across a reboot. They are testable at all only because `parseLicenseKey`
// takes an injectable `now` — before that, the grace path could be reached only by moving the
// system clock, which is why it had no tests.
import { describe, it, expect } from 'vitest'
import { createVerifier } from '../../src/entitlement/verify/verifier.js'
import { WEAVER_PROFILE } from '../../src/license-profile.js'
import {
  resolveLicense, snapshotChanged, daysUntil, decideWarning, sentFor,
  EXPIRY_WARNING_DAYS, FREE_SNAPSHOT, EMPTY_WARNING_STATE,
} from '../../src/services/license-watcher.js'
import { generateKeyPairSync } from 'node:crypto'
import { generateLicenseKey } from '../../src/license.js'
import { TIERS } from '../../src/constants/vocabularies.js'

/**
 * An ephemeral licence authority for this file.
 *
 * The shared `SECRET` is gone: it was one symmetric value used to BOTH mint and validate, which is
 * the defect these keys used to be minted with. `ACCEPTED` is passed explicitly because the
 * shipped `ACCEPTED_PUBLIC_KEYS` is empty until the production key ships — the behaviours under
 * test here (grace transitions, renewal without restart, warning idempotence) are about the
 * watcher, not about which authority signed, and they must stay testable meanwhile.
 */
const AUTHORITY = generateKeyPairSync('ed25519')
const ACCEPTED = [(AUTHORITY.publicKey.export({ format: 'jwk' }) as { x: string }).x]

/**
 * A verifier bound to the test authority.
 *
 * resolveLicense takes a VERIFIER rather than raw keys: injecting a bound collaborator is
 * ordinary DI, while injecting the key set would be handing production code its trust
 * material at runtime — the seam audit:authority-binding refuses.
 */
const TEST_VERIFIER = createVerifier(WEAVER_PROFILE, ACCEPTED)
const DAY = 86_400_000

function at(iso: string): Date {
  return new Date(iso)
}

describe('resolveLicense — what a re-read is allowed to conclude', () => {
  it('resolves a valid key to its tier', () => {
    const key = generateLicenseKey(TIERS.SOLO, AUTHORITY.privateKey, { expiry: at('2027-01-01T00:00:00Z') })
    const outcome = resolveLicense({ content: key }, at('2026-08-16T00:00:00Z'), TEST_VERIFIER)

    expect(outcome.kind).toBe('resolved')
    if (outcome.kind !== 'resolved') return
    expect(outcome.snapshot.tier).toBe(TIERS.SOLO)
    expect(outcome.snapshot.graceMode).toBe(false)
  })

  it('tolerates surrounding whitespace — the install path writes with a trailing newline', () => {
    const key = generateLicenseKey(TIERS.TEAM, AUTHORITY.privateKey, { expiry: at('2027-01-01T00:00:00Z') })
    const outcome = resolveLicense({ content: `  ${key}\n` }, at('2026-08-16T00:00:00Z'), TEST_VERIFIER)

    expect(outcome.kind).toBe('resolved')
    if (outcome.kind !== 'resolved') return
    expect(outcome.snapshot.tier).toBe(TIERS.TEAM)
  })

  // The reason the watcher exists at all: the SAME key, unchanged on disk, resolves differently
  // as time passes. A start-up-only read can never observe either of these transitions.
  describe('the same key, later', () => {
    const key = generateLicenseKey(TIERS.SOLO, AUTHORITY.privateKey, { expiry: at('2026-08-16T00:00:00Z') })

    it('keeps the tier and flags grace inside the 30-day window', () => {
      const outcome = resolveLicense({ content: key }, new Date(at('2026-08-16T00:00:00Z').getTime() + 10 * DAY), TEST_VERIFIER)

      expect(outcome.kind).toBe('resolved')
      if (outcome.kind !== 'resolved') return
      expect(outcome.snapshot.tier).toBe(TIERS.SOLO)
      expect(outcome.snapshot.graceMode).toBe(true)
    })

    it('falls to Free once grace has elapsed', () => {
      const outcome = resolveLicense({ content: key }, new Date(at('2026-08-16T00:00:00Z').getTime() + 31 * DAY), TEST_VERIFIER)

      expect(outcome.kind).toBe('resolved')
      if (outcome.kind !== 'resolved') return
      expect(outcome.snapshot.tier).toBe(TIERS.FREE)
      expect(outcome.snapshot.graceMode).toBe(false)
    })
  })

  it('treats an absent file as Free — removing the key IS the revoke path', () => {
    expect(resolveLicense({ content: null }, undefined, TEST_VERIFIER).kind).toBe('absent')
  })

  // The asymmetry that matters. A push writes the key file, and a poll can land inside that
  // write; concluding "Free" from a half-written file would drop a paying customer's tier on a
  // race with their own renewal. Present-but-unusable is authoritative about nothing.
  describe('present but unusable never downgrades', () => {
    it('an invalid key is unreadable, not Free', () => {
      const outcome = resolveLicense({ content: 'WVR-WVS-NOTAREALKEY1-ZZZZ' }, undefined, TEST_VERIFIER)
      expect(outcome.kind).toBe('unreadable')
    })

    it('a partially-written key is unreadable, not Free', () => {
      const key = generateLicenseKey(TIERS.SOLO, AUTHORITY.privateKey, { expiry: at('2027-01-01T00:00:00Z') })
      const outcome = resolveLicense({ content: key.slice(0, 10) }, undefined, TEST_VERIFIER)
      expect(outcome.kind).toBe('unreadable')
    })

    it('an empty file is unreadable, not Free', () => {
      expect(resolveLicense({ content: '   \n' }, undefined, TEST_VERIFIER).kind).toBe('unreadable')
    })

    it('an I/O error is unreadable, not Free', () => {
      expect(resolveLicense({ content: null, error: 'EACCES' }, undefined, TEST_VERIFIER).kind).toBe('unreadable')
    })

    // Replaces 'refuses to validate when no HMAC secret is configured'. That test asserted a guard
    // whose NECESSITY was the defect: whether a key could be forged turned on a value the operator
    // supplied, so the watcher had to check the operator had supplied one. There is no such value
    // now. The residual question is what happens with nothing to verify AGAINST, and the answer
    // must be "reject", never "accept".
    it('an unverifiable key is unreadable, not a resolved tier — empty accepted set', () => {
      const key = generateLicenseKey(TIERS.SOLO, AUTHORITY.privateKey, { expiry: at('2027-01-01T00:00:00Z') })
      // A verifier that trusts NOTHING — the shipped pre-ceremony state. This used to pass a bare
      // `[]`, left behind when resolveLicense moved from raw accepted-keys to an injected verifier;
      // it typechecked as `never[]` only because nothing typechecked this file.
      const outcome = resolveLicense({ content: key }, at('2026-08-16T00:00:00Z'), createVerifier(WEAVER_PROFILE, []))

      expect(outcome.kind).toBe('unreadable')
    })

    it('a key from an unrecognised authority is unreadable, not a resolved tier', () => {
      const other = generateKeyPairSync('ed25519')
      const key = generateLicenseKey(TIERS.FABRICK, other.privateKey, { expiry: at('2027-01-01T00:00:00Z') })
      const outcome = resolveLicense({ content: key }, at('2026-08-16T00:00:00Z'), TEST_VERIFIER)

      // 'unreadable' holds the CURRENT tier rather than downgrading, which is right for a
      // mid-write race — and it also means a forged key cannot force a downgrade. It cannot force
      // an upgrade either, which is the property that matters here.
      expect(outcome.kind).toBe('unreadable')
    })
  })

  it('a renewal key replaces the old one without a restart', () => {
    const now = at('2026-08-16T00:00:00Z')
    const oldKey = generateLicenseKey(TIERS.SOLO, AUTHORITY.privateKey, { expiry: at('2026-09-01T00:00:00Z') })
    const newKey = generateLicenseKey(TIERS.SOLO, AUTHORITY.privateKey, { expiry: at('2027-09-01T00:00:00Z') })

    const before = resolveLicense({ content: oldKey }, now, TEST_VERIFIER)
    const after = resolveLicense({ content: newKey }, now, TEST_VERIFIER)
    if (before.kind !== 'resolved' || after.kind !== 'resolved') throw new Error('expected both to resolve')

    expect(snapshotChanged(before.snapshot, after.snapshot)).toBe(true)
    expect(after.snapshot.expiry?.getUTCFullYear()).toBe(2027)
  })
})

describe('snapshotChanged', () => {
  const base = { tier: TIERS.SOLO, expiry: at('2027-01-01T00:00:00Z'), graceMode: false }

  it('is false for an identical snapshot — a quiet poll must not emit anything', () => {
    expect(snapshotChanged(base, { ...base, expiry: at('2027-01-01T00:00:00Z') })).toBe(false)
  })

  it('notices a tier change', () => {
    expect(snapshotChanged(base, { ...base, tier: TIERS.FREE })).toBe(true)
  })

  // Grace alone is a real transition: same tier, same expiry, but the customer is now past due
  // and the admin needs to know before the tier goes.
  it('notices entering grace even when the tier has not moved', () => {
    expect(snapshotChanged(base, { ...base, graceMode: true })).toBe(true)
  })

  it('notices a new expiry — this is what a renewal looks like', () => {
    expect(snapshotChanged(base, { ...base, expiry: at('2028-01-01T00:00:00Z') })).toBe(true)
  })

  it('handles a null expiry on either side', () => {
    expect(snapshotChanged(base, { ...base, expiry: null })).toBe(true)
    expect(snapshotChanged(FREE_SNAPSHOT, FREE_SNAPSHOT)).toBe(false)
  })
})

describe('daysUntil', () => {
  it('rounds up — a partial day left is still that day', () => {
    const now = at('2026-08-16T18:00:00Z')
    expect(daysUntil(at('2026-08-17T06:00:00Z'), now)).toBe(1)
  })

  it('is exact on a whole day', () => {
    expect(daysUntil(at('2026-08-23T00:00:00Z'), at('2026-08-16T00:00:00Z'))).toBe(7)
  })

  it('goes negative past expiry', () => {
    expect(daysUntil(at('2026-08-10T00:00:00Z'), at('2026-08-16T00:00:00Z'))).toBe(-6)
  })
})

describe('decideWarning — 30, 20, 10, 7, 5, 3, 2, 1', () => {
  it('says nothing before the first threshold', () => {
    expect(decideWarning(45, []).send).toBeNull()
  })

  it('announces each threshold exactly once as it is crossed', () => {
    let sent: number[] = []
    const announced: number[] = []

    // Walk the countdown one day at a time, as a daily check would.
    for (let day = 40; day >= 1; day--) {
      const decision = decideWarning(day, sent)
      if (decision.send !== null) announced.push(decision.send)
      sent = decision.sent
    }

    expect(announced).toEqual([...EXPIRY_WARNING_DAYS])
  })

  it('does not repeat a threshold on a second check the same day', () => {
    const first = decideWarning(10, [30, 20])
    expect(first.send).toBe(10)
    expect(decideWarning(10, first.sent).send).toBeNull()
  })

  // After downtime several thresholds are due at once. Firing all of them buries the only one
  // that is still true, so the tightest is announced and the looser ones are marked silently.
  it('collapses a missed run to the tightest threshold', () => {
    const decision = decideWarning(6, [])

    expect(decision.send).toBe(7)
    expect(decision.sent).toEqual([30, 20, 10, 7])
  })

  it('past expiry, every threshold is spent and nothing repeats', () => {
    const first = decideWarning(-3, [])
    expect(first.send).toBe(1)
    expect(decideWarning(-4, first.sent).send).toBeNull()
  })

  it('never un-marks a threshold it was told about', () => {
    expect(decideWarning(45, [30, 20]).sent).toEqual([30, 20])
  })
})

describe('sentFor — warnings are keyed to the expiry they describe', () => {
  const expiry = at('2026-09-01T00:00:00Z')

  it('remembers thresholds for the same expiry across a restart', () => {
    const state = { expiry: expiry.toISOString(), sent: [30, 20] }
    expect(sentFor(state, expiry)).toEqual([30, 20])
  })

  // A renewal moves the expiry, so every threshold recorded against the old one describes a
  // deadline that no longer exists. Re-arming is the point: next year's countdown must run.
  it('re-arms when a renewal moves the expiry', () => {
    const state = { expiry: expiry.toISOString(), sent: [30, 20, 10, 7, 5, 3, 2, 1] }
    expect(sentFor(state, at('2027-09-01T00:00:00Z'))).toEqual([])
  })

  it('re-arms on a rollback to a previous key', () => {
    const state = { expiry: at('2027-09-01T00:00:00Z').toISOString(), sent: [30] }
    expect(sentFor(state, expiry)).toEqual([])
  })

  it('starts empty', () => {
    expect(sentFor(EMPTY_WARNING_STATE, expiry)).toEqual([])
  })

  it('treats a perpetual licence as having no countdown', () => {
    expect(sentFor({ expiry: null, sent: [] }, null)).toEqual([])
  })
})

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// The per-node licence term, which was signed into every key and read by nothing.
//
// These tests pin the DECISION as much as the code: a node is counted at ENROLMENT, the local host
// always counts as one and is never refused, `null` means unbounded, and an absent entitlement
// floors at 1 rather than opening up. Each of those is a choice that could reasonably have gone the
// other way, so each gets a case that fails if someone changes it without meaning to.

import { describe, it, expect } from 'vitest'
import { requireNodeCapacity, assertLicensedNodeCapacity } from '../src/license.js'
import { TIERS, type TierName } from '../src/constants/vocabularies.js'

// Team, not Fabrick: multi-node starts at Weaver Team (v2.2 peer federation), which is where the
// node count first binds. The guard itself is tier-agnostic by design — it reads the signed
// entitlement, not the tier — and the case below pins that.
const cfg = (licenseNodes: number | null, tier: TierName = TIERS.TEAM) => ({ tier, licenseNodes })

describe('requireNodeCapacity', () => {
  it('admits enrolment below the licensed count', () => {
    expect(() => requireNodeCapacity(cfg(3), 0)).not.toThrow()
    expect(() => requireNodeCapacity(cfg(3), 1)).not.toThrow()
    expect(() => requireNodeCapacity(cfg(3), 2)).not.toThrow()
  })

  it('refuses the enrolment that would exceed it', () => {
    // Three enrolled against a three-node licence: the NEXT one is the fourth.
    expect(() => requireNodeCapacity(cfg(3), 3)).toThrow(/covers 3 nodes/)
  })

  it('refuses with a 403-shaped error, like requireTier', () => {
    try {
      requireNodeCapacity(cfg(1), 1)
      throw new Error('should have thrown')
    } catch (err) {
      expect((err as { statusCode?: number }).statusCode).toBe(403)
    }
  })

  it('says how many are licensed and how many are enrolled', () => {
    // The operator has to be able to act on this without reading the source.
    expect(() => requireNodeCapacity(cfg(2), 2)).toThrow(/covers 2 nodes and 2 are already enrolled/)
    expect(() => requireNodeCapacity(cfg(1), 1)).toThrow(/covers 1 node and 1 is already enrolled/)
  })

  it('treats null as unbounded', () => {
    // A perpetual or unmetered grant. Distinct from a MISSING value, which config floors at 1 —
    // a forgotten entitlement must under-grant, never become a free fleet.
    expect(() => requireNodeCapacity(cfg(null), 0)).not.toThrow()
    expect(() => requireNodeCapacity(cfg(null), 10_000)).not.toThrow()
  })

  it('refuses everything at zero, rather than reading it as unlimited', () => {
    // The dangerous misreading: 0 is falsy, and a truthiness check would treat it as "no limit".
    expect(() => requireNodeCapacity(cfg(0), 0)).toThrow()
  })

  it('decides on the signed entitlement, not the tier', () => {
    // The entitlement is what was PURCHASED; the tier is what was purchased INTO. Reading the tier
    // here would reintroduce the defect this file exists for — a limit the signature does not bind.
    for (const tier of [TIERS.SOLO, TIERS.TEAM, TIERS.FABRICK]) {
      expect(() => requireNodeCapacity(cfg(2, tier), 1)).not.toThrow()
      expect(() => requireNodeCapacity(cfg(2, tier), 2)).toThrow()
    }
  })
})

describe('assertLicensedNodeCapacity — start-up', () => {
  it('accepts a sane entitlement silently', () => {
    expect(() => assertLicensedNodeCapacity(cfg(1))).not.toThrow()
    expect(() => assertLicensedNodeCapacity(cfg(50))).not.toThrow()
    expect(() => assertLicensedNodeCapacity(cfg(null))).not.toThrow()
  })

  it('warns but does not throw on a nonsensical entitlement', () => {
    // Deliberately not fatal. Refusing to boot would take a host that is serving workloads offline
    // over a licensing concern — a worse failure than the one being reported, and the same
    // reasoning as the non-release-authority warning in license.ts.
    expect(() => assertLicensedNodeCapacity(cfg(0))).not.toThrow()
  })
})

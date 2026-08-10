// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Network-ownership phase A — the ownership predicate.
 *
 * The predicate is deliberately the ONLY place the comparison happens, so these tests are the
 * specification of what "divergent" means for both the UI today and phase B's enforcement path
 * later. If the two ever disagree, it will be because someone added a second comparison rather
 * than because this changed.
 */
import { describe, it, expect } from 'vitest'
import { isWeaverOwnedNetwork, isDivergentNetwork } from '../../src/services/network-ownership.js'

const WEAVER_BRIDGE = 'br-microvm'

describe('isWeaverOwnedNetwork', () => {
  it('is true on an exact match', () => {
    expect(isWeaverOwnedNetwork('br-microvm', WEAVER_BRIDGE)).toBe(true)
  })

  it('is false for any other named network', () => {
    // 'bridge' is docker0 — the actual value in this repo's captured docker ps fixture.
    for (const other of ['bridge', 'host', 'none', 'frontend', 'br-microvm2', 'BR-MICROVM']) {
      expect(isWeaverOwnedNetwork(other, WEAVER_BRIDGE), other).toBe(false)
    }
  })

  // THE LOAD-BEARING CASE. Unknown is not violating.
  //
  // Apptainer instances have no network namespace of their own, so scanContainers records
  // `bridge: undefined` rather than inventing a value. Treating absence as divergence would flag
  // every Apptainer instance on every install as violating an invariant it cannot express, and a
  // warning that fires on an entire runtime is one operators learn to ignore.
  //
  // Whether "no network" is a violation or a trivial conformance is an open PRODUCT question
  // (plan §5.2). Phase A declines to assert either; this test pins that decline so a later change
  // has to be deliberate rather than incidental.
  it('treats undefined as NOT divergent — unknown is not a violation', () => {
    expect(isWeaverOwnedNetwork(undefined, WEAVER_BRIDGE)).toBe(true)
  })

  it('treats an empty string as NOT divergent, same as undefined', () => {
    // Defence in depth: the parser already filters '' out, so this should be unreachable. If a
    // future caller loses that filtering, '' must not be compared as a real network name.
    expect(isWeaverOwnedNetwork('', WEAVER_BRIDGE)).toBe(true)
  })

  it('does not treat a differently-configured bridge as special', () => {
    // The configured value is whatever the operator set; nothing here may assume 'br-microvm'.
    expect(isWeaverOwnedNetwork('br-custom', 'br-custom')).toBe(true)
    expect(isWeaverOwnedNetwork('br-microvm', 'br-custom')).toBe(false)
  })
})

describe('isDivergentNetwork', () => {
  // The inverse exists so no call site writes `!isWeaverOwnedNetwork(...)`, which is where an
  // accidental double negative lands. These assert the two can never drift apart.
  it('is the exact inverse of isWeaverOwnedNetwork', () => {
    const cases: [string | undefined, string][] = [
      ['br-microvm', WEAVER_BRIDGE],
      ['bridge', WEAVER_BRIDGE],
      [undefined, WEAVER_BRIDGE],
      ['', WEAVER_BRIDGE],
      ['br-custom', 'br-custom'],
    ]
    for (const [bridge, configured] of cases) {
      expect(isDivergentNetwork(bridge, configured), `${bridge} vs ${configured}`)
        .toBe(!isWeaverOwnedNetwork(bridge, configured))
    }
  })

  it('flags the docker0 default that phase A exists to surface', () => {
    expect(isDivergentNetwork('bridge', WEAVER_BRIDGE)).toBe(true)
  })
})

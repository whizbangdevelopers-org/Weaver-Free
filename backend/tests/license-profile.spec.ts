// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * Weaver's half of the entitlement system.
 *
 * The key MECHANISM is vendored from `wbd-entitlement` and tested there. What is untested by that
 * suite — and can only be tested here — is whether Weaver wired it up correctly: its tier codes,
 * its lapse target, its authority manifest, and the single binding site.
 *
 * That distinction is the point of the split. A shared library's tests prove the mechanism works;
 * they cannot prove a given product used it right.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateKeyPairSync } from 'node:crypto'

import { WEAVER_PROFILE } from '../src/license-profile.js'
import { createVerifier } from '../src/entitlement/verify/verifier.js'
import { createIssuer } from '../src/entitlement/issue/issuer.js'
import { parseManifest, resolveChannel } from '../src/entitlement/format/authority.js'
import { resolveOrEmpty } from '../../scripts/generate-license-authority.js'
import { ACCEPTED_PUBLIC_KEYS, CHANNEL, IS_RELEASE } from '../src/generated/license-authority.js'
import { TIERS, TIER_ORDER } from '../src/constants/vocabularies.js'
import { generateLicenseKey, parseLicenseKey, requireTier, acceptedKeyCount } from '../src/license.js'

const MANIFEST = new URL('../src/license-authority.json', import.meta.url).pathname

function keypair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  return { privateKey, pub: (publicKey.export({ format: 'jwk' }) as { x: string }).x }
}

describe('WEAVER_PROFILE', () => {
  it('uses the WVR prefix', () => {
    expect(WEAVER_PROFILE.prefix).toBe('WVR')
  })

  it('maps every sellable tier to a code, and demo to none', () => {
    expect(WEAVER_PROFILE.codeForTier[TIERS.FREE]).toBe('FRE')
    expect(WEAVER_PROFILE.codeForTier[TIERS.SOLO]).toBe('WVS')
    expect(WEAVER_PROFILE.codeForTier[TIERS.TEAM]).toBe('WVT')
    expect(WEAVER_PROFILE.codeForTier[TIERS.FABRICK]).toBe('FAB')
    // demo is a product state, not something anyone buys. A code for it would be a tier someone
    // could mint.
    expect(WEAVER_PROFILE.codeForTier[TIERS.DEMO]).toBeUndefined()
  })

  it('refuses to mint the demo tier rather than emitting a broken key', () => {
    const { privateKey } = keypair()
    expect(() => createIssuer(WEAVER_PROFILE, privateKey).generateLicenseKey(TIERS.DEMO)).toThrow(
      /no code in codeForTier/,
    )
  })

  it('still PARSES the retired PRE and ENT codes', () => {
    // The tier names these codes stood for are retired. Keys already in customers' hands were
    // signed with them and must keep resolving — retiring a NAME must never strand a licence
    // somebody paid for. (The names themselves are not repeated here; audit:vocabulary refuses
    // them in-tree and that decision is the authoritative record.)
    expect(WEAVER_PROFILE.tierForCode.PRE).toBe(TIERS.SOLO)
    expect(WEAVER_PROFILE.tierForCode.ENT).toBe(TIERS.FABRICK)
  })

  it('never MINTS a retired code', () => {
    const minted = Object.values(WEAVER_PROFILE.codeForTier)
    expect(minted).not.toContain('PRE')
    expect(minted).not.toContain('ENT')
  })

  it('lapses to Free, not demo — a lapsed customer keeps their own workloads', () => {
    expect(WEAVER_PROFILE.lapsedTier).toBe(TIERS.FREE)
  })

  it('round-trips every mintable tier through a real key', () => {
    const { privateKey, pub } = keypair()
    const issuer = createIssuer(WEAVER_PROFILE, privateKey)
    const verifier = createVerifier(WEAVER_PROFILE, [pub])

    for (const tier of [TIERS.FREE, TIERS.SOLO, TIERS.TEAM, TIERS.FABRICK] as const) {
      const key = issuer.generateLicenseKey(tier, { expiry: new Date('2099-01-01'), quantity: 2 })
      const parsed = verifier.parseLicenseKey(key)
      expect(parsed.tier, `tier ${tier}`).toBe(tier)
      expect(parsed.quantity).toBe(2)
    }
  })
})

describe('the generated authority module', () => {
  it('is a faithful projection of the manifest', () => {
    // Pattern 1 (source → generator → committed artifact → freshness check). The committed file is
    // what a Weaver-Free clone typechecks against, so it cannot be gitignored the way upstream's is.
    const manifest = parseManifest(JSON.parse(readFileSync(MANIFEST, 'utf-8')))
    const expected = Object.keys(manifest.keys).length === 0 ? [] : resolveChannel(manifest, CHANNEL)
    expect([...ACCEPTED_PUBLIC_KEYS]).toEqual(expected)
  })

  it('is built for a release channel', () => {
    expect(CHANNEL).toBe('release')
    expect(IS_RELEASE).toBe(true)
  })

  it('contains no test-kind key', () => {
    // resolveChannel enforces this at generation time; asserting it on the ARTIFACT closes the gap
    // where someone hand-edits the generated file. A test authority in a release build is a signing
    // oracle handed to anyone who has cloned the harness.
    const manifest = parseManifest(JSON.parse(readFileSync(MANIFEST, 'utf-8')))
    const testKeys = Object.values(manifest.keys)
      .filter((k) => k.kind === 'test')
      .map((k) => k.publicKey)
    for (const k of testKeys) expect(ACCEPTED_PUBLIC_KEYS).not.toContain(k)
  })
})

describe('pre-ceremony state — fail closed', () => {
  /**
   * Phase-scoped, and it names its own expiry deliberately.
   *
   * While the trust set is empty NO key verifies, so the assertions below would also pass against a
   * build with no signature check at all. That is correct for now and must not become permanent.
   * This fails the moment the production public key ships — which is exactly when the positive-path
   * tests become possible and must be written.
   */
  it('GUARD: trust set is empty until the ceremony has run', () => {
    expect(ACCEPTED_PUBLIC_KEYS).toHaveLength(0)
    expect(acceptedKeyCount).toBe(0)
  })

  it('a real, correctly-minted key still resolves to nothing', () => {
    // The realistic attack: an operator with the source mints a syntactically perfect key. Only the
    // signature separates it from a real one, and the accepted set is what decides.
    const { privateKey } = keypair()
    const key = generateLicenseKey(TIERS.FABRICK, privateKey, { expiry: new Date('2099-01-01') })
    expect(key).toMatch(/^WVR-FAB-/)
    expect(() => parseLicenseKey(key)).toThrow('signature verification failed')
  })
})

describe('requireTier stays product policy', () => {
  it('allows an equal or higher tier', () => {
    expect(() => requireTier({ tier: TIERS.FABRICK }, TIERS.SOLO)).not.toThrow()
    expect(() => requireTier({ tier: TIERS.SOLO }, TIERS.SOLO)).not.toThrow()
  })

  it('rejects a lower tier with a 403', () => {
    try {
      requireTier({ tier: TIERS.FREE }, TIERS.FABRICK)
      expect.unreachable('should have thrown')
    } catch (err) {
      expect((err as { statusCode?: number }).statusCode).toBe(403)
    }
  })

  it('orders tiers the way the matrix does', () => {
    expect(TIER_ORDER[TIERS.FREE]).toBeLessThan(TIER_ORDER[TIERS.SOLO])
    expect(TIER_ORDER[TIERS.SOLO]).toBeLessThan(TIER_ORDER[TIERS.TEAM])
    expect(TIER_ORDER[TIERS.TEAM]).toBeLessThan(TIER_ORDER[TIERS.FABRICK])
  })
})

/**
 * The generator's channel handling.
 *
 * `resolveOrEmpty` tolerates ONE condition — a channel that is declared and empty, which is the
 * deliberate pre-ceremony state. It used to also swallow `unknown channel`, so a mistyped
 * `--channel` wrote a module stamped with the misspelling, trusting nothing, at exit 0.
 *
 * Live rather than hypothetical: `allowEmpty` is switched on automatically while the manifest
 * holds no keys, so that typo is a silent success today and stops being one only after the
 * ceremony — meaning nobody would ever discover it by hitting it.
 */
describe('generate-license-authority — channel resolution', () => {
  it('throws on an unknown channel even when empty channels are tolerated', () => {
    expect(() => resolveOrEmpty('realese', true)).toThrow(/unknown channel/)
  })

  it('still tolerates a declared-but-empty channel — the pre-ceremony state', () => {
    // The IGNORE half. If this threw, the repo could not generate its own committed artifact.
    expect(resolveOrEmpty('release', true)).toEqual([])
  })

  it('refuses an empty channel when empties are not allowed', () => {
    expect(() => resolveOrEmpty('release', false)).toThrow(/resolves to no keys/)
  })
})

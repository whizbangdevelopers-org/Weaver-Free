// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// Issuance round-trip: the key the ISSUER mints is a key the PRODUCT accepts.
//
// This file exists because nothing asserted that, and the gap had the shape a green suite hides
// best. `stripe-webhook.spec.ts` mocks `generateLicenseFromSubscription` wholesale, so every
// webhook test passes against a fake key string: they prove the store is written, the audit line
// is logged and the email is sent, and not one of them could tell a real minted key from the
// literal 'WVR-TEST-KEY'. A no-op issuer passes all of them.
//
// The seam is issuer → verifier, and a check that only observes one side of a seam is not a
// control. So here the Stripe SDK is the ONLY thing stubbed — the key is minted by the real
// `generateLicenseFromSubscription` → `generateLicenseKey` path, the exact code a live checkout
// runs, and verified by the real `parseLicenseKey`. Nothing in between is faked.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createVerifier } from '../../src/entitlement/verify/verifier.js'
import { WEAVER_PROFILE } from '../../src/license-profile.js'
import { generateKeyPairSync } from 'node:crypto'

const { mockRetrieve } = vi.hoisted(() => ({ mockRetrieve: vi.fn() }))

// Stub the Stripe SDK itself, not our code around it. `generateLicenseFromSubscription` calls
// `getStripe().subscriptions.retrieve(...)`; everything it does with the ANSWER stays real.
vi.mock('stripe', () => ({
  default: class {
    subscriptions = { retrieve: mockRetrieve }
  },
}))

import {
  initStripe,
  initProductMap,
  generateLicenseFromSubscription,
} from '../../src/services/stripe.js'
import { parseLicenseKey } from '../../src/license.js'
import { TIERS } from '../../src/constants/vocabularies.js'

const AUTHORITY = generateKeyPairSync('ed25519')
const ACCEPTED = [(AUTHORITY.publicKey.export({ format: 'jwk' }) as { x: string }).x]

/** Verifier bound to the test authority — the product's real set stays untouched. */
const TEST_VERIFIER = createVerifier(WEAVER_PROFILE, ACCEPTED)

const PRODUCTS = {
  soloProductId: 'prod_solo',
  teamProductId: 'prod_team',
  fabrickProductId: 'prod_fabrick',
}

/** Seconds-since-epoch, as Stripe reports a period end. */
function epoch(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000)
}

/**
 * A subscription shaped as the PINNED SDK actually returns one.
 *
 * `current_period_end` sits on the ITEM. It used to be stubbed at the subscription top level —
 * where Stripe removed it — so this suite passed against an API shape the SDK no longer speaks,
 * and could not have caught the live bug where that read produced an Invalid Date and a licence
 * expiring in 2102. A stub that encodes the assumption under test proves only that the code
 * agrees with itself.
 *
 * `quantity` is stubbed for the same reason: leaving it out meant the quantity line was only ever
 * exercised through its `?? 1` fallback, so a real purchased count was never tested end to end.
 */
function stubSubscription(
  productId: string,
  periodEndIso: string,
  customer = 'cus_ABCD1234',
  quantity = 1,
) {
  mockRetrieve.mockResolvedValue({
    id: 'sub_test',
    customer,
    items: {
      data: [{ price: { product: productId }, quantity, current_period_end: epoch(periodEndIso) }],
    },
  })
}

describe('issuance round-trip — a minted key verifies', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    initStripe('sk_test_dummy')
    initProductMap(PRODUCTS)
  })

  it('mints a Solo key that the product accepts, with tier and expiry intact', async () => {
    stubSubscription(PRODUCTS.soloProductId, '2027-06-15T00:00:00Z')

    const license = await generateLicenseFromSubscription('sub_test', AUTHORITY.privateKey)

    // The issuer's own claim about what it minted...
    expect(license.tier).toBe(TIERS.SOLO)

    // ...and the product's independent reading of the artifact. These must agree; the issuer
    // saying "solo" while the key decodes to something else is the failure this catches.
    const parsed = TEST_VERIFIER.parseLicenseKey(license.key, new Date('2026-08-17T00:00:00Z'))
    expect(parsed.tier).toBe(TIERS.SOLO)
    expect(parsed.expiry?.toISOString().slice(0, 10)).toBe('2027-06-15')
    expect(parsed.graceMode).toBe(false)
  })

  it('round-trips every issuable tier', async () => {
    const cases: Array<[string, string]> = [
      [PRODUCTS.soloProductId, TIERS.SOLO],
      [PRODUCTS.teamProductId, TIERS.TEAM],
      [PRODUCTS.fabrickProductId, TIERS.FABRICK],
    ]
    for (const [productId, tier] of cases) {
      stubSubscription(productId, '2027-06-15T00:00:00Z')
      const license = await generateLicenseFromSubscription('sub_test', AUTHORITY.privateKey)
      expect(TEST_VERIFIER.parseLicenseKey(license.key, new Date('2026-08-17T00:00:00Z')).tier).toBe(tier)
    }
  })

  it('carries the customer id through the payload', async () => {
    stubSubscription(PRODUCTS.soloProductId, '2027-06-15T00:00:00Z', 'cus_WXYZ9999')

    const license = await generateLicenseFromSubscription('sub_test', AUTHORITY.privateKey)
    const parsed = TEST_VERIFIER.parseLicenseKey(license.key, new Date('2026-08-17T00:00:00Z'))

    // 4 chars of the Stripe id, uppercased — the traceability handle on a support ticket.
    expect(parsed.customerId).toBe('WXYZ')
  })

  it('mints a key in the shipped format', async () => {
    stubSubscription(PRODUCTS.soloProductId, '2027-06-15T00:00:00Z')
    const license = await generateLicenseFromSubscription('sub_test', AUTHORITY.privateKey)

    expect(license.key).toMatch(/^WVR-(FRE|WVS|WVT|FAB)-[A-Z0-9]{24}-[A-Z2-7]{103}$/)
  })

  // The half that makes the assertions above mean something. Without it they would also pass
  // against a verifier that accepted everything.
  it('a key minted by a DIFFERENT authority is rejected by the product', async () => {
    const impostor = generateKeyPairSync('ed25519')
    stubSubscription(PRODUCTS.fabrickProductId, '2027-06-15T00:00:00Z')

    const license = await generateLicenseFromSubscription('sub_test', impostor.privateKey)

    // The issuer happily mints — it signs with whatever key it is handed, which is correct; the
    // authority lives in the ACCEPTED SET, not in the minting code. Running the issuer is not a
    // privilege, and this is what stops it becoming one.
    expect(license.tier).toBe(TIERS.FABRICK)
    expect(() =>
      TEST_VERIFIER.parseLicenseKey(license.key, new Date('2026-08-17T00:00:00Z')),
    ).toThrow('signature verification failed')
  })

  it('an expired subscription round-trips into grace, then Free', async () => {
    // Issuance is time-blind — it encodes the period end it was given. The consequences of that
    // date are the VERIFIER's, and they only become observable across a round-trip.
    stubSubscription(PRODUCTS.soloProductId, '2026-08-01T00:00:00Z')
    const license = await generateLicenseFromSubscription('sub_test', AUTHORITY.privateKey)

    const inGrace = TEST_VERIFIER.parseLicenseKey(license.key, new Date('2026-08-15T00:00:00Z'))
    expect(inGrace.tier).toBe(TIERS.SOLO)
    expect(inGrace.graceMode).toBe(true)

    const lapsed = TEST_VERIFIER.parseLicenseKey(license.key, new Date('2026-10-01T00:00:00Z'))
    expect(lapsed.tier).toBe(TIERS.FREE)
    expect(lapsed.graceMode).toBe(false)
  })

  it('refuses a subscription whose product maps to no tier', async () => {
    stubSubscription('prod_not_ours', '2027-06-15T00:00:00Z')

    await expect(generateLicenseFromSubscription('sub_test', AUTHORITY.privateKey))
      .rejects.toThrow('Unknown product ID')
  })

  it('signs the PURCHASED quantity, not the conservative default', async () => {
    // The signature over this field is what makes a per-node term enforceable at all — Stripe
    // cannot count nodes in an airgapped install. Until the stub carried a quantity, this line
    // was only ever exercised through its `?? 1` fallback, so an under-granting bug would have
    // looked exactly like a passing suite.
    stubSubscription(PRODUCTS.fabrickProductId, '2027-06-15T00:00:00Z', 'cus_ABCD1234', 40)

    const license = await generateLicenseFromSubscription('sub_test', AUTHORITY.privateKey)
    const parsed = TEST_VERIFIER.parseLicenseKey(license.key, new Date('2026-08-19T00:00:00Z'))

    expect(parsed.tier).toBe(TIERS.FABRICK)
    expect(parsed.quantity).toBe(40)
  })

  it('under-grants rather than over-grants when the provider omits quantity', async () => {
    // The IGNORE half of the same rule: an absent quantity must mean 1, never unlimited. A
    // forgotten value has to cost the customer nothing they paid for and grant nothing they
    // did not.
    mockRetrieve.mockResolvedValue({
      id: 'sub_test',
      customer: 'cus_ABCD1234',
      items: {
        data: [
          {
            price: { product: PRODUCTS.soloProductId },
            current_period_end: Math.floor(new Date('2027-06-15T00:00:00Z').getTime() / 1000),
          },
        ],
      },
    })

    const license = await generateLicenseFromSubscription('sub_test', AUTHORITY.privateKey)
    const parsed = TEST_VERIFIER.parseLicenseKey(license.key, new Date('2026-08-19T00:00:00Z'))

    expect(parsed.quantity).toBe(1)
    expect(parsed.quantity).not.toBeNull() // null would mean UNLIMITED
  })

  it('refuses to mint when the provider gives no period end', async () => {
    // The defect that made every real checkout mint a licence expiring in 2102: the read returned
    // undefined, `new Date(undefined * 1000)` was an Invalid Date, and it encoded to '0NAN'
    // without complaint. Failing loudly here is the whole fix — a mint that cannot determine an
    // expiry must not produce a key.
    mockRetrieve.mockResolvedValue({
      id: 'sub_test',
      customer: 'cus_ABCD1234',
      items: { data: [{ price: { product: PRODUCTS.soloProductId }, quantity: 1 }] },
    })

    await expect(generateLicenseFromSubscription('sub_test', AUTHORITY.privateKey))
      .rejects.toThrow('current_period_end')
  })
})

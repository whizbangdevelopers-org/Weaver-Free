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

const PRODUCTS = {
  soloProductId: 'prod_solo',
  teamProductId: 'prod_team',
  fabrickProductId: 'prod_fabrick',
}

/** Seconds-since-epoch, as Stripe reports a period end. */
function epoch(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000)
}

function stubSubscription(productId: string, periodEndIso: string, customer = 'cus_ABCD1234') {
  mockRetrieve.mockResolvedValue({
    id: 'sub_test',
    customer,
    current_period_end: epoch(periodEndIso),
    items: { data: [{ price: { product: productId } }] },
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
    const parsed = parseLicenseKey(license.key, new Date('2026-08-17T00:00:00Z'), ACCEPTED)
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
      expect(parseLicenseKey(license.key, new Date('2026-08-17T00:00:00Z'), ACCEPTED).tier).toBe(tier)
    }
  })

  it('carries the customer id through the payload', async () => {
    stubSubscription(PRODUCTS.soloProductId, '2027-06-15T00:00:00Z', 'cus_WXYZ9999')

    const license = await generateLicenseFromSubscription('sub_test', AUTHORITY.privateKey)
    const parsed = parseLicenseKey(license.key, new Date('2026-08-17T00:00:00Z'), ACCEPTED)

    // 4 chars of the Stripe id, uppercased — the traceability handle on a support ticket.
    expect(parsed.customerId).toBe('WXYZ')
  })

  it('mints a key in the shipped format', async () => {
    stubSubscription(PRODUCTS.soloProductId, '2027-06-15T00:00:00Z')
    const license = await generateLicenseFromSubscription('sub_test', AUTHORITY.privateKey)

    expect(license.key).toMatch(/^WVR-(FRE|WVS|WVT|FAB)-[A-Z0-9]{12}-[A-Z2-7]{103}$/)
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
      parseLicenseKey(license.key, new Date('2026-08-17T00:00:00Z'), ACCEPTED),
    ).toThrow('signature verification failed')
  })

  it('an expired subscription round-trips into grace, then Free', async () => {
    // Issuance is time-blind — it encodes the period end it was given. The consequences of that
    // date are the VERIFIER's, and they only become observable across a round-trip.
    stubSubscription(PRODUCTS.soloProductId, '2026-08-01T00:00:00Z')
    const license = await generateLicenseFromSubscription('sub_test', AUTHORITY.privateKey)

    const inGrace = parseLicenseKey(license.key, new Date('2026-08-15T00:00:00Z'), ACCEPTED)
    expect(inGrace.tier).toBe(TIERS.SOLO)
    expect(inGrace.graceMode).toBe(true)

    const lapsed = parseLicenseKey(license.key, new Date('2026-10-01T00:00:00Z'), ACCEPTED)
    expect(lapsed.tier).toBe(TIERS.FREE)
    expect(lapsed.graceMode).toBe(false)
  })

  it('refuses a subscription whose product maps to no tier', async () => {
    stubSubscription('prod_not_ours', '2027-06-15T00:00:00Z')

    await expect(generateLicenseFromSubscription('sub_test', AUTHORITY.privateKey))
      .rejects.toThrow('Unknown product ID')
  })
})

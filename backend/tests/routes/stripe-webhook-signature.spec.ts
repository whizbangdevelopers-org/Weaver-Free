// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// The webhook's signature check, exercised for real.
//
// `/api/stripe/webhook` has no auth hooks — necessarily, because Stripe calls it — so the
// signature IS the authentication on an internet-facing endpoint that mints licences and emails
// keys. Until this file, nothing tested it: `stripe-webhook.spec.ts` mocks `constructWebhookEvent`
// wholesale, and its one signature-adjacent case asserts that a MISSING header is rejected, never
// that a WRONG one is. A build where verification silently stopped working would have passed the
// entire suite.
//
// So here `constructWebhookEvent` is real — only the issuer is stubbed, because minting is covered
// end-to-end in `license-issuance.spec.ts` and is not what these assertions are about. Signatures
// are produced with Stripe's own `generateTestHeaderString`, which is the SDK's supported way to
// do exactly this: real HMAC over the real payload bytes, no network, no container, no fixtures
// that could drift from what the verifier expects.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateKeyPairSync } from 'node:crypto'
import Stripe from 'stripe'

const { mockGenerateLicense } = vi.hoisted(() => ({ mockGenerateLicense: vi.fn() }))

// PARTIAL mock — the point of this file is that `constructWebhookEvent` is NOT mocked.
vi.mock('../../src/services/stripe.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/stripe.js')>()
  return { ...actual, generateLicenseFromSubscription: mockGenerateLicense }
})

import Fastify from 'fastify'
import { stripeWebhookRoutes } from '../../src/routes/stripe-webhook.js'
import { initStripe } from '../../src/services/stripe.js'
import { LicenseStore } from '../../src/storage/license-store.js'

const WEBHOOK_SECRET = 'whsec_test_secret_for_signature_verification'
const SIGNING_KEY = generateKeyPairSync('ed25519').privateKey

let tmpDir: string
let licenseStore: LicenseStore
let stripe: Stripe

function checkoutEvent(subscriptionId = 'sub_sig_1') {
  return JSON.stringify({
    id: `evt_${subscriptionId}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        subscription: subscriptionId,
        customer_email: 'buyer@example.com',
        customer_details: { email: 'buyer@example.com' },
        metadata: { fm: 'false' },
      },
    },
  })
}

type TestHeaderOpts = Parameters<Stripe['webhooks']['generateTestHeaderString']>[0]

/**
 * Sign a payload the way Stripe does. `timestamp` is injectable so replay can be tested.
 *
 * The cast is deliberate and narrow. stripe-node's `WebhookTestHeaderOptions` types all six fields
 * as REQUIRED — `timestamp`, `payload`, `secret`, `scheme`, `signature`, `cryptoProvider` — while
 * the implementation defaults everything but `payload` and `secret`. These calls run correctly
 * (they passed before this file was typechecked at all); the `.d.ts` is simply stricter than the
 * code it describes. Satisfying the compiler honestly would mean inventing a `signature` and a
 * `cryptoProvider` that the SDK is about to compute for itself, which is worse than saying so.
 */
function sign(payload: string, secret = WEBHOOK_SECRET, timestamp?: number): string {
  const opts = {
    payload,
    secret,
    ...(timestamp !== undefined ? { timestamp } : {}),
  } as TestHeaderOpts
  return stripe.webhooks.generateTestHeaderString(opts)
}

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(stripeWebhookRoutes, {
    prefix: '/webhook',
    webhookSecret: WEBHOOK_SECRET,
    signingKey: SIGNING_KEY,
    licenseStore,
    siteUrl: 'https://whizbangdevelopers.com',
  })
  return app
}

function post(app: Awaited<ReturnType<typeof buildApp>>, payload: string, signature: string) {
  return app.inject({
    method: 'POST',
    url: '/webhook',
    headers: { 'content-type': 'application/json', 'stripe-signature': signature },
    payload,
  })
}

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'stripe-sig-test-'))
  stripe = initStripe('sk_test_dummy_key_no_network_calls')
})

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

beforeEach(async () => {
  vi.resetAllMocks()
  licenseStore = new LicenseStore(join(tmpDir, `licenses-${Math.random().toString(36).slice(2)}.json`))
  await licenseStore.init()
  mockGenerateLicense.mockResolvedValue({
    key: 'WVR-WVS-TESTKEY12345-' + 'A'.repeat(103),
    tier: 'solo',
    customerId: 'cus_sig',
    subscriptionId: 'sub_sig_1',
    expiresAt: new Date('2027-06-15T00:00:00Z'),
  })
})

describe('webhook signature — the only authentication this endpoint has', () => {
  it('ACCEPTS a correctly signed payload', async () => {
    const app = await buildApp()
    const payload = checkoutEvent()

    const res = await post(app, payload, sign(payload))

    expect(res.statusCode).toBe(200)
    // Verification is not enough on its own — the handler must actually have run, or a route that
    // accepted everything and did nothing would pass this test.
    expect(mockGenerateLicense).toHaveBeenCalledOnce()
  })

  it('REJECTS a payload tampered with after signing', async () => {
    const app = await buildApp()
    const original = checkoutEvent('sub_original')
    const signature = sign(original)

    // The attack: a genuine signature, replayed over substituted content.
    const tampered = original.replace('sub_original', 'sub_attacker')

    const res = await post(app, tampered, signature)

    expect(res.statusCode).toBe(400)
    expect(mockGenerateLicense).not.toHaveBeenCalled()
  })

  it('REJECTS a payload signed with the wrong secret', async () => {
    const app = await buildApp()
    const payload = checkoutEvent()

    const res = await post(app, payload, sign(payload, 'whsec_an_attackers_own_secret'))

    expect(res.statusCode).toBe(400)
    expect(mockGenerateLicense).not.toHaveBeenCalled()
  })

  it('REJECTS a stale signature — replay outside the tolerance window', async () => {
    const app = await buildApp()
    const payload = checkoutEvent()
    const anHourAgo = Math.floor(Date.now() / 1000) - 3600

    const res = await post(app, payload, sign(payload, WEBHOOK_SECRET, anHourAgo))

    // Stripe's default tolerance is 300s. Without the timestamp check a captured request stays
    // replayable forever, which is why the signature alone is not the whole control.
    expect(res.statusCode).toBe(400)
    expect(mockGenerateLicense).not.toHaveBeenCalled()
  })

  it('ACCEPTS a signature inside the tolerance window', async () => {
    const app = await buildApp()
    const payload = checkoutEvent()
    const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60

    const res = await post(app, payload, sign(payload, WEBHOOK_SECRET, oneMinuteAgo))

    // The IGNORE half. Without it, a verifier that rejected everything would pass every
    // assertion above, and clock skew between Stripe and the host would look like an attack.
    expect(res.statusCode).toBe(200)
  })

  it('REJECTS a garbage signature header', async () => {
    const app = await buildApp()
    const payload = checkoutEvent()

    const res = await post(app, payload, 't=1,v1=deadbeef')

    expect(res.statusCode).toBe(400)
    expect(mockGenerateLicense).not.toHaveBeenCalled()
  })
})

describe('webhook delivery is at-least-once — issuance must be idempotent', () => {
  it('mints ONCE for a subscription even when the event is delivered twice', async () => {
    const app = await buildApp()
    const payload = checkoutEvent('sub_replay')
    mockGenerateLicense.mockResolvedValue({
      key: 'WVR-WVS-REPLAYKEY123-' + 'A'.repeat(103),
      tier: 'solo',
      customerId: 'cus_replay',
      subscriptionId: 'sub_replay',
      expiresAt: new Date('2027-06-15T00:00:00Z'),
    })

    // Stripe documents at-least-once delivery, and a redelivery is signed just as validly as the
    // first — the signature check cannot distinguish them, by design. Without a guard this mints a
    // second key, stores a second record, and emails the customer a second licence.
    const first = await post(app, payload, sign(payload))
    const second = await post(app, payload, sign(payload))

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)

    expect(licenseStore.all()).toHaveLength(1)
    expect(mockGenerateLicense).toHaveBeenCalledOnce()
  })

  it('still issues for a genuinely different subscription', async () => {
    // The IGNORE half of the guard above. A dedupe that suppressed every second checkout would
    // pass the previous test and silently stop issuing to real customers — the failure mode that
    // gets a guard switched off, and the one nobody notices until revenue is missing.
    const app = await buildApp()

    for (const sub of ['sub_one', 'sub_two']) {
      mockGenerateLicense.mockResolvedValueOnce({
        key: `WVR-WVS-${sub.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12).padEnd(12, 'X')}-${'A'.repeat(103)}`,
        tier: 'solo',
        customerId: `cus_${sub}`,
        subscriptionId: sub,
        expiresAt: new Date('2027-06-15T00:00:00Z'),
      })
      const payload = checkoutEvent(sub)
      const res = await post(app, payload, sign(payload))
      expect(res.statusCode).toBe(200)
    }

    expect(licenseStore.all()).toHaveLength(2)
    expect(mockGenerateLicense).toHaveBeenCalledTimes(2)
  })
})

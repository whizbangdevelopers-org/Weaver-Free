// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Integration tests for the Stripe webhook route.
 *
 * Mocks the Stripe SDK calls (signature verification, subscription retrieval)
 * but exercises the full route → license store → email service → audit flow.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach} from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Mock Stripe service — must be before imports that use it
// ---------------------------------------------------------------------------

const { mockConstructWebhookEvent, mockGenerateLicenseFromSubscription } = vi.hoisted(() => ({
  mockConstructWebhookEvent: vi.fn(),
  mockGenerateLicenseFromSubscription: vi.fn(),
}))

vi.mock('../../src/services/stripe.js', () => ({
  constructWebhookEvent: mockConstructWebhookEvent,
  generateLicenseFromSubscription: mockGenerateLicenseFromSubscription,
  initStripe: vi.fn(),
  initProductMap: vi.fn(),
}))

import Fastify from 'fastify'
import { generateKeyPairSync } from 'node:crypto'
import { stripeWebhookRoutes } from '../../src/routes/stripe-webhook.js'
import { LicenseStore } from '../../src/storage/license-store.js'
import type { EmailService } from '../../src/services/email.js'
import type { AuditService } from '../../src/services/audit.js'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeCheckoutEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_test_checkout',
    type: 'checkout.session.completed',
    data: {
      object: {
        subscription: 'sub_test_123',
        customer_email: 'buyer@example.com',
        customer_details: { email: 'buyer@example.com' },
        metadata: { fm: 'false' },
        ...overrides,
      },
    },
  }
}

function makeSubscriptionUpdatedEvent(subId: string, periodEnd: number) {
  return {
    id: 'evt_test_sub_updated',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: subId,
        status: 'active',
        current_period_end: periodEnd,
      },
    },
  }
}

function makeSubscriptionDeletedEvent(subId: string) {
  return {
    id: 'evt_test_sub_deleted',
    type: 'customer.subscription.deleted',
    data: { object: { id: subId } },
  }
}

const TEST_SIGNING_KEY = generateKeyPairSync('ed25519').privateKey

const TEST_LICENSE = {
  key: 'WVR-WVS-TESTKEY12345-A1B2',
  tier: 'solo' as const,
  customerId: 'cus_test_abc',
  subscriptionId: 'sub_test_123',
  expiresAt: new Date('2027-04-08T00:00:00Z'),
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let tmpDir: string
let licenseStore: LicenseStore

function buildApp(opts: {
  emailService?: EmailService
  auditService?: AuditService
}) {
  const app = Fastify({ logger: false })
  app.register(stripeWebhookRoutes, {
    prefix: '/webhook',
    webhookSecret: 'whsec_test',
    // Required by the plugin, unused by these tests: they mock the issuer, so nothing signs.
    // It was `hmacSecret: 'hmac_test'` until the option changed, and every test here kept passing
    // against a registration that could not compile — the gap tsconfig.tests.json closes.
    signingKey: TEST_SIGNING_KEY,
    licenseStore,
    auditService: opts.auditService,
    emailService: opts.emailService,
    siteUrl: 'https://whizbangdevelopers.com',
  })
  return app
}

function injectWebhook(app: ReturnType<typeof Fastify>, body = '{}', signature = 'sig_test') {
  return app.inject({
    method: 'POST',
    url: '/webhook',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    payload: body,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stripe Webhook Route', () => {
  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'stripe-webhook-test-'))
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    licenseStore = new LicenseStore(join(tmpDir, `licenses-${Date.now()}.json`))
    await licenseStore.init()
  })

  // --- Signature verification ---

  describe('signature verification', () => {
    it('rejects requests without stripe-signature header', async () => {
      const app = buildApp({})
      await app.ready()

      const res = await app.inject({
        method: 'POST',
        url: '/webhook',
        headers: { 'content-type': 'application/json' },
        payload: '{}',
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toContain('stripe-signature')
      await app.close()
    })

    it('rejects requests with invalid signature', async () => {
      mockConstructWebhookEvent.mockImplementation(() => {
        throw new Error('Signature verification failed')
      })
      const app = buildApp({})
      await app.ready()

      const res = await injectWebhook(app, '{}', 'bad_sig')

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toContain('Webhook signature verification failed')
      await app.close()
    })
  })

  // --- checkout.session.completed ---

  describe('checkout.session.completed', () => {
    it('generates license and saves to store', async () => {
      const event = makeCheckoutEvent()
      mockConstructWebhookEvent.mockReturnValue(event)
      mockGenerateLicenseFromSubscription.mockResolvedValue(TEST_LICENSE)

      const app = buildApp({})
      await app.ready()

      const res = await injectWebhook(app)
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ received: true })

      // License should be in the store
      const stored = licenseStore.findByKey('WVR-WVS-TESTKEY12345-A1B2')
      expect(stored).not.toBeNull()
      expect(stored!.tier).toBe('solo')
      expect(stored!.email).toBe('buyer@example.com')
      expect(stored!.stripeCustomerId).toBe('cus_test_abc')
      expect(stored!.stripeSubscriptionId).toBe('sub_test_123')
      expect(stored!.foundingMember).toBe(false)

      await app.close()
    })

    it('saves founding member flag from session metadata', async () => {
      const event = makeCheckoutEvent({ metadata: { fm: 'true' } })
      mockConstructWebhookEvent.mockReturnValue(event)
      mockGenerateLicenseFromSubscription.mockResolvedValue(TEST_LICENSE)

      const app = buildApp({})
      await app.ready()
      await injectWebhook(app)

      const stored = licenseStore.findByKey(TEST_LICENSE.key)
      expect(stored!.foundingMember).toBe(true)
      await app.close()
    })

    it('sends license key email when emailService is configured', async () => {
      const event = makeCheckoutEvent()
      mockConstructWebhookEvent.mockReturnValue(event)
      mockGenerateLicenseFromSubscription.mockResolvedValue(TEST_LICENSE)

      const mockEmailService = {
        sendLicenseKey: vi.fn().mockResolvedValue(undefined),
        verify: vi.fn().mockResolvedValue(true),
      } as unknown as EmailService

      const app = buildApp({ emailService: mockEmailService })
      await app.ready()
      await injectWebhook(app)

      // Email is fire-and-forget — wait for the promise to settle
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(mockEmailService.sendLicenseKey).toHaveBeenCalledOnce()
      expect(mockEmailService.sendLicenseKey).toHaveBeenCalledWith({
        to: 'buyer@example.com',
        licenseKey: 'WVR-WVS-TESTKEY12345-A1B2',
        tier: 'solo',
        expiresAt: '2027-04-08T00:00:00.000Z',
        foundingMember: false,
        siteUrl: 'https://whizbangdevelopers.com',
      })
      await app.close()
    })

    it('does not send email when customer has no email', async () => {
      const event = makeCheckoutEvent({
        customer_email: null,
        customer_details: { email: null },
      })
      mockConstructWebhookEvent.mockReturnValue(event)
      mockGenerateLicenseFromSubscription.mockResolvedValue(TEST_LICENSE)

      const mockEmailService = {
        sendLicenseKey: vi.fn().mockResolvedValue(undefined),
        verify: vi.fn().mockResolvedValue(true),
      } as unknown as EmailService

      const app = buildApp({ emailService: mockEmailService })
      await app.ready()
      await injectWebhook(app)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(mockEmailService.sendLicenseKey).not.toHaveBeenCalled()
      await app.close()
    })

    it('does not send email when emailService is not configured', async () => {
      const event = makeCheckoutEvent()
      mockConstructWebhookEvent.mockReturnValue(event)
      mockGenerateLicenseFromSubscription.mockResolvedValue(TEST_LICENSE)

      const app = buildApp({ emailService: undefined })
      await app.ready()

      // Should succeed without throwing
      const res = await injectWebhook(app)
      expect(res.statusCode).toBe(200)
      await app.close()
    })

    it('webhook succeeds even if email sending fails', async () => {
      const event = makeCheckoutEvent()
      mockConstructWebhookEvent.mockReturnValue(event)
      mockGenerateLicenseFromSubscription.mockResolvedValue(TEST_LICENSE)

      const mockEmailService = {
        sendLicenseKey: vi.fn().mockRejectedValue(new Error('SMTP timeout')),
        verify: vi.fn().mockResolvedValue(true),
      } as unknown as EmailService

      const app = buildApp({ emailService: mockEmailService })
      await app.ready()

      const res = await injectWebhook(app)
      expect(res.statusCode).toBe(200)

      // License was still saved despite email failure
      const stored = licenseStore.findByKey(TEST_LICENSE.key)
      expect(stored).not.toBeNull()
      await app.close()
    })

    it('audits email send success', async () => {
      const event = makeCheckoutEvent()
      mockConstructWebhookEvent.mockReturnValue(event)
      mockGenerateLicenseFromSubscription.mockResolvedValue(TEST_LICENSE)

      const mockAuditService = { log: vi.fn() } as unknown as AuditService
      const mockEmailService = {
        sendLicenseKey: vi.fn().mockResolvedValue(undefined),
        verify: vi.fn().mockResolvedValue(true),
      } as unknown as EmailService

      const app = buildApp({ emailService: mockEmailService, auditService: mockAuditService })
      await app.ready()
      await injectWebhook(app)
      await new Promise(resolve => setTimeout(resolve, 50))

      const emailAuditCall = (mockAuditService.log as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0].action === 'license.email-sent'
      )
      expect(emailAuditCall).toBeDefined()
      expect(emailAuditCall![0].details.to).toBe('buyer@example.com')
      await app.close()
    })

    it('audits email send failure', async () => {
      const event = makeCheckoutEvent()
      mockConstructWebhookEvent.mockReturnValue(event)
      mockGenerateLicenseFromSubscription.mockResolvedValue(TEST_LICENSE)

      const mockAuditService = { log: vi.fn() } as unknown as AuditService
      const mockEmailService = {
        sendLicenseKey: vi.fn().mockRejectedValue(new Error('SMTP down')),
        verify: vi.fn().mockResolvedValue(true),
      } as unknown as EmailService

      const app = buildApp({ emailService: mockEmailService, auditService: mockAuditService })
      await app.ready()
      await injectWebhook(app)
      await new Promise(resolve => setTimeout(resolve, 50))

      const failAuditCall = (mockAuditService.log as ReturnType<typeof vi.fn>).mock.calls.find(
        (call) => call[0].action === 'license.email-failed'
      )
      expect(failAuditCall).toBeDefined()
      expect(failAuditCall![0].success).toBe(false)
      expect(failAuditCall![0].details.error).toContain('SMTP down')
      await app.close()
    })

    it('ignores checkout without subscription ID', async () => {
      const event = makeCheckoutEvent({ subscription: null })
      mockConstructWebhookEvent.mockReturnValue(event)

      const app = buildApp({})
      await app.ready()

      const res = await injectWebhook(app)
      expect(res.statusCode).toBe(200)
      expect(mockGenerateLicenseFromSubscription).not.toHaveBeenCalled()
      await app.close()
    })

    it('uses customer_details.email as fallback', async () => {
      const event = makeCheckoutEvent({
        customer_email: null,
        customer_details: { email: 'fallback@example.com' },
      })
      mockConstructWebhookEvent.mockReturnValue(event)
      mockGenerateLicenseFromSubscription.mockResolvedValue(TEST_LICENSE)

      const mockEmailService = {
        sendLicenseKey: vi.fn().mockResolvedValue(undefined),
        verify: vi.fn().mockResolvedValue(true),
      } as unknown as EmailService

      const app = buildApp({ emailService: mockEmailService })
      await app.ready()
      await injectWebhook(app)
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(mockEmailService.sendLicenseKey).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'fallback@example.com' })
      )
      await app.close()
    })
  })

  // --- customer.subscription.updated ---

  /**
   * Renewal must MINT and PUSH a new key.
   *
   * The test that stood here asserted `expiresAt` had moved to 2028 and stopped — and it passed,
   * against an implementation that advanced the stored expiry and never touched the key. That is
   * a write to a field nothing enforces: the expiry that decides a host's tier is signed into the
   * key the customer installed. So a "renewed" customer kept a key expiring at the end of their
   * FIRST period, and dropped to Free on their next restart.
   *
   * The assertion that would have caught it is the one about the key, so these tests lead with it.
   */
  describe('customer.subscription.updated', () => {
    const RENEWED = {
      key: 'WVR-WVS-RENEWED123456-B2C3',
      tier: 'solo' as const,
      customerId: 'cus_existing',
      subscriptionId: 'sub_renew_123',
      expiresAt: new Date('2028-01-01T00:00:00Z'),
    }

    async function seedLicense(over: Record<string, unknown> = {}) {
      await licenseStore.save({
        key: 'WVR-WVS-EXISTING00000-XXXX',
        tier: 'solo',
        stripeCustomerId: 'cus_existing',
        stripeSubscriptionId: 'sub_renew_123',
        expiresAt: '2027-01-01T00:00:00Z',
        createdAt: new Date().toISOString(),
        email: 'user@example.com',
        foundingMember: false,
        ...over,
      })
    }

    it('mints a new key and stores it with the new expiry', async () => {
      await seedLicense()
      mockGenerateLicenseFromSubscription.mockResolvedValue(RENEWED)
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionUpdatedEvent('sub_renew_123', Math.floor(RENEWED.expiresAt.getTime() / 1000)),
      )

      const app = buildApp({})
      await app.ready()
      expect((await injectWebhook(app)).statusCode).toBe(200)

      const updated = licenseStore.findBySubscription('sub_renew_123')
      expect(updated!.key).toBe('WVR-WVS-RENEWED123456-B2C3')
      expect(updated!.expiresAt).toContain('2028')
      await app.close()
    })

    it('emails the new key to the address on the existing record', async () => {
      await seedLicense()
      mockGenerateLicenseFromSubscription.mockResolvedValue(RENEWED)
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionUpdatedEvent('sub_renew_123', Math.floor(RENEWED.expiresAt.getTime() / 1000)),
      )

      const sendLicenseKey = vi.fn().mockResolvedValue(undefined)
      const app = buildApp({ emailService: { sendLicenseKey } as unknown as EmailService })
      await app.ready()
      await injectWebhook(app)

      // A stored key nobody is told about is not a push — the customer has to install it.
      expect(sendLicenseKey).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@example.com', licenseKey: 'WVR-WVS-RENEWED123456-B2C3' }),
      )
      await app.close()
    })

    it('carries founding-member status onto the renewal', async () => {
      await seedLicense({ foundingMember: true })
      mockGenerateLicenseFromSubscription.mockResolvedValue(RENEWED)
      mockConstructWebhookEvent.mockReturnValue(
        makeSubscriptionUpdatedEvent('sub_renew_123', Math.floor(RENEWED.expiresAt.getTime() / 1000)),
      )

      const sendLicenseKey = vi.fn().mockResolvedValue(undefined)
      const app = buildApp({ emailService: { sendLicenseKey } as unknown as EmailService })
      await app.ready()
      await injectWebhook(app)

      expect(sendLicenseKey).toHaveBeenCalledWith(expect.objectContaining({ foundingMember: true }))
      await app.close()
    })

    it('ignores a non-active subscription status', async () => {
      await seedLicense()
      const event = makeSubscriptionUpdatedEvent('sub_renew_123', 0)
      event.data.object.status = 'past_due'
      mockConstructWebhookEvent.mockReturnValue(event)

      const app = buildApp({})
      await app.ready()
      expect((await injectWebhook(app)).statusCode).toBe(200)

      expect(mockGenerateLicenseFromSubscription).not.toHaveBeenCalled()
      expect(licenseStore.findBySubscription('sub_renew_123')!.key).toBe('WVR-WVS-EXISTING00000-XXXX')
      await app.close()
    })

    it('does not issue for a subscription it never issued for', async () => {
      mockConstructWebhookEvent.mockReturnValue(makeSubscriptionUpdatedEvent('sub_unknown', 0))

      const app = buildApp({})
      await app.ready()
      expect((await injectWebhook(app)).statusCode).toBe(200)

      expect(mockGenerateLicenseFromSubscription).not.toHaveBeenCalled()
      await app.close()
    })

    // Stripe emits `updated` for plenty of changes. Re-minting on one of them after a local
    // revoke would silently restore a licence somebody deliberately took away.
    it('does not re-issue for a revoked licence', async () => {
      await seedLicense()
      await licenseStore.revoke('sub_renew_123')
      mockConstructWebhookEvent.mockReturnValue(makeSubscriptionUpdatedEvent('sub_renew_123', 0))

      const app = buildApp({})
      await app.ready()
      expect((await injectWebhook(app)).statusCode).toBe(200)

      expect(mockGenerateLicenseFromSubscription).not.toHaveBeenCalled()
      await app.close()
    })

    // Stripe retries a non-2xx, and a retry would mint again. The key is already persisted, so
    // the durable half has happened either way.
    it('still returns 200 when minting fails, and leaves the old key in place', async () => {
      await seedLicense()
      mockGenerateLicenseFromSubscription.mockRejectedValue(new Error('Stripe unreachable'))
      mockConstructWebhookEvent.mockReturnValue(makeSubscriptionUpdatedEvent('sub_renew_123', 0))

      const app = buildApp({})
      await app.ready()
      expect((await injectWebhook(app)).statusCode).toBe(200)

      expect(licenseStore.findBySubscription('sub_renew_123')!.key).toBe('WVR-WVS-EXISTING00000-XXXX')
      await app.close()
    })

    it('still returns 200 when the renewal email fails', async () => {
      await seedLicense()
      mockGenerateLicenseFromSubscription.mockResolvedValue(RENEWED)
      mockConstructWebhookEvent.mockReturnValue(makeSubscriptionUpdatedEvent('sub_renew_123', 0))

      const app = buildApp({
        emailService: { sendLicenseKey: vi.fn().mockRejectedValue(new Error('SMTP down')) } as unknown as EmailService,
      })
      await app.ready()
      expect((await injectWebhook(app)).statusCode).toBe(200)

      // Persisted regardless — the mail is fire-and-forget precisely so it cannot cost the key.
      expect(licenseStore.findBySubscription('sub_renew_123')!.key).toBe('WVR-WVS-RENEWED123456-B2C3')
      await app.close()
    })
  })

  // --- customer.subscription.deleted ---

  describe('customer.subscription.deleted', () => {
    it('revokes license on cancellation', async () => {
      await licenseStore.save({
        key: 'WVR-WVS-TOREVOKE00000-XXXX',
        tier: 'solo',
        stripeCustomerId: 'cus_cancel',
        stripeSubscriptionId: 'sub_cancel_123',
        expiresAt: '2027-06-01T00:00:00Z',
        createdAt: new Date().toISOString(),
        email: 'cancel@example.com',
        foundingMember: false,
      })

      const event = makeSubscriptionDeletedEvent('sub_cancel_123')
      mockConstructWebhookEvent.mockReturnValue(event)

      const mockAuditService = { log: vi.fn() } as unknown as AuditService
      const app = buildApp({ auditService: mockAuditService })
      await app.ready()

      const res = await injectWebhook(app)
      expect(res.statusCode).toBe(200)

      // License should be revoked (findByKey returns null for revoked)
      const revoked = licenseStore.findByKey('WVR-WVS-TOREVOKE00000-XXXX')
      expect(revoked).toBeNull()

      // Audit log should record revocation
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'license.revoked' })
      )
      await app.close()
    })
  })

  // --- Unhandled events ---

  describe('unhandled events', () => {
    it('returns 200 for unknown event types', async () => {
      mockConstructWebhookEvent.mockReturnValue({
        id: 'evt_unknown',
        type: 'payment_intent.created',
        data: { object: {} },
      })

      const app = buildApp({})
      await app.ready()

      const res = await injectWebhook(app)
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ received: true })
      await app.close()
    })
  })
})

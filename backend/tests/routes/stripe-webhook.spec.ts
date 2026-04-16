// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Integration tests for the Stripe webhook route.
 *
 * Mocks the Stripe SDK calls (signature verification, subscription retrieval)
 * but exercises the full route → license store → email service → audit flow.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
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

const TEST_LICENSE = {
  key: 'WVR-WVS-TESTKEY12345-A1B2',
  tier: 'weaver' as const,
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
    hmacSecret: 'hmac_test',
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
      expect(stored!.tier).toBe('weaver')
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
        tier: 'weaver',
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

  describe('customer.subscription.updated', () => {
    it('updates license expiry on renewal', async () => {
      // Pre-seed a license
      await licenseStore.save({
        key: 'WVR-WVS-EXISTING00000-XXXX',
        tier: 'weaver',
        stripeCustomerId: 'cus_existing',
        stripeSubscriptionId: 'sub_renew_123',
        expiresAt: '2027-01-01T00:00:00Z',
        createdAt: new Date().toISOString(),
        email: 'user@example.com',
        foundingMember: false,
      })

      const newPeriodEnd = Math.floor(new Date('2028-01-01').getTime() / 1000)
      const event = makeSubscriptionUpdatedEvent('sub_renew_123', newPeriodEnd)
      mockConstructWebhookEvent.mockReturnValue(event)

      const app = buildApp({})
      await app.ready()

      const res = await injectWebhook(app)
      expect(res.statusCode).toBe(200)

      const updated = licenseStore.findBySubscription('sub_renew_123')
      expect(updated).not.toBeNull()
      expect(updated!.expiresAt).toContain('2028')
      await app.close()
    })
  })

  // --- customer.subscription.deleted ---

  describe('customer.subscription.deleted', () => {
    it('revokes license on cancellation', async () => {
      await licenseStore.save({
        key: 'WVR-WVS-TOREVOKE00000-XXXX',
        tier: 'weaver',
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

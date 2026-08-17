// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { type KeyObject } from 'node:crypto'
import { constructWebhookEvent, generateLicenseFromSubscription } from '../services/stripe.js'
import type { LicenseStore } from '../storage/license-store.js'
import type { AuditService } from '../services/audit.js'
import type { EmailService } from '../services/email.js'

interface StripeWebhookOptions {
  webhookSecret: string
  /**
   * The hub's Ed25519 PRIVATE signing key. Was `hmacSecret: string` — the symmetric
   * value that both minted and validated, and which every host also held. Only the issuer needs
   * this now, and a shipped product build has no way to obtain it. Until the hub key is
   * provisioned this plugin is only reachable in tests.
   */
  signingKey: KeyObject
  licenseStore: LicenseStore
  auditService?: AuditService
  emailService?: EmailService
  siteUrl: string
}

export const stripeWebhookRoutes: FastifyPluginAsync<StripeWebhookOptions> = async (fastify, opts) => {
  // Stripe sends raw body — must parse manually for signature verification.
  // Register a content type parser that preserves the raw buffer.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => { done(null, body) }
  )

  // Body is typed as Buffer via the route generic, matching what the parser above
  // actually produces. This route is the one place a Zod body schema would be WRONG:
  // Stripe's signature is computed over the exact bytes sent, so parsing or re-serializing
  // the body destroys the thing being verified. The signature check IS the validation, and
  // it runs before the payload is trusted for anything.
  fastify.post<{ Body: Buffer }>('/', async (request, reply) => {
    const signature = request.headers['stripe-signature']
    if (!signature || typeof signature !== 'string') {
      return reply.status(400).send({ error: 'Missing stripe-signature header' })
    }

    let event
    try {
      event = constructWebhookEvent(
        request.body,
        signature,
        opts.webhookSecret
      )
    } catch (err) {
      fastify.log.warn(err, 'Stripe webhook signature verification failed')
      return reply.status(400).send({ error: 'Webhook signature verification failed' })
    }

    fastify.log.info({ type: event.type, id: event.id }, 'Stripe webhook received')

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const subscriptionId = session.subscription
        if (!subscriptionId || typeof subscriptionId !== 'string') {
          fastify.log.warn('checkout.session.completed without subscription ID — ignoring')
          break
        }

        // Stripe delivers at least once. A redelivery carries a VALID signature — it is the same
        // request — so the signature check cannot distinguish it from the first, by design.
        // Without this guard a retry mints a second key, stores a second record, and emails the
        // customer a second licence, all reported as success.
        //
        // Keyed on the SUBSCRIPTION rather than on `event.id`, deliberately. Stripe's own advice
        // is event-id idempotency, which here would mean persisting every processed id forever to
        // answer a question the licence store already answers. One subscription has one licence;
        // if we hold one, this checkout has been handled — and that stays true across a restart,
        // across a differently-numbered event for the same subscription, and with no new storage
        // to grow or prune.
        const alreadyIssued = opts.licenseStore.findBySubscription(subscriptionId)
        if (alreadyIssued) {
          fastify.log.info(
            { subscriptionId, eventId: event.id },
            'checkout.session.completed for a subscription that already has a licence — not re-issuing',
          )
          break
        }

        try {
          const license = await generateLicenseFromSubscription(subscriptionId, opts.signingKey)
          await opts.licenseStore.save({
            key: license.key,
            tier: license.tier,
            stripeCustomerId: license.customerId,
            stripeSubscriptionId: license.subscriptionId,
            expiresAt: license.expiresAt.toISOString(),
            createdAt: new Date().toISOString(),
            email: (session.customer_email ?? session.customer_details?.email) || null,
            foundingMember: session.metadata?.fm === 'true',
          })

          fastify.log.info({
            key: license.key.slice(0, 8) + '...',
            tier: license.tier,
            customer: license.customerId,
          }, 'License key generated from Stripe checkout')

          opts.auditService?.log({
            action: 'license.generated',
            success: true,
            userId: null,
            username: 'stripe-webhook',
            ip: request.ip,
            details: { tier: license.tier, subscriptionId: license.subscriptionId },
          })

          // Send license key email (fire-and-forget — don't fail the webhook)
          const customerEmail = (session.customer_email ?? session.customer_details?.email) || null
          if (opts.emailService && customerEmail) {
            opts.emailService.sendLicenseKey({
              to: customerEmail,
              licenseKey: license.key,
              tier: license.tier,
              expiresAt: license.expiresAt.toISOString(),
              foundingMember: session.metadata?.fm === 'true',
              siteUrl: opts.siteUrl,
            }).then(() => {
              fastify.log.info({ to: customerEmail }, 'License key email sent')
              opts.auditService?.log({
                action: 'license.email-sent',
                success: true,
                userId: null,
                username: 'stripe-webhook',
                ip: request.ip,
                details: { tier: license.tier, to: customerEmail },
              })
            }).catch((err) => {
              fastify.log.error(err, 'Failed to send license key email')
              opts.auditService?.log({
                action: 'license.email-failed',
                success: false,
                userId: null,
                username: 'stripe-webhook',
                ip: request.ip,
                details: { tier: license.tier, to: customerEmail, error: String(err) },
              })
            })
          }
        } catch (err) {
          fastify.log.error(err, 'Failed to generate license from checkout')
          opts.auditService?.log({
            action: 'license.generation-failed',
            success: false,
            userId: null,
            username: 'stripe-webhook',
            ip: request.ip,
            details: { subscriptionId, error: String(err) },
          })
        }
        break
      }

      /**
       * Renewal — mint a NEW key and push it to the customer.
       *
       * This branch used to move the stored `expiresAt` forward and stop there. That is a write
       * to a field nothing enforces: the expiry that decides a host's tier is encoded in the
       * signed key the customer installed, and a renewal that does not mint a key leaves them
       * holding one that expires at the end of their FIRST period. It keeps working only because
       * the host reads its key at start-up — so the failure surfaces at the next restart, as a
       * paying customer silently dropping to Free.
       *
       * So: mint for the new period, replace key and expiry as one write, and email it. The
       * host picks it up on its next key-file read without a restart.
       */
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const subId = sub.id

        if (sub.status !== 'active') break

        const existing = opts.licenseStore.findBySubscription(subId)
        if (!existing) {
          // Nothing to renew — a subscription we never issued for. Not an error: the checkout
          // branch owns first issuance, and Stripe emits `updated` for changes we don't act on.
          fastify.log.debug({ subscriptionId: subId }, 'subscription.updated for an unknown subscription — ignoring')
          break
        }
        if (existing.revokedAt) {
          // Revoked locally. Re-minting here would silently un-revoke a licence through a
          // routine Stripe event, which is a grant nobody made.
          fastify.log.warn({ subscriptionId: subId }, 'subscription.updated for a revoked licence — not re-issuing')
          break
        }

        try {
          const license = await generateLicenseFromSubscription(subId, opts.signingKey)
          const renewed = await opts.licenseStore.renew(
            subId,
            license.key,
            license.expiresAt.toISOString(),
          )
          if (!renewed) break

          fastify.log.info({
            subscriptionId: subId,
            key: license.key.slice(0, 8) + '...',
            expiresAt: license.expiresAt.toISOString(),
          }, 'License renewed — new key minted for the new period')

          opts.auditService?.log({
            action: 'license.renewed',
            success: true,
            userId: null,
            username: 'stripe-webhook',
            ip: request.ip,
            details: { tier: license.tier, subscriptionId: subId, expiresAt: license.expiresAt.toISOString() },
          })

          // Fire-and-forget, exactly as first issuance is: a mail failure must not fail the
          // webhook, or Stripe retries and we mint again. The key is already persisted and the
          // customer can retrieve it, so the durable half has happened either way.
          const to = existing.email
          if (opts.emailService && to) {
            opts.emailService.sendLicenseKey({
              to,
              licenseKey: license.key,
              tier: license.tier,
              expiresAt: license.expiresAt.toISOString(),
              foundingMember: existing.foundingMember,
              siteUrl: opts.siteUrl,
            }).then(() => {
              fastify.log.info({ to }, 'Renewal license key email sent')
            }).catch((err) => {
              fastify.log.error(err, 'Failed to send renewal license key email')
              opts.auditService?.log({
                action: 'license.email-failed',
                success: false,
                userId: null,
                username: 'stripe-webhook',
                ip: request.ip,
                details: { tier: license.tier, to, error: String(err) },
              })
            })
          }
        } catch (err) {
          fastify.log.error(err, 'Failed to renew license from subscription')
          opts.auditService?.log({
            action: 'license.renewal-failed',
            success: false,
            userId: null,
            username: 'stripe-webhook',
            ip: request.ip,
            details: { subscriptionId: subId, error: String(err) },
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const revoked = await opts.licenseStore.revoke(sub.id)
        if (revoked) {
          fastify.log.info({ subscriptionId: sub.id }, 'License revoked — subscription canceled')
          opts.auditService?.log({
            action: 'license.revoked',
            success: true,
            userId: null,
            username: 'stripe-webhook',
            ip: request.ip,
            details: { subscriptionId: sub.id },
          })
        }
        break
      }

      default:
        fastify.log.debug({ type: event.type }, 'Unhandled Stripe event type')
    }

    return reply.status(200).send({ received: true })
  })
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { constructWebhookEvent, generateLicenseFromSubscription } from '../services/stripe.js'
import type { LicenseStore } from '../storage/license-store.js'
import type { AuditService } from '../services/audit.js'
import type { EmailService } from '../services/email.js'

interface StripeWebhookOptions {
  webhookSecret: string
  hmacSecret: string
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

  fastify.post('/', async (request, reply) => {
    const signature = request.headers['stripe-signature']
    if (!signature || typeof signature !== 'string') {
      return reply.status(400).send({ error: 'Missing stripe-signature header' })
    }

    let event
    try {
      event = constructWebhookEvent(
        request.body as Buffer,
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

        try {
          const license = await generateLicenseFromSubscription(subscriptionId, opts.hmacSecret)
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

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const subId = sub.id

        // Update license expiry when subscription renews
        if (sub.status === 'active') {
          const periodEnd = (sub as unknown as { current_period_end: number }).current_period_end
          const expiresAt = new Date(periodEnd * 1000)
          const updated = await opts.licenseStore.updateExpiry(subId, expiresAt.toISOString())
          if (updated) {
            fastify.log.info({ subscriptionId: subId, expiresAt: expiresAt.toISOString() }, 'License expiry updated from subscription renewal')
          }
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

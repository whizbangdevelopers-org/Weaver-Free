// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { parseLicenseKey } from '../license.js'
import { createCheckoutSession, createPortalSession } from '../services/stripe.js'
import type { LicenseStore } from '../storage/license-store.js'
import type { DashboardConfig } from '../config.js'

interface LicenseRouteOptions {
  config: DashboardConfig
  hmacSecret: string
  licenseStore: LicenseStore
  /** Map of product shortcodes to Stripe Price IDs */
  priceMap: Record<string, string>
  siteUrl: string
}

// Zod schemas ---------------------------------------------------------------

const activateBodySchema = z.object({
  key: z.string().min(1, 'License key is required'),
})

interface ActivateBody {
  key: string
}

const activateResponseSchema = z.object({
  tier: z.string(),
  expiresAt: z.string().nullable(),
  graceMode: z.boolean(),
  foundingMember: z.boolean(),
})

interface ActivateResponse {
  tier: string
  expiresAt: string | null
  graceMode: boolean
  foundingMember: boolean
}

const statusResponseSchema = z.object({
  tier: z.string(),
  expiresAt: z.string().nullable(),
  graceMode: z.boolean(),
  foundingMember: z.boolean(),
})

interface StatusResponse {
  tier: string
  expiresAt: string | null
  graceMode: boolean
  foundingMember: boolean
}

const checkoutBodySchema = z.object({
  product: z.enum(['weaver-solo', 'weaver-team', 'fabrick', 'fm-solo', 'fm-team', 'fm-fabrick']),
  email: z.string().email().optional(),
})

interface CheckoutBody {
  product: 'weaver-solo' | 'weaver-team' | 'fabrick' | 'fm-solo' | 'fm-team' | 'fm-fabrick'
  email?: string
}

const checkoutResponseSchema = z.object({
  url: z.string(),
})

interface CheckoutResponse {
  url: string
}

const portalBodySchema = z.object({
  customerId: z.string().min(1),
})

interface PortalBody {
  customerId: string
}

const portalResponseSchema = z.object({
  url: z.string(),
})

interface PortalResponse {
  url: string
}

const errorSchema = z.object({
  error: z.string(),
})

// Routes --------------------------------------------------------------------

export const licenseRoutes: FastifyPluginAsync<LicenseRouteOptions> = async (fastify, opts) => {

  // POST /api/license/activate — validate + activate a WVR-* key
  fastify.post<{ Body: ActivateBody; Reply: ActivateResponse | { error: string } }>('/activate', {
    schema: {
      body: activateBodySchema,
      response: {
        200: activateResponseSchema,
        400: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const result = parseLicenseKey(request.body.key, opts.hmacSecret)
      const record = opts.licenseStore.findByKey(request.body.key)

      return {
        tier: result.tier,
        expiresAt: result.expiry?.toISOString() ?? null,
        graceMode: result.graceMode,
        foundingMember: record?.foundingMember ?? false,
      }
    } catch {
      return reply.status(400).send({ error: 'Invalid license key' })
    }
  })

  // GET /api/license/status — current license from config
  fastify.get<{ Reply: StatusResponse }>('/status', {
    schema: {
      response: {
        200: statusResponseSchema,
      },
    },
  }, async () => {
    // Check license store for FM status (Stripe-purchased licenses persist the flag)
    const activeLicenses = opts.licenseStore.all().filter(r => !r.revokedAt)
    const foundingMember = activeLicenses.some(r => r.foundingMember)

    return {
      tier: opts.config.tier,
      expiresAt: opts.config.licenseExpiry?.toISOString() ?? null,
      graceMode: opts.config.licenseGraceMode,
      foundingMember,
    }
  })

  // POST /api/stripe/checkout — create a Stripe Checkout session
  fastify.post<{ Body: CheckoutBody; Reply: CheckoutResponse | { error: string } }>('/stripe/checkout', {
    schema: {
      body: checkoutBodySchema,
      response: {
        200: checkoutResponseSchema,
        400: errorSchema,
      },
    },
  }, async (request, reply) => {
    const priceId = opts.priceMap[request.body.product]
    if (!priceId) {
      return reply.status(400).send({ error: `Unknown product: ${request.body.product}` })
    }

    const isFm = request.body.product.startsWith('fm-')

    try {
      const url = await createCheckoutSession({
        priceId,
        successUrl: `${opts.siteUrl}/account/licenses?checkout=success`,
        cancelUrl: `${opts.siteUrl}/pricing?checkout=cancel`,
        customerEmail: request.body.email,
        metadata: {
          product: request.body.product,
          fm: isFm ? 'true' : 'false',
        },
      })
      return { url }
    } catch (err) {
      fastify.log.error(err, 'Failed to create Stripe checkout session')
      return reply.status(400).send({ error: 'Failed to create checkout session' })
    }
  })

  // POST /api/stripe/portal — create a Stripe Customer Portal session
  fastify.post<{ Body: PortalBody; Reply: PortalResponse | { error: string } }>('/stripe/portal', {
    schema: {
      body: portalBodySchema,
      response: {
        200: portalResponseSchema,
        400: errorSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const url = await createPortalSession(
        request.body.customerId,
        `${opts.siteUrl}/account`
      )
      return { url }
    } catch (err) {
      fastify.log.error(err, 'Failed to create Stripe portal session')
      return reply.status(400).send({ error: 'Failed to create portal session' })
    }
  })
}

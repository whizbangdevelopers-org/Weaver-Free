// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { parseLicenseKey } from '../license.js'
import { createCheckoutSession, createPortalSession } from '../services/stripe.js'
import { requireRole } from '../middleware/rbac.js'
import { ROLES } from '../constants/vocabularies.js'
import type { LicenseStore } from '../storage/license-store.js'
import type { DashboardConfig } from '../config.js'

interface LicenseRouteOptions {
  config: DashboardConfig
  // `hmacSecret` is gone. These routes only VERIFY keys, and verification material is
  // compiled into the build rather than passed in — a caller-supplied verifier is what let any
  // operator mint their own tier.
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
  /** Nodes this licence covers; null = unbounded. Surfaced so an operator can see what they bought. */
  nodes: z.number().nullable(),
})

interface StatusResponse {
  tier: string
  expiresAt: string | null
  graceMode: boolean
  foundingMember: boolean
  nodes: number | null
}

const checkoutBodySchema = z.object({
  product: z.enum(['weaver-solo', 'weaver-team', 'fabrick', 'fm-solo', 'fm-team', 'fm-fabrick']),
  email: z.string().email().optional(),
  /**
   * Nodes to purchase. Bounded at both ends deliberately: a floor of 1 because a zero-node licence
   * is not a thing anyone can mean, and a ceiling because this is an UNAUTHENTICATED-shaped public
   * checkout — an unbounded integer here is a quantity nobody typed reaching a payment provider.
   * Above the ceiling is a conversation, not a self-serve checkout.
   */
  nodes: z.number().int().min(1).max(100).optional(),
})

interface CheckoutBody {
  product: 'weaver-solo' | 'weaver-team' | 'fabrick' | 'fm-solo' | 'fm-team' | 'fm-fabrick'
  email?: string
  nodes?: number
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
      const result = parseLicenseKey(request.body.key)
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
      nodes: opts.config.licenseNodes,
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
        quantity: request.body.nodes,
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
  //
  // A Stripe portal session exposes invoices, billing address, card metadata and the ability to
  // CANCEL the subscription. `customerId` arrives in the request body, so before these two guards
  // the route would mint a portal for any `cus_` the caller could name: authentication proved who
  // was asking and nothing tied that to whose billing account was opened.
  //
  // Two guards, because neither alone is enough. Admin-only bounds who may ask at all; the
  // known-customer check bounds what they may ask for, so a mistyped or guessed id cannot reach
  // Stripe. Residual, stated rather than implied: an admin on the commerce host can still open a
  // portal for any customer THIS hub issued a licence to. Closing that needs a user→customer link
  // the licence store does not currently hold (records key on email, not user id) — worth adding
  // when accounts and licences are properly joined.
  fastify.post<{ Body: PortalBody; Reply: PortalResponse | { error: string } }>('/stripe/portal', {
    schema: {
      body: portalBodySchema,
      response: {
        200: portalResponseSchema,
        400: errorSchema,
        403: errorSchema,
        404: errorSchema,
      },
    },
    preHandler: [requireRole(ROLES.ADMIN)],
  }, async (request, reply) => {
    const { customerId } = request.body

    // 404, not 403: to a caller already authorised for this route, "we hold no licence for that
    // customer" is the honest answer and does not confirm the id exists anywhere else.
    if (opts.licenseStore.findByCustomer(customerId).length === 0) {
      return reply.status(404).send({ error: 'No licence found for that customer' })
    }

    try {
      const url = await createPortalSession(
        customerId,
        `${opts.siteUrl}/account`
      )
      return { url }
    } catch (err) {
      fastify.log.error(err, 'Failed to create Stripe portal session')
      return reply.status(400).send({ error: 'Failed to create portal session' })
    }
  })
}

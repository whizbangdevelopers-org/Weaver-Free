// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import Stripe from 'stripe'
// license generation not available in free repo
import { TIERS } from '../constants/vocabularies.js'

// ---------------------------------------------------------------------------
// Stripe product → tier mapping
// ---------------------------------------------------------------------------

/** Maps Stripe product IDs (set at config time) to internal tier codes. */
export interface StripeProductMap {
  soloProductId: string
  teamProductId: string
  fabrickProductId: string
}

const PRODUCT_TO_TIER: Record<string, typeof TIERS.SOLO | typeof TIERS.FABRICK> = {}

export function initProductMap(map: StripeProductMap): void {
  PRODUCT_TO_TIER[map.soloProductId] = TIERS.SOLO
  PRODUCT_TO_TIER[map.teamProductId] = TIERS.SOLO
  PRODUCT_TO_TIER[map.fabrickProductId] = TIERS.FABRICK
}

export function tierForProduct(productId: string): typeof TIERS.SOLO | typeof TIERS.FABRICK | null {
  return PRODUCT_TO_TIER[productId] ?? null
}

// ---------------------------------------------------------------------------
// Stripe client
// ---------------------------------------------------------------------------

let stripe: Stripe | null = null

export function initStripe(secretKey: string): Stripe {
  stripe = new Stripe(secretKey, { apiVersion: '2026-03-25.dahlia' })
  return stripe
}

export function getStripe(): Stripe {
  if (!stripe) throw new Error('Stripe not initialized — call initStripe() first')
  return stripe
}

// ---------------------------------------------------------------------------
// Checkout session creation
// ---------------------------------------------------------------------------

export interface CreateCheckoutParams {
  priceId: string
  successUrl: string
  cancelUrl: string
  customerEmail?: string
  /** Stripe metadata attached to the session — survives into the webhook payload. */
  metadata?: Record<string, string>
}

export async function createCheckoutSession(params: CreateCheckoutParams): Promise<string> {
  const s = getStripe()
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.customerEmail,
    metadata: params.metadata,
    subscription_data: {
      metadata: params.metadata,
    },
  })
  if (!session.url) throw new Error('Stripe did not return a checkout URL')
  return session.url
}

// ---------------------------------------------------------------------------
// Customer portal session
// ---------------------------------------------------------------------------

export async function createPortalSession(customerId: string, returnUrl: string): Promise<string> {
  const s = getStripe()
  const session = await s.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
  return session.url
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

export function constructWebhookEvent(
  payload: Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return getStripe().webhooks.constructEvent(payload, signature, webhookSecret)
}

// ---------------------------------------------------------------------------
// License key generation from Stripe subscription
// ---------------------------------------------------------------------------

export interface GeneratedLicense {
  key: string
  tier: typeof TIERS.SOLO | typeof TIERS.FABRICK
  customerId: string
  subscriptionId: string
  expiresAt: Date
}

/**
 * Generate a WVR-* license key from a completed Stripe checkout.
 * The key encodes the tier, expiry (subscription current_period_end), and
 * a truncated customer ID for traceability.
 */
export async function generateLicenseFromSubscription(
  subscriptionId: string,
  hmacSecret: string
): Promise<GeneratedLicense> {
  const s = getStripe()
  const response = await s.subscriptions.retrieve(subscriptionId, { expand: ['items.data.price.product'] })
  // Response<Subscription> wraps the subscription — access fields directly
  const sub = response as unknown as Stripe.Subscription

  // Resolve tier from the first line item's product
  const item = sub.items.data[0]
  if (!item) throw new Error('Subscription has no line items')

  const product = item.price.product
  const productId = typeof product === 'string' ? product : product.id
  const tier = tierForProduct(productId)
  if (!tier) throw new Error(`Unknown product ID: ${productId}`)

  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

  // Expiry = current_period_end (Stripe epoch seconds → JS Date)
  const expiresAt = new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000)

  // Truncate Stripe customer ID to 4 chars for license payload
  const shortCustId = customerId.replace('cus_', '').slice(0, 4).toUpperCase()

    expiry: expiresAt,
    customerId: shortCustId,
  })

  return { key, tier, customerId, subscriptionId, expiresAt }
}

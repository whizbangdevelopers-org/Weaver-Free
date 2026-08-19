// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// VENDORED from wbd-entitlement@bd8b407 — do not edit here.
// Edit upstream, re-run scripts/vendor-entitlement.ts. audit:entitlement-vendor fails on drift.

import Stripe from 'stripe'
import type {
  Entitlement,
  EntitlementSignal,
  EntitlementSource,
  EntitlementStatus,
} from '../port.js'

/**
 * Stripe implementation of the entitlement port.
 *
 * The only adapter, deliberately (ENT-4). A second one written speculatively would encode guesses
 * about semantics nobody has observed, and it is cheap to add later precisely because the port
 * exists.
 *
 * Everything Stripe-specific stops here: product→tier mapping, epoch-seconds dates, the status
 * vocabulary, the `cus_`/`sub_` prefixes. Nothing downstream of `Entitlement` knows Stripe exists.
 */

export interface StripeAdapterOptions {
  secretKey: string
  webhookSecret: string
  /**
   * Stripe product id → product tier name.
   *
   * Per-product config, not library config: which products exist and what they are called is the
   * thing that varies between Weaver and Qepton.
   */
  productToTier: Record<string, string>
  /**
   * Pinned Stripe API version.
   *
   * **Pin in code, never leave it to the account default.** The account default is set in a
   * dashboard, lives outside git, can be changed by anyone with access, and is invisible in a
   * diff — so a behaviour change arrives with no commit to blame. An explicit version is a
   * reviewable fact, and the test harness asserts its recorded fixtures were captured under this
   * same value.
   *
   * Stripe's release train puts breaking changes only in the twice-yearly flora-named major;
   * monthly releases are additive. So this moves on a schedule you choose.
   */
  //
  // Typed from the SDK CONSTRUCTOR rather than a named export. `Stripe.LatestApiVersion` exists in
  // 22.5 and not in 22.0, so naming it pinned this file to one SDK version and broke the first
  // consumer that had a slightly older one — a portability bug in a library whose whole job is to
  // be shared. Deriving it from `ConstructorParameters` asks the installed SDK what it accepts.
  apiVersion: NonNullable<ConstructorParameters<typeof Stripe>[1]>['apiVersion']
}

/**
 * Map Stripe's status vocabulary onto the port's three states.
 *
 * Stripe distinguishes nine; issuance needs to know whether the customer is entitled now, might be
 * shortly, or is finished. Collapsing here rather than downstream keeps one provider's state
 * machine out of the shared logic.
 *
 * `trialing` counts as active on purpose: a trial IS an entitlement, and a product that offers one
 * wants a key for it. `paused` counts as delinquent rather than ended, because it can resume.
 */
function mapStatus(status: Stripe.Subscription.Status): EntitlementStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'paused':
      return 'delinquent'
    case 'canceled':
    case 'incomplete_expired':
      return 'ended'
    default: {
      // A status Stripe adds later reaches here. Treat it as delinquent — the option that neither
      // issues nor revokes — rather than guessing. Refusing outright would break issuance for
      // every OTHER subscription on a vocabulary addition, and defaulting to 'active' would issue
      // on a state nobody has read the semantics of.
      return 'delinquent'
    }
  }
}

export class StripeEntitlementSource implements EntitlementSource {
  readonly provider = 'stripe'
  private readonly stripe: Stripe
  private readonly opts: StripeAdapterOptions

  constructor(opts: StripeAdapterOptions) {
    this.opts = opts
    this.stripe = new Stripe(opts.secretKey, { apiVersion: opts.apiVersion })
  }

  async fetch(subscriptionRef: string): Promise<Entitlement | null> {
    let sub: Stripe.Subscription
    try {
      sub = (await this.stripe.subscriptions.retrieve(subscriptionRef, {
        // `customer` is expanded so a renewal can carry the billing email. Without it the only
        // address available is the one on a checkout session, which exists on the FIRST event
        // and never again — so every renewal would record `email: null` and overwrite the
        // address the licence has to be delivered to.
        expand: ['items.data.price.product', 'customer'],
      })) as unknown as Stripe.Subscription
    } catch (err) {
      if (err instanceof Stripe.errors.StripeInvalidRequestError && err.statusCode === 404) {
        return null
      }
      throw err
    }

    const item = sub.items.data[0]
    if (!item) throw new Error(`Stripe subscription ${subscriptionRef} has no line items`)

    const product = item.price.product
    const productId = typeof product === 'string' ? product : product.id
    const tier = this.opts.productToTier[productId]
    if (!tier) throw new Error(`No tier mapped for Stripe product '${productId}'`)

    // Quantity comes from what was PURCHASED. Stripe cannot count nodes in an airgapped install,
    // so this is the number the customer paid for and the signature over it is what makes the
    // term enforceable at all.
    const quantity = typeof item.quantity === 'number' ? item.quantity : null

    // The billing period lives on the ITEM, not on the subscription.
    //
    // It moved there when Stripe began modelling subscriptions whose items can bill on different
    // cycles. Reading `sub.current_period_end` — where it used to be — yields `undefined`, and
    // `new Date(undefined * 1000)` is an Invalid Date that `encodeDate` used to encode as a key
    // expiring in 2102. The cast that made the old read typecheck is what hid it, so this reads
    // the typed field and lets the compiler enforce its existence.
    const periodEnd = item.current_period_end
    if (typeof periodEnd !== 'number') {
      throw new Error(`Stripe subscription ${subscriptionRef} item has no current_period_end`)
    }

    return {
      tier,
      quantity,
      paidThrough: new Date(periodEnd * 1000),
      status: mapStatus(sub.status),
      customerRef: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      subscriptionRef: sub.id,
      email: customerEmailOf(sub.customer),
      metadata: sub.metadata ?? undefined,
    }
  }

  /**
   * Verify a Stripe webhook and normalise it.
   *
   * The signature is computed over the exact bytes Stripe sent, so the caller must hand over the
   * RAW body — parsing or re-serialising it destroys the thing being verified. That constraint
   * belongs to the transport and is the one thing the product's route must get right.
   *
   * Throws on a bad signature rather than returning `ignored`, so a forged payload can never be
   * mistaken for an uninteresting one.
   */
  verifySignal(rawBody: Buffer, signature: string): EntitlementSignal {
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.opts.webhookSecret)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const subscriptionRef =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        if (!subscriptionRef) {
          return { kind: 'ignored', providerEvent: `${event.type} (no subscription)` }
        }
        return {
          kind: 'purchased',
          subscriptionRef,
          email: session.customer_email ?? session.customer_details?.email ?? null,
          metadata: session.metadata ?? undefined,
        }
      }

      case 'customer.subscription.updated':
      case 'invoice.paid':
        return { kind: 'changed', subscriptionRef: subscriptionRefOf(event) }

      case 'customer.subscription.deleted':
        return { kind: 'ended', subscriptionRef: subscriptionRefOf(event) }

      default:
        return { kind: 'ignored', providerEvent: event.type }
    }
  }
}

/** The billing email, when the customer was expanded and is not deleted. */
export function customerEmailOf(customer: Stripe.Subscription['customer']): string | null {
  if (typeof customer === 'string') return null // not expanded
  if (customer.deleted) return null
  return customer.email ?? null
}

/**
 * Resolve the subscription a webhook event is about.
 *
 * Dispatches on Stripe's own `object` discriminator rather than probing for a `subscription`
 * property, because the probe silently produced the WRONG ANSWER for `invoice.paid`: an Invoice
 * has no top-level `subscription` in current API versions, so the lookup fell through to
 * `obj.id` and returned the INVOICE id. `fetch()` then 404s on it and the handler reports
 * `skipped` — which is precisely the silent drop-to-Free the handler exists to prevent, reached
 * through the renewal path that fires on every billing cycle.
 *
 * A fallback that returns a plausible value of the wrong type is worse than no fallback: it
 * cannot be distinguished from success by any caller. So there is no general fallback now — an
 * unrecognised shape throws, and the caller decides.
 */
export function subscriptionRefOf(event: Stripe.Event): string {
  const obj = event.data.object as {
    object?: string
    id?: string
    subscription?: string | { id: string } | null
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null
  }

  // A subscription event's object IS the subscription.
  if (obj.object === 'subscription' && obj.id) return obj.id

  // An invoice points at its subscription through `parent.subscription_details`.
  if (obj.object === 'invoice') {
    const ref = obj.parent?.subscription_details?.subscription
    if (typeof ref === 'string') return ref
    if (ref && typeof ref === 'object') return ref.id
    throw new Error(`Stripe invoice ${obj.id ?? '<unknown>'} has no subscription — not a subscription invoice`)
  }

  // Any other object that names a subscription directly.
  if (typeof obj.subscription === 'string') return obj.subscription
  if (obj.subscription && typeof obj.subscription === 'object') return obj.subscription.id

  throw new Error(`Cannot determine subscription from Stripe event ${event.type}`)
}

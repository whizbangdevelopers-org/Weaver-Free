// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// VENDORED from wbd-entitlement@bd8b407 — do not edit here.
// Edit upstream, re-run scripts/vendor-entitlement.ts. audit:entitlement-vendor fails on drift.

/**
 * The entitlement port (ENT-4).
 *
 * Issuance consumes ONE narrow fact from a provider and owns every policy decision downstream of
 * it. The port carries entitlement; it never models payment. No invoices, refunds, tax, payment
 * methods, or dunning state — the moment it does it has become a billing system, and it will start
 * needing to be correct about things Stripe is already correct about.
 *
 * ## Why the narrow fact is the right dependency
 *
 * "This subscription is paid through date D" is unambiguous, independent of the dunning schedule,
 * and stable across API versions. A great deal of Stripe's actual behaviour — Smart Retries, the
 * retry schedule, whether terminal failure cancels or marks unpaid — is configured in a DASHBOARD
 * and appears in no API version, no OpenAPI spec, and no changelog. Depending on that behaviour
 * means depending on something no checker can see change. Depending on `paidThrough` does not.
 *
 * It is also what makes a second provider cheap and a fake honest: both have to produce this
 * struct and nothing else.
 */

/**
 * Subscription status, normalised across providers.
 *
 * Deliberately coarse. Stripe distinguishes `incomplete`, `incomplete_expired`, `trialing`,
 * `past_due`, `unpaid`, `paused`, `canceled`; mapping each one through to issuance policy would
 * bake one provider's state machine into the shared library. What issuance actually needs to know
 * is whether the customer is currently entitled, might be shortly, or is finished.
 */
export type EntitlementStatus =
  /** Paid and current. Issue. */
  | 'active'
  /** Payment is failing but the provider has not given up. Do not re-issue; do not revoke. */
  | 'delinquent'
  /** Over. Stop issuing; the key lapses on its own expiry. */
  | 'ended'

export interface Entitlement {
  /** Product tier name, already mapped out of the provider's product/price identifiers. */
  tier: string
  /**
   * Units granted — nodes for Weaver, devices for Qepton. `null` = unbounded.
   *
   * A provider cannot meter an airgapped install, so this comes from what was PURCHASED, and the
   * signature over it is what makes the term enforceable at all.
   */
  quantity: number | null
  /** End of the paid period. Becomes the licence expiry. */
  paidThrough: Date
  status: EntitlementStatus
  /** Provider's customer identifier. Opaque here. */
  customerRef: string
  /** Provider's subscription identifier. The idempotency key — see `handler.ts`. */
  subscriptionRef: string
  /** Where to deliver the key, when the provider knows. */
  email?: string | null
  /** Provider metadata carried through for the product to interpret (e.g. founding-member flags). */
  metadata?: Record<string, string>
}

/** A normalised provider event. */
export type EntitlementSignal =
  /** A new purchase completed. */
  | { kind: 'purchased'; subscriptionRef: string; email?: string | null; metadata?: Record<string, string> }
  /** An existing subscription changed — renewal, upgrade, quantity change. */
  | { kind: 'changed'; subscriptionRef: string }
  /** The subscription ended. */
  | { kind: 'ended'; subscriptionRef: string }
  /** A provider event this library does not act on. Carried so callers can log it. */
  | { kind: 'ignored'; providerEvent: string }

/**
 * A provider of entitlement facts.
 *
 * Two methods, and neither knows about HTTP. `verifySignal` takes bytes and a signature because
 * that is what every provider's webhook verification needs; the transport that obtained those
 * bytes is the product's business.
 */
export interface EntitlementSource {
  /** Provider name, for logs and for asserting a fake is not wired into production. */
  readonly provider: string

  /** Current entitlement for a subscription, or `null` if the provider has no such subscription. */
  fetch(subscriptionRef: string): Promise<Entitlement | null>

  /**
   * Verify a webhook payload and normalise it.
   *
   * MUST throw on a signature failure rather than returning `ignored`, so a forged payload cannot
   * be mistaken for an uninteresting one.
   */
  verifySignal(rawBody: Buffer, signature: string): EntitlementSignal
}

/** A licence this system has issued. */
export interface LicenseRecord {
  key: string
  tier: string
  quantity: number | null
  serial: string
  customerRef: string
  subscriptionRef: string
  expiresAt: string
  issuedAt: string
  email?: string | null
  metadata?: Record<string, string>
}

/**
 * Persistence for issued licences.
 *
 * An interface rather than an implementation because the store is where a product's existing
 * database lives. Weaver already has one; Qepton will have a different one.
 *
 * `findBySubscription` is not a convenience — it is the idempotency mechanism. See `handler.ts`.
 */
export interface LicenseStore {
  findBySubscription(subscriptionRef: string): Promise<LicenseRecord | null> | LicenseRecord | null
  save(record: LicenseRecord): Promise<void> | void
}

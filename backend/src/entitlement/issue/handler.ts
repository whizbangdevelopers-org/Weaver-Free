// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// VENDORED from wbd-entitlement@bd8b407 — do not edit here.
// Edit upstream, re-run scripts/vendor-entitlement.ts. audit:entitlement-vendor fails on drift.

import { decodePayload, splitKey } from '../format/payload.js'
import type { Issuer } from './issuer.js'
import type {
  Entitlement,
  EntitlementSignal,
  EntitlementSource,
  LicenseRecord,
  LicenseStore,
} from './port.js'

/**
 * Framework-free issuance logic.
 *
 * Everything the Weaver webhook route decided, minus everything about HTTP. The route keeps the
 * raw-body parsing, the logging, the audit trail, the email send and the 200 — all of which are
 * genuinely framework- and product-specific. What moves is the part that is neither: given a
 * verified signal, what should be issued?
 *
 * That split is not tidiness. A shared library that reaches for `fastify.log` or `request.ip`
 * cannot serve a product that is not Fastify, and Qepton is not.
 */

export type IssuanceOutcome =
  | { action: 'issued'; record: LicenseRecord; entitlement: Entitlement }
  | { action: 'reissued'; record: LicenseRecord; entitlement: Entitlement; previous: LicenseRecord }
  | { action: 'skipped'; reason: string; subscriptionRef?: string }

export interface HandlerDeps<TTier extends string> {
  source: EntitlementSource
  store: LicenseStore
  issuer: Issuer<TTier>
  /** Maps a port tier name onto the product's tier union. Throws for a tier it cannot mint. */
  toTier: (tier: string) => TTier
  /** Injectable for deterministic tests. */
  now?: () => Date
}

/**
 * Act on one verified signal.
 *
 * Returns an outcome rather than throwing for ordinary "nothing to do" cases, because a webhook
 * route must answer 200 to a signal it correctly declined to act on — a non-2xx tells the provider
 * to redeliver, and redelivering something we deliberately ignored is a retry loop.
 *
 * Genuine failures (provider unreachable, signing failure) DO throw, so the route can answer 5xx
 * and let the provider retry, which is the behaviour that actually helps.
 */
export async function handleSignal<TTier extends string>(
  signal: EntitlementSignal,
  deps: HandlerDeps<TTier>,
): Promise<IssuanceOutcome> {
  if (signal.kind === 'ignored') {
    return { action: 'skipped', reason: `provider event not acted on: ${signal.providerEvent}` }
  }

  if (signal.kind === 'ended') {
    // Deliberately a no-op on the key. Revocation is subtractive and there is no vendor→host
    // channel: the host reads a signed file and never phones home. A cancelled customer keeps
    // their tier until the key expires on its own, and pretending otherwise here would model a
    // capability the product does not have and hide a real exposure.
    return {
      action: 'skipped',
      reason: 'subscription ended — the issued key lapses at its own expiry; there is no revocation channel',
      subscriptionRef: signal.subscriptionRef,
    }
  }

  const existing = await deps.store.findBySubscription(signal.subscriptionRef)

  // IDEMPOTENCY, and the key choice here is worth reading twice.
  //
  // Providers deliver at least once. A redelivery carries a VALID signature — it is the same
  // request — so signature verification cannot distinguish it from the first, by design. Without
  // a guard, a retry mints a second key, stores a second record, and emails the customer a second
  // licence, all reported as success.
  //
  // Keyed on the SUBSCRIPTION, not on the provider's event id. Event-id idempotency is the
  // provider's standard advice, and here it would mean persisting every processed id forever to
  // answer a question the licence store already answers. One subscription has one current licence;
  // if we hold one, this purchase has been handled — and that remains true across a restart,
  // across a differently-numbered event for the same subscription, and with no new storage to
  // grow or prune.
  if (signal.kind === 'purchased' && existing) {
    return {
      action: 'skipped',
      reason: 'subscription already has a licence — not re-issuing',
      subscriptionRef: signal.subscriptionRef,
    }
  }

  const entitlement = await deps.source.fetch(signal.subscriptionRef)
  if (!entitlement) {
    return {
      action: 'skipped',
      reason: `provider ${deps.source.provider} has no subscription ${signal.subscriptionRef}`,
      subscriptionRef: signal.subscriptionRef,
    }
  }

  if (entitlement.status !== 'active') {
    // 'delinquent' is the interesting one: payment is failing but the provider has not given up.
    // Re-issuing would extend the licence on the strength of a payment that has not happened; but
    // there is also nothing to revoke, and the existing key expires on its own. Doing nothing is
    // both the safe answer and the correct one.
    return {
      action: 'skipped',
      reason: `entitlement status is '${entitlement.status}' — issuing only on 'active'`,
      subscriptionRef: signal.subscriptionRef,
    }
  }

  const now = deps.now?.() ?? new Date()
  const tier = deps.toTier(entitlement.tier)

  // RENEWAL MINTS A NEW KEY. This branch used to move a stored `expiresAt` forward and stop, which
  // is a write to a field nothing enforces: the expiry that decides a host's tier is encoded in
  // the SIGNED key the customer installed. A renewal that does not mint leaves them holding a key
  // that expires at the end of their FIRST period, and it keeps working only until the next
  // restart — surfacing as a paying customer silently dropping to Free.
  const key = deps.issuer.generateLicenseKey(tier, {
    expiry: entitlement.paidThrough,
    quantity: entitlement.quantity,
    customerId: shortCustomerRef(entitlement.customerRef),
    issued: now,
  })

  const record: LicenseRecord = {
    key,
    tier: entitlement.tier,
    quantity: entitlement.quantity,
    serial: extractSerial(key),
    customerRef: entitlement.customerRef,
    subscriptionRef: entitlement.subscriptionRef,
    expiresAt: entitlement.paidThrough.toISOString(),
    issuedAt: now.toISOString(),
    // A RENEWAL MUST NOT DESTROY WHAT THE PURCHASE CAPTURED. Both of these fields are written on
    // every issuance, and only the purchase event carries some of them — so a plain overwrite
    // silently erases the address the key has to be delivered to, and the founding-member flag
    // that decides what the customer is owed.
    email: firstEmail(entitlement.email, signalEmail(signal), existing?.email),
    metadata: mergeMetadata(existing?.metadata, signalMetadata(signal), entitlement.metadata),
  }

  // Key and expiry are replaced as ONE write. Storing them separately allows a crash between the
  // two to leave a record whose stated expiry does not match the key it sits next to, and the key
  // is the thing that decides the tier.
  await deps.store.save(record)

  return existing
    ? { action: 'reissued', record, entitlement, previous: existing }
    : { action: 'issued', record, entitlement }
}

function signalEmail(signal: EntitlementSignal): string | null {
  return signal.kind === 'purchased' ? (signal.email ?? null) : null
}

function signalMetadata(signal: EntitlementSignal): Record<string, string> | undefined {
  return signal.kind === 'purchased' ? signal.metadata : undefined
}

/**
 * First non-empty email, in order of freshness.
 *
 * The stored record is the LAST resort and the reason this exists: only a `purchased` signal
 * carries a checkout email, so on a renewal the first two sources can both be absent. Falling
 * back to what is already on file keeps a customer reachable across every subsequent cycle.
 */
export function firstEmail(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() !== '') return c
  }
  return null
}

/**
 * Merge metadata objects, later arguments winning, treating an EMPTY object as absent.
 *
 * The empty-object case is the whole point. This was `entitlement.metadata ?? signalMetadata()`,
 * which reads as a fallback and never falls through: Stripe always returns a metadata object and
 * returns `{}` when there is none, and `{}` is not nullish. So provider metadata — always
 * present, usually empty — permanently masked the checkout session's, and the founding-member
 * flag set at purchase was discarded on the very issuance that was supposed to record it.
 *
 * `??` cannot express "prefer a non-empty one"; only an explicit emptiness test can, which is why
 * this is a named function rather than a longer expression at the call site.
 */
export function mergeMetadata(
  ...sources: Array<Record<string, string> | undefined>
): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  for (const s of sources) {
    if (s) for (const [k, v] of Object.entries(s)) out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Squeeze a provider customer reference into the payload's 4-character field.
 *
 * Lossy and only ever for traceability — the authoritative customer reference lives in the store
 * record. Never treat the 4 characters in a key as identifying a customer on their own.
 */
export function shortCustomerRef(customerRef: string): string {
  const stripped = customerRef.replace(/^[a-z]+_/, '')
  return stripped.slice(0, 4).toUpperCase().padStart(4, '0')
}

/**
 * Pull the serial out of a minted key, so the store can index on it.
 *
 * Goes through `decodePayload` rather than slicing at a remembered offset. A hand-written
 * `payload.slice(13, 21)` is a second copy of the field layout, and the layout has already moved
 * once this week (ENT-5/6 widened it from 12 to 24). The next move would leave this silently
 * returning the wrong eight characters — no error, a plausible value, and a store indexed on
 * garbage.
 */
export function extractSerial(key: string): string {
  return decodePayload(splitKey(key).payload).serial
}

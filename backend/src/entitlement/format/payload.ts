// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// VENDORED from wbd-entitlement@bd8b407 — do not edit here.
// Edit upstream, re-run scripts/vendor-entitlement.ts. audit:entitlement-vendor fails on drift.

import { SIGNATURE_B32_LENGTH } from './base32.js'
import type { ProductProfile } from './profile.js'

/**
 * The signed payload.
 *
 *     version(1) + issued(4) + expiry(4) + customerId(4) + serial(8) + quantity(3) = 24
 *
 * All base36, uppercase, so the whole key stays transcription-safe.
 *
 * **This layout is fixed the moment a production key reaches a customer.** It is being set now
 * precisely because `ACCEPTED_PUBLIC_KEYS` is still empty and no key exists — ENT-1's whole timing
 * argument. Encode and decode are functions rather than inline slicing at the call sites so that
 * a later change is confined here.
 *
 * ## Why a version character (ENT-6)
 *
 * Without it, this is the LAST free format change: every subsequent field addition invalidates
 * every key in the field, because an old verifier rejects a longer payload on the regex and a new
 * one rejects a shorter. With it, a build can accept v1 and v2 simultaneously and a format change
 * becomes a rollout rather than a cutover — the same shape as the accepted-key SET, and for the
 * same reason.
 *
 * One character, and it is only free today.
 */

const EPOCH = new Date('2020-01-01T00:00:00Z').getTime()
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Sentinel meaning "no expiry". */
export const NO_EXPIRY = 'ZZZZ'

/**
 * Sentinel meaning "quantity not bounded by the licence".
 *
 * Deliberately explicit and deliberately NOT the default — see `encodePayload`.
 */
export const UNLIMITED_QUANTITY = 'ZZZ'

const W_VERSION = 1
const W_ISSUED = 4
const W_EXPIRY = 4
const W_CUSTOMER = 4
const W_SERIAL = 8
const W_QUANTITY = 3

/** Field offsets, derived so a width change cannot desync them from the slicing. */
const O_VERSION = 0
const O_ISSUED = O_VERSION + W_VERSION
const O_EXPIRY = O_ISSUED + W_ISSUED
const O_CUSTOMER = O_EXPIRY + W_EXPIRY
const O_SERIAL = O_CUSTOMER + W_CUSTOMER
const O_QUANTITY = O_SERIAL + W_SERIAL

/** Total payload width. Derived, never restated. */
export const PAYLOAD_LENGTH = O_QUANTITY + W_QUANTITY

/** The version this build MINTS. */
export const FORMAT_VERSION = '1'

/**
 * The versions this build can PARSE, newest first.
 *
 * An ordered set for the same reason `ACCEPTED_PUBLIC_KEYS` is: a format migration must be able to
 * ship acceptance before it ships minting, or the release strands everyone holding a v1 key.
 */
export const ACCEPTED_FORMAT_VERSIONS: readonly string[] = [FORMAT_VERSION]

export const SERIAL_LENGTH = W_SERIAL

/**
 * Encode a date as base36 days since 2020-01-01.
 *
 * Every rejection below is a case that would otherwise produce four characters which satisfy the
 * payload charset, sign correctly, and decode to a date nobody chose — so the caller receives a
 * VALID key granting a term they never issued. The guards mirror `encodeQuantity`'s, and for the
 * same stated reason: these are the arithmetic slips that silently WIDEN a grant.
 *
 * The non-finite case is the one that has actually happened. An `Invalid Date` reaches here as
 * `NaN`, and `NaN.toString(36).toUpperCase().padStart(4, '0')` is `'0NAN'` — which decodes to
 * **2102-08-30**, an effectively perpetual licence. It is reachable from any upstream date bug
 * (a provider field that moved, an absent response key) rather than from anything the caller did
 * visibly wrong, which is what makes throwing here the only reliable place to stop it.
 */
export function encodeDate(date: Date): string {
  const days = Math.floor((date.getTime() - EPOCH) / MS_PER_DAY)

  if (!Number.isFinite(days)) {
    throw new Error(
      `cannot encode a non-finite date (got '${date.toString()}') — an Invalid Date would ` +
        "encode to '0NAN' and decode to the year 2102, granting a perpetual licence",
    )
  }
  if (days < 0) {
    throw new Error(`date ${date.toISOString()} precedes the 2020-01-01 epoch and cannot be encoded`)
  }

  const encoded = days.toString(36).toUpperCase()
  if (encoded.length > W_EXPIRY) {
    throw new Error(`date ${date.toISOString()} exceeds the ${W_EXPIRY}-character field`)
  }
  if (encoded === NO_EXPIRY) {
    // A bounded date that encodes to the perpetual sentinel. Unreachable until ~6619, and guarded
    // for exactly the reason `encodeQuantity` guards its own sentinel rather than reasoning that
    // the value cannot arise: the failure is a widened grant, not a crash.
    throw new Error(`date ${date.toISOString()} encodes to the no-expiry sentinel`)
  }

  return encoded.padStart(W_EXPIRY, '0')
}

/** Decode a base36 day count. `ZZZZ` means "no expiry"; anything unparseable is `null`. */
export function decodeDate(encoded: string): Date | null {
  if (encoded === NO_EXPIRY) return null
  const days = parseInt(encoded, 36)
  if (Number.isNaN(days)) return null
  return new Date(EPOCH + days * MS_PER_DAY)
}

/**
 * Quantity: units this licence grants, with product-defined meaning.
 *
 * Generic on purpose. Weaver counts nodes (per-node Fabrick, Contract blocks); Qepton's commercial
 * licence already grants use on "the number of devices specified in the purchased license tier".
 * A field named for one product's noun could not serve the other, and the shared format cannot
 * encode one product's vocabulary (ENT-4's boundary, applied to the payload).
 *
 * `null` means unbounded and is encoded as an explicit sentinel.
 */
export function encodeQuantity(quantity: number | null): string {
  if (quantity === null) return UNLIMITED_QUANTITY
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error(`quantity must be a positive integer or null (unlimited), got ${quantity}`)
  }
  const encoded = quantity.toString(36).toUpperCase()
  if (encoded.length > W_QUANTITY) {
    throw new Error(`quantity ${quantity} exceeds the ${W_QUANTITY}-character field`)
  }
  if (encoded === UNLIMITED_QUANTITY) {
    // Unreachable for a positive integer, since ZZZ parses as 46655 and encodes back as 'ZZZ'.
    // Guarded anyway: a bounded licence that decodes as unlimited is the one arithmetic slip in
    // this file that silently WIDENS a grant.
    throw new Error('quantity encodes to the unlimited sentinel')
  }
  return encoded.padStart(W_QUANTITY, '0')
}

export function decodeQuantity(encoded: string): number | null {
  if (encoded === UNLIMITED_QUANTITY) return null
  const n = parseInt(encoded, 36)
  if (Number.isNaN(n) || n < 1) {
    throw new Error(`Invalid license key: corrupted quantity '${encoded}'`)
  }
  return n
}

export interface PayloadFields {
  version: string
  issued: Date | null
  expiry: Date | null
  customerId: string
  /** Unique per issued key. Distinguishes two otherwise-identical grants; keys a revocation list. */
  serial: string
  /** Units granted, product-defined. `null` = unbounded. */
  quantity: number | null
}

export interface EncodeInput {
  issued: Date
  expiry?: Date
  customerId?: string
  serial: string
  /**
   * Units granted. **Required, and there is no permissive default** — see the note below.
   * `null` means unbounded and must be passed deliberately.
   */
  quantity: number | null
}

/**
 * Build the payload segment.
 *
 * `quantity` is REQUIRED here rather than optional-with-a-default, and that is a deliberate
 * departure from how `expiry` works one field over. `expiry` is optional and its absence mints a
 * perpetual key — so the shortest possible call produces the most permissive credential, which is
 * backwards (Weaver G-licensing-2026-08-17). That hazard is documented in the issuer and kept only
 * because perpetual keys are a real product case.
 *
 * Repeating the shape for quantity would be the same bug twice, so it is not repeated: an omitted
 * quantity is a compile error, and the issuer's own default is 1 — the conservative reading, not
 * the generous one. Unlimited is reachable only by passing `null` on purpose.
 */
export function encodePayload(fields: EncodeInput): string {
  if (fields.serial.length !== W_SERIAL || !/^[A-Z0-9]+$/.test(fields.serial)) {
    throw new Error(`serial must be ${W_SERIAL} uppercase base36 characters, got '${fields.serial}'`)
  }
  const issued = encodeDate(fields.issued)
  const expiry = fields.expiry ? encodeDate(fields.expiry) : NO_EXPIRY
  const customerId = (fields.customerId ?? '0000')
    .padStart(W_CUSTOMER, '0')
    .slice(0, W_CUSTOMER)
    .toUpperCase()
  return `${FORMAT_VERSION}${issued}${expiry}${customerId}${fields.serial}${encodeQuantity(fields.quantity)}`
}

/**
 * Split a payload segment into its fields.
 *
 * Callers must only reach this AFTER signature verification — the payload is attacker-supplied
 * until then, and an unverified quantity is exactly the value an attacker wants read.
 */
export function decodePayload(payload: string): PayloadFields {
  const version = payload.slice(O_VERSION, O_ISSUED)
  if (!ACCEPTED_FORMAT_VERSIONS.includes(version)) {
    throw new Error(
      `Invalid license key: unsupported format version '${version}' ` +
        `(this build accepts ${ACCEPTED_FORMAT_VERSIONS.join(', ')})`,
    )
  }

  const issuedRaw = payload.slice(O_ISSUED, O_EXPIRY)
  const issued = decodeDate(issuedRaw)
  if (issuedRaw !== NO_EXPIRY && !issued) {
    throw new Error('Invalid license key: corrupted issue date')
  }

  return {
    version,
    issued,
    expiry: decodeDate(payload.slice(O_EXPIRY, O_CUSTOMER)),
    customerId: payload.slice(O_CUSTOMER, O_SERIAL),
    serial: payload.slice(O_SERIAL, O_QUANTITY),
    quantity: decodeQuantity(payload.slice(O_QUANTITY, PAYLOAD_LENGTH)),
  }
}

/**
 * The full-key regex for a product.
 *
 * Derived from the profile rather than written out, so a product that adds a tier code cannot
 * forget to widen its own regex — the class of drift `defineProfile` validates for the tier maps.
 */
export function keyRegex(profile: ProductProfile<string>): RegExp {
  const codes = Object.keys(profile.tierForCode).join('|')
  return new RegExp(
    `^${profile.prefix}-(${codes})-[A-Z0-9]{${PAYLOAD_LENGTH}}-[A-Z2-7]{${SIGNATURE_B32_LENGTH}}$`,
  )
}

/** The exact bytes that get signed: everything before the signature group. */
export function signedPrefix(profile: ProductProfile<string>, tierCode: string, payload: string): string {
  return `${profile.prefix}-${tierCode}-${payload}`
}

export interface KeyParts {
  tierCode: string
  payload: string
  signature: string
}

/** Split a syntactically valid key. Call `keyRegex` first — this does no validation. */
export function splitKey(key: string): KeyParts {
  const parts = key.split('-')
  return { tierCode: parts[1]!, payload: parts[2]!, signature: parts[3]! }
}

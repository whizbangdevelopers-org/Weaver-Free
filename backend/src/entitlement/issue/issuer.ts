// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// VENDORED from wbd-entitlement@0de98b8 — do not edit here.
// Edit upstream, re-run scripts/vendor-entitlement.ts. audit:entitlement-vendor fails on drift.

import { sign as cryptoSign, randomBytes, type KeyObject } from 'node:crypto'
import { base32Encode } from '../format/base32.js'
import { encodePayload, signedPrefix, SERIAL_LENGTH } from '../format/payload.js'
import type { ProductProfile } from '../format/profile.js'

/**
 * Licence minting. **Issuer-side only** — never ships.
 *
 * This file is why `src/issue/` is a separate subtree with a different licence: it is the only
 * place a private signing key is handled, and a shipped product build has no way to obtain one.
 * Nothing under `src/verify/` or `src/format/` may import from here — `audit:subtree-boundary`
 * enforces it, because the edge would put proprietary code inside an AGPL build and would be
 * invisible at review.
 *
 * The asymmetry that matters is operational, not structural. Signing and verifying deliberately
 * share `src/format/` so the two cannot drift on what constitutes the signed message.
 */

const BASE36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * A fresh serial: 8 uniformly random base36 characters, ~2.8e12 values.
 *
 * **Random rather than sequential, on purpose.** A counter would need issuer state (so two hubs,
 * or a hub restored from backup, could collide) and it would publish sales volume on the face of
 * every key — a customer holding serial `00000047` learns something WBD did not choose to tell
 * them. Random is stateless and leaks nothing.
 *
 * Rejection sampling rather than `% 36`: 256 is not a multiple of 36, so the naive modulo biases
 * the first four characters of the alphabet. The bias would be harmless here — nothing depends on
 * uniformity — but a biased generator that nobody notices is exactly the thing that gets copied
 * into a context where it does matter.
 */
export function generateSerial(): string {
  let out = ''
  while (out.length < SERIAL_LENGTH) {
    for (const byte of randomBytes(SERIAL_LENGTH)) {
      if (byte >= 252) continue // 252 = 36 * 7; the tail would bias toward '0'-'5'
      out += BASE36[byte % 36]
      if (out.length === SERIAL_LENGTH) break
    }
  }
  return out
}

export interface IssueOptions {
  /**
   * Expiry.
   *
   * Optional, and its absence encodes the `ZZZZ` sentinel that verification reads as "never
   * expires" — skipping the expiry and grace branch entirely. **So the shortest call mints the
   * most permissive credential**, and nothing in the signature distinguishes "deliberately
   * perpetual" from "forgot the expiry". Pass one unless you positively mean unbounded.
   * (Weaver G-licensing-2026-08-17: an optional argument whose absence widens a grant is
   * backwards. Kept optional only because perpetual keys are a real product case — and NOT
   * repeated for `quantity`, immediately below.)
   */
  expiry?: Date

  /**
   * Units granted, product-defined — nodes for Weaver, devices for Qepton.
   *
   * **Defaults to 1, never to unlimited.** This is the deliberate non-repeat of the `expiry`
   * hazard above: an omitted quantity yields the most restrictive grant, not the loosest, so a
   * forgotten argument under-grants (visible, a customer complains, you fix it) rather than
   * over-grants (invisible, and signed).
   *
   * Pass `null` to mint an unbounded grant. It has to be deliberate.
   */
  quantity?: number | null

  customerId?: string

  /** Injectable for deterministic tests. Defaults to a fresh random serial. */
  serial?: string

  /** Injectable for deterministic tests. Defaults to now. */
  issued?: Date
}

export interface Issuer<TTier extends string> {
  generateLicenseKey(tier: TTier, options?: IssueOptions): string
  /** Sign an already-built prefix. Exposed for tooling that constructs the prefix itself. */
  signPrefix(prefix: string): string
}

/**
 * Bind a profile and a private key into an issuer.
 *
 * One binding site, matching `createVerifier` — so "who can mint" is answerable by finding the
 * single call to this function, rather than by auditing every place a key might be passed.
 */
export function createIssuer<TTier extends string>(
  profile: ProductProfile<TTier>,
  privateKey: KeyObject,
): Issuer<TTier> {
  function signPrefix(prefix: string): string {
    return base32Encode(cryptoSign(null, Buffer.from(prefix, 'utf-8'), privateKey))
  }

  function generateLicenseKey(tier: TTier, options: IssueOptions = {}): string {
    const tierCode = profile.codeForTier[tier]
    if (!tierCode) {
      // Unreachable for a profile that passed defineProfile, which validates the round trip.
      // Kept as a guard rather than a cast: minting an unrepresentable tier must never silently
      // produce a key with `undefined` in it.
      throw new Error(`Cannot mint tier '${tier}': no code in codeForTier`)
    }

    const payload = encodePayload({
      issued: options.issued ?? new Date(),
      expiry: options.expiry,
      customerId: options.customerId,
      serial: options.serial ?? generateSerial(),
      // `?? 1` and not `?? null` — see IssueOptions.quantity.
      quantity: options.quantity === undefined ? 1 : options.quantity,
    })

    const prefix = signedPrefix(profile, tierCode, payload)
    return `${prefix}-${signPrefix(prefix)}`
  }

  return { generateLicenseKey, signPrefix }
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * Licence signing primitives — now a thin binding over the vendored `wbd-entitlement`.
 *
 * The implementation moved to `entitlement/` so Weaver, Qepton and later products share one
 * key mechanism instead of three. This file survives as the binding point and to keep the import
 * path stable for existing callers; the reasoning that used to live here now lives upstream, where
 * it applies to every product.
 *
 * **The invariant is unchanged and is the whole point.** The key used to carry a 4-character HMAC
 * checksum. HMAC is symmetric, so the value that VALIDATED a key was the value that MINTED one —
 * and the host took it from the operator, who is the party the licence restricts. Validation and
 * minting were the same act, available to the same party, and any operator could mint any tier.
 *
 * The primitive is asymmetric now: the hub holds a private key and signs; the product holds only
 * public keys and can verify but not mint. And the accepted set arrives from a GENERATED module
 * built from a manifest at build time — never from configuration, because verification material the
 * restricted party supplies is not verification. `audit:authority-binding` enforces that.
 */

import type { KeyObject } from 'node:crypto'
import { createIssuer } from './entitlement/issue/issuer.js'
import { WEAVER_PROFILE } from './license-profile.js'

export { base32Encode, base32Decode, SIGNATURE_BYTES, SIGNATURE_B32_LENGTH } from './entitlement/format/base32.js'

/**
 * Public keys this build accepts, **newest first**.
 *
 * Generated from `backend/src/license-authority.json`, not written by hand — a rotation is then a
 * reviewable state of one file rather than a sequence executed from memory across two releases.
 *
 * Empty until the production keypair ceremony has run, which means **every key fails to verify and
 * the host resolves to Free** — the fail-closed direction, asserted by a test rather than assumed.
 * Do not "temporarily" accept an unverified key to get past it.
 */
export { ACCEPTED_PUBLIC_KEYS, CHANNEL, IS_RELEASE } from './generated/license-authority.js'

/**
 * Sign a licence prefix. **Issuer-side only** — the hub holds the private key.
 *
 * Kept as a free function because that is how callers and tests already use it; it binds a
 * one-shot issuer around the supplied key. A shipped build has no private key to pass, which is
 * the asymmetry that matters and it is operational rather than structural.
 */
export function signLicensePrefix(signedPrefix: string, privateKey: KeyObject): string {
  return createIssuer(WEAVER_PROFILE, privateKey).signPrefix(signedPrefix)
}

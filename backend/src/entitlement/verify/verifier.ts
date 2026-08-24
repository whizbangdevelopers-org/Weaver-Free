// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// VENDORED from wbd-entitlement@0de98b8 — do not edit here.
// Edit upstream, re-run scripts/vendor-entitlement.ts. audit:entitlement-vendor fails on drift.

import { createPublicKey, verify as cryptoVerify, type KeyObject } from 'node:crypto'
import { base32Decode, SIGNATURE_BYTES, SIGNATURE_B32_LENGTH } from '../format/base32.js'
import { decodePayload, keyRegex, signedPrefix, splitKey } from '../format/payload.js'
import { graceDaysOf, type ProductProfile } from '../format/profile.js'

/**
 * Licence verification.
 *
 * **There is no secret here, and that absence is the fix.** The scheme this replaced used a
 * symmetric HMAC, so the value that VALIDATED a key was the value that MINTED one — and the host
 * took it from the operator, who is the party the licence restricts. Minting and validating were
 * the same act, available to the same party, and any operator could issue themselves any tier.
 *
 * Ed25519 alone would not have fixed that. It changes nothing if the verification material still
 * arrives from configuration: an operator simply substitutes their own keypair and mints again.
 * **Verification material the restricted party supplies is not verification.**
 *
 * Hence the factory. A product binds its accepted keys ONCE, at module scope, from a build-time
 * constant — and that single binding site is what an auditor can check. There is deliberately no
 * ambient default and no per-call key argument: a default would let a call site verify against
 * nothing by omission, and a per-call argument would spread the surface an auditor has to cover
 * across every caller.
 *
 * The library takes keys as a parameter because it is product-agnostic and cannot hold any
 * product's constant. The "never from configuration" invariant therefore lives in the PRODUCT,
 * on the product's own constant, enforced there. That is a real boundary and it must not be
 * eroded into "the product passes whatever it likes".
 */

export interface LicenseResult<TTier extends string> {
  tier: TTier
  expiry: Date | null
  graceMode: boolean
  customerId: string
  /** Unique per issued key. Keys a revocation list; distinguishes otherwise-identical grants. */
  serial: string
  /**
   * Units granted, product-defined — nodes for Weaver, devices for Qepton. `null` = unbounded.
   *
   * **Returned, never enforced here.** Enforcing it means knowing what a unit IS, which is the
   * product's business and not this library's. A product that ignores this field has an
   * unenforced licence term, and that is the product's bug — the signature over it is what makes
   * the term enforceable at all, since a provider like Stripe cannot meter an airgapped install.
   */
  quantity: number | null
  /** Payload format version this key was minted under. */
  version: string
}

export interface Verifier<TTier extends string> {
  /** Verify a raw signature against the bound accepted set. */
  verifySignature(signedMessage: string, signatureB32: string): boolean
  /** Parse, verify and resolve a full licence key. Throws on malformed or unverifiable input. */
  parseLicenseKey(key: string, now?: Date): LicenseResult<TTier>
  /** How many keys this build trusts. Zero means nothing can verify — the fail-closed state. */
  readonly acceptedKeyCount: number
}

/** Build a verifying KeyObject from a base64url raw Ed25519 public key. */
function publicKeyFromRaw(base64url: string): KeyObject | null {
  try {
    return createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: base64url }, format: 'jwk' })
  } catch {
    return null
  }
}

/**
 * Bind a profile and an accepted-key set into a verifier.
 *
 * `acceptedKeys` is an ordered SET, newest first, rather than a single key — because rotation must
 * not invalidate keys already in customers' hands. The sequence is: ship the next public key →
 * start signing with the new private key → drop the old public key only once every key signed
 * under it has expired. **Adding always ships before signing switches**; a release that does both
 * at once strands anyone who has not upgraded.
 *
 * An empty set verifies nothing, so `parseLicenseKey` THROWS for every key — it does not return
 * the lapsed tier. The distinction matters to anyone wiring a new product: resolving to a tier is
 * something this function does only for a key whose signature it has already checked, and a caller
 * that expects a value here will crash on the first licence it sees. Falling back to a free or
 * lapsed tier is the PRODUCT's decision, made in its own catch block, and every caller must have
 * one. That is the correct state before a production keypair exists, and it is fail-closed by
 * construction.
 *
 * (This paragraph previously claimed the opposite. It described behaviour the function has never
 * had, in the file a second product reads while wiring itself — the failure mode being a caller
 * written without a catch, which works perfectly until a customer installs a key.)
 */
export function createVerifier<TTier extends string>(
  profile: ProductProfile<TTier>,
  acceptedKeys: readonly string[],
): Verifier<TTier> {
  const regex = keyRegex(profile)
  const graceMs = graceDaysOf(profile) * 24 * 60 * 60 * 1000

  function verifySignature(signedMessage: string, signatureB32: string): boolean {
    if (signatureB32.length !== SIGNATURE_B32_LENGTH) return false

    const signature = base32Decode(signatureB32)
    if (!signature || signature.length !== SIGNATURE_BYTES) return false

    const message = Buffer.from(signedMessage, 'utf-8')

    // An empty accepted set verifies nothing. Stated explicitly because the loop would return
    // false anyway: a reader must not have to infer fail-closed behaviour from an absent iteration.
    for (const raw of acceptedKeys) {
      const key = publicKeyFromRaw(raw)
      if (!key) continue
      try {
        if (cryptoVerify(null, message, key, signature)) return true
      } catch {
        // A key that cannot be used to verify is treated as no match, never as a match.
        continue
      }
    }
    return false
  }

  function parseLicenseKey(key: string, now: Date = new Date()): LicenseResult<TTier> {
    if (!regex.test(key)) {
      throw new Error(`Invalid license key format: key must match ${regex.source}`)
    }

    const { tierCode, payload, signature } = splitKey(key)

    // Verify BEFORE reading anything out of the payload. The payload is attacker-supplied until
    // this passes, and an unverified tier is exactly the value an attacker wants read.
    if (!verifySignature(signedPrefix(profile, tierCode, payload), signature)) {
      throw new Error('Invalid license key: signature verification failed')
    }

    const tier = profile.tierForCode[tierCode]
    if (!tier) {
      throw new Error(`Invalid license key: unknown tier code '${tierCode}'`)
    }

    const { expiry, customerId, serial, quantity, version } = decodePayload(payload)
    const rest = { expiry, customerId, serial, quantity, version }

    if (expiry && now > expiry) {
      if (now.getTime() <= expiry.getTime() + graceMs) {
        // Within grace — keep the tier, flag it.
        return { tier, graceMode: true, ...rest }
      }
      // Beyond grace — the product's lapsed tier. For Weaver that is Free, deliberately: a lapsed
      // customer keeps real access to their own workloads rather than being moved onto demo data.
      //
      // `quantity` is carried through UNCHANGED rather than reset. A lapsed 40-node Fabrick licence
      // is a Free licence that still describes 40 nodes, and the product decides what Free permits.
      // Rewriting it here would be this library making a tier-policy decision, which is exactly the
      // boundary it does not cross.
      return { tier: profile.lapsedTier, graceMode: false, ...rest }
    }

    return { tier, graceMode: false, ...rest }
  }

  return { verifySignature, parseLicenseKey, acceptedKeyCount: acceptedKeys.length }
}

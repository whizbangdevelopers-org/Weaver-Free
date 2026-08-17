// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { createPublicKey, sign as cryptoSign, verify as cryptoVerify, type KeyObject } from 'node:crypto'

/**
 * Licence-key signing primitives.
 *
 * The key used to carry a 4-character HMAC checksum. HMAC is symmetric, so the value that
 * VALIDATED a key was the value that MINTED one — and the host took that value from the operator
 * (`services.weaver.licenseHmacSecret`, `LICENSE_HMAC_SECRET`). Validation and minting were
 * therefore the same act, available to the same party, and any operator could mint any tier.
 *
 * The primitive here is asymmetric: the hub holds a private key and signs; the product holds only
 * public keys and can verify but not mint.
 *
 * **The primitive is the smaller half of the fix.** Ed25519 changes nothing on its own if the
 * verification material still arrives from configuration — an operator would simply substitute
 * their own keypair and mint again. That is why `ACCEPTED_PUBLIC_KEYS` below is a module constant
 * and why nothing in this file reads `process.env`. Verification material the restricted party
 * supplies is not verification.
 */

/** Raw Ed25519 signature length, in bytes. */
export const SIGNATURE_BYTES = 64

/** Base32 length of a 64-byte signature: ceil(64 * 8 / 5). */
export const SIGNATURE_B32_LENGTH = 103

/**
 * Public keys this build accepts, base64url-encoded raw Ed25519 (32 bytes), **newest first**.
 *
 * An ordered SET rather than a single key, because rotation must not invalidate keys already in
 * customers' hands. The sequence is: add the next public key and ship it → start signing with the
 * new private key → remove the old public key only once every key signed under it has expired.
 * Adding always ships before signing switches; a release that does both at once strands anyone who
 * has not upgraded.
 *
 * Empty until the production keypair is generated and its private half is placed under encrypted
 * secret storage. Empty means **every key fails to verify and the host resolves
 * to Free** — the fail-closed direction, and it is asserted by a test rather than left to be
 * assumed. Do not "temporarily" accept an unverified key to get past this.
 */
export const ACCEPTED_PUBLIC_KEYS: readonly string[] = []

const RFC4648 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Encode bytes as unpadded uppercase RFC 4648 base32. */
export function base32Encode(bytes: Uint8Array): string {
  let out = ''
  let acc = 0
  let bits = 0
  for (const byte of bytes) {
    acc = (acc << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      out += RFC4648[(acc >> bits) & 31]
    }
  }
  if (bits > 0) out += RFC4648[(acc << (5 - bits)) & 31]
  return out
}

/**
 * Decode unpadded uppercase RFC 4648 base32.
 *
 * Returns `null` rather than throwing on any character outside the alphabet: a malformed signature
 * is an ordinary invalid key, not an exceptional condition, and the caller already distinguishes
 * "invalid" from "absent".
 */
export function base32Decode(text: string): Uint8Array | null {
  const out: number[] = []
  let acc = 0
  let bits = 0
  for (const ch of text) {
    const idx = RFC4648.indexOf(ch)
    if (idx < 0) return null
    acc = (acc << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out.push((acc >> bits) & 0xff)
    }
  }
  return Uint8Array.from(out)
}

/** Build a verifying KeyObject from a base64url raw Ed25519 public key. */
function publicKeyFromRaw(base64url: string): KeyObject | null {
  try {
    return createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: base64url },
      format: 'jwk',
    })
  } catch {
    return null
  }
}

/**
 * Verify a signed licence prefix against the accepted public keys.
 *
 * `acceptedKeys` exists so unit tests can mint and verify with an ephemeral keypair without the
 * test keypair being trusted by shipped builds. **It is not a configuration seam.** The runtime
 * path never passes it — `parseLicenseKey` defaults to `ACCEPTED_PUBLIC_KEYS`, nothing here reads
 * the environment, and an auditor asserts that no verification material reaches this module from
 * config. Substituting the set requires editing and rebuilding the
 * source, at which point the constant itself is equally editable — so the parameter widens nothing
 * that matters. The boundary that matters is "never from configuration", not "never a parameter".
 */
export function verifyLicenseSignature(
  signedPrefix: string,
  signatureB32: string,
  acceptedKeys: readonly string[] = ACCEPTED_PUBLIC_KEYS,
): boolean {
  if (signatureB32.length !== SIGNATURE_B32_LENGTH) return false

  const signature = base32Decode(signatureB32)
  if (!signature || signature.length !== SIGNATURE_BYTES) return false

  const message = Buffer.from(signedPrefix, 'utf-8')

  // An empty accepted set verifies nothing. Stated explicitly because the loop below would return
  // false anyway: a reader must not have to infer the fail-closed behaviour from an absent iteration.
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

/**
 * Sign a licence prefix. **Issuer-side only** — the hub holds the private key.
 *
 * This is deliberately in the same module as verification so the two cannot drift on what
 * constitutes the signed message. The asymmetry that matters is operational, not structural: a
 * shipped build has no private key to pass.
 */
export function signLicensePrefix(signedPrefix: string, privateKey: KeyObject): string {
  const signature = cryptoSign(null, Buffer.from(signedPrefix, 'utf-8'), privateKey)
  return base32Encode(signature)
}

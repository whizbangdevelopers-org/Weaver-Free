// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// VENDORED from wbd-entitlement@0de98b8 — do not edit here.
// Edit upstream, re-run scripts/vendor-entitlement.ts. audit:entitlement-vendor fails on drift.

/**
 * Unpadded uppercase RFC 4648 base32.
 *
 * Chosen so a whole licence key stays uppercase and transcription-safe — someone reads it off an
 * invoice or types it from an email. That property is why the signature is base32 rather than the
 * more compact base64url, and it is worth preserving in any future format change.
 */

/** Raw Ed25519 signature length, in bytes. */
export const SIGNATURE_BYTES = 64

/** Base32 length of a 64-byte signature: ceil(64 * 8 / 5). */
export const SIGNATURE_B32_LENGTH = 103

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
 * Decode unpadded uppercase RFC 4648 base32, rejecting non-canonical input.
 *
 * Returns `null` rather than throwing on any character outside the alphabet: a malformed
 * signature is an ordinary invalid key, not an exceptional condition, and callers already
 * distinguish "invalid" from "absent". A non-canonical encoding is rejected the same way.
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

  // THE LEFTOVER BITS OF THE FINAL CHARACTER MUST BE ZERO — RFC 4648 requires it, and without the
  // check the encoding is many-to-one.
  //
  // A length that is not a whole number of bytes leaves 1-7 bits over. A 103-character signature
  // carries 515 bits for a 512-bit value, so three bits were unconstrained and EIGHT distinct
  // strings decoded to the same signature: one issued licence had eight textually different forms
  // that every verifier accepted.
  //
  // Signature checking never cared, because it compares decoded bytes. What this protects is
  // anything treating the key STRING as an identity — a revocation list, a redemption record, a
  // duplicate check. Each is bypassed by editing the last character, and none would look wrong.
  // `serial` exists to key exactly such a list, so this closes before one is built rather than
  // after keys are in the field, when the format can no longer change.
  if (bits > 0 && (acc & ((1 << bits) - 1)) !== 0) return null

  return Uint8Array.from(out)
}

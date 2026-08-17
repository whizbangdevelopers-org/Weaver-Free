// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { type KeyObject } from 'node:crypto'
import {
  ACCEPTED_PUBLIC_KEYS,
  SIGNATURE_B32_LENGTH,
  signLicensePrefix,
  verifyLicenseSignature,
} from './license-signing.js'
import { TIERS, TIER_ORDER, type TierName } from './constants/vocabularies.js'

export type Tier = TierName
export { TIER_ORDER }

const TIER_CODE_MAP: Record<string, Tier> = {
  FRE: TIERS.FREE,
  WVS: TIERS.SOLO,  // Weaver Solo
  WVT: TIERS.TEAM,  // Weaver Team (distinct tier — Solo/Team code split pulled forward from v2.2)
  FAB: TIERS.FABRICK, // Fabrick
  // Legacy codes — still accepted for backward compatibility
  PRE: TIERS.SOLO,
  ENT: TIERS.FABRICK,
}

/**
 * `WVR-<tier>-<12 base36>-<103 base32 signature>`.
 *
 * The trailing group was `[A-Z0-9]{4}` — a 4-character HMAC checksum, 16 bits, brute-forceable
 * locally with no rate limit even by someone who did not already hold the secret. It is
 * now a raw Ed25519 signature in unpadded RFC 4648 base32, which keeps the whole key uppercase and
 * transcription-safe exactly as before; only the length changes, so every transport the key travels
 * through (`LICENSE_KEY`, `LICENSE_KEY_FILE`, the NixOS module option, the Docker entrypoints, the
 * harness) is unaffected.
 */
const KEY_REGEX = new RegExp(
  `^WVR-(FRE|WVS|WVT|FAB|PRE|ENT)-[A-Z0-9]{12}-[A-Z2-7]{${SIGNATURE_B32_LENGTH}}$`,
)

/** Number of days after expiry during which the license remains active in grace mode */
const GRACE_PERIOD_DAYS = 30

export interface LicenseResult {
  tier: Tier
  expiry: Date | null
  graceMode: boolean
  customerId: string | null
}

/**
 * Encode a date as a 4-char base36 string representing days since epoch (2020-01-01).
 * Returns 'ZZZZ' for "no expiry" sentinel.
 */
const EPOCH = new Date('2020-01-01T00:00:00Z').getTime()

export function encodeDateToBase36(date: Date): string {
  const days = Math.floor((date.getTime() - EPOCH) / (24 * 60 * 60 * 1000))
  return days.toString(36).toUpperCase().padStart(4, '0')
}

export function decodeDateFromBase36(encoded: string): Date | null {
  if (encoded === 'ZZZZ') return null
  const days = parseInt(encoded, 36)
  if (isNaN(days)) return null
  return new Date(EPOCH + days * 24 * 60 * 60 * 1000)
}

/**
 * Parse and validate a license key.
 *
 * Key format: WVR-<tier>-<payload>-<signature>
 * - tier: FRE | WVS | WVT | FAB (new codes) or PRE | ENT (legacy, still accepted)
 * - payload: 12 chars base36 — issueDate(4) + expiry(4) + customerId(4)
 * - signature: Ed25519 over `WVR-<tier>-<payload>`, unpadded base32 (103 chars)
 *
 * **There is no secret parameter, and that absence is the fix.** This function used to take the
 * HMAC secret the caller had resolved from `LICENSE_HMAC_SECRET` / the NixOS module option — i.e.
 * from the operator, who is the party the licence restricts. Because HMAC is symmetric, holding
 * that value was the ability to mint, so any operator could issue themselves any tier. Verification
 * now uses public keys compiled into the build (`ACCEPTED_PUBLIC_KEYS`), which a caller cannot
 * supply and an operator cannot substitute without rebuilding from source.
 *
 * The signed message is the prefix, which contains both the tier and the payload — so altering
 * either invalidates the signature, and a signature lifted from one key does not transfer to
 * another.
 *
 * Returns the parsed tier and expiry. Handles grace period logic:
 * - If expired within 30 days: tier stays, graceMode = true
 * - If expired beyond 30 days: tier = free, graceMode = false
 *
 * (That last line read `tier = demo` until 2026-08-16, against code that has always returned
 * FREE — and the inline comment at the return says why FREE is deliberate: a lapsed customer
 * keeps real access to their own workloads, they do not get moved onto demo data.)
 *
 * `now` is injectable because expiry and grace are the whole point of this function and both are
 * time-dependent. Resolution happens on every re-read of the key file, not only at start-up, so
 * "the same key parsed later gives a different tier" is a behaviour with its own tests rather
 * than an implementation detail.
 */
export function parseLicenseKey(
  key: string,
  now: Date = new Date(),
  acceptedKeys: readonly string[] = ACCEPTED_PUBLIC_KEYS,
): LicenseResult {
  if (!KEY_REGEX.test(key)) {
    throw new Error(`Invalid license key format: key must match ${KEY_REGEX.source}`)
  }

  const parts = key.split('-')
  // parts: ['WVR', tierCode, payload, signature]
  const tierCode = parts[1]
  const payload = parts[2]
  const signature = parts[3]

  // Verify the signature BEFORE reading anything out of the payload. The payload is attacker-
  // supplied until this passes, and an unverified tier is exactly the value an attacker wants read.
  const prefix = `WVR-${tierCode}-${payload}`
  if (!verifyLicenseSignature(prefix, signature, acceptedKeys)) {
    throw new Error('Invalid license key: signature verification failed')
  }

  // Extract tier
  const tier = TIER_CODE_MAP[tierCode]
  if (!tier) {
    throw new Error(`Invalid license key: unknown tier code '${tierCode}'`)
  }

  // Decode payload: issueDate(4) + expiry(4) + customerId(4)
  const issueDateEncoded = payload.slice(0, 4)
  const expiryEncoded = payload.slice(4, 8)
  const customerIdEncoded = payload.slice(8, 12)

  // Decode expiry
  const expiry = decodeDateFromBase36(expiryEncoded)

  // Decode issue date (for validation, not currently returned)
  const issueDate = decodeDateFromBase36(issueDateEncoded)
  if (issueDateEncoded !== 'ZZZZ' && !issueDate) {
    throw new Error('Invalid license key: corrupted issue date')
  }

  // Customer ID
  const customerId = customerIdEncoded

  // Check expiry and grace period
  if (expiry) {
    if (now > expiry) {
      const graceCutoff = new Date(expiry.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
      if (now <= graceCutoff) {
        // Within grace period — keep tier but flag grace mode
        return { tier, expiry, graceMode: true, customerId }
      }
      // Beyond grace period — downgrade to free (keeps real VM access, not demo data)
      return { tier: TIERS.FREE, expiry, graceMode: false, customerId }
    }
  }

  return { tier, expiry, graceMode: false, customerId }
}

/**
 * Mint a licence key. **Issuer-side only** — requires the private signing key, which a shipped
 * build does not have. Called by the Stripe webhook path and by `scripts/generate-license.ts`;
 * never reimplement the payload or the signature elsewhere, or a test key stops being
 * byte-identical to a real one and every harness result becomes suspect.
 *
 * `expiry` is optional and its absence encodes the `ZZZZ` sentinel, which `parseLicenseKey` reads
 * as "never expires" — skipping the expiry and grace branch entirely. So the SHORTEST call mints
 * the most permissive possible credential, and nothing in the signature distinguishes "deliberately
 * perpetual" from "forgot the expiry". Pass an expiry unless you positively mean unbounded.
 * (G-licensing-2026-08-17: an optional argument whose absence widens a grant is backwards.)
 */
export function generateLicenseKey(
  tier: typeof TIERS.FREE | typeof TIERS.SOLO | typeof TIERS.TEAM | typeof TIERS.FABRICK,
  privateKey: KeyObject,
  options?: { expiry?: Date; customerId?: string }
): string {
  const tierCode = { [TIERS.FREE]: 'FRE', [TIERS.SOLO]: 'WVS', [TIERS.TEAM]: 'WVT', [TIERS.FABRICK]: 'FAB' }[tier]
  const issueDate = encodeDateToBase36(new Date())
  const expiryEncoded = options?.expiry ? encodeDateToBase36(options.expiry) : 'ZZZZ'
  const customerId = (options?.customerId ?? '0000').padStart(4, '0').slice(0, 4).toUpperCase()
  const payload = `${issueDate}${expiryEncoded}${customerId}`
  const prefix = `WVR-${tierCode}-${payload}`
  return `${prefix}-${signLicensePrefix(prefix, privateKey)}`
}

/**
 * Guard that throws a 403-style error if the current tier is below the minimum.
 */
export function requireTier(config: { tier: Tier }, minimum: Tier): void {
  if (TIER_ORDER[config.tier] < TIER_ORDER[minimum]) {
    throw Object.assign(
      new Error(`This feature requires ${minimum} tier or higher (current: ${config.tier})`),
      { statusCode: 403 }
    )
  }
}

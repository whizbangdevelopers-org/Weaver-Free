// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { createHmac } from 'node:crypto'
import { TIERS, TIER_ORDER, type TierName } from './constants/vocabularies.js'

export type Tier = TierName
export { TIER_ORDER }

const TIER_CODE_MAP: Record<string, Tier> = {
  FRE: TIERS.FREE,
  WVS: TIERS.WEAVER,  // Weaver Solo
  WVT: TIERS.WEAVER,  // Weaver Team (same internal tier)
  FAB: TIERS.FABRICK, // Fabrick
  // Legacy codes — still accepted for backward compatibility
  PRE: TIERS.WEAVER,
  ENT: TIERS.FABRICK,
}

const KEY_REGEX = /^WVR-(FRE|WVS|WVT|FAB|PRE|ENT)-[A-Z0-9]{12}-[A-Z0-9]{4}$/

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
 * Compute the HMAC-SHA256 checksum for a key prefix.
 * Takes the first 4 characters of the hex digest, uppercased.
 */
export function computeChecksum(prefix: string, hmacSecret: string): string {
  const hmac = createHmac('sha256', hmacSecret)
  hmac.update(prefix)
  return hmac.digest('hex').slice(0, 4).toUpperCase()
}

/**
 * Parse and validate a license key.
 *
 * Key format: WVR-<tier>-<payload>-<checksum>
 * - tier: FRE | WVS | WVT | FAB (new codes) or PRE | ENT (legacy, still accepted)
 * - payload: 12 chars base36 — issueDate(4) + expiry(4) + customerId(4)
 * - checksum: 4-char HMAC-SHA256 suffix (truncated)
 *
 * Returns the parsed tier and expiry. Handles grace period logic:
 * - If expired within 30 days: tier stays, graceMode = true
 * - If expired beyond 30 days: tier = demo, graceMode = false
 */
export function parseLicenseKey(key: string, hmacSecret: string): LicenseResult {
  if (!KEY_REGEX.test(key)) {
    throw new Error(`Invalid license key format: key must match ${KEY_REGEX.source}`)
  }

  const parts = key.split('-')
  // parts: ['WVR', tierCode, payload, checksum]
  const tierCode = parts[1]
  const payload = parts[2]
  const checksum = parts[3]

  // Validate HMAC checksum
  const prefix = `WVR-${tierCode}-${payload}`
  const expectedChecksum = computeChecksum(prefix, hmacSecret)
  if (checksum !== expectedChecksum) {
    throw new Error('Invalid license key: checksum verification failed')
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
    const now = new Date()
    if (now > expiry) {
      const graceCutoff = new Date(expiry.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
      if (now <= graceCutoff) {
        // Within grace period — keep tier but flag grace mode
        return { tier, expiry, graceMode: true, customerId }
      }
      // Beyond grace period — downgrade to demo
      return { tier: TIERS.DEMO, expiry, graceMode: false, customerId }
    }
  }

  return { tier, expiry, graceMode: false, customerId }
}

/**
 * Generate a license key for the given tier.
 * Useful for E2E testing and admin tooling.
 */
export function generateLicenseKey(
  tier: typeof TIERS.FREE | typeof TIERS.WEAVER | typeof TIERS.FABRICK,
  hmacSecret: string,
  options?: { expiry?: Date; customerId?: string }
): string {
  const tierCode = { [TIERS.FREE]: 'FRE', [TIERS.WEAVER]: 'WVS', [TIERS.FABRICK]: 'FAB' }[tier]
  const issueDate = encodeDateToBase36(new Date())
  const expiryEncoded = options?.expiry ? encodeDateToBase36(options.expiry) : 'ZZZZ'
  const customerId = (options?.customerId ?? '0000').padStart(4, '0').slice(0, 4).toUpperCase()
  const payload = `${issueDate}${expiryEncoded}${customerId}`
  const prefix = `WVR-${tierCode}-${payload}`
  const checksum = computeChecksum(prefix, hmacSecret)
  return `${prefix}-${checksum}`
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

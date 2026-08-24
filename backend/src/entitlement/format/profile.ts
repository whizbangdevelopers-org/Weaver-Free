// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// VENDORED from wbd-entitlement@0de98b8 — do not edit here.
// Edit upstream, re-run scripts/vendor-entitlement.ts. audit:entitlement-vendor fails on drift.

/**
 * A product's licence-key profile — everything about the key format that varies per product.
 *
 * This type exists because the extraction from Weaver could not be a copy. `license.ts` and
 * `license-signing.ts` hardcoded the `WVR-` prefix in three places and imported Weaver's own
 * `TIERS` vocabulary, and a shared repo can carry neither: the prefix and the tier codes are the
 * two things every product defines differently, and tier→feature gating is not this repo's
 * concern at all (see README, boundary 5).
 *
 * What a product supplies is therefore small and entirely declarative. What it keeps is its
 * `TIER_ORDER`, its `requireTier`, and its accepted public keys.
 */
export interface ProductProfile<TTier extends string = string> {
  /** Key prefix, without separators — e.g. `WVR`. Uppercase alphanumerics only. */
  readonly prefix: string

  /**
   * Tier code → tier, the PARSE direction. Includes legacy codes that must still resolve.
   *
   * Weaver's `PRE`/`ENT` (Container Loom / MicroVM Dashboard era) belong here and deliberately
   * not in `codeForTier`: a retired code must keep verifying keys already in customers' hands
   * while never being minted again. That asymmetry is the reason these are two maps rather than
   * one bidirectional one.
   */
  readonly tierForCode: Readonly<Record<string, TTier>>

  /**
   * Tier → tier code, the MINT direction. Current codes only; never legacy.
   *
   * **Partial, because not every tier is sellable.** Weaver's `demo` tier is a product state, not
   * something anyone buys, so it has no code and must not be mintable. Requiring a total map would
   * force a placeholder code for it — and a tier code that exists is a tier someone can mint.
   * `createIssuer` throws on a tier with no code, so the absence is enforced rather than assumed.
   */
  readonly codeForTier: Readonly<Partial<Record<TTier, string>>>

  /**
   * What a licence resolves to once it is expired beyond grace.
   *
   * Product-specific by necessity: it is the product's own lowest tier, and for Weaver it is
   * deliberately Free rather than a demo mode, so a lapsed customer keeps real access to their
   * own workloads instead of being moved onto sample data.
   */
  readonly lapsedTier: TTier

  /** Days after expiry during which the tier is retained with `graceMode` set. Default 30. */
  readonly graceDays?: number
}

/** Thrown when a profile is internally inconsistent. Always a programming error, never input. */
export class ProfileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProfileError'
  }
}

const PREFIX_RE = /^[A-Z0-9]{2,8}$/
const CODE_RE = /^[A-Z0-9]{3}$/

/**
 * Validate a profile and return it.
 *
 * The round-trip check is the point, and it closes a latent defect the pre-extraction code had:
 * Weaver kept the parse map (`TIER_CODE_MAP`) in one file and the mint map inline inside
 * `generateLicenseKey`, with nothing asserting they agreed. Adding a tier to one and forgetting
 * the other would have produced keys that mint successfully and fail to parse — a break that
 * appears only once a customer installs the key, which is the worst possible place to find it.
 *
 * Call this at module scope so a bad profile fails at import, not at first issuance.
 */
export function defineProfile<TTier extends string>(
  profile: ProductProfile<TTier>,
): ProductProfile<TTier> {
  if (!PREFIX_RE.test(profile.prefix)) {
    throw new ProfileError(
      `prefix must be 2-8 uppercase alphanumerics, got '${profile.prefix}'`,
    )
  }

  const codes = Object.keys(profile.tierForCode)
  if (codes.length === 0) {
    throw new ProfileError('tierForCode is empty — no key could ever parse')
  }
  for (const code of codes) {
    if (!CODE_RE.test(code)) {
      throw new ProfileError(`tier code must be 3 uppercase alphanumerics, got '${code}'`)
    }
  }

  const mintCodes = Object.values(profile.codeForTier) as string[]
  if (mintCodes.length === 0) {
    throw new ProfileError('codeForTier is empty — no key could ever be minted')
  }

  // Every mintable code must parse back to the tier it was minted for. A code that mints but
  // does not parse produces a key that is valid to issue and impossible to install.
  for (const [tier, code] of Object.entries(profile.codeForTier) as [TTier, string][]) {
    if (!code) continue
    const parsed = profile.tierForCode[code]
    if (parsed === undefined) {
      throw new ProfileError(
        `codeForTier maps '${tier}' to '${code}', which tierForCode does not resolve — ` +
          'a key minted with this code would fail to parse',
      )
    }
    if (parsed !== tier) {
      throw new ProfileError(
        `round-trip mismatch: '${tier}' mints as '${code}', which parses back to '${parsed}'`,
      )
    }
  }

  const lapsedCode = profile.codeForTier[profile.lapsedTier]
  if (!lapsedCode || profile.tierForCode[lapsedCode] === undefined) {
    throw new ProfileError(
      `lapsedTier '${profile.lapsedTier}' has no code in codeForTier — a lapsed key ` +
        'could not be represented',
    )
  }

  if (profile.graceDays !== undefined && (!Number.isInteger(profile.graceDays) || profile.graceDays < 0)) {
    throw new ProfileError(`graceDays must be a non-negative integer, got ${profile.graceDays}`)
  }

  return profile
}

/** Grace period used when a profile does not state one. */
export const DEFAULT_GRACE_DAYS = 30

export function graceDaysOf(profile: ProductProfile<string>): number {
  return profile.graceDays ?? DEFAULT_GRACE_DAYS
}

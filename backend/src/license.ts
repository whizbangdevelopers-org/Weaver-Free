// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * Weaver's licence binding.
 *
 * The key mechanism — format, signing, verification, rotation — is vendored from
 * `wbd-entitlement` into `entitlement/` (ENT-1). What stays here is the part that is genuinely
 * Weaver's: the tier ordering, `requireTier`, and the single site that binds Weaver's profile to
 * the build's accepted keys.
 *
 * **There is one `createVerifier` call in this codebase and it is below.** That is deliberate:
 * "who decides what this build trusts" should be answerable by finding one line, and
 * `audit:authority-binding` fails if verification material reaches it from anywhere but the
 * generated authority module.
 *
 * The import path and the exported surface are unchanged, so the ~20 modules importing
 * `requireTier` / `parseLicenseKey` / `TIER_ORDER` needed no edits.
 */

import type { KeyObject } from 'node:crypto'
import { createVerifier, type LicenseResult } from './entitlement/verify/verifier.js'
import { createIssuer, type IssueOptions } from './entitlement/issue/issuer.js'
import { encodeDate, decodeDate } from './entitlement/format/payload.js'
import { ACCEPTED_PUBLIC_KEYS, CHANNEL, IS_RELEASE } from './generated/license-authority.js'
import { WEAVER_PROFILE } from './license-profile.js'
import { TIERS, TIER_ORDER, type TierName } from './constants/vocabularies.js'

export type Tier = TierName
export { TIER_ORDER }
export type { LicenseResult }

/**
 * THE binding site. Profile + build-time accepted keys, bound once at module scope.
 *
 * `ACCEPTED_PUBLIC_KEYS` is a generated build-time constant, never config. An operator running a
 * shipped binary cannot change what it trusts; a build can be made to trust a test authority, which
 * is what makes the substitute hub usable on a deployed node. Those are different seams and the
 * difference is the design.
 */
export const verifier = createVerifier(WEAVER_PROFILE, ACCEPTED_PUBLIC_KEYS)

/**
 * A production process must not be running a non-release authority.
 *
 * `IS_RELEASE` and `CHANNEL` were generated, exported, re-exported — and read by nothing outside
 * the tests. The channel invariant was therefore enforced at GENERATION time and asserted on the
 * committed artifact, but never on the running process, so the one case it exists to catch had no
 * check at the only moment it matters: a build regenerated with `--channel dev` (which trusts a
 * test authority, whose private half is disposable and may sit in CI or on a laptop) shipped and
 * started as production.
 *
 * A warning rather than a refusal, deliberately. Refusing would take a host that is serving
 * workloads offline over a licensing concern, which is a worse failure than the one being
 * reported — and the tier is not what the operator loses. `IS_RELEASE` is derived from the
 * manifest by the generator, so this cannot be silenced by configuration; the only way to clear
 * it is to ship a release-channel build.
 */
if (process.env.NODE_ENV === 'production' && !IS_RELEASE) {
  console.error(
    `[license] SECURITY: this is a production process running a '${CHANNEL}' authority. ` +
      'A non-release channel may trust a TEST signing key, whose private half is not held under ' +
      'custody — anyone holding it can mint any tier for this build. Rebuild with ' +
      '`generate:license-authority --channel release` before deploying.',
  )
}

/**
 * The verifier type, so collaborators can accept one by injection.
 *
 * Injecting a VERIFIER is not the seam that was just removed. That one took raw `acceptedKeys` —
 * a credential — straight into the production parse path. This takes an already-bound collaborator,
 * and building one still requires a `createVerifier` call, which `audit:authority-binding` flags
 * wherever it appears outside this module. The chokepoint is unchanged; only testability improved.
 */
export type LicenseVerifier = typeof verifier

/** How many keys this build trusts. Zero is the correct pre-ceremony state. */
export const acceptedKeyCount = verifier.acceptedKeyCount

/**
 * Parse and validate a licence key.
 *
 * Key format: `WVR-<tier>-<payload>-<signature>` where payload is 24 base36 characters —
 * `version(1) issued(4) expiry(4) customerId(4) serial(8) quantity(3)` — and the signature is
 * Ed25519 over `WVR-<tier>-<payload>`, unpadded base32.
 *
 * **There is no secret parameter, and that absence is the fix.** This used to take the HMAC secret
 * resolved from `LICENSE_HMAC_SECRET` / the NixOS module option — i.e. from the operator, the party
 * the licence restricts. Because HMAC is symmetric, holding that value was the ability to mint.
 *
 * Grace handling: expired within the profile's grace window keeps the tier with `graceMode` set;
 * beyond it the tier becomes **Free**, deliberately — a lapsed customer keeps real access to their
 * own workloads rather than being moved onto demo data.
 *
 * `now` is injectable because expiry and grace are the whole point of this function and both are
 * time-dependent. Resolution happens on every re-read of the key file, not only at start-up, so
 * "the same key parsed later gives a different tier" is a behaviour with its own tests.
 *
 * **There is deliberately no `acceptedKeys` parameter.** One used to exist "so tests can verify
 * with an ephemeral keypair", defended by the observation that the runtime path never passed it.
 * That is a convention, not a control: nothing stopped a future route from threading operator input
 * into it, and `audit:authority-binding` flagged it the first time it ran. A test that wants a
 * different trust set now says so by building its own verifier — `createVerifier(WEAVER_PROFILE,
 * keys)` — which states the intent at the call site instead of widening the production API.
 */
export function parseLicenseKey(key: string, now: Date = new Date()): LicenseResult<TierName> {
  return verifier.parseLicenseKey(key, now)
}

/**
 * Mint a licence key. **Issuer-side only** — requires the private signing key, which a shipped
 * build does not have.
 *
 * Called by the Stripe path and by `scripts/generate-license.ts`; never reimplement the payload or
 * the signature elsewhere, or a test key stops being byte-identical to a real one and every harness
 * result becomes unfalsifiable.
 *
 * `options.expiry` is optional and its absence mints a key that NEVER expires, so the shortest call
 * produces the most permissive credential. That hazard is documented upstream and survives only
 * because perpetual keys are a real product case — `options.quantity` deliberately does not repeat
 * it and defaults to 1.
 */
export function generateLicenseKey(
  tier: TierName,
  privateKey: KeyObject,
  options?: IssueOptions,
): string {
  return createIssuer(WEAVER_PROFILE, privateKey).generateLicenseKey(tier, options)
}

/** Encode a date as base36 days since 2020-01-01. Re-exported for tooling and tests. */
export const encodeDateToBase36 = encodeDate

/** Decode a base36 day count. `ZZZZ` means "no expiry". */
export const decodeDateFromBase36 = decodeDate

/**
 * Guard that throws a 403-style error if the current tier is below the minimum.
 *
 * Stays here rather than moving upstream: tier→feature gating is product policy, and
 * `wbd-entitlement` deliberately does not know what a Weaver tier permits (ENT-4).
 */
/**
 * Guard that throws a 403-style error when enrolling a node would exceed the licensed count.
 *
 * **SEC-027.** `quantity` was signed into every key, populated from the purchase, returned by the
 * verifier — and read by nothing. The upstream library states the consequence on the field itself:
 * *"A product that ignores this field has an unenforced licence term, and that is the product's
 * bug."* This is the consumer that makes it not one.
 *
 * **The decision this encodes: a node is counted at ENROLMENT, not at start and not continuously.**
 * The alternatives and why they lose:
 *
 *   - *At start* — a node that is powered off still occupies a seat. Counting at start would let a
 *     fleet of thirty rotate through a three-node licence, and would also fail a legitimate
 *     simultaneous restart. Wrong on both sides.
 *   - *Continuously* — needs every node reachable to answer "how many are there", so a network
 *     partition becomes a licensing failure. A licence check that fails closed on a partition takes
 *     the fleet down for a billing reason, which is worse than the thing it is preventing.
 *   - *At enrolment* — the count changes only when an operator deliberately adds a node, which is
 *     exactly when a licence limit should be felt. It is also the only moment a human is present to
 *     read the error.
 *
 * The local host always counts as one and is never refused: a Weaver install must keep managing its
 * own workloads whatever the licence says. Enrolment is what this gates, not operation.
 *
 * `null` is unbounded — a perpetual or unmetered grant — and is deliberately distinct from a
 * missing value, which `config.ts` floors at 1 so a forgotten entitlement under-grants.
 *
 * **The first call site is v2.2 Weaver Team peer federation, not Fabrick clustering.** Multi-node
 * starts at Team — v2.2 ships full management of remote Weaver hosts — so this binds a release
 * earlier than the Fabrick work at v2.4, and the deadline in SEC-027 is correspondingly tighter.
 *
 * A tension to settle when that lands, flagged here because it is easy to build both by accident:
 * v2.2's roadmap describes a peer limit as a TIER property ("up to 2 remote hosts, upgrade prompt
 * on peer limit"), while this reads a PURCHASED property off the signed key. Two mechanisms for one
 * number will disagree the first time someone buys three. Whichever wins, only one of them should
 * decide — and the signed one is the only one an airgapped install cannot edit.
 *
 * Until then the only enrolment is the local host, which `assertLicensedNodeCapacity` checks at
 * start-up, so the field is consumed today rather than returned and dropped.
 */
export function requireNodeCapacity(
  config: { tier: Tier; licenseNodes: number | null },
  currentNodes: number,
): void {
  if (config.licenseNodes === null) return          // unbounded grant
  if (currentNodes < config.licenseNodes) return
  throw Object.assign(
    new Error(
      `This licence covers ${config.licenseNodes} node${config.licenseNodes === 1 ? '' : 's'} and ` +
        `${currentNodes} ${currentNodes === 1 ? 'is' : 'are'} already enrolled. ` +
        'Add capacity to the licence to enrol another.',
    ),
    { statusCode: 403 },
  )
}

/**
 * Start-up sanity check on the licensed node count.
 *
 * Warns rather than throws, deliberately and for the same reason the non-release-authority check
 * above warns: refusing to start would take a host that is serving workloads offline over a
 * licensing concern, which is a worse failure than the one being reported. The local host is one
 * node and is never refused — this exists so a nonsensical entitlement (zero nodes) is visible
 * rather than silently treated as unbounded.
 */
export function assertLicensedNodeCapacity(config: { tier: Tier; licenseNodes: number | null }): void {
  if (config.licenseNodes === null) return
  if (config.licenseNodes >= 1) return
  console.error(
    `[license] this licence reports ${config.licenseNodes} nodes, which cannot be right — a licence ` +
      'covers at least the host it is installed on. Treating the local host as licensed and ' +
      'continuing; enrolling further nodes will be refused.',
  )
}

export function requireTier(config: { tier: Tier }, minimum: Tier): void {
  if (TIER_ORDER[config.tier] < TIER_ORDER[minimum]) {
    throw Object.assign(
      new Error(`This feature requires ${minimum} tier or higher (current: ${config.tier})`),
      { statusCode: 403 },
    )
  }
}

export { TIERS }

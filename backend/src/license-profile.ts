// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * Weaver's licence-key profile — the per-product half of the entitlement system.
 *
 * `backend/src/entitlement/` is vendored wholesale from `wbd-entitlement` and must never be
 * hand-edited. This file is the opposite: it is Weaver's, it is the only place Weaver's tier
 * vocabulary meets the shared key format, and it lives OUTSIDE the vendored tree deliberately —
 * an earlier draft put it inside and the vendor script's directory wipe destroyed it.
 *
 * `wbd-entitlement` owns the key mechanism. What varies per product is the prefix, the tier codes,
 * the tier vocabulary and the lapse target (ENT-4), and none of that belongs in a shared repo.
 *
 * Note `TIERS.SOLO === 'solo'` while its key code is `WVS` — the internal value and the wire code
 * are still different strings, which is exactly why the profile maps them explicitly rather than
 * deriving one from the other. That independence is what made the internal value's last rename a
 * free one: it used to be `'weaver'`, and no issued key ever encoded it — only the code did.
 */

import { defineProfile } from './entitlement/format/profile.js'
import { TIERS, type TierName } from './constants/vocabularies.js'

export const WEAVER_PROFILE = defineProfile<TierName>({
  prefix: 'WVR',

  /**
   * Parse direction — includes retired codes that must still resolve.
   *
   * `PRE` and `ENT` are codes from the tier structure that preceded the current
   * Free/Solo/Team/Fabrick names. Deliberately not spelled out
   * here: this file is where someone looks up what a Weaver tier is called, so a retired name in it
   * reads as current vocabulary, and `audit:vocabulary` is right to refuse one.
   *
   * They stay in this map and deliberately NOT in `codeForTier`: a retired code must keep verifying
   * keys already in customers' hands while never being minted again. Retiring a name must not
   * strand a licence somebody paid for.
   */
  tierForCode: {
    FRE: TIERS.FREE,
    WVS: TIERS.SOLO,
    WVT: TIERS.TEAM,
    FAB: TIERS.FABRICK,
    PRE: TIERS.SOLO,
    ENT: TIERS.FABRICK,
  },

  /**
   * Mint direction — current codes only.
   *
   * `demo` is absent on purpose. It is a product state, not something anyone buys, and a tier code
   * that exists is a tier someone can mint. `createIssuer` throws on a tier with no code, so the
   * absence is enforced rather than trusted.
   */
  codeForTier: {
    [TIERS.FREE]: 'FRE',
    [TIERS.SOLO]: 'WVS',
    [TIERS.TEAM]: 'WVT',
    [TIERS.FABRICK]: 'FAB',
  },

  /**
   * Where an expired-beyond-grace licence lands.
   *
   * Free, not demo — deliberately. A lapsed customer keeps real access to their own workloads
   * rather than being moved onto sample data.
   */
  lapsedTier: TIERS.FREE,

  graceDays: 30,
})

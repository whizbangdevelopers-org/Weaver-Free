// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Pricing Constants — Single Source of Truth
 *
 * All pricing data for the product lives here. Every UI component, help page,
 * demo tooltip, and auditor reads from this file. To change pricing:
 *   1. Update values here
 *   2. Run `npm run audit:vocabulary` — brand mark + pricing parity
 *   3. Run `npm run e2e:demo-public` — verify rendered prices
 *
 * When FM window closes, set `fmAvailable = false` — all FM pricing references
 * throughout the UI will hide automatically.
 *
 * Decision #142: Smart Bridges baked into base price. AI Pro/AI Fleet retired.
 * Team +$50/user (Smart Bridges basic), FabricK +$500 first node (Smart Bridges full + inference).
 */

// ── Founding Member availability ────────────────────────────────────────────
/** When false, all FM pricing and FM CTAs are hidden throughout the UI. */
export const FM_AVAILABLE = true

// ── Tier pricing ────────────────────────────────────────────────────────────

export interface TierPricing {
  standard: string      // e.g. '$249/yr'
  fm: string            // e.g. '$149/yr'
  fmShort: string       // e.g. '$149' (no unit, for inline use)
  unit: string          // e.g. '/yr', '/user/yr', '/yr/node'
  persona: string       // one-line tooltip description
}

export const PRICING = {
  free: {
    standard: '$0/yr',
    fm: '$0/yr',
    fmShort: '$0',
    unit: '/yr',
    persona: '$0/yr — home lab, single node',
  } satisfies TierPricing,

  solo: {
    standard: '$249/yr',
    fm: '$149/yr',
    fmShort: '$149',
    unit: '/yr',
    persona: `1 admin \u2014 $249/yr ($149 FM) \u00b7 single operator`,
  } satisfies TierPricing,

  team: {
    standard: '$199/user/yr',
    fm: '$129/user/yr',
    fmShort: '$129',
    unit: '/user/yr',
    persona: `2\u20134 users \u2014 $199/user/yr ($129 FM) \u00b7 Smart Bridges`,
  } satisfies TierPricing,

  fabrick: {
    standard: '$2,000/yr/node',
    fm: '$1,299/yr/node',
    fmShort: '$1,299',
    unit: '/yr/node',
    persona: `$2,000/yr first node ($1,299 FM) \u2014 Smart Bridges + inference`,
  } satisfies TierPricing,
} as const

// ── FabricK volume node pricing (Decision #142) ────────────────────────────

export const FABRICK_NODE_PRICING = {
  first: '$2,000/yr',
  tier2: { range: '2–4 nodes', price: '$1,250/yr' },
  tier3: { range: '5–9 nodes', price: '$1,000/yr' },
  tier4: { range: '10+ nodes', price: '$750/yr' },
} as const

// ── FM program ──────────────────────────────────────────────────────────────

export const FM_SLOTS = {
  solo: { cap: 100, capVersion: 'v1.2' },
  team: { cap: 50, capVersion: 'v2.2' },
  fabrick: { cap: 20, capVersion: 'v2.2' },
} as const

// ── Paid extensions (not in base FM lock) ───────────────────────────────────

export const EXTENSIONS = {
  complianceExport: {
    name: 'Compliance Export',
    price: '$4,000/yr',
    description: 'Automated evidence packages for HIPAA, SOC 2, PCI-DSS, NIST 800-53, CMMC, 21 CFR Part 11',
    tier: 'fabrick',
    version: 'v2.2+',
  },
} as const

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Format pricing for display: "$249/yr ($149 FM)" or "$249/yr" if FM unavailable */
export function formatPricing(tier: keyof typeof PRICING): string {
  const p = PRICING[tier]
  if (tier === 'free') return p.standard
  return FM_AVAILABLE ? `${p.standard} (${p.fmShort} FM)` : p.standard
}

/** Short label for pricing cards: "<$150/yr" for Solo FM, "$0" for Free, etc. */
export function fmCardPrice(tier: keyof typeof PRICING): string {
  const p = PRICING[tier]
  if (tier === 'free') return p.fmShort
  if (tier === 'solo') return FM_AVAILABLE ? `<$150/yr` : p.standard
  return FM_AVAILABLE ? `${p.fmShort}${p.unit}` : p.standard
}

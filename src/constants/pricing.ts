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
 * Smart Bridges are included in the paid-tier base price: Team includes basic
 * Smart Bridges; FabricK includes full Smart Bridges plus inference.
 *
 * TWO FOUNDING PROGRAMMES, NOT ONE. Every tier's founding rate belongs to one of
 * them, and the tier declares WHICH so no surface has to remember:
 *
 *   Early Adopter (EA)    Solo, Team.  Self-serve, published on the pricing page.
 *   Founding Member (FM)  Fabrick.     Invited; the RATE IS NEVER PUBLISHED, only
 *                                      disclosed in direct design-partner outreach.
 *
 * That second rule is why the public pricing page shows a founding price for Solo
 * and "Contact us" for FabricK — and why that page's callout is the EA callout,
 * with no combined label to design.
 */

// ── Founding-rate availability ──────────────────────────────────────────────
//
// Two flags, because the windows close independently: EA at v1.2 (Solo) / v2.2
// (Team) or on its quantity cap, FM at v2.2 or 20 seats. One flag could not
// express "EA closed, FM still open", which is a state these programmes reach.

/** When false, Early Adopter pricing and CTAs are hidden (Solo + Team). */
export const EA_AVAILABLE = true
/** When false, Founding Member pricing and CTAs are hidden (Fabrick). */
export const FM_AVAILABLE = true

// ── Tier pricing ────────────────────────────────────────────────────────────

/** Which founding programme a tier's discounted rate belongs to. */
export type FoundingProgramme = 'EA' | 'FM'

export interface TierPricing {
  standard: string           // e.g. '$249/yr'
  founding: string           // e.g. '$149/yr'
  foundingShort: string      // e.g. '$149' (no unit, for inline use)
  /** Which programme that founding rate belongs to; `null` where there is none. */
  programme: FoundingProgramme | null
  unit: string               // e.g. '/yr', '/user/yr', '/yr/node'
  persona: string            // one-line tooltip description
}

export const PRICING = {
  free: {
    standard: '$0/yr',
    founding: '$0/yr',
    foundingShort: '$0',
    programme: null,            // free is free; there is no founding rate to discount
    unit: '/yr',
    persona: '$0/yr — home lab, single node',
  } satisfies TierPricing,

  solo: {
    standard: '$249/yr',
    founding: '$149/yr',
    foundingShort: '$149',
    programme: 'EA',
    unit: '/yr',
    persona: `1 admin \u2014 $249/yr ($149 EA) \u00b7 single operator`,
  } satisfies TierPricing,

  team: {
    standard: '$199/user/yr',
    founding: '$129/user/yr',
    foundingShort: '$129',
    programme: 'EA',
    unit: '/user/yr',
    persona: `2\u20134 users \u2014 $199/user/yr ($129 EA) \u00b7 Smart Bridges`,
  } satisfies TierPricing,

  fabrick: {
    standard: '$2,000/yr/node',
    founding: '$1,299/yr/node',
    foundingShort: '$1,299',
    programme: 'FM',
    unit: '/yr/node',
    persona: `$2,000/yr first node \u2014 Smart Bridges + inference`,
  } satisfies TierPricing,
} as const

// ── FabricK volume node pricing ────────────────────────────────────────────

export const FABRICK_NODE_PRICING = {
  first: '$2,000/yr',
  tier2: { range: '2–4 nodes', price: '$1,250/yr' },
  tier3: { range: '5–9 nodes', price: '$1,000/yr' },
  tier4: { range: '10+ nodes', price: '$750/yr' },
} as const

// ── Founding cohorts ──────────────────────────────────────────────────────────────

export const EA_SLOTS = {
  solo: { cap: 100, capVersion: 'v1.2' },
  team: { cap: 50, capVersion: 'v2.2' },
} as const

export const FM_SLOTS = {
  fabrick: { cap: 20, capVersion: 'v2.2' },
} as const

// ── Paid extensions (not in either founding lock) ───────────────────────────

export const EXTENSIONS = {
  complianceExport: {
    name: 'Compliance Export',
    price: '$4,000/yr',
    fmPrice: '$2,800/yr',
    fmCap: 100,
    description: 'Automated evidence packages for HIPAA, SOC 2, PCI-DSS, NIST 800-53, CMMC, 21 CFR Part 11',
    tier: 'fabrick',
    // SKU launch version — this is when the extension becomes purchasable.
    // Lifecycle stages (foundation v2.1, progressive v2.2–v2.5, dev preview
    // v2.5) are tracked in the feature-lifecycle record.
    // FM window closes when this version ships.
    version: 'v3.1',
  },
} as const

// ── Helpers ─────────────────────────────────────────────────────────────────

const PROGRAMME_LABEL: Record<FoundingProgramme, { full: string; short: string; cta: string }> = {
  EA: { full: 'Early Adopter', short: 'EA', cta: 'Become an Early Adopter' },
  FM: { full: 'Founding Member', short: 'FM', cta: 'Become a Founding Member' },
}

/**
 * The programme wording for a tier, or null when the tier has no founding rate.
 *
 * Every surface asks HERE rather than typing a name. That is what makes the two
 * programmes impossible to cross by accident: the tier decides the word, so a
 * Solo page cannot offer an invited Fabrick seat by a copy-paste.
 */
export function foundingLabel(tier: keyof typeof PRICING) {
  const p = PRICING[tier].programme
  return p ? PROGRAMME_LABEL[p] : null
}

/** Is this tier's founding window open? Each programme closes on its own schedule. */
export function foundingAvailable(tier: keyof typeof PRICING): boolean {
  const p = PRICING[tier].programme
  if (!p) return false
  return p === 'EA' ? EA_AVAILABLE : FM_AVAILABLE
}

/** Format pricing for display: "$249/yr ($149 EA)", or standard when the window is shut. */
export function formatPricing(tier: keyof typeof PRICING): string {
  const p = PRICING[tier]
  const label = foundingLabel(tier)
  if (!label || !foundingAvailable(tier)) return p.standard
  return `${p.standard} (${p.foundingShort} ${label.short})`
}

/**
 * Short label for a public pricing card.
 *
 * FabricK returns its STANDARD price even while its window is open: the Founding
 * Member rate is disclosed in direct outreach only and must never be rendered on
 * a public surface. A card is a public surface.
 */
export function foundingCardPrice(tier: keyof typeof PRICING): string {
  const p = PRICING[tier]
  if (tier === 'free') return p.foundingShort
  if (tier === 'fabrick') return p.standard
  if (tier === 'solo') return foundingAvailable('solo') ? `<$150/yr` : p.standard
  return foundingAvailable(tier) ? `${p.foundingShort}${p.unit}` : p.standard
}

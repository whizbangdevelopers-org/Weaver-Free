// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * resolve-context — case preservation + premium→Weaver/Weaver Solo resolution.
 *
 * Two responsibilities, both tested in isolation (the prompt flags case
 * preservation as fiddly — write it as a tested helper first):
 *
 *   1. {@link matchCase} — preserve the casing of the source term in the
 *      suggestion: "Premium" → "Weaver Solo", "premium" → "Weaver Solo",
 *      "PREMIUM" → "WEAVER SOLO".
 *
 *   2. {@link resolvePremiumSuggestion} — disambiguate the premium rename:
 *        a. paragraph contrasts with "Weaver Team"  → "Weaver Solo"
 *        b. contrast only with "Fabrick"            → "Weaver"
 *        c. modifies a Solo-only tier-table feature → "Weaver Solo"
 *        d. otherwise → "Weaver" + a disambiguation note (advisory)
 *
 * The suggestion is advisory; the auditor fails on the stale term regardless of
 * which replacement is correct.
 */

export type CaseStyle = 'upper' | 'lower' | 'title' | 'mixed'

/** Classify the casing of a matched source term. */
export function classifyCase(term: string): CaseStyle {
  const letters = term.replace(/[^A-Za-z]/g, '')
  if (letters.length === 0) return 'mixed'
  if (letters === letters.toUpperCase() && /[A-Z]/.test(letters) && letters.length > 1) return 'upper'
  if (letters === letters.toLowerCase()) return 'lower'
  // Title case: first letter upper, the rest of each word lower-ish.
  if (/^[A-Z][a-z]*(\s+[A-Z][a-z]*)*$/.test(term.trim())) return 'title'
  // A single capital letter counts as title (e.g. "EA" handled as upper above).
  if (/^[A-Z]/.test(term)) return 'title'
  return 'mixed'
}

/**
 * Re-case `replacement` to match the casing style of the matched `sourceTerm`.
 * "Premium" (title) → "Weaver Solo"; "premium" (lower) → "weaver solo";
 * "PREMIUM" (upper) → "WEAVER SOLO". The canonical replacement (e.g.
 * "Weaver Solo") is treated as the title-case baseline.
 */
export function matchCase(sourceTerm: string, replacement: string): string {
  switch (classifyCase(sourceTerm)) {
    case 'upper':
      return replacement.toUpperCase()
    case 'lower':
      return replacement.toLowerCase()
    case 'title':
      // Canonical replacements are already title-case (Weaver Solo, Fabrick,
      // Founding Member, TIERS.SOLO). Keep as-is.
      return replacement
    case 'mixed':
    default:
      return replacement
  }
}

export interface PremiumContext {
  /** The paragraph (block of non-empty lines) the match sits in. */
  paragraph: string
  /** Whether the surrounding context names a Solo-only tier-table feature. */
  soloOnlyFeature?: boolean
}

export interface PremiumResolution {
  suggestion: string
  note?: string
}

/**
 * Resolve which current term a stale "premium" should map to, given its
 * paragraph context. Returns the canonical (title-case) suggestion + an
 * optional advisory note; the caller applies {@link matchCase}.
 */
export function resolvePremiumSuggestion(ctx: PremiumContext): PremiumResolution {
  const p = ctx.paragraph
  const mentionsTeam = /\bWeaver\s+Team\b/i.test(p) || /\bTeam\s+tier\b/i.test(p)
  const mentionsFabrick = /\bFabrick\b/i.test(p) || /\benterprise\b/i.test(p)

  // a. contrast with Weaver Team → Solo
  if (mentionsTeam) {
    return { suggestion: 'Weaver Solo' }
  }
  // c. Solo-only tier-table feature → Solo
  if (ctx.soloOnlyFeature) {
    return { suggestion: 'Weaver Solo' }
  }
  // b. contrast only with Fabrick → Weaver
  if (mentionsFabrick) {
    return { suggestion: 'Weaver' }
  }
  // d. ambiguous → Weaver + disambiguation note
  return {
    suggestion: 'Weaver',
    note: 'disambiguate: Weaver Solo vs Weaver Team based on context',
  }
}

/**
 * Extract the paragraph (run of consecutive non-blank lines) containing the
 * given 0-based line index. Used to scope the premium disambiguation.
 */
export function paragraphAt(lines: string[], index: number): string {
  let start = index
  while (start > 0 && lines[start - 1]!.trim() !== '') start--
  let end = index
  while (end < lines.length - 1 && lines[end + 1]!.trim() !== '') end++
  return lines.slice(start, end + 1).join('\n')
}

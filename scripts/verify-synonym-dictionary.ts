// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Synonym Dictionary Auditor
 *
 * Guards the single source for the synonym/translation layer
 * (scripts/data/synonym-dictionary.json) against drift and internal
 * inconsistency. The dictionary deliberately does NOT duplicate the two
 * existing vocabulary sources — it cross-references them — so this auditor
 * enforces that the cross-references actually resolve:
 *
 *   1. Structure — required fields, correct types, non-empty analogs.
 *   2. Audience tokens — every adoptIn/avoidIn token is a declared audience.
 *   3. No duplicate canonical terms.
 *   4. adoptIn and avoidIn are disjoint per entry.
 *   5. Product parity — every domain=product `canonical` is a real, defined
 *      Weaver term (appears as a bolded **token** in .claude/rules/core/terminology.md
 *      or code/.claude/rules/navigation.md). Catches typos / renamed-away drift.
 *   6. Translation-not-adoption — domain=product entries have empty adoptIn
 *      (textile terms are translated, never adopted as our label). Only
 *      methodology entries (e.g. RSI) may be conditionally adopted.
 *   7. Anti-term consistency — every antiTerm sits on a ban line in
 *      terminology.md (a line containing never|retire|relabel|reintroduce),
 *      so the dictionary's anti-terms stay consistent with the Retired Labels.
 *
 * Definitions remain authoritative in terminology.md; this auditor never
 * re-defines a term, only verifies the dictionary points at real ones.
 *
 * Usage:
 *   npx tsx scripts/verify-synonym-dictionary.ts
 *   npx tsx scripts/verify-synonym-dictionary.ts --json
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

const DICT_PATH = resolve(CODE_ROOT, 'scripts/data/synonym-dictionary.json')
const TERMINOLOGY_PATH = resolve(PROJECT_ROOT, '.claude/rules/core/terminology.md')
const NAVIGATION_PATH = resolve(CODE_ROOT, '.claude/rules/navigation.md')

// ANSI colours
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const BAN_KEYWORD = /\b(?:never|retire[d]?|relabel|reintroduce)\b/i

interface Entry {
  canonical: string
  domain: 'product' | 'methodology'
  gloss: string
  industryAnalogs: string[]
  antiTerms: string[]
  adoptIn: string[]
  avoidIn: string[]
  note?: string
}

interface Dict {
  audiences: Record<string, string>
  entries: Entry[]
}

interface Violation {
  canonical: string
  detail: string
}

function readSafe(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

function audit(): Violation[] {
  const violations: Violation[] = []
  const dict = JSON.parse(readFileSync(DICT_PATH, 'utf-8')) as Dict
  const terminology = readSafe(TERMINOLOGY_PATH)
  const navigation = readSafe(NAVIGATION_PATH)
  const vocabSources = terminology + '\n' + navigation
  const banLines = terminology.split('\n').filter((l) => BAN_KEYWORD.test(l))

  // Declared audience tokens (exclude the _comment doc key).
  const audiences = new Set(Object.keys(dict.audiences ?? {}).filter((k) => !k.startsWith('_')))

  const seen = new Set<string>()

  for (const e of dict.entries) {
    const id = e.canonical ?? '(missing canonical)'

    // 1. Structure
    if (typeof e.canonical !== 'string' || !e.canonical)
      violations.push({ canonical: id, detail: 'missing/invalid `canonical`' })
    if (e.domain !== 'product' && e.domain !== 'methodology')
      violations.push({ canonical: id, detail: `domain must be 'product' or 'methodology' (got ${JSON.stringify(e.domain)})` })
    if (typeof e.gloss !== 'string' || !e.gloss)
      violations.push({ canonical: id, detail: 'missing `gloss`' })
    if (!Array.isArray(e.industryAnalogs) || e.industryAnalogs.length === 0)
      violations.push({ canonical: id, detail: '`industryAnalogs` must be a non-empty array' })
    for (const field of ['antiTerms', 'adoptIn', 'avoidIn'] as const) {
      if (!Array.isArray(e[field]))
        violations.push({ canonical: id, detail: `\`${field}\` must be an array` })
    }

    // 3. No duplicate canonicals
    if (seen.has(e.canonical)) violations.push({ canonical: id, detail: 'duplicate canonical term' })
    seen.add(e.canonical)

    // 2. Audience tokens valid
    for (const a of [...(e.adoptIn ?? []), ...(e.avoidIn ?? [])]) {
      if (!audiences.has(a))
        violations.push({ canonical: id, detail: `unknown audience token "${a}" (not declared in audiences)` })
    }

    // 4. adoptIn / avoidIn disjoint
    const overlap = (e.adoptIn ?? []).filter((a) => (e.avoidIn ?? []).includes(a))
    if (overlap.length)
      violations.push({ canonical: id, detail: `audience(s) in BOTH adoptIn and avoidIn: ${overlap.join(', ')}` })

    // 5. Product parity — canonical is a real defined term
    if (e.domain === 'product') {
      const bolded = `**${e.canonical}**`
      if (!vocabSources.includes(bolded))
        violations.push({
          canonical: id,
          detail: `domain=product but "${bolded}" is not a defined term in terminology.md or navigation.md (typo or drifted name?)`,
        })

      // 6. Translation-not-adoption
      if ((e.adoptIn ?? []).length > 0)
        violations.push({
          canonical: id,
          detail: `product term has non-empty adoptIn — textile terms are translated, never adopted as our label. If adoption is intended, it is a methodology term, not a product term.`,
        })
    }

    // 7. Anti-term consistency with terminology.md ban lines
    for (const t of e.antiTerms ?? []) {
      const onBanLine = banLines.some((l) => l.toLowerCase().includes(t.toLowerCase()))
      if (!onBanLine)
        violations.push({
          canonical: id,
          detail: `antiTerm "${t}" is not on a ban line (never/retire/relabel/reintroduce) in terminology.md — anti-terms must stay consistent with the Retired Labels`,
        })
    }
  }

  return violations
}

function main(): void {
  const jsonMode = process.argv.includes('--json')
  let violations: Violation[]
  try {
    violations = audit()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (jsonMode) {
      console.log(JSON.stringify({ pass: false, error: msg }, null, 2))
    } else {
      console.log(`${RED}${BOLD}✗ audit:synonym-dictionary — FAIL${RESET}`)
      console.log(`  could not load/parse synonym-dictionary.json: ${msg}`)
    }
    process.exit(1)
  }

  if (jsonMode) {
    console.log(JSON.stringify({ pass: violations.length === 0, violations }, null, 2))
    process.exit(violations.length === 0 ? 0 : 1)
  }

  if (violations.length === 0) {
    console.log(`${GREEN}✓ audit:synonym-dictionary — PASS${RESET}`)
    console.log(`${DIM}  synonym-dictionary.json: all canonicals defined, anti-terms consistent, audience scope valid.${RESET}`)
    process.exit(0)
  }

  console.log(`${RED}${BOLD}✗ audit:synonym-dictionary — FAIL${RESET}`)
  console.log()
  for (const v of violations) {
    console.log(`  ${RED}✗${RESET} ${BOLD}${v.canonical}${RESET} — ${v.detail}`)
  }
  console.log()
  console.log(`${RED}${violations.length} violation(s)${RESET}`)
  console.log(`${DIM}Source: code/scripts/data/synonym-dictionary.json — definitions stay authoritative in .claude/rules/core/terminology.md${RESET}`)
  process.exit(1)
}

main()

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Engineering Discipline Parity Auditor
 *
 * Two drift classes this auditor catches:
 *
 *   1. Internal drift — `ENGINEERING-DISCIPLINE.md` previously had four
 *      different auditor counts in the same document (32, 36, 36, 38), all
 *      claiming to be the same thing. The existing doc-parity auditor only
 *      checked one of them. Users who opened /docs/engineering-discipline
 *      in-app saw the contradictions.
 *
 *   2. Reality drift — the count claimed in the public doc must match the
 *      actual `audit:*` count in the `test:compliance` chain in package.json.
 *      Adding an auditor without updating the doc is a trust-signal leak,
 *      because the doc ships in the installed product via DocsPage.vue.
 *
 * What this auditor checks:
 *
 *   A. The count — every integer-plus-"auditor(s)" or integer-plus-"checks"
 *      occurrence in ENGINEERING-DISCIPLINE.md must be the same number.
 *
 *   B. Reality — that shared count must equal the number of distinct
 *      `audit:*` entries chained in `test:compliance`.
 *
 *   C. Verification-table presence — the doc must end with a "Verify what
 *      this page claims" table so the public commitment to verifiability
 *      can't silently disappear.
 *
 * Why this auditor, not a stronger version of audit:doc-parity:
 *   - audit:doc-parity scans many documents for a single regex pattern.
 *     This auditor focuses on one document and cross-references multiple
 *     claims within it. A single-doc internal-consistency check is a
 *     cleaner separation than widening the doc-parity regex.
 *   - audit:doc-parity would have to special-case the four different
 *     wording patterns in ENGINEERING-DISCIPLINE.md. Catching that drift
 *     in a focused auditor keeps doc-parity's responsibility narrow.
 *
 * Portfolio note:
 *   The canonical internal reference is at `Forge/ENGINEERING-DISCIPLINE-
 *   INTERNAL.md` (maintained by Mark + Yuri; private Forge repo). The
 *   `-INTERNAL` suffix disambiguates the inventory-style internal doc
 *   from this public coverage-rhetoric doc — never drop the suffix in
 *   references. This auditor only governs the public per-product copy
 *   that ships in-app; the internal Forge version is a reference doc
 *   and is not gated by CI (cross-repo access out of scope here).
 *
 * To fix a failure:
 *   - If counts disagree inside the doc, update all of them to the
 *     number of `audit:*` entries in `test:compliance`.
 *   - If the doc count disagrees with reality, update the doc.
 *   - If the verification table is missing, restore it (see doc history
 *     for the canonical shape).
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')

const DOC = resolve(CODE_ROOT, 'docs', 'security', 'ENGINEERING-DISCIPLINE.md')
const PKG = resolve(CODE_ROOT, 'package.json')

interface Violation {
  category: 'internal' | 'reality' | 'structure'
  detail: string
}

function auditorCountFromPackageJson(): number {
  // Compliance chain moved from package.json test:compliance (1400-char
  // chained npm script) to scripts/run-compliance.ts — the AUDITORS array
  // is the source of truth. Parse 'audit:*' string literals from its source.
  const runCompliancePath = resolve(dirname(PKG), 'scripts', 'run-compliance.ts')
  if (!existsSync(runCompliancePath)) {
    throw new Error('scripts/run-compliance.ts not found — auditor cannot run')
  }
  const src = readFileSync(runCompliancePath, 'utf8')
  const matches = src.match(/'audit:[\w-]+'/g) ?? []
  const unique = new Set(matches)
  return unique.size
}

function countsInDoc(content: string): Array<{ value: number; context: string; line: number }> {
  const lines = content.split('\n')
  const hits: Array<{ value: number; context: string; line: number }> = []

  // Match patterns like:
  //   "38 auditors"  "38 compliance auditors"  "38 domain-specific auditors"
  //   "## The 38 compliance auditors"  "**38** auditors"
  // The group captures the integer. The lookahead ensures the next
  // non-formatting text is an auditor-ish word so we don't match unrelated
  // numbers (vertical counts, CII IDs, etc.).
  //
  // Excludes OpenSSF-specific "seven Scorecard checks" phrasing — that's a
  // fixed count of what Scorecard itself defines, not our auditor total.
  const RE =
    /(?<!\w)(\d+)[* _]*[-\s]*(?:static\s+|domain-specific\s+|compliance\s+)?auditors?\b/gi

  lines.forEach((line, i) => {
    // Skip the Pre-OpenSSF section — it talks about 7 Scorecard checks, not our auditor count
    if (/seven\s+Scorecard|7 of the Scorecard/i.test(line)) return
    let m: RegExpExecArray | null
    RE.lastIndex = 0
    while ((m = RE.exec(line)) !== null) {
      hits.push({
        value: parseInt(m[1]!, 10),
        context: line.trim().slice(0, 100),
        line: i + 1,
      })
    }
  })

  return hits
}

function audit(): Violation[] {
  const violations: Violation[] = []

  if (!existsSync(DOC)) {
    violations.push({
      category: 'structure',
      detail: `ENGINEERING-DISCIPLINE.md not found at ${DOC}`,
    })
    return violations
  }

  // Strip marker-sync HTML comments so the regex can match "46 auditors"
  // in doc occurrences now wrapped as "<!-- auditor-count:begin -->46<!-- auditor-count:end --> auditors".
  const content = readFileSync(DOC, 'utf8').replace(/<!-- auditor-count:(?:begin|end) -->/g, '')
  const actualCount = auditorCountFromPackageJson()
  const claims = countsInDoc(content)

  // Check A — internal consistency
  const uniqueValues = new Set(claims.map((c) => c.value))
  if (uniqueValues.size > 1) {
    violations.push({
      category: 'internal',
      detail: `ENGINEERING-DISCIPLINE.md has ${uniqueValues.size} different auditor counts: ${[...uniqueValues].join(', ')}. All must agree.`,
    })
    for (const c of claims) {
      violations.push({
        category: 'internal',
        detail: `  line ${c.line}: "${c.value}" in "${c.context}"`,
      })
    }
  }

  // Check B — reality
  if (claims.length === 0) {
    violations.push({
      category: 'reality',
      detail: `ENGINEERING-DISCIPLINE.md has no auditor count at all. Expected at least one reference to "${actualCount} auditors".`,
    })
  } else if (uniqueValues.size === 1) {
    const claimed = [...uniqueValues][0]!
    if (claimed !== actualCount) {
      violations.push({
        category: 'reality',
        detail: `ENGINEERING-DISCIPLINE.md claims ${claimed} auditors; package.json test:compliance chain has ${actualCount}. Update the doc.`,
      })
    }
  }

  // Check C — verification table presence
  if (!/^##\s+Verify what this page claims/m.test(content)) {
    violations.push({
      category: 'structure',
      detail:
        'ENGINEERING-DISCIPLINE.md is missing its "Verify what this page claims" section. This is the public commitment that every claim corresponds to a runnable check; it must not silently disappear.',
    })
  }

  return violations
}

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function main(): void {
  console.log(`${BOLD}Engineering Discipline Parity Audit${RESET}`)
  console.log(
    `${DIM}Verifies ENGINEERING-DISCIPLINE.md auditor counts are internally consistent${RESET}`,
  )
  console.log(
    `${DIM}and match the actual test:compliance chain. Ships in-app via DocsPage.vue.${RESET}`,
  )
  console.log()

  const violations = audit()

  if (violations.length === 0) {
    const actual = auditorCountFromPackageJson()
    console.log(`  ${GREEN}✓${RESET} Counts internally consistent and match reality (${actual} auditors)`)
    console.log(`  ${GREEN}✓${RESET} Verification table present`)
    console.log()
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — engineering-discipline doc is in parity`)
    process.exit(0)
  }

  for (const v of violations) {
    console.log(`  ${RED}✗${RESET} [${v.category}] ${v.detail}`)
  }
  console.log()
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${violations.length} violation(s)`)
  console.log()
  console.log('Remediation:')
  console.log(
    '  - Internal drift: update every auditor-count reference in ENGINEERING-DISCIPLINE.md to agree.',
  )
  console.log(
    '  - Reality drift: the count must equal the number of `npm run audit:*` entries in package.json test:compliance.',
  )
  console.log(
    '  - Missing section: restore the "Verify what this page claims" table (see doc history).',
  )
  console.log()
  console.log(
    `${DIM}Canonical internal reference (Mark + Yuri maintain): Forge/ENGINEERING-DISCIPLINE-INTERNAL.md${RESET}`,
  )
  process.exit(1)
}

main()

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Numeric-Claims Generator
 *
 * Single source of truth for the numeric claims cited across investor +
 * marketing materials. Previously hardcoded in multiple places that drifted
 * (PITCH-DECK.md stats cards, detail table, speaker note — four separate
 * citations of the same number with three different values at times).
 *
 * Computes:
 *   - auditorCount: count of audit:* entries in package.json test:compliance
 *   - testCount: sum of it(/test( declarations across four suites
 *   - testBreakdown: per-suite counts (unit, backend, tui, e2e)
 *
 * Writes to business/investor/numeric-claims.json (canonical store) AND
 * substitutes between marker comments in business/investor/PITCH-DECK.md:
 *
 *   <!--claim:auditorCount-->43<!--/claim:auditorCount-->
 *   <!--claim:testCount-->1655<!--/claim:testCount-->
 *   <!--claim:testCountFormatted-->1,655<!--/claim:testCountFormatted-->
 *   <!--claim:testBreakdown-->266 unit + 852 backend + 183 TUI + 354 E2E<!--/claim:testBreakdown-->
 *
 * Registered in verify-generated-artifact-freshness.ts so the auditor
 * catches drift at push time.
 *
 * Invocation:
 *   npx tsx scripts/generate-numeric-claims.ts
 *   or: npm run generate:numeric-claims
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

const PKG_JSON = resolve(CODE_ROOT, 'package.json')
const PITCH_DECK = resolve(PROJECT_ROOT, 'business', 'investor', 'PITCH-DECK.md')
const CLAIMS_JSON = resolve(PROJECT_ROOT, 'business', 'investor', 'numeric-claims.json')

// ─── Auditor count ─────────────────────────────────────────────────────────

function countAuditors(): number {
  // Source of truth is scripts/run-compliance.ts AUDITORS array (the
  // test:compliance chain now delegates to that runner). Parse
  // 'audit:*' string literals from it.
  const runCompliancePath = resolve(CODE_ROOT, 'scripts', 'run-compliance.ts')
  if (!existsSync(runCompliancePath)) {
    // Fallback: parse from the old chained script if run-compliance.ts
    // is not yet present. Supports pre-migration invocation + scaffolds
    // for portability to other projects.
    const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf8'))
    const chain: string = pkg.scripts?.['test:compliance'] ?? ''
    const matches = chain.match(/npm\s+run\s+audit:[a-z0-9-]+/g) ?? []
    return matches.length
  }
  const src = readFileSync(runCompliancePath, 'utf8')
  const matches = src.match(/'audit:[\w-]+'/g) ?? []
  return matches.length
}

// ─── Test counts ────────────────────────────────────────────────────────────

interface SuiteSpec {
  name: string
  roots: string[]
  pattern: RegExp
}

const SUITES: SuiteSpec[] = [
  {
    name: 'unit',
    roots: [resolve(CODE_ROOT, 'src'), resolve(CODE_ROOT, 'testing', 'unit')],
    pattern: /\.(spec|test)\.(ts|tsx|js|mjs)$/,
  },
  {
    name: 'backend',
    roots: [resolve(CODE_ROOT, 'backend', 'tests')],
    pattern: /\.(spec|test)\.(ts|js)$/,
  },
  {
    name: 'tui',
    roots: [resolve(CODE_ROOT, 'tui', 'src'), resolve(CODE_ROOT, 'tui', 'tests')],
    pattern: /\.(spec|test)\.(ts|tsx)$/,
  },
  {
    name: 'e2e',
    roots: [resolve(CODE_ROOT, 'testing', 'e2e')],
    pattern: /\.spec\.ts$/,
  },
]

// Count `it(` / `test(` declarations in a spec file. Tolerates `it.skip(`,
// `it.only(`, `test.skip(`, `test.only(`, `it.each(`. Ignores occurrences
// inside block comments (approximate — won't catch cleverly nested cases).
function countTestsInFile(path: string): number {
  const text = readFileSync(path, 'utf8')
  // Strip /* ... */ block comments (simple pass; doesn't handle all edge cases).
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '')
  const matches = stripped.match(/^\s*(it|test)(?:\.(?:skip|only|each|todo|concurrent|sequential))*\s*\(/gm) ?? []
  return matches.length
}

function walkForSpecs(dir: string, pattern: RegExp, out: string[]): void {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry)
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const st = statSync(full)
    if (st.isDirectory()) {
      walkForSpecs(full, pattern, out)
    } else if (pattern.test(entry)) {
      out.push(full)
    }
  }
}

function countSuite(spec: SuiteSpec): number {
  const files: string[] = []
  for (const root of spec.roots) walkForSpecs(root, spec.pattern, files)
  let total = 0
  for (const f of files) total += countTestsInFile(f)
  return total
}

// ─── PITCH-DECK substitution ────────────────────────────────────────────────

function substituteClaim(text: string, claim: string, value: string): string {
  const pattern = new RegExp(
    `(<!--claim:${claim}-->)[\\s\\S]*?(<!--/claim:${claim}-->)`,
    'g',
  )
  return text.replace(pattern, `$1${value}$2`)
}

function substituteAllClaims(deckText: string, claims: Record<string, string>): string {
  let out = deckText
  for (const [claim, value] of Object.entries(claims)) {
    out = substituteClaim(out, claim, value)
  }
  return out
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main(): void {
  const auditorCount = countAuditors()

  const breakdown: Record<string, number> = {}
  let testCount = 0
  for (const suite of SUITES) {
    const n = countSuite(suite)
    breakdown[suite.name] = n
    testCount += n
  }

  const testCountFormatted = testCount.toLocaleString('en-US')
  const testBreakdown = `${breakdown.unit} unit + ${breakdown.backend} backend + ${breakdown.tui} TUI + ${breakdown.e2e} E2E`

  const claims = {
    auditorCount: String(auditorCount),
    testCount: String(testCount),
    testCountFormatted,
    testBreakdown,
  }

  // Deliberately no `generated` timestamp — it would churn every run and
  // make the freshness auditor fail even when the substantive values are
  // unchanged. Git log records when the file was last touched; that's the
  // canonical "generated when" answer.
  const jsonOut = {
    source: 'code/scripts/generate-numeric-claims.ts',
    auditorCount,
    testCount,
    testBreakdown: breakdown,
  }
  writeFileSync(CLAIMS_JSON, JSON.stringify(jsonOut, null, 2) + '\n')
  console.log(`Wrote ${CLAIMS_JSON}`)
  console.log(`  auditors: ${auditorCount}`)
  console.log(
    `  tests: ${testCount} (${breakdown.unit} unit + ${breakdown.backend} backend + ${breakdown.tui} TUI + ${breakdown.e2e} E2E)`,
  )

  if (existsSync(PITCH_DECK)) {
    const deckBefore = readFileSync(PITCH_DECK, 'utf8')
    const deckAfter = substituteAllClaims(deckBefore, claims)
    if (deckBefore !== deckAfter) {
      writeFileSync(PITCH_DECK, deckAfter)
      console.log(`Updated ${PITCH_DECK}`)
    } else {
      console.log(`${PITCH_DECK} already in sync`)
    }
  }
}

main()

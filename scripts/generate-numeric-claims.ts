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
import { execFileSync } from 'child_process'

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
//
// Methodology (important for investor-deck claims):
//
//   Unit / Backend / TUI — run `vitest run --reporter=json` in each suite
//     directory. Vitest emits numTotalTests, which is the authoritative
//     runtime count (includes dynamically-generated tests from
//     describe.each / it.each). This is the correct number for the deck.
//     Adds ~30-60s per suite to generator invocation; acceptable — the
//     generator only fires when package.json or test files are staged.
//
//   E2E — regex-counted by scanning testing/e2e/*.spec.ts for
//     `test(` / `it(` declarations. Playwright's `--list --reporter=json`
//     would give the authoritative number but is blocked by a project
//     hook (E2E tests must run via Docker only). Docker invocation is too
//     heavy for a pre-commit generator. Grep confirms no `describe.each`
//     / `it.each` in E2E specs, so the regex count is exact for the
//     current codebase. If `.each` patterns enter E2E, the generator
//     should gain a Docker-based authoritative path.
//
//   Fallback — if vitest fails for any reason (dependency issue,
//     environment state), fall back to the same regex method used for
//     E2E. Reported with a `fallback: true` flag in the JSON output.
//     Approximate numbers beat no numbers when a release ships.
//
// --measure flag re-runs vitest even if the cached JSON exists; without
// it, the generator runs vitest every time (no caching) because test
// files change often and caching would lie.

interface SuiteSpec {
  name: string
  authoritative?: { cwd: string } // cwd for `vitest run --reporter=json`
  regexFallback: { roots: string[]; pattern: RegExp } // used for E2E + failure fallback
}

const SUITES: SuiteSpec[] = [
  {
    name: 'unit',
    authoritative: { cwd: CODE_ROOT },
    regexFallback: {
      roots: [resolve(CODE_ROOT, 'src'), resolve(CODE_ROOT, 'testing', 'unit')],
      pattern: /\.(spec|test)\.(ts|tsx|js|mjs)$/,
    },
  },
  {
    name: 'backend',
    authoritative: { cwd: resolve(CODE_ROOT, 'backend') },
    regexFallback: {
      roots: [resolve(CODE_ROOT, 'backend', 'tests')],
      pattern: /\.(spec|test)\.(ts|js)$/,
    },
  },
  {
    name: 'tui',
    authoritative: { cwd: resolve(CODE_ROOT, 'tui') },
    regexFallback: {
      roots: [resolve(CODE_ROOT, 'tui', 'src'), resolve(CODE_ROOT, 'tui', 'tests')],
      pattern: /\.(spec|test)\.(ts|tsx)$/,
    },
  },
  {
    name: 'e2e',
    // Playwright --list is hook-blocked; Docker invocation too heavy for
    // a pre-commit generator. Regex is authoritative here.
    regexFallback: {
      roots: [resolve(CODE_ROOT, 'testing', 'e2e')],
      pattern: /\.spec\.ts$/,
    },
  },
]

function countTestsInFile(path: string): number {
  const text = readFileSync(path, 'utf8')
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

function countSuiteRegex(spec: SuiteSpec): number {
  const files: string[] = []
  for (const root of spec.regexFallback.roots)
    walkForSpecs(root, spec.regexFallback.pattern, files)
  let total = 0
  for (const f of files) total += countTestsInFile(f)
  return total
}

interface SuiteResult {
  count: number
  method: 'vitest-json' | 'regex-fallback' | 'regex-authoritative'
}

function countSuite(spec: SuiteSpec): SuiteResult {
  if (!spec.authoritative) {
    // Regex is authoritative (E2E today).
    return { count: countSuiteRegex(spec), method: 'regex-authoritative' }
  }
  try {
    const out = execFileSync('npx', ['vitest', 'run', '--reporter=json'], {
      cwd: spec.authoritative.cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    })
    const data = JSON.parse(out) as { numTotalTests?: number }
    if (typeof data.numTotalTests === 'number') {
      return { count: data.numTotalTests, method: 'vitest-json' }
    }
    throw new Error('vitest JSON missing numTotalTests')
  } catch {
    return { count: countSuiteRegex(spec), method: 'regex-fallback' }
  }
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
  const methods: Record<string, string> = {}
  let testCount = 0
  for (const suite of SUITES) {
    const result = countSuite(suite)
    breakdown[suite.name] = result.count
    methods[suite.name] = result.method
    testCount += result.count
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
  //
  // `methods` records per-suite methodology (vitest-json = authoritative
  // runtime count; regex-fallback = vitest failed, approximate count;
  // regex-authoritative = the only available method, exact here because
  // no .each() patterns). Investor-facing narratives should cite
  // "authoritative count" only when every suite reports vitest-json or
  // regex-authoritative.
  const jsonOut = {
    source: 'code/scripts/generate-numeric-claims.ts',
    auditorCount,
    testCount,
    testBreakdown: breakdown,
    methods,
  }
  writeFileSync(CLAIMS_JSON, JSON.stringify(jsonOut, null, 2) + '\n')
  console.log(`Wrote ${CLAIMS_JSON}`)
  console.log(`  auditors: ${auditorCount}`)
  console.log(
    `  tests: ${testCount} (${breakdown.unit} unit [${methods.unit}] + ${breakdown.backend} backend [${methods.backend}] + ${breakdown.tui} TUI [${methods.tui}] + ${breakdown.e2e} E2E [${methods.e2e}])`,
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

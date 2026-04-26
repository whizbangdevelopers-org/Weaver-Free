// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * CodeQL ↔ Semgrep Coverage Gap Auditor
 *
 * Reads scripts/data/codeql-semgrep-map.json and reports:
 *   - Coverage % = (covered + partially-covered) / (covered + partially-covered + known-missing)
 *   - Any 'unknown' rule entries (need triage → open tracking issue via codeql-feedback workflow)
 *   - Warning if coverage % has dropped below the committed baseline
 *
 * Runs locally without network access. Does not call the GitHub API.
 * See .github/workflows/codeql-feedback.yml for the CI workflow that
 * refreshes the map with live alert data.
 *
 * Exit 0 = pass (coverage at or above baseline, no unknown rules).
 * Exit 1 = fail (unknown rules present, or coverage dropped below baseline).
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAP_PATH = join(__dirname, 'data', 'codeql-semgrep-map.json')

interface RuleEntry {
  status: 'covered' | 'partially-covered' | 'known-missing' | 'tool-handled' | 'not-applicable' | 'scorecard' | 'unknown'
  severity?: string
  semgrepRuleId?: string
  tool?: string
  lastSeen?: string
  notes?: string
}

interface CoverageMap {
  _meta: {
    lastRefreshed: string
    sourceRepo: string
    coverageBaseline: number
    coverageExcludes: string[]
    notes: string
  }
  rules: Record<string, RuleEntry>
}

function pct(n: number): string {
  return (n * 100).toFixed(0) + '%'
}

function run(): void {
  console.log('\x1b[1mCodeQL ↔ Semgrep Coverage Audit\x1b[0m')
  console.log('\x1b[2mChecks coverage % and flags unknown rules in codeql-semgrep-map.json\x1b[0m\n')

  let map: CoverageMap
  try {
    map = JSON.parse(readFileSync(MAP_PATH, 'utf-8')) as CoverageMap
  } catch {
    console.error('\x1b[31m✗ Could not read scripts/data/codeql-semgrep-map.json\x1b[0m')
    process.exit(1)
  }

  const { _meta, rules } = map
  const excludes = new Set(_meta.coverageExcludes)

  const covered: string[] = []
  const partiallyCovered: string[] = []
  const knownMissing: string[] = []
  const unknown: string[] = []

  for (const [ruleId, entry] of Object.entries(rules)) {
    if (excludes.has(entry.status)) continue
    switch (entry.status) {
      case 'covered':         covered.push(ruleId); break
      case 'partially-covered': partiallyCovered.push(ruleId); break
      case 'known-missing':   knownMissing.push(ruleId); break
      case 'unknown':         unknown.push(ruleId); break
    }
  }

  const numerator = covered.length + partiallyCovered.length
  const denominator = numerator + knownMissing.length
  const coverage = denominator === 0 ? 1 : numerator / denominator

  // Report breakdown
  console.log(`  Covered:           ${covered.length} rules`)
  if (partiallyCovered.length > 0) {
    console.log(`  Partially covered: ${partiallyCovered.length} rules`)
    for (const r of partiallyCovered) {
      console.log(`    \x1b[2m${r} → ${rules[r].semgrepRuleId ?? '?'}\x1b[0m`)
    }
  }
  console.log(`  Known missing:     ${knownMissing.length} rules`)
  for (const r of knownMissing.filter(id => (rules[id].severity ?? '') === 'high')) {
    console.log(`    \x1b[33m⚠ high: ${r}\x1b[0m`)
  }
  console.log(`  Tool-handled:      ${Object.values(rules).filter(e => e.status === 'tool-handled').length} rules`)
  console.log(`  Not applicable:    ${Object.values(rules).filter(e => e.status === 'not-applicable').length} rules`)
  console.log()

  // Coverage line
  const baseline = _meta.coverageBaseline
  const coverageStr = pct(coverage)
  const baselineStr = pct(baseline)
  const coverageLine = `Coverage: ${coverageStr} (baseline ${baselineStr}, refreshed ${_meta.lastRefreshed})`

  if (unknown.length > 0) {
    console.error(`\x1b[31m✗ ${unknown.length} unknown rule(s) — triage required:\x1b[0m`)
    for (const r of unknown) {
      console.error(`  ${r}`)
    }
    console.error(`\x1b[2mRun the codeql-feedback workflow to open tracking issues.\x1b[0m`)
    console.error()
    console.error(`  ${coverageLine}`)
    process.exit(1)
  }

  if (coverage < baseline - 0.01) {
    console.error(`\x1b[31m✗ Coverage dropped below baseline: ${coverageStr} < ${baselineStr}\x1b[0m`)
    console.error(`\x1b[2mA previously-covered rule may have been reclassified. Update the map or refresh the baseline.\x1b[0m`)
    process.exit(1)
  }

  if (coverage > baseline + 0.05) {
    console.log(`\x1b[32m✓\x1b[0m ${coverageLine}`)
    console.log(`\x1b[2m  Coverage exceeds baseline by >5% — consider refreshing coverageBaseline in the map.\x1b[0m`)
  } else {
    console.log(`\x1b[32m✓\x1b[0m ${coverageLine}`)
  }

  process.exit(0)
}

run()

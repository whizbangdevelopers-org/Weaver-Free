// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Refresh CodeQL ↔ Semgrep Coverage Map
 *
 * Fetches live CodeQL alerts from Weaver-Free, compares against the committed
 * codeql-semgrep-map.json, and:
 *   - Updates `lastSeen` for rules already in the map
 *   - Adds new rules as `unknown` status
 *   - Writes the updated map back to disk
 *
 * REPORTING IS NOT THIS SCRIPT'S JOB. `codeql-feedback.yml` runs the coverage
 * auditor after this script and routes the finding to a single self-closing
 * triage issue on the running repo. A per-rule `gh issue create` lived here
 * until 2026-07-22: it passed no `--repo`, so it resolved the Dev remote while
 * inheriting the Weaver-Free-scoped PAT that this script needs to read alerts —
 * it never once succeeded, and it failed inside a try/catch as a `console.warn`
 * in an otherwise green run. It also had no close path, so had it worked it
 * would have accumulated stale open security-labelled issues. Do not
 * reintroduce it; extend the workflow's triage-issue step instead.
 *
 * Requires: gh CLI authenticated with WEAVER_FREE_CODEQL_READ (security_events: read)
 *
 * Usage:
 *   npx tsx scripts/refresh-codeql-coverage-map.ts \
 *     --repo whizbangdevelopers-org/Weaver-Free \
 *     --map scripts/data/codeql-semgrep-map.json
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface RuleEntry {
  status: string
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

interface CodeQLAlert {
  rule: { id: string; security_severity_level?: string; description?: string }
  state: string
}

function parseArgs(): { repo: string; mapPath: string } {
  const args = process.argv.slice(2)
  let repo = 'whizbangdevelopers-org/Weaver-Free'
  let mapPath = resolve(__dirname, 'data', 'codeql-semgrep-map.json')
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && args[i + 1]) repo = args[++i]
    else if (args[i] === '--map' && args[i + 1]) mapPath = resolve(process.cwd(), args[++i])
  }
  return { repo, mapPath }
}

function fetchAlerts(repo: string): CodeQLAlert[] {
  const raw = execSync(
    `gh api repos/${repo}/code-scanning/alerts --paginate`,
    { encoding: 'utf-8' }
  )
  return JSON.parse(raw) as CodeQLAlert[]
}

/**
 * The new `lastSeen` for a rule that is firing today, or null when nothing changes.
 *
 * `never-fired` is not exempt. Until 2026-09-25 this condition skipped it, so the one transition
 * that matters most — a proactively-mapped rule firing for the FIRST time — was never recorded,
 * and js/path-injection kept notes saying "CodeQL has not fired" while five alerts were open.
 */
export function nextLastSeen(current: string | undefined, today: string): string | null {
  return current === today ? null : today
}

function selfTest(): void {
  const cases: [string, string | undefined, string | null][] = [
    ['CATCH a never-fired rule that fires is recorded', 'never-fired', '2026-09-25'],
    ['CATCH a stale date moves to today', '2026-09-24', '2026-09-25'],
    ['CATCH a rule with no lastSeen gets one', undefined, '2026-09-25'],
    ['IGNORE a rule already seen today is unchanged', '2026-09-25', null],
  ]
  let failed = 0
  for (const [name, current, want] of cases) {
    const got = nextLastSeen(current, '2026-09-25')
    if (got === want) console.log(`  ok   ${name}`)
    else { failed++; console.log(`  FAIL ${name} (got ${got}, want ${want})`) }
  }
  console.log(`auditor-contract: catch=3 ignore=1`)
  process.exit(failed ? 1 : 0)
}

function run(): void {
  const { repo, mapPath } = parseArgs()
  const today = new Date().toISOString().slice(0, 10)

  console.log(`Fetching CodeQL alerts from ${repo}...`)
  const alerts = fetchAlerts(repo)
  console.log(`  ${alerts.length} alerts fetched`)

  const map = JSON.parse(readFileSync(mapPath, 'utf-8')) as CoverageMap
  let changed = false
  let newCount = 0

  // Collect unique rule IDs seen in alerts
  const seen = new Map<string, { severity: string; description: string }>()
  for (const alert of alerts) {
    const id = alert.rule.id
    if (!seen.has(id)) {
      seen.set(id, {
        severity: alert.rule.security_severity_level ?? '',
        description: alert.rule.description ?? '',
      })
    }
  }

  for (const [ruleId, { severity, description }] of seen.entries()) {
    if (ruleId in map.rules) {
      const next = nextLastSeen(map.rules[ruleId].lastSeen, today)
      if (next) {
        if (map.rules[ruleId].lastSeen === 'never-fired') {
          // Its notes were written for a rule that had not fired. Say so; do not rewrite them.
          console.log(`  ⚠ ${ruleId} fired for the first time — re-check its status and notes`)
        }
        map.rules[ruleId].lastSeen = next
        changed = true
      }
    } else {
      // New unknown rule
      console.log(`  ⚠ Unknown rule: ${ruleId} (${severity || 'no severity'})`)
      map.rules[ruleId] = {
        status: 'unknown',
        severity: severity || undefined,
        lastSeen: today,
        notes: description || undefined,
      }
      changed = true
      newCount++
    }
  }

  map._meta.lastRefreshed = today

  if (changed) {
    writeFileSync(mapPath, JSON.stringify(map, null, 2) + '\n', 'utf-8')
    console.log(`  Map updated (${newCount} new rules, lastRefreshed → ${today})`)
  } else {
    console.log(`  Map unchanged — all rules known, lastSeen current`)
  }

  if (newCount > 0) {
    console.log(`  ${newCount} unknown rule(s) recorded — the coverage auditor will fail`)
    console.log(`  and codeql-feedback.yml routes that to the triage issue.`)
  }
}

if (process.argv.includes('--self-test')) selfTest()
else run()

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Refresh CodeQL ↔ Semgrep Coverage Map
 *
 * Fetches live CodeQL alerts from Weaver-Free, compares against the committed
 * codeql-semgrep-map.json, and:
 *   - Updates `lastSeen` for rules already in the map
 *   - Adds new rules as `unknown` status (triggers issue creation if --open-issues)
 *   - Opens a tracking issue on Weaver-Dev for each unknown rule
 *   - Writes the updated map back to disk
 *
 * Requires: gh CLI authenticated with WEAVER_FREE_CODEQL_READ (security_events: read)
 *
 * Usage:
 *   npx tsx scripts/refresh-codeql-coverage-map.ts \
 *     --repo whizbangdevelopers-org/Weaver-Free \
 *     --map scripts/data/codeql-semgrep-map.json \
 *     [--open-issues]
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

function parseArgs(): { repo: string; mapPath: string; openIssues: boolean } {
  const args = process.argv.slice(2)
  let repo = 'whizbangdevelopers-org/Weaver-Free'
  let mapPath = resolve(__dirname, 'data', 'codeql-semgrep-map.json')
  let openIssues = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--repo' && args[i + 1]) repo = args[++i]
    else if (args[i] === '--map' && args[i + 1]) mapPath = resolve(process.cwd(), args[++i])
    else if (args[i] === '--open-issues') openIssues = true
  }
  return { repo, mapPath, openIssues }
}

function fetchAlerts(repo: string): CodeQLAlert[] {
  const raw = execSync(
    `gh api repos/${repo}/code-scanning/alerts --paginate`,
    { encoding: 'utf-8' }
  )
  return JSON.parse(raw) as CodeQLAlert[]
}

function openIssue(ruleId: string, severity: string, description: string): void {
  const title = `[security] Unknown CodeQL rule: ${ruleId}`
  const body = [
    `A new CodeQL rule was detected on Weaver-Free that is not yet in \`codeql-semgrep-map.json\`.`,
    ``,
    `**Rule ID:** \`${ruleId}\``,
    `**Severity:** ${severity || 'unknown'}`,
    `**Description:** ${description || 'n/a'}`,
    ``,
    `## Action required`,
    ``,
    `1. Review the alert on Weaver-Free: https://github.com/whizbangdevelopers-org/Weaver-Free/security/code-scanning?query=${encodeURIComponent(ruleId)}`,
    `2. Determine whether a Semgrep taint rule covers this class.`,
    `3. Update \`code/scripts/data/codeql-semgrep-map.json\` with one of:`,
    `   - \`"covered"\` + \`semgrepRuleId\` — Semgrep rule already catches this`,
    `   - \`"known-missing"\` — acknowledged gap, document why`,
    `   - \`"tool-handled"\` + \`tool\` — another tool covers this`,
    `   - \`"not-applicable"\` — rule class doesn't apply to this codebase`,
    ``,
    `See [KNOWN-GOTCHAS.md](code/docs/development/KNOWN-GOTCHAS.md) § Static Analysis for the coverage-map conventions.`,
  ].join('\n')

  try {
    execSync(`gh issue create --title ${JSON.stringify(title)} --body ${JSON.stringify(body)} --label "security,triage"`, {
      encoding: 'utf-8',
      env: { ...process.env }
    })
    console.log(`  ✓ Opened tracking issue: ${title}`)
  } catch (err) {
    console.warn(`  ⚠ Could not open issue for ${ruleId}: ${err}`)
  }
}

function run(): void {
  const { repo, mapPath, openIssues } = parseArgs()
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
      // Update lastSeen
      if (map.rules[ruleId].lastSeen !== today && map.rules[ruleId].lastSeen !== 'never-fired') {
        map.rules[ruleId].lastSeen = today
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
      if (openIssues) {
        openIssue(ruleId, severity, description)
      }
    }
  }

  map._meta.lastRefreshed = today

  if (changed) {
    writeFileSync(mapPath, JSON.stringify(map, null, 2) + '\n', 'utf-8')
    console.log(`  Map updated (${newCount} new rules, lastRefreshed → ${today})`)
  } else {
    console.log(`  Map unchanged — all rules known, lastSeen current`)
  }

  if (newCount > 0 && !openIssues) {
    console.log(`  Run with --open-issues to create tracking issues for unknown rules`)
  }
}

run()

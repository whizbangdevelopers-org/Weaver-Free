// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * GitHub Code Scanning Audit
 *
 * Fetches open CodeQL alerts from Weaver-Free, deduplicates the path-doubled
 * findings (the Free repo CodeQL database reports both bare paths and
 * code/-prefixed paths for the same file), and classifies them into:
 *
 *   FAIL  — production code (backend/src/, src/, tui/src/) with error severity
 *            OR a security-tagged warning
 *   WARN  — quality findings in production, any finding in scripts/tests/docs
 *   SKIP  — OpenSSF Scorecard posture checks (rule IDs ending in …ID)
 *   SKIP  — Entries in scripts/baselines/code-scanning-dismiss.json
 *
 * Exits 1 if any FAIL findings exist. Exits 0 on clean or warnings-only.
 *
 * Requires: gh CLI authenticated with read:security_events on Weaver-Free.
 *
 * Usage:
 *   npx tsx scripts/audit-code-scanning.ts
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const FREE_REPO = 'whizbangdevelopers-org/Weaver-Free'
const DISMISS_CONFIG = resolve(__dirname, 'baselines', 'code-scanning-dismiss.json')

// ---------------------------------------------------------------------------
// ANSI Colors
// ---------------------------------------------------------------------------

const C = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

function pass(msg: string): void { console.log(`  ${C.green}✓${C.reset} ${msg}`) }
function fail(msg: string): void { console.log(`  ${C.red}✗${C.reset} ${msg}`) }
function warn(msg: string): void { console.log(`  ${C.yellow}⚠${C.reset} ${msg}`) }
function info(msg: string): void { console.log(`  ${C.dim}○${C.reset} ${C.dim}${msg}${C.reset}`) }

function heading(title: string): void {
  console.log(`\n${C.bold}${C.cyan}${title}${C.reset}`)
  console.log(C.dim + '─'.repeat(title.length) + C.reset)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertRule {
  id: string
  severity: 'error' | 'warning' | 'note' | 'none'
  tags: string[]
  description: string
}

interface Alert {
  number: number
  state: 'open' | 'dismissed' | 'fixed'
  rule: AlertRule
  most_recent_instance: {
    location: { path: string; start_line: number }
    message: { text: string }
  }
}

interface DismissEntry {
  rule: string
  path: string
  reason: string
  addedDate: string
}

interface DismissConfig {
  dismissed: DismissEntry[]
}

type LocationClass = 'production' | 'test' | 'script' | 'other'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip the code/ prefix that the Free repo CodeQL database double-reports. */
function normalizePath(p: string): string {
  return p.startsWith('code/') ? p.slice(5) : p
}

function classifyPath(p: string): LocationClass {
  if (/^(backend\/src\/|src\/|tui\/src\/)/.test(p)) return 'production'
  if (/\.(spec|test)\.[cm]?[tj]sx?$|\/tests?\/|\/testing\//.test(p)) return 'test'
  if (/^(scripts\/|docs\/)/.test(p)) return 'script'
  return 'other' // conservative: treat as production
}

/** True if this finding should block a release when found in production code. */
function isSecurityFail(rule: AlertRule): boolean {
  if (rule.severity === 'error') return true
  if (rule.severity === 'warning' && rule.tags.includes('security')) return true
  return false
}

/** True if this rule is an OpenSSF Scorecard posture check, not a code bug. */
function isScorecardRule(ruleId: string): boolean {
  return ruleId.endsWith('ID')
}

function loadDismissed(): DismissEntry[] {
  if (!existsSync(DISMISS_CONFIG)) return []
  try {
    const raw = readFileSync(DISMISS_CONFIG, 'utf-8')
    return (JSON.parse(raw) as DismissConfig).dismissed ?? []
  } catch {
    console.warn(`  ${C.yellow}⚠${C.reset} Could not parse ${DISMISS_CONFIG} — no dismissals applied`)
    return []
  }
}

function isDismissed(alert: Alert, normalizedPath: string, dismissed: DismissEntry[]): DismissEntry | undefined {
  return dismissed.find(d => d.rule === alert.rule.id && d.path === normalizedPath)
}

function ghFetchAlerts(): Alert[] {
  const raw = execSync(
    `gh api repos/${FREE_REPO}/code-scanning/alerts --paginate`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  )
  return JSON.parse(raw) as Alert[]
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startMs = Date.now()

  console.log(`\n${C.bold}Code Scanning Audit — ${FREE_REPO}${C.reset}`)
  console.log(`${C.dim}Config: ${DISMISS_CONFIG.replace(ROOT + '/', '')}${C.reset}`)

  // Check gh CLI
  try {
    execSync('gh auth status', { stdio: 'pipe' })
  } catch {
    console.error(`\n${C.red}gh CLI not authenticated. Run: gh auth login${C.reset}`)
    process.exit(1)
  }

  // Fetch alerts
  let alerts: Alert[]
  try {
    alerts = ghFetchAlerts()
  } catch (e: unknown) {
    console.error(`\n${C.red}Failed to fetch alerts from GitHub:${C.reset}`, (e as Error).message ?? e)
    process.exit(1)
  }

  const dismissed = loadDismissed()

  // Deduplicate: code/-prefixed and bare paths for the same file appear as separate alerts.
  // Keep one canonical entry per {ruleId, normalizedPath, startLine}.
  const seen = new Set<string>()
  const deduped: Array<{ alert: Alert; path: string; loc: LocationClass }> = []

  for (const alert of alerts) {
    if (alert.state !== 'open') continue
    if (isScorecardRule(alert.rule.id)) continue

    const rawPath = alert.most_recent_instance.location.path
    const normalizedPath = normalizePath(rawPath)
    const line = alert.most_recent_instance.location.start_line
    const key = `${alert.rule.id}:${normalizedPath}:${line}`

    if (seen.has(key)) continue
    seen.add(key)

    deduped.push({ alert, path: normalizedPath, loc: classifyPath(normalizedPath) })
  }

  // Partition into buckets
  const failures: typeof deduped = []
  const warnings: typeof deduped = []
  const skipped: Array<{ alert: Alert; path: string; entry: DismissEntry }> = []

  for (const item of deduped) {
    const dismissEntry = isDismissed(item.alert, item.path, dismissed)
    if (dismissEntry) {
      skipped.push({ alert: item.alert, path: item.path, entry: dismissEntry })
      continue
    }

    const inProduction = item.loc === 'production' || item.loc === 'other'
    if (inProduction && isSecurityFail(item.alert.rule)) {
      failures.push(item)
    } else {
      warnings.push(item)
    }
  }

  const totalScorecard = alerts.filter(a => a.state === 'open' && isScorecardRule(a.rule.id)).length / 2 | 0 // deduped approx
  const totalOpen = alerts.filter(a => a.state === 'open').length

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------

  heading(`Production Security Failures (${failures.length})`)
  if (failures.length === 0) {
    pass('No production security failures')
  } else {
    for (const { alert, path } of failures) {
      const loc = `${path}:${alert.most_recent_instance.location.start_line}`
      fail(`[${alert.rule.severity}] ${alert.rule.id}  ${C.dim}${loc}${C.reset}`)
      console.log(`         ${C.dim}${alert.most_recent_instance.message.text.slice(0, 120)}${C.reset}`)
    }
  }

  heading(`Warnings (${warnings.length})`)
  if (warnings.length === 0) {
    pass('No warnings')
  } else {
    // Group by rule for readability
    const byRule = new Map<string, typeof warnings>()
    for (const item of warnings) {
      const existing = byRule.get(item.alert.rule.id) ?? []
      existing.push(item)
      byRule.set(item.alert.rule.id, existing)
    }
    for (const [ruleId, items] of byRule) {
      warn(`${ruleId} (${items.length})`)
      for (const { alert, path, loc } of items.slice(0, 3)) {
        const locLabel = loc === 'production' ? '' : ` ${C.dim}[${loc}]${C.reset}`
        console.log(`         ${C.dim}${path}:${alert.most_recent_instance.location.start_line}${C.reset}${locLabel}`)
      }
      if (items.length > 3) {
        console.log(`         ${C.dim}… and ${items.length - 3} more${C.reset}`)
      }
    }
  }

  if (skipped.length > 0) {
    heading(`Dismissed (${skipped.length})`)
    for (const { alert, path, entry } of skipped) {
      info(`${alert.rule.id}  ${path}  — ${entry.reason.slice(0, 80)}`)
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  const durationMs = Date.now() - startMs

  console.log('')
  console.log(C.bold + '═'.repeat(55) + C.reset)
  console.log(`${C.bold}Code Scanning Summary${C.reset}`)
  console.log(C.bold + '═'.repeat(55) + C.reset)
  console.log(`  Total open alerts (raw):  ${totalOpen}`)
  console.log(`  Scorecard posture checks: ~${totalScorecard} (skipped — not code bugs)`)
  console.log(`  Unique code findings:     ${deduped.length}`)
  console.log(`  ${C.red}Production failures:${C.reset}      ${failures.length}`)
  console.log(`  ${C.yellow}Warnings:${C.reset}                 ${warnings.length}`)
  console.log(`  ${C.dim}Dismissed:${C.reset}                ${skipped.length}`)
  console.log('')

  const result = failures.length > 0 ? 'fail' : 'pass'

  saveReport({
    reportName: 'code-scanning',
    timestamp: new Date().toISOString(),
    durationMs,
    result,
    summary: {
      totalOpen,
      uniqueFindings: deduped.length,
      productionFailures: failures.length,
      warnings: warnings.length,
      dismissed: skipped.length,
    },
    data: {
      failures: failures.map(({ alert, path }) => ({
        rule: alert.rule.id,
        severity: alert.rule.severity,
        path,
        line: alert.most_recent_instance.location.start_line,
        message: alert.most_recent_instance.message.text,
      })),
      warnings: warnings.map(({ alert, path, loc }) => ({
        rule: alert.rule.id,
        severity: alert.rule.severity,
        path,
        loc,
        line: alert.most_recent_instance.location.start_line,
      })),
    },
  })

  if (failures.length > 0) {
    console.log(`${C.red}${C.bold}${failures.length} production security finding(s) must be resolved before release.${C.reset}`)
    console.log(`${C.dim}Fix the findings, or add confirmed false positives to scripts/baselines/code-scanning-dismiss.json.${C.reset}`)
    console.log('')
    process.exit(1)
  }

  console.log(`${C.green}${C.bold}All production security checks passed.${C.reset}`)
  if (warnings.length > 0) {
    console.log(`${C.dim}${warnings.length} warning(s) above — not blocking, but worth reviewing.${C.reset}`)
  }
  console.log('')
}

main().catch(err => {
  console.error(`${C.red}Fatal:${C.reset}`, (err as Error).message ?? err)
  process.exit(1)
})

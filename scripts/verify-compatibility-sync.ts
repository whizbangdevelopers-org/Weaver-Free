// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Compatibility Sync Auditor
 *
 * Verifies that the compatibility summary table in README.md matches the
 * master platform table in docs/COMPATIBILITY.md. The COMPATIBILITY.md
 * table is canonical — README must mirror it exactly.
 *
 * The master table is delimited by SYNC:PLATFORM_TABLE:START/END markers.
 *
 * Usage:
 *   npx tsx scripts/verify-compatibility-sync.ts          # Console report
 *   npx tsx scripts/verify-compatibility-sync.ts --json    # JSON output
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

// ANSI colors
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const JSON_MODE = process.argv.includes('--json')

// ---------------------------------------------------------------------------
// File paths
// ---------------------------------------------------------------------------

const COMPATIBILITY_PATH = resolve(rootDir, 'docs/COMPATIBILITY.md')
const README_PATH = resolve(rootDir, 'README.md')

const SYNC_START = '<!-- SYNC:PLATFORM_TABLE:START -->'
const SYNC_END = '<!-- SYNC:PLATFORM_TABLE:END -->'
const README_SYNC_START = '<!-- SYNC:COMPAT_SUMMARY:START -->'
const README_SYNC_END = '<!-- SYNC:COMPAT_SUMMARY:END -->'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Finding {
  check: string
  status: 'pass' | 'fail' | 'warn'
  detail: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract markdown table rows between sync markers. Returns normalized rows. */
function extractSyncBlock(content: string, startMarker: string, endMarker: string): string[] | null {
  const startIdx = content.indexOf(startMarker)
  const endIdx = content.indexOf(endMarker)
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null

  const block = content.slice(startIdx + startMarker.length, endIdx).trim()
  return normalizeTableRows(block)
}

/** Parse a markdown table block into normalized row strings (header + separator excluded). */
function normalizeTableRows(block: string): string[] {
  const lines = block.split('\n').filter(l => l.trim().length > 0)
  // Filter out header and separator rows
  const dataRows: string[] = []
  let pastHeader = false
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip separator row (all dashes/pipes/spaces)
    if (/^\|[\s-:|]+\|$/.test(trimmed)) {
      pastHeader = true
      continue
    }
    // Skip header row (first row before separator)
    if (!pastHeader) continue
    // Normalize: trim cells, collapse whitespace
    const cells = trimmed
      .split('|')
      .filter((_, i, arr) => i > 0 && i < arr.length - 1) // Remove leading/trailing empty
      .map(c => c.trim().replace(/\s+/g, ' '))
    dataRows.push(cells.join(' | '))
  }
  return dataRows
}

/** Extract just Platform + Status columns from full compatibility rows. */
function extractPlatformStatus(rows: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of rows) {
    const cells = row.split(' | ')
    if (cells.length >= 6) {
      // Full table: Platform | Arch | Dashboard | Provisioning | Passthrough | Status
      const platform = `${cells[0]} (${cells[1]})`
      const status = cells[5]
      map.set(platform, status)
    }
  }
  return map
}

/** Extract summary rows (Platform | Arch | Provisioning | Status). */
function extractSummaryStatus(rows: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of rows) {
    const cells = row.split(' | ')
    if (cells.length >= 4) {
      const platform = `${cells[0]} (${cells[1]})`
      const status = cells[cells.length - 1]
      map.set(platform, status)
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run(): void {
  const startTime = Date.now()
  const findings: Finding[] = []
  let errors = 0
  let warnings = 0
  let passes = 0

  const addFinding = (check: string, status: 'pass' | 'fail' | 'warn', detail: string): void => {
    findings.push({ check, status, detail })
    if (status === 'pass') passes++
    else if (status === 'fail') errors++
    else warnings++
  }

  // 1. Check COMPATIBILITY.md exists and has sync markers
  if (!existsSync(COMPATIBILITY_PATH)) {
    addFinding('COMPATIBILITY.md exists', 'fail', 'File not found at docs/COMPATIBILITY.md')
    report(findings, errors, warnings, passes, Date.now() - startTime)
    return
  }
  addFinding('COMPATIBILITY.md exists', 'pass', 'Found')

  const compatContent = readFileSync(COMPATIBILITY_PATH, 'utf-8')
  const masterRows = extractSyncBlock(compatContent, SYNC_START, SYNC_END)
  if (!masterRows) {
    addFinding('Master sync markers', 'fail', `COMPATIBILITY.md missing ${SYNC_START} / ${SYNC_END} markers`)
    report(findings, errors, warnings, passes, Date.now() - startTime)
    return
  }
  addFinding('Master sync markers', 'pass', `Found (${masterRows.length} data rows)`)

  // 2. Check README.md exists and has sync markers
  if (!existsSync(README_PATH)) {
    addFinding('README.md exists', 'fail', 'File not found')
    report(findings, errors, warnings, passes, Date.now() - startTime)
    return
  }
  addFinding('README.md exists', 'pass', 'Found')

  const readmeContent = readFileSync(README_PATH, 'utf-8')
  const summaryRows = extractSyncBlock(readmeContent, README_SYNC_START, README_SYNC_END)
  if (!summaryRows) {
    addFinding('README sync markers', 'fail', `README.md missing ${README_SYNC_START} / ${README_SYNC_END} markers`)
    report(findings, errors, warnings, passes, Date.now() - startTime)
    return
  }
  addFinding('README sync markers', 'pass', `Found (${summaryRows.length} data rows)`)

  // 3. Cross-reference: every master platform must appear in README summary
  const masterMap = extractPlatformStatus(masterRows)
  const summaryMap = extractSummaryStatus(summaryRows)

  for (const [platform, status] of masterMap) {
    const summaryStatus = summaryMap.get(platform)
    if (!summaryStatus) {
      addFinding(`Platform: ${platform}`, 'fail', `Missing from README summary table`)
    } else if (summaryStatus !== status) {
      addFinding(`Platform: ${platform}`, 'fail', `Status mismatch: master="${status}", readme="${summaryStatus}"`)
    } else {
      addFinding(`Platform: ${platform}`, 'pass', `Status matches: ${status}`)
    }
  }

  // 4. Check for orphan rows in README not in master
  for (const [platform] of summaryMap) {
    if (!masterMap.has(platform)) {
      addFinding(`README orphan: ${platform}`, 'warn', 'Present in README but not in COMPATIBILITY.md master table')
    }
  }

  // 5. Check row count parity
  if (masterMap.size !== summaryMap.size) {
    addFinding('Row count', 'warn', `Master has ${masterMap.size} platforms, README has ${summaryMap.size}`)
  } else {
    addFinding('Row count', 'pass', `Both have ${masterMap.size} platforms`)
  }

  report(findings, errors, warnings, passes, Date.now() - startTime)
}

function report(findings: Finding[], errors: number, warnings: number, passes: number, durationMs: number): void {
  const total = errors + warnings + passes
  const result = errors > 0 ? 'fail' as const : warnings > 0 ? 'warn' as const : 'pass' as const

  // Save report
  saveReport({
    reportName: 'verify-compatibility-sync',
    timestamp: new Date().toISOString(),
    durationMs,
    result,
    summary: { passed: passes, failed: errors, warned: warnings, total },
    data: { findings },
  })

  if (JSON_MODE) {
    console.log(JSON.stringify({ result, summary: { passed: passes, failed: errors, warned: warnings, total }, findings }, null, 2))
  } else {
    console.log(`\n${BOLD}Compatibility Sync Audit${RESET}\n`)
    for (const f of findings) {
      const icon = f.status === 'pass' ? `${GREEN}✓${RESET}`
        : f.status === 'fail' ? `${RED}✗${RESET}`
        : `${YELLOW}⚠${RESET}`
      console.log(`  ${icon} ${f.check}: ${DIM}${f.detail}${RESET}`)
    }
    console.log(`\n${BOLD}Summary:${RESET} ${passes} passed, ${warnings} warned, ${errors} failed (${total} checks, ${durationMs}ms)\n`)

    if (errors > 0) {
      console.log(`${RED}${BOLD}FAIL${RESET} — README compatibility table is out of sync with docs/COMPATIBILITY.md`)
      console.log(`${DIM}Fix: update the table between ${README_SYNC_START} and ${README_SYNC_END} in README.md${RESET}\n`)
    }
  }

  process.exit(errors > 0 ? 1 : 0)
}

run()

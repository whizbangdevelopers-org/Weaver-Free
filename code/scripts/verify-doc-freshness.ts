// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Document Freshness & Cross-Reference Verification Script
 *
 * Checks business and planning documents for:
 *   1. Freshness — "Last updated" dates present and not stale (>30 days)
 *   2. Cross-reference links — markdown links resolve to existing files
 *   3. Tier matrix sync — MASTER-PLAN.md ↔ TIER-MANAGEMENT.md consistency
 *   4. Metadata completeness — date headers and canonical source references
 *
 * Usage:
 *   npx tsx scripts/verify-doc-freshness.ts
 */

import { readFileSync, existsSync, statSync } from 'fs'
import { globSync } from 'glob'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(ROOT, '..')

// ---------------------------------------------------------------------------
// ANSI Colors
// ---------------------------------------------------------------------------

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const PASS_ICON = `${GREEN}\u2713${RESET}`
const FAIL_ICON = `${RED}\u2717${RESET}`
const WARN_ICON = `${YELLOW}\u26A0${RESET}`

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STALENESS_DAYS = 30

const BUSINESS_DIR = resolve(PROJECT_ROOT, 'business')
const PLANS_DIR = resolve(PROJECT_ROOT, 'plans')
const MASTER_PLAN = resolve(PROJECT_ROOT, 'MASTER-PLAN.md')
const STATUS_FILE = resolve(PROJECT_ROOT, 'STATUS.md')

const DATE_PATTERNS = [
  /\*\*Last\s+updated:\*\*\s*(\d{4}-\d{2}-\d{2})/i,
  /\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/i,
  /\*\*Created:\*\*\s*(\d{4}-\d{2}-\d{2})/i,
  /Last\s+updated:\s*(\d{4}-\d{2}-\d{2})/i,
]

const VERSIONED_DATA_KEYWORDS = [
  /\|\s*Feature\s*\|\s*Free\s*\|/i,
  /\bpricing\b/i,
  /\btier\s+matrix\b/i,
  /\bcompetitor\b/i,
  /\bbenchmark\b/i,
  /\$\d+\/(?:yr|mo|month|year)/i,
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FreshnessResult {
  file: string
  dateFound: string | null
  daysOld: number | null
  hasVersionedData: boolean
  status: 'pass' | 'warn-stale' | 'warn-no-date' | 'info'
}

interface LinkResult {
  sourceFile: string
  linkText: string
  linkTarget: string
  resolvedPath: string
  line: number
  exists: boolean
}

interface TierRow {
  feature: string
  free: string
  weaver: string
  fabrick: string
}

interface TierSyncResult {
  masterPlanCount: number
  tierMgmtCount: number
  mismatches: Array<{ feature: string; issue: string }>
  status: 'pass' | 'fail'
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const startTime = Date.now()
let errors = 0
let warnings = 0
let passes = 0

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relPath(absPath: string): string {
  return relative(PROJECT_ROOT, absPath)
}

function discoverDocs(): string[] {
  const businessDocs = existsSync(BUSINESS_DIR)
    ? globSync('*.md', { cwd: BUSINESS_DIR }).map(f => resolve(BUSINESS_DIR, f))
    : []
  const planDocs = existsSync(PLANS_DIR)
    ? globSync('*.md', { cwd: PLANS_DIR }).map(f => resolve(PLANS_DIR, f))
    : []
  const extra = [MASTER_PLAN, STATUS_FILE].filter(f => existsSync(f))
  return [...businessDocs, ...planDocs, ...extra].sort()
}

function extractDate(content: string): string | null {
  const lines = content.split('\n').slice(0, 15)
  const header = lines.join('\n')
  for (const pattern of DATE_PATTERNS) {
    const match = header.match(pattern)
    if (match) return match[1]
  }
  return null
}

function hasVersionedData(content: string): boolean {
  return VERSIONED_DATA_KEYWORDS.some(re => re.test(content))
}

function daysBetween(dateStr: string): number {
  const then = new Date(dateStr + 'T00:00:00Z')
  const now = new Date()
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24))
}

// ---------------------------------------------------------------------------
// Check 1: Freshness
// ---------------------------------------------------------------------------

function checkFreshness(docs: string[]): FreshnessResult[] {
  console.log(`\n${BOLD}FRESHNESS${RESET} (${docs.length} docs scanned):`)

  const results: FreshnessResult[] = []

  for (const doc of docs) {
    const content = readFileSync(doc, 'utf-8')
    const date = extractDate(content)
    const versioned = hasVersionedData(content)
    const rel = relPath(doc)

    if (date) {
      const age = daysBetween(date)
      if (age > STALENESS_DAYS) {
        warnings++
        console.log(`  ${WARN_ICON} ${rel} \u2014 ${date} (${age} days old, >${STALENESS_DAYS}d)`)
        results.push({ file: rel, dateFound: date, daysOld: age, hasVersionedData: versioned, status: 'warn-stale' })
      } else {
        passes++
        console.log(`  ${PASS_ICON} ${rel} \u2014 ${date} (${age}d)`)
        results.push({ file: rel, dateFound: date, daysOld: age, hasVersionedData: versioned, status: 'pass' })
      }
    } else if (versioned) {
      warnings++
      console.log(`  ${WARN_ICON} ${rel} \u2014 no date (contains versioned data)`)
      results.push({ file: rel, dateFound: null, daysOld: null, hasVersionedData: true, status: 'warn-no-date' })
    } else {
      console.log(`  ${DIM}\u25CB ${rel} \u2014 no date${RESET}`)
      results.push({ file: rel, dateFound: null, daysOld: null, hasVersionedData: false, status: 'info' })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Check 2: Cross-Reference Links
// ---------------------------------------------------------------------------

function checkLinks(docs: string[]): LinkResult[] {
  console.log(`\n${BOLD}CROSS-REFERENCE LINKS${RESET}:`)

  const results: LinkResult[] = []
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g

  for (const doc of docs) {
    const content = readFileSync(doc, 'utf-8')
    const lines = content.split('\n')
    const docDir = dirname(doc)

    for (let i = 0; i < lines.length; i++) {
      let match
      linkPattern.lastIndex = 0
      while ((match = linkPattern.exec(lines[i])) !== null) {
        const linkText = match[1]
        let linkTarget = match[2]

        // Skip external URLs and anchors
        if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://')) continue
        if (linkTarget.startsWith('#')) continue
        if (linkTarget.startsWith('mailto:')) continue

        // Strip fragment identifier
        const hashIdx = linkTarget.indexOf('#')
        if (hashIdx !== -1) linkTarget = linkTarget.substring(0, hashIdx)

        // Skip empty after stripping
        if (!linkTarget.trim()) continue

        // Skip placeholder links (prose like "install link", "TBD")
        if (/^[a-z]+ [a-z]+$/i.test(linkTarget.trim())) continue

        // Decode URL-encoded characters (e.g. %20 → space)
        let decodedTarget = linkTarget
        try { decodedTarget = decodeURIComponent(linkTarget) } catch { /* keep original */ }

        const resolved = resolve(docDir, decodedTarget)
        const exists = existsSync(resolved)

        results.push({
          sourceFile: relPath(doc),
          linkText,
          linkTarget,
          resolvedPath: relPath(resolved),
          line: i + 1,
          exists,
        })
      }
    }
  }

  const broken = results.filter(r => !r.exists)
  const valid = results.filter(r => r.exists)

  if (broken.length > 0) {
    for (const link of broken) {
      errors++
      console.log(`  ${FAIL_ICON} ${link.sourceFile}:${link.line} \u2192 ${link.linkTarget} ${DIM}(not found)${RESET}`)
    }
  }

  passes += valid.length
  console.log(`  ${valid.length > 0 ? PASS_ICON : WARN_ICON} ${valid.length} links valid, ${broken.length} broken`)

  return results
}

// ---------------------------------------------------------------------------
// Check 3: Tier Matrix Sync
// ---------------------------------------------------------------------------

function parseTierTable(content: string, headingPattern: RegExp): TierRow[] {
  const lines = content.split('\n')
  let foundHeading = false
  let inTable = false
  const rows: TierRow[] = []

  for (const line of lines) {
    if (headingPattern.test(line)) {
      foundHeading = true
      continue
    }
    if (!foundHeading) continue

    // Skip separator line
    if (/^\|[\s\-:|]+\|$/.test(line)) {
      inTable = true
      continue
    }

    // Parse data rows
    if (inTable && line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim())
      if (cells.length >= 4) {
        // Strip markdown formatting from feature name
        const feature = cells[0]
          .replace(/\*\*/g, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .trim()
        if (feature && feature !== 'Feature') {
          rows.push({
            feature,
            free: cells[1],
            weaver: cells[2],
            fabrick: cells[3],
          })
        }
      }
    } else if (inTable && !line.startsWith('|')) {
      break
    }
  }
  return rows
}

function checkTierSync(): TierSyncResult {
  console.log(`\n${BOLD}TIER MATRIX SYNC${RESET}:`)

  const tierMgmtPath = resolve(BUSINESS_DIR, 'product', 'TIER-MANAGEMENT.md')

  if (!existsSync(MASTER_PLAN) || !existsSync(tierMgmtPath)) {
    console.log(`  ${WARN_ICON} Cannot compare — missing MASTER-PLAN.md or TIER-MANAGEMENT.md`)
    warnings++
    return { masterPlanCount: 0, tierMgmtCount: 0, mismatches: [], status: 'pass' }
  }

  const masterContent = readFileSync(MASTER_PLAN, 'utf-8')
  const tierContent = readFileSync(tierMgmtPath, 'utf-8')

  const masterRows = parseTierTable(masterContent, /^##\s+3-Tier\s+\+\s+Integrated\s+Extensions\s+Model/)
  const tierRows = parseTierTable(tierContent, /^###\s+Tier\s+Matrix/)

  console.log(`  MASTER-PLAN.md:     ${masterRows.length} features`)
  console.log(`  TIER-MANAGEMENT.md: ${tierRows.length} features`)

  const mismatches: Array<{ feature: string; issue: string }> = []

  // Build lookup from tier management
  const tierMap = new Map<string, TierRow>()
  for (const row of tierRows) {
    tierMap.set(row.feature, row)
  }

  // Check master plan features exist in tier management
  for (const row of masterRows) {
    const match = tierMap.get(row.feature)
    if (!match) {
      mismatches.push({ feature: row.feature, issue: 'in MASTER-PLAN but not in TIER-MANAGEMENT' })
    } else {
      if (row.free !== match.free || row.weaver !== match.weaver || row.fabrick !== match.fabrick) {
        mismatches.push({ feature: row.feature, issue: 'tier values differ between docs' })
      }
      tierMap.delete(row.feature)
    }
  }

  // Check for features only in tier management
  for (const [feature] of tierMap) {
    mismatches.push({ feature, issue: 'in TIER-MANAGEMENT but not in MASTER-PLAN' })
  }

  if (mismatches.length === 0) {
    passes++
    console.log(`  ${PASS_ICON} Tier tables in sync (${masterRows.length}/${tierRows.length} features match)`)
    return { masterPlanCount: masterRows.length, tierMgmtCount: tierRows.length, mismatches, status: 'pass' }
  } else {
    for (const m of mismatches) {
      errors++
      console.log(`  ${FAIL_ICON} ${m.feature} \u2014 ${m.issue}`)
    }
    return { masterPlanCount: masterRows.length, tierMgmtCount: tierRows.length, mismatches, status: 'fail' }
  }
}

// ---------------------------------------------------------------------------
// Check 4: Metadata Completeness
// ---------------------------------------------------------------------------

function checkMetadataGroup(label: string, prefix: string, freshnessResults: FreshnessResult[]): void {
  const groupDocs = freshnessResults.filter(r => r.file.startsWith(prefix))
  const withDate = groupDocs.filter(r => r.dateFound !== null)

  console.log(`  ${label} docs with date: ${withDate.length}/${groupDocs.length}`)

  if (withDate.length < groupDocs.length) {
    warnings++
    console.log(`  ${WARN_ICON} ${groupDocs.length - withDate.length} ${label} doc(s) missing date header`)
  } else if (groupDocs.length > 0) {
    passes++
    console.log(`  ${PASS_ICON} All ${label} docs have date headers`)
  }
}

function checkMetadata(docs: string[], freshnessResults: FreshnessResult[]): void {
  console.log(`\n${BOLD}METADATA COMPLETENESS${RESET}:`)

  checkMetadataGroup('business/', 'business/', freshnessResults)
}

// ---------------------------------------------------------------------------
// Check 5: Generated Document Freshness
// ---------------------------------------------------------------------------

interface GeneratedDocCheck {
  inputsFile: string
  outputFile: string
  inputsExist: boolean
  outputExist: boolean
  outputStale: boolean
  staleSourceDocs: string[]
}

function checkGeneratedDocFreshness(): GeneratedDocCheck {
  console.log(`\n${BOLD}GENERATED DOCUMENT FRESHNESS${RESET}:`)

  const inputsPath = resolve(PROJECT_ROOT, 'business', 'finance', 'cashflow-inputs.json')
  const outputPath = resolve(PROJECT_ROOT, 'business', 'finance', 'CASHFLOW-PROJECTION.md')

  const result: GeneratedDocCheck = {
    inputsFile: 'business/finance/cashflow-inputs.json',
    outputFile: 'business/finance/CASHFLOW-PROJECTION.md',
    inputsExist: existsSync(inputsPath),
    outputExist: existsSync(outputPath),
    outputStale: false,
    staleSourceDocs: [],
  }

  if (!result.inputsExist) {
    warnings++
    console.log(`  ${WARN_ICON} business/cashflow-inputs.json not found — skipping`)
    return result
  }
  if (!result.outputExist) {
    errors++
    console.log(`  ${FAIL_ICON} CASHFLOW-PROJECTION.md missing — run: npm run generate:cashflow`)
    return result
  }

  const inputsMtime = statSync(inputsPath).mtimeMs
  const outputMtime = statSync(outputPath).mtimeMs

  if (inputsMtime > outputMtime) {
    errors++
    result.outputStale = true
    console.log(`  ${FAIL_ICON} CASHFLOW-PROJECTION.md is stale — run: npm run generate:cashflow`)
  } else {
    passes++
    console.log(`  ${PASS_ICON} CASHFLOW-PROJECTION.md is up-to-date with cashflow-inputs.json`)
  }

  // Check if source documents are newer than cashflow-inputs.json
  const sourceDocs = [
    'business/product/TIER-MANAGEMENT.md',
    'business/finance/BUDGET-AND-ENTITY-PLAN.md',
    'business/sales/partners/PARTNER-TIER-REVENUE-PROPOSAL.md',
    'business/product/RELEASE-ROADMAP.md',
    'business/people/TALENT-STRATEGY.md',
  ]

  for (const doc of sourceDocs) {
    const docPath = resolve(PROJECT_ROOT, doc)
    if (!existsSync(docPath)) continue
    const docMtime = statSync(docPath).mtimeMs
    if (docMtime > inputsMtime) {
      warnings++
      result.staleSourceDocs.push(doc)
      console.log(`  ${WARN_ICON} cashflow-inputs.json may need updating — ${doc} was modified more recently`)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

console.log('Document Freshness & Cross-Reference Report')
console.log('============================================')

const docs = discoverDocs()
const freshnessResults = checkFreshness(docs)
const linkResults = checkLinks(docs)
const tierSync = checkTierSync()
checkMetadata(docs, freshnessResults)
const generatedDocCheck = checkGeneratedDocFreshness()

console.log('')

const brokenLinks = linkResults.filter(r => !r.exists)
const durationMs = Date.now() - startTime

saveReport({
  reportName: 'doc-freshness',
  timestamp: new Date().toISOString(),
  durationMs,
  result: errors > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
  summary: {
    totalDocs: docs.length,
    docsWithDate: freshnessResults.filter(r => r.dateFound).length,
    docsStale: freshnessResults.filter(r => r.status === 'warn-stale').length,
    docsMissingDate: freshnessResults.filter(r => r.status === 'warn-no-date').length,
    totalLinks: linkResults.length,
    brokenLinks: brokenLinks.length,
    tierSyncStatus: tierSync.status,
    errors,
    warnings,
    passes,
  },
  data: {
    freshness: freshnessResults,
    brokenLinks,
    tierSync,
    generatedDocCheck,
  },
})

if (errors > 0) {
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} \u2014 ${errors} error(s), ${warnings} warning(s)`)
  process.exit(1)
} else if (warnings > 0) {
  console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} ${DIM}(${warnings} warning(s))${RESET}`)
  process.exit(0)
} else {
  console.log(`${GREEN}${BOLD}RESULT: PASS${RESET}`)
  process.exit(0)
}

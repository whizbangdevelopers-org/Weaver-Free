// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * License Parity Verification Script (Decision #137)
 *
 * Verifies tier→license claims are consistent across all documents.
 * Source of truth: license-matrix.json
 *
 * Checks:
 *   1. Unqualified license claims ("Weaver is licensed under X" without tier)
 *   2. Tier→license correctness (e.g., "Weaver Free is AGPL" matches matrix)
 *   3. LICENSE file consistency (Software field, BSL note)
 *   4. README badge accuracy
 *   5. Stale tier names ("Premium", "Enterprise" in license context)
 *   6. Copyright header format in sampled source files
 *
 * Usage:
 *   npx tsx scripts/verify-license-parity.ts
 */

import { readFileSync, existsSync } from 'fs'
import { globSync } from 'glob'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const REPO_ROOT = resolve(ROOT, '..')

// ---------------------------------------------------------------------------
// ANSI Colors
// ---------------------------------------------------------------------------

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const PASS = `${GREEN}\u2713${RESET}`
const FAIL = `${RED}\u2717${RESET}`
const WARN = `${YELLOW}\u26A0${RESET}`

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let totalChecks = 0
let passedChecks = 0
let failedChecks = 0
let warnChecks = 0

interface CheckResult {
  label: string
  status: 'pass' | 'fail' | 'warn'
  detail?: string
}

const checkResults: CheckResult[] = []

function check(label: string, passed: boolean, detail?: string): void {
  totalChecks++
  if (passed) {
    passedChecks++
    checkResults.push({ label, status: 'pass' })
    console.log(`  ${PASS} ${label}`)
  } else {
    failedChecks++
    checkResults.push({ label, status: 'fail', detail })
    console.log(`  ${FAIL} ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function warn(label: string, detail?: string): void {
  totalChecks++
  warnChecks++
  checkResults.push({ label, status: 'warn', detail })
  console.log(`  ${WARN} ${label}${detail ? ` — ${detail}` : ''}`)
}

// ---------------------------------------------------------------------------
// Load Source of Truth
// ---------------------------------------------------------------------------

interface LicenseMatrix {
  tiers: Record<string, { license: string; addenda: string[]; repo: string }>
  header: { line1: string; line2: string }
  scanTargets: Array<{ file: string; type: string }>
  retiredTerms: string[]
  retiredTermExceptions: string[]
}

const matrixPath = resolve(ROOT, 'license-matrix.json')
if (!existsSync(matrixPath)) {
  console.error(`${RED}FATAL: license-matrix.json not found at ${matrixPath}${RESET}`)
  process.exit(1)
}

const matrix: LicenseMatrix = JSON.parse(readFileSync(matrixPath, 'utf-8'))

function readFile(relPath: string): string | null {
  // Paths starting with ../ are relative to REPO_ROOT
  const base = relPath.startsWith('../') ? REPO_ROOT : ROOT
  const cleanPath = relPath.replace(/^\.\.\//, '')
  const fullPath = resolve(base, cleanPath)
  if (!existsSync(fullPath)) return null
  return readFileSync(fullPath, 'utf-8')
}

// ---------------------------------------------------------------------------
// 1. Unqualified License Claims
// ---------------------------------------------------------------------------

function checkUnqualifiedClaims(): void {
  console.log('\nUNQUALIFIED LICENSE CLAIMS:')

  // Patterns that indicate unqualified "Weaver is licensed under X"
  // without specifying which tier. We want "Weaver Free" or "Weaver Solo" etc.
  const unqualifiedPatterns = [
    /Weaver itself is licensed/i,
    /Weaver is licensed under/i,
    /Software:\s+Weaver\s*$/m,
  ]

  // Qualified patterns are OK
  const qualifiedPatterns = [
    /Weaver Free/i,
    /Weaver Solo/i,
    /Weaver Team/i,
    /Fabrick/i,
    /all tiers/i,
    /per tier/i,
    /by tier/i,
    /Decision #137/i,
  ]

  for (const target of matrix.scanTargets) {
    const content = readFile(target.file)
    const fileName = basename(target.file)
    if (!content) {
      check(`${fileName} exists`, false, `${target.file} not found`)
      continue
    }

    const lines = content.split('\n')
    let foundUnqualified = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const pattern of unqualifiedPatterns) {
        if (pattern.test(line)) {
          // Check if the same line or nearby lines have a qualifier
          const context = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join(' ')
          const isQualified = qualifiedPatterns.some((qp) => qp.test(context))
          if (!isQualified) {
            check(
              `${fileName}:${i + 1} — no unqualified license claim`,
              false,
              `"${line.trim().substring(0, 80)}..."`,
            )
            foundUnqualified = true
          }
        }
      }
    }

    if (!foundUnqualified) {
      check(`${fileName} — no unqualified license claims`, true)
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Tier→License Correctness
// ---------------------------------------------------------------------------

function checkTierLicenseCorrectness(): void {
  console.log('\nTIER→LICENSE CORRECTNESS:')

  // Check that when a document mentions a specific tier + license, it matches
  // Check per-line: a single line that assigns the WRONG license to a tier
  // e.g., "Weaver Free is BSL-1.1" or "Solo is AGPL-3.0"
  // Tables with multiple tiers on different rows are NOT false positives
  const tierWrongLicense: Array<{ tier: string; wrongPattern: RegExp }> = [
    // Free should be AGPL, not BSL — match on same line only
    { tier: 'Free', wrongPattern: /\bFree\b.*\bBSL[-\s]?1\.1\b/i },
    // Solo should be BSL, not AGPL — match on same line only
    { tier: 'Solo', wrongPattern: /\bSolo\b.*\bAGPL[-\s]?3\.0\b/i },
    // Team should be BSL, not AGPL
    { tier: 'Team', wrongPattern: /\bTeam\b.*\bAGPL[-\s]?3\.0\b/i },
    // Fabrick should be BSL, not AGPL (exception: "converts to AGPL" / "change date" / "becomes AGPL")
    { tier: 'Fabrick', wrongPattern: /\bFabrick\b.*\bAGPL[-\s]?3\.0\b/i },
  ]

  let tierMismatches = 0

  for (const target of matrix.scanTargets) {
    const content = readFile(target.file)
    if (!content) continue

    const fileName = basename(target.file)
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      for (const { tier, wrongPattern } of tierWrongLicense) {
        if (wrongPattern.test(line)) {
          // Skip lines that are part of a comparison table (contain | delimiters
          // and mention the tier in a table cell alongside other tiers)
          const isTableRow = (line.match(/\|/g) || []).length >= 2
          const isComparisonContext = /AGPL.*BSL|BSL.*AGPL|or BSL|or AGPL/i.test(line)
          // Skip lines about BSL→AGPL change date conversion
          const isChangeDateContext = /converts? to|becomes|change date|conversion/i.test(line)
          if (isTableRow || isComparisonContext || isChangeDateContext) continue

          check(
            `${fileName}:${i + 1} — ${tier} tier license correct`,
            false,
            `line assigns wrong license to ${tier}`,
          )
          tierMismatches++
        }
      }
    }
  }

  check('No tier→license mismatches in scan targets', tierMismatches === 0)
}

// ---------------------------------------------------------------------------
// 3. LICENSE File Consistency
// ---------------------------------------------------------------------------

function checkLicenseFile(): void {
  console.log('\nLICENSE FILE:')

  const content = readFile('LICENSE')
  if (!content) {
    check('LICENSE exists', false)
    return
  }

  check('LICENSE exists', true)
  check(
    'Software field qualifies as "Weaver Free"',
    /Software:\s+Weaver Free/m.test(content),
  )
  check(
    'BSL note present for paid tiers',
    content.includes('BSL') || content.includes('Solo') || content.includes('Team'),
  )
  check('Contains Commons Clause', content.includes('Commons Clause'))
  check('Contains AI Training Restriction', content.includes('AI Training Restriction'))
  check('Contains AGPL-3.0 text', content.includes('GNU AFFERO GENERAL PUBLIC LICENSE'))
}

// ---------------------------------------------------------------------------
// 4. README Badge Accuracy
// ---------------------------------------------------------------------------

function checkReadmeBadge(): void {
  console.log('\nREADME BADGE:')

  const content = readFile('README.md')
  if (!content) {
    check('README.md exists', false)
    return
  }

  check('README.md exists', true)

  // Badge should indicate Free tier, not unqualified AGPL
  const hasBadge = /\[!\[License.*AGPL.*Free/i.test(content)
  check('License badge qualifies as Free tier', hasBadge)

  // License section should mention both licenses
  const hasLicenseSection = content.includes('## License')
  check('License section exists', hasLicenseSection)

  if (hasLicenseSection) {
    const licenseSectionStart = content.indexOf('## License')
    const licenseSectionEnd = content.indexOf('\n## ', licenseSectionStart + 1)
    const section =
      licenseSectionEnd > -1
        ? content.substring(licenseSectionStart, licenseSectionEnd)
        : content.substring(licenseSectionStart)

    check(
      'License section mentions Weaver Free',
      /Weaver Free/i.test(section),
    )
    check(
      'License section mentions BSL-1.1',
      /BSL-1\.1|BSL 1\.1|Business Source License/i.test(section),
    )
    check(
      'License section mentions paid tiers',
      /Solo|Team|Fabrick/i.test(section),
    )
  }
}

// ---------------------------------------------------------------------------
// 5. Stale Tier Names in License Context
// ---------------------------------------------------------------------------

function checkStaleTierNames(): void {
  console.log('\nSTALE TIER NAMES:')

  for (const target of matrix.scanTargets) {
    const content = readFile(target.file)
    if (!content) continue

    const fileName = basename(target.file)

    // Skip known exceptions
    if (matrix.retiredTermExceptions.some((ex) => target.file.includes(ex))) {
      continue
    }

    for (const term of matrix.retiredTerms) {
      // Look for "Premium" or "Enterprise" used in license/tier context
      // Not just any mention — specifically in license assignment context
      const licenseContextPattern = new RegExp(
        `${term}.*(?:license|AGPL|BSL|tier|gated)`,
        'i',
      )
      const reversePattern = new RegExp(
        `(?:license|AGPL|BSL|tier|gated).*${term}`,
        'i',
      )

      if (licenseContextPattern.test(content) || reversePattern.test(content)) {
        warn(
          `${fileName} — uses retired term "${term}" in license context`,
          'should use Solo/Team/Fabrick',
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Copyright Header Spot-Check
// ---------------------------------------------------------------------------

function checkCopyrightHeaders(): void {
  console.log('\nCOPYRIGHT HEADER SPOT-CHECK:')

  const expectedLine2 = matrix.header.line2

  // Sample a few files from different directories
  const samplePatterns = [
    'src/pages/*.vue',
    'src/stores/*.ts',
    'backend/src/routes/*.ts',
    'scripts/*.ts',
    'tui/src/*.tsx',
  ]

  let sampledFiles = 0
  let correctHeaders = 0
  let oldHeaders = 0

  for (const pattern of samplePatterns) {
    const files = globSync(resolve(ROOT, pattern))
    // Take first 3 from each pattern
    for (const file of files.slice(0, 3)) {
      sampledFiles++
      const content = readFileSync(file, 'utf-8')
      const firstLines = content.split('\n').slice(0, 5).join('\n')

      if (firstLines.includes(expectedLine2)) {
        correctHeaders++
      } else if (firstLines.includes('AGPL-3.0 with Commons Clause and AI Training Restriction')) {
        oldHeaders++
      }
    }
  }

  check(
    `Sampled ${sampledFiles} files — ${correctHeaders} have new header`,
    correctHeaders === sampledFiles,
    oldHeaders > 0 ? `${oldHeaders} still have old 3-line header` : undefined,
  )

  if (oldHeaders > 0) {
    check(
      'No old AGPL-only headers remain',
      false,
      `${oldHeaders} files still have pre-Decision #137 header`,
    )
  }
}

// ---------------------------------------------------------------------------
// 7. LICENSE-PAID-DRAFT Tier Table
// ---------------------------------------------------------------------------

function checkEnterpriseDraft(): void {
  console.log('\nLICENSE DRAFT SYNC:')

  const content = readFile('docs/legal/LICENSE-PAID-DRAFT.md')
  if (!content) {
    check('LICENSE-PAID-DRAFT.md exists', false)
    return
  }

  check('LICENSE-PAID-DRAFT.md exists', true)
  check('References Decision #137', content.includes('Decision #137'))
  check(
    'Tier table includes Weaver Solo',
    /Weaver Solo.*BSL/i.test(content),
  )
  check(
    'Tier table includes Weaver Team',
    /Weaver Team.*BSL/i.test(content),
  )
  check(
    'Tier table includes Fabrick',
    /Fabrick.*BSL/i.test(content),
  )
  check(
    'No "Premium" tier in table',
    !/\|\s*\*\*Premium\*\*/i.test(content),
  )
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const startTime = Date.now()

console.log(`${DIM}license-matrix.json loaded: ${Object.keys(matrix.tiers).length} tiers, ${matrix.scanTargets.length} scan targets${RESET}`)

checkUnqualifiedClaims()
checkTierLicenseCorrectness()
checkLicenseFile()
checkReadmeBadge()
checkStaleTierNames()
checkCopyrightHeaders()
checkEnterpriseDraft()

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const durationMs = Date.now() - startTime
const result = failedChecks > 0 ? 'fail' : warnChecks > 0 ? 'warn' : 'pass'

console.log('\n' + '='.repeat(60))
if (failedChecks > 0) {
  console.log(`${RED}FAIL${RESET}: ${failedChecks} check(s) failed, ${warnChecks} warning(s), ${passedChecks} passed`)
} else if (warnChecks > 0) {
  console.log(`${YELLOW}WARN${RESET}: ${warnChecks} warning(s), ${passedChecks} passed`)
} else {
  console.log(`${GREEN}PASS${RESET}: All ${passedChecks} checks passed`)
}
console.log('='.repeat(60))

saveReport({
  reportName: 'license-parity',
  timestamp: new Date().toISOString(),
  durationMs,
  result,
  summary: {
    total: totalChecks,
    passed: passedChecks,
    failed: failedChecks,
    warnings: warnChecks,
    tiersChecked: Object.keys(matrix.tiers).length,
    scanTargetsChecked: matrix.scanTargets.length,
  },
  data: checkResults,
})

process.exit(failedChecks > 0 ? 1 : 0)

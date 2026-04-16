// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Compliance Document Parity Auditor
 *
 * Checks that compliance documents stay in sync with code — when a "Planned"
 * feature ships, the compliance docs must be updated to "Implemented."
 *
 * For each feature in the compliance map:
 *   - Code shipped AND docs say "Planned" → FAIL (stale doc)
 *   - Code not shipped AND docs say "Planned" → PASS (correctly planned)
 *   - Code shipped AND docs say "Implemented" → PASS (in sync)
 *
 * Also cross-references SECURITY-BASELINES.md "Planned Improvements" section
 * against shipped code.
 *
 * Usage:
 *   npx tsx scripts/verify-compliance-parity.ts
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// ANSI Colors
// ---------------------------------------------------------------------------

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const PASS_ICON = `${GREEN}\u2713${RESET}`
const FAIL_ICON = `${RED}\u2717${RESET}`
const WARN_ICON = `${YELLOW}\u26A0${RESET}`

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const COMPLIANCE_DIR = resolve(ROOT, 'docs', 'security', 'compliance')
const SECURITY_DIR = resolve(ROOT, 'docs', 'security')
const BASELINES_FILE = resolve(SECURITY_DIR, 'SECURITY-BASELINES.md')

// ---------------------------------------------------------------------------
// Counters
// ---------------------------------------------------------------------------

let errors = 0
let warnings = 0
let passes = 0

const findings: Array<{
  check: string
  status: 'pass' | 'fail' | 'warn'
  detail: string
}> = []

function pass(msg: string): void {
  passes++
  findings.push({ check: msg, status: 'pass', detail: msg })
  console.log(`  ${PASS_ICON} ${msg}`)
}

function fail(msg: string): void {
  errors++
  findings.push({ check: msg, status: 'fail', detail: msg })
  console.log(`  ${FAIL_ICON} ${msg}`)
}

function warn(msg: string): void {
  warnings++
  findings.push({ check: msg, status: 'warn', detail: msg })
  console.log(`  ${WARN_ICON} ${msg}`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFile(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

function fileExists(relativePath: string): boolean {
  return existsSync(resolve(ROOT, relativePath))
}

function fileContainsPattern(relativePath: string, pattern: RegExp): boolean {
  const content = readFile(resolve(ROOT, relativePath))
  if (!content) return false
  return pattern.test(content)
}

// ---------------------------------------------------------------------------
// Compliance Feature Map
// ---------------------------------------------------------------------------

interface CodePattern {
  file: string
  exists?: boolean
  grep?: RegExp
}

interface ComplianceFeature {
  name: string
  codePattern: CodePattern
  docPatterns: string[]
  searchTerm: string // regex-compatible, tested case-insensitive
}

const COMPLIANCE_FEATURES: ComplianceFeature[] = [
  {
    name: 'TOTP MFA',
    codePattern: { file: 'backend/src/routes/auth-totp.ts', exists: true },
    docPatterns: [
      'NIST-800-171-MAPPING.md',
      'HIPAA-164-312-MAPPING.md',
      'PCI-DSS-MAPPING.md',
      'SOC2-READINESS.md',
    ],
    searchTerm: 'MFA',
  },
  {
    name: 'sops-nix encrypted secrets',
    codePattern: { file: 'backend/src/routes/secrets.ts', exists: true },
    docPatterns: [
      'NIST-800-171-MAPPING.md',
      'PCI-DSS-MAPPING.md',
      'SOC2-READINESS.md',
      'HIPAA-164-312-MAPPING.md',
    ],
    searchTerm: 'secret|encrypt',
  },
  {
    name: 'Idle session timeout',
    codePattern: { file: 'backend/src/services/auth.ts', grep: /IDLE_TIMEOUT_MS|lastActivity/i },
    docPatterns: ['NIST-800-171-MAPPING.md'],
    searchTerm: 'idle|session lock|inactivity',
  },
  {
    name: 'httpOnly cookie token storage',
    codePattern: { file: 'backend/src/routes/auth.ts', grep: /httpOnly|cookie.*token|setCookie/i },
    docPatterns: ['SECURITY-BASELINES.md'],
    searchTerm: 'httpOnly|cookie|token storage',
  },
]

// ---------------------------------------------------------------------------
// Baselines "Planned Improvements" map
//
// Each entry maps a bullet point keyword to a code detection check.
// ---------------------------------------------------------------------------

interface BaselinePlannedItem {
  keyword: RegExp
  label: string
  codePattern: CodePattern
}

const BASELINES_PLANNED_ITEMS: BaselinePlannedItem[] = [
  {
    keyword: /idle session timeout/i,
    label: 'Idle session timeout',
    codePattern: { file: 'backend/src/middleware/idle-timeout.ts', exists: true },
  },
  {
    keyword: /httpOnly cookie/i,
    label: 'httpOnly cookie token storage',
    codePattern: { file: 'backend/src/routes/auth.ts', grep: /httpOnly|cookie.*token|setCookie/i },
  },
]

// ---------------------------------------------------------------------------
// Detection Logic
// ---------------------------------------------------------------------------

function codeShipped(pattern: CodePattern): boolean {
  if (pattern.exists) {
    return fileExists(pattern.file)
  }
  if (pattern.grep) {
    return fileContainsPattern(pattern.file, pattern.grep)
  }
  return false
}

/**
 * Check if a compliance doc still marks a feature as "Planned".
 * Looks for lines containing both the searchTerm and the word "Planned".
 */
function docMarkedAsPlanned(docPath: string, searchTerm: string): boolean {
  const content = readFile(docPath)
  if (!content) return false

  const searchRegex = new RegExp(searchTerm, 'i')
  const lines = content.split('\n')

  for (const line of lines) {
    if (searchRegex.test(line) && /Planned/i.test(line)) {
      return true
    }
  }
  return false
}

/**
 * Resolve the full path for a doc pattern.
 * SECURITY-BASELINES.md lives in docs/security/, others in docs/security/compliance/.
 */
function resolveDocPath(docName: string): string {
  if (docName === 'SECURITY-BASELINES.md') {
    return resolve(SECURITY_DIR, docName)
  }
  return resolve(COMPLIANCE_DIR, docName)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('Compliance Document Parity')
console.log('==========================')
console.log('')

// --- Section 1: Feature-level parity ---

console.log('COMPLIANCE DOCUMENT PARITY')

for (const feature of COMPLIANCE_FEATURES) {
  const shipped = codeShipped(feature.codePattern)

  if (!shipped) {
    // Code not shipped — verify docs correctly say "Planned"
    let anyDocMentions = false
    for (const docName of feature.docPatterns) {
      const docPath = resolveDocPath(docName)
      if (docMarkedAsPlanned(docPath, feature.searchTerm)) {
        anyDocMentions = true
      }
    }
    if (anyDocMentions) {
      pass(`${feature.name} — correctly marked as Planned (code not yet shipped)`)
    } else {
      // No doc mentions it as planned — could be not tracked, just note it
      warn(`${feature.name} — code not shipped, but no "Planned" marker found in compliance docs`)
    }
    continue
  }

  // Code shipped — check each doc for stale "Planned" markers
  let anyStale = false
  const staleDocs: string[] = []

  for (const docName of feature.docPatterns) {
    const docPath = resolveDocPath(docName)
    if (docMarkedAsPlanned(docPath, feature.searchTerm)) {
      anyStale = true
      staleDocs.push(docName)
    }
  }

  if (anyStale) {
    fail(`${feature.name} — code shipped but still marked as Planned in: ${staleDocs.join(', ')}`)
  } else {
    pass(`${feature.name} — code shipped and docs updated (in sync)`)
  }
}

// --- Section 2: SECURITY-BASELINES.md "Planned Improvements" ---

console.log('')
console.log('SECURITY BASELINES — PLANNED IMPROVEMENTS')

const baselinesContent = readFile(BASELINES_FILE)

if (!baselinesContent) {
  warn('SECURITY-BASELINES.md not found — skipping planned improvements check')
} else {
  // Extract the "Planned Improvements" section
  const plannedMatch = baselinesContent.match(/## Planned Improvements\n([\s\S]*?)(?=\n##|\n---|\Z)/)?.[1]

  if (!plannedMatch) {
    warn('No "Planned Improvements" section found in SECURITY-BASELINES.md')
  } else {
    const bulletLines = plannedMatch.split('\n').filter((l) => l.startsWith('- '))

    if (bulletLines.length === 0) {
      pass('No planned improvements listed (section empty or cleared)')
    } else {
      for (const bullet of bulletLines) {
        // Check if any BASELINES_PLANNED_ITEMS match this bullet
        const matched = BASELINES_PLANNED_ITEMS.find((item) => item.keyword.test(bullet))

        if (!matched) {
          // Unrecognized planned item — can't auto-check, warn
          warn(`Unrecognized planned item: ${bullet.trim()} ${DIM}(add to BASELINES_PLANNED_ITEMS for auto-detection)${RESET}`)
          continue
        }

        const shipped = codeShipped(matched.codePattern)
        if (shipped) {
          fail(`${matched.label} — code shipped but SECURITY-BASELINES.md still lists as Planned`)
        } else {
          pass(`${matched.label} — correctly listed as Planned (code not yet shipped)`)
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('')

const result = errors > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass'

saveReport({
  reportName: 'compliance-parity',
  timestamp: new Date().toISOString(),
  durationMs: 0,
  result,
  summary: {
    total: passes + errors + warnings,
    passes,
    errors,
    warnings,
  },
  data: {
    findings,
  },
})

if (errors > 0) {
  console.log(
    `${RED}RESULT: FAIL — ${errors} stale compliance doc(s) found${RESET}`,
  )
  process.exit(1)
} else if (warnings > 0) {
  console.log(
    `${YELLOW}RESULT: PASS with ${warnings} warning(s)${RESET}`,
  )
  process.exit(0)
} else {
  console.log(`${GREEN}RESULT: PASS — all compliance docs in sync${RESET}`)
  process.exit(0)
}

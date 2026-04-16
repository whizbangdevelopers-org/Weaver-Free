// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Attribution Parity Auditor
 *
 * Checks that ATTRIBUTION.md stays in sync with actual npm dependencies.
 *
 * For each direct dependency in package.json:
 *   - Must appear in ATTRIBUTION.md → FAIL if missing
 *   - License in node_modules must match ATTRIBUTION.md → WARN if mismatch
 *
 * For each entry in ATTRIBUTION.md:
 *   - Must still exist in package.json dependencies → WARN if stale
 *
 * Usage:
 *   npx tsx scripts/verify-attribution-parity.ts
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
const RESET = '\x1b[0m'

const PASS_ICON = `${GREEN}\u2713${RESET}`
const FAIL_ICON = `${RED}\u2717${RESET}`
const WARN_ICON = `${YELLOW}\u26A0${RESET}`

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

function readJsonFile(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function readTextFile(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

/**
 * Get the license field from a package's node_modules package.json.
 * Returns the license string or null if not found.
 */
function getInstalledLicense(nodeModulesDir: string, pkgName: string): string | null {
  const pkgJsonPath = resolve(nodeModulesDir, pkgName, 'package.json')
  if (!existsSync(pkgJsonPath)) return null
  const pkgJson = readJsonFile(pkgJsonPath)
  if (!pkgJson) return null

  const license = pkgJson.license
  if (typeof license === 'string') return license
  if (license && typeof license === 'object' && 'type' in license) {
    return String((license as { type: string }).type)
  }
  return null
}

/**
 * Normalize a license string for comparison.
 * Strips whitespace, lowercases, and removes common suffixes like " license".
 */
function normalizeLicense(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+license$/i, '')
}

/**
 * Compare two license strings loosely.
 * Returns true if they match after normalization.
 */
function licensesMatch(a: string, b: string): boolean {
  return normalizeLicense(a) === normalizeLicense(b)
}

// ---------------------------------------------------------------------------
// Parse ATTRIBUTION.md
// ---------------------------------------------------------------------------

interface AttributionEntry {
  name: string
  license: string
}

interface AttributionSection {
  label: string
  entries: AttributionEntry[]
}

function parseAttribution(content: string): AttributionSection[] {
  const sections: AttributionSection[] = []
  let currentSection: AttributionSection | null = null

  for (const line of content.split('\n')) {
    // Detect section headers
    if (/^## Frontend/i.test(line)) {
      currentSection = { label: 'frontend', entries: [] }
      sections.push(currentSection)
      continue
    }
    if (/^## Backend/i.test(line)) {
      currentSection = { label: 'backend', entries: [] }
      sections.push(currentSection)
      continue
    }
    if (/^## TUI/i.test(line)) {
      currentSection = { label: 'tui', entries: [] }
      sections.push(currentSection)
      continue
    }

    if (!currentSection) continue

    // Parse table rows: | **package-name** | version | license | copyright |
    const match = line.match(
      /^\|\s*\*{0,2}([^|*]+?)\*{0,2}\s*\|\s*[^|]+\|\s*([^|]+?)\s*\|/
    )
    if (match) {
      const name = match[1].trim()
      const license = match[2].trim()
      // Skip header row
      if (name === 'Package' || name === '---' || name.startsWith('-')) continue
      currentSection.entries.push({ name, license })
    }
  }

  return sections
}

// ---------------------------------------------------------------------------
// Section configurations
// ---------------------------------------------------------------------------

interface SectionConfig {
  label: string
  pkgJsonPath: string
  nodeModulesDir: string
}

const SECTIONS: SectionConfig[] = [
  {
    label: 'frontend',
    pkgJsonPath: resolve(ROOT, 'package.json'),
    nodeModulesDir: resolve(ROOT, 'node_modules'),
  },
  {
    label: 'backend',
    pkgJsonPath: resolve(ROOT, 'backend', 'package.json'),
    nodeModulesDir: resolve(ROOT, 'backend', 'node_modules'),
  },
  {
    label: 'tui',
    pkgJsonPath: resolve(ROOT, 'tui', 'package.json'),
    nodeModulesDir: resolve(ROOT, 'tui', 'node_modules'),
  },
]

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('Attribution Parity')
console.log('==================')
console.log('')

// Read and parse ATTRIBUTION.md
const attributionPath = resolve(ROOT, 'ATTRIBUTION.md')
const attributionContent = readTextFile(attributionPath)

if (!attributionContent) {
  fail('ATTRIBUTION.md not found or empty')
  process.exit(1)
}

const attributionSections = parseAttribution(attributionContent)

console.log('ATTRIBUTION PARITY')

for (const section of SECTIONS) {
  const sectionLabel = section.label.charAt(0).toUpperCase() + section.label.slice(1)

  // Read package.json
  const pkgJson = readJsonFile(section.pkgJsonPath)
  if (!pkgJson) {
    warn(`${sectionLabel}: package.json not found at ${section.pkgJsonPath}`)
    continue
  }

  const deps = (pkgJson.dependencies ?? {}) as Record<string, string>
  const depNames = Object.keys(deps)

  // Find matching attribution section
  const attrSection = attributionSections.find((s) => s.label === section.label)
  const attrNames = new Set(attrSection?.entries.map((e) => e.name) ?? [])
  const attrByName = new Map(attrSection?.entries.map((e) => [e.name, e]) ?? [])

  // Check 1: Every dependency must be in ATTRIBUTION.md
  for (const depName of depNames) {
    if (!attrNames.has(depName)) {
      // Try to get the actual license for a helpful message
      const installedLicense = getInstalledLicense(section.nodeModulesDir, depName)
      const licenseHint = installedLicense ? ` (add it with license: ${installedLicense})` : ''
      fail(`${depName} — missing from ATTRIBUTION.md ${sectionLabel} section${licenseHint}`)
      continue
    }

    // Check license match
    const attrEntry = attrByName.get(depName)!
    const installedLicense = getInstalledLicense(section.nodeModulesDir, depName)

    if (installedLicense && !licensesMatch(attrEntry.license, installedLicense)) {
      warn(
        `${depName} — license mismatch: ATTRIBUTION.md says "${attrEntry.license}", node_modules says "${installedLicense}"`
      )
    } else {
      pass(`${depName} — listed in ATTRIBUTION.md (${attrEntry.license})`)
    }
  }

  // Check 2: Every ATTRIBUTION.md entry must still exist in package.json
  const depNameSet = new Set(depNames)
  for (const attrEntry of attrSection?.entries ?? []) {
    if (!depNameSet.has(attrEntry.name)) {
      warn(
        `${attrEntry.name} — in ATTRIBUTION.md ${sectionLabel} section but not in package.json dependencies (stale entry)`
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('')

const result = errors > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass'

saveReport({
  reportName: 'attribution-parity',
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
    `${RED}RESULT: FAIL — ${errors} missing attribution(s) found${RESET}`,
  )
  process.exit(1)
} else if (warnings > 0) {
  console.log(
    `${YELLOW}RESULT: PASS with ${warnings} warning(s)${RESET}`,
  )
  process.exit(0)
} else {
  console.log(`${GREEN}RESULT: PASS — all attributions in sync${RESET}`)
  process.exit(0)
}

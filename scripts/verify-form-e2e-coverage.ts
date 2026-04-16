// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * E2E Coverage Gap Checker for Form Validation
 *
 * Cross-references the static form analysis output against existing E2E specs
 * to identify which validation rules have E2E test coverage and which don't.
 *
 * Usage:
 *   npx tsx scripts/verify-form-e2e-coverage.ts          # Console report
 *   npx tsx scripts/verify-form-e2e-coverage.ts --json    # JSON output
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { globSync } from 'glob'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationRule {
  component: string
  field: string
  errorMessage: string
  coverageStatus: 'covered' | 'gap'
  coveredBy?: string // e.g., 'network.spec.ts:105'
}

// ---------------------------------------------------------------------------
// Step 1: Get form analysis data
// ---------------------------------------------------------------------------

function getFormAnalysis(): any[] {
  const result = execSync('npx tsx scripts/verify-form-rules.ts --json', {
    cwd: rootDir,
    encoding: 'utf-8',
    timeout: 30000,
  })
  return JSON.parse(result)
}

// ---------------------------------------------------------------------------
// Step 2: Extract error messages from rules expressions
// ---------------------------------------------------------------------------

function extractErrorMessages(rulesExpression: string): string[] {
  const messages: string[] = []
  // Match single-quoted strings in rules (the error message pattern)
  const singleQuoted = [...rulesExpression.matchAll(/'([^']+)'/g)]
  for (const m of singleQuoted) {
    const msg = m[1]
    // Filter out non-error-message strings (regex patterns, format examples)
    if (
      msg.startsWith('^') || // regex
      msg.includes('${') || // template literal fragment
      msg === '.' || // single char
      msg.length < 3 // too short to be an error message
    ) {
      continue
    }
    messages.push(msg)
  }
  return messages
}

// ---------------------------------------------------------------------------
// Step 3: Scan E2E specs for coverage
// ---------------------------------------------------------------------------

interface SpecMatch {
  file: string
  line: number
  text: string
}

function scanE2ESpecs(): Map<string, SpecMatch[]> {
  const specDir = resolve(rootDir, 'testing/e2e')
  const specFiles = globSync(resolve(specDir, '*.spec.ts'))
  const coverageMap = new Map<string, SpecMatch[]>()

  for (const specFile of specFiles) {
    const content = readFileSync(specFile, 'utf-8')
    const lines = content.split('\n')
    const relPath = relative(rootDir, specFile)

    for (let i = 0; i < lines.length; i++) {
      // Look for toContainText assertions — the standard pattern for checking error messages
      const containTextMatch = lines[i].match(
        /toContainText\(\s*['"`]([^'"`]+)['"`]/,
      )
      if (containTextMatch) {
        const assertedText = containTextMatch[1]
        const matches = coverageMap.get(assertedText) || []
        matches.push({ file: relPath, line: i + 1, text: lines[i].trim() })
        coverageMap.set(assertedText, matches)
      }

      // Also check for regex-based toContainText
      const regexMatch = lines[i].match(/toContainText\(\s*\/([^/]+)\//i)
      if (regexMatch) {
        const pattern = regexMatch[1]
        const matches = coverageMap.get(`regex:${pattern}`) || []
        matches.push({ file: relPath, line: i + 1, text: lines[i].trim() })
        coverageMap.set(`regex:${pattern}`, matches)
      }

      // Check for getByText('...') assertions — equivalent to toContainText for coverage
      const getByTextMatch = lines[i].match(
        /getByText\(\s*['"`]([^'"`]+)['"`]/,
      )
      if (getByTextMatch) {
        const assertedText = getByTextMatch[1]
        if (!coverageMap.has(assertedText)) {
          coverageMap.set(assertedText, [])
        }
        const matches = coverageMap.get(assertedText)!
        matches.push({ file: relPath, line: i + 1, text: lines[i].trim() })
      }
    }
  }

  return coverageMap
}

// ---------------------------------------------------------------------------
// Step 4: Match rules against E2E coverage
// ---------------------------------------------------------------------------

function checkCoverage(
  components: any[],
  coverageMap: Map<string, SpecMatch[]>,
): ValidationRule[] {
  const rules: ValidationRule[] = []

  for (const comp of components) {
    for (const field of comp.fields) {
      if (!field.rulesExpression) continue

      const messages = extractErrorMessages(field.rulesExpression)
      for (const msg of messages) {
        // Check for exact match
        let covered = coverageMap.get(msg)

        // Check for partial/substring match
        if (!covered) {
          for (const [key, matches] of coverageMap.entries()) {
            if (key.startsWith('regex:')) {
              try {
                const re = new RegExp(key.slice(6), 'i')
                if (re.test(msg)) {
                  covered = matches
                  break
                }
              } catch {
                // Invalid regex, skip
              }
            } else if (
              msg.toLowerCase().includes(key.toLowerCase()) ||
              key.toLowerCase().includes(msg.toLowerCase())
            ) {
              covered = matches
              break
            }
          }
        }

        rules.push({
          component: comp.relativePath,
          field: field.label,
          errorMessage: msg,
          coverageStatus: covered ? 'covered' : 'gap',
          coveredBy: covered
            ? `${covered[0].file}:${covered[0].line}`
            : undefined,
        })
      }
    }
  }

  return rules
}

// ---------------------------------------------------------------------------
// Output Formatting
// ---------------------------------------------------------------------------

function formatConsoleReport(rules: ValidationRule[]): string {
  const lines: string[] = []
  const total = rules.length
  const covered = rules.filter((r) => r.coverageStatus === 'covered').length
  const gaps = total - covered

  lines.push('Validation E2E Coverage Report')
  lines.push('==============================')
  lines.push(
    `Total validation rules: ${total}`,
  )
  lines.push(
    `Covered by existing E2E: ${covered} (${total > 0 ? Math.round((covered / total) * 100) : 0}%)`,
  )
  lines.push(`Gaps: ${gaps}`)
  lines.push('')

  if (gaps > 0) {
    lines.push('UNCOVERED:')
    lines.push('')

    // Group by component
    const byComponent = new Map<string, ValidationRule[]>()
    for (const r of rules.filter((r) => r.coverageStatus === 'gap')) {
      const list = byComponent.get(r.component) || []
      list.push(r)
      byComponent.set(r.component, list)
    }

    for (const [comp, compRules] of byComponent) {
      lines.push(`  ${comp}`)
      for (const r of compRules) {
        lines.push(`    - ${r.field}: "${r.errorMessage}"`)
      }
      lines.push('')
    }
  }

  if (covered > 0) {
    lines.push('COVERED:')
    lines.push('')

    const byComponent = new Map<string, ValidationRule[]>()
    for (const r of rules.filter((r) => r.coverageStatus === 'covered')) {
      const list = byComponent.get(r.component) || []
      list.push(r)
      byComponent.set(r.component, list)
    }

    for (const [comp, compRules] of byComponent) {
      lines.push(`  ${comp}`)
      for (const r of compRules) {
        lines.push(
          `    + ${r.field}: "${r.errorMessage}" — ${r.coveredBy}`,
        )
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const jsonMode = process.argv.includes('--json')

const components = getFormAnalysis()
const coverageMap = scanE2ESpecs()
const rules = checkCoverage(components, coverageMap)

const covered = rules.filter((r) => r.coverageStatus === 'covered').length
const gaps = rules.filter((r) => r.coverageStatus === 'gap').length

saveReport({
  reportName: 'e2e-coverage',
  timestamp: new Date().toISOString(),
  durationMs: 0,
  result: gaps > 0 ? 'warn' : 'pass',
  summary: {
    totalRules: rules.length,
    covered,
    gaps,
    coveragePercent: rules.length > 0 ? Math.round((covered / rules.length) * 100) : 100,
  },
  data: rules,
})

if (jsonMode) {
  console.log(JSON.stringify(rules, null, 2))
} else {
  console.log(formatConsoleReport(rules))
  process.exit(gaps > 0 ? 1 : 0)
}

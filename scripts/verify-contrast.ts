// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * verify-contrast.ts — Static WCAG contrast auditor for Vue templates.
 *
 * Flags known-bad Quasar color class combinations that fail WCAG AA contrast
 * (4.5:1 for normal text, 3:1 for large text).
 *
 * Background: Quasar's default `text-grey` helper is #9e9e9e, which fails
 * WCAG AA on white backgrounds (~2.8:1). Captions and body text must use
 * text-grey-8 (#424242, ~10:1) or darker. See docs/development/LESSONS-LEARNED.md
 * "Login Contrast Gotcha" (2026-04-12).
 *
 * This is a static scan — it catches the common bad patterns before push.
 * For full runtime contrast verification, use axe-core in E2E tests.
 *
 * Usage:  npx tsx scripts/verify-contrast.ts
 * Exit:   0 = no violations, 1 = violations found
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, resolve, relative } from 'path'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const ROOT = resolve(import.meta.dirname, '..')
const REPORT_DIR = join(ROOT, 'reports', 'contrast')

interface Violation {
  file: string
  line: number
  text: string
  rule: string
  severity: 'error' | 'warning'
}

interface ContrastRule {
  id: string
  // Regex that matches a bad class combination
  pattern: RegExp
  // Human-readable explanation
  message: string
  // Suggested fix
  fix: string
  severity: 'error' | 'warning'
}

// Quasar color helpers with their approximate contrast ratios on #ffffff background
// text-grey       = #9e9e9e  (2.83:1)  FAIL AA
// text-grey-1..5  = too light (FAIL)
// text-grey-6     = #757575  (4.54:1)  PASS AA body
// text-grey-7     = #616161  (5.75:1)  PASS AA
// text-grey-8     = #424242  (10.37:1) PASS AAA
// text-grey-9     = #212121  (16.10:1) PASS AAA
// text-grey-10    = #000000  (21:1)    PASS AAA

const RULES: ContrastRule[] = [
  {
    id: 'quasar-text-grey-bare',
    // Match `text-grey` NOT followed by a dash-digit (so text-grey-8 is OK)
    pattern: /\btext-grey(?!-\d)/,
    message: 'Quasar `text-grey` is #9e9e9e (~2.8:1 contrast) — FAILS WCAG AA on white backgrounds',
    fix: 'Use `text-grey-8` (10.4:1) for captions/body, `text-grey-7` (5.75:1) minimum',
    severity: 'error',
  },
  {
    id: 'quasar-text-grey-light',
    // text-grey-1 through text-grey-5 all fail AA on white
    pattern: /\btext-grey-[1-5]\b/,
    message: 'Quasar `text-grey-1..5` fail WCAG AA contrast on white backgrounds',
    fix: 'Use `text-grey-7` (5.75:1) minimum, `text-grey-8` (10.4:1) recommended',
    severity: 'error',
  },
]

const EXTENSIONS = ['.vue', '.tsx']
const IGNORE_DIRS = ['node_modules', 'dist', 'dist-ssr', 'coverage', '.git', 'testing', 'src-ssr']
// Ignore demo/preview files where contrast is set by the user's theme/tier switcher
const IGNORE_FILES = [
  // Add specific file paths here if they need exemption
]

function walkFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    if (IGNORE_DIRS.includes(entry)) continue
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      walkFiles(fullPath, files)
    } else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      files.push(fullPath)
    }
  }
  return files
}

function checkFile(filePath: string): Violation[] {
  const violations: Violation[] = []
  const rel = relative(ROOT, filePath)
  if (IGNORE_FILES.some((f) => rel.endsWith(f))) return violations

  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    // Skip comment lines
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('<!--')) continue

    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        violations.push({
          file: rel,
          line: i + 1,
          text: line.trim(),
          rule: rule.id,
          severity: rule.severity,
        })
      }
    }
  }

  return violations
}

function main(): void {
  const srcDir = join(ROOT, 'src')
  if (!existsSync(srcDir)) {
    console.error(`${RED}ERROR:${RESET} src/ directory not found at ${srcDir}`)
    process.exit(1)
  }

  const files = walkFiles(srcDir)
  const allViolations: Violation[] = []

  for (const file of files) {
    const violations = checkFile(file)
    allViolations.push(...violations)
  }

  // Sort by severity (errors first) then file/line
  allViolations.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
    if (a.file !== b.file) return a.file.localeCompare(b.file)
    return a.line - b.line
  })

  console.log('')
  console.log(`${BOLD}Contrast Compliance Report${RESET}`)
  console.log('==========================')
  console.log('')
  console.log(`Scanned ${files.length} files in src/`)
  console.log('')

  const errors = allViolations.filter((v) => v.severity === 'error')
  const warnings = allViolations.filter((v) => v.severity === 'warning')

  if (allViolations.length === 0) {
    console.log(`${GREEN}✓ No contrast violations found${RESET}`)
  } else {
    for (const v of allViolations) {
      const rule = RULES.find((r) => r.id === v.rule)
      const color = v.severity === 'error' ? RED : YELLOW
      const label = v.severity === 'error' ? 'FAIL' : 'WARN'
      console.log(`${color}${label}${RESET}  ${v.file}:${v.line}`)
      console.log(`      ${DIM}${v.text}${RESET}`)
      if (rule) {
        console.log(`      ${rule.message}`)
        console.log(`      ${DIM}Fix: ${rule.fix}${RESET}`)
      }
      console.log('')
    }
  }

  console.log(`${BOLD}Overall:${RESET} ${errors.length} errors, ${warnings.length} warnings`)
  console.log('')

  // Save report
  if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportPath = join(REPORT_DIR, `contrast-${timestamp}.json`)
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        filesScanned: files.length,
        errors: errors.length,
        warnings: warnings.length,
        violations: allViolations,
      },
      null,
      2,
    ),
  )
  console.log(`Report saved: ${relative(ROOT, reportPath)}`)
  console.log('')

  if (errors.length > 0) {
    console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${errors.length} contrast violation(s)`)
    process.exit(1)
  } else {
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET}`)
    process.exit(0)
  }
}

main()

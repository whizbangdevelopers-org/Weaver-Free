// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Decision Parity Auditor
 *
 * Ensures the MASTER-PLAN.md decision table is internally consistent and
 * that cross-references from other documents point to real decisions.
 *
 * Checks:
 *   1. Sequential numbering — no gaps in the 1..N sequence
 *   2. No duplicate decision numbers
 *   3. Ascending order — decisions appear in numerical order in the table
 *   4. Internal cross-references — "Decision #X" within MASTER-PLAN points to an existing row
 *   5. External cross-references — "Decision #X" in other .md files points to an existing row
 *   6. Amendment chain integrity — "Amended by Decision #X" targets exist
 *   7. Superseded chain integrity — "Superseded by Decision #X" targets exist
 *
 * Usage:
 *   npx tsx scripts/verify-decision-parity.ts
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
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

function pass(check: string, detail: string) {
  passes++
  findings.push({ check, status: 'pass', detail })
  console.log(`  ${PASS_ICON} ${detail}`)
}

function fail(check: string, detail: string) {
  errors++
  findings.push({ check, status: 'fail', detail })
  console.log(`  ${FAIL_ICON} ${detail}`)
}

function warn(check: string, detail: string) {
  warnings++
  findings.push({ check, status: 'warn', detail })
  console.log(`  ${WARN_ICON} ${detail}`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MASTER_PLAN = resolve(PROJECT_ROOT, 'MASTER-PLAN.md')

function readFile(path: string): string {
  return readFileSync(path, 'utf-8')
}

interface DecisionRow {
  number: number
  title: string
  lineNumber: number
  rawLine: string
}

function parseDecisionTable(content: string): DecisionRow[] {
  const lines = content.split('\n')
  const rows: DecisionRow[] = []
  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.includes('| # | Decision | Resolution |')) {
      inTable = true
      continue
    }

    if (inTable) {
      // Skip separator line
      if (/^\|[-\s|]+\|$/.test(line.trim())) continue

      const match = line.match(/^\| (\d+) \| ([^|]+)\|/)
      if (match) {
        rows.push({
          number: parseInt(match[1], 10),
          title: match[2].trim(),
          lineNumber: i + 1,
          rawLine: line,
        })
      } else if (line.trim() === '') {
        // blank line within table — skip
        continue
      } else {
        // End of table
        break
      }
    }
  }

  return rows
}

function findDecisionReferences(text: string): number[] {
  const refs: number[] = []
  const re = /Decision #(\d+)/g
  let m
  while ((m = re.exec(text)) !== null) {
    refs.push(parseInt(m[1], 10))
  }
  return refs
}

// ---------------------------------------------------------------------------
// Check 1: Sequential numbering (no gaps)
// ---------------------------------------------------------------------------

function checkSequentialNumbering(rows: DecisionRow[]) {
  console.log(`\n${BOLD}1. SEQUENTIAL NUMBERING${RESET}`)

  const numbers = rows.map((r) => r.number)
  const uniqueNumbers = [...new Set(numbers)].sort((a, b) => a - b)
  const max = uniqueNumbers[uniqueNumbers.length - 1]
  const expected = Array.from({ length: max }, (_, i) => i + 1)
  const missing = expected.filter((n) => !uniqueNumbers.includes(n))

  if (missing.length === 0) {
    pass('sequential', `All ${max} decisions present (1–${max}), no gaps`)
  } else {
    for (const num of missing) {
      fail('sequential', `Decision #${num} is missing from the table`)
    }
  }
}

// ---------------------------------------------------------------------------
// Check 2: No duplicates
// ---------------------------------------------------------------------------

function checkDuplicates(rows: DecisionRow[]) {
  console.log(`\n${BOLD}2. NO DUPLICATE NUMBERS${RESET}`)

  const seen = new Map<number, number[]>()
  for (const row of rows) {
    const existing = seen.get(row.number) || []
    existing.push(row.lineNumber)
    seen.set(row.number, existing)
  }

  let hasDupes = false
  for (const [num, lineNums] of seen) {
    if (lineNums.length > 1) {
      hasDupes = true
      fail(
        'duplicates',
        `Decision #${num} appears ${lineNums.length} times (lines ${lineNums.join(', ')})`,
      )
    }
  }

  if (!hasDupes) {
    pass('duplicates', `No duplicate decision numbers`)
  }
}

// ---------------------------------------------------------------------------
// Check 3: Ascending order
// ---------------------------------------------------------------------------

function checkAscendingOrder(rows: DecisionRow[]) {
  console.log(`\n${BOLD}3. ASCENDING ORDER${RESET}`)

  const outOfOrder: Array<{ prev: number; curr: number; line: number }> = []
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].number <= rows[i - 1].number) {
      outOfOrder.push({
        prev: rows[i - 1].number,
        curr: rows[i].number,
        line: rows[i].lineNumber,
      })
    }
  }

  if (outOfOrder.length === 0) {
    pass('order', 'Decision table is in ascending numerical order')
  } else {
    for (const { prev, curr, line } of outOfOrder.slice(0, 10)) {
      fail('order', `#${curr} follows #${prev} at line ${line} — out of order`)
    }
    if (outOfOrder.length > 10) {
      fail(
        'order',
        `... and ${outOfOrder.length - 10} more out-of-order entries`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Check 4: Internal cross-references (within MASTER-PLAN)
// ---------------------------------------------------------------------------

function checkInternalCrossRefs(
  content: string,
  validNumbers: Set<number>,
  rows: DecisionRow[],
) {
  console.log(`\n${BOLD}4. INTERNAL CROSS-REFERENCES${RESET}`)

  // Find all "Decision #X" references in decision resolutions
  let invalidCount = 0
  for (const row of rows) {
    const refs = findDecisionReferences(row.rawLine)
    // Filter out self-references
    const externalRefs = refs.filter((r) => r !== row.number)
    for (const ref of externalRefs) {
      if (!validNumbers.has(ref)) {
        fail(
          'internal-xref',
          `Decision #${row.number} references non-existent Decision #${ref}`,
        )
        invalidCount++
      }
    }
  }

  // Also check references outside the decision table
  const lines = content.split('\n')
  const tableLineNumbers = new Set(rows.map((r) => r.lineNumber))
  let outsideRefCount = 0

  for (let i = 0; i < lines.length; i++) {
    if (tableLineNumbers.has(i + 1)) continue
    const refs = findDecisionReferences(lines[i])
    for (const ref of refs) {
      outsideRefCount++
      if (!validNumbers.has(ref)) {
        fail(
          'internal-xref',
          `Line ${i + 1} references non-existent Decision #${ref}`,
        )
        invalidCount++
      }
    }
  }

  if (invalidCount === 0) {
    pass(
      'internal-xref',
      `All internal cross-references resolve (${outsideRefCount} refs outside table)`,
    )
  }
}

// ---------------------------------------------------------------------------
// Check 5: External cross-references (other .md files)
// ---------------------------------------------------------------------------

function checkExternalCrossRefs(validNumbers: Set<number>) {
  console.log(`\n${BOLD}5. EXTERNAL CROSS-REFERENCES${RESET}`)

  // Use grep to find all Decision #N references in .md files outside MASTER-PLAN
  let output: string
  try {
    output = execSync(
      `grep -rnP 'Decision #\\d+' --include='*.md' ${PROJECT_ROOT}`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
    )
  } catch (e: unknown) {
    const execError = e as { stdout?: string; status?: number }
    if (execError.status === 1) {
      // No matches found
      pass('external-xref', 'No external cross-references found')
      return
    }
    output = execError.stdout || ''
  }

  const masterPlanPath = resolve(PROJECT_ROOT, 'MASTER-PLAN.md')
  const invalidRefs: Array<{ file: string; line: number; ref: number }> = []
  let totalRefs = 0

  for (const line of output.split('\n')) {
    if (!line.trim()) continue

    // Parse grep output: file:linenum:content
    const match = line.match(/^(.+?):(\d+):(.+)$/)
    if (!match) continue

    const [, filePath, lineNum, content] = match

    // Skip MASTER-PLAN itself (covered by check 4)
    if (resolve(filePath) === masterPlanPath) continue

    // Skip session-log.md and archive — historical references are allowed to drift
    const relPath = relative(PROJECT_ROOT, filePath)
    if (relPath.includes('session-log') || relPath.includes('/archive/'))
      continue

    const refs = findDecisionReferences(content)
    for (const ref of refs) {
      totalRefs++
      if (!validNumbers.has(ref)) {
        invalidRefs.push({
          file: relPath,
          line: parseInt(lineNum, 10),
          ref,
        })
      }
    }
  }

  if (invalidRefs.length === 0) {
    pass(
      'external-xref',
      `All ${totalRefs} external cross-references resolve`,
    )
  } else {
    for (const { file, line, ref } of invalidRefs.slice(0, 15)) {
      fail(
        'external-xref',
        `${file}:${line} references non-existent Decision #${ref}`,
      )
    }
    if (invalidRefs.length > 15) {
      warn(
        'external-xref',
        `... and ${invalidRefs.length - 15} more broken external refs`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Check 6: Amendment chain integrity
// ---------------------------------------------------------------------------

function checkAmendmentChains(rows: DecisionRow[], validNumbers: Set<number>) {
  console.log(`\n${BOLD}6. AMENDMENT & SUPERSESSION CHAINS${RESET}`)

  const patterns = [
    { label: 'Amended by', re: /Amended by Decision #(\d+)/gi },
    { label: 'Amends Decision', re: /Amends Decision #(\d+)/gi },
    { label: 'Superseded by', re: /Superseded by Decision #(\d+)/gi },
    { label: 'Supersedes Decision', re: /Supersedes Decision #(\d+)/gi },
  ]

  let chainCount = 0
  let brokenCount = 0

  for (const row of rows) {
    for (const { label, re } of patterns) {
      // Reset regex lastIndex
      re.lastIndex = 0
      let m
      while ((m = re.exec(row.rawLine)) !== null) {
        const target = parseInt(m[1], 10)
        chainCount++
        if (!validNumbers.has(target)) {
          fail(
            'amendment-chain',
            `Decision #${row.number}: "${label} #${target}" — target does not exist`,
          )
          brokenCount++
        }
      }
    }
  }

  if (brokenCount === 0) {
    pass(
      'amendment-chain',
      `All ${chainCount} amendment/supersession chains resolve`,
    )
  }
}

// ---------------------------------------------------------------------------
// Check 7: Decision count consistency across docs
// ---------------------------------------------------------------------------

function checkDecisionCountClaims(totalDecisions: number) {
  console.log(`\n${BOLD}7. DECISION COUNT CLAIMS${RESET}`)

  // Check if any doc claims a specific decision count
  const docsToCheck = [
    resolve(PROJECT_ROOT, 'MASTER-PLAN.md'),
    resolve(ROOT, 'CLAUDE.md'),
  ]

  for (const docPath of docsToCheck) {
    if (!existsSync(docPath)) continue
    const content = readFile(docPath)
    const relPath = relative(PROJECT_ROOT, docPath)

    // Look for patterns like "130 decisions" or "decisions resolved" with a count
    const countMatch = content.match(/(\d+)\s+decisions?\s+resolved/i)
    if (countMatch) {
      const claimed = parseInt(countMatch[1], 10)
      if (claimed === totalDecisions) {
        pass(
          'count-claim',
          `${relPath}: claims ${claimed} decisions — matches`,
        )
      } else {
        fail(
          'count-claim',
          `${relPath}: claims ${claimed} decisions but table has ${totalDecisions}`,
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const startTime = Date.now()

console.log(`${BOLD}Decision Parity Auditor${RESET}`)
console.log(`${DIM}${'─'.repeat(40)}${RESET}`)

if (!existsSync(MASTER_PLAN)) {
  console.error(`${RED}MASTER-PLAN.md not found at ${MASTER_PLAN}${RESET}`)
  process.exit(1)
}

const masterPlanContent = readFile(MASTER_PLAN)
const rows = parseDecisionTable(masterPlanContent)

if (rows.length === 0) {
  console.error(
    `${RED}No decision rows found in MASTER-PLAN.md decision table${RESET}`,
  )
  process.exit(1)
}

console.log(`${DIM}Found ${rows.length} decision rows${RESET}`)

const validNumbers = new Set(rows.map((r) => r.number))

checkSequentialNumbering(rows)
checkDuplicates(rows)
checkAscendingOrder(rows)
checkInternalCrossRefs(masterPlanContent, validNumbers, rows)
checkExternalCrossRefs(validNumbers)
checkAmendmentChains(rows, validNumbers)
checkDecisionCountClaims(rows.length)

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const durationMs = Date.now() - startTime

console.log(`\n${'='.repeat(40)}`)
console.log(
  `  ${GREEN}${passes} passed${RESET}  ${errors > 0 ? RED : DIM}${errors} failed${RESET}  ${warnings > 0 ? YELLOW : DIM}${warnings} warnings${RESET}  ${DIM}(${durationMs}ms)${RESET}`,
)

saveReport({
  reportName: 'decision-parity',
  timestamp: new Date().toISOString(),
  durationMs,
  result: errors > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
  summary: {
    passes,
    errors,
    warnings,
    totalDecisions: rows.length,
    maxDecisionNumber: Math.max(...rows.map((r) => r.number)),
  },
  data: { findings },
})

if (errors > 0) {
  console.log(`\n${RED}${BOLD}RESULT: FAIL${RESET} — ${errors} error(s)`)
  console.log(
    `${DIM}Fix MASTER-PLAN.md decision table, then re-run: npm run audit:decision-parity${RESET}`,
  )
  process.exit(1)
} else if (warnings > 0) {
  console.log(
    `\n${GREEN}${BOLD}RESULT: PASS${RESET} ${DIM}(${warnings} warning(s))${RESET}`,
  )
  process.exit(0)
} else {
  console.log(`\n${GREEN}${BOLD}RESULT: PASS${RESET}`)
  process.exit(0)
}

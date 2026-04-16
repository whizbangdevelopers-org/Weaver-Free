// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Project Parity Auditor (#27)
 *
 * Verifies that plans/, agents/, and business/ docs stay in sync with
 * authoritative sources. Catches vocabulary, tier, navigation, and
 * decision drift that the code-scoped auditors miss.
 *
 * Authority sources:
 *   - vocabularies.ts          → deprecated term map
 *   - tier-matrix.json         → tier names
 *   - MASTER-PLAN.md           → decisions, superseded entries
 *   - forge/STATUS.json        → version queue
 *
 * Checks:
 *   1. Deprecated terms       — old names that have been renamed (FAIL)
 *   2. Retired page/nav names — Dashboard, Workbench, etc. (WARN)
 *   3. Superseded decisions    — references to decisions marked superseded (WARN)
 *
 * Usage:
 *   npx tsx scripts/verify-project-parity.ts            # Console report
 *   npx tsx scripts/verify-project-parity.ts --fix      # Apply mechanical replacements
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { globSync } from 'glob'
import { resolve, dirname } from 'path'
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
// CLI flags
// ---------------------------------------------------------------------------

const fixMode = process.argv.includes('--fix')

// ---------------------------------------------------------------------------
// 1. Deprecated Terms Map
//
// Every rename decision adds an entry. The auditor scans for `old` and
// suggests `new`. In --fix mode, mechanical replacements are applied.
//
// Rules:
//   - `pattern` is case-sensitive by default; use flags for case-insensitive
//   - `context` narrows matches to lines containing these strings (avoids
//     false positives on generic English words)
//   - `fixable` indicates whether --fix should auto-replace
//   - `skipPatterns` excludes specific files/dirs from this rule
// ---------------------------------------------------------------------------

interface DeprecatedTerm {
  old: string
  new: string
  /** Regex to match the old term. */
  pattern: RegExp
  /** Optional context: only flag if line also contains one of these. */
  context?: RegExp
  /** Decision that triggered the rename. */
  decision: string
  /** Whether --fix can auto-replace. */
  fixable: boolean
  /** Search pattern for replacement (only used when fixable=true). */
  search?: RegExp
  /** Replacement string (only used when fixable=true). */
  replace?: string
  /** Limit to specific project-root directories. Omit = all (plans, agents, business). */
  dirs?: string[]
}

const DEPRECATED_TERMS: DeprecatedTerm[] = [
  // Decision #137: premium → weaver, enterprise → fabrick
  {
    old: 'premium',
    new: 'weaver',
    pattern: /\bpremium\b/i,
    context: /tier|feature|route|gat[ei]|sync|directory|dir|component|backend|frontend|distribution|license|BSL|AGPL/i,
    decision: '#137',
    fixable: true,
    search: /\bpremium\b/g,
    replace: 'weaver',
  },
  {
    old: 'Premium',
    new: 'Weaver',
    pattern: /\bPremium\b/,
    context: /[Tt]ier|[Ff]eature|[Rr]oute|[Gg]at[ei]|[Ss]ync|[Dd]irect|[Cc]omponent|[Bb]ackend|[Ff]rontend|[Dd]istribut|[Ll]icense|BSL|AGPL/,
    decision: '#137',
    fixable: true,
    search: /\bPremium\b/g,
    replace: 'Weaver',
  },
  {
    old: 'enterprise',
    new: 'fabrick',
    pattern: /\benterprise\b/i,
    context: /tier|feature|route|gat[ei]|sync|directory|dir|component|backend|frontend|distribution|license|BSL|AGPL/i,
    decision: '#137',
    fixable: true,
    search: /\benterprise\b/g,
    replace: 'fabrick',
  },
  {
    old: 'Enterprise',
    new: 'FabricK',
    pattern: /\bEnterprise\b/,
    context: /[Tt]ier|[Ff]eature|[Rr]oute|[Gg]at[ei]|[Ss]ync|[Dd]irect|[Cc]omponent|[Bb]ackend|[Ff]rontend|[Dd]istribut|[Ll]icense|BSL|AGPL/,
    decision: '#137',
    fixable: true,
    search: /\bEnterprise\b/g,
    replace: 'FabricK',
  },
  // Decision #75: page/nav renames — only in plans/ and agents/ (business/ uses
  // "Dashboard" generically in sales/marketing context where it means the product concept)
  {
    old: 'Dashboard',
    new: 'Weaver',
    pattern: /\bDashboard\b/,
    decision: '#75',
    fixable: true,
    search: /\bDashboard\b/g,
    replace: 'Weaver',
    dirs: ['plans', 'agents'],
  },
  {
    old: 'Workbench',
    new: 'Weaver',
    pattern: /\bWorkbench\b/,
    decision: '#75',
    fixable: true,
    search: /\bWorkbench\b/g,
    replace: 'Weaver',
    dirs: ['plans', 'agents'],
  },
  {
    old: 'Network Map',
    new: 'Strands',
    pattern: /\bNetwork Map\b/,
    decision: '#75',
    fixable: true,
    search: /\bNetwork Map\b/g,
    replace: 'Strands',
    dirs: ['plans', 'agents'],
  },
  {
    old: 'NEW WORKLOAD',
    new: 'Shed',
    pattern: /\bNEW WORKLOAD\b/,
    decision: '#92',
    fixable: true,
    search: /\bNEW WORKLOAD\b/g,
    replace: 'Shed',
    dirs: ['plans', 'agents'],
  },
]

// ---------------------------------------------------------------------------
// 2. Superseded Decisions
//
// Parse MASTER-PLAN decision log for entries containing "Superseded by"
// and build a map of superseded decision numbers.
// ---------------------------------------------------------------------------

interface SupersededDecision {
  number: number
  supersededBy: string
}

function parseSupersededDecisions(): SupersededDecision[] {
  const masterPlanPath = resolve(PROJECT_ROOT, 'MASTER-PLAN.md')
  if (!existsSync(masterPlanPath)) return []

  const content = readFileSync(masterPlanPath, 'utf-8')
  const results: SupersededDecision[] = []

  // Match decision rows: | # | Decision | Resolution |
  // Look for "Superseded by Decision #X" or "*Superseded by Decision #X*"
  const rowPattern = /^\|\s*(\d+)\s*\|/gm
  const supersededPattern = /[Ss]uperseded\s+by\s+Decision\s+#(\d+)/

  for (const match of content.matchAll(rowPattern)) {
    const decNum = parseInt(match[1], 10)
    const lineStart = match.index!
    const lineEnd = content.indexOf('\n', lineStart)
    const line = content.substring(lineStart, lineEnd === -1 ? undefined : lineEnd)

    const supersededMatch = supersededPattern.exec(line)
    if (supersededMatch) {
      results.push({ number: decNum, supersededBy: `#${supersededMatch[1]}` })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// File Discovery
// ---------------------------------------------------------------------------

function getProjectDocs(): string[] {
  const dirs = ['plans', 'agents', 'business']
  const files: string[] = []

  for (const dir of dirs) {
    const absDir = resolve(PROJECT_ROOT, dir)
    if (!existsSync(absDir)) continue

    const found = globSync('**/*.md', {
      cwd: absDir,
      ignore: ['**/archive/**'],
    })
    files.push(...found.map(f => resolve(absDir, f)))
  }

  return files
}

// ---------------------------------------------------------------------------
// Line-level skip rules (shared across all checks)
// ---------------------------------------------------------------------------

function shouldSkipLine(line: string): boolean {
  // Skip copyright headers
  if (line.includes('Copyright (c)')) return true
  // Skip lines referencing a Decision # (historical context)
  if (/Decision\s+#\d+/.test(line)) return true
  // Skip lines that are quoting old names explicitly
  if (line.includes('renamed') || line.includes('formerly') || line.includes('was ')) return true
  // Skip markdown table header separators
  if (/^\|[-:\s|]+\|$/.test(line.trim())) return true
  // Skip repo names (proper nouns, not tier references)
  if (/Weaver-Dev-Premium|Weaver-Dev-Enterprise/i.test(line)) return true
  // Skip backtick-quoted code identifiers (variable names, paths, etc.)
  if (/`[^`]*(?:premium|enterprise)[^`]*`/i.test(line)) return true
  return false
}

// ---------------------------------------------------------------------------
// Check 1: Deprecated Terms
// ---------------------------------------------------------------------------

interface TermFinding {
  file: string
  line: number
  old: string
  new: string
  decision: string
  context: string
  fixable: boolean
}

function checkDeprecatedTerms(files: string[]): { findings: TermFinding[]; fixed: number } {
  const findings: TermFinding[] = []
  let fixed = 0

  for (const absPath of files) {
    const relPath = absPath.replace(PROJECT_ROOT + '/', '')
    let content = readFileSync(absPath, 'utf-8')
    const lines = content.split('\n')
    let fileModified = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (shouldSkipLine(line)) continue

      for (const term of DEPRECATED_TERMS) {
        if (!term.pattern.test(line)) continue
        // If context filter defined, line must also match context
        if (term.context && !term.context.test(line)) continue
        // If dir-scoped, check the file is in an allowed directory
        if (term.dirs && !term.dirs.some(d => relPath.startsWith(d + '/'))) continue

        findings.push({
          file: relPath,
          line: i + 1,
          old: term.old,
          new: term.new,
          decision: term.decision,
          context: line.trim().substring(0, 120),
          fixable: term.fixable,
        })

        if (fixMode && term.fixable && term.search && term.replace) {
          lines[i] = lines[i].replace(term.search, term.replace)
          fileModified = true
          fixed++
        }
      }
    }

    if (fixMode && fileModified) {
      writeFileSync(absPath, lines.join('\n'))
    }
  }

  return { findings, fixed }
}

// ---------------------------------------------------------------------------
// Check 2: Retired Navigation Names
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Check 2: Superseded Decision References
// ---------------------------------------------------------------------------

interface SupersededFinding {
  file: string
  line: number
  decision: number
  supersededBy: string
  context: string
}

function checkSupersededDecisions(files: string[], superseded: SupersededDecision[]): { findings: SupersededFinding[]; fixed: number } {
  if (superseded.length === 0) return { findings: [], fixed: 0 }

  const findings: SupersededFinding[] = []
  const supersededMap = new Map(superseded.map(s => [s.number, s.supersededBy]))
  let fixed = 0

  for (const absPath of files) {
    const relPath = absPath.replace(PROJECT_ROOT + '/', '')
    const content = readFileSync(absPath, 'utf-8')
    const lines = content.split('\n')
    let fileModified = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Find Decision #N references
      const refs = [...line.matchAll(/Decision\s+#(\d+)/g)]
      for (const ref of refs) {
        const num = parseInt(ref[1], 10)
        const supersededBy = supersededMap.get(num)
        if (!supersededBy) continue

        // Skip if this line already notes the supersession
        const alreadyNoted = new RegExp(`#${num}[^)]*superseded`, 'i').test(line) ||
          new RegExp(`superseded[^)]*#${num}`, 'i').test(line)
        if (alreadyNoted) continue

        findings.push({
          file: relPath,
          line: i + 1,
          decision: num,
          supersededBy,
          context: line.trim().substring(0, 120),
        })

        if (fixMode) {
          // Append supersession note after the reference: Decision #33 → Decision #33 (superseded by #63)
          lines[i] = lines[i].replace(
            new RegExp(`(Decision\\s+#${num})(?!\\s*\\(superseded)`),
            `$1 (superseded by ${supersededBy})`
          )
          fileModified = true
          fixed++
        }
      }
    }

    if (fixMode && fileModified) {
      writeFileSync(absPath, lines.join('\n'))
    }
  }

  return { findings, fixed }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const startTime = Date.now()

const files = getProjectDocs()
const superseded = parseSupersededDecisions()

const { findings: termFindings, fixed: termFixed } = checkDeprecatedTerms(files)
const { findings: supersededFindings, fixed: supersededFixed } = checkSupersededDecisions(files, superseded)

const errors = termFindings.length + supersededFindings.length
const durationMs = Date.now() - startTime

saveReport({
  reportName: 'project-parity',
  timestamp: new Date().toISOString(),
  durationMs,
  result: errors > 0 ? 'fail' : 'pass',
  summary: {
    filesScanned: files.length,
    deprecatedTerms: termFindings.length,
    supersededDecisions: supersededFindings.length,
    termsFixed: fixMode ? termFixed : 0,
    supersededFixed: fixMode ? supersededFixed : 0,
  },
  data: {
    termFindings,
    supersededFindings,
    supersededDecisionsDetected: superseded,
  },
})

// Console output
console.log(`${BOLD}Project Parity Report${RESET}`)
console.log('=====================')
console.log('')
console.log(`Scanned ${files.length} docs in plans/, agents/, business/ (excluding archive/)`)
console.log('')

// Deprecated terms (FAIL)
if (termFindings.length > 0) {
  if (fixMode) {
    console.log(`${GREEN}${BOLD}DEPRECATED TERMS:${RESET} Fixed ${termFixed} occurrence(s)`)
  } else {
    console.log(`${RED}${BOLD}DEPRECATED TERMS:${RESET} ${termFindings.length} stale term(s) found`)
    console.log(`${DIM}Run with --fix to auto-replace mechanical renames.${RESET}`)
  }
  console.log('')

  // Group by file, show up to 30
  const byFile = new Map<string, TermFinding[]>()
  for (const f of termFindings) {
    const list = byFile.get(f.file) || []
    list.push(f)
    byFile.set(f.file, list)
  }

  let shown = 0
  for (const [file, fileFounds] of byFile) {
    if (shown >= 30) { console.log(`  ${DIM}... and ${termFindings.length - shown} more${RESET}`); break }
    console.log(`  ${DIM}${file}${RESET}`)
    for (const f of fileFounds.slice(0, 3)) {
      console.log(`    ${FAIL_ICON} :${f.line} ${f.old} → ${f.new} (${f.decision})`)
      shown++
    }
    if (fileFounds.length > 3) {
      console.log(`    ${DIM}... +${fileFounds.length - 3} more in this file${RESET}`)
      shown += fileFounds.length - 3
    }
  }
  console.log('')
}

// Superseded decisions (FAIL — auto-fixable)
if (supersededFindings.length > 0) {
  if (fixMode) {
    console.log(`${GREEN}${BOLD}SUPERSEDED DECISIONS:${RESET} Fixed ${supersededFixed} reference(s) — appended supersession notes`)
  } else {
    console.log(`${RED}${BOLD}SUPERSEDED DECISIONS:${RESET} ${supersededFindings.length} reference(s) to superseded decisions`)
    console.log(`${DIM}Run with --fix to auto-append supersession notes.${RESET}`)
  }
  console.log('')

  for (const f of supersededFindings.slice(0, 15)) {
    console.log(`  ${FAIL_ICON} ${f.file}:${f.line} — Decision #${f.decision} superseded by ${f.supersededBy}`)
  }
  if (supersededFindings.length > 15) {
    console.log(`  ${DIM}... and ${supersededFindings.length - 15} more${RESET}`)
  }
  console.log('')
}

// Result
const totalFixed = termFixed + supersededFixed
if (fixMode && totalFixed > 0) {
  console.log(`${GREEN}${BOLD}FIXED:${RESET} ${termFixed} deprecated term(s) + ${supersededFixed} superseded reference(s) across project docs`)
  console.log(`${DIM}Review changes with git diff, then commit.${RESET}`)
} else if (errors > 0) {
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${errors} error(s)`)
  console.log(`${DIM}Fix: npx tsx scripts/verify-project-parity.ts --fix${RESET}`)
  process.exit(1)
} else {
  console.log(`${GREEN}${BOLD}RESULT: PASS${RESET}`)
}

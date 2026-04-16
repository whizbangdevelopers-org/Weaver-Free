// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Vocabulary Sync Auditor
 *
 * Verifies that the three copies of vocabularies.ts (frontend, backend, TUI)
 * are identical. The frontend copy is canonical — backend and TUI must match.
 *
 * Also scans source files for bare string literals that should use vocabulary
 * constants, flagging potential drift.
 *
 * Usage:
 *   npx tsx scripts/verify-vocabulary-sync.ts          # Console report
 *   npx tsx scripts/verify-vocabulary-sync.ts --json    # JSON output
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { globSync } from 'glob'
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

// ---------------------------------------------------------------------------
// Vocabulary file paths
// ---------------------------------------------------------------------------

const CANONICAL = 'src/constants/vocabularies.ts'
const COPIES = [
  'backend/src/constants/vocabularies.ts',
  'tui/src/constants/vocabularies.ts',
]

// ---------------------------------------------------------------------------
// Step 1: Check file sync
// ---------------------------------------------------------------------------

interface SyncResult {
  file: string
  status: 'match' | 'mismatch' | 'missing'
  details?: string
}

function checkSync(): SyncResult[] {
  const canonicalPath = resolve(rootDir, CANONICAL)
  if (!existsSync(canonicalPath)) {
    return [{ file: CANONICAL, status: 'missing', details: 'Canonical file not found' }]
  }

  const canonicalContent = readFileSync(canonicalPath, 'utf-8')
  const results: SyncResult[] = []

  for (const copy of COPIES) {
    const copyPath = resolve(rootDir, copy)
    if (!existsSync(copyPath)) {
      results.push({ file: copy, status: 'missing', details: 'Copy not found' })
      continue
    }

    const copyContent = readFileSync(copyPath, 'utf-8')
    if (copyContent === canonicalContent) {
      results.push({ file: copy, status: 'match' })
    } else {
      results.push({ file: copy, status: 'mismatch', details: 'Content differs from canonical' })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Step 2: Scan for bare string literals that should use constants
// ---------------------------------------------------------------------------

interface LiteralFinding {
  file: string
  line: number
  literal: string
  category: 'tier' | 'role' | 'status'
  suggestion: string
}

// Patterns that indicate a vocabulary literal (not just any string)
const TIER_CONTEXT = /(?:tier|Tier|requireTier|minimumTier|TIER)/
const ROLE_CONTEXT = /(?:role|Role|userRole|UserRole|ROLE)/
const STATUS_CONTEXT = /(?:status|Status|STATUS)/

function scanForBareLiterals(): LiteralFinding[] {
  const findings: LiteralFinding[] = []

  const sourceFiles = [
    ...globSync(resolve(rootDir, 'src/**/*.{ts,vue}'), { ignore: ['**/node_modules/**', '**/constants/**'] }),
    ...globSync(resolve(rootDir, 'backend/src/**/*.ts'), { ignore: ['**/node_modules/**', '**/constants/**'] }),
    ...globSync(resolve(rootDir, 'tui/src/**/*.{ts,tsx}'), { ignore: ['**/node_modules/**', '**/constants/**', '**/dist/**'] }),
  ]

  const tierLiterals = new Map([
    ["'demo'", 'TIERS.DEMO'], ["'free'", 'TIERS.FREE'],
    ["'weaver'", 'TIERS.SOLO'], ["'fabrick'", 'TIERS.FABRICK'],
  ])

  const roleLiterals = new Map([
    ["'admin'", 'ROLES.ADMIN'], ["'operator'", 'ROLES.OPERATOR'], ["'viewer'", 'ROLES.VIEWER'],
  ])

  const statusLiterals = new Map([
    ["'running'", 'STATUSES.RUNNING'], ["'idle'", 'STATUSES.IDLE'],
    ["'stopped'", 'STATUSES.STOPPED'], ["'failed'", 'STATUSES.FAILED'], ["'unknown'", 'STATUSES.UNKNOWN'],
  ])

  for (const filePath of sourceFiles) {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const relPath = filePath.replace(rootDir + '/', '')

    // Skip the vocabularies.ts files themselves
    if (relPath.includes('constants/vocabularies')) continue
    // Skip test files (test assertions often use literal strings)
    if (relPath.includes('.spec.') || relPath.includes('__tests__')) continue

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip comments and imports
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.includes('import ')) continue

      // Check tier literals in tier context
      if (TIER_CONTEXT.test(line)) {
        for (const [literal, suggestion] of tierLiterals) {
          if (line.includes(literal)) {
            findings.push({
              file: relPath, line: i + 1, literal: literal.replace(/'/g, ''),
              category: 'tier', suggestion,
            })
          }
        }
      }

      // Check role literals in role context
      if (ROLE_CONTEXT.test(line)) {
        for (const [literal, suggestion] of roleLiterals) {
          if (line.includes(literal)) {
            findings.push({
              file: relPath, line: i + 1, literal: literal.replace(/'/g, ''),
              category: 'role', suggestion,
            })
          }
        }
      }

      // Check status literals in status context
      if (STATUS_CONTEXT.test(line)) {
        for (const [literal, suggestion] of statusLiterals) {
          if (line.includes(literal)) {
            findings.push({
              file: relPath, line: i + 1, literal: literal.replace(/'/g, ''),
              category: 'status', suggestion,
            })
          }
        }
      }
    }
  }

  return findings
}

// ---------------------------------------------------------------------------
// Step 3: Scan for deprecated tier names (Decision #137)
// ---------------------------------------------------------------------------

interface DeprecatedTierFinding {
  file: string
  line: number
  term: string
  context: string
}

/**
 * Deprecated tier names that should no longer appear as Weaver tier identifiers.
 * "Premium" → "Weaver" (Solo/Team). "Enterprise" → "Fabrick".
 *
 * Scan code, docs, tests, and config for these used as tier names.
 * Historical decision log entries and archived files are excluded.
 */
function scanForDeprecatedTierNames(): DeprecatedTierFinding[] {
  const findings: DeprecatedTierFinding[] = []

  // Files to scan: source code, docs, tests, config — everything under code/
  const sourceFiles = [
    ...globSync(resolve(rootDir, 'src/**/*.{ts,vue}'), { ignore: ['**/node_modules/**'] }),
    ...globSync(resolve(rootDir, 'backend/**/*.ts'), { ignore: ['**/node_modules/**'] }),
    ...globSync(resolve(rootDir, 'tui/src/**/*.{ts,tsx}'), { ignore: ['**/node_modules/**', '**/dist/**'] }),
    ...globSync(resolve(rootDir, 'testing/**/*.ts'), { ignore: ['**/node_modules/**'] }),
    ...globSync(resolve(rootDir, 'scripts/**/*.ts'), { ignore: ['**/node_modules/**'] }),
    ...globSync(resolve(rootDir, '*.md')),
    ...globSync(resolve(rootDir, 'docs/**/*.md')),
  ]

  // Files to skip (historical, generated, or self-referencing)
  const skipPatterns = [
    'LESSONS-LEARNED.md',
    'KNOWN-GOTCHAS.md',
    'CHANGELOG.md',       // historical release notes
    'verify-vocabulary-sync.ts', // this file
    'verify-license-parity.ts',  // references retired terms list
    'license-matrix.json',
    'tier-matrix.json',
  ]

  // Patterns that indicate "Premium"/"Enterprise" used as a tier name
  // (not as a generic adjective like "enterprise-grade")
  const tierNamePatterns = [
    // Tier name in headings/labels
    /(?:###?\s*(?:Premium|Enterprise)\s+(?:Tier|Features?))/i,
    // Tier string literals in code
    /(?:tier\s*[:=]\s*['"](?:premium|enterprise)['"])/i,
    // Tier name in config/data
    /(?:['"](?:premium|enterprise)['"]\s*(?:=>|:))/i,
    // Tier references in prose (e.g., "Premium Tier", "Enterprise tier")
    /\b(?:Premium|Enterprise)\s+(?:Tier|tier)\b/,
    // Tier in parentheses (e.g., "(Premium)", "(Enterprise)")
    /\((?:Premium|Enterprise)\)/,
    // Tier in slash-separated lists (e.g., "Free / Premium / Enterprise")
    /(?:Free\s*\/\s*(?:Premium|Enterprise))|(?:(?:Premium|Enterprise)\s*\/\s*(?:Free|Enterprise|Premium))/,
    // PREMIUM_ENABLED and similar env/config patterns
    /PREMIUM_ENABLED/,
    // Tier prop/param value
    /tier="(?:premium|enterprise)"/i,
  ]

  for (const filePath of sourceFiles) {
    const relPath = filePath.replace(rootDir + '/', '')

    // Skip excluded files
    if (skipPatterns.some(p => relPath.includes(p))) continue

    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip copyright headers, comments about the rename itself, and backward-compat env var references
      if (line.includes('Decision #') || line.includes('renamed') || line.includes('was Premium')) continue
      // PREMIUM_ENABLED is a real backward-compat env var — references to it are legitimate
      if (/PREMIUM_ENABLED/.test(line)) continue

      for (const pattern of tierNamePatterns) {
        if (pattern.test(line)) {
          const term = /premium/i.test(line) ? 'Premium' : 'Enterprise'
          findings.push({
            file: relPath,
            line: i + 1,
            term,
            context: line.trim().substring(0, 100),
          })
          break // one finding per line is enough
        }
      }
    }
  }

  return findings
}

// ---------------------------------------------------------------------------
// Step 4: Scan for forbidden deployment path language
// ---------------------------------------------------------------------------

interface ForbiddenDeploymentFinding {
  file: string
  line: number
  phrase: string
  context: string
}

/**
 * Weaver is NixOS-only. Phrases implying non-NixOS deployment support
 * must not appear in user-facing docs, UI text, or code comments that
 * describe deployment.
 *
 * Legitimate uses of "non-NixOS" (weaver-observer for fleet observation,
 * non-NixOS VM guests) are excluded by checking surrounding context.
 */
function scanForForbiddenDeploymentPhrases(): ForbiddenDeploymentFinding[] {
  const findings: ForbiddenDeploymentFinding[] = []

  const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; phrase: string }> = [
    { pattern: /standalone\s+deploy/i, phrase: 'standalone deploy*' },
    { pattern: /standalone\s+install/i, phrase: 'standalone install*' },
    { pattern: /Manual\/Standalone/i, phrase: 'Manual/Standalone' },
    { pattern: /non-NixOS\s+deploy/i, phrase: 'non-NixOS deploy*' },
    { pattern: /non-NixOS\s+Linux\s*\+\s*Node/i, phrase: 'non-NixOS Linux + Node' },
    { pattern: /systemd.*Non-NixOS/i, phrase: 'systemd (Non-NixOS)' },
    { pattern: /Nginx.*Non-NixOS/i, phrase: 'Nginx (Non-NixOS)' },
    { pattern: /manual\s+setup.*community/i, phrase: 'manual setup | Community' },
  ]

  // Exclude: decision log, archived plans, lessons-learned, sales docs (observer), known-gotchas
  const EXCLUDE_PATTERNS = [
    /\/archive\//,
    /MASTER-PLAN\.md/,
    /LESSONS-LEARNED\.md/,
    /KNOWN-GOTCHAS\.md/,
    /business\//,
    /plans\//,
    /agents\//,
    /research\//,
  ]

  const scanFiles = [
    ...globSync(resolve(rootDir, 'src/**/*.{ts,vue}'), { ignore: ['**/node_modules/**'] }),
    ...globSync(resolve(rootDir, 'backend/**/*.ts'), { ignore: ['**/node_modules/**'] }),
    ...globSync(resolve(rootDir, 'tui/src/**/*.{ts,tsx}'), { ignore: ['**/node_modules/**', '**/dist/**'] }),
    ...globSync(resolve(rootDir, 'docs/**/*.md')),
    ...globSync(resolve(rootDir, 'README.md')),
    ...globSync(resolve(rootDir, 'demo/**/*.md')),
  ]

  for (const absPath of scanFiles) {
    const relPath = absPath.replace(rootDir + '/', '')
    if (EXCLUDE_PATTERNS.some(p => p.test(relPath))) continue

    const lines = readFileSync(absPath, 'utf-8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!

      for (const { pattern, phrase } of FORBIDDEN_PATTERNS) {
        if (pattern.test(line)) {
          findings.push({
            file: relPath,
            line: i + 1,
            phrase,
            context: line.trim().substring(0, 100),
          })
          break
        }
      }
    }
  }

  return findings
}

// ---------------------------------------------------------------------------
// Step 5: Scan for brand mark violations (FabricK capital K)
// ---------------------------------------------------------------------------

interface BrandMarkFinding {
  file: string
  line: number
  context: string
}

/**
 * In user-facing UI surfaces, the product name is "FabricK" (capital K).
 * Lowercase "Fabrick" is acceptable in conversation/docs/code comments,
 * but NOT in UI-rendered text (Vue templates, user-visible strings).
 *
 * Scans .vue template sections and user-facing string literals for
 * "Fabrick" without capital K when used as a standalone display name.
 */
function scanForBrandMarkViolations(): BrandMarkFinding[] {
  const findings: BrandMarkFinding[] = []

  // Scan Vue templates, frontend TS (config, constants), and TUI display code
  const scanFiles = [
    ...globSync(resolve(rootDir, 'src/**/*.vue'), { ignore: ['**/node_modules/**'] }),
    ...globSync(resolve(rootDir, 'src/**/*.ts'), { ignore: ['**/node_modules/**'] }),
    ...globSync(resolve(rootDir, 'tui/src/**/*.{ts,tsx}'), { ignore: ['**/node_modules/**', '**/dist/**'] }),
  ]

  // In UI surfaces, "Fabrick" must ALWAYS be "FabricK" (capital K).
  // No exceptions — titles, labels, prose, tooltips, descriptions, all of it.
  const brandPattern = /\bFabrick\b/

  // Skip patterns: CSS, code logic, correct usage
  const skipLine = (line: string) =>
    line.trim().startsWith('//') ||
    line.trim().startsWith('*') ||
    line.trim().startsWith('<!--') ||
    line.includes('import ') ||
    line.includes('class=') ||
    line.includes('.fabrick') ||
    line.includes('bg-fabrick') ||
    line.includes('text-fabrick') ||
    line.includes('color="fabrick"') ||
    line.includes('color: fabrick') ||
    line.includes("color: 'fabrick'") ||
    line.includes('isFabrick') ||
    line.includes('requiresFabrick') ||
    line.includes('/fabrick') ||    // route paths
    line.includes("'fabrick'") ||   // tier string literals (should use TIERS.FABRICK)
    line.includes('"fabrick"') ||   // tier string literals
    line.includes('Decision #') ||
    line.includes('FabricK') ||     // correct usage — skip
    line.includes('/** ')           // JSDoc comments

  for (const absPath of scanFiles) {
    const relPath = absPath.replace(rootDir + '/', '')
    const content = readFileSync(absPath, 'utf-8')
    const lines = content.split('\n')

    // For .vue files, only scan <template> and <script> sections (skip <style>)
    let inStyle = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (relPath.endsWith('.vue')) {
        if (line.includes('<style')) inStyle = true
        if (line.includes('</style>')) { inStyle = false; continue }
        if (inStyle) continue
      }

      if (skipLine(line)) continue
      if (brandPattern.test(line)) {
        findings.push({
          file: relPath,
          line: i + 1,
          context: line.trim().substring(0, 100),
        })
      }
    }
  }

  return findings
}

// ---------------------------------------------------------------------------
// Deprecated codenames — retired internal release codenames
// ---------------------------------------------------------------------------

interface DeprecatedCodenameFinding {
  file: string
  line: number
  codename: string
  context: string
}

/**
 * Deprecated release codenames that should no longer appear anywhere.
 * "The Hammer" → "The Closer" (v1.2 codename, Decision 2026-04-08).
 */
function scanForDeprecatedCodenames(): DeprecatedCodenameFinding[] {
  const findings: DeprecatedCodenameFinding[] = []

  const DEPRECATED_CODENAMES: { pattern: RegExp; name: string; replacement: string }[] = [
    { pattern: /\bhammer\b/i, name: 'Hammer', replacement: 'Closer' },
  ]

  // Scan code + docs under code/, plus project-root docs
  const sourceFiles = [
    ...globSync(resolve(rootDir, 'src/**/*.{ts,vue}'), { ignore: ['**/node_modules/**'] }),
    ...globSync(resolve(rootDir, 'scripts/**/*.ts'), { ignore: ['**/node_modules/**'] }),
    ...globSync(resolve(rootDir, '*.md')),
    ...globSync(resolve(rootDir, 'docs/**/*.md')),
  ]

  const skipPatterns = [
    'verify-vocabulary-sync.ts', // this file
    'CHANGELOG.md',
  ]

  for (const filePath of sourceFiles) {
    const relPath = filePath.replace(rootDir + '/', '')
    if (skipPatterns.some(p => relPath.includes(p))) continue

    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip icon names (e.g., mdi-hammer-wrench)
      if (/mdi-hammer/.test(line)) continue

      for (const { pattern, name } of DEPRECATED_CODENAMES) {
        if (pattern.test(line)) {
          findings.push({
            file: relPath,
            line: i + 1,
            codename: name,
            context: line.trim().substring(0, 100),
          })
          break
        }
      }
    }
  }

  return findings
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const startTime = Date.now()
const jsonMode = process.argv.includes('--json')

const syncResults = checkSync()
const literalFindings = scanForBareLiterals()
const deprecatedTierFindings = scanForDeprecatedTierNames()
const deploymentFindings = scanForForbiddenDeploymentPhrases()
const brandMarkFindings = scanForBrandMarkViolations()
const codenameFindings = scanForDeprecatedCodenames()

const syncFail = syncResults.some(r => r.status !== 'match')
const literalCount = literalFindings.length
const deprecatedCount = deprecatedTierFindings.length
const deploymentCount = deploymentFindings.length
const brandMarkCount = brandMarkFindings.length
const codenameCount = codenameFindings.length

const hasFail = syncFail || deprecatedCount > 0 || deploymentCount > 0 || brandMarkCount > 0 || codenameCount > 0

saveReport({
  reportName: 'vocabulary-sync',
  timestamp: new Date().toISOString(),
  durationMs: Date.now() - startTime,
  result: hasFail ? 'fail' : literalCount > 0 ? 'warn' : 'pass',
  summary: {
    syncStatus: syncFail ? 'out-of-sync' : 'in-sync',
    bareLiterals: literalCount,
    deprecatedTierNames: deprecatedCount,
    forbiddenDeploymentPhrases: deploymentCount,
    brandMarkViolations: brandMarkCount,
    deprecatedCodenames: codenameCount,
  },
  data: { syncResults, literalFindings, deprecatedTierFindings, deploymentFindings, brandMarkFindings, codenameFindings },
})

if (jsonMode) {
  console.log(JSON.stringify({ syncResults, literalFindings }, null, 2))
} else {
  console.log(`${BOLD}Vocabulary Sync Report${RESET}`)
  console.log('======================')
  console.log('')

  // Sync check
  console.log(`${BOLD}File Sync:${RESET}`)
  console.log(`  Canonical: ${CANONICAL}`)
  for (const r of syncResults) {
    const icon = r.status === 'match' ? `${GREEN}✓${RESET}` : `${RED}✘${RESET}`
    console.log(`  ${icon} ${r.file}${r.details ? ` ${DIM}(${r.details})${RESET}` : ''}`)
  }
  console.log('')

  // Bare literals (warning only — not blocking)
  if (literalCount > 0) {
    console.log(`${YELLOW}${BOLD}BARE LITERALS:${RESET} ${literalCount} string literal(s) should use vocabulary constants`)
    console.log(`${DIM}These are warnings — migrate incrementally, not all at once.${RESET}`)
    console.log('')

    // Group by file, show first 20
    const byFile = new Map<string, LiteralFinding[]>()
    for (const f of literalFindings) {
      const list = byFile.get(f.file) || []
      list.push(f)
      byFile.set(f.file, list)
    }

    let shown = 0
    for (const [file, fileLiterals] of byFile) {
      if (shown >= 20) { console.log(`  ${DIM}... and ${literalCount - shown} more${RESET}`); break }
      console.log(`  ${DIM}${file}${RESET}`)
      for (const f of fileLiterals.slice(0, 3)) {
        console.log(`    ${YELLOW}⚠${RESET} line ${f.line}: ${f.category} '${f.literal}' → ${f.suggestion}`)
        shown++
      }
      if (fileLiterals.length > 3) {
        console.log(`    ${DIM}... +${fileLiterals.length - 3} more in this file${RESET}`)
        shown += fileLiterals.length - 3
      }
    }
    console.log('')
  }

  // Deprecated tier names (FAIL if found)
  if (deprecatedCount > 0) {
    console.log(`${RED}${BOLD}DEPRECATED TIER NAMES:${RESET} ${deprecatedCount} use(s) of retired tier names (Premium/Enterprise)`)
    console.log(`${DIM}These must be replaced: Premium → Weaver (Solo/Team), Enterprise → Fabrick.${RESET}`)
    console.log('')

    for (const f of deprecatedTierFindings.slice(0, 20)) {
      console.log(`  ${RED}✘${RESET} ${f.file}:${f.line} — "${f.term}": ${DIM}${f.context}${RESET}`)
    }
    if (deprecatedCount > 20) {
      console.log(`  ${DIM}... and ${deprecatedCount - 20} more${RESET}`)
    }
    console.log('')
  }

  // Forbidden deployment phrases (FAIL if found)
  if (deploymentCount > 0) {
    console.log(`${RED}${BOLD}FORBIDDEN DEPLOYMENT PHRASES:${RESET} ${deploymentCount} reference(s) to unsupported non-NixOS deployment`)
    console.log(`${DIM}Weaver is NixOS-only. Remove standalone/non-NixOS deployment content.${RESET}`)
    console.log('')

    for (const f of deploymentFindings.slice(0, 20)) {
      console.log(`  ${RED}✘${RESET} ${f.file}:${f.line} — "${f.phrase}": ${DIM}${f.context}${RESET}`)
    }
    if (deploymentCount > 20) {
      console.log(`  ${DIM}... and ${deploymentCount - 20} more${RESET}`)
    }
    console.log('')
  }

  // Brand mark violations (FAIL if found)
  if (brandMarkCount > 0) {
    console.log(`${RED}${BOLD}BRAND MARK VIOLATIONS:${RESET} ${brandMarkCount} use(s) of "Fabrick" in UI — must be "FabricK" (capital K)`)
    console.log(`${DIM}The product brand mark is FabricK with capital K in all UI surfaces.${RESET}`)
    console.log('')

    for (const f of brandMarkFindings.slice(0, 20)) {
      console.log(`  ${RED}✘${RESET} ${f.file}:${f.line} — ${DIM}${f.context}${RESET}`)
    }
    if (brandMarkCount > 20) {
      console.log(`  ${DIM}... and ${brandMarkCount - 20} more${RESET}`)
    }
    console.log('')
  }

  // Deprecated codenames (FAIL if found)
  if (codenameCount > 0) {
    console.log(`${RED}${BOLD}DEPRECATED CODENAMES:${RESET} ${codenameCount} use(s) of retired release codenames`)
    console.log(`${DIM}These must be replaced: Hammer → Closer (v1.2).${RESET}`)
    console.log('')

    for (const f of codenameFindings.slice(0, 20)) {
      console.log(`  ${RED}✘${RESET} ${f.file}:${f.line} — "${f.codename}": ${DIM}${f.context}${RESET}`)
    }
    if (codenameCount > 20) {
      console.log(`  ${DIM}... and ${codenameCount - 20} more${RESET}`)
    }
    console.log('')
  }

  // Result
  if (hasFail) {
    const reasons: string[] = []
    if (syncFail) reasons.push('vocabulary files out of sync')
    if (deprecatedCount > 0) reasons.push(`${deprecatedCount} deprecated tier name(s)`)
    if (deploymentCount > 0) reasons.push(`${deploymentCount} forbidden deployment phrase(s)`)
    if (brandMarkCount > 0) reasons.push(`${brandMarkCount} brand mark violation(s)`)
    if (codenameCount > 0) reasons.push(`${codenameCount} deprecated codename(s)`)
    console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${reasons.join(', ')}`)
    if (syncFail) console.log(`${DIM}Fix sync: copy canonical ${CANONICAL} to backend and TUI copies.${RESET}`)
    if (deprecatedCount > 0) console.log(`${DIM}Fix tiers: replace Premium → Weaver, Enterprise → Fabrick.${RESET}`)
    if (deploymentCount > 0) console.log(`${DIM}Fix deployment: remove standalone/non-NixOS deployment content from user-facing docs.${RESET}`)
    if (brandMarkCount > 0) console.log(`${DIM}Fix brand: use "FabricK" (capital K) in all UI-rendered text.${RESET}`)
    if (codenameCount > 0) console.log(`${DIM}Fix codenames: replace Hammer → Closer.${RESET}`)
    process.exit(1)
  } else {
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — vocabulary files in sync${literalCount > 0 ? ` (${literalCount} bare literals to migrate)` : ''}`)
  }
}

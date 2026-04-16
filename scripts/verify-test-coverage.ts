// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * verify-test-coverage.ts — Backend source → test file parity auditor.
 *
 * Scans backend source directories (routes, services, storage, middleware)
 * and verifies each source file has a corresponding .spec.ts test file.
 *
 * Enforces the rule: "if you write source code, you write tests for it."
 *
 * Usage:  npx tsx scripts/verify-test-coverage.ts
 * Exit:   0 = all covered or allowlisted, 1 = missing tests found
 */

import { existsSync, readFileSync } from 'fs'
import { globSync } from 'glob'
import { resolve, relative, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { saveReport } from './lib/save-report.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// ANSI colors
// ---------------------------------------------------------------------------
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

// ---------------------------------------------------------------------------
// Scan configuration — source dirs and their test counterparts
// ---------------------------------------------------------------------------
interface ScanRule {
  /** Glob pattern for source files (relative to code/) */
  sourceGlob: string
  /** Directory where test files live (relative to code/) */
  testDir: string
  /** Category label for reporting */
  category: string
}

const SCAN_RULES: ScanRule[] = [
  { sourceGlob: 'backend/src/routes/*.ts', testDir: 'backend/tests/routes', category: 'routes' },
  { sourceGlob: 'backend/src/routes/weaver/*.ts', testDir: 'backend/tests/routes', category: 'routes/weaver' },
  { sourceGlob: 'backend/src/routes/fabrick/*.ts', testDir: 'backend/tests/routes', category: 'routes/fabrick' },
  { sourceGlob: 'backend/src/services/*.ts', testDir: 'backend/tests/services', category: 'services' },
  { sourceGlob: 'backend/src/storage/*.ts', testDir: 'backend/tests/storage', category: 'storage' },
  { sourceGlob: 'backend/src/middleware/*.ts', testDir: 'backend/tests/middleware', category: 'middleware' },
]

// ---------------------------------------------------------------------------
// Allowlist — files that legitimately don't need standalone tests
//
// Each entry must have a reason. Reasons are validated — if the file no longer
// exists, the allowlist entry is flagged as stale.
// ---------------------------------------------------------------------------
interface AllowlistEntry {
  /** Relative path from code/ (e.g. 'backend/src/routes/ws.ts') */
  file: string
  /** Why this file doesn't need a standalone test */
  reason: string
}

const ALLOWLIST: AllowlistEntry[] = [
  // --- Re-export barrels / plugin registrars ---
  { file: 'backend/src/routes/weaver/index.ts', reason: 'Plugin registrar — re-exports and registers child routes, no standalone logic' },
  { file: 'backend/src/routes/fabrick/index.ts', reason: 'Plugin registrar — re-exports and registers child routes, no standalone logic' },
  { file: 'backend/src/storage/index.ts', reason: 'Factory re-export — delegates to json-registry or sqlite-registry' },

  // --- Type-only / interface files ---
  { file: 'backend/src/services/provisioner-types.ts', reason: 'Type definitions only — no runtime logic' },
  { file: 'backend/src/storage/workload-registry.ts', reason: 'Interface definition only — implementations (json-registry, sqlite-registry) have their own tests' },
  { file: 'backend/src/storage/session-store.ts', reason: 'Interface definition only — implementations (memory-session-store, sqlite-session-store) have their own tests' },

  // --- WebSocket routes (tested in E2E, not fastify.inject) ---
  { file: 'backend/src/routes/ws.ts', reason: 'WebSocket upgrade route — tested via E2E lifecycle tests, not fastify.inject()' },

  // --- Seed data ---
  { file: 'backend/src/storage/seed-data.ts', reason: 'Static seed data constants — no logic to test' },

  // --- Mock agents (test infrastructure) ---
  { file: 'backend/src/services/mock-agent.ts', reason: 'Mock/stub for testing — IS test infrastructure' },

  // --- Thin route wrappers (Zod validation + service delegation, no route-level logic) ---
  { file: 'backend/src/routes/notifications.ts', reason: 'Thin route — delegates to notificationService, tested via service tests' },
  { file: 'backend/src/routes/license.ts', reason: 'Thin route — delegates to Stripe/license services, tested via stripe-webhook.spec.ts + E2E stripe-license.spec.ts' },
  { file: 'backend/src/routes/doctor.ts', reason: 'Thin route — delegates to doctorService.runChecks()' },
  { file: 'backend/src/routes/compliance.ts', reason: 'Thin route — delegates to compliance-pdf service' },
  { file: 'backend/src/routes/weaver/web-push.ts', reason: 'Thin route — delegates to subscriptionStore, validated by Zod schemas' },

  // --- Thin storage wrappers (simple data containers) ---
  { file: 'backend/src/storage/organization-store.ts', reason: 'Thin wrapper — JSON read/write with defaults, no business logic' },
  { file: 'backend/src/storage/notification-store.ts', reason: 'Thin wrapper — circular buffer (max 100) with JSON persistence' },
  { file: 'backend/src/storage/memory-session-store.ts', reason: 'Thin wrapper — in-memory Map with TTL expiry, minimal logic' },

]

// ---------------------------------------------------------------------------
// Main logic
// ---------------------------------------------------------------------------

interface CoverageResult {
  category: string
  sourceFile: string      // relative path from code/
  testFile: string | null // relative path from code/ (null = missing)
  status: 'covered' | 'missing' | 'allowlisted'
  allowlistReason?: string
}

function findTestFile(sourceFile: string, testDir: string): string | null {
  const base = basename(sourceFile, '.ts')
  const testPath = resolve(ROOT, testDir, `${base}.spec.ts`)
  if (existsSync(testPath)) return relative(ROOT, testPath)

  // Also check for nested test files with different naming (e.g., notification-config for weaver/notification-config)
  // Search for any spec file matching the base name in the test directory
  const globMatches = globSync(`${testDir}/**/${base}.spec.ts`, { cwd: ROOT })
  if (globMatches.length > 0) return globMatches[0]

  return null
}

function isTypeOnlyFile(absPath: string): boolean {
  try {
    const content = readFileSync(absPath, 'utf-8')
    // If file only has: imports, exports, interfaces, types, and comments — no runtime logic
    const lines = content.split('\n').filter(l => {
      const trimmed = l.trim()
      return trimmed.length > 0
        && !trimmed.startsWith('//')
        && !trimmed.startsWith('/*')
        && !trimmed.startsWith('*')
        && !trimmed.startsWith('import ')
        && !trimmed.startsWith('export type ')
        && !trimmed.startsWith('export interface ')
    })
    // If every remaining line is just closing braces or export statements of types
    return lines.every(l => {
      const t = l.trim()
      return t === '}' || t === '{' || t.startsWith('export {') || t === ''
    })
  } catch {
    return false
  }
}

function main() {
  const startTime = Date.now()
  const results: CoverageResult[] = []
  const allowlistFiles = new Set(ALLOWLIST.map(a => a.file))

  for (const rule of SCAN_RULES) {
    const sourceFiles = globSync(rule.sourceGlob, { cwd: ROOT })
    for (const sourceFile of sourceFiles) {
      const relSource = sourceFile // already relative from glob

      // Check allowlist
      if (allowlistFiles.has(relSource)) {
        const entry = ALLOWLIST.find(a => a.file === relSource)!
        results.push({
          category: rule.category,
          sourceFile: relSource,
          testFile: null,
          status: 'allowlisted',
          allowlistReason: entry.reason,
        })
        continue
      }

      // Find corresponding test
      const testFile = findTestFile(relSource, rule.testDir)
      results.push({
        category: rule.category,
        sourceFile: relSource,
        testFile,
        status: testFile ? 'covered' : 'missing',
      })
    }
  }

  // Check for stale allowlist entries (file no longer exists)
  const staleAllowlist: AllowlistEntry[] = []
  for (const entry of ALLOWLIST) {
    if (!existsSync(resolve(ROOT, entry.file))) {
      staleAllowlist.push(entry)
    }
  }

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------
  const covered = results.filter(r => r.status === 'covered')
  const missing = results.filter(r => r.status === 'missing')
  const allowlisted = results.filter(r => r.status === 'allowlisted')

  console.log('')
  console.log(`${BOLD}Backend Test Coverage Parity${RESET}`)
  console.log('============================')
  console.log(`Source files scanned: ${results.length}`)
  console.log('')

  // Group by category
  const categories = [...new Set(results.map(r => r.category))]
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat)
    const catCovered = catResults.filter(r => r.status === 'covered').length
    const catMissing = catResults.filter(r => r.status === 'missing').length
    const catAllowlisted = catResults.filter(r => r.status === 'allowlisted').length
    const catTotal = catResults.length

    console.log(`${BOLD}${cat}${RESET} (${catCovered}/${catTotal - catAllowlisted} covered, ${catAllowlisted} allowlisted)`)

    for (const r of catResults) {
      if (r.status === 'covered') {
        console.log(`  ${GREEN}✓${RESET} ${r.sourceFile} ${DIM}→ ${r.testFile}${RESET}`)
      } else if (r.status === 'allowlisted') {
        console.log(`  ${YELLOW}·${RESET} ${r.sourceFile} ${DIM}— ${r.allowlistReason}${RESET}`)
      } else {
        console.log(`  ${RED}✗${RESET} ${r.sourceFile} ${RED}— no test file found${RESET}`)
      }
    }
    if (catMissing > 0) console.log('')
  }

  // Stale allowlist entries
  if (staleAllowlist.length > 0) {
    console.log('')
    console.log(`${RED}${BOLD}STALE ALLOWLIST (${staleAllowlist.length}):${RESET}`)
    for (const entry of staleAllowlist) {
      console.log(`  ${RED}✗${RESET} ${entry.file} ${DIM}— file no longer exists, remove from allowlist${RESET}`)
    }
  }

  // Summary
  console.log('')
  const failures = missing.length + staleAllowlist.length
  console.log(`${BOLD}Summary:${RESET} ${covered.length} covered, ${allowlisted.length} allowlisted, ${missing.length} missing, ${staleAllowlist.length} stale`)

  const durationMs = Date.now() - startTime
  const result = failures > 0 ? 'fail' : 'pass'

  saveReport({
    reportName: 'test-coverage',
    timestamp: new Date().toISOString(),
    durationMs,
    result,
    summary: {
      totalSourceFiles: results.length,
      covered: covered.length,
      missing: missing.length,
      allowlisted: allowlisted.length,
      staleAllowlist: staleAllowlist.length,
    },
    data: {
      covered: covered.map(r => ({ source: r.sourceFile, test: r.testFile, category: r.category })),
      missing: missing.map(r => ({ source: r.sourceFile, category: r.category })),
      allowlisted: allowlisted.map(r => ({ source: r.sourceFile, reason: r.allowlistReason, category: r.category })),
      staleAllowlist: staleAllowlist.map(e => ({ file: e.file, reason: e.reason })),
    },
  })

  console.log('')
  if (failures > 0) {
    const parts: string[] = []
    if (missing.length > 0) parts.push(`${missing.length} missing test(s)`)
    if (staleAllowlist.length > 0) parts.push(`${staleAllowlist.length} stale allowlist entry/entries`)
    console.log(`${RED}${BOLD}FAIL${RESET}: ${parts.join(', ')}`)
    console.log(`${DIM}Missing: add a .spec.ts file or add to the allowlist with a reason.${RESET}`)
    console.log(`${DIM}Stale: remove the allowlist entry — the source file no longer exists.${RESET}`)
    process.exit(1)
  } else {
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET}`)
  }
}

main()

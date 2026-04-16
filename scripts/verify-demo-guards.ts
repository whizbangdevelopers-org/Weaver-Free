// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * verify-demo-guards.ts — Demo mode code safety auditor.
 *
 * Ensures every component/service that calls API services has proper
 * `isDemoMode()` guards to prevent real API calls in demo mode.
 *
 * Checks:
 *   1. API service guard — files importing *ApiService must reference isDemoMode
 *   2. onMounted API calls — mount-time API calls are the highest risk (auto-fire)
 *   3. Composable guard consistency — composable API functions must guard demo mode
 *
 * This auditor catches the class of bug where a sub-component calls a real API
 * endpoint in demo mode, triggering a 401 → auth clear → redirect chain.
 *
 * Usage:  npx tsx scripts/verify-demo-guards.ts
 * Exit:   0 = all compliant, 1 = issues found
 */

import { readFileSync, existsSync } from 'fs'
import { globSync } from 'glob'
import { resolve } from 'path'
import { saveReport } from './lib/save-report.js'

const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED    = '\x1b[31m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'
const RESET  = '\x1b[0m'

const ROOT = resolve(import.meta.dirname, '..')
const startTime = Date.now()

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

type Severity = 'error' | 'warn'

interface Issue {
  check: string
  severity: Severity
  file: string
  line?: number
  message: string
}

const issues: Issue[] = []

function fail(check: string, file: string, message: string, line?: number) {
  issues.push({ check, severity: 'error', file, line, message })
}

function warn(check: string, file: string, message: string, line?: number) {
  issues.push({ check, severity: 'warn', file, line, message })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFile(relPath: string): string {
  const abs = resolve(ROOT, relPath)
  if (!existsSync(abs)) return ''
  return readFileSync(abs, 'utf-8')
}

/** All .vue and .ts source files under src/ and tui/src/ */
function allSourceFiles(): string[] {
  return [
    ...globSync('src/**/*.{vue,ts}', { cwd: ROOT }),
    ...globSync('tui/src/**/*.{vue,ts}', { cwd: ROOT }),
  ]
}

/** Extract the <script> content from a .vue file, or return full content for .ts */
function scriptContent(filePath: string, content: string): string {
  if (!filePath.endsWith('.vue')) return content
  const match = content.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  return match?.[1] ?? ''
}

// ---------------------------------------------------------------------------
// Check 1: API Service Import Guard
//
// Any file that imports a *ApiService must also import/reference isDemoMode.
// Composables in src/composables/ are exempt if they re-export from a service
// that already has guards — but components must always have their own guard.
// ---------------------------------------------------------------------------

const CHECK_API_GUARD = 'API service demo guard'

function checkApiServiceGuards() {
  const files = allSourceFiles()
  // Pattern: imports like `presetTagApiService`, `networkApiService`, etc.
  const apiServicePattern = /\b\w+ApiService\b/

  for (const file of files) {
    const content = readFile(file)
    const script = scriptContent(file, content)

    if (!apiServicePattern.test(script)) continue

    // File imports an API service — check for isDemoMode reference
    const hasDemoGuard = /isDemoMode/.test(script)

    if (!hasDemoGuard) {
      // Find the line number of the first ApiService reference
      const lines = script.split('\n')
      let lineNum: number | undefined
      for (let i = 0; i < lines.length; i++) {
        if (apiServicePattern.test(lines[i]!)) {
          lineNum = i + 1
          // For .vue files, offset by the script tag position
          if (file.endsWith('.vue')) {
            const fullLines = content.split('\n')
            for (let j = 0; j < fullLines.length; j++) {
              if (/<script/.test(fullLines[j]!)) {
                lineNum = j + 1 + i
                break
              }
            }
          }
          break
        }
      }

      // Components are errors (they mount in demo mode and fire API calls).
      // Services/utils are warnings (they might be called through guarded composables).
      const isComponent = file.includes('/components/') || file.includes('/pages/')
      const severity = isComponent ? 'error' : 'warn'

      if (severity === 'error') {
        fail(CHECK_API_GUARD, file, 'Imports *ApiService but does not reference isDemoMode — API calls will fire in demo mode', lineNum)
      } else {
        warn(CHECK_API_GUARD, file, 'Imports *ApiService without isDemoMode reference — verify callers have demo guards', lineNum)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check 2: onMounted API Calls Without Demo Guard
//
// Files with both `onMounted` and an API service call inside the mounted
// callback are highest risk — they auto-fire on navigation.
// ---------------------------------------------------------------------------

const CHECK_MOUNTED_API = 'Mount-time API call guard'

function checkMountedApiCalls() {
  const files = allSourceFiles()
  const apiCallPattern = /\b\w+ApiService\.\w+\(/

  for (const file of files) {
    const content = readFile(file)
    const script = scriptContent(file, content)

    if (!apiCallPattern.test(script)) continue
    if (!/onMounted/.test(script)) continue
    if (/isDemoMode/.test(script)) continue

    // Has onMounted + API service call + no demo guard
    const lines = script.split('\n')
    let mountedLine: number | undefined
    for (let i = 0; i < lines.length; i++) {
      if (/onMounted/.test(lines[i]!)) {
        mountedLine = i + 1
        if (file.endsWith('.vue')) {
          const fullLines = content.split('\n')
          for (let j = 0; j < fullLines.length; j++) {
            if (/<script/.test(fullLines[j]!)) {
              mountedLine = j + 1 + i
              break
            }
          }
        }
        break
      }
    }

    fail(CHECK_MOUNTED_API, file,
      'onMounted fires API service call without isDemoMode guard — will cause 401 redirect in demo mode',
      mountedLine)
  }
}

// ---------------------------------------------------------------------------
// Check 3: Composable Demo Guard Consistency
//
// Composables in src/composables/ that call API endpoints should have
// isDemoMode guards on every exported function that makes an API call.
// ---------------------------------------------------------------------------

const CHECK_COMPOSABLE_GUARD = 'Composable demo guard'

function checkComposableGuards() {
  const files = globSync('src/composables/*.ts', { cwd: ROOT })

  for (const file of files) {
    const content = readFile(file)

    // Only check composables that make API calls (import api or ApiService)
    if (!/\bapi\b.*import|ApiService/.test(content)) continue
    if (!/(api\.get|api\.post|api\.put|api\.delete|api\.patch|\w+ApiService\.\w+)\(/.test(content)) continue

    // Count API call sites vs isDemoMode guards
    const apiCallLines: number[] = []
    const guardLines: number[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      if (/(api\.get|api\.post|api\.put|api\.delete|api\.patch|\w+ApiService\.\w+)\(/.test(lines[i]!)) {
        apiCallLines.push(i + 1)
      }
      if (/isDemoMode\(\)/.test(lines[i]!)) {
        guardLines.push(i + 1)
      }
    }

    if (apiCallLines.length > 0 && guardLines.length === 0) {
      fail(CHECK_COMPOSABLE_GUARD, file,
        `${apiCallLines.length} API call(s) with no isDemoMode guard — composable will leak real requests in demo mode`,
        apiCallLines[0])
    } else if (apiCallLines.length > guardLines.length) {
      // More API calls than guards — some functions may be unguarded
      warn(CHECK_COMPOSABLE_GUARD, file,
        `${apiCallLines.length} API call(s) but only ${guardLines.length} isDemoMode guard(s) — verify all paths are covered`,
        apiCallLines[0])
    }
  }
}

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------

checkApiServiceGuards()
checkMountedApiCalls()
checkComposableGuards()

const checks = [CHECK_API_GUARD, CHECK_MOUNTED_API, CHECK_COMPOSABLE_GUARD]
const errors = issues.filter(i => i.severity === 'error')
const warnings = issues.filter(i => i.severity === 'warn')

console.log(`\n${BOLD}Demo Mode Guard Audit${RESET}\n`)

for (const check of checks) {
  const checkIssues = issues.filter(i => i.check === check)
  const checkErrors = checkIssues.filter(i => i.severity === 'error')
  const checkWarns = checkIssues.filter(i => i.severity === 'warn')

  if (checkErrors.length > 0) {
    console.log(`${RED}FAIL${RESET}  ${check} (${checkErrors.length} error${checkErrors.length > 1 ? 's' : ''}${checkWarns.length ? `, ${checkWarns.length} warn` : ''})`)
  } else if (checkWarns.length > 0) {
    console.log(`${YELLOW}WARN${RESET}  ${check} (${checkWarns.length} warning${checkWarns.length > 1 ? 's' : ''})`)
  } else {
    console.log(`${GREEN}PASS${RESET}  ${check}`)
  }

  for (const issue of checkIssues) {
    const sev = issue.severity === 'error' ? `${RED}ERR${RESET}` : `${YELLOW}WRN${RESET}`
    const loc = issue.line ? `${issue.file}:${issue.line}` : issue.file
    console.log(`       ${sev} ${DIM}${loc}${RESET}`)
    console.log(`           ${issue.message}`)
  }
}

console.log(`\n${BOLD}Overall:${RESET} ${errors.length} error${errors.length !== 1 ? 's' : ''}, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}\n`)

// Save report
saveReport({
  reportName: 'demo-guards',
  timestamp: new Date().toISOString(),
  durationMs: Date.now() - startTime,
  result: errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
  summary: {
    errors: errors.length,
    warnings: warnings.length,
    checks: checks.length,
  },
  data: issues,
})

process.exit(errors.length > 0 ? 1 : 0)

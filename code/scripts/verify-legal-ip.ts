// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Legal & IP Compliance Verification Script
 *
 * Verifies licensing, copyright notices, and AI training protections
 * across the repository. Checks:
 *   1. LICENSE file contents (Commons Clause, AGPL, AI Training Restriction)
 *   2. package.json license fields
 *   3. Copyright notices in user-facing Vue pages/layouts
 *   4. Demo deploy workflow (LICENSE copy, robots.txt, noai meta)
 *   5. Free repo sync exclusions (LICENSE must NOT be excluded)
 *   6. README license badge and section consistency
 *   7. AI crawler robots.txt protections
 *
 * Usage:
 *   npx tsx scripts/verify-legal-ip.ts
 */

import { readFileSync, existsSync } from 'fs'
import { globSync } from 'glob'
import { resolve, basename, dirname } from 'path'
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
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const PASS = `${GREEN}\u2713${RESET}`
const FAIL = `${RED}\u2717${RESET}`
const EXEMPT = `${DIM}\u25CB${RESET}`

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let totalChecks = 0
let passedChecks = 0
let failedChecks = 0
const checkResults: Array<{ label: string; passed: boolean }> = []

function check(label: string, passed: boolean): void {
  totalChecks++
  checkResults.push({ label, passed })
  if (passed) {
    passedChecks++
    console.log(`  ${PASS} ${label}`)
  } else {
    failedChecks++
    console.log(`  ${FAIL} ${label}`)
  }
}

function exempt(label: string): void {
  console.log(`  ${EXEMPT} ${label}`)
}

function readFile(relPath: string): string | null {
  const fullPath = resolve(ROOT, relPath)
  if (!existsSync(fullPath)) return null
  return readFileSync(fullPath, 'utf-8')
}

// ---------------------------------------------------------------------------
// 1. LICENSE File
// ---------------------------------------------------------------------------

function checkLicenseFile(): void {
  console.log('\nLICENSE FILE:')

  const content = readFile('LICENSE')
  if (!content) {
    check('LICENSE exists', false)
    check('Contains Commons Clause', false)
    check('Contains AI Training Restriction', false)
    check('Contains AGPL-3.0 text', false)
    check('Contains correct copyright holder', false)
    return
  }

  check('LICENSE exists', true)
  check('Contains Commons Clause', content.includes('Commons Clause'))
  check('Contains AI Training Restriction', content.includes('AI Training Restriction'))
  check('Contains AGPL-3.0 text', content.includes('GNU AFFERO GENERAL PUBLIC LICENSE'))
  check('Contains correct copyright holder', content.includes('whizBANG Developers LLC'))
}

// ---------------------------------------------------------------------------
// 2. package.json License Fields
// ---------------------------------------------------------------------------

function checkPackageJsonLicense(): void {
  console.log('\nPACKAGE.JSON:')

  const rootPkg = readFile('package.json')
  if (rootPkg) {
    const parsed = JSON.parse(rootPkg)
    check('Root: "SEE LICENSE IN LICENSE"', parsed.license === 'SEE LICENSE IN LICENSE')
  } else {
    check('Root: "SEE LICENSE IN LICENSE"', false)
  }

  const backendPkg = readFile('backend/package.json')
  if (backendPkg) {
    const parsed = JSON.parse(backendPkg)
    check('Backend: "SEE LICENSE IN LICENSE"', parsed.license === 'SEE LICENSE IN LICENSE')
  } else {
    check('Backend: "SEE LICENSE IN LICENSE"', false)
  }
}

// ---------------------------------------------------------------------------
// 3. Copyright Notices in User-Facing Pages
// ---------------------------------------------------------------------------

// Pages rendered inside MainLayout inherit its sidebar copyright notice.
// Only standalone pages (outside MainLayout) need their own copyright.
const COPYRIGHT_EXEMPTIONS: Record<string, string> = {
  'ErrorNotFound.vue': 'error page',
  'IndexPage.vue': 'redirect',
  'WorkbenchPage.vue': 'inherits from MainLayout',
  'WorkloadDetailPage.vue': 'inherits from MainLayout',
  'SettingsPage.vue': 'inherits from MainLayout',
  'UsersPage.vue': 'inherits from MainLayout',
  'AuditPage.vue': 'inherits from MainLayout',
  'NetworkMapPage.vue': 'inherits from MainLayout',
  'IntegrationsPage.vue': 'inherits from MainLayout',
  'WeaverPage.vue': 'inherits from MainLayout',
  'LoomPage.vue': 'inherits from MainLayout',
  // LoginPage.vue is standalone (not in MainLayout) — NOT exempt, needs own copyright
}

function hasCopyright(content: string): boolean {
  return (
    content.includes('whizBANG Developers LLC') ||
    content.includes('\u00A9') ||   // © character
    content.includes('&copy;') ||
    content.includes('\\u00A9') ||
    content.includes('\\xA9')
  )
}

function checkCopyrightNotices(): void {
  console.log('\nCOPYRIGHT NOTICES:')

  const pageFiles = globSync(resolve(ROOT, 'src/pages/*.vue'))
  const layoutFiles = globSync(resolve(ROOT, 'src/layouts/*.vue'))
  const allFiles = [...pageFiles, ...layoutFiles].sort()

  for (const filePath of allFiles) {
    const name = basename(filePath)
    const exemptReason = COPYRIGHT_EXEMPTIONS[name]

    if (exemptReason) {
      exempt(`${name} \u2014 exempt (${exemptReason})`)
      continue
    }

    const content = readFileSync(filePath, 'utf-8')
    const found = hasCopyright(content)
    check(`${name} \u2014 ${found ? 'copyright found' : 'NO COPYRIGHT FOUND'}`, found)
  }
}

// ---------------------------------------------------------------------------
// 4. Demo Deploy Workflow
// ---------------------------------------------------------------------------

function checkDemoDeployWorkflow(): void {
  console.log('\nDEMO DEPLOY:')

  const workflowPath = resolve(REPO_ROOT, '.github/workflows/demo-deploy.yml')
  const content = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf-8') : null
  if (!content) {
    check('Copies LICENSE to build', false)
    check('Copies robots.txt to build', false)
    check('Injects noai meta tag', false)
    return
  }

  check('Copies LICENSE to build', content.includes('cp LICENSE dist/spa/LICENSE'))
  check(
    'Copies robots.txt to build',
    content.includes('cp demo/robots.txt'),
  )
  check(
    'Injects noai meta tag',
    content.includes('noai') && content.includes('noimageai'),
  )
}

// ---------------------------------------------------------------------------
// 5. Free Repo Sync Exclusions
// ---------------------------------------------------------------------------

function checkSyncExclusions(): void {
  console.log('\nSYNC EXCLUSIONS:')

  const syncPath = resolve(REPO_ROOT, '.github/workflows/sync-to-free.yml')
  const content = existsSync(syncPath) ? readFileSync(syncPath, 'utf-8') : null
  if (!content) {
    check('LICENSE not excluded from free repo sync', false)
    return
  }

  // LICENSE must NOT be excluded — verify neither pattern appears
  const excludesLicense =
    content.includes("--exclude='LICENSE'") ||
    content.includes('--exclude=LICENSE') ||
    content.includes('--exclude "LICENSE"')

  check('LICENSE not excluded from free repo sync', !excludesLicense)
}

// ---------------------------------------------------------------------------
// 6. README License Consistency
// ---------------------------------------------------------------------------

function checkReadmeLicense(): void {
  console.log('\nREADME LICENSE:')

  const content = readFile('README.md')
  if (!content) {
    check('README.md exists', false)
    return
  }

  check('README.md exists', true)
  check('Badge does not say MIT', !content.includes('License-MIT'))
  check('Badge references AGPL', content.includes('AGPL'))
  check('License section references AGPL', content.includes('AGPL-3.0 with Commons Clause'))
  check(
    'License section mentions AI Training Restriction',
    content.includes('AI Training Restriction') || content.includes('AI model training'),
  )
}

// ---------------------------------------------------------------------------
// 7. AI Crawler robots.txt
// ---------------------------------------------------------------------------

function checkRobotsTxt(): void {
  console.log('\nAI CRAWLER PROTECTION:')

  const content = readFile('demo/robots.txt')
  if (!content) {
    check('demo/robots.txt exists', false)
    check('Blocks GPTBot', false)
    check('Blocks ClaudeBot', false)
    check('Blocks CCBot', false)
    return
  }

  check('demo/robots.txt exists', true)
  check('Blocks GPTBot', content.includes('GPTBot'))
  check('Blocks ClaudeBot', content.includes('ClaudeBot'))
  check('Blocks CCBot', content.includes('CCBot'))
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

console.log('Legal & IP Compliance Report')
console.log('============================')

checkLicenseFile()
checkPackageJsonLicense()
checkCopyrightNotices()
checkDemoDeployWorkflow()
checkSyncExclusions()
checkReadmeLicense()
checkRobotsTxt()

console.log('')

saveReport({
  reportName: 'legal-ip',
  timestamp: new Date().toISOString(),
  durationMs: 0,
  result: failedChecks > 0 ? 'fail' : 'pass',
  summary: { total: totalChecks, passed: passedChecks, failed: failedChecks },
  data: checkResults,
})

if (failedChecks === 0) {
  console.log(`${GREEN}RESULT: ${passedChecks}/${totalChecks} checks passed${RESET}`)
} else {
  console.log(
    `${RED}RESULT: ${passedChecks}/${totalChecks} checks passed, ${failedChecks} failed${RESET}`,
  )
}

process.exit(failedChecks > 0 ? 1 : 0)

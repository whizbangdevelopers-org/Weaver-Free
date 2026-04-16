// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Post-Release Verification Script
 *
 * Automates checks after a release tag is pushed. Validates that the GitHub
 * release, free repo sync, demo site, and (optionally) a live API are all
 * in the expected state.
 *
 * Domains:
 *   1. GitHub Release   — exists, not draft, not pre-release, title + body
 *   2. Free Repo Sync   — version match, LICENSE present, excluded files absent
 *   3. Demo Site         — HTTP 200, contains "MicroVM", robots.txt, noai meta
 *   4. API Spot Checks   — /api/health + /api/auth/setup-required (optional)
 *
 * Usage:
 *   npx tsx scripts/verify-post-release.ts --version v1.0.0
 *   npx tsx scripts/verify-post-release.ts --version v1.0.0 --host http://localhost:3100
 *   npx tsx scripts/verify-post-release.ts --version v1.0.0 --skip-demo
 */

import { execSync } from 'child_process'
import { parseArgs } from 'node:util'
import { saveReport } from './lib/save-report.js'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEV_REPO = 'whizbangdevelopers-org/Weaver-Dev'
const FREE_REPO = 'whizbangdevelopers-org/Weaver-Free'
const DEMO_URL = 'https://weaver-demo.github.io'
const EXCLUDED_FILES = [
  'CLAUDE.md',
  '.github/workflows/sync-to-free.yml',
  'docs/planning',
  'docs/workflows/CLAUDEMD-GENERATOR-PROMPT.md',
  'docs/setup/MCP-TOOLING-SETUP.md',
]

// ---------------------------------------------------------------------------
// ANSI Colors
// ---------------------------------------------------------------------------

const C = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

function pass(msg: string): void {
  console.log(`  ${C.green}\u2713${C.reset} ${msg}`)
}

function fail(msg: string): void {
  console.log(`  ${C.red}\u2717${C.reset} ${msg}`)
}

function warn(msg: string): void {
  console.log(`  ${C.yellow}\u26A0${C.reset} ${msg}`)
}

function skip(msg: string): void {
  console.log(`  ${C.dim}\u2298${C.reset} ${C.dim}${msg}${C.reset}`)
}

function heading(title: string): void {
  console.log(`\n${C.bold}${C.cyan}${title}${C.reset}`)
  console.log(C.dim + '\u2500'.repeat(title.length) + C.reset)
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

const { values } = parseArgs({
  options: {
    version: { type: 'string', short: 'v' },
    host: { type: 'string', short: 'H' },
    'skip-demo': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
})

if (values.help) {
  console.log(`
Usage: npx tsx scripts/verify-post-release.ts [options]

Options:
  --version, -v    Release version tag (required, e.g. v1.0.0)
  --host, -H       Backend host URL for API spot checks (optional)
  --skip-demo      Skip demo site checks
  --help, -h       Show this help

Examples:
  npx tsx scripts/verify-post-release.ts --version v1.0.0
  npx tsx scripts/verify-post-release.ts --version v1.0.0 --host http://localhost:3100
  npx tsx scripts/verify-post-release.ts --version v1.0.0 --skip-demo
`)
  process.exit(0)
}

const version = values.version
if (!version) {
  console.error(`${C.red}Error: --version is required${C.reset}`)
  console.error('Usage: npx tsx scripts/verify-post-release.ts --version v1.0.0')
  process.exit(1)
}

const hostUrl = values.host ?? null
const skipDemo = values['skip-demo'] ?? false

// Derive bare version (without leading 'v')
const bareVersion = version.startsWith('v') ? version.slice(1) : version

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CheckResult {
  passed: boolean
  skipped: boolean
}

let totalPassed = 0
let totalFailed = 0
let totalSkipped = 0
let totalWarnings = 0

function recordPass(msg: string): CheckResult {
  pass(msg)
  totalPassed++
  return { passed: true, skipped: false }
}

function recordFail(msg: string): CheckResult {
  fail(msg)
  totalFailed++
  return { passed: false, skipped: false }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- available for future check domains
function recordWarn(msg: string): void {
  warn(msg)
  totalWarnings++
}

function recordSkip(msg: string): CheckResult {
  skip(msg)
  totalSkipped++
  return { passed: true, skipped: true }
}

/** Run a shell command and return stdout, or null on failure. */
function exec(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch {
    return null
  }
}

/** Fetch a URL and return { status, body } or null on network error. */
async function httpGet(url: string, timeoutMs = 15_000): Promise<{ status: number; body: string } | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    clearTimeout(timer)
    const body = await res.text()
    return { status: res.status, body }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Domain 1: GitHub Release
// ---------------------------------------------------------------------------

function checkGitHubRelease(): void {
  heading('Domain 1: GitHub Release')

  // Check gh CLI is available
  if (!exec('which gh')) {
    recordFail('gh CLI not found — install GitHub CLI to run release checks')
    return
  }

  // Fetch release JSON
  const releaseJson = exec(`gh release view ${version} --repo ${DEV_REPO} --json tagName,name,body,isDraft,isPrerelease 2>/dev/null`)
  if (!releaseJson) {
    recordFail(`Release ${version} not found in ${DEV_REPO}`)
    return
  }

  let release: { tagName: string; name: string; body: string; isDraft: boolean; isPrerelease: boolean }
  try {
    release = JSON.parse(releaseJson)
  } catch {
    recordFail('Failed to parse release JSON from gh CLI')
    return
  }

  // Release exists
  recordPass(`Release exists for tag ${version}`)

  // Not draft
  if (!release.isDraft) {
    recordPass('Release is not a draft')
  } else {
    recordFail('Release is marked as draft')
  }

  // Not pre-release
  if (!release.isPrerelease) {
    recordPass('Release is not a pre-release')
  } else {
    recordFail('Release is marked as pre-release')
  }

  // Title contains version
  if (release.name && release.name.includes(bareVersion)) {
    recordPass(`Release title contains version string: "${release.name}"`)
  } else {
    recordFail(`Release title does not contain "${bareVersion}": "${release.name}"`)
  }

  // Body is non-empty (>50 chars)
  if (release.body && release.body.length > 50) {
    recordPass(`Release body is non-empty (${release.body.length} chars)`)
  } else {
    const len = release.body?.length ?? 0
    recordFail(`Release body is too short (${len} chars, need >50)`)
  }
}

// ---------------------------------------------------------------------------
// Domain 2: Free Repo Sync
// ---------------------------------------------------------------------------

function checkFreeRepoSync(): void {
  heading('Domain 2: Free Repo Sync')

  // Check gh CLI is available
  if (!exec('which gh')) {
    recordFail('gh CLI not found — install GitHub CLI to run free repo checks')
    return
  }

  // Fetch package.json from free repo
  const pkgB64 = exec(`gh api repos/${FREE_REPO}/contents/package.json --jq '.content' 2>/dev/null`)
  if (!pkgB64) {
    recordFail(`Could not fetch package.json from ${FREE_REPO}`)
  } else {
    try {
      const pkgContent = Buffer.from(pkgB64, 'base64').toString('utf-8')
      const pkg = JSON.parse(pkgContent)
      if (pkg.version === bareVersion) {
        recordPass(`Free repo package.json version matches: ${pkg.version}`)
      } else {
        recordFail(`Free repo version mismatch: "${pkg.version}" != "${bareVersion}"`)
      }
    } catch {
      recordFail('Failed to decode/parse package.json from free repo')
    }
  }

  // LICENSE file present
  const licenseCheck = exec(`gh api repos/${FREE_REPO}/contents/LICENSE --jq '.name' 2>/dev/null`)
  if (licenseCheck) {
    recordPass('LICENSE file present in free repo')
  } else {
    recordFail('LICENSE file missing from free repo')
  }

  // Excluded files absent
  for (const file of EXCLUDED_FILES) {
    const exists = exec(`gh api repos/${FREE_REPO}/contents/${file} --jq '.name // .type' 2>/dev/null`)
    if (!exists) {
      recordPass(`Excluded file absent: ${file}`)
    } else {
      recordFail(`Excluded file found in free repo: ${file}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Domain 3: Demo Site
// ---------------------------------------------------------------------------

async function checkDemoSite(): Promise<void> {
  heading('Domain 3: Demo Site')

  if (skipDemo) {
    recordSkip('Demo site checks skipped (--skip-demo)')
    return
  }

  // HTTP 200 at demo URL
  const indexResponse = await httpGet(DEMO_URL)
  if (!indexResponse) {
    recordFail(`Demo site unreachable: ${DEMO_URL}`)
    return
  }

  if (indexResponse.status === 200) {
    recordPass(`Demo site returns HTTP 200`)
  } else {
    recordFail(`Demo site returned HTTP ${indexResponse.status}`)
  }

  // Page HTML contains "MicroVM"
  if (indexResponse.body.includes('MicroVM')) {
    recordPass('Page HTML contains "MicroVM"')
  } else {
    recordFail('Page HTML does not contain "MicroVM"')
  }

  // robots.txt contains "GPTBot"
  const robotsResponse = await httpGet(`${DEMO_URL}/robots.txt`)
  if (!robotsResponse) {
    recordFail('Could not fetch robots.txt')
  } else if (robotsResponse.body.includes('GPTBot')) {
    recordPass('robots.txt contains "GPTBot" directive')
  } else {
    recordFail('robots.txt does not contain "GPTBot" directive')
  }

  // Page HTML contains content="noai
  if (indexResponse.body.includes('content="noai')) {
    recordPass('Page HTML contains noai meta tag')
  } else {
    recordFail('Page HTML does not contain noai meta tag (content="noai)')
  }
}

// ---------------------------------------------------------------------------
// Domain 4: API Spot Checks
// ---------------------------------------------------------------------------

async function checkApiSpot(): Promise<void> {
  heading('Domain 4: API Spot Checks')

  if (!hostUrl) {
    recordSkip('API checks skipped (no --host provided)')
    return
  }

  const baseUrl = hostUrl.replace(/\/+$/, '')

  // GET /api/health returns 200
  const healthResponse = await httpGet(`${baseUrl}/api/health`)
  if (!healthResponse) {
    recordFail(`API unreachable at ${baseUrl}/api/health`)
  } else if (healthResponse.status === 200) {
    recordPass('GET /api/health returns 200')
  } else {
    recordFail(`GET /api/health returned ${healthResponse.status}`)
  }

  // GET /api/auth/setup-required returns 200
  const setupResponse = await httpGet(`${baseUrl}/api/auth/setup-required`)
  if (!setupResponse) {
    recordFail(`API unreachable at ${baseUrl}/api/auth/setup-required`)
  } else if (setupResponse.status === 200) {
    recordPass('GET /api/auth/setup-required returns 200')
  } else {
    recordFail(`GET /api/auth/setup-required returned ${setupResponse.status}`)
  }
}

// ---------------------------------------------------------------------------
// Manual Verification Checklist
// ---------------------------------------------------------------------------

function printManualChecklist(): void {
  heading('Manual Verification (requires human eyes)')

  const items = [
    'Demo site: login page renders with hCaptcha widget',
    'Demo site: dashboard loads after login, 5 sample VMs visible',
    'Demo site: VM status badges show correct colors',
    'Demo site: start/stop/restart actions work in demo mode',
    'Demo site: VM detail page loads when clicking a VM card',
    'Demo site: responsive layout works on mobile viewport',
    'Demo site: no JavaScript errors in browser console',
    'Free repo: README.md renders correctly on GitHub',
    'NixOS module: service runs if deployed (systemctl status weaver)',
  ]

  for (const item of items) {
    console.log(`  ${C.dim}[ ]${C.reset} ${item}`)
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function printSummary(): void {
  console.log('')
  console.log(C.bold + '=' .repeat(50) + C.reset)
  console.log(`${C.bold}Post-Release Verification Summary: ${version}${C.reset}`)
  console.log(C.bold + '=' .repeat(50) + C.reset)
  console.log(`  ${C.green}\u2713 Passed:${C.reset}   ${totalPassed}`)
  console.log(`  ${C.red}\u2717 Failed:${C.reset}   ${totalFailed}`)
  if (totalWarnings > 0) {
    console.log(`  ${C.yellow}\u26A0 Warnings:${C.reset} ${totalWarnings}`)
  }
  if (totalSkipped > 0) {
    console.log(`  ${C.dim}\u2298 Skipped:${C.reset}  ${totalSkipped}`)
  }
  console.log('')

  if (totalFailed === 0) {
    console.log(`${C.green}${C.bold}All automated checks passed.${C.reset}`)
  } else {
    console.log(`${C.red}${C.bold}${totalFailed} check(s) failed — review output above.${C.reset}`)
  }
  console.log('')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n${C.bold}Post-Release Verification: ${version}${C.reset}`)
  console.log(`${C.dim}Dev repo:  ${DEV_REPO}${C.reset}`)
  console.log(`${C.dim}Free repo: ${FREE_REPO}${C.reset}`)
  console.log(`${C.dim}Demo URL:  ${DEMO_URL}${C.reset}`)
  if (hostUrl) {
    console.log(`${C.dim}API host:  ${hostUrl}${C.reset}`)
  }

  // Domain 1: GitHub Release (sync — uses gh CLI)
  checkGitHubRelease()

  // Domain 2: Free Repo Sync (sync — uses gh API)
  checkFreeRepoSync()

  // Domain 3: Demo Site (async — uses fetch)
  await checkDemoSite()

  // Domain 4: API Spot Checks (async — uses fetch)
  await checkApiSpot()

  // Manual checklist
  printManualChecklist()

  // Save report
  saveReport({
    reportName: 'post-release',
    timestamp: new Date().toISOString(),
    durationMs: 0,
    result: totalFailed > 0 ? 'fail' : 'pass',
    summary: { version, passed: totalPassed, failed: totalFailed, warnings: totalWarnings, skipped: totalSkipped },
    data: { version, hostUrl, skipDemo },
  })

  // Summary
  printSummary()

  // Exit code
  process.exit(totalFailed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(`${C.red}Fatal error:${C.reset}`, err.message ?? err)
  process.exit(1)
})

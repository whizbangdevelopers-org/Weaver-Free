// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * verify-demo-parity.ts — Demo ↔ Master Plan parity checker.
 *
 * Catches drift between the master plan and both private + public demos:
 *   1. Terminology — no deprecated tier names (Premium, Enterprise)
 *   2. Pricing — standard + FM shown wherever pricing appears
 *   3. Version headlines — demo matches DELIVERY.json
 *   4. Tier ceilings — correct tier stops gaining features at correct version
 *   5. Navigation — demo sidebar matches master plan nav model
 *   6. Help coverage — every demo page has a help entry
 *
 * The public demo is a gated subset of the private demo — it may show
 * fewer features but must never show WRONG features (stale terminology,
 * incorrect pricing, missing tier).
 *
 * Usage:  npx tsx scripts/verify-demo-parity.ts
 * Exit:   0 = all compliant, 1 = parity issues found
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

function readLines(relPath: string): string[] {
  return readFile(relPath).split('\n')
}

/** Find all .vue and .ts files under src/ */
function srcFiles(): string[] {
  return globSync('src/**/*.{vue,ts}', { cwd: ROOT })
}

/** Find all .vue and .ts files under tui/src/ */
function tuiFiles(): string[] {
  return globSync('tui/src/**/*.{vue,ts,tsx}', { cwd: ROOT })
}

// ---------------------------------------------------------------------------
// CHECK 1: Deprecated terminology
// ---------------------------------------------------------------------------

function checkTerminology() {
  const checkName = 'terminology'
  // These regex patterns match user-visible strings and code identifiers
  // that should have been renamed per Decision #87.
  // Excludes: import paths, CSS classes, git history references
  const DEPRECATED: Array<{ pattern: RegExp; replacement: string; context: string }> = [
    { pattern: /\bPremium\b/, replacement: 'Weaver Solo or Weaver Team', context: 'Decision #87' },
    { pattern: /\bEnterprise\b/, replacement: 'Fabrick', context: 'Decision #87' },
    // Internal variable/property names that confuse developers
    { pattern: /\bpremiumCommands\b/, replacement: 'gatedCommands', context: 'variable name' },
    { pattern: /\bpremiumBridges\b/, replacement: 'managedBridges', context: 'variable name' },
    { pattern: /\benterpriseIncluded\b/, replacement: 'fabrickIncluded', context: 'property name' },
    { pattern: /\breplacedByEnterprise\b/, replacement: 'replacedByFabrick', context: 'property name' },
    { pattern: /\bEarly Adopter\b/, replacement: 'Founding Member', context: 'Decision #136' },
    { pattern: /\beaProgram\b/, replacement: 'fmProgram', context: 'Decision #136' },
    { pattern: /\bearly-adopter\b/, replacement: 'founding-member', context: 'Decision #136' },
  ]

  // Allowed exceptions (backward compat, migration code, legal text)
  const EXCEPTIONS = [
    'container-loom-demo-mode',  // localStorage migration
    'microvm-demo-mode',         // localStorage migration
    'requiresEnterprise',        // route meta (internal gate key — rename separately)
    'requiresFabrick',           // already renamed variant
    'isEnterprise',              // store getter alias
  ]

  const files = [...srcFiles(), ...tuiFiles()]
  for (const rel of files) {
    const lines = readLines(rel)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      // Skip import/require lines
      if (/^\s*(import |require\()/.test(line)) continue

      for (const dep of DEPRECATED) {
        const match = dep.pattern.exec(line)
        if (!match) continue
        // Check exceptions
        if (EXCEPTIONS.some(ex => line.includes(ex))) continue
        fail(checkName, rel, `Deprecated term "${match[0]}" → "${dep.replacement}" (${dep.context})`, i + 1)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 2: Pricing parity
// ---------------------------------------------------------------------------

function checkPricing() {
  const checkName = 'pricing'

  // Canonical pricing — read from src/constants/pricing.ts (single source of truth)
  // Import isn't possible (script runs outside Vite), so parse the file directly.
  const pricingSource = readFile('src/constants/pricing.ts') ?? ''
  const extractPrice = (pattern: RegExp): string => pricingSource.match(pattern)?.[1] ?? '??'
  const PRICING = {
    solo:    { standard: extractPrice(/solo:[\s\S]*?standard:\s*'([^']+)'/), fm: extractPrice(/solo:[\s\S]*?fmShort:\s*'([^']+)'/) },
    team:    { standard: extractPrice(/team:[\s\S]*?standard:\s*'([^']+)'/), fm: extractPrice(/team:[\s\S]*?fmShort:\s*'([^']+)'/) },
    fabrick: { standard: extractPrice(/fabrick:[\s\S]*?standard:\s*'([^']+)'/), fm: extractPrice(/fabrick:[\s\S]*?fmShort:\s*'([^']+)'/) },
  }

  // Files that are expected to contain pricing
  const PRICING_FILES = [
    'src/components/demo/DemoTierSwitcher.vue',
    'src/pages/HelpPage.vue',
  ]

  for (const rel of PRICING_FILES) {
    const content = readFile(rel)
    if (!content) continue

    // Check that if Solo pricing appears, both standard AND FM are shown
    if (/\$149\/yr/.test(content) && !/\$249/.test(content)) {
      fail(checkName, rel, 'Solo pricing shows FM only ($149/yr) — missing standard ($249/yr)')
    }
    if (/\$249\/yr/.test(content) && !/\$149/.test(content)) {
      warn(checkName, rel, 'Solo pricing shows standard only ($249/yr) — missing FM ($149)')
    }

    // Check Team pricing
    if (/\$99\/user/.test(content) && !/\$149\/user/.test(content)) {
      fail(checkName, rel, 'Team pricing shows FM only ($99/user) — missing standard ($149/user/yr)')
    }

    // Check Fabrick pricing
    if (/\$1,500\/yr/.test(content) && !/\$999/.test(content)) {
      warn(checkName, rel, 'Fabrick pricing shows standard only ($1,500/yr) — missing FM ($999)')
    }
    if (/\$999/.test(content) && !/\$1,500/.test(content)) {
      fail(checkName, rel, 'Fabrick pricing shows FM only ($999) — missing standard ($1,500/yr)')
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 3: Version headline parity with DELIVERY.json
// ---------------------------------------------------------------------------

function checkVersionHeadlines() {
  const checkName = 'version-headlines'

  const deliveryPath = resolve(ROOT, '..', 'forge', 'DELIVERY.json')
  if (!existsSync(deliveryPath)) {
    warn(checkName, 'forge/DELIVERY.json', 'DELIVERY.json not found — skipping version headline check')
    return
  }

  const delivery = JSON.parse(readFileSync(deliveryPath, 'utf-8')) as {
    versions: Array<{ version: string; name: string }>
  }

  // Read demo.ts to find DEMO_VERSIONS headlines
  const demoContent = readFile('src/config/demo.ts')
  const demoLines = demoContent.split('\n')

  for (const ver of delivery.versions) {
    const shortVer = ver.version.replace(/\.0$/, '')
    // Find the line in demo.ts with this version
    const lineIdx = demoLines.findIndex(l =>
      l.includes(`version: '${shortVer}'`) || l.includes(`version: '${ver.version}'`)
    )
    if (lineIdx === -1) {
      fail(checkName, 'src/config/demo.ts', `Version ${ver.version} from DELIVERY.json not found in DEMO_VERSIONS`)
      continue
    }
    const line = demoLines[lineIdx]!
    // Extract headline from the line
    const headlineMatch = /headline:\s*'([^']+)'/.exec(line)
    if (!headlineMatch) continue

    // Check headline isn't using deprecated terms
    if (/Premium|Enterprise/.test(headlineMatch[1]!)) {
      fail(checkName, 'src/config/demo.ts', `Version ${ver.version} headline uses deprecated tier name: "${headlineMatch[1]}"`, lineIdx + 1)
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 4: Tier ceilings
// ---------------------------------------------------------------------------

function checkTierCeilings() {
  const checkName = 'tier-ceilings'

  // Master plan says:
  //   Free → feature-complete at v1.3
  //   Weaver (Solo/Team) → feature-complete at v2.0
  const EXPECTED_CEILINGS: Record<string, string> = {
    free: '1.3',
    weaver: '2.0',
  }

  const demoContent = readFile('src/config/demo.ts')

  for (const [tier, expectedVer] of Object.entries(EXPECTED_CEILINGS)) {
    // Map tier string → TIERS constant key. 'weaver' is gated by TIERS.SOLO (renamed 2026-04-15).
    const constantKey = tier === 'weaver' ? 'SOLO' : tier.toUpperCase()
    const pattern = new RegExp(`tierCeiling:\\s*TIERS\\.${constantKey}`, 'i')
    const match = pattern.exec(demoContent)
    if (!match) {
      fail(checkName, 'src/config/demo.ts', `Missing tierCeiling for ${tier} tier (expected at v${expectedVer})`)
      continue
    }
    // Find the version on the same line or nearby
    const lineIdx = demoContent.substring(0, match.index).split('\n').length
    const nearbyLines = demoContent.split('\n').slice(Math.max(0, lineIdx - 3), lineIdx + 1).join(' ')
    if (!nearbyLines.includes(expectedVer)) {
      warn(checkName, 'src/config/demo.ts', `Tier ceiling for ${tier} may not be at expected version ${expectedVer}`, lineIdx)
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 5: 4 tier buttons always visible
// ---------------------------------------------------------------------------

function checkTierButtons() {
  const checkName = 'tier-buttons'

  const content = readFile('src/components/demo/DemoTierSwitcher.vue')
  if (!content) return

  // All 4 tier options must exist (FABRICK_OPT may be built inline in a computed)
  const required = ['FREE_OPT', 'SOLO_OPT', 'TEAM_OPT']
  for (const opt of required) {
    if (!content.includes(opt)) {
      fail(checkName, 'src/components/demo/DemoTierSwitcher.vue', `Missing tier option: ${opt}`)
    }
  }
  // Fabrick must appear in the visible options (may be inline or const)
  if (!content.includes('fabrick') || !content.includes("label: 'FabricK'") && !content.includes('FABRICK_OPT')) {
    fail(checkName, 'src/components/demo/DemoTierSwitcher.vue', 'Missing FabricK tier option')
  }

  // visibleTierOptions should include all 4 (Team is a SKU, always visible)
  // Check that it's NOT conditionally hiding Team
  const visibleBlock = content.match(/visibleTierOptions[\s\S]*?\n\}\)/)
  if (visibleBlock) {
    const block = visibleBlock[0]
    if (/isDemoVersionAtLeast.*TEAM/.test(block) || /if.*2\.2.*TEAM/.test(block)) {
      fail(checkName, 'src/components/demo/DemoTierSwitcher.vue', 'Team button is conditionally hidden — Team is a SKU, must always be visible')
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 6: Help page coverage
// ---------------------------------------------------------------------------

function checkHelpCoverage() {
  const checkName = 'help-coverage'

  const helpContent = readFile('src/pages/HelpPage.vue')
  if (!helpContent) return

  // Every demo page/feature should have at least one help entry mentioning it
  const REQUIRED_TOPICS: Array<{ keyword: string; label: string }> = [
    { keyword: 'fleet.*bridge|Fleet.*Bridge', label: 'Fleet virtual bridges' },
    { keyword: 'Loom', label: 'Loom page' },
    { keyword: 'Warp', label: 'Warp page' },
    { keyword: 'Shed', label: 'Shed page' },
    { keyword: 'Fabrick.*overview|fleet.*control', label: 'Fabrick overview' },
    { keyword: 'workload.*group|Workload.*Group', label: 'Workload groups' },
    { keyword: 'Access.*Inspector|View as', label: 'Access Inspector' },
    { keyword: 'container.*Docker|Docker.*Podman', label: 'Container visibility' },
    { keyword: 'Strands', label: 'Strands page' },
    { keyword: 'Live.*Provisioning', label: 'Live Provisioning' },
    { keyword: 'Firewall.*TLS|TLS.*Firewall', label: 'Firewall + TLS' },
    { keyword: 'Solo.*Team|Team.*Solo', label: 'Solo vs Team distinction' },
    { keyword: 'tier.*switch|version.*switch|demo.*control', label: 'Demo controls' },
    { keyword: 'Extension', label: 'Extensions page' },
    { keyword: 'resource.*metric|CPU.*memory.*graph', label: 'Resource metrics' },
  ]

  for (const topic of REQUIRED_TOPICS) {
    const regex = new RegExp(topic.keyword, 'i')
    if (!regex.test(helpContent)) {
      fail(checkName, 'src/pages/HelpPage.vue', `Missing help entry for: ${topic.label}`)
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 7: Delivery date parity
// ---------------------------------------------------------------------------

function checkDeliveryDates() {
  const checkName = 'delivery-dates'

  const deliveryPath = resolve(ROOT, '..', 'forge', 'DELIVERY.json')
  if (!existsSync(deliveryPath)) return

  const generatedContent = readFile('src/config/delivery-versions.ts')
  if (!generatedContent) {
    fail(checkName, 'src/config/delivery-versions.ts', 'delivery-versions.ts not found — run npm run generate:versions')
    return
  }

  const delivery = JSON.parse(readFileSync(deliveryPath, 'utf-8')) as {
    versions: Array<{ version: string }>
  }

  for (const ver of delivery.versions) {
    if (!generatedContent.includes(`'${ver.version}'`)) {
      fail(checkName, 'src/config/delivery-versions.ts', `Version ${ver.version} from DELIVERY.json missing in generated delivery-versions.ts`)
    }
  }
}

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------

checkTerminology()
checkPricing()
checkVersionHeadlines()
checkTierCeilings()
checkTierButtons()
checkHelpCoverage()
checkDeliveryDates()

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const errors = issues.filter(i => i.severity === 'error')
const warnings = issues.filter(i => i.severity === 'warn')

const checks = [
  'terminology', 'pricing', 'version-headlines',
  'tier-ceilings', 'tier-buttons', 'help-coverage', 'delivery-dates',
]

console.log(`\n${BOLD}Demo ↔ Master Plan Parity${RESET}\n`)

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
  reportName: 'demo-parity',
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

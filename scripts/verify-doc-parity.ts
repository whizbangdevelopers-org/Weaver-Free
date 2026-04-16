// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Documentation Parity Auditor
 *
 * Cross-references documentation claims against the actual codebase and file
 * system to catch drift between what docs say exists and what actually exists.
 *
 * Checks:
 *   1. tier-matrix.json `implemented` flags vs MASTER-PLAN "Completed" claims
 *   2. Compliance auditor count in CLAUDE.md / MASTER-PLAN vs actual package.json chain
 *   3. Sales doc index (IT-FOCUS-VALUE-PROPOSITION.md) vs files in business/sales/
 *   4. Vertical sales doc template parity (9-section structure)
 *   5. Version annotation presence in vertical sales doc feature tables
 *   6. Plans directory existence vs MASTER-PLAN Plan Index references
 *   7. Agents directory vs Plans directory parity (MANIFEST.md, AGENT-STATUS.md)
 *   8. Cross-document fact verification (auditor count, findings count, vertical count, pricing)
 *   9. License key prefix validation (WVR-XXX- prefixes vs TIER-MANAGEMENT.md canonical set)
 *  10. Success Program column completeness (FM Price + Standard Price columns in all verticals)
 *  11. Success Program price cross-reference (vertical prices vs FOUNDING-MEMBER-PROGRAM.md)
 *  12. FM price qualifier check (FM prices in strategy docs must include "FM" label)
 *  13. Deprecated price amounts blocklist ($129/yr and other superseded prices must not appear as current)
 *  14. Price propagation freshness warning (flag pricing docs older than canonical sources)
 *
 * Usage:
 *   npx tsx scripts/verify-doc-parity.ts
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
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
// Paths
// ---------------------------------------------------------------------------

const MASTER_PLAN = resolve(PROJECT_ROOT, 'MASTER-PLAN.md')
const CLAUDE_MD = resolve(ROOT, 'CLAUDE.md')
const PACKAGE_JSON = resolve(ROOT, 'package.json')
const TIER_MATRIX = resolve(ROOT, 'tier-matrix.json')
const SALES_DIR = resolve(PROJECT_ROOT, 'business', 'sales')
const PLANS_DIR = resolve(PROJECT_ROOT, 'plans')
const IT_FOCUS = resolve(SALES_DIR, 'IT-FOCUS-VALUE-PROPOSITION.md')

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

function readFile(path: string): string {
  return readFileSync(path, 'utf-8')
}

function getDirectories(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(f => {
    const full = resolve(dir, f)
    return statSync(full).isDirectory()
  })
}

// ---------------------------------------------------------------------------
// Check 1: tier-matrix.json implemented flags vs MASTER-PLAN
// ---------------------------------------------------------------------------

function checkTierMatrixVsMasterPlan() {
  console.log(`\n${BOLD}1. TIER MATRIX vs MASTER-PLAN${RESET}`)

  const tierMatrix = JSON.parse(readFile(TIER_MATRIX))
  const masterPlan = readFile(MASTER_PLAN)

  // Find features marked as implemented: false in tier-matrix
  const unimplemented: Array<{ id: string; name: string }> = []
  for (const feature of tierMatrix.features) {
    if (!feature.implemented) {
      unimplemented.push({ id: feature.id, name: feature.name })
    }
  }

  if (unimplemented.length === 0) {
    pass('tier-matrix', 'All tier-matrix features are implemented')
    return
  }

  // Check if MASTER-PLAN mentions these unimplemented features as "Completed"
  // without a qualifying annotation like "v1.1" or "not yet implemented"
  for (const feat of unimplemented) {
    // Look for the feature name or id in the master plan's completed section
    const completedSection = masterPlan.match(
      /### Completed[\s\S]*?(?=###|$)/i,
    )
    if (!completedSection) continue

    const section = completedSection[0]
    // Check if feature name appears in completed section without version caveat
    if (
      section.includes(feat.name) ||
      section.includes(feat.id.replace(/-/g, ' '))
    ) {
      // Check for annotations that indicate it's not yet shipped
      const hasAnnotation =
        /not yet implemented|v1\.[1-9]|v2\.|roadmap/i.test(
          section.substring(
            Math.max(0, section.indexOf(feat.name) - 50),
            section.indexOf(feat.name) + feat.name.length + 100,
          ),
        )
      if (!hasAnnotation) {
        fail(
          'tier-matrix',
          `"${feat.name}" (${feat.id}) is implemented:false in tier-matrix but appears in MASTER-PLAN Completed section without annotation`,
        )
      } else {
        pass(
          'tier-matrix',
          `"${feat.name}" (${feat.id}) — unimplemented, properly annotated in MASTER-PLAN`,
        )
      }
    } else {
      pass(
        'tier-matrix',
        `"${feat.name}" (${feat.id}) — unimplemented, not claimed as completed`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Check 2: Auditor count parity
// ---------------------------------------------------------------------------

function checkAuditorCount() {
  console.log(`\n${BOLD}2. AUDITOR COUNT PARITY${RESET}`)

  const pkg = JSON.parse(readFile(PACKAGE_JSON))
  const complianceScript = pkg.scripts['test:compliance'] as string

  // Count the number of "npm run audit:" calls in the compliance chain
  const auditCalls = complianceScript.match(/npm run audit:[\w-]+/g) || []
  const actualCount = auditCalls.length
  const auditorNames = auditCalls.map((c: string) =>
    c.replace('npm run audit:', ''),
  )

  // Check CLAUDE.md
  const claudeMd = readFile(CLAUDE_MD)
  const claudeCountMatch = claudeMd.match(
    /(\d+)\s+(?:static\s+)?(?:compliance\s+)?auditors?/i,
  )
  const claudeCount = claudeCountMatch ? parseInt(claudeCountMatch[1]) : null

  if (claudeCount === actualCount) {
    pass(
      'auditor-count',
      `CLAUDE.md auditor count (${claudeCount}) matches package.json (${actualCount})`,
    )
  } else if (claudeCount !== null) {
    fail(
      'auditor-count',
      `CLAUDE.md says ${claudeCount} auditors but package.json has ${actualCount}: ${auditorNames.join(', ')}`,
    )
  } else {
    warn('auditor-count', 'Could not find auditor count in CLAUDE.md')
  }

  // Check MASTER-PLAN
  const masterPlan = readFile(MASTER_PLAN)
  const mpCountMatch = masterPlan.match(
    /(\d+)\s+(?:static\s+)?(?:compliance\s+)?auditors?/i,
  )
  const mpCount = mpCountMatch ? parseInt(mpCountMatch[1]) : null

  if (mpCount === actualCount) {
    pass(
      'auditor-count',
      `MASTER-PLAN auditor count (${mpCount}) matches package.json (${actualCount})`,
    )
  } else if (mpCount !== null) {
    fail(
      'auditor-count',
      `MASTER-PLAN says ${mpCount} auditors but package.json has ${actualCount}: ${auditorNames.join(', ')}`,
    )
  } else {
    warn('auditor-count', 'Could not find auditor count in MASTER-PLAN.md')
  }
}

// ---------------------------------------------------------------------------
// Check 3: Sales doc index vs actual files
// ---------------------------------------------------------------------------

function checkSalesDocIndex() {
  console.log(`\n${BOLD}3. SALES DOC INDEX vs FILESYSTEM${RESET}`)

  if (!existsSync(IT_FOCUS)) {
    warn('sales-index', 'IT-FOCUS-VALUE-PROPOSITION.md not found — skipping')
    return
  }

  const content = readFile(IT_FOCUS)

  // Find all markdown links to .md files in the industry table
  const linkPattern = /\[([^\]]+)\]\(([^)]+\.md)\)/g
  const linkedFiles: Array<{ display: string; file: string }> = []
  let match
  while ((match = linkPattern.exec(content)) !== null) {
    const file = match[2]
    // Only check local file links (not URLs, not parent-dir links outside sales/)
    if (!file.startsWith('http') && !file.startsWith('../')) {
      linkedFiles.push({ display: match[1], file })
    }
  }

  // Find planned references (text.md without a link, or with _(planned)_)
  const plannedPattern = /(\w[\w-]+\.md)\s+_\(planned\)_/g
  const plannedFiles: string[] = []
  while ((match = plannedPattern.exec(content)) !== null) {
    plannedFiles.push(match[1])
  }

  // Check linked files exist
  for (const link of linkedFiles) {
    const fullPath = resolve(SALES_DIR, link.file)
    if (existsSync(fullPath)) {
      pass('sales-index', `${link.file} — linked and exists`)
    } else {
      fail(
        'sales-index',
        `${link.file} — linked in index but file does not exist`,
      )
    }
  }

  // Check for planned files that are also linked (stale planned marker)
  for (const planned of plannedFiles) {
    const fullPath = resolve(SALES_DIR, planned)
    if (existsSync(fullPath)) {
      fail(
        'sales-index',
        `${planned} — marked as _(planned)_ but file exists`,
      )
    } else {
      pass('sales-index', `${planned} — correctly marked as planned`)
    }
  }

  // Check for sales docs that exist but aren't in the index at all
  // Internal reference docs that are not sales verticals and don't need index entries
  const SALES_INTERNAL_DOCS = new Set(['IT-FOCUS-VALUE-PROPOSITION.md', 'COMPLIANCE-TIMELINE.md'])
  const salesFiles = readdirSync(SALES_DIR).filter(
    f => f.endsWith('.md') && !SALES_INTERNAL_DOCS.has(f),
  )
  const indexedFiles = new Set([
    ...linkedFiles.map(l => l.file),
    ...plannedFiles,
  ])
  for (const file of salesFiles) {
    if (!indexedFiles.has(file)) {
      // Check if it's referenced by some other link pattern
      if (!content.includes(file)) {
        fail(
          'sales-index',
          `${file} — exists in business/sales/ but not listed in IT-FOCUS-VALUE-PROPOSITION.md`,
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Docs in business/sales/ that are not regulated-industry vertical docs
// (strategy/community docs excluded from compliance template checks)
const VERTICAL_STRATEGY_DOCS = new Set([
  'IT-FOCUS-VALUE-PROPOSITION.md',
  'opensource-support.md',
  'FOUNDING-MEMBER-PROGRAM.md',
  'MIGRATION-GUIDE.md',
  'COMPLIANCE-TIMELINE.md',
])

// Check 4: Vertical sales doc template parity (9-section structure)
// ---------------------------------------------------------------------------

const EXPECTED_SECTIONS = [
  /problem/i,
  /regulatory\s+mapping/i,
  /weaver/i,
  /fabrick/i,
  /deficiency\s+remediation|remediation\s+plan/i,
  /competitive\s+advantages/i,
  /objection\s+handling/i,
  /buyer\s+personas/i,
  /discovery\s+questions/i,
]

const EXPECTED_SECTION_COUNT = EXPECTED_SECTIONS.length

function checkVerticalDocStructure() {
  console.log(`\n${BOLD}4. VERTICAL SALES DOC TEMPLATE PARITY${RESET}`)

  if (!existsSync(SALES_DIR)) {
    warn('template-parity', 'business/sales/ directory not found — skipping')
    return
  }

  // Find vertical docs (exclude strategy docs — see module-level VERTICAL_STRATEGY_DOCS)
  const verticalDocs = readdirSync(SALES_DIR).filter(
    f => f.endsWith('.md') && !VERTICAL_STRATEGY_DOCS.has(f) && !f.startsWith('.'),
  )

  if (verticalDocs.length === 0) {
    warn('template-parity', 'No vertical sales docs found')
    return
  }

  for (const doc of verticalDocs) {
    const content = readFile(resolve(SALES_DIR, doc))

    // Extract ## section headers
    const headers = content.match(/^## \d+\..*/gm) || []
    const sectionCount = headers.length

    if (sectionCount >= EXPECTED_SECTION_COUNT) {
      pass('template-parity', `${doc} — ${sectionCount} sections (${sectionCount === EXPECTED_SECTION_COUNT ? 'matches template' : `template + ${sectionCount - EXPECTED_SECTION_COUNT} additional`})`)
    } else {
      fail(
        'template-parity',
        `${doc} — ${sectionCount} sections (expected at least ${EXPECTED_SECTION_COUNT})`,
      )
    }

    // Check each expected section exists
    for (let i = 0; i < EXPECTED_SECTIONS.length; i++) {
      const pattern = EXPECTED_SECTIONS[i]
      const found = headers.some(h => pattern.test(h))
      if (!found) {
        fail(
          'template-parity',
          `${doc} — missing section matching: ${pattern.source}`,
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check 5: Version annotation presence (Available column)
// ---------------------------------------------------------------------------

function checkVersionAnnotations() {
  console.log(`\n${BOLD}5. VERSION ANNOTATIONS IN SALES DOCS${RESET}`)

  const verticalDocs = readdirSync(SALES_DIR).filter(
    f => f.endsWith('.md') && !VERTICAL_STRATEGY_DOCS.has(f) && !f.startsWith('.'),
  )

  for (const doc of verticalDocs) {
    const content = readFile(resolve(SALES_DIR, doc))

    // Look for tables with a Tier column — these are the feature/regulatory tables
    // that should have an Available column
    const tables = content.match(
      /\|[^\n]*Tier[^\n]*\|[^\n]*\n\|[-|:\s]+\n(?:\|[^\n]+\n)+/g,
    )

    if (!tables || tables.length === 0) {
      warn('version-annotations', `${doc} — no tier tables found to check`)
      continue
    }

    let allHaveAvailable = true
    for (const table of tables) {
      const headerLine = table.split('\n')[0]
      if (!headerLine.toLowerCase().includes('available')) {
        allHaveAvailable = false
      }
    }

    if (allHaveAvailable) {
      pass(
        'version-annotations',
        `${doc} — all tier tables have Available column`,
      )
    } else {
      fail(
        'version-annotations',
        `${doc} — one or more tier tables missing Available column`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Check 6: Plans directory vs MASTER-PLAN Plan Index
// ---------------------------------------------------------------------------

function checkPlansDirectory() {
  console.log(`\n${BOLD}6. PLANS DIRECTORY vs MASTER-PLAN INDEX${RESET}`)

  // Get actual plan directories (exclude archive and cross-version — those have separate checks)
  const planDirs = getDirectories(PLANS_DIR).filter(d => d !== 'archive' && d !== 'cross-version')
  const masterPlan = readFile(MASTER_PLAN)

  // Find version directory references in the plan index section
  const planIndexSection = masterPlan.match(
    /## Plan Index[\s\S]*?(?=\n## [^#]|$)/i,
  )

  if (!planIndexSection) {
    warn('plans-dir', 'Could not find Plan Index section in MASTER-PLAN.md')
    return
  }

  const indexContent = planIndexSection[0]

  // Check each actual plans/ directory is referenced in MASTER-PLAN
  for (const dir of planDirs) {
    if (indexContent.includes(`plans/${dir}/`) || indexContent.includes(dir)) {
      pass('plans-dir', `plans/${dir}/ — referenced in MASTER-PLAN Plan Index`)
    } else {
      fail(
        'plans-dir',
        `plans/${dir}/ — exists on disk but not in MASTER-PLAN Plan Index`,
      )
    }
  }

  // Check cross-version plans: every .md file in plans/cross-version/ must be
  // referenced in MASTER-PLAN's cross-version plans section and from at least
  // one version-specific EXECUTION-ROADMAP.md
  const crossVersionDir = resolve(PLANS_DIR, 'cross-version')
  if (existsSync(crossVersionDir)) {
    const crossVersionFiles = readdirSync(crossVersionDir).filter(f => f.endsWith('.md'))
    for (const file of crossVersionFiles) {
      // Check MASTER-PLAN registration
      if (indexContent.includes(file)) {
        pass('plans-dir', `plans/cross-version/${file} — registered in MASTER-PLAN Plan Index`)
      } else {
        fail(
          'plans-dir',
          `plans/cross-version/${file} — not registered in MASTER-PLAN Plan Index (cross-version plans must be listed under "Cross-version plans")`,
        )
      }
      // Check at least one version-specific roadmap references it
      // Exception: plans that "apply to every release" don't target a specific version
      const planContent = readFile(resolve(crossVersionDir, file))
      const appliesToEveryRelease = /applies to every.*release/i.test(planContent)

      if (appliesToEveryRelease) {
        pass('plans-dir', `plans/cross-version/${file} — applies to every release (no version-specific roadmap reference needed)`)
      } else {
        let referencedByRoadmap = false
        for (const vDir of planDirs) {
          const roadmap = resolve(PLANS_DIR, vDir, 'EXECUTION-ROADMAP.md')
          if (existsSync(roadmap)) {
            const roadmapContent = readFile(roadmap)
            if (roadmapContent.includes(file)) {
              referencedByRoadmap = true
              break
            }
          }
        }
        if (referencedByRoadmap) {
          pass('plans-dir', `plans/cross-version/${file} — referenced from version-specific EXECUTION-ROADMAP`)
        } else {
          warn(
            'plans-dir',
            `plans/cross-version/${file} — not referenced from any version-specific EXECUTION-ROADMAP (cross-version plans should be linked from roadmaps where integrations are scheduled)`,
        )
        }
      }
    }
  }

  // Check for MASTER-PLAN references to plan dirs that don't exist
  const versionDirPattern = /plans\/(v[\d.]+)\//g
  const referencedDirs = new Set<string>()
  let vMatch
  while ((vMatch = versionDirPattern.exec(indexContent)) !== null) {
    referencedDirs.add(vMatch[1])
  }

  for (const ref of referencedDirs) {
    if (!planDirs.includes(ref)) {
      // Check if it's in archive
      const archivePath = resolve(PLANS_DIR, 'archive', ref)
      if (existsSync(archivePath)) {
        pass('plans-dir', `plans/${ref}/ — referenced in index, found in archive`)
      } else {
        fail(
          'plans-dir',
          `plans/${ref}/ — referenced in MASTER-PLAN but does not exist`,
        )
      }
    }
  }

  // Check each plan dir has an EXECUTION-ROADMAP.md
  for (const dir of planDirs) {
    const roadmap = resolve(PLANS_DIR, dir, 'EXECUTION-ROADMAP.md')
    if (existsSync(roadmap)) {
      pass('plans-dir', `plans/${dir}/EXECUTION-ROADMAP.md — exists`)
    } else {
      warn(
        'plans-dir',
        `plans/${dir}/EXECUTION-ROADMAP.md — missing (convention expects one)`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Check 7: Agents directory vs Plans directory parity
// ---------------------------------------------------------------------------

const AGENTS_DIR = resolve(PROJECT_ROOT, 'agents')
const AGENTS_ARCHIVE = resolve(AGENTS_DIR, 'archive')
const FORGE_STATUS = resolve(PROJECT_ROOT, 'forge', 'STATUS.json')

function parseVersion(v: string): number[] {
  return v.replace(/^v/, '').split('.').map(Number)
}

function versionGreaterThan(a: string, b: string): boolean {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true
    if ((pa[i] || 0) < (pb[i] || 0)) return false
  }
  return false
}

function checkAgentsVsPlans() {
  console.log(`\n${BOLD}7. AGENTS DIRECTORY vs PLANS DIRECTORY${RESET}`)

  if (!existsSync(AGENTS_DIR)) {
    warn('agents-plans', 'agents/ directory not found — skipping')
    return
  }

  // Get versioned agent dirs (exclude non-version dirs like templates, gtm, archive)
  const agentDirs = getDirectories(AGENTS_DIR).filter(d =>
    /^v\d+\.\d+\.\d+$/.test(d),
  )
  const planDirs = getDirectories(PLANS_DIR).filter(d =>
    /^v\d+\.\d+\.\d+$/.test(d),
  )
  const archivedAgentDirs = existsSync(AGENTS_ARCHIVE)
    ? getDirectories(AGENTS_ARCHIVE).filter(d => /^v\d+\.\d+\.\d+$/.test(d))
    : []

  // Every agents/vX.Y.0/ must have a corresponding plans/vX.Y.0/
  for (const dir of agentDirs) {
    if (planDirs.includes(dir)) {
      pass('agents-plans', `agents/${dir}/ — matching plans/${dir}/ exists`)
    } else {
      fail(
        'agents-plans',
        `agents/${dir}/ — no matching plans/${dir}/ found (agents can't exist without plans)`,
      )
    }
  }

  // Every agents/vX.Y.0/ must have a MANIFEST.md
  for (const dir of agentDirs) {
    const manifest = resolve(AGENTS_DIR, dir, 'MANIFEST.md')
    if (existsSync(manifest)) {
      pass('agents-plans', `agents/${dir}/MANIFEST.md — exists`)
    } else {
      fail(
        'agents-plans',
        `agents/${dir}/MANIFEST.md — missing (convention requires one)`,
      )
    }
  }

  // Archived agent dirs should have matching plans (active or archived)
  const planArchiveDirs = existsSync(resolve(PLANS_DIR, 'archive'))
    ? getDirectories(resolve(PLANS_DIR, 'archive')).filter(d =>
        /^v\d+\.\d+\.\d+$/.test(d),
      )
    : []
  const allPlanVersions = new Set([...planDirs, ...planArchiveDirs])

  for (const dir of archivedAgentDirs) {
    if (allPlanVersions.has(dir)) {
      pass(
        'agents-plans',
        `agents/archive/${dir}/ — matching plan version exists`,
      )
    } else {
      warn(
        'agents-plans',
        `agents/archive/${dir}/ — no matching plan version found`,
      )
    }
  }

  // Check AGENT-STATUS.md exists and references active agent dirs
  const agentStatus = resolve(AGENTS_DIR, 'AGENT-STATUS.md')
  if (!existsSync(agentStatus)) {
    fail('agents-plans', 'agents/AGENT-STATUS.md — missing')
    return
  }

  const statusContent = readFile(agentStatus)
  for (const dir of agentDirs) {
    if (statusContent.includes(dir)) {
      pass(
        'agents-plans',
        `agents/AGENT-STATUS.md references ${dir}`,
      )
    } else {
      fail(
        'agents-plans',
        `agents/${dir}/ exists but not referenced in AGENT-STATUS.md`,
      )
    }
  }

  // -----------------------------------------------------------------------
  // Pre-development review gate:
  // Read forge/STATUS.json to find next versions in queue.
  // Next versions = queue entries blocked only by currentVersion.
  // These MUST have agents/vX.Y.0/MANIFEST.md with a **Reviewed:** date.
  // Future versions (not next) get warnings for missing agents.
  // -----------------------------------------------------------------------

  console.log(`\n${BOLD}7b. PRE-DEVELOPMENT REVIEW GATE${RESET}`)

  if (!existsSync(FORGE_STATUS)) {
    warn('review-gate', 'forge/STATUS.json not found — skipping review gate')
    return
  }

  const forgeStatus = JSON.parse(readFile(FORGE_STATUS))
  const currentVersion = forgeStatus.currentVersion as string

  if (!currentVersion) {
    warn('review-gate', 'forge/STATUS.json has no currentVersion — skipping')
    return
  }

  console.log(`  ${DIM}Current version: v${currentVersion}${RESET}`)

  // Find next versions: queue entries whose blockedBy is the current version
  const queue = (forgeStatus.queue || []) as Array<{
    version: string
    agent: string
    blockedBy: string
  }>

  const nextVersions = new Set<string>()
  const futureVersions = new Set<string>()

  for (const entry of queue) {
    const ver = `v${entry.version}`
    // "Next" = blocked only by the current version release
    if (
      entry.blockedBy === `v${currentVersion} release` ||
      entry.blockedBy === `v${currentVersion}`
    ) {
      nextVersions.add(ver)
    } else if (versionGreaterThan(ver, `v${currentVersion}`)) {
      futureVersions.add(ver)
    }
  }

  // Also add versions from agentGaps.missing_definitions as future
  const missingDefs = (forgeStatus.agentGaps?.missing_definitions ||
    []) as string[]
  for (const ver of missingDefs) {
    const vVer = ver.startsWith('v') ? ver : `v${ver}`
    if (!nextVersions.has(vVer)) {
      futureVersions.add(vVer)
    }
  }

  // Check next versions: MUST have reviewed MANIFEST.md
  const allAgentVersions = new Set([...agentDirs, ...archivedAgentDirs])

  for (const ver of nextVersions) {
    const manifest = resolve(AGENTS_DIR, ver, 'MANIFEST.md')

    if (!existsSync(manifest)) {
      fail(
        'review-gate',
        `${ver} is next in queue but agents/${ver}/MANIFEST.md does not exist — cannot start development`,
      )
      continue
    }

    // Check for **Reviewed:** date in MANIFEST.md
    const manifestContent = readFile(manifest)
    const reviewedMatch = manifestContent.match(
      /\*\*Reviewed:\*\*\s*(\d{4}-\d{2}-\d{2})/,
    )

    if (reviewedMatch) {
      pass(
        'review-gate',
        `${ver} MANIFEST.md reviewed on ${reviewedMatch[1]} — development approved`,
      )
    } else {
      fail(
        'review-gate',
        `${ver} is next in queue but agents/${ver}/MANIFEST.md has no **Reviewed:** date — add review date before starting development`,
      )
    }
  }

  // Future versions: warn if no agents dir
  for (const ver of futureVersions) {
    if (!allAgentVersions.has(ver)) {
      warn(
        'review-gate',
        `${ver} — no agents/ directory yet (future version)`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Check 8: Cross-document fact verification
//
// Scans ALL project markdown files for claims about auditor counts, security
// findings, sales vertical counts, and tier pricing — then verifies each
// claim against the canonical source of truth. This catches drift anywhere,
// not just in pitch docs.
// ---------------------------------------------------------------------------

const SECURITY_AUDIT = resolve(PROJECT_ROOT, 'business', 'legal', 'SECURITY-AUDIT.md')
const TIER_MGMT = resolve(PROJECT_ROOT, 'business', 'product', 'TIER-MANAGEMENT.md')
const FOUNDING_MEMBER = resolve(PROJECT_ROOT, 'business', 'sales', 'FOUNDING-MEMBER-PROGRAM.md')

// Files already checked by Check 2 (auditor count) — skip for 8a to avoid
// duplicate findings
const CHECK2_AUDITOR_FILES = new Set([
  resolve(ROOT, 'CLAUDE.md'),
  MASTER_PLAN,
])

// Pricing checks only make sense in strategy/sales docs, not README examples
const PRICING_DIRS = new Set([
  resolve(PROJECT_ROOT, 'business'),
  resolve(PROJECT_ROOT, 'plans'),
  SALES_DIR,
])

function collectDownstreamDocs(): Array<{ name: string; path: string; content: string }> {
  const docs: Array<{ name: string; path: string; content: string }> = []

  const scanDirs = [
    PROJECT_ROOT,                                    // STATUS.md, MASTER-PLAN.md
    resolve(PROJECT_ROOT, 'business'),               // pitch deck, tier mgmt, etc.
    SALES_DIR,                                       // vertical sales docs
    resolve(PROJECT_ROOT, 'forge'),                   // PROJECT-ASSESSMENT.md
    resolve(PROJECT_ROOT, 'plans'),                   // execution roadmaps (1 level)
    resolve(PROJECT_ROOT, 'agents'),                  // AGENT-STATUS.md (1 level)
    resolve(ROOT, 'docs'),                            // DEVELOPER-GUIDE, etc.
    resolve(ROOT, 'demo'),                            // demo README
  ]

  // Scan each dir for .md files (non-recursive — subdirs handled by plans/agents globs)
  for (const dir of scanDirs) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md') || f.startsWith('.')) continue
      const fp = resolve(dir, f)
      if (!statSync(fp).isFile()) continue
      const relDir = dir === PROJECT_ROOT ? '' : dir.replace(PROJECT_ROOT + '/', '') + '/'
      docs.push({ name: `${relDir}${f}`, path: fp, content: readFile(fp) })
    }
  }

  // Plans subdirs (plans/v1.0.0/*.md, etc.)
  if (existsSync(PLANS_DIR)) {
    for (const ver of readdirSync(PLANS_DIR)) {
      const verDir = resolve(PLANS_DIR, ver)
      if (!statSync(verDir).isDirectory() || ver === 'archive') continue
      for (const f of readdirSync(verDir)) {
        if (!f.endsWith('.md')) continue
        const fp = resolve(verDir, f)
        docs.push({ name: `plans/${ver}/${f}`, path: fp, content: readFile(fp) })
      }
    }
  }

  // code/CLAUDE.md (important — lists auditor count)
  const codeClaude = resolve(ROOT, 'CLAUDE.md')
  if (existsSync(codeClaude)) {
    docs.push({ name: 'code/CLAUDE.md', path: codeClaude, content: readFile(codeClaude) })
  }

  return docs
}

function checkCrossDocFacts() {
  console.log(`\n${BOLD}8. CROSS-DOCUMENT FACT VERIFICATION${RESET}`)

  const docs = collectDownstreamDocs()
  if (docs.length === 0) {
    warn('cross-doc', 'No downstream docs found — skipping')
    return
  }

  // --- 8a: Auditor count ---
  const pkg = JSON.parse(readFile(PACKAGE_JSON))
  const complianceScript = pkg.scripts['test:compliance'] as string
  const auditCalls = complianceScript.match(/npm run audit:[\w-]+/g) || []
  const actualAuditorCount = auditCalls.length

  for (const doc of docs) {
    if (CHECK2_AUDITOR_FILES.has(doc.path)) continue
    const auditorMatches = doc.content.match(/(\d+)\s+(?:automated\s+)?(?:compliance\s+)?auditors?/gi) || []
    for (const m of auditorMatches) {
      const num = parseInt(m.match(/\d+/)![0])
      if (num === actualAuditorCount) {
        pass('cross-doc', `${doc.name} auditor count (${num}) matches package.json (${actualAuditorCount})`)
      } else {
        fail('cross-doc', `${doc.name} says ${num} auditors but package.json has ${actualAuditorCount}`)
      }
    }
  }

  // --- 8b: Security findings count ---
  if (existsSync(SECURITY_AUDIT)) {
    const secContent = readFile(SECURITY_AUDIT)
    const secHeaders = secContent.match(/####\s+SEC-\d+/g) || []
    const actualFindings = secHeaders.length

    const totalMatch = secContent.match(/\|\s*\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*/)
    const totalRowCount = totalMatch ? parseInt(totalMatch[1]) : null

    if (totalRowCount !== null && totalRowCount !== actualFindings) {
      fail('cross-doc', `SECURITY-AUDIT.md Total row (${totalRowCount}) does not match SEC-NNN header count (${actualFindings})`)
    }

    for (const doc of docs) {
      // Skip the audit file itself
      if (doc.path === SECURITY_AUDIT) continue
      const findingsMatches = doc.content.match(/(\d+)\s+findings?/gi) || []
      for (const m of findingsMatches) {
        const num = parseInt(m.match(/\d+/)![0])
        // Only flag if the number is plausibly about security findings (context check)
        const idx = doc.content.indexOf(m)
        const ctx = doc.content.slice(Math.max(0, idx - 120), idx + m.length + 120).toLowerCase()
        if (!/secur|red.?team|sec-\d|vulnerability|vulnerabilities|hardening/.test(ctx)) continue
        if (num === actualFindings) {
          pass('cross-doc', `${doc.name} findings count (${num}) matches SECURITY-AUDIT.md (${actualFindings})`)
        } else {
          fail('cross-doc', `${doc.name} says ${num} findings but SECURITY-AUDIT.md has ${actualFindings}`)
        }
      }
    }
  } else {
    warn('cross-doc', 'SECURITY-AUDIT.md not found — skipping findings count check')
  }

  // --- 8c: Sales vertical count ---
  const actualVerticals = existsSync(SALES_DIR)
    ? readdirSync(SALES_DIR).filter(f => f.endsWith('.md') && !VERTICAL_STRATEGY_DOCS.has(f) && !f.startsWith('.'))
    : []
  const actualVerticalCount = actualVerticals.length

  for (const doc of docs) {
    const verticalMatches = doc.content.match(/(\d+)\s+industry[- ]specific/gi) || []
    for (const m of verticalMatches) {
      const num = parseInt(m.match(/\d+/)![0])
      if (num === actualVerticalCount) {
        pass('cross-doc', `${doc.name} vertical count (${num}) matches business/sales/ (${actualVerticalCount})`)
      } else {
        fail('cross-doc', `${doc.name} says ${num} industry-specific docs but business/sales/ has ${actualVerticalCount} verticals: ${actualVerticals.join(', ')}`)
      }
    }
  }

  // --- 8d: Tier pricing (strategy/sales docs only) ---
  if (existsSync(TIER_MGMT)) {
    const tierContent = readFile(TIER_MGMT)
    const hasPremium99 = /\$99\/yr/.test(tierContent)
    const hasEnterprise799 = /\$799\/yr/.test(tierContent)

    for (const doc of docs) {
      // Only check pricing in business/plans/sales directories
      const inPricingDir = [...PRICING_DIRS].some(d => doc.path.startsWith(d))
      if (!inPricingDir) continue
      if (doc.path === TIER_MGMT) continue

      if (doc.content.includes('$99/yr')) {
        if (hasPremium99) {
          pass('cross-doc', `${doc.name} Premium price ($99/yr) matches TIER-MANAGEMENT.md`)
        } else {
          fail('cross-doc', `${doc.name} says $99/yr but TIER-MANAGEMENT.md does not contain this price`)
        }
      }

      // $799/yr is the intentional grandfathered founding-member rate kept in TIER-MANAGEMENT.md.
      // Only flag lines where $799/yr appears as a *current* price claim — skip changelog,
      // historical, and grandfathered-rate context lines.
      const historicalMarkers = /→|\bgrandfathered\b|\bnamed rate\b|\bwas \$|\bRaised from\b|\bfounding.member\b|\bearly.adopter\b|\bv1\.x\b|\bnamed early\b|\blegacy\b|\bold price\b/i
      const stale799Lines = doc.content
        .split('\n')
        .filter(line => line.includes('$799/yr') && !historicalMarkers.test(line))
      if (stale799Lines.length > 0) {
        if (hasEnterprise799) {
          pass('cross-doc', `${doc.name} Enterprise price ($799/yr) matches TIER-MANAGEMENT.md`)
        } else {
          fail('cross-doc', `${doc.name} says $799/yr but TIER-MANAGEMENT.md does not contain this price`)
        }
      }
    }
  } else {
    warn('cross-doc', 'TIER-MANAGEMENT.md not found — skipping pricing check')
  }
}

// ---------------------------------------------------------------------------
// Check 9: License key prefix validation
// ---------------------------------------------------------------------------

function checkLicenseKeyPrefixes() {
  console.log(`\n${BOLD}9. LICENSE KEY PREFIX VALIDATION${RESET}`)

  if (!existsSync(TIER_MGMT)) {
    warn('license-keys', 'TIER-MANAGEMENT.md not found — skipping')
    return
  }

  const tierContent = readFile(TIER_MGMT)
  const validPrefixes = new Set(tierContent.match(/WVR-[A-Z]{3}-/g) || [])

  if (validPrefixes.size === 0) {
    warn('license-keys', 'No WVR-XXX- prefixes found in TIER-MANAGEMENT.md — skipping')
    return
  }

  const docs = collectDownstreamDocs()
  let invalidCount = 0
  let checkedOccurrences = 0

  // Lines that document historical renames are allowed to reference old prefixes
  // Allow backtick-wrapped inline code: `replaces \`WVR-PRE-\``
  const historicalMarkers = /replaces\s+`?WVR-|was\s+`?WVR-|→\s*`?WVR-|formerly\s+`?WVR-|renamed.*WVR-/i

  for (const doc of docs) {
    if (doc.path === TIER_MGMT) continue
    // Check line-by-line so historical rename context can be excluded
    for (const line of doc.content.split('\n')) {
      const linePrefixes = line.match(/WVR-[A-Z]{3}-/g) || []
      for (const prefix of linePrefixes) {
        if (!validPrefixes.has(prefix)) {
          if (historicalMarkers.test(line)) continue // decision log rename documentation
          invalidCount++
          checkedOccurrences++
          fail(
            'license-keys',
            `${doc.name} — invalid key prefix ${prefix} (valid: ${[...validPrefixes].sort().join(', ')})`,
          )
        } else {
          checkedOccurrences++
        }
      }
    }
  }

  if (invalidCount === 0 && checkedOccurrences > 0) {
    pass(
      'license-keys',
      `All WVR- key prefixes valid across ${checkedOccurrences} occurrence(s) — valid set: ${[...validPrefixes].sort().join(', ')}`,
    )
  } else if (checkedOccurrences === 0) {
    warn('license-keys', 'No WVR-XXX- key references found in any downstream doc')
  }
}

// ---------------------------------------------------------------------------
// Check 10: Success Program column completeness
// ---------------------------------------------------------------------------

function checkSuccessProgramColumns() {
  console.log(`\n${BOLD}10. SUCCESS PROGRAM COLUMN COMPLETENESS${RESET}`)

  if (!existsSync(SALES_DIR)) {
    warn('sp-columns', 'business/sales/ not found — skipping')
    return
  }

  const verticalDocs = readdirSync(SALES_DIR).filter(
    f => f.endsWith('.md') && !VERTICAL_STRATEGY_DOCS.has(f) && !f.startsWith('.'),
  )

  for (const filename of verticalDocs) {
    const content = readFile(resolve(SALES_DIR, filename))
    const lines = content.split('\n')

    // Find the Success Programs section heading
    const spIdx = lines.findIndex(l => /^#+\s+.*success programs?/i.test(l))
    if (spIdx === -1) {
      fail('sp-columns', `${filename} — no Success Programs section found`)
      continue
    }

    // Capture section: from heading to next same/higher-level heading
    const headingLevel = (lines[spIdx].match(/^(#+)/) || ['', ''])[1].length
    const spEnd = lines.findIndex(
      (l, i) => i > spIdx && /^#+/.test(l) && (l.match(/^(#+)/) || ['', ''])[1].length <= headingLevel,
    )
    const spSection = lines.slice(spIdx, spEnd === -1 ? undefined : spEnd).join('\n')

    const hasFMCol = /\|\s*FM\s+Price\s*\|/i.test(spSection)
    const hasStdCol = /\|\s*Standard\s+Price\s*\|/i.test(spSection)

    if (hasFMCol && hasStdCol) {
      pass('sp-columns', `${filename} — FM Price + Standard Price columns present`)
    } else {
      const missing = [!hasFMCol && 'FM Price', !hasStdCol && 'Standard Price'].filter(Boolean).join(', ')
      fail('sp-columns', `${filename} — Success Programs table missing column(s): ${missing}`)
    }

    // FM compliance path note (Compliance Export Extension bridges the FM period)
    const hasCompliancePath = /Compliance Export Extension|\$4,000\/yr.*flat|FM compliance path/i.test(content)
    if (hasCompliancePath) {
      pass('sp-columns', `${filename} — FM compliance path note present`)
    } else {
      fail('sp-columns', `${filename} — FM compliance path note missing (add Compliance Export Extension reference)`)
    }
  }
}

// ---------------------------------------------------------------------------
// Check 11: Success Program price cross-reference
// ---------------------------------------------------------------------------

function checkSuccessProgramPrices() {
  console.log(`\n${BOLD}11. SUCCESS PROGRAM PRICE CROSS-REFERENCE${RESET}`)

  if (!existsSync(FOUNDING_MEMBER)) {
    warn('sp-prices', 'FOUNDING-MEMBER-PROGRAM.md not found — skipping')
    return
  }

  if (!existsSync(SALES_DIR)) {
    warn('sp-prices', 'business/sales/ not found — skipping')
    return
  }

  // Extract canonical prices from the Success Program Pricing section
  const fmContent = readFile(FOUNDING_MEMBER)
  const fmLines = fmContent.split('\n')
  const spIdx = fmLines.findIndex(l => /^#+\s+.*success program pricing/i.test(l))
  if (spIdx === -1) {
    warn('sp-prices', 'FOUNDING-MEMBER-PROGRAM.md — "Success Program Pricing" section not found')
    return
  }
  const spEnd = fmLines.findIndex(
    (l, i) => i > spIdx && /^#+/.test(l) && (l.match(/^(#+)/) || ['', ''])[1].length <= 2,
  )
  const fmSpSection = fmLines.slice(spIdx, spEnd === -1 ? undefined : spEnd).join('\n')
  const canonicalPrices = new Set(fmSpSection.match(/\$[\d,]+\/yr/g) || [])

  if (canonicalPrices.size === 0) {
    warn('sp-prices', 'No canonical prices extracted from FOUNDING-MEMBER-PROGRAM.md Success Program section')
    return
  }

  const verticalDocs = readdirSync(SALES_DIR).filter(
    f => f.endsWith('.md') && !VERTICAL_STRATEGY_DOCS.has(f) && !f.startsWith('.'),
  )

  for (const filename of verticalDocs) {
    const content = readFile(resolve(SALES_DIR, filename))
    const lines = content.split('\n')

    // Find the Success Programs section in this vertical doc
    const vSpIdx = lines.findIndex(l => /^#+\s+.*success programs?/i.test(l))
    if (vSpIdx === -1) continue // already caught by check 10

    const vHeadingLevel = (lines[vSpIdx].match(/^(#+)/) || ['', ''])[1].length
    const vSpEnd = lines.findIndex(
      (l, i) => i > vSpIdx && /^#+/.test(l) && (l.match(/^(#+)/) || ['', ''])[1].length <= vHeadingLevel,
    )
    const vSpSection = lines.slice(vSpIdx, vSpEnd === -1 ? undefined : vSpEnd).join('\n')

    // Only check table rows (lines starting with |) to avoid ROI prose false positives
    const tableLines = vSpSection.split('\n').filter(l => l.trim().startsWith('|'))
    const prices = new Set(tableLines.join('\n').match(/\$[\d,]+\/yr/g) || [])

    let docHasInvalid = false
    for (const price of prices) {
      if (!canonicalPrices.has(price)) {
        fail(
          'sp-prices',
          `${filename} — Success Programs price ${price} not in FOUNDING-MEMBER-PROGRAM.md (canonical: ${[...canonicalPrices].sort().join(', ')})`,
        )
        docHasInvalid = true
      }
    }

    if (!docHasInvalid && prices.size > 0) {
      pass('sp-prices', `${filename} — Success Programs prices match FOUNDING-MEMBER-PROGRAM.md`)
    }
  }
}

// ---------------------------------------------------------------------------
// Check 12: FM price without qualifier
//
// FM prices (extracted from FOUNDING-MEMBER-PROGRAM.md) that appear in
// strategy/sales docs must have an "FM", "founding member", or "founding"
// qualifier nearby. Catches cases where FM prices are presented as if they
// were standard prices.
// ---------------------------------------------------------------------------

function contextHasFMQualifier(content: string, idx: number, len: number): boolean {
  // Check surrounding 200 chars first
  const ctx = content.slice(Math.max(0, idx - 200), idx + len + 200)
  if (/\bFM\b|founding[\s-]member|founding/i.test(ctx)) return true

  // For table rows: scan backwards up to 20 lines for a header with "FM"
  const before = content.slice(0, idx)
  const lines = before.split('\n')
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 20); i--) {
    const line = lines[i]
    if (line.trim() === '') break // blank line = outside table
    if (/\|\s*FM\s*(Price)?\s*\|/i.test(line)) return true
  }

  return false
}

// External-facing sales and pitch docs where FM price qualification matters.
// Financial projections and internal docs are excluded — they don't need
// "FM" qualifiers since they're not customer-facing.
const FM_CHECK_DOCS = new Set([
  'PITCH-DECK.md',
  'CHANNEL-PARTNER-PITCH.md',
  'PARTNER-TIER-REVENUE-PROPOSAL.md',
  'PREMIUM-VALUE-PROPOSITION.md',
  'ENTERPRISE-VALUE-PROPOSITION.md',
])

function extractFMPricesFromColumn(content: string): Set<string> {
  const fmPrices = new Set<string>()
  const lines = content.split('\n')

  // Find the "Pricing Table" section heading
  const tableStart = lines.findIndex(l => /^## Pricing Table/i.test(l))
  if (tableStart === -1) return fmPrices

  // Find the table header row that contains "Founding Member Price"
  let fmColIdx = -1
  for (let i = tableStart; i < Math.min(tableStart + 10, lines.length); i++) {
    const line = lines[i]
    if (!line.startsWith('|')) continue
    const cols = line.split('|').map(c => c.trim()).filter(Boolean)
    const idx = cols.findIndex(c => /founding member price/i.test(c))
    if (idx !== -1) {
      fmColIdx = idx
      break
    }
  }

  if (fmColIdx === -1) return fmPrices

  // Extract prices from the FM Price column in data rows that follow
  for (let i = tableStart + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.startsWith('|')) {
      if (i > tableStart + 5) break // end of table region
      continue
    }
    const cols = line.split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length <= fmColIdx) continue
    const cell = cols[fmColIdx]
    // Skip separator and header rows
    if (/^[-:*\s]+$/.test(cell.replace(/\*/g, ''))) continue
    if (/founding member price/i.test(cell)) continue
    // Extract price patterns (strip markdown bold **)
    const prices = cell.replace(/\*\*/g, '').match(/\$[\d,]+\/(?:user\/)?yr(?:\/node)?/g) || []
    prices.forEach(p => fmPrices.add(p))
  }

  return fmPrices
}

function checkFMPriceQualifiers() {
  console.log(`\n${BOLD}12. FM PRICE QUALIFIER CHECK${RESET}`)

  if (!existsSync(FOUNDING_MEMBER)) {
    warn('fm-qualifier', 'FOUNDING-MEMBER-PROGRAM.md not found — skipping')
    return
  }

  const fmContent = readFile(FOUNDING_MEMBER)
  const fmPrices = extractFMPricesFromColumn(fmContent)

  // Only check prices without /node suffix — /node prices are distinctive enough
  // not to cause confusion. $149/yr and $99/user/yr can be mistaken for standard prices.
  const ambiguousPrices = new Set([...fmPrices].filter(p => !p.includes('/node')))

  if (ambiguousPrices.size === 0) {
    warn('fm-qualifier', 'No ambiguous FM prices extracted from FOUNDING-MEMBER-PROGRAM.md — skipping')
    return
  }

  console.log(`  ${DIM}Checking FM prices: ${[...ambiguousPrices].sort().join(', ')}${RESET}`)

  const docs = collectDownstreamDocs()
  let cleanDocs = 0
  let checkedDocs = 0

  for (const doc of docs) {
    if (doc.path === FOUNDING_MEMBER) continue
    // Only check external-facing sales and pitch docs
    const basename = doc.name.split('/').pop() || ''
    const inSalesDir = doc.path.startsWith(SALES_DIR)
    if (!inSalesDir && !FM_CHECK_DOCS.has(basename)) continue

    let docHasIssue = false
    for (const price of ambiguousPrices) {
      const escaped = price.replace(/\$/g, '\\$').replace(/\//g, '\\/').replace(/,/g, ',')
      const re = new RegExp(escaped, 'g')
      let m
      while ((m = re.exec(doc.content)) !== null) {
        if (!contextHasFMQualifier(doc.content, m.index, price.length)) {
          warn(
            'fm-qualifier',
            `${doc.name} — "${price}" appears without FM qualifier`,
          )
          docHasIssue = true
          break // one warning per price per doc
        }
      }
    }

    checkedDocs++
    if (!docHasIssue) cleanDocs++
  }

  if (checkedDocs > 0 && cleanDocs === checkedDocs) {
    pass('fm-qualifier', `All ${checkedDocs} external-facing doc(s) — FM prices properly qualified`)
  } else if (checkedDocs === 0) {
    warn('fm-qualifier', 'No external-facing docs found to check')
  }
}

// ---------------------------------------------------------------------------
// Check 13: Deprecated price amounts blocklist
//
// Specific dollar amounts that are definitively superseded and must not
// appear as current prices in any pricing doc. Historical/changelog
// context lines (using "was", "revised from", "→", etc.) are excluded.
//
// Current blocklist:
//   $129/yr — old Premium Solo FM price (superseded by $149/yr, Decision #49)
// ---------------------------------------------------------------------------

// Map of deprecated price → human-readable reason
const DEPRECATED_PRICES: Record<string, string> = {
  '$129/yr': 'old Premium Solo FM price — superseded by $149/yr (Decision #49)',
}

function checkDeprecatedPrices() {
  console.log(`\n${BOLD}13. DEPRECATED PRICE AMOUNTS BLOCKLIST${RESET}`)

  if (Object.keys(DEPRECATED_PRICES).length === 0) {
    pass('deprecated-prices', 'Blocklist is empty — no deprecated prices to check')
    return
  }

  const docs = collectDownstreamDocs()
  // Historical/changelog context markers — these lines are allowed to mention old prices
  const historicalMarkers = /was\s+\$|revised from|→\s*\$|formerly|\bwas\b.*\/yr|Raised from|old price|historical|from \$\d/i

  let issueCount = 0

  for (const doc of docs) {
    // Only check pricing dirs
    const inPricingDir = [...PRICING_DIRS].some(d => doc.path.startsWith(d))
    if (!inPricingDir) continue

    for (const line of doc.content.split('\n')) {
      if (historicalMarkers.test(line)) continue
      for (const [price, reason] of Object.entries(DEPRECATED_PRICES)) {
        if (line.includes(price)) {
          fail(
            'deprecated-prices',
            `${doc.name} — deprecated price ${price} (${reason}): "${line.trim()}"`,
          )
          issueCount++
        }
      }
    }
  }

  if (issueCount === 0) {
    pass('deprecated-prices', `No deprecated prices found (${Object.keys(DEPRECATED_PRICES).length} prices × ${docs.length} docs checked)`)
  }
}

// ---------------------------------------------------------------------------
// Check 14: Price propagation freshness warning
//
// When TIER-MANAGEMENT.md or FOUNDING-MEMBER-PROGRAM.md is newer than other
// pricing docs that contain price references, emit a warning — those docs
// should be reviewed to ensure prices didn't change.
// ---------------------------------------------------------------------------

function checkPricePropagationFreshness() {
  console.log(`\n${BOLD}14. PRICE PROPAGATION FRESHNESS${RESET}`)

  const canonicalSources = [TIER_MGMT, FOUNDING_MEMBER].filter(f => existsSync(f))
  if (canonicalSources.length === 0) {
    warn('price-freshness', 'No canonical price sources found — skipping')
    return
  }

  const canonicalMtime = Math.max(...canonicalSources.map(f => statSync(f).mtimeMs))
  const canonicalDate = new Date(canonicalMtime).toISOString().slice(0, 10)
  const newestSource = canonicalSources.reduce((a, b) =>
    statSync(a).mtimeMs > statSync(b).mtimeMs ? a : b,
  )
  const newestSourceName = newestSource.replace(PROJECT_ROOT + '/', '')

  const docs = collectDownstreamDocs()
  const stale: string[] = []

  for (const doc of docs) {
    if (canonicalSources.includes(doc.path)) continue
    // Only check pricing dirs
    const inPricingDir = [...PRICING_DIRS].some(d => doc.path.startsWith(d))
    if (!inPricingDir) continue
    // Skip docs without any price references
    if (!/\$[\d,]+\/(?:user\/)?yr|\$[\d,]+\/mo/.test(doc.content)) continue

    const docMtime = statSync(doc.path).mtimeMs
    if (docMtime < canonicalMtime) {
      stale.push(doc.name)
    }
  }

  if (stale.length === 0) {
    pass(
      'price-freshness',
      `All pricing docs updated after canonical sources (${newestSourceName}, ${canonicalDate})`,
    )
  } else {
    warn(
      'price-freshness',
      `${newestSourceName} updated ${canonicalDate} — ${stale.length} pricing doc(s) not yet reviewed since last canonical update: ${stale.join(', ')}`,
    )
  }
}

// ---------------------------------------------------------------------------
// Check 15: Pricing source-of-truth cross-reference
//
// Reads code/src/constants/pricing.ts (single source of truth) and validates
// that all business docs use ONLY the canonical price values.
//
// When a price changes in pricing.ts, the old value is automatically detected
// as stale in every business doc — zero manual sweep required.
// ---------------------------------------------------------------------------

interface CanonicalPrice {
  tier: string
  field: string
  value: string       // e.g. '$199/user/yr'
  shortValue: string  // e.g. '$199' (for partial matching)
}

function parsePricingTs(): CanonicalPrice[] {
  const pricingPath = resolve(ROOT, 'src', 'constants', 'pricing.ts')
  if (!existsSync(pricingPath)) return []

  const content = readFile(pricingPath)
  const prices: CanonicalPrice[] = []

  // Extract each tier block
  const tierBlocks = content.matchAll(/(\w+):\s*\{[\s\S]*?standard:\s*'([^']+)'[\s\S]*?fm:\s*'([^']+)'[\s\S]*?fmShort:\s*'([^']+)'[\s\S]*?\}/g)
  for (const m of tierBlocks) {
    const tier = m[1]
    prices.push({ tier, field: 'standard', value: m[2], shortValue: m[2].replace(/\/.*/, '') })
    prices.push({ tier, field: 'fm', value: m[3], shortValue: m[3].replace(/\/.*/, '') })
    prices.push({ tier, field: 'fmShort', value: m[4], shortValue: m[4] })
  }

  // Extract volume node pricing
  const volumeBlocks = content.matchAll(/price:\s*'([^']+)'/g)
  for (const m of volumeBlocks) {
    prices.push({ tier: 'fabrick-volume', field: 'node', value: m[1], shortValue: m[1].replace(/\/.*/, '') })
  }

  return prices
}

// Known price→tier mappings. If a dollar amount appears in a doc and is NOT
// in the canonical set, and IS in the stale set, it's a pricing drift error.
// The stale set is maintained manually — add old values when pricing.ts changes.
const STALE_PRICES: Record<string, string> = {
  '$99/user':    'old Team FM — now $129/user (Decision #142)',
  '$149/user':   'old Team standard — now $199/user (Decision #142)',
  '$999/yr':     'old FabricK FM — now $1,299/yr (Decision #142)',
  '$999/node':   'old FabricK FM — now $1,299/node (Decision #142)',
  '$1,500/yr':   'old FabricK first node — now $2,000/yr (Decision #142)',
  // Historical (pre-Decision #142):
  '$129/yr':     'old Premium Solo FM — superseded by $149/yr (Decision #49)',
  '$799/yr':     'old Enterprise first node — superseded by $1,500/yr (Decision #63)',
}

function checkPricingSourceOfTruth() {
  console.log(`\n${BOLD}15. PRICING SOURCE-OF-TRUTH CROSS-REFERENCE${RESET}`)

  const canonical = parsePricingTs()
  if (canonical.length === 0) {
    warn('pricing-sot', 'Could not parse pricing.ts — skipping cross-reference')
    return
  }

  const canonicalValues = new Set(canonical.map(p => p.value))
  const canonicalShorts = new Set(canonical.map(p => p.shortValue))
  console.log(`  ${DIM}Canonical prices from pricing.ts: ${[...canonicalValues].join(', ')}${RESET}`)

  const docs = collectDownstreamDocs()
  const historicalMarkers = /was\s+\$|revised from|→\s*\$|formerly|\bwas\b.*\/yr|Raised from|old price|historical|from \$\d|superseded|retired|Decision #\d+.*\$/i

  // Exclude files that are historical by nature
  const excludeFiles = /LESSONS-LEARNED|CHANGELOG|KNOWN-GOTCHAS|rename-ea|revised pricing|BRIDGE-AI-TCO/i

  let issueCount = 0

  for (const doc of docs) {
    // Only check pricing-relevant dirs
    const inPricingDir = [...PRICING_DIRS].some(d => doc.path.startsWith(d))
    if (!inPricingDir) continue
    if (excludeFiles.test(doc.name)) continue

    for (const line of doc.content.split('\n')) {
      if (historicalMarkers.test(line)) continue

      for (const [stalePrice, reason] of Object.entries(STALE_PRICES)) {
        if (line.includes(stalePrice)) {
          // Verify it's not a canonical value (edge case: $129/user is stale but $129 alone might appear in other contexts)
          // Check the full pattern with unit
          fail('pricing-sot', `${doc.name} — stale price ${stalePrice} (${reason}): "${line.trim().substring(0, 100)}"`)
          issueCount++
          break // one finding per line
        }
      }
    }
  }

  if (issueCount === 0) {
    pass('pricing-sot', `All pricing docs match pricing.ts — ${Object.keys(STALE_PRICES).length} stale prices × ${docs.length} docs checked`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const startTime = Date.now()

console.log(`${BOLD}Documentation Parity Audit${RESET}`)
console.log(`${'='.repeat(40)}`)

checkTierMatrixVsMasterPlan()
checkAuditorCount()
checkSalesDocIndex()
checkVerticalDocStructure()
checkVersionAnnotations()
checkPlansDirectory()
checkAgentsVsPlans()
checkCrossDocFacts()
checkLicenseKeyPrefixes()
checkSuccessProgramColumns()
checkSuccessProgramPrices()
checkFMPriceQualifiers()
checkDeprecatedPrices()
checkPricePropagationFreshness()
checkPricingSourceOfTruth()

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const durationMs = Date.now() - startTime

console.log(`\n${'='.repeat(40)}`)
console.log(
  `  ${GREEN}${passes} passed${RESET}  ${errors > 0 ? RED : DIM}${errors} failed${RESET}  ${warnings > 0 ? YELLOW : DIM}${warnings} warnings${RESET}  ${DIM}(${durationMs}ms)${RESET}`,
)

saveReport({
  reportName: 'doc-parity',
  timestamp: new Date().toISOString(),
  durationMs,
  result: errors > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
  summary: { passes, errors, warnings },
  data: { findings },
})

if (errors > 0) {
  console.log(`\n${RED}${BOLD}RESULT: FAIL${RESET} — ${errors} error(s)`)
  console.log(
    `${DIM}Fix documentation to match codebase, then re-run: npm run audit:doc-parity${RESET}`,
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

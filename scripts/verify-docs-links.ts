// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * verify-docs-links.ts — Build-time docs link integrity auditor.
 *
 * Validates that all links in bundled documentation resolve correctly.
 * Runs in prebuild (blocks dev/build on failure) and in test:compliance.
 *
 * Checks:
 *   1. Registry parity — DocsPage imports ↔ fileToSlug ↔ slugToPath in sync
 *   2. File existence — every registered doc exists on disk (current + snapshots)
 *   3. Cross-doc links — every [text](file.md) maps to a registered slug
 *   4. Anchor resolution — every file.md#anchor resolves to a heading
 *   5. Internal anchors — every #anchor resolves within same doc
 *   6. Snapshot completeness — every docs/vX.Y/ has all bundled docs
 *   7. Version tag validity — *Available: vX.Y+* tags reference delivery versions
 *
 * Usage:  npx tsx scripts/verify-docs-links.ts
 * Exit:   0 = all pass, 1 = errors found
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, relative, basename } from 'path'
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
// Registry — must match DocsPage.vue exactly
// ---------------------------------------------------------------------------

/** Map from slug to relative path within docs/ (or repo root for ATTRIBUTION.md) */
const slugToPath: Record<string, string> = {
  'admin-guide': 'docs/ADMIN-GUIDE.md',
  'user-guide': 'docs/USER-GUIDE.md',
  'production-deployment': 'docs/PRODUCTION-DEPLOYMENT.md',
  'security-baselines': 'docs/security/SECURITY-BASELINES.md',
  'nist-800-171': 'docs/security/compliance/NIST-800-171-MAPPING.md',
  'hipaa-164-312': 'docs/security/compliance/HIPAA-164-312-MAPPING.md',
  'pci-dss': 'docs/security/compliance/PCI-DSS-MAPPING.md',
  'cis-benchmarks': 'docs/security/compliance/CIS-BENCHMARK-ALIGNMENT.md',
  'cis-controls': 'docs/security/compliance/CIS-CONTROLS-MAPPING.md',
  'soc2-readiness': 'docs/security/compliance/SOC2-READINESS.md',
  'runbook-cache-key-compromise': 'docs/operations/cache-key-compromise-runbook.md',
  'policy-cache-key-retirement': 'docs/operations/cache-key-retirement-policy.md',
  'attribution': 'ATTRIBUTION.md',
  'terms-of-service': 'docs/legal/TERMS-OF-SERVICE.md',
  'production-deployment': 'docs/PRODUCTION-DEPLOYMENT.md',
  'compatibility': 'docs/COMPATIBILITY.md',
}

/** Map from filename to slug (for resolving cross-doc links) */
const fileToSlug: Record<string, string> = {}
for (const [slug, path] of Object.entries(slugToPath)) {
  fileToSlug[basename(path)] = slug
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Slugify heading text — matches GitHub-flavored markdown anchor format.
 *  GitHub does NOT collapse double hyphens: "Tags & Organization" → "tags--organization".
 *  This must match DocsPage.vue's runtime slugify exactly. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s/g, '-')
    .trim()
}

/** Extract all heading slugs from a markdown file. */
function extractHeadingSlugs(content: string): Set<string> {
  const slugs = new Set<string>()
  const lines = content.split('\n')
  for (const line of lines) {
    const match = line.match(/^#{1,6}\s+(.+)$/)
    if (match) {
      slugs.add(slugify(match[1].trim()))
    }
  }
  return slugs
}

/** Extract all markdown links from content. Returns array of { target, anchor, line }. */
function extractLinks(content: string): Array<{ target: string; anchor?: string; line: number }> {
  const links: Array<{ target: string; anchor?: string; line: number }> = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    // Match [text](target) — but not images ![alt](src)
    const linkRegex = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g
    let match
    while ((match = linkRegex.exec(lines[i])) !== null) {
      const href = match[2]
      // Skip external links (http/https/mailto)
      if (/^(https?:|mailto:)/.test(href)) continue

      if (href.startsWith('#')) {
        // Internal anchor
        links.push({ target: '', anchor: href.slice(1), line: i + 1 })
      } else if (/\.md($|#)/i.test(href)) {
        // Cross-doc .md link
        const [filePart, anchor] = href.split('#')
        const filename = basename(filePart)
        links.push({ target: filename, anchor, line: i + 1 })
      }
    }
  }
  return links
}

/** Get all version snapshot directories. */
function getSnapshotVersions(): string[] {
  const docsDir = resolve(ROOT, 'docs')
  if (!existsSync(docsDir)) return []
  return readdirSync(docsDir)
    .filter(d => /^v\d+\.\d+$/.test(d) && statSync(resolve(docsDir, d)).isDirectory())
    .sort()
}

/** Load DELIVERY.json versions. */
function getDeliveryVersions(): Set<string> {
  const deliveryPath = resolve(ROOT, '..', 'forge', 'DELIVERY.json')
  if (!existsSync(deliveryPath)) return new Set()
  const delivery = JSON.parse(readFileSync(deliveryPath, 'utf-8'))
  return new Set((delivery.versions as Array<{ version: string }>).map(v => {
    // "1.0.0" → "1.0" for matching *Available: v1.0+* tags
    const parts = v.version.split('.')
    return `${parts[0]}.${parts[1]}`
  }))
}

// ---------------------------------------------------------------------------
// Check 1: Registry parity — verify DocsPage.vue matches our registry
// ---------------------------------------------------------------------------

const CHECK_REGISTRY = 'Registry parity'

const docsPagePath = resolve(ROOT, 'src/pages/DocsPage.vue')
if (existsSync(docsPagePath)) {
  const docsPageContent = readFileSync(docsPagePath, 'utf-8')

  // Extract raw imports
  const importRegex = /import\s+\w+\s+from\s+['"]\.\.\/\.\.\/(.+\.md)\?raw['"]/g
  const importedPaths = new Set<string>()
  let importMatch
  while ((importMatch = importRegex.exec(docsPageContent)) !== null) {
    importedPaths.add(importMatch[1])
  }

  // Check each registry entry is imported
  for (const [slug, relPath] of Object.entries(slugToPath)) {
    if (!importedPaths.has(relPath)) {
      warn(CHECK_REGISTRY, 'DocsPage.vue', `Slug '${slug}' → '${relPath}' not found in imports`)
    }
  }

  // Check each import is in registry
  for (const imp of importedPaths) {
    const filename = basename(imp)
    if (!fileToSlug[filename]) {
      fail(CHECK_REGISTRY, 'DocsPage.vue', `Import '${imp}' has no fileToSlug entry for '${filename}'`)
    }
  }
}

// ---------------------------------------------------------------------------
// Check 2: File existence — all registered docs exist on disk
// ---------------------------------------------------------------------------

const CHECK_EXISTENCE = 'File existence'

for (const [slug, relPath] of Object.entries(slugToPath)) {
  const absPath = resolve(ROOT, relPath)
  if (!existsSync(absPath)) {
    fail(CHECK_EXISTENCE, relPath, `Registered doc '${slug}' not found at ${relPath}`)
  }
}

// ---------------------------------------------------------------------------
// Checks 3-5: Link validation in current docs
// ---------------------------------------------------------------------------

const CHECK_CROSSDOC = 'Cross-doc links'
const CHECK_ANCHOR_CROSS = 'Anchor resolution (cross-doc)'
const CHECK_ANCHOR_INTERNAL = 'Internal anchors'

function validateDocLinks(relPath: string, label: string) {
  const absPath = resolve(ROOT, relPath)
  if (!existsSync(absPath)) return

  const content = readFileSync(absPath, 'utf-8')
  const links = extractLinks(content)
  const selfSlugs = extractHeadingSlugs(content)

  for (const link of links) {
    if (!link.target && link.anchor) {
      // Internal anchor
      if (!selfSlugs.has(link.anchor)) {
        fail(CHECK_ANCHOR_INTERNAL, `${label}/${basename(relPath)}`, `#${link.anchor} — heading not found in this document`, link.line)
      }
    } else if (link.target) {
      // Cross-doc link
      const targetSlug = fileToSlug[link.target]
      if (!targetSlug) {
        fail(CHECK_CROSSDOC, `${label}/${basename(relPath)}`, `${link.target} — not in docs registry`, link.line)
      } else if (link.anchor) {
        // Cross-doc anchor — resolve in target file
        const targetPath = resolve(ROOT, slugToPath[targetSlug])
        if (existsSync(targetPath)) {
          const targetContent = readFileSync(targetPath, 'utf-8')
          const targetSlugs = extractHeadingSlugs(targetContent)
          if (!targetSlugs.has(link.anchor)) {
            fail(CHECK_ANCHOR_CROSS, `${label}/${basename(relPath)}`, `${link.target}#${link.anchor} — heading not found in target`, link.line)
          }
        }
      }
    }
  }
}

// Validate current docs
for (const [, relPath] of Object.entries(slugToPath)) {
  validateDocLinks(relPath, 'current')
}

// ---------------------------------------------------------------------------
// Check 6: Snapshot completeness
// ---------------------------------------------------------------------------

const CHECK_SNAPSHOT = 'Snapshot completeness'

const snapshots = getSnapshotVersions()
const requiredFiles = Object.values(slugToPath).map(p => {
  // For snapshots, paths are relative to docs/vX.Y/
  if (p.startsWith('docs/')) return p.slice(5) // strip "docs/" prefix
  return p // ATTRIBUTION.md stays at root of snapshot
})

for (const ver of snapshots) {
  const snapshotDir = resolve(ROOT, 'docs', ver)
  for (const reqFile of requiredFiles) {
    const fullPath = resolve(snapshotDir, reqFile)
    if (!existsSync(fullPath)) {
      fail(CHECK_SNAPSHOT, `docs/${ver}`, `Missing: ${reqFile}`)
    }
  }

  // Also validate links within each snapshot
  for (const [, relPath] of Object.entries(slugToPath)) {
    const snapshotFile = relPath.startsWith('docs/')
      ? resolve(snapshotDir, relPath.slice(5))
      : resolve(snapshotDir, relPath)

    if (existsSync(snapshotFile)) {
      // For snapshots, validate against the snapshot's own files
      const content = readFileSync(snapshotFile, 'utf-8')
      const links = extractLinks(content)

      for (const link of links) {
        if (link.target) {
          if (!fileToSlug[link.target]) {
            fail(CHECK_CROSSDOC, `docs/${ver}/${basename(snapshotFile)}`, `${link.target} — not in docs registry`, link.line)
          }
        }
        if (!link.target && link.anchor) {
          const selfSlugs = extractHeadingSlugs(content)
          if (!selfSlugs.has(link.anchor)) {
            fail(CHECK_ANCHOR_INTERNAL, `docs/${ver}/${basename(snapshotFile)}`, `#${link.anchor} — heading not found`, link.line)
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check 7: Version tag validity (current docs only)
// ---------------------------------------------------------------------------

const CHECK_VERSION_TAGS = 'Version tag validity'
const deliveryVersions = getDeliveryVersions()

for (const [, relPath] of Object.entries(slugToPath)) {
  const absPath = resolve(ROOT, relPath)
  if (!existsSync(absPath)) continue

  const content = readFileSync(absPath, 'utf-8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const tagMatch = lines[i].match(/\*Available:\s*v?([\d.]+)\+/)
    if (tagMatch) {
      const ver = tagMatch[1]
      // Normalize to major.minor
      const parts = ver.split('.')
      const normalized = `${parts[0]}.${parts[1] ?? '0'}`
      if (!deliveryVersions.has(normalized)) {
        warn(CHECK_VERSION_TAGS, basename(relPath), `*Available: v${ver}+* — version not in DELIVERY.json`, i + 1)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const checks = [CHECK_REGISTRY, CHECK_EXISTENCE, CHECK_CROSSDOC, CHECK_ANCHOR_CROSS, CHECK_ANCHOR_INTERNAL, CHECK_SNAPSHOT, CHECK_VERSION_TAGS]
const errors = issues.filter(i => i.severity === 'error')
const warnings = issues.filter(i => i.severity === 'warn')

console.log(`\n${BOLD}Docs Link Integrity Report${RESET}`)
console.log('==========================\n')

if (snapshots.length > 0) {
  console.log(`Snapshots: ${snapshots.join(', ')}`)
} else {
  console.log(`Snapshots: ${DIM}none${RESET}`)
}
console.log(`Registered docs: ${Object.keys(slugToPath).length}`)
console.log('')

for (const check of checks) {
  const checkIssues = issues.filter(i => i.check === check)
  const checkErrors = checkIssues.filter(i => i.severity === 'error')
  const checkWarns = checkIssues.filter(i => i.severity === 'warn')

  if (checkErrors.length > 0) {
    console.log(`${RED}FAIL${RESET}  ${check} (${checkErrors.length} error${checkErrors.length > 1 ? 's' : ''})`)
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

if (errors.length > 0) {
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${errors.length} error(s)\n`)
} else if (warnings.length > 0) {
  console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} ${DIM}(${warnings.length} warning(s))${RESET}\n`)
} else {
  console.log(`${GREEN}${BOLD}RESULT: PASS${RESET}\n`)
}

saveReport({
  reportName: 'docs-links',
  timestamp: new Date().toISOString(),
  durationMs: Date.now() - startTime,
  result: errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
  summary: {
    errors: errors.length,
    warnings: warnings.length,
    checks: checks.length,
    snapshots: snapshots.length,
    registeredDocs: Object.keys(slugToPath).length,
  },
  data: issues,
})

process.exit(errors.length > 0 ? 1 : 0)

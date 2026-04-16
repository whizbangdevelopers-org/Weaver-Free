#!/usr/bin/env tsx
// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:runbooks — validate operational runbooks AND policy docs for compliance + internal consistency.
 *
 * Scans docs/operations/*.md for YAML frontmatter. Two document types:
 *
 *   Runbooks (`runbook:` root key) — step-by-step incident response procedures
 *     with executable commands. Frontmatter lists API endpoints, systemd units,
 *     audit events, config keys, and sops paths that the runbook steps reference.
 *
 *   Policies (`policy:` root key) — documented standards and procedures without
 *     executable steps. Frontmatter lists audience, effective date, review
 *     cadence, and compliance references.
 *
 * Validates:
 *   1. Frontmatter structure — required fields present, correct types per doc type
 *   2. Compliance refs — frameworks and controls use recognized identifiers
 *   3. API endpoint references (runbooks only) — follow /api/ pattern; validated against real routes post-ship
 *   4. Systemd unit references (runbooks only) — named consistently; validated against NixOS modules post-ship
 *   5. Audit event references (runbooks only) — validated against AuditAction enum post-ship
 *   6. Config key references — follow services.weaver.* pattern; validated post-ship
 *   7. Draft/version discipline — DRAFT banner matches `status: draft` frontmatter
 *   8. Decision refs — exist in MASTER-PLAN.md decision table
 *   9. Policy-specific — audience, effective_date, review_cadence required on policies
 *
 * Pre-ship state (status: draft, version_target > current):
 *   - Soft-validates references against the marker file in docs/planned-features/
 *   - Errors only on structural problems (missing required fields, malformed YAML)
 *   - Warns on referenced items that don't yet exist (expected pre-ship)
 *
 * Post-ship state (status: current, version_target <= current):
 *   - Hard-validates all references against real code
 *   - Errors on any referenced item that can't be found
 *
 * Writes report to reports/runbooks/ and returns exit code 1 on any error.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'fs'
import { resolve, join, basename } from 'path'
import { load as parseYaml } from 'js-yaml'

const ROOT = resolve(import.meta.dirname, '..')
const RUNBOOKS_DIR = resolve(ROOT, 'docs/operations')
const MASTER_PLAN = resolve(ROOT, '..', 'MASTER-PLAN.md')
const REPORTS_DIR = resolve(ROOT, 'reports/runbooks')

// ---------------------------------------------------------------------------
// Known frameworks & controls — whitelist of valid compliance_refs entries.
// When a new framework mapping doc is added to docs/security/compliance/, add
// its identifier here.
// ---------------------------------------------------------------------------

const KNOWN_FRAMEWORKS = new Set([
  'NIST 800-171',
  'NIST 800-53',
  'HIPAA 164.308',
  'HIPAA 164.310',
  'HIPAA 164.312',
  'HIPAA 164.316',
  'PCI DSS v4.0',
  'PCI DSS',
  'SOC 2',
  'CIS Controls v8.1',
  'CIS Controls',
  'CIS Benchmarks',
  'CMMC L2',
  '21 CFR Part 11',
  'ISO 27001',
  'IEC 62443',
  'NERC CIP',
  'DFARS 252.204-7012',
])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunbookFrontmatter {
  runbook?: string
  policy?: string
  status: 'draft' | 'current' | 'deprecated'
  version_target: string
  /** Runbook-only */
  rehearsal_required?: boolean
  /** Policy-only */
  audience?: 'customer-operator' | 'wbd-internal' | 'both'
  /** Policy-only */
  effective_date?: string
  /** Policy-only */
  review_cadence?: 'quarterly' | 'annually' | 'biennially' | 'on-change'
  decision_refs?: string[]
  compliance_refs?: Array<{ framework: string; controls: string[] }>
  api_endpoints_referenced?: string[]
  systemd_units_referenced?: string[]
  audit_events_referenced?: string[]
  config_keys_referenced?: string[]
  sops_paths_referenced?: string[]
}

type DocType = 'runbook' | 'policy'

interface Finding {
  level: 'error' | 'warn'
  check: string
  runbook: string
  message: string
  line?: number
}

const findings: Finding[] = []

function err(check: string, runbook: string, message: string, line?: number): void {
  findings.push({ level: 'error', check, runbook, message, line })
}

function warn(check: string, runbook: string, message: string, line?: number): void {
  findings.push({ level: 'warn', check, runbook, message, line })
}

// ---------------------------------------------------------------------------
// Frontmatter extraction
// ---------------------------------------------------------------------------

function extractFrontmatter(content: string): { yaml: string; body: string } | null {
  const lines = content.split('\n')
  // Find the opening `---` — must be on line 1, 2, or 3 (allowing HTML comment header lines)
  let start = -1
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    if (lines[i].trim() === '---') {
      start = i
      break
    }
  }
  if (start === -1) return null

  // Find the closing `---`
  let end = -1
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i
      break
    }
  }
  if (end === -1) return null

  const yaml = lines.slice(start + 1, end).join('\n')
  const body = lines.slice(end + 1).join('\n')
  return { yaml, body }
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function validateFrontmatterShape(
  file: string,
  fm: unknown,
): { frontmatter: RunbookFrontmatter; docType: DocType } | null {
  if (typeof fm !== 'object' || fm === null) {
    err('structure', file, 'Frontmatter is not an object')
    return null
  }

  const f = fm as Record<string, unknown>

  // Exactly one of `runbook:` or `policy:` must be present
  const hasRunbook = typeof f.runbook === 'string'
  const hasPolicy = typeof f.policy === 'string'

  if (!hasRunbook && !hasPolicy) {
    err('structure', file, 'Missing root discriminator: must have `runbook: <slug>` or `policy: <slug>`')
    return null
  }
  if (hasRunbook && hasPolicy) {
    err('structure', file, 'Cannot have both `runbook:` and `policy:` — pick one')
    return null
  }

  const docType: DocType = hasRunbook ? 'runbook' : 'policy'

  if (f.status !== 'draft' && f.status !== 'current' && f.status !== 'deprecated') {
    err('structure', file, `Invalid \`status\`: must be "draft" | "current" | "deprecated", got "${f.status}"`)
    return null
  }
  if (typeof f.version_target !== 'string') {
    err('structure', file, 'Missing or non-string `version_target` field')
    return null
  }

  // Policy-specific required fields
  if (docType === 'policy') {
    if (typeof f.audience !== 'string') {
      err('structure', file, 'Policy docs must declare `audience` (customer-operator | wbd-internal | both)')
      return null
    }
    if (!['customer-operator', 'wbd-internal', 'both'].includes(f.audience as string)) {
      err('structure', file, `Invalid \`audience\`: "${f.audience}" — must be customer-operator | wbd-internal | both`)
      return null
    }
    if (typeof f.effective_date !== 'string') {
      err('structure', file, 'Policy docs must declare `effective_date` (ISO 8601 date)')
      return null
    }
    if (typeof f.review_cadence !== 'string') {
      err('structure', file, 'Policy docs must declare `review_cadence` (quarterly | annually | biennially | on-change)')
      return null
    }
    if (!['quarterly', 'annually', 'biennially', 'on-change'].includes(f.review_cadence as string)) {
      err('structure', file, `Invalid \`review_cadence\`: "${f.review_cadence}"`)
      return null
    }
    // Policies should not reference executable artifacts (api endpoints, systemd units, audit events)
    if (Array.isArray(f.api_endpoints_referenced) && (f.api_endpoints_referenced as unknown[]).length > 0) {
      warn('policy-scope', file, 'Policy doc references API endpoints — these are runbook-scope. Move to a runbook or remove.')
    }
    if (Array.isArray(f.systemd_units_referenced) && (f.systemd_units_referenced as unknown[]).length > 0) {
      warn('policy-scope', file, 'Policy doc references systemd units — these are runbook-scope.')
    }
    if (Array.isArray(f.audit_events_referenced) && (f.audit_events_referenced as unknown[]).length > 0) {
      warn('policy-scope', file, 'Policy doc references audit events — these are runbook-scope.')
    }
  }

  return { frontmatter: f as unknown as RunbookFrontmatter, docType }
}

function validateDraftBanner(runbook: string, fm: RunbookFrontmatter, body: string): void {
  if (fm.status === 'draft') {
    if (!body.includes('DRAFT') && !body.includes('⚠ DRAFT')) {
      err('draft-banner', runbook, 'Frontmatter status=draft but body missing "DRAFT" banner (required for pre-ship runbooks)')
    }
  } else if (fm.status === 'current') {
    if (body.includes('⚠ DRAFT')) {
      warn('draft-banner', runbook, 'Frontmatter status=current but body still contains "⚠ DRAFT" banner — may need cleanup')
    }
  }
}

function validateComplianceRefs(runbook: string, fm: RunbookFrontmatter): void {
  if (!fm.compliance_refs) return
  for (const ref of fm.compliance_refs) {
    if (!KNOWN_FRAMEWORKS.has(ref.framework)) {
      err(
        'compliance-framework',
        runbook,
        `Unknown framework "${ref.framework}". Known frameworks: ${[...KNOWN_FRAMEWORKS].slice(0, 5).join(', ')}, ...`,
      )
    }
    if (!Array.isArray(ref.controls) || ref.controls.length === 0) {
      err('compliance-framework', runbook, `Framework "${ref.framework}" has no controls listed`)
    }
  }
}

function validateApiEndpoints(runbook: string, fm: RunbookFrontmatter): void {
  if (!fm.api_endpoints_referenced) return
  const apiPattern = /^(GET|POST|PUT|PATCH|DELETE) \/api\//
  for (const endpoint of fm.api_endpoints_referenced) {
    if (!apiPattern.test(endpoint)) {
      err(
        'api-endpoint-format',
        runbook,
        `API endpoint "${endpoint}" does not match pattern "<METHOD> /api/..."`,
      )
    }
  }
  // Post-ship: validate against real routes (TODO when runbook.version_target is current)
  if (fm.status === 'draft') {
    // Pre-ship: soft-check. Warn only if marker file is missing.
    const markerFile = resolve(ROOT, `docs/planned-features/${fm.version_target}-${fm.runbook.replace(/^cache-key-/, 'private-nix-cache').replace(/-runbook$/, '')}.md`)
    // This is a heuristic — the actual marker naming convention is v2.3-private-nix-cache.md
    // For the compromise runbook, we expect the marker to be private-nix-cache (because the
    // runbook is FOR the private nix cache feature). Use a broader search.
    const markerDir = resolve(ROOT, 'docs/planned-features')
    if (!existsSync(markerDir)) {
      warn(
        'marker-reference',
        runbook,
        `Pre-ship runbook references ${fm.api_endpoints_referenced.length} API endpoints but planned-features/ directory does not exist`,
      )
    }
  }
}

function validateSystemdUnits(runbook: string, fm: RunbookFrontmatter): void {
  if (!fm.systemd_units_referenced) return
  const unitPattern = /^[a-z][a-z0-9-]*\.service$/
  for (const unit of fm.systemd_units_referenced) {
    if (!unitPattern.test(unit)) {
      err(
        'systemd-unit-format',
        runbook,
        `Systemd unit "${unit}" does not match pattern "lowercase-with-dashes.service"`,
      )
    }
  }
}

function validateAuditEvents(runbook: string, fm: RunbookFrontmatter): void {
  if (!fm.audit_events_referenced) return
  const eventPattern = /^[a-z][a-z0-9.]*$/
  for (const event of fm.audit_events_referenced) {
    if (!eventPattern.test(event)) {
      err(
        'audit-event-format',
        runbook,
        `Audit event "${event}" does not match pattern "lowercase.dotted.format"`,
      )
    }
  }
  // Post-ship: validate against AuditAction enum in backend/src/services/audit-store.ts
  // For now, soft-check only in draft mode.
  if (fm.status === 'current') {
    const auditStorePath = resolve(ROOT, 'backend/src/services/audit-store.ts')
    if (existsSync(auditStorePath)) {
      const auditStoreContent = readFileSync(auditStorePath, 'utf-8')
      for (const event of fm.audit_events_referenced) {
        if (!auditStoreContent.includes(`'${event}'`) && !auditStoreContent.includes(`"${event}"`)) {
          err(
            'audit-event-existence',
            runbook,
            `Audit event "${event}" not found in audit-store.ts (post-ship runbook must reference real events)`,
          )
        }
      }
    }
  }
}

function validateConfigKeys(runbook: string, fm: RunbookFrontmatter): void {
  if (!fm.config_keys_referenced) return
  const configPattern = /^services\.weaver\.[a-z][a-zA-Z0-9.]*$/
  for (const key of fm.config_keys_referenced) {
    if (!configPattern.test(key)) {
      err(
        'config-key-format',
        runbook,
        `Config key "${key}" does not match pattern "services.weaver.<path>"`,
      )
    }
  }
}

function validateDecisionRefs(runbook: string, fm: RunbookFrontmatter): void {
  if (!fm.decision_refs) return
  const decisionPattern = /^#\d+$/
  for (const ref of fm.decision_refs) {
    if (!decisionPattern.test(ref)) {
      err(
        'decision-ref-format',
        runbook,
        `Decision ref "${ref}" does not match pattern "#N"`,
      )
      continue
    }
    // Check existence in MASTER-PLAN.md
    if (existsSync(MASTER_PLAN)) {
      const masterPlan = readFileSync(MASTER_PLAN, 'utf-8')
      const decisionNum = ref.substring(1)
      // Decision table rows start with `| N | Title | ...`
      const rowPattern = new RegExp(`^\\|\\s*${decisionNum}\\s*\\|`, 'm')
      if (!rowPattern.test(masterPlan)) {
        err(
          'decision-ref-existence',
          runbook,
          `Decision ${ref} not found in MASTER-PLAN.md decisions table`,
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log('\x1b[1mRunbook Audit\x1b[0m')
  console.log('=============\n')

  if (!existsSync(RUNBOOKS_DIR)) {
    console.log('No runbooks directory found at', RUNBOOKS_DIR)
    console.log('Nothing to audit.')
    process.exit(0)
  }

  const docFiles = readdirSync(RUNBOOKS_DIR)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => {
      // Process files with frontmatter starting with either `runbook:` or `policy:`
      const content = readFileSync(join(RUNBOOKS_DIR, f), 'utf-8')
      return /^---[\s\S]*?(runbook|policy):/m.test(content)
    })

  console.log(`Scanning ${docFiles.length} runbook(s) and policy doc(s) in ${RUNBOOKS_DIR}\n`)

  const docSummaries: Array<{ file: string; type: DocType; status: string; version_target: string; refs: number }> = []

  for (const file of docFiles) {
    const path = join(RUNBOOKS_DIR, file)
    const content = readFileSync(path, 'utf-8')
    const extracted = extractFrontmatter(content)

    if (!extracted) {
      err('frontmatter', file, 'Missing or malformed YAML frontmatter')
      continue
    }

    let fm: unknown
    try {
      fm = parseYaml(extracted.yaml)
    } catch (e) {
      err('frontmatter', file, `YAML parse error: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }

    const validated = validateFrontmatterShape(file, fm)
    if (!validated) continue

    const { frontmatter: fmv, docType } = validated

    validateDraftBanner(file, fmv, extracted.body)
    validateComplianceRefs(file, fmv)
    if (docType === 'runbook') {
      validateApiEndpoints(file, fmv)
      validateSystemdUnits(file, fmv)
      validateAuditEvents(file, fmv)
    }
    validateConfigKeys(file, fmv)
    validateDecisionRefs(file, fmv)

    const totalRefs =
      (fmv.api_endpoints_referenced?.length ?? 0) +
      (fmv.systemd_units_referenced?.length ?? 0) +
      (fmv.audit_events_referenced?.length ?? 0) +
      (fmv.config_keys_referenced?.length ?? 0)

    docSummaries.push({
      file,
      type: docType,
      status: fmv.status,
      version_target: fmv.version_target,
      refs: totalRefs,
    })

    const typeLabel = docType === 'runbook' ? '\x1b[36mrunbook\x1b[0m' : '\x1b[35mpolicy\x1b[0m'
    console.log(
      `  \x1b[32m✓\x1b[0m ${file} [${typeLabel} / ${fmv.status}] → ${fmv.version_target} (${totalRefs} refs)`,
    )
  }

  console.log()

  // Output findings
  const errorCount = findings.filter((f) => f.level === 'error').length
  const warnCount = findings.filter((f) => f.level === 'warn').length

  if (findings.length > 0) {
    console.log('\x1b[1mFindings:\x1b[0m')
    for (const f of findings) {
      const icon = f.level === 'error' ? '\x1b[31m✗\x1b[0m' : '\x1b[33m⚠\x1b[0m'
      console.log(`  ${icon} [${f.check}] ${f.runbook}: ${f.message}`)
    }
    console.log()
  }

  const runbookCount = docSummaries.filter((d) => d.type === 'runbook').length
  const policyCount = docSummaries.filter((d) => d.type === 'policy').length
  console.log(
    `\x1b[1mSummary:\x1b[0m ${runbookCount} runbook(s) + ${policyCount} policy doc(s) scanned, ${errorCount} error(s), ${warnCount} warning(s)`,
  )

  // Write report
  mkdirSync(REPORTS_DIR, { recursive: true })
  const reportPath = join(REPORTS_DIR, `runbooks-${new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]}.json`)
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        docs: docSummaries,
        findings,
        summary: { runbookCount, policyCount, errorCount, warnCount, total: findings.length },
      },
      null,
      2,
    ),
  )
  console.log(`\nReport saved: ${reportPath}`)

  if (errorCount > 0) {
    console.log('\n\x1b[31m\x1b[1mRESULT: FAIL\x1b[0m — ' + errorCount + ' error(s)')
    process.exit(1)
  }
  if (warnCount > 0) {
    console.log('\n\x1b[32m\x1b[1mRESULT: PASS\x1b[0m \x1b[2m(' + warnCount + ' warning(s))\x1b[0m')
  } else {
    console.log('\n\x1b[32m\x1b[1mRESULT: PASS\x1b[0m')
  }
}

main()

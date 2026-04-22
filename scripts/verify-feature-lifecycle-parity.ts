// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Feature Lifecycle Parity Auditor
 *
 * Enforces the integrity of the FEATURE-LIFECYCLES.md schema (canonical
 * at `plans/cross-version/FEATURE-LIFECYCLES.md`) plus its derived views
 * (`business/sales/partners/ROADMAP.md`,
 *  `business/investor/LIFECYCLE-REVENUE-TIMELINE.md`).
 *
 * Four checks, all mechanically verifiable:
 *
 *   1. SCHEMA VALIDITY — every feature YAML block parses, required
 *      fields present, version strings well-formed (`v<M>.<m>(.<p>)?`).
 *
 *   2. VERSION-TO-PLAN BINDING — every version referenced in a feature's
 *      lifecycle (foundation, progressive[], devPreview, skuLaunch,
 *      postLaunch[]) must have a corresponding `plans/v<X>.<Y>.0/`
 *      directory. Prevents the "schema says v3.4 but no plan exists"
 *      class of drift.
 *
 *   3. DECISION BACK-REFERENCE — the schema's `decision: N` must exist
 *      as a row in MASTER-PLAN.md's Decisions Resolved table. Missing
 *      decisions mean the feature hasn't been formally resolved.
 *
 *   4. GENERATED-VIEW FRESHNESS — running the generator now must
 *      produce output byte-identical to the checked-in derived views.
 *      Catches the case where FEATURE-LIFECYCLES.md was edited but the
 *      pre-commit hook didn't run (or was bypassed). Backs the
 *      one-source-of-truth guarantee.
 *
 * Checks NOT yet implemented (deferred until the schema has 3+ features
 * to calibrate rules on):
 *   - Any-doc coverage scan: every .md file that mentions a tracked
 *     feature must resolve its version claim to a schema stage.
 *   - Stage context binding: marketing docs must cite skuLaunch;
 *     partner docs must cite devPreview or skuLaunch.
 *   - No-orphan rule: each feature must be referenced by at least one
 *     business/ doc AND one plans/ doc.
 *   - Slice content matching: plans/v<X>.<Y>.0/EXECUTION-ROADMAP.md
 *     text for a slice must match schema's `progressive[i].adds`.
 *
 * Those checks need a path-based doc classifier and tolerant
 * string-similarity matching; premature before more features are
 * tracked here.
 *
 * Invocation:
 *   npx tsx scripts/verify-feature-lifecycle-parity.ts
 *   or: npm run audit:feature-lifecycle-parity
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more violations (details printed)
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { load as parseYaml } from 'js-yaml'
import { execFileSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

const SCHEMA = resolve(PROJECT_ROOT, 'plans', 'cross-version', 'FEATURE-LIFECYCLES.md')
const MASTER_PLAN = resolve(PROJECT_ROOT, 'MASTER-PLAN.md')
const PLANS_DIR = resolve(PROJECT_ROOT, 'plans')

const PARTNER_VIEW = resolve(PROJECT_ROOT, 'business', 'sales', 'partners', 'ROADMAP.md')
const INVESTOR_VIEW = resolve(PROJECT_ROOT, 'business', 'investor', 'LIFECYCLE-REVENUE-TIMELINE.md')

const GENERATOR = resolve(CODE_ROOT, 'scripts', 'generate-feature-lifecycle-views.ts')

const VERSION_RE = /^v\d+\.\d+(\.\d+)?$/

interface Stage {
  version: string
  description?: string
  audience?: string
  surface?: string
  adds?: string
  pricing?: string
  decision?: number
}

interface Feature {
  slug: string
  name: string
  decision: number
  foundation?: Stage
  progressive?: Stage[]
  devPreview?: Stage
  skuLaunch?: Stage
  postLaunch?: Stage[]
}

interface Violation {
  check: string
  feature?: string
  detail: string
}

// ─── Load schema ─────────────────────────────────────────────────────────

function loadFeatures(): Feature[] {
  if (!existsSync(SCHEMA)) {
    throw new Error(`FEATURE-LIFECYCLES.md not found at ${SCHEMA}`)
  }

  const text = readFileSync(SCHEMA, 'utf8')
  const sections = text.split(/\n## /).slice(1)

  const features: Feature[] = []
  for (const section of sections) {
    const slugMatch = section.match(/^([\w-]+)\n/)
    if (!slugMatch) continue
    const slug = slugMatch[1]!
    if (['The', 'Contract', 'When', 'Machine-readable', 'How'].includes(slug)) {
      continue
    }

    const yamlMatch = section.match(/```yaml\n([\s\S]*?)\n```/)
    if (!yamlMatch) {
      throw new Error(`Section "## ${slug}" has no YAML block`)
    }

    const data = parseYaml(yamlMatch[1]!) as Feature
    if (data.slug !== slug) {
      throw new Error(
        `Section "## ${slug}" YAML has slug "${data.slug}" — must match section header`,
      )
    }
    features.push(data)
  }

  return features
}

// ─── Check 1: Schema validity ────────────────────────────────────────────

function checkSchemaValidity(features: Feature[]): Violation[] {
  const vs: Violation[] = []
  for (const f of features) {
    if (!f.name) vs.push({ check: 'schema', feature: f.slug, detail: 'missing name' })
    if (f.decision === undefined || f.decision === null) {
      vs.push({ check: 'schema', feature: f.slug, detail: 'missing decision number' })
    }

    const allStages: Array<[string, Stage | undefined]> = [
      ['foundation', f.foundation],
      ['devPreview', f.devPreview],
      ['skuLaunch', f.skuLaunch],
    ]
    for (const [name, stage] of allStages) {
      if (stage && !VERSION_RE.test(stage.version)) {
        vs.push({
          check: 'schema',
          feature: f.slug,
          detail: `${name}.version "${stage.version}" is not a valid vN.N(.N)? string`,
        })
      }
    }
    for (const arr of [f.progressive ?? [], f.postLaunch ?? []]) {
      for (const [i, s] of arr.entries()) {
        if (!VERSION_RE.test(s.version)) {
          vs.push({
            check: 'schema',
            feature: f.slug,
            detail: `progressive[${i}].version "${s.version}" is not a valid vN.N(.N)? string`,
          })
        }
      }
    }

    // At minimum, every tracked feature should have a skuLaunch — otherwise
    // it's not a lifecycle, it's just a feature in one version.
    if (!f.skuLaunch) {
      vs.push({
        check: 'schema',
        feature: f.slug,
        detail:
          'missing skuLaunch stage — features in the schema are by definition multi-stage; a feature that never becomes a purchasable SKU shouldn\'t be tracked here',
      })
    }

    // Progressive versions must be sorted, no duplicates.
    if (f.progressive && f.progressive.length > 1) {
      for (let i = 1; i < f.progressive.length; i++) {
        const cmp = compareVersions(f.progressive[i - 1]!.version, f.progressive[i]!.version)
        if (cmp > 0) {
          vs.push({
            check: 'schema',
            feature: f.slug,
            detail: `progressive[] not sorted: ${f.progressive[i - 1]!.version} appears before ${f.progressive[i]!.version}`,
          })
        } else if (cmp === 0) {
          vs.push({
            check: 'schema',
            feature: f.slug,
            detail: `progressive[] has duplicate version ${f.progressive[i]!.version}`,
          })
        }
      }
    }
  }
  return vs
}

// ─── Check 2: Version-to-plan binding ────────────────────────────────────

function checkVersionToPlan(features: Feature[]): Violation[] {
  const vs: Violation[] = []
  const existingPlans = new Set(
    readdirSync(PLANS_DIR)
      .filter((name) => /^v\d+\.\d+\.\d+$/.test(name))
      .map((name) => name),
  )

  for (const f of features) {
    const stagesToCheck: Array<[string, string]> = []
    if (f.foundation) stagesToCheck.push(['foundation', f.foundation.version])
    if (f.devPreview) stagesToCheck.push(['devPreview', f.devPreview.version])
    if (f.skuLaunch) stagesToCheck.push(['skuLaunch', f.skuLaunch.version])
    for (const [i, s] of (f.progressive ?? []).entries()) {
      stagesToCheck.push([`progressive[${i}]`, s.version])
    }
    for (const [i, s] of (f.postLaunch ?? []).entries()) {
      stagesToCheck.push([`postLaunch[${i}]`, s.version])
    }

    for (const [stageLabel, version] of stagesToCheck) {
      // Normalise "v2.3" → "v2.3.0" for plan directory lookup
      const planDir = /^\d+\.\d+\.\d+$/.test(version.replace(/^v/, ''))
        ? version
        : `${version}.0`
      if (!existingPlans.has(planDir)) {
        vs.push({
          check: 'version-to-plan',
          feature: f.slug,
          detail: `${stageLabel}.version ${version} has no corresponding plans/${planDir}/ directory — create the plan or correct the schema`,
        })
      }
    }
  }
  return vs
}

// ─── Check 3: Decision back-reference ────────────────────────────────────

function checkDecisionBackReference(features: Feature[]): Violation[] {
  const vs: Violation[] = []
  if (!existsSync(MASTER_PLAN)) {
    vs.push({ check: 'decision', detail: 'MASTER-PLAN.md not found' })
    return vs
  }
  const masterPlanText = readFileSync(MASTER_PLAN, 'utf8')

  for (const f of features) {
    if (f.decision === undefined) continue // already caught by schema check
    // Match `| NNN | ...` at start of a table row.
    const rowRe = new RegExp(`^\\| ${f.decision} \\|`, 'm')
    if (!rowRe.test(masterPlanText)) {
      vs.push({
        check: 'decision',
        feature: f.slug,
        detail: `decision #${f.decision} not found in MASTER-PLAN.md Decisions Resolved table`,
      })
    }
  }
  return vs
}

// ─── Check 4: Generated-view freshness ───────────────────────────────────

function checkGeneratedViewFreshness(): Violation[] {
  const vs: Violation[] = []
  if (!existsSync(GENERATOR)) {
    vs.push({ check: 'view-freshness', detail: 'generator script missing' })
    return vs
  }

  // Run the generator in a subprocess, capture what it would write, and
  // compare against the checked-in files. We don't want the auditor to
  // mutate anything, so a "dry-run" pattern is ideal — but the generator
  // writes directly. Instead, snapshot the current checked-in views, run
  // the generator, compare, and (if different) record a violation; the
  // on-disk state is already the new content (user can commit it to fix).
  //
  // Rationale: this is acceptable because (a) the auditor runs in CI where
  // the working tree is ephemeral, and (b) locally, if a user ran the
  // generator and then forgot to stage, the pre-commit hook catches that
  // before the auditor ever runs. The auditor's role is to catch the
  // "bypassed hooks" case.

  const before = {
    partner: existsSync(PARTNER_VIEW) ? readFileSync(PARTNER_VIEW, 'utf8') : '',
    investor: existsSync(INVESTOR_VIEW) ? readFileSync(INVESTOR_VIEW, 'utf8') : '',
  }

  try {
    execFileSync('npx', ['tsx', GENERATOR], { cwd: CODE_ROOT, stdio: 'pipe' })
  } catch (e) {
    vs.push({
      check: 'view-freshness',
      detail: `generator failed to run: ${(e as Error).message}`,
    })
    return vs
  }

  const after = {
    partner: existsSync(PARTNER_VIEW) ? readFileSync(PARTNER_VIEW, 'utf8') : '',
    investor: existsSync(INVESTOR_VIEW) ? readFileSync(INVESTOR_VIEW, 'utf8') : '',
  }

  if (before.partner !== after.partner) {
    vs.push({
      check: 'view-freshness',
      detail: `${PARTNER_VIEW} was stale vs. generator output. Already regenerated; run git diff to see what changed, then commit the update. (The pre-commit hook auto-regenerates; this path indicates the hook was bypassed.)`,
    })
  }
  if (before.investor !== after.investor) {
    vs.push({
      check: 'view-freshness',
      detail: `${INVESTOR_VIEW} was stale vs. generator output. Already regenerated; run git diff to see what changed, then commit the update.`,
    })
  }
  return vs
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da - db
  }
  return 0
}

// ─── Main ────────────────────────────────────────────────────────────────

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function main(): void {
  console.log(`${BOLD}Feature Lifecycle Parity Audit${RESET}`)
  console.log(
    `${DIM}Verifies plans/cross-version/FEATURE-LIFECYCLES.md schema integrity${RESET}`,
  )
  console.log(`${DIM}and that its derived views are fresh.${RESET}`)
  console.log()

  let features: Feature[]
  try {
    features = loadFeatures()
  } catch (e) {
    console.log(`  ${RED}✗${RESET} schema: ${(e as Error).message}`)
    console.log()
    console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — schema failed to load`)
    process.exit(1)
  }

  console.log(`  ${GREEN}✓${RESET} Schema loaded: ${features.length} feature(s) (${features.map((f) => f.slug).join(', ')})`)

  const allViolations: Violation[] = []
  allViolations.push(...checkSchemaValidity(features))
  allViolations.push(...checkVersionToPlan(features))
  allViolations.push(...checkDecisionBackReference(features))
  allViolations.push(...checkGeneratedViewFreshness())

  if (allViolations.length === 0) {
    console.log(`  ${GREEN}✓${RESET} Schema validity — all fields present, versions well-formed`)
    console.log(`  ${GREEN}✓${RESET} Version-to-plan binding — every version has a plans/v<X>.<Y>.0/ dir`)
    console.log(`  ${GREEN}✓${RESET} Decision back-reference — all schema decisions exist in MASTER-PLAN`)
    console.log(`  ${GREEN}✓${RESET} Generated-view freshness — partner + investor views match generator output`)
    console.log()
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — feature lifecycles are in parity`)
    process.exit(0)
  }

  for (const v of allViolations) {
    const feat = v.feature ? ` [${v.feature}]` : ''
    console.log(`  ${RED}✗${RESET} [${v.check}]${feat} ${v.detail}`)
  }
  console.log()
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${allViolations.length} violation(s)`)
  process.exit(1)
}

main()

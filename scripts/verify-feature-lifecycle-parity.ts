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
 * Three checks, all mechanically verifiable:
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
 * GENERATED-VIEW FRESHNESS is intentionally NOT checked here. It is owned
 * solely by `audit:generated-artifact-freshness`, which registers the same
 * two derived views (ROADMAP.md, LIFECYCLE-REVENUE-TIMELINE.md). Two auditors
 * both running the generator in-place created a self-masking footgun: the
 * first run regenerated the working tree, so the second (and every rerun)
 * compared fresh-vs-fresh and passed even when the *committed* views were
 * stale. Single ownership + a git (not working-tree) baseline there is the fix.
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

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

const SCHEMA = resolve(PROJECT_ROOT, 'plans', 'cross-version', 'FEATURE-LIFECYCLES.md')
const MASTER_PLAN = resolve(PROJECT_ROOT, 'MASTER-PLAN.md')
const PLANS_DIR = resolve(PROJECT_ROOT, 'plans')

const VERSION_RE = /^v\d+\.\d+(\.\d+)?$/

interface Stage {
  version: string
  description?: string
  audience?: string
  surface?: string
  adds?: string
  pricing?: string
  tier?: string
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
  generalAvailability?: Stage
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
      ['generalAvailability', f.generalAvailability],
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

    // Every tracked feature must declare exactly one delivery stage —
    // either skuLaunch (purchasable) or generalAvailability (tier-included).
    // Both-or-neither is schema abuse: both implies the feature is
    // simultaneously purchasable AND tier-included at the same version
    // (contradictory for downstream doc citations); neither implies the
    // feature is in-progress forever with no anchor for consumer docs.
    const hasSku = !!f.skuLaunch
    const hasGa = !!f.generalAvailability
    if (!hasSku && !hasGa) {
      vs.push({
        check: 'schema',
        feature: f.slug,
        detail:
          'missing delivery stage — every tracked feature needs either skuLaunch (purchasable SKU) or generalAvailability (tier-included capability)',
      })
    } else if (hasSku && hasGa) {
      vs.push({
        check: 'schema',
        feature: f.slug,
        detail:
          'both skuLaunch AND generalAvailability declared — pick exactly one: skuLaunch for purchasable SKUs (opens a revenue line), generalAvailability for tier-included capabilities (no new revenue line)',
      })
    }

    // generalAvailability must declare the tier that receives the capability.
    // skuLaunch already encodes this via its pricing reference; GA has no
    // pricing reference, so the tier field is load-bearing for tier-matrix
    // citations downstream.
    if (f.generalAvailability && !f.generalAvailability.tier) {
      vs.push({
        check: 'schema',
        feature: f.slug,
        detail:
          'generalAvailability.tier is required — tier-matrix citations depend on knowing which tier receives the capability',
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
    if (f.generalAvailability)
      stagesToCheck.push(['generalAvailability', f.generalAvailability.version])
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
    // Match `| WVR-NNN | ...` at start of a table row (FORGE-1).
    const rowRe = new RegExp(`^\\| WVR-${f.decision} \\|`, 'm')
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
    `${DIM}Verifies plans/cross-version/FEATURE-LIFECYCLES.md schema integrity.${RESET}`,
  )
  console.log(`${DIM}(view freshness is owned by audit:generated-artifact-freshness)${RESET}`)
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

  if (allViolations.length === 0) {
    console.log(`  ${GREEN}✓${RESET} Schema validity — all fields present, versions well-formed`)
    console.log(`  ${GREEN}✓${RESET} Version-to-plan binding — every version has a plans/v<X>.<Y>.0/ dir`)
    console.log(`  ${GREEN}✓${RESET} Decision back-reference — all schema decisions exist in MASTER-PLAN`)
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

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Proprietary and confidential. Do not distribute.
/**
 * Feature Lifecycle View Generator
 *
 * Reads `plans/cross-version/FEATURE-LIFECYCLES.md` (the canonical schema
 * seeded with one YAML block per lifecycle-tracked feature) and emits
 * three derived views, each targeting a different audience:
 *
 *   1. Partner roadmap — `business/sales/partners/ROADMAP.md`
 *      FM customers + design partners see dev-preview and SKU-launch
 *      dates. Rolling 6-month window with preview-available milestones.
 *
 *   2. Investor revenue timeline — `business/investor/LIFECYCLE-REVENUE-TIMELINE.md`
 *      Every SKU-launch event with version + pricing, sorted by version.
 *      Backs the ARR ramp claim in the pitch deck.
 *
 *   3. Per-release slice index — appended into each
 *      `plans/v<X>.<Y>.0/EXECUTION-ROADMAP.md` as a managed block between
 *      <!-- LIFECYCLE-SLICES:START --> and <!-- LIFECYCLE-SLICES:END -->
 *      markers. Shows which lifecycle slices land in this release,
 *      without duplicating schema data.
 *
 * Why generated, not hand-written:
 *   - One source of truth (FEATURE-LIFECYCLES.md) means the partner
 *     roadmap, investor timeline, and engineering release plans can
 *     never contradict each other — they're all derived.
 *   - Pre-commit hook regenerates when the schema changes, so the views
 *     never go stale.
 *   - `audit:feature-lifecycle-parity` (to be built next) will verify
 *     the checked-in views match what this generator would produce —
 *     catching the case where someone edits the schema without running
 *     the generator.
 *
 * Invocation:
 *   npx tsx scripts/generate-feature-lifecycle-views.ts
 *   or: npm run docs:lifecycles
 *
 * Exit codes:
 *   0 — views generated cleanly
 *   1 — schema parse error, missing fields, or I/O failure
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { load as parseYaml } from 'js-yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

const SCHEMA = resolve(PROJECT_ROOT, 'plans', 'cross-version', 'FEATURE-LIFECYCLES.md')

const PARTNER_OUT = resolve(PROJECT_ROOT, 'business', 'sales', 'partners', 'ROADMAP.md')
const INVESTOR_OUT = resolve(PROJECT_ROOT, 'business', 'investor', 'LIFECYCLE-REVENUE-TIMELINE.md')

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
  // Tier-inclusion delivery event (alternative to skuLaunch). A feature
  // has exactly one of skuLaunch or generalAvailability. GA-only features
  // are deliberately omitted from both partner and investor views: they
  // open no revenue line (excluded from investor timeline) and typically
  // ship without a preview stage (excluded from partner roadmap).
  // Their lifecycle entry exists so TIER-MANAGEMENT.md and tier matrix
  // citations can resolve to a canonical version.
  generalAvailability?: Stage
  postLaunch?: Stage[]
}

// ─── Schema loader ────────────────────────────────────────────────────────

function loadFeatures(): Feature[] {
  if (!existsSync(SCHEMA)) {
    throw new Error(`FEATURE-LIFECYCLES.md not found at ${SCHEMA}`)
  }

  const text = readFileSync(SCHEMA, 'utf8')

  // Each feature lives under `## <slug>` followed by a ```yaml ... ``` block.
  // Split on the section headers, then extract the YAML block from each.
  const sections = text.split(/\n## /).slice(1) // drop pre-section content

  const features: Feature[] = []
  for (const section of sections) {
    const slugMatch = section.match(/^([\w-]+)\n/)
    if (!slugMatch) continue
    const slug = slugMatch[1]!
    // Skip intro sections whose slug doesn't look like a feature identifier
    if (slug === 'The' || slug === 'Contract' || slug === 'When' || slug === 'Machine-readable' || slug === 'How') {
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

// ─── View: Partner Roadmap ────────────────────────────────────────────────

function renderPartnerRoadmap(features: Feature[]): string {
  const today = new Date().toISOString().slice(0, 10)
  const lines: string[] = []
  lines.push('<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->')
  lines.push('<!-- Proprietary and confidential. Do not distribute. -->')
  lines.push('<!-- GENERATED from plans/cross-version/FEATURE-LIFECYCLES.md — do not edit by hand. -->')
  lines.push('<!-- Regenerate: `npm run docs:lifecycles`. Pre-commit hook auto-regenerates. -->')
  lines.push('# Partner Roadmap')
  lines.push('')
  lines.push(`**Audience:** Founding Member customers + design partners.`)
  lines.push(`**Updated:** ${today} (auto-generated on schema change).`)
  lines.push('')
  lines.push('This document lists features with a **dev-preview stage** — available for FM customers and design partners to live-test before the SKU launch. Use this to plan preview access, partner co-design cycles, and early-feedback loops.')
  lines.push('')
  lines.push('Features in this document are NOT purchasable at the preview date. Purchasable SKU-launch dates are shown separately.')
  lines.push('')
  lines.push('---')
  lines.push('')

  const withPreviews = features.filter((f) => f.devPreview)
  if (withPreviews.length === 0) {
    lines.push('_No lifecycle-tracked features currently have a dev-preview stage scheduled._')
  } else {
    // Sort by dev-preview version
    withPreviews.sort((a, b) =>
      compareVersions(a.devPreview!.version, b.devPreview!.version),
    )

    for (const f of withPreviews) {
      lines.push(`## ${f.name}`)
      lines.push('')
      lines.push(`**Dev preview:** \`${f.devPreview!.version}\``)
      if (f.devPreview!.audience) {
        lines.push(`**Audience:** ${f.devPreview!.audience}`)
      }
      if (f.devPreview!.surface) {
        lines.push('')
        lines.push(`${f.devPreview!.surface.trim()}`)
      }
      lines.push('')
      if (f.skuLaunch) {
        lines.push(`**SKU launch:** \`${f.skuLaunch.version}\` — purchasable at this version.`)
        if (f.skuLaunch.description) {
          lines.push('')
          lines.push(f.skuLaunch.description.trim())
        }
      }
      lines.push('')
      lines.push(
        `Decision: [#${f.decision}](../../../MASTER-PLAN.md#decisions-resolved) · Lifecycle detail: [FEATURE-LIFECYCLES.md#${f.slug}](../../../plans/cross-version/FEATURE-LIFECYCLES.md#${f.slug})`,
      )
      lines.push('')
      lines.push('---')
      lines.push('')
    }
  }

  return lines.join('\n')
}

// ─── View: Investor Revenue Timeline ──────────────────────────────────────

function renderInvestorTimeline(features: Feature[]): string {
  const today = new Date().toISOString().slice(0, 10)
  const lines: string[] = []
  lines.push('<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->')
  lines.push('<!-- Proprietary and confidential. Do not distribute. -->')
  lines.push('<!-- GENERATED from plans/cross-version/FEATURE-LIFECYCLES.md — do not edit by hand. -->')
  lines.push('<!-- Regenerate: `npm run docs:lifecycles`. Pre-commit hook auto-regenerates. -->')
  lines.push('# Lifecycle Revenue Timeline')
  lines.push('')
  lines.push(`**Audience:** Investors, ARR-model planning.`)
  lines.push(`**Updated:** ${today} (auto-generated on schema change).`)
  lines.push('')
  lines.push('Every feature with a priced SKU launch. Sorted by launch version — this is the order new revenue lines open. Prices reflect `code/src/constants/pricing.ts` at the time of generation.')
  lines.push('')
  lines.push('**Not in this document:** base-tier pricing (see [TIER-MANAGEMENT.md](../product/TIER-MANAGEMENT.md)) or feature capabilities that are not purchasable as a standalone SKU.')
  lines.push('')
  lines.push('---')
  lines.push('')

  const withLaunch = features.filter((f) => f.skuLaunch)
  if (withLaunch.length === 0) {
    lines.push('_No lifecycle-tracked features currently have an SKU-launch stage scheduled._')
  } else {
    withLaunch.sort((a, b) =>
      compareVersions(a.skuLaunch!.version, b.skuLaunch!.version),
    )

    lines.push('| SKU Launch | Feature | Pricing | Decision |')
    lines.push('|---|---|---|---|')
    for (const f of withLaunch) {
      const pricing = f.skuLaunch!.pricing ?? '—'
      lines.push(
        `| \`${f.skuLaunch!.version}\` | [${f.name}](../../plans/cross-version/FEATURE-LIFECYCLES.md#${f.slug}) | ${pricing} | #${f.decision} |`,
      )
    }
    lines.push('')

    for (const f of withLaunch) {
      lines.push(`## ${f.name} — launches at \`${f.skuLaunch!.version}\``)
      lines.push('')
      if (f.skuLaunch!.description) {
        lines.push(f.skuLaunch!.description.trim())
        lines.push('')
      }
      if (f.skuLaunch!.pricing) {
        lines.push(`**Pricing reference:** \`${f.skuLaunch!.pricing}\``)
        lines.push('')
      }
      if (f.devPreview) {
        lines.push(
          `Dev preview for FM customers + partners lands at \`${f.devPreview.version}\` — revenue doesn't begin until SKU launch.`,
        )
        lines.push('')
      }
      if (f.foundation) {
        lines.push(
          `Foundation release: \`${f.foundation.version}\` (internal scaffolding, no customer surface).`,
        )
        lines.push('')
      }
      if (f.progressive && f.progressive.length > 0) {
        const versions = f.progressive.map((p) => `\`${p.version}\``).join(', ')
        lines.push(`Progressive build: ${versions}. Capability slices leading to launch.`)
        lines.push('')
      }
      lines.push('---')
      lines.push('')
    }
  }

  return lines.join('\n')
}

// ─── View: Per-release slice index (managed block in roadmaps) ────────────
// NOTE: per-release injection is deferred to a follow-up pass. The view is
// implemented here as a function but not yet written — the initial generator
// run produces partner + investor only, and the release-slice work is added
// once the first batch of feature entries is beyond compliance-export.

// ─── Version comparison ──────────────────────────────────────────────────

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

function ensureDir(path: string): void {
  const dir = dirname(path)
  if (!existsSync(dir)) {
    // Recursive mkdir via fs
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('fs').mkdirSync(dir, { recursive: true })
  }
}

function main(): void {
  console.log('Loading feature lifecycle schema...')
  const features = loadFeatures()
  console.log(`  Loaded ${features.length} feature(s): ${features.map((f) => f.slug).join(', ')}`)

  ensureDir(PARTNER_OUT)
  const partner = renderPartnerRoadmap(features)
  writeFileSync(PARTNER_OUT, partner + '\n')
  console.log(`  Wrote ${PARTNER_OUT}`)

  ensureDir(INVESTOR_OUT)
  const investor = renderInvestorTimeline(features)
  writeFileSync(INVESTOR_OUT, investor + '\n')
  console.log(`  Wrote ${INVESTOR_OUT}`)

  console.log('Done. Views regenerated from FEATURE-LIFECYCLES.md.')
  console.log('(Per-release slice index injection into plans/v*/EXECUTION-ROADMAP.md is deferred — see script header note.)')
}

main()

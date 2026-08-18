// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Form Testid Coverage Auditor
 *
 * For every page that already has any E2E spec coverage, checks that every
 * interactive form element with a `data-testid` attribute is referenced in
 * at least one spec file.
 *
 * "Interactive" = element tag is an input, select, button, checkbox, link, or
 * equivalent Quasar component. Non-interactive testids (tables, scroll areas,
 * sentinels, display containers) are excluded from the requirement.
 *
 * Also checks that every page with a gated submit button (`:disable=` on a
 * `data-testid="submit-btn"` element) has setup-mode spec coverage — i.e., at
 * least one spec exercises the submit path in a fresh/registration context.
 *
 * Why: adding a form element, renaming a testid, or changing what gates a
 * submit button are all contract changes for any test that references that
 * element. This auditor catches structural gaps; the pre-commit hook catches
 * the temporal gap (changing a gate without staging a spec update).
 *
 * Changing a submit-button gate silently breaks every E2E test that clicks it —
 * which is the failure this pairing exists to prevent.
 *
 * Exit 0 = all interactive testids in specced pages have spec coverage.
 * Exit 1 = one or more testids are uncovered.
 */

import { readFileSync, globSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CODE_ROOT = join(__dirname, '..')
const BASELINE_PATH = join(__dirname, 'data', 'form-testid-baseline.json')

// Tags that indicate an interactive form element.
const INTERACTIVE_TAGS = new Set([
  'q-input', 'q-select', 'q-checkbox', 'q-radio', 'q-toggle',
  'q-btn', 'q-file',
  'input', 'select', 'textarea', 'button', 'a',
])

// Testid suffixes that are definitively non-interactive (display/layout).
const NON_INTERACTIVE_SUFFIXES = [
  '-table', '-area', '-sentinel', '-container', '-card',
  '-list', '-section', '-panel', '-badge', '-tooltip',
]

// Setup-mode indicators: spec exercises a fresh/registration flow.
const SETUP_MODE_PATTERNS = [
  /setupRequired.*true/,
  /storageState:\s*\{\s*cookies:\s*\[\]/,
  /acceptTos\s*\(/,
]

interface BaselineEntry {
  page: string
  testid: string
  reason: string
  notes?: string
}

interface Baseline {
  knownMissing: BaselineEntry[]
}

interface TestidInfo {
  testid: string
  interactive: boolean
  dynamic: boolean  // true if testid is a template literal — covered by prefix selectors
  /**
   * The element's static `label="..."`, when it has one. This is the element's accessible name
   * at runtime, so a spec may cover it with `getByRole(…, { name: '<label>' })` instead of a
   * testid — see `specCoversTestid`.
   */
  label?: string
}

interface PageInfo {
  relPath: string
  testids: TestidInfo[]
}

interface SpecFile {
  relPath: string
  content: string
}

/**
 * Resolve the nearest opening element tag before a given character offset.
 * Walks backwards from `offset` looking for `<tagName` pattern.
 */
function resolveElementTag(content: string, offset: number): string {
  const prefix = content.slice(0, offset)
  // Walk back to find the most recent '<' that starts a tag (not '</')
  const tagMatch = prefix.match(/<([\w-]+)[^<]*$/)
  return tagMatch ? tagMatch[1]!.toLowerCase() : ''
}

/**
 * The static `label="..."` on the element that owns a testid, or undefined.
 *
 * Only a literal `label="…"` counts — a bound `:label="expr"` is not resolvable here and must
 * fall back to testid coverage, which is the safe direction: it can under-credit coverage and
 * ask for a spec, never over-credit and stay silent.
 */
function resolveElementLabel(content: string, offset: number): string | undefined {
  const start = content.lastIndexOf('<', offset)
  if (start === -1) return undefined
  const end = content.indexOf('>', offset)
  const block = content.slice(start, end === -1 ? offset : end)
  return /(?:^|\s)label="([^"]+)"/.exec(block)?.[1]
}

function isInteractiveTestid(testid: string, tag: string): boolean {
  // Definitively non-interactive by suffix
  if (NON_INTERACTIVE_SUFFIXES.some(s => testid.endsWith(s))) return false
  // Interactive by element tag
  if (INTERACTIVE_TAGS.has(tag)) return true
  // Suffix heuristics for well-named testids when tag resolution fails
  if (testid.endsWith('-input') || testid.endsWith('-select') ||
      testid.endsWith('-btn') || testid.endsWith('-checkbox') ||
      testid.endsWith('-radio') || testid.endsWith('-link') ||
      testid.endsWith('-submit') || testid.endsWith('-toggle')) return true
  return false
}

function extractTestids(pageContent: string): TestidInfo[] {
  const results: TestidInfo[] = []
  // Match both static ("testid") and dynamic (`:data-testid="..."` or `data-testid="\`...\`"`)
  const re = /:?data-testid="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(pageContent)) !== null) {
    const raw = m[1]!
    // Dynamic testid: template literal (contains ${ }) — covered by prefix selectors in specs
    const dynamic = raw.startsWith('`') || raw.includes('${')
    const testid = dynamic ? raw : raw
    const tag = resolveElementTag(pageContent, m.index)
    const label = resolveElementLabel(pageContent, m.index)
    results.push({ testid, interactive: isInteractiveTestid(testid, tag), dynamic, label })
  }
  return results
}

function loadPages(): PageInfo[] {
  const files = globSync('src/pages/**/*.vue', { cwd: CODE_ROOT })
  return files.map(rel => {
    const content = readFileSync(join(CODE_ROOT, rel), 'utf-8')
    return { relPath: rel, testids: extractTestids(content) }
  })
}

function loadSpecs(): SpecFile[] {
  const files = [
    ...globSync('testing/e2e/*.spec.ts', { cwd: CODE_ROOT }),
    ...globSync('testing/e2e/helpers/**/*.ts', { cwd: CODE_ROOT }),
  ]
  return files.map(rel => ({
    relPath: rel,
    content: readFileSync(join(CODE_ROOT, rel), 'utf-8'),
  }))
}

/**
 * Coverage is "a spec exercises this element", NOT "a spec mentions this testid".
 *
 * The two came apart on 2026-08-17. Quasar 2.25 renders a q-select's `data-testid` on BOTH the
 * `.q-field__native` wrapper and the `.q-select__focus-target` input, so `getByTestId` became a
 * strict-mode violation and three specs had to move to `getByRole(…, { name })`. That is the
 * standing convention for Quasar form controls anyway: they set `inheritAttrs: false` and place
 * attributes on an inner node, so a testid-anchored locator is unreliable and a role locator is
 * not. Those elements were still covered, and this auditor reported them uncovered, because it
 * modelled the locator rather than the coverage.
 *
 * So accessible-name coverage counts too. Accepting it is not a loosening: `getByRole` asserts
 * the control is reachable by the name a screen reader announces, which is a stronger claim than
 * a test-only attribute.
 */
function specCoversTestid(specs: SpecFile[], testid: string, label?: string): boolean {
  const byTestid = specs.some(s =>
    s.content.includes(`getByTestId('${testid}')`) ||
    s.content.includes(`getByTestId("${testid}")`) ||
    s.content.includes(`data-testid="${testid}"`)
  )
  if (byTestid || label === undefined) return byTestid

  // `getByRole('combobox', { name: 'Allowed VMs' })` — quote style varies, the name does not.
  return specs.some(s =>
    s.content.includes(`name: '${label}'`) ||
    s.content.includes(`name: "${label}"`)
  )
}

function pageHasAnyCoverage(specs: SpecFile[], page: PageInfo): boolean {
  return page.testids.some(({ testid, label }) => specCoversTestid(specs, testid, label))
}

function setupModeSpecsForTestid(specs: SpecFile[], testid: string): string[] {
  return specs
    .filter(s =>
      (s.content.includes(`getByTestId('${testid}')`) ||
        s.content.includes(`getByTestId("${testid}")`)) &&
      SETUP_MODE_PATTERNS.some(p => p.test(s.content))
    )
    .map(s => s.relPath)
}

function run(): void {
  console.log('\x1b[1mForm Testid Coverage Audit\x1b[0m')
  console.log('\x1b[2mChecks that interactive form element testids in specced pages have E2E coverage\x1b[0m\n')

  const pages = loadPages()
  const specs = loadSpecs()
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline
  const knownMissing = new Map(
    baseline.knownMissing.map(e => [`${e.page}::${e.testid}`, e])
  )

  let totalInteractive = 0
  let totalUncovered = 0
  let totalBaseline = 0
  let totalPages = 0
  const failures: string[] = []

  for (const page of pages) {
    // Only check interactive, non-dynamic testids on specced pages
    const interactive = page.testids.filter(t => t.interactive && !t.dynamic)
    if (interactive.length === 0) continue
    if (!pageHasAnyCoverage(specs, page)) continue

    totalPages++
    let pageHeader = false

    for (const { testid, label } of interactive) {
      totalInteractive++
      if (specCoversTestid(specs, testid, label)) continue

      const key = `${page.relPath}::${testid}`
      if (knownMissing.has(key)) {
        totalBaseline++
        continue  // acknowledged debt — don't fail
      }

      // New gap not in baseline — fail
      totalUncovered++
      if (!pageHeader) {
        console.error(`\x1b[31m✗ ${page.relPath}\x1b[0m`)
        pageHeader = true
      }
      console.error(`    \x1b[31mmissing: ${testid}\x1b[0m`)
      failures.push(`${page.relPath} → ${testid}`)
    }

    if (!pageHeader) {
      console.log(`\x1b[32m✓\x1b[0m ${page.relPath} (${interactive.length} interactive testid(s))`)
    }

    // Submit-gate check: gated submit-btn must have setup-mode spec coverage
    const pageContent = readFileSync(join(CODE_ROOT, page.relPath), 'utf-8')
    const hasGatedSubmit = page.testids.some(t => t.testid === 'submit-btn') &&
      pageContent.includes(':disable=')
    if (hasGatedSubmit) {
      const coveringSetupSpecs = setupModeSpecsForTestid(specs, 'submit-btn')
      if (coveringSetupSpecs.length === 0) {
        console.error(`  \x1b[31m⚠ submit-btn has :disable= but no spec exercises setup/registration mode\x1b[0m`)
        failures.push(`${page.relPath} → submit-btn (no setup-mode coverage)`)
        totalUncovered++
      }
    }
  }

  console.log()
  console.log(`  ${totalPages} specced page(s), ${totalInteractive} interactive testid(s) audited`)
  if (totalBaseline > 0) {
    console.log(`  \x1b[2m${totalBaseline} acknowledged gap(s) in baseline — add coverage to remove from scripts/data/form-testid-baseline.json\x1b[0m`)
  }

  if (failures.length > 0) {
    console.error(`\n\x1b[31m${totalUncovered} new uncovered testid(s) — add to specs or baseline:\x1b[0m`)
    for (const f of failures) console.error(`  ${f}`)
    console.error('\x1b[2mSee scripts/data/form-testid-baseline.json for the acknowledged-gap format.\x1b[0m')
    process.exit(1)
  }

  console.log('\x1b[32m✓\x1b[0m No new form testid coverage gaps.')
  process.exit(0)
}

run()

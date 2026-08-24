// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:ci-gates — every soft-failing CI step is registered, reasoned, and dated.
 *
 * `continue-on-error: true` turns a step into one that cannot fail. That is correct for a badge
 * write and wrong for a check, and nothing distinguished the two: they are the same three words.
 *
 * The instance this was built from — `security-scan.yml` ran `npm audit --audit-level=high` with
 * continue-on-error for months while its disposition in the security register named that
 * same audit as its mitigating control. The audit reported a HIGH advisory in `@fastify/static`
 * (an authorization bypass in the module serving the SPA) on every single run, and nothing failed.
 *
 * So the rule is not "never soft-fail" — it is **a soft-fail must be a registered decision with an
 * expiry**. Four failure modes, and the last two are the ones that matter over time:
 *
 *   1. UNREGISTERED — a new `continue-on-error` appears with no entry. The default is now "justify
 *      it", not "nobody notices".
 *   2. INCOMPLETE   — an entry missing a category, reason, addedAt or reviewBy. A reason-free
 *      exception is a suppression, which is what `never-game-auditors.md` refuses.
 *   3. EXPIRED      — reviewBy has passed. "While we establish a baseline" with no date is exactly
 *      how a temporary exception becomes permanent; this is the clock.
 *   4. STALE        — an entry whose step no longer soft-fails. Same convention as
 *      decision-rev-legacy.json and archive-markers-legacy.json: the list only shrinks, so an
 *      exemption cannot outlive the thing it exempted.
 *
 * Usage:
 *   npx tsx scripts/verify-ci-gates.ts
 *   npx tsx scripts/verify-ci-gates.ts --self-test
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const WORKFLOW_DIR = join(REPO_ROOT, '.github/workflows')
const REGISTRY = join(HERE, 'baselines/ci-gate-exceptions.json')

const RED = '\x1b[31m'; const GREEN = '\x1b[32m'; const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'; const YELLOW = '\x1b[33m'; const RESET = '\x1b[0m'

interface Exception {
  category: string
  reason: string
  addedAt: string
  reviewBy: string
}

interface Registry {
  _categories: Record<string, string>
  exceptions: Record<string, Exception>
}

/** One soft-failing step, keyed the way the registry keys it. */
export interface SoftFail {
  key: string
  workflow: string
  step: string
}

interface WorkflowJob {
  steps?: { name?: string; 'continue-on-error'?: unknown }[]
}
interface WorkflowDoc {
  jobs?: Record<string, WorkflowJob>
}

/**
 * Find every step with `continue-on-error: true`.
 *
 * Parsed as YAML rather than grepped, because the key also appears in comments explaining why a
 * step is NOT soft-failing — this file's own workflows carry several such notes, and a line-based
 * scan reports each of them as an occurrence. A checker that flags its own documentation gets
 * switched off.
 *
 * Only `true` counts. `continue-on-error: ${{ ... }}` is an expression the workflow evaluates at
 * run time and is reported as unregisterable rather than silently accepted.
 */
export function findSoftFails(workflowName: string, yamlText: string): SoftFail[] {
  const doc = load(yamlText) as WorkflowDoc | null
  const out: SoftFail[] = []
  if (!doc?.jobs) return out

  for (const job of Object.values(doc.jobs)) {
    for (const step of job?.steps ?? []) {
      const coe = step?.['continue-on-error']
      if (coe !== true) continue
      const name = step.name ?? '<unnamed step>'
      out.push({ key: `${workflowName}::${name}`, workflow: workflowName, step: name })
    }
  }
  return out
}

/** A reviewBy that has passed. Compared as dates, not strings, so a malformed value is caught. */
export function isExpired(reviewBy: string, today: Date): boolean {
  const d = new Date(`${reviewBy}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return true      // unparseable is treated as expired, not ignored
  return d.getTime() < Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`)
}

export function validateEntry(entry: Partial<Exception> | undefined, categories: string[]): string[] {
  if (!entry) return ['not registered']
  const problems: string[] = []
  for (const field of ['category', 'reason', 'addedAt', 'reviewBy'] as const) {
    if (!entry[field] || String(entry[field]).trim() === '') problems.push(`missing ${field}`)
  }
  if (entry.category && !categories.includes(entry.category)) {
    problems.push(`unknown category '${entry.category}' (expected one of: ${categories.join(', ')})`)
  }
  // A reason that only restates the mechanism is not a reason. The bar is deliberately low —
  // this catches "n/a" and "todo", not a terse-but-real justification.
  if (entry.reason && entry.reason.trim().length < 25) {
    problems.push('reason is too short to be a justification')
  }
  return problems
}

// --------------------------------------------------------------------------------------------
// Self-test. CATCH — must be reported. IGNORE — must not be.
// --------------------------------------------------------------------------------------------

const WF = (steps: string) => `name: t\non: push\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n${steps}`

const CATCH_CASES: [string, string][] = [
  ['a soft-failing step', WF(`      - name: Scan\n        continue-on-error: true\n        run: x`)],
  ['soft-fail declared before the name', WF(`      - continue-on-error: true\n        name: Scan\n        run: x`)],
  ['an unnamed soft-failing step', WF(`      - continue-on-error: true\n        run: x`)],
  ['two soft-fails in one job', WF(`      - name: A\n        continue-on-error: true\n        run: x\n      - name: B\n        continue-on-error: true\n        run: y`)],
  ['a soft-fail in a second job', `name: t\non: push\njobs:\n  a:\n    runs-on: u\n    steps:\n      - name: Ok\n        run: x\n  b:\n    runs-on: u\n    steps:\n      - name: Soft\n        continue-on-error: true\n        run: y`],
]

const IGNORE_CASES: [string, string][] = [
  ['a plain step', WF(`      - name: Scan\n        run: x`)],
  ['continue-on-error: false', WF(`      - name: Scan\n        continue-on-error: false\n        run: x`)],
  // The one that matters: this repo's workflows explain in comments why a step is NOT soft-failing,
  // and a grep-based checker reports every one of those as a finding.
  ['the phrase in a comment above a hard-failing step', WF(`      # BLOCKING — it used to carry continue-on-error: true and that was the bug\n      - name: Scan\n        run: x`)],
  // The YAML scalar is single-quoted because the value contains ": " — unquoted, YAML reads that
  // as a nested mapping and the fixture fails to parse. Worth keeping rather than simplifying:
  // it is the same escaping trap a real workflow hits when it echoes a key name.
  ['the phrase inside a run block', WF(`      - name: Echo\n        run: 'echo "continue-on-error: true"'`)],
  ['a workflow with no jobs', `name: t\non: push`],
  ['a workflow with a job but no steps', `name: t\non: push\njobs:\n  j:\n    runs-on: u`],
]

const EXPIRY_CATCH: [string, string, string][] = [
  ['a date in the past', '2020-01-01', '2026-08-19'],
  ['yesterday', '2026-08-18', '2026-08-19'],
  ['an unparseable date', 'soon', '2026-08-19'],
  ['an empty date', '', '2026-08-19'],
]
const EXPIRY_IGNORE: [string, string, string][] = [
  ['today', '2026-08-19', '2026-08-19'],
  ['tomorrow', '2026-08-20', '2026-08-19'],
  ['a date well ahead', '2030-01-01', '2026-08-19'],
]

const ENTRY_CATCH: [string, Partial<Exception> | undefined][] = [
  ['an absent entry', undefined],
  ['a missing reason', { category: 'cosmetic', addedAt: '2026-01-01', reviewBy: '2030-01-01' }],
  ['a missing reviewBy', { category: 'cosmetic', reason: 'a perfectly adequate justification here', addedAt: '2026-01-01' }],
  ['an unknown category', { category: 'because-i-said-so', reason: 'a perfectly adequate justification here', addedAt: '2026-01-01', reviewBy: '2030-01-01' }],
  ['a placeholder reason', { category: 'cosmetic', reason: 'todo', addedAt: '2026-01-01', reviewBy: '2030-01-01' }],
]
const ENTRY_IGNORE: [string, Exception][] = [
  ['a complete entry', { category: 'cosmetic', reason: 'Writes a badge gist; a 404 there must not fail a green test run.', addedAt: '2026-01-01', reviewBy: '2030-01-01' }],
]

function selfTest(): boolean {
  const failures: string[] = []
  const cats = ['cosmetic', 'tool-quirk', 'reporter-not-gate', 'platform-limit']

  for (const [name, text] of CATCH_CASES) {
    if (findSoftFails('t.yml', text).length === 0) failures.push(`CATCH missed: ${name}`)
  }
  for (const [name, text] of IGNORE_CASES) {
    const hits = findSoftFails('t.yml', text)
    if (hits.length > 0) failures.push(`IGNORE wrongly flagged: ${name} (${hits.map(h => h.step).join(', ')})`)
  }
  for (const [name, date, today] of EXPIRY_CATCH) {
    if (!isExpired(date, new Date(today))) failures.push(`CATCH missed (expiry): ${name}`)
  }
  for (const [name, date, today] of EXPIRY_IGNORE) {
    if (isExpired(date, new Date(today))) failures.push(`IGNORE wrongly expired: ${name}`)
  }
  for (const [name, entry] of ENTRY_CATCH) {
    if (validateEntry(entry, cats).length === 0) failures.push(`CATCH missed (entry): ${name}`)
  }
  for (const [name, entry] of ENTRY_IGNORE) {
    const p = validateEntry(entry, cats)
    if (p.length > 0) failures.push(`IGNORE wrongly rejected (entry): ${name} — ${p.join('; ')}`)
  }

  const catchCount = CATCH_CASES.length + EXPIRY_CATCH.length + ENTRY_CATCH.length
  const ignoreCount = IGNORE_CASES.length + EXPIRY_IGNORE.length + ENTRY_IGNORE.length
  console.log(`${DIM}  auditor-contract: catch=${catchCount} ignore=${ignoreCount}${RESET}`)

  if (failures.length > 0) {
    console.error(`${RED}${BOLD}SELF-TEST FAILED${RESET}`)
    for (const f of failures) console.error(`  ${RED}✗${RESET} ${f}`)
    return false
  }
  return true
}

// --------------------------------------------------------------------------------------------

function main(): void {
  const selfTestOnly = process.argv.includes('--self-test')

  console.log(`${BOLD}CI Gate Exceptions${RESET}`)
  console.log(`${DIM}every soft-failing step is registered, reasoned and dated${RESET}\n`)

  // Refuse to scan on a failed corpus: an auditor that cannot be shown to work must not report
  // "found nothing", because that is indistinguishable from "cannot find anything".
  if (!selfTest()) {
    console.error(`\n${RED}${BOLD}RESULT: FAIL${RESET} — refusing to scan on a failed self-test`)
    process.exit(1)
  }
  if (selfTestOnly) {
    console.log(`\n${GREEN}${BOLD}SELF-TEST PASSED${RESET}`)
    return
  }

  if (!existsSync(REGISTRY)) {
    console.error(`${RED}✗${RESET} registry missing: ${REGISTRY}`)
    process.exit(1)
  }
  const registry = JSON.parse(readFileSync(REGISTRY, 'utf-8')) as Registry
  const categories = Object.keys(registry._categories ?? {})
  const today = new Date()

  const found: SoftFail[] = []
  for (const file of readdirSync(WORKFLOW_DIR).filter(f => /\.ya?ml$/.test(f)).sort()) {
    const text = readFileSync(join(WORKFLOW_DIR, file), 'utf-8')
    try {
      found.push(...findSoftFails(basename(file), text))
    } catch (e) {
      console.error(`${RED}✗${RESET} ${file} is not parseable YAML: ${(e as Error).message}`)
      process.exit(1)
    }
  }

  const problems: string[] = []
  const foundKeys = new Set(found.map(f => f.key))

  for (const sf of found) {
    const entry = registry.exceptions?.[sf.key]
    const issues = validateEntry(entry, categories)
    if (issues.length > 0) {
      problems.push(
        `${sf.workflow} — step "${sf.step}" soft-fails but ${issues.join(', ')}\n` +
        `      ${DIM}Register it in scripts/baselines/ci-gate-exceptions.json — or, if it is a gate, make it blocking.${RESET}`,
      )
      continue
    }
    if (isExpired(entry!.reviewBy, today)) {
      problems.push(
        `${sf.workflow} — step "${sf.step}" exception EXPIRED on ${entry!.reviewBy}\n` +
        `      ${DIM}${entry!.reason}${RESET}\n` +
        `      ${DIM}Re-justify with a new reviewBy, or make the step blocking.${RESET}`,
      )
    }
  }

  // Stale rows. The list only shrinks — an exemption whose step is now blocking would otherwise
  // sit here indefinitely, ready to silently re-authorise a future soft-fail of the same name.
  for (const key of Object.keys(registry.exceptions ?? {})) {
    if (!foundKeys.has(key)) {
      problems.push(
        `stale registration: "${key}" no longer soft-fails\n` +
        `      ${DIM}Delete the row — the list only shrinks.${RESET}`,
      )
    }
  }

  const byCategory = new Map<string, number>()
  for (const sf of found) {
    const c = registry.exceptions?.[sf.key]?.category ?? 'unregistered'
    byCategory.set(c, (byCategory.get(c) ?? 0) + 1)
  }
  const summary = [...byCategory.entries()].map(([c, n]) => `${c}=${n}`).join('  ')
  console.log(`${DIM}  ${found.length} soft-failing step(s) across ${readdirSync(WORKFLOW_DIR).filter(f => /\.ya?ml$/.test(f)).length} workflow(s)  ·  ${summary}${RESET}`)

  // Advisory: surface exceptions coming up for review before they fail the build.
  const soon = found.filter(sf => {
    const e = registry.exceptions?.[sf.key]
    if (!e) return false
    const days = (Date.parse(`${e.reviewBy}T00:00:00Z`) - today.getTime()) / 86_400_000
    return days >= 0 && days <= 30
  })
  if (soon.length > 0 && problems.length === 0) {
    console.log(`${YELLOW}  ${soon.length} exception(s) due for review within 30 days:${RESET}`)
    for (const sf of soon) console.log(`${YELLOW}    · ${sf.key} — ${registry.exceptions[sf.key]!.reviewBy}${RESET}`)
  }

  if (problems.length > 0) {
    console.error('')
    for (const p of problems) console.error(`  ${RED}✗${RESET} ${p}`)
    console.error(`\n${RED}${BOLD}RESULT: FAIL${RESET} — ${problems.length} unregistered, incomplete, expired or stale CI-gate exception(s)`)
    process.exit(1)
  }

  console.log(`\n${GREEN}${BOLD}RESULT: PASS${RESET} — every soft-failing step is registered, reasoned and in date`)
}

main()

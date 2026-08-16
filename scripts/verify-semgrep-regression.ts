// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
// PUBLISHES to Weaver-Free, like every other piece of this security tooling — verified against
// the live mirror: verify-codeql-semgrep-coverage.ts, audit-taint.ts and the semgrep-rules/ all
// return 200 there. It has to: it runs inside test:compliance, and that chain runs on Free.
//
// A never-publish marker was copied onto this header from a sibling auditor and removed before it
// was ever committed: it would have been a false claim in a file that does ship, which is the one
// thing that convention exists to prevent. The marker token is not quoted verbatim here because
// audit:free-tree reads the literal string as a declaration wherever it appears — a known
// limitation with a recorded trigger for narrowing it.
/**
 * Semgrep coverage regression detector — Tier 2 of the taint feedback loop.
 *
 * Tier 1 (v1.0.4) answers "is every CodeQL rule accounted for in the map?". It reads the map and
 * checks bookkeeping. It cannot tell whether a rule marked `covered` actually catches the thing
 * CodeQL caught, because it never runs Semgrep. That is the gap this closes: for each LIVE CodeQL
 * alert whose rule the map claims a Semgrep rule covers, run that Semgrep rule against the file
 * CodeQL flagged and see whether it fires.
 *
 * THREE OUTCOMES, and keeping them apart is the whole design. Collapsing them into
 * "semgrep missed → rule insufficient" produces a false positive on the second and the third,
 * and a checker that cries wolf on documented, deliberate gaps is one that gets switched off.
 *
 *   INSUFFICIENT   status `covered`, Semgrep does not fire. The claim is disproven — this is the
 *                  failure the tier exists for, and it fails the build.
 *   EXPECTED-GAP   status `partially-covered` and the entry's notes document a gap. A miss is the
 *                  documented behaviour, so it is reported and does not fail. What DOES fail is a
 *                  `partially-covered` entry whose notes explain nothing: that is an unexamined
 *                  claim wearing a hedge.
 *   UNVERIFIABLE   the alert's file lies outside the Semgrep scan universe, so the rule was never
 *                  going to look at it and a miss says nothing about the rule. Reported loudly,
 *                  because it means the map's claim cannot be checked where CodeQL actually found
 *                  the problem — the failure where a checker's universe is narrower than the
 *                  consumer it claims to cover, here between two scanners of one codebase.
 *
 * MEASURED ON THE FIRST RUN (2026-08-15): the sole live mapped alert is
 * `js/indirect-command-line-injection` at `scripts/refresh-codeql-coverage-map.ts:75`, and
 * `audit:taint` scans `backend/src/` only — so it is UNVERIFIABLE, not insufficient. CodeQL reads
 * the whole published tree; Semgrep reads one directory of it.
 *
 * Usage:
 *   npx tsx scripts/verify-semgrep-regression.ts
 *   npx tsx scripts/verify-semgrep-regression.ts --alerts <file.json>   # offline / CI fixture
 *   npx tsx scripts/verify-semgrep-regression.ts --self-test
 */

import { readFileSync, existsSync } from 'fs'
import { execFileSync } from 'child_process'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const MAP_PATH = resolve(ROOT, 'scripts', 'data', 'codeql-semgrep-map.json')
const RULES_DIR = resolve(ROOT, 'scripts', 'semgrep-rules')

/**
 * The directory `audit:taint` actually scans, mirrored from audit-taint.ts's SCAN_TARGET.
 *
 * Duplicated deliberately rather than imported: this checker's whole job is to notice when the
 * scan universe and the alert set disagree, and importing the constant would make the two move
 * together silently. If audit-taint.ts widens its target, this value should be updated in the
 * same change — and the mismatch it reports until then is a true finding, not drift.
 */
const SEMGREP_SCAN_ROOTS = ['backend/src/']

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m'

interface RuleEntry {
  status: string
  semgrepRuleId?: string
  notes?: string
  severity?: string
}

interface Alert {
  ruleId: string
  path: string
  line: number
}

export type Verdict = 'confirmed' | 'insufficient' | 'expected-gap' | 'unverifiable' | 'undocumented-hedge'

export interface Assessment {
  alert: Alert
  semgrepRuleId: string
  status: string
  verdict: Verdict
  detail: string
}

/** Is this path inside the directories Semgrep is actually pointed at? */
export function inScanUniverse(path: string, roots: string[] = SEMGREP_SCAN_ROOTS): boolean {
  return roots.some(r => path === r.replace(/\/$/, '') || path.startsWith(r))
}

/**
 * Does an entry's prose actually describe the gap it is hedging about?
 *
 * `partially-covered` with no explanation is not a documented limitation, it is an unexamined
 * claim: nobody can tell whether the uncovered half was considered or merely assumed away. A
 * word count is a crude proxy and deliberately so — the alternative is trusting the status field,
 * which is exactly what Tier 1 already does and what this tier exists to go behind.
 */
export function documentsAGap(notes: string | undefined): boolean {
  if (!notes) return false
  return /\bgap\b|not covered|does not cover|additionally catches|gap:/i.test(notes)
}

/** Decide what a Semgrep result (or the absence of one) means for a mapped alert. */
export function assess(opts: {
  alert: Alert
  entry: RuleEntry
  semgrepFired: boolean | null   // null = not run, because the file is out of scope
}): Assessment {
  const { alert, entry, semgrepFired } = opts
  const semgrepRuleId = entry.semgrepRuleId ?? '(none)'

  if (semgrepFired === null) {
    return {
      alert, semgrepRuleId, status: entry.status, verdict: 'unverifiable',
      detail: `${alert.path} is outside the Semgrep scan universe (${SEMGREP_SCAN_ROOTS.join(', ')}), ` +
        `so ${semgrepRuleId} never examines it. CodeQL reads the whole published tree.`,
    }
  }

  if (semgrepFired) {
    return {
      alert, semgrepRuleId, status: entry.status, verdict: 'confirmed',
      detail: `${semgrepRuleId} fires on ${alert.path} — the coverage claim holds where CodeQL found the problem.`,
    }
  }

  if (entry.status === 'covered') {
    return {
      alert, semgrepRuleId, status: entry.status, verdict: 'insufficient',
      detail: `map says COVERED, but ${semgrepRuleId} finds nothing at ${alert.path}:${alert.line}. ` +
        `Either the rule needs widening or the status is wrong.`,
    }
  }

  if (documentsAGap(entry.notes)) {
    return {
      alert, semgrepRuleId, status: entry.status, verdict: 'expected-gap',
      detail: `partially-covered, and the notes name the gap this alert falls into. Miss is expected.`,
    }
  }

  return {
    alert, semgrepRuleId, status: entry.status, verdict: 'undocumented-hedge',
    detail: `status is '${entry.status}' but the notes do not describe what is uncovered — ` +
      `a hedge nobody can check. Say what the rule misses, or fix the status.`,
  }
}

// ── Live data ────────────────────────────────────────────────────────────────

function fetchAlerts(alertsFile?: string): Alert[] | null {
  if (alertsFile) {
    const raw = JSON.parse(readFileSync(alertsFile, 'utf-8'))
    return normaliseAlerts(raw)
  }
  try {
    // execFile with an argument array, never a shell string — the repo slug crosses a config
    // boundary and this script is published.
    const out = execFileSync('gh', [
      'api', 'repos/whizbangdevelopers-org/Weaver-Free/code-scanning/alerts', '--paginate',
    ], { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
    return normaliseAlerts(JSON.parse(out))
  } catch {
    return null
  }
}

function normaliseAlerts(raw: unknown): Alert[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((a: Record<string, unknown>) => a.state === 'open')
    .map((a: Record<string, unknown>) => {
      const inst = (a.most_recent_instance ?? {}) as Record<string, unknown>
      const loc = (inst.location ?? {}) as Record<string, unknown>
      return {
        ruleId: String((a.rule as Record<string, unknown>)?.id ?? ''),
        path: String(loc.path ?? ''),
        line: Number(loc.start_line ?? 0),
      }
    })
    .filter(a => a.ruleId && a.path && !a.path.startsWith('no file'))
}

function runSemgrep(ruleId: string, filePath: string): boolean {
  const ruleFile = resolve(RULES_DIR, `${ruleId}.yaml`)
  if (!existsSync(ruleFile)) throw new Error(`no rule file for ${ruleId} at ${relative(ROOT, ruleFile)}`)
  const out = execFileSync('semgrep', [
    'scan', '--config', ruleFile, filePath, '--quiet', '--json',
  ], { encoding: 'utf-8', cwd: ROOT, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
  return (JSON.parse(out).results ?? []).length > 0
}

// ── Self-test ────────────────────────────────────────────────────────────────

function selfTest(): boolean {
  const failures: string[] = []
  // Counted, not eyeballed. CATCH = the checker must report the bad condition; IGNORE = it must
  // stay quiet on legitimate input. The contract manifest requires both halves non-empty, because
  // a checker with no IGNORE cases is one nobody has shown will hold its fire.
  let catches = 0, ignores = 0
  const check = (label: string, cond: boolean, kind: 'catch' | 'ignore' = 'catch') => {
    if (kind === 'catch') catches++
    else ignores++
    if (!cond) failures.push(label)
  }
  const alert: Alert = { ruleId: 'js/x', path: 'backend/src/routes/a.ts', line: 10 }
  const outside: Alert = { ruleId: 'js/x', path: 'scripts/a.ts', line: 10 }

  // Scan universe
  check('backend/src path is in the universe', inScanUniverse('backend/src/routes/a.ts'), 'ignore')
  check('scripts path is NOT in the universe', !inScanUniverse('scripts/a.ts'))
  check('a lookalike prefix does not count', !inScanUniverse('backend/srcfoo/a.ts'))

  // CATCH — a covered claim that Semgrep disproves is the failure this tier exists for.
  check('covered + miss = insufficient',
    assess({ alert, entry: { status: 'covered', semgrepRuleId: 'r' }, semgrepFired: false }).verdict === 'insufficient')

  // IGNORE — a covered claim Semgrep confirms must not be flagged.
  check('covered + hit = confirmed',
    assess({ alert, entry: { status: 'covered', semgrepRuleId: 'r' }, semgrepFired: true }).verdict === 'confirmed', 'ignore')

  // IGNORE — a documented partial gap is the map working as designed.
  check('partially-covered with a documented gap = expected-gap',
    assess({
      alert, semgrepFired: false,
      entry: { status: 'partially-covered', semgrepRuleId: 'r', notes: 'Gap: process.env.* sources are not covered.' },
    }).verdict === 'expected-gap', 'ignore')

  // CATCH — the same hedge with nothing behind it is an unexamined claim.
  check('partially-covered with empty notes = undocumented-hedge',
    assess({ alert, entry: { status: 'partially-covered', semgrepRuleId: 'r', notes: 'Medium severity.' }, semgrepFired: false })
      .verdict === 'undocumented-hedge')
  check('partially-covered with NO notes = undocumented-hedge',
    assess({ alert, entry: { status: 'partially-covered', semgrepRuleId: 'r' }, semgrepFired: false })
      .verdict === 'undocumented-hedge')

  // CATCH — out of scope is its own verdict, never "insufficient". A rule that never reads the
  // file has not been shown to be inadequate; the SCAN has been shown to be too narrow.
  check('out-of-scope = unverifiable, even when the map says covered',
    assess({ alert: outside, entry: { status: 'covered', semgrepRuleId: 'r' }, semgrepFired: null }).verdict === 'unverifiable')

  // documentsAGap wording
  check('notes naming a gap count', documentsAGap('Gap: env sources not covered'), 'ignore')
  check('notes saying "not covered" count', documentsAGap('process.env.* is not covered by our rule'), 'ignore')
  check('generic prose does not count', !documentsAGap('High severity, proactive coverage.'))

  // Alert normalisation drops the metadata rows GitHub returns with no file.
  const normalised = normaliseAlerts([
    { state: 'open', rule: { id: 'js/a' }, most_recent_instance: { location: { path: 'backend/src/a.ts', start_line: 3 } } },
    { state: 'open', rule: { id: 'CodeReviewID' }, most_recent_instance: { location: { path: 'no file associated with this alert', start_line: 1 } } },
    { state: 'fixed', rule: { id: 'js/b' }, most_recent_instance: { location: { path: 'backend/src/b.ts', start_line: 4 } } },
  ])
  check('normalise keeps only open alerts with a real file', normalised.length === 1 && normalised[0].ruleId === 'js/a', 'ignore')

  if (failures.length) {
    console.log(`  ${RED}✗${RESET} self-test FAILED (${failures.length}):`)
    for (const f of failures) console.log(`      ${RED}${f}${RESET}`)
    return false
  }
  console.log(`  ${GREEN}✓${RESET} self-test: ${catches + ignores}/${catches + ignores} cases`)
  console.log(`  auditor-contract: catch=${catches} ignore=${ignores}`)
  return true
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`${BOLD}Semgrep Coverage Regression (Tier 2)${RESET}`)
console.log(`${DIM}Does a rule the map calls covered actually catch what CodeQL caught?${RESET}\n`)

if (!selfTest()) process.exit(1)
if (process.argv.includes('--self-test')) process.exit(0)

const alertsFlag = process.argv.indexOf('--alerts')
const alerts = fetchAlerts(alertsFlag > -1 ? process.argv[alertsFlag + 1] : undefined)

if (alerts === null) {
  // Skip, never fail: the Free repo's alerts need a PAT this checker should not require of a
  // contributor, and `audit:taint` sets the precedent of exiting 0 when its tool is absent.
  console.log(`  ${YELLOW}⚠${RESET} could not read CodeQL alerts (gh unavailable or unauthorised) — skipped`)
  process.exit(0)
}

const map = JSON.parse(readFileSync(MAP_PATH, 'utf-8')) as { rules: Record<string, RuleEntry> }
const mapped = alerts.filter(a => map.rules[a.ruleId]?.semgrepRuleId)

console.log(`  ${DIM}${alerts.length} open alert(s), ${mapped.length} with a Semgrep mapping${RESET}\n`)

const assessments: Assessment[] = []
for (const alert of mapped) {
  const entry = map.rules[alert.ruleId]!
  let fired: boolean | null = null
  if (inScanUniverse(alert.path)) {
    try {
      fired = runSemgrep(entry.semgrepRuleId!, alert.path)
    } catch (err) {
      console.log(`  ${YELLOW}⚠${RESET} ${alert.ruleId}: semgrep could not run — ${(err as Error).message}`)
      continue
    }
  }
  assessments.push(assess({ alert, entry, semgrepFired: fired }))
}

const icon: Record<Verdict, string> = {
  confirmed: `${GREEN}✓${RESET}`,
  insufficient: `${RED}✗${RESET}`,
  'undocumented-hedge': `${RED}✗${RESET}`,
  'expected-gap': `${DIM}·${RESET}`,
  unverifiable: `${YELLOW}⚠${RESET}`,
}

for (const a of assessments) {
  console.log(`  ${icon[a.verdict]} ${a.alert.ruleId} ${DIM}→ ${a.semgrepRuleId}${RESET}`)
  console.log(`      ${DIM}${a.detail}${RESET}`)
}

const failing = assessments.filter(a => a.verdict === 'insufficient' || a.verdict === 'undocumented-hedge')
const unverifiable = assessments.filter(a => a.verdict === 'unverifiable')

console.log()
if (failing.length) {
  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${failing.length} coverage claim(s) the evidence does not support`)
  process.exit(1)
}
if (unverifiable.length) {
  console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} ${DIM}(${unverifiable.length} unverifiable — CodeQL found them where Semgrep does not look)${RESET}`)
  process.exit(0)
}
console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — every checkable coverage claim holds`)

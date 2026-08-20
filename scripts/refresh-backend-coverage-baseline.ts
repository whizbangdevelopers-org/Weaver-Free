// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Ratchet the backend coverage floor UP to match current measured coverage.
 *
 * Runs the backend suite with coverage, reads the v8 JSON summary, and writes
 * `scripts/baselines/backend-coverage.json` with the measurement plus a floor set one buffer
 * below it.
 *
 * **It refuses to lower any threshold.** That is the whole point of the script existing rather
 * than the file being hand-edited: a ratchet you can turn both ways is not a ratchet, and
 * "adjusting a threshold to make currently-bad numbers pass" is named explicitly as gaming in
 * ~/.claude/rules/never-game-auditors.md. If coverage genuinely dropped, restore the coverage —
 * or, if the drop is legitimate (code deleted, a module extracted), edit the file by hand in a
 * commit whose message says which and why, so the decision is visible in the diff.
 *
 *   npm run baseline:backend-coverage:refresh          # from the repo's code/ directory
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')                       // code/
const BACKEND = resolve(REPO, 'backend')
const BASELINE = resolve(HERE, 'baselines/backend-coverage.json')
const SUMMARY = resolve(BACKEND, 'coverage/coverage-summary.json')

/** Points below measured. Absorbs v8 run-to-run variance on async paths, not a real regression. */
const BUFFER = 2

type Metrics = { statements: number; branches: number; functions: number; lines: number }

function pct(n: number): number {
  return Math.round(n * 100) / 100
}

console.log('Running backend suite with coverage (this takes ~40s)…')

// A NON-ZERO EXIT IS EXPECTED HERE and must not abort the run.
//
// When coverage has dropped below the current floor, vitest fails the threshold check — and that
// is precisely the case this script exists to report, with the "refusing to lower" message below.
// Letting execFileSync throw made that message unreachable in the only scenario that reaches it:
// the script died on a stack trace instead. Found by testing the refusal path rather than
// assuming it worked, which is the same lesson the coverage gate itself encodes.
//
// A genuine failure (tests broken, vitest missing) is distinguished below by the summary file
// being absent or unparseable, not by the exit code.
try {
  execFileSync('npx', ['vitest', 'run', '--coverage', '--coverage.reporter=json-summary', '--coverage.reporter=text'], {
    cwd: BACKEND,
    stdio: 'inherit',
  })
} catch {
  console.log('\n(vitest exited non-zero — continuing, since an unmet threshold is a case this script reports)')
}

let summary: { total: Record<keyof Metrics, { pct: number }> }
try {
  summary = JSON.parse(readFileSync(SUMMARY, 'utf-8'))
} catch {
  console.error(
    `\nNo readable coverage summary at ${SUMMARY}.\n` +
      'That means the run failed for a reason other than the threshold — broken tests, or a\n' +
      'vitest/coverage problem. Fix that first; this script cannot report on a run that did not\n' +
      'produce a measurement.\n',
  )
  process.exit(1)
}

const measured: Metrics = {
  statements: pct(summary.total.statements.pct),
  branches: pct(summary.total.branches.pct),
  functions: pct(summary.total.functions.pct),
  lines: pct(summary.total.lines.pct),
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf-8')) as {
  thresholds: Metrics
  _currentMeasurements: Record<string, unknown>
  _lastRefreshed: string
  [k: string]: unknown
}

const proposed: Metrics = {
  statements: Math.floor(measured.statements) - BUFFER,
  branches: Math.floor(measured.branches) - BUFFER,
  functions: Math.floor(measured.functions) - BUFFER,
  lines: Math.floor(measured.lines) - BUFFER,
}

// Refuse to ratchet DOWN. Report every metric so a partial regression is visible, not just the
// first one hit.
const regressions = (Object.keys(proposed) as (keyof Metrics)[])
  .filter((k) => proposed[k] < baseline.thresholds[k])
  .map((k) => `  ${k}: floor ${baseline.thresholds[k]} → would become ${proposed[k]} (measured ${measured[k]}%)`)

if (regressions.length > 0) {
  console.error('\nREFUSING to lower the coverage floor:\n')
  console.error(regressions.join('\n'))
  console.error(
    '\nThe floor only goes up. Coverage has dropped since the last refresh — restore it rather\n' +
      'than lowering the gate. If the drop is legitimate (code deleted, a module extracted), edit\n' +
      'scripts/baselines/backend-coverage.json by hand in a commit that says which and why.\n',
  )
  process.exit(1)
}

const unchanged = (Object.keys(proposed) as (keyof Metrics)[]).every(
  (k) => proposed[k] === baseline.thresholds[k],
)

baseline.thresholds = proposed
baseline._currentMeasurements = {
  ...measured,
  measuredAt: new Date().toISOString().slice(0, 10),
}
baseline._lastRefreshed = new Date().toISOString().slice(0, 10)

writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n')

console.log('\nMeasured:', measured)
console.log('New floor:', proposed)
console.log(
  unchanged
    ? '\nFloor unchanged — baseline refreshed with the current measurement.'
    : '\nFloor RAISED. Commit this with a message saying what coverage was added.',
)

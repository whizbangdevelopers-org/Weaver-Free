// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Taint Analysis Auditor — runs Semgrep with custom taint rules
 *
 * Covers four taint flows the regex-based audit:sast cannot detect
 * (cross-expression data flow):
 *   no-raw-execfile-args   — user input reaching shell command args (CWE-78)
 *   no-user-input-in-path  — user input reaching filesystem paths (CWE-22)
 *   no-unvalidated-jwt-claim — unverified JWT payload in auth decisions (CWE-347)
 *   no-ssrf-in-fetch       — user input reaching outbound HTTP URLs (CWE-918)
 *
 * Requires: semgrep in PATH (`nix profile install nixpkgs#semgrep`)
 * Rules:    scripts/semgrep-rules/*.yaml
 *
 * Exit 0 = clean or semgrep not installed (warning only).
 * Exit 1 = findings detected.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { join } from 'node:path'

const RULES_DIR = join(import.meta.dirname, 'semgrep-rules')
const SCAN_TARGET = join(import.meta.dirname, '..', 'backend', 'src')

const RULES = [
  'no-raw-execfile-args.yaml',
  'no-user-input-in-path.yaml',
  'no-unvalidated-jwt-claim.yaml',
  'no-ssrf-in-fetch.yaml',
]

interface SemgrepResult {
  results: Array<{
    check_id: string
    path: string
    start: { line: number }
    extra: { message: string; lines: string; severity: string }
  }>
  errors: Array<{ type: string; long_msg?: string; message?: string }>
}

function checkSemgrep(): boolean {
  const result = spawnSync('semgrep', ['--version'], { encoding: 'utf-8' })
  return result.status === 0
}

// A single scan resolves to exactly one of three outcomes. The distinction is
// load-bearing for the retry policy below: 'findings' is DETERMINISTIC (it
// depends only on source + rules), whereas 'infra' is a failure to complete the
// analysis at all (crash, kill, empty/unparseable output, or a semgrep
// analysis-error such as a Timeout) — which on a busy host is load-dependent and
// transient.
type ScanOutcome =
  | { kind: 'clean' }
  | { kind: 'findings'; results: SemgrepResult['results'] }
  | { kind: 'infra'; detail: string }

function scanOnce(args: string[]): ScanOutcome {
  let rawOutput: string
  try {
    rawOutput = execFileSync('semgrep', args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number }
    // Exit 1 WITH a JSON body on stdout is semgrep's "findings exist" signal —
    // deterministic, parsed below. Any other non-zero exit (or exit 1 with no
    // stdout) is semgrep failing to run: crash, OOM-kill, signal, startup race.
    if (e.status === 1 && e.stdout) {
      rawOutput = e.stdout
    } else {
      const stderr = e.stderr?.trim()
      return { kind: 'infra', detail: `semgrep exited ${e.status ?? '?'}${stderr ? `\n${stderr}` : ' (no stderr)'}` }
    }
  }

  let data: SemgrepResult
  try {
    data = JSON.parse(rawOutput) as SemgrepResult
  } catch {
    const preview = rawOutput ? rawOutput.slice(0, 300) : '(empty stdout)'
    return { kind: 'infra', detail: `unparseable semgrep JSON — first 300 bytes: ${preview}` }
  }

  const { results, errors } = data

  // semgrep records a rule/file it could NOT fully analyze (Timeout, crashed
  // worker, …) in errors[]. That is analysis-incompleteness, not a taint finding,
  // and a Timeout is the canonical load-induced transient. Classify it 'infra' so
  // it is retried; a genuinely broken rule fails on every attempt and surfaces
  // loudly (with this detail) at the end — same end state as before, better
  // diagnostics.
  if (errors.length > 0) {
    const detail = errors
      .map(e => `${e.type ?? 'error'}: ${e.long_msg ?? e.message ?? JSON.stringify(e)}`)
      .join('\n  ')
    return { kind: 'infra', detail: `semgrep reported ${errors.length} analysis error(s):\n  ${detail}` }
  }

  if (results.length === 0) return { kind: 'clean' }
  return { kind: 'findings', results }
}

// Synchronous sleep — scanOnce() uses execFileSync, so the whole auditor is
// synchronous and cannot await a timer.
function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function run(): void {
  console.log('\x1b[1mTaint Analysis Audit\x1b[0m')
  console.log('\x1b[2mRuns Semgrep custom taint rules on backend/src/\x1b[0m\n')

  // A missing engine is NOT a pass. This used to warn and exit 0, which made "the code is clean"
  // and "nothing was analysed" the same green tick — and this auditor is the only place taint
  // analysis happens anywhere: test:compliance runs from the git hooks, no workflow runs semgrep,
  // so there is no CI backstop to catch what a skipping local run misses. It found 3 real findings
  // in one route the day this was written; on a machine without semgrep those would have pushed
  // clean. An auditor that cannot report "I could not look" is indistinguishable from one that
  // looked and found nothing (core/security.md, "never trust an auditor that has never failed").
  //
  // semgrep is in the repo devShell (code/flake.nix), so `nix develop` has it. The escape hatch is
  // deliberate and visible rather than silent — same shape as a suppression needing a reason.
  if (!checkSemgrep()) {
    if (process.env.ALLOW_MISSING_SEMGREP === '1') {
      console.log('\x1b[33m⚠ semgrep not found — SKIPPED via ALLOW_MISSING_SEMGREP=1\x1b[0m')
      console.log('\x1b[33m  Taint analysis did NOT run. This is not a clean result.\x1b[0m')
      process.exit(0)
    }
    console.log('\x1b[31m✗ semgrep not found in PATH — taint analysis cannot run\x1b[0m')
    console.log('  This fails rather than passing: a check that cannot look must not report clean.')
    console.log('  Fix:  nix develop   (semgrep is in the devShell)')
    console.log('  Or:   nix profile install nixpkgs#semgrep')
    console.log('  Deliberate bypass (records that the check did not run): ALLOW_MISSING_SEMGREP=1')
    process.exit(1)
  }

  const configArgs = RULES.flatMap(r => ['--config', join(RULES_DIR, r)])
  const args = [
    'scan',
    // --jobs 1 is the DETERMINISTIC fix for the intermittent `semgrep exited 2` this auditor kept
    // hitting: semgrep-core's parallel scan opens one io_uring ring PER JOB, and several rings blow
    // past a low RLIMIT_MEMLOCK (king's hard limit is 8 MB) → `Unix_error: Out of memory
    // io_uring_queue_init`. That is the 'infra' failure the retry below was chasing (3 retries were
    // not enough under sustained contention). One job = one ring = fits the memlock, every time.
    // backend/src/ is ~100 files / 4 rules, so the serial scan is a couple of seconds — a cheap
    // price for a green that means "clean", not "got lucky". (Root-cause the flake, don't re-push.)
    '--jobs', '1',
    ...configArgs,
    '--metrics=off',
    '--json',
    SCAN_TARGET,
  ]

  // WHY RETRY (and why it is not gaming): this auditor runs inside
  // run-compliance.ts's parallel phase — ~50 sibling auditors spawned at once —
  // on a busy control-plane host. semgrep is the one heavy subprocess there; a
  // transient whole-machine load spike can starve, kill, or truncate it. The
  // failure then shows up as a mystery RED that a human clears by re-pushing —
  // which is exactly the retry-until-green that never-game-auditors.md forbids.
  // So the retry lives HERE, bounded and explicit, instead of in a developer's
  // fingers. It is safe because ONLY 'infra' outcomes are retried: a real taint
  // finding is deterministic and classified 'findings' (never retried), so a
  // retry can neither manufacture nor suppress a finding. A persistent infra
  // failure (a truly broken rule, or a real crash) fails on every attempt and
  // then exits 1 loudly WITH the captured detail — the old code discarded that
  // detail, which is why the original flake was undiagnosable.
  const MAX_ATTEMPTS = 3
  let outcome: ScanOutcome = { kind: 'infra', detail: '(not run)' }
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    outcome = scanOnce(args)
    if (outcome.kind !== 'infra') break
    if (attempt < MAX_ATTEMPTS) {
      console.error(
        `\x1b[33m⚠ taint analysis did not complete (attempt ${attempt}/${MAX_ATTEMPTS}) — transient infra failure, retrying:\x1b[0m`,
      )
      console.error(`  ${outcome.detail.replace(/\n/g, '\n  ')}`)
      sleepMs(2000 * attempt)
    }
  }

  if (outcome.kind === 'infra') {
    console.error(`\x1b[31m✗ semgrep taint analysis could not complete after ${MAX_ATTEMPTS} attempts\x1b[0m`)
    console.error(`  ${outcome.detail.replace(/\n/g, '\n  ')}`)
    console.error('  This is an ANALYSIS FAILURE, not a clean result — it is not safe to treat as pass.')
    process.exit(1)
  }

  if (outcome.kind === 'clean') {
    console.log(`\x1b[32m✓\x1b[0m 0 taint findings — ${RULES.length} rules, clean`)
    process.exit(0)
  }

  console.error(`\x1b[31m✗ ${outcome.results.length} taint finding(s) detected:\x1b[0m\n`)
  for (const finding of outcome.results) {
    const rule = finding.check_id.replace(/^.*\./, '')
    const loc = `${finding.path}:${finding.start.line}`
    const line = finding.extra.lines.trim()
    console.error(`  \x1b[31m[${rule}]\x1b[0m ${loc}`)
    console.error(`    ${line}`)
    console.error(`    ${finding.extra.message.split('\n')[0]}`)
    console.error()
  }
  process.exit(1)
}

run()

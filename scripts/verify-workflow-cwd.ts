#!/usr/bin/env tsx
// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:workflow-cwd — a workflow step that runs npm/npx/node must say WHERE.
 *
 * WHY THIS EXISTS
 * ---------------
 * Code lives under `code/` in this repo, so a workflow step with no
 * `working-directory` runs at the repo root, where there is no package.json and no
 * package-lock.json. The failure is always one of two messages:
 *
 *   Dependencies lock file is not found          (setup-node with cache: and no path)
 *   npm ci can only install with an existing …   (npm run at the root)
 *
 * This is documented as G-devops-2026-06-02-004 and it recurred FOUR times on
 * 2026-07-22 alone — in dependabot-tracker.yml, security-scan.yml and
 * audit-code-scanning.yml. The knowledge existed; nothing enforced it, and nothing
 * noticed, because the affected workflows are dispatch- or schedule-only and had
 * between one and zero successful runs in their entire history. A control you must
 * remember is not a control (same escalation the npm-cwd shell hook received).
 *
 * Two rules:
 *   1. A `run:` step invoking npm/npx/node/yarn/pnpm needs `working-directory: code`
 *      — on the step, or inherited from `defaults.run.working-directory` on the job
 *      or workflow.
 *   2. `actions/setup-node` with `cache:` needs `cache-dependency-path`, because the
 *      cache resolver looks for the lockfile at the repo root regardless of cwd.
 *
 * Deliberately a line-based static parser, matching the house pattern for workflow
 * auditors (verify-sync-exclude-cruft.ts, verify-release-rsync-paths.ts): no YAML
 * dependency, cheap enough to run on every push.
 *
 * Suppress a genuine exception with `# workflow-cwd-ok: <reason>` on the step's
 * `- name:` line. The reason is required — a bare suppression will not match.
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const WORKFLOW_DIR = resolve(PROJECT_ROOT, '.github', 'workflows')

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m'

interface Finding { file: string; line: number; step: string; message: string }

/**
 * Only the invocations that actually READ the local manifest are cwd-sensitive.
 *
 * The first cut of this rule matched any `npm`/`npx` token and immediately produced
 * two false positives on legitimate steps: `npm view <pkg>` (a pure registry query —
 * version-drift-check.yml uses it four times and passes), and
 * `npx --yes @socketsecurity/cli` (fetches its own package; nothing local is read).
 * Per ~/.claude/rules/never-game-auditors.md the input was legitimate, so the rule
 * was narrowed rather than the workflows reworded — and both shapes are pinned in
 * the self-test below so the narrowing cannot silently regress.
 */
const NPM_LOCAL = /\bnpm\s+(ci|install|i|add|run|run-script|test|start|audit|exec|rebuild|update|prune|dedupe|ls|list|pack|publish|version|link|outdated)\b/
/** npx is only cwd-bound when it names a path relative to the package root. */
const NPX_LOCAL = /\bnpx\s[^\n]*(?:\s|=)(?:\.\.?\/|scripts\/|src\/|backend\/|tui\/|testing\/)/
const YARN_PNPM = /\b(yarn|pnpm)\s+\S/
const CWD_SENSITIVE = { test: (s: string) => NPM_LOCAL.test(s) || NPX_LOCAL.test(s) || YARN_PNPM.test(s) }
/** …unless the invocation carries its own absolute path (cwd-independent-tooling.md). */
const SELF_PINNED = /--prefix[=\s]+\//

export function scanWorkflow(file: string, text: string): Finding[] {
  const findings: Finding[] = []
  const lines = text.split('\n')

  // A `defaults: run: working-directory:` anywhere (workflow or job level) is
  // treated as covering the steps below it — deliberately lenient, because a false
  // PASS here is far cheaper than a false FAIL that makes people distrust the rule.
  const hasDefaultCwd = /defaults:\s*\n\s*run:\s*\n\s*working-directory:\s*code\b/.test(text)

  let stepName = ''
  let stepIndent = 0
  let stepLine = 0
  let stepBody: string[] = []
  let stepHasCwd = false
  let stepSuppressed = false

  const flushStep = () => {
    if (!stepName) return
    const body = stepBody.join('\n')
    if (stepSuppressed) return

    // ORDER MATTERS. `working-directory` — step-level or `defaults.run.` — applies to
    // `run:` steps ONLY; it has no effect whatsoever on a `uses:` action. So the
    // setup-node cache check must run BEFORE any cwd early-return, or a workflow with
    // a job default silently exempts itself. Caught by negative-testing against the
    // real test.yml, which has exactly that default and went on passing with its
    // cache-dependency-path deleted — the fixture tests never surfaced it.
    if (/uses:\s*actions\/setup-node@/.test(body)) {
      if (/\bcache:\s*['"]?npm/.test(body) && !/cache-dependency-path:/.test(body)) {
        findings.push({ file, line: stepLine, step: stepName,
          message: "setup-node sets `cache: 'npm'` without `cache-dependency-path` — the resolver looks at the repo root, where there is no lockfile. Add `cache-dependency-path: code/package-lock.json`" })
      }
      return
    }

    if (stepHasCwd || hasDefaultCwd) return

    const runIdx = stepBody.findIndex(l => /^\s*run:/.test(l))
    if (runIdx === -1) return
    // Strip quoted spans first: a run body's quoted strings are DATA, not commands.
    // Without this the auditor flagged its own sibling workflow, whose issue-body
    // printf merely *mentions* `npm run audit:codeql-coverage` in prose. Exactly the
    // failure the npm-cwd shell hook had with heredoc bodies, and the same remedy —
    // keep the narration out of what the matcher sees.
    const runBody = stepBody.slice(runIdx).join('\n')
      .replace(/'[^']*'/g, "''")
      .replace(/"[^"]*"/g, '""')
    if (!CWD_SENSITIVE.test(runBody)) return
    if (SELF_PINNED.test(runBody)) return

    findings.push({ file, line: stepLine, step: stepName,
      message: 'runs npm/npx/yarn/pnpm with no `working-directory` — this executes at the repo root, where there is no package.json. Add `working-directory: code`' })
  }

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const m = l.match(/^(\s*)- name:\s*(.+?)\s*$/)
    if (m) {
      flushStep()
      stepIndent = m[1].length
      stepName = m[2]
      stepLine = i + 1
      stepBody = []
      stepHasCwd = /working-directory:/.test(l)
      stepSuppressed = /#\s*workflow-cwd-ok:\s*\S+/.test(l)
      continue
    }
    if (!stepName) continue
    const indent = l.search(/\S/)
    if (indent !== -1 && indent <= stepIndent && !/^\s*-\s/.test(l)) {
      flushStep()
      stepName = ''
      continue
    }
    stepBody.push(l)
    if (/^\s*working-directory:/.test(l)) stepHasCwd = true
  }
  flushStep()

  return findings
}

// ---------------------------------------------------------------------------
// Self-test — both directions, or the rule proves nothing
// ---------------------------------------------------------------------------

export function selfTest(): string[] {
  const fails: string[] = []
  const check = (name: string, actual: number, expected: number) => {
    if (actual !== expected) fails.push(`${name}: expected ${expected} finding(s), got ${actual}`)
  }
  const wf = (steps: string) => `name: T\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n${steps}`

  // CATCH — the four real shapes seen on 2026-07-22
  check('bare npm ci', scanWorkflow('t', wf(
    '      - name: Install\n        run: npm ci\n')).length, 1)
  check('bare npx tsx', scanWorkflow('t', wf(
    '      - name: Audit\n        run: npx tsx scripts/x.ts\n')).length, 1)
  check('setup-node cache without path', scanWorkflow('t', wf(
    "      - name: Setup Node.js\n        uses: actions/setup-node@abc\n        with:\n          cache: 'npm'\n")).length, 1)
  check('multiline run with npm', scanWorkflow('t', wf(
    '      - name: Report\n        run: |\n          echo hi\n          npm audit --json\n')).length, 1)

  // IGNORE — flagging any of these means the rule is too eager to fire
  check('step pins working-directory', scanWorkflow('t', wf(
    '      - name: Install\n        working-directory: code\n        run: npm ci\n')).length, 0)
  check('job default covers it', scanWorkflow('t',
    'name: T\njobs:\n  j:\n    defaults:\n      run:\n        working-directory: code\n    steps:\n      - name: Install\n        run: npm ci\n').length, 0)
  check('job default does NOT exempt setup-node', scanWorkflow('t',
    "name: T\njobs:\n  j:\n    defaults:\n      run:\n        working-directory: code\n    steps:\n"
    + "      - name: Setup Node.js\n        uses: actions/setup-node@abc\n        with:\n          cache: 'npm'\n").length, 1)
  check('setup-node with cache path', scanWorkflow('t', wf(
    "      - name: Setup Node.js\n        uses: actions/setup-node@abc\n        with:\n          cache: 'npm'\n          cache-dependency-path: code/package-lock.json\n")).length, 0)
  check('setup-node without cache at all', scanWorkflow('t', wf(
    '      - name: Setup Node.js\n        uses: actions/setup-node@abc\n        with:\n          node-version: 22\n')).length, 0)
  check('absolute --prefix is self-pinned', scanWorkflow('t', wf(
    '      - name: Install\n        run: npm --prefix /abs/code ci\n')).length, 0)
  check('non-npm command', scanWorkflow('t', wf(
    '      - name: Tag\n        run: git tag v1\n')).length, 0)
  // The two false positives the first cut of this rule produced, pinned as regressions.
  check('npm view is a registry query', scanWorkflow('t', wf(
    '      - name: Drift\n        run: |\n          P=$(npm view quasar peerDependencies --json)\n')).length, 0)
  check('npx --yes fetches its own package', scanWorkflow('t', wf(
    '      - name: Scan\n        run: |\n          npx --yes @socketsecurity/cli scan create --org x --report\n')).length, 0)
  check('npx with a local script path still flags', scanWorkflow('t', wf(
    '      - name: Audit\n        run: npx tsx scripts/x.ts\n')).length, 1)
  check('npm named inside a quoted message is prose', scanWorkflow('t', wf(
    "      - name: Report\n        run: |\n          printf 'run `npm ci` to fix this'\n")).length, 0)
  check('a real command beside quoted prose still flags', scanWorkflow('t', wf(
    "      - name: Report\n        run: |\n          printf 'see `npm ci`'\n          npm ci\n")).length, 1)
  check('documented suppression', scanWorkflow('t', wf(
    '      - name: Odd one # workflow-cwd-ok: runs against a scratch dir it creates itself\n        run: npm ci\n')).length, 0)
  check('bare suppression does not count', scanWorkflow('t', wf(
    '      - name: Odd one # workflow-cwd-ok:\n        run: npm ci\n')).length, 1)

  return fails
}

// ---------------------------------------------------------------------------

function main(): void {
  const stFails = selfTest()
  if (stFails.length) {
    console.error(`\n${RED}${BOLD}workflow-cwd self-test FAILED${RESET} (${stFails.length}):\n`)
    for (const f of stFails) console.error(`  ${f}`)
    console.error('\nFix scripts/verify-workflow-cwd.ts — do not weaken the corpus.\n')
    process.exit(1)
  }

  console.log(`${BOLD}Workflow Working-Directory Audit${RESET}`)
  console.log(`${DIM}npm/npx steps must pin working-directory: code — the repo root has no package.json${RESET}\n`)

  if (!existsSync(WORKFLOW_DIR)) {
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} ${DIM}(no .github/workflows)${RESET}`)
    return
  }

  const files = readdirSync(WORKFLOW_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
  const all: Finding[] = []
  for (const f of files) {
    all.push(...scanWorkflow(f, readFileSync(resolve(WORKFLOW_DIR, f), 'utf-8')))
  }

  for (const f of files) {
    const hits = all.filter(a => a.file === f)
    if (hits.length === 0) continue
    console.log(`  ${RED}✗${RESET} ${f}`)
    for (const h of hits) console.log(`      ${DIM}:${h.line}${RESET} ${h.step}\n        ${h.message}`)
  }

  console.log()
  if (all.length > 0) {
    console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${all.length} step(s) would run at the repo root\n`)
    process.exit(1)
  }
  console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — ${files.length} workflow(s), every npm step pins its directory\n`)
}

main()

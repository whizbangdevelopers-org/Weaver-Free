#!/usr/bin/env tsx
// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:workflow-node-version — CI must run the Node this package declares it needs.
 *
 * WHY THIS EXISTS
 * ---------------
 * `package.json` says `engines.node: ">=24.0.0"`. On 2026-07-22 three workflows said
 * otherwise and nothing noticed:
 *
 *   release.yml            node-version: '22'   (verify AND build jobs)
 *   security-scan.yml      node-version: '20'   (runs `npm ci`, and ships to Weaver-Free)
 *   version-drift-check.yml node-version: '20'
 *
 * The release pipeline was therefore building and "verifying" the shipped artifact two
 * majors below the declared floor. It did not fail, and that is the whole problem:
 * npm only turns an engines mismatch into an error when `engine-strict=true`, and
 * neither `.npmrc` here sets it. So `npm ci` prints EBADENGINE and carries on. A
 * release built that way looks identical to a correct one until something in the
 * dependency tree actually uses a Node 24 API.
 *
 * release.yml's `verify` job calls itself "the exact pre-push suite on clean infra."
 * On Node 22 it was not the same suite — it was a different runtime running the same
 * commands, which is precisely the guarantee that job exists to provide.
 *
 * WHY AN AUDITOR AND NOT A NOTE
 * -----------------------------
 * `engines.node` and every `node-version:` in `.github/workflows/` are the same fact
 * written in fifteen places — the trigger in .claude/rules/single-source-generated.md.
 * A bump of the floor that misses a workflow is silent by construction, and
 * release.yml is unreachable by `workflow_dispatch` (tag-triggered only), so the one
 * that mattered most could not be smoke-tested even deliberately.
 *
 * THE RULE
 * --------
 * Every `node-version:` in a workflow must satisfy `engines.node` from
 * `code/package.json`. Uniform, because "does this step install the project?" is a
 * judgment call, and a rule with a judgment call in it gets decided wrong once and
 * then cited as precedent. There is no reason to deliberately run an EOL Node.
 *
 * `${{ … }}` expressions are trusted (this is a line parser, not an evaluator).
 * `lts/*` and other floating aliases are REJECTED: they resolve to whatever the
 * runner thinks today, which is not a pin and cannot be audited.
 *
 * Suppress a genuine exception with `# node-version-ok: <reason>` on the line. The
 * reason is required — a bare suppression will not match.
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')
const WORKFLOW_DIR = resolve(PROJECT_ROOT, '.github', 'workflows')
const PKG = resolve(CODE_ROOT, 'package.json')

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m'

interface Finding { file: string; line: number; value: string; message: string }

/** `">=24.0.0"` → 24. Throws rather than guessing: an unparsed floor is a broken audit. */
export function requiredMajor(enginesNode: string): number {
  const m = enginesNode.match(/(\d+)/)
  if (!m) throw new Error(`cannot parse a major version out of engines.node = ${JSON.stringify(enginesNode)}`)
  return Number(m[1])
}

export function scanWorkflow(file: string, text: string, floor: number): Finding[] {
  const findings: Finding[] = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*node-version:\s*(.+?)\s*$/)
    if (!m) continue

    // Strip the YAML inline comment BEFORE reading the value — the same trap that made
    // both of verify-workflow-cwd.ts's suppression self-tests pass vacuously
    // (G-process-2026-07-22-004). The comment is metadata; it is not part of the pin.
    const raw = m[1].replace(/\s+#.*$/, '').trim()
    const value = raw.replace(/^['"]|['"]$/g, '').trim()

    if (/#\s*node-version-ok:\s*\S+/.test(lines[i])) continue
    if (value.includes('${{')) continue

    const major = value.match(/^(?:>=?\s*)?(\d+)/)
    if (!major) {
      findings.push({
        file, line: i + 1, value,
        message: `\`${value}\` is a floating alias, not a pin — it resolves to whatever the runner decides on the day and cannot be checked against engines.node. Pin the major explicitly (\`'${floor}'\`)`,
      })
      continue
    }

    if (Number(major[1]) < floor) {
      findings.push({
        file, line: i + 1, value,
        message: `runs Node ${major[1]}, but code/package.json declares \`engines.node\` >= ${floor}. Neither .npmrc sets engine-strict, so \`npm ci\` only warns EBADENGINE and the job goes green on the wrong runtime. Use \`'${floor}'\``,
      })
    }
  }

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
  const wf = (v: string) =>
    `name: T\njobs:\n  j:\n    steps:\n      - name: Setup Node.js\n        uses: actions/setup-node@abc\n        with:\n          node-version: ${v}\n`

  // engines parsing
  if (requiredMajor('>=24.0.0') !== 24) fails.push('requiredMajor(">=24.0.0") should be 24')
  if (requiredMajor('24.x') !== 24) fails.push('requiredMajor("24.x") should be 24')
  try {
    requiredMajor('lts/*')
    fails.push('requiredMajor should throw on an unparseable engines.node')
  } catch { /* expected */ }

  // CATCH — the three real shapes found on 2026-07-22
  check('quoted below floor', scanWorkflow('t', wf("'22'"), 24).length, 1)
  check('node 20 below floor', scanWorkflow('t', wf("'20'"), 24).length, 1)
  check('unquoted below floor', scanWorkflow('t', wf('20'), 24).length, 1)
  check('double-quoted below floor', scanWorkflow('t', wf('"22"'), 24).length, 1)
  check('floating lts alias is not a pin', scanWorkflow('t', wf('lts/*'), 24).length, 1)
  check('floating "latest" is not a pin', scanWorkflow('t', wf('latest'), 24).length, 1)
  check('two bad pins in one file both report', scanWorkflow('t', wf("'22'") + wf("'20'"), 24).length, 2)

  // IGNORE — flagging any of these means the rule is too eager to fire
  check('at the floor', scanWorkflow('t', wf("'24'"), 24).length, 0)
  check('above the floor', scanWorkflow('t', wf("'26'"), 24).length, 0)
  check('24.x form', scanWorkflow('t', wf("'24.x'"), 24).length, 0)
  check('full semver at floor', scanWorkflow('t', wf("'24.3.0'"), 24).length, 0)
  check('range at floor', scanWorkflow('t', wf("'>=24'"), 24).length, 0)
  check('matrix expression is trusted', scanWorkflow('t', wf('${{ matrix.node }}'), 24).length, 0)
  check('no node-version at all', scanWorkflow('t',
    'name: T\njobs:\n  j:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@abc\n', 24).length, 0)

  // Suppression must carry a reason — bare suppression is gaming
  // (~/.claude/rules/never-game-auditors.md), so it must NOT silence the rule.
  check('documented suppression', scanWorkflow('t',
    wf("'20'  # node-version-ok: pinned low to reproduce the EOL-runtime bug in issue #123"), 24).length, 0)
  check('bare suppression does not count', scanWorkflow('t',
    wf("'20'  # node-version-ok:"), 24).length, 1)
  // The comment must not leak into the value — the G-process-2026-07-22-004 trap.
  // Without the strip this reads as `20  # comment`, which still starts with 20 and
  // would flag, hiding the fact that the strip is broken. So assert the clean case too.
  check('comment stripped from a PASSING value', scanWorkflow('t',
    wf("'24'  # bumped 2026-07-22"), 24).length, 0)

  return fails
}

// ---------------------------------------------------------------------------

function main(): void {
  const stFails = selfTest()
  if (stFails.length) {
    console.error(`\n${RED}${BOLD}workflow-node-version self-test FAILED${RESET} (${stFails.length}):\n`)
    for (const f of stFails) console.error(`  ${f}`)
    console.error('\nFix scripts/verify-workflow-node-version.ts — do not weaken the corpus.\n')
    process.exit(1)
  }

  console.log(`${BOLD}Workflow Node-Version Audit${RESET}`)
  console.log(`${DIM}every setup-node pin must satisfy engines.node from code/package.json${RESET}\n`)

  const engines = (JSON.parse(readFileSync(PKG, 'utf-8')) as { engines?: { node?: string } }).engines?.node
  if (!engines) {
    console.error(`${RED}${BOLD}FAIL${RESET} — code/package.json declares no \`engines.node\`; there is no floor to audit against.\n`)
    process.exit(1)
  }
  const floor = requiredMajor(engines)

  if (!existsSync(WORKFLOW_DIR)) {
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} ${DIM}(no .github/workflows)${RESET}`)
    return
  }

  const files = readdirSync(WORKFLOW_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
  const all: Finding[] = []
  let pins = 0
  for (const f of files) {
    const text = readFileSync(resolve(WORKFLOW_DIR, f), 'utf-8')
    pins += (text.match(/^\s*node-version:/gm) ?? []).length
    all.push(...scanWorkflow(f, text, floor))
  }

  // A checker that examined nothing reports the same green as one that examined
  // everything. Refuse to be that checker (single-source-generated.md — assert the
  // parse produced something and fail outright when it did not).
  if (pins === 0) {
    console.error(`${RED}${BOLD}FAIL${RESET} — parsed ${files.length} workflow(s) and found NO \`node-version:\` pin.`)
    console.error(`${DIM}That is never true while any workflow uses actions/setup-node. Fix the parser.${RESET}\n`)
    process.exit(1)
  }

  for (const f of files) {
    const hits = all.filter(a => a.file === f)
    if (hits.length === 0) continue
    console.log(`  ${RED}✗${RESET} ${f}`)
    for (const h of hits) console.log(`      ${DIM}:${h.line}${RESET} node-version: ${h.value}\n        ${h.message}`)
  }

  console.log()
  if (all.length > 0) {
    console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${all.length} pin(s) below the declared engines floor\n`)
    process.exit(1)
  }
  console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — ${pins} pin(s) across ${files.length} workflow(s), all >= Node ${floor}\n`)
}

main()

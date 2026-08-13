// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:e2e-docker-only — the Playwright runner is invoked through Docker, never bare.
 *
 * WHY THIS EXISTS
 * ---------------
 * The Docker-first E2E policy — E2E runs through the containerised harness, never a bare local
 * runner — used to enforce itself by accident: `@playwright/test` was not installed, so a bare
 * `npx playwright test` simply failed. That was never a control — it was a side effect, and it
 * disappeared on 2026-08-12 when the package became a real devDependency (it had to: the config
 * and every spec import it, and the runner resolves from the bind-mounted node_modules because
 * the compose mount shadows the image's own).
 *
 * Removing an accidental control without adding a deliberate one is how a policy becomes folklore.
 * The invariant it protects is real: a browser that comes from a developer's machine gives results
 * that depend on that machine, which is the failure the whole harness exists to prevent.
 *
 * WHAT IT CHECKS
 * --------------
 * Every git-TRACKED file — the universe a fresh clone receives, not this disk, because an
 * auditor's universe must match its consumer's — for a Playwright-runner invocation at a command
 * position, outside the Docker harness directory and not on a line that also invokes docker.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK, STATED RATHER THAN IMPLIED
 * ---------------------------------------------------------------
 * It cannot stop a human typing `npx playwright test` in a terminal. Nothing in a repo can. What
 * it stops is that invocation being COMMITTED — into an npm script, a hook, a CI workflow, or a
 * doc that teaches the next person to do it. That is the durable half, and it is the half that
 * caused every prior instance of this class here.
 *
 * WHY IT MUST NOT FIRE ON PROSE
 * -----------------------------
 * This repo writes the exact string "npx playwright test" in at least six places whose entire
 * purpose is to FORBID it. An auditor that flagged those would be reworded around within a day —
 * and rewording input to silence a checker is gaming it, which is never the answer.
 * So comments and quoted strings are stripped before matching, and the corpus in
 * scripts/fixtures/e2e-docker-only-corpus.txt pins both halves: what it must catch, and what it
 * must leave alone. The scan refuses to run if that corpus fails.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PKG = join(SCRIPT_DIR, '..')
const REPO = execFileSync('git', ['-C', PKG, 'rev-parse', '--show-toplevel'], {
  encoding: 'utf-8',
}).trim()

/** Repo-relative directory whose contents run INSIDE the container — the invocation belongs there. */
const HARNESS_DIR = `${relative(REPO, join(PKG, 'testing', 'e2e-docker'))}/`

/** Files worth scanning: anything that can carry or teach a command. */
const SCANNED = /\.(ts|tsx|js|mjs|cjs|sh|bash|zsh|yml|yaml|json|md|nix|toml|Dockerfile)$/i
const SCANNED_EXACT = /(^|\/)(Dockerfile|Makefile)$/

/**
 * The Playwright TEST RUNNER, specifically. `playwright install` / `install-deps` are setup, not a
 * run, and `@playwright/test` in an import is a package name (no whitespace before `test`). The
 * distinguishing token is the `test` subcommand.
 *
 * The anchor set includes a QUOTE, because the highest-risk committed forms put the command inside
 * a string — an npm script value in package.json, or `execSync('npx playwright test')`. An earlier
 * version of this rule stripped quoted strings wholesale to avoid firing on `echo "... npx
 * playwright test ..."`, and a negative test against a real file proved that it therefore missed
 * both of those. Prose is suppressed by PRINTING (below), not by quoting.
 */
const RUNNER = /(?:^|[;&|("'`:]|\bthen\b|\bdo\b)\s*(?:(?:npx|pnpm|yarn|bunx)\s+|npm\s+exec\s+|\.?\/?node_modules\/\.bin\/)?playwright\s+test\b/

/** A line that reaches the runner THROUGH docker is the sanctioned path, wherever it lives. */
const VIA_DOCKER = /\bdocker(?:-compose)?\b/

/** Printing the string is talking about the command, not running it. */
const PRINTS = /(?:^|[;&|(]\s*)(?:echo|printf|console\.(?:log|info|warn|error)|print)\b/

/**
 * Suppression carries a mandatory reason — the pattern will not match without one, so a bare
 * suppression cannot be committed (same convention as `sast-ignore[rule-id]:`). Read from the RAW
 * line, before comments are stripped.
 *
 * SAME LINE ONLY. There is no next-line form: a pragma that can float above its subject drifts
 * away from it under editing, and then silently exempts whatever moved into its place.
 */
const SUPPRESSED = /e2e-docker-only-ignore:\s*\S+/

/** Strip comments only. Quotes stay: in this repo's risk model they usually hold a command. */
function stripComments(line: string): string {
  let s = line
  s = s.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
  s = s.replace(/(^|\s)#.*$/, '$1')
  s = s.replace(/^\s*\*(?!\/).*$/, '') // jsdoc continuation line
  return s
}

function violatesPhysical(rawLine: string): boolean {
  const line = stripComments(rawLine)
  if (!line.trim()) return false
  if (VIA_DOCKER.test(line)) return false
  if (PRINTS.test(line)) return false
  return RUNNER.test(` ${line}`)
}

/**
 * A shell command may span physical lines via `\` continuations, and the suppression pragma is
 * same-line only (deliberately — a floating pragma drifts off its subject). Those two facts
 * collide: a continued command has no single line to put the pragma on, and inserting a comment
 * BETWEEN continuation lines severs the command outright. Verified the hard way on Weaver's
 * nix-fresh-test.sh, which this auditor's own remediation briefly broke.
 *
 * So suppression is evaluated over the LOGICAL line: the pragma may sit on any physical line of
 * the command it annotates, which is unambiguous because they are one command. The reported line
 * number stays the first physical line, where a reader will look.
 */
function violates(rawLine: string): boolean {
  if (SUPPRESSED.test(rawLine)) return false
  return rawLine.split('\n').some(violatesPhysical)
}

/** Join `\`-continued physical lines into logical ones, keeping the first line number. */
function logicalLines(text: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = []
  const lines = text.split('\n')
  let buf = ''
  let start = 0
  let open = false
  lines.forEach((l, i) => {
    if (!open) {
      start = i + 1
      buf = l
    } else {
      buf += '\n' + l
    }
    open = /\\\s*$/.test(l)
    if (!open) {
      out.push({ line: start, text: buf })
      buf = ''
    }
  })
  if (buf) out.push({ line: start, text: buf })
  return out
}

/** Markdown: only fenced code blocks are instructions; prose that names the command is not. */
function scanMarkdown(text: string): { line: number; text: string }[] {
  const hits: { line: number; text: string }[] = []
  let inFence = false
  text.split('\n').forEach((raw, i) => {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence
      return
    }
    if (inFence && violates(raw)) hits.push({ line: i + 1, text: raw.trim() })
  })
  return hits
}

function scanPlain(text: string): { line: number; text: string }[] {
  return logicalLines(text)
    .filter((l) => violates(l.text))
    .map((l) => ({ line: l.line, text: l.text.split('\n')[0]!.trim() }))
}

/**
 * Refuse to report a clean scan the corpus has not backed. An auditor with no test only ever tells
 * you it found nothing; it never tells you it cannot find anything.
 */
function selfTest(): void {
  const corpusPath = join(SCRIPT_DIR, 'fixtures', 'e2e-docker-only-corpus.txt')
  let corpus: string
  try {
    corpus = readFileSync(corpusPath, 'utf-8')
  } catch {
    console.error('\n  \x1b[31m✗\x1b[0m corpus missing: scripts/fixtures/e2e-docker-only-corpus.txt')
    console.error('    The rule is unverified — refusing to report a clean scan.\n')
    process.exit(1)
  }

  const failures: string[] = []
  let cases = 0
  let catches = 0
  for (const raw of corpus.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const expectCatch = line.startsWith('CATCH ')
    const expectIgnore = line.startsWith('IGNORE ')
    if (!expectCatch && !expectIgnore) {
      failures.push(`malformed corpus line (needs CATCH/IGNORE): ${line}`)
      continue
    }
    cases++
    if (expectCatch) catches++
    const subject = line.slice(expectCatch ? 6 : 7)
    const flagged = violates(subject)
    if (expectCatch && !flagged) failures.push(`MISSED (should CATCH): ${subject}`)
    if (expectIgnore && flagged) failures.push(`FALSE POSITIVE (should IGNORE): ${subject}`)
  }

  if (!cases) {
    console.error('\n  \x1b[31m✗\x1b[0m corpus declares no cases — refusing to pass vacuously.\n')
    process.exit(1)
  }
  if (failures.length) {
    console.error('\n  \x1b[31m✗\x1b[0m self-test failed — the rule does not behave as specified:')
    for (const f of failures) console.error(`      ${f}`)
    console.error('\n    Refusing to scan. Fix the rule (or the corpus, if the spec changed).\n')
    process.exit(1)
  }
  console.log(`  \x1b[32m✓\x1b[0m self-test: ${cases}/${cases} corpus cases classified correctly`)
  // audit:auditor-contracts reads this line to see BOTH halves rather than trust they exist.
  console.log(`  auditor-contract: catch=${catches} ignore=${cases - catches}`)
}

function main(): number {
  console.log('\n  E2E Docker-only — the Playwright runner must be reached through Docker\n')
  selfTest()

  const tracked = execFileSync('git', ['-C', REPO, 'ls-files'], { encoding: 'utf-8' })
    .split('\n')
    .filter(Boolean)
    .filter((p) => SCANNED.test(p) || SCANNED_EXACT.test(p))
    .filter((p) => !p.startsWith(HARNESS_DIR))

  const problems: string[] = []
  for (const rel of tracked) {
    let text: string
    try {
      text = readFileSync(join(REPO, rel), 'utf-8')
    } catch {
      continue // submodule, symlink, or deleted-but-tracked
    }
    const hits = rel.endsWith('.md') ? scanMarkdown(text) : scanPlain(text)
    for (const h of hits) problems.push(`${rel}:${h.line}\n        ${h.text}`)
  }

  console.log(`  \x1b[32m✓\x1b[0m scanned ${tracked.length} tracked files (excluding ${HARNESS_DIR})`)

  if (problems.length) {
    console.log('')
    for (const p of problems) console.log(`\x1b[31m  ✗ bare Playwright runner: ${p}\x1b[0m`)
    console.log(
      '\n\x1b[31m\x1b[1mRESULT: FAIL\x1b[0m — E2E must run through the Docker harness.\n' +
        `      Use ${HARNESS_DIR}scripts/run-tests.sh, run-single.sh, or run-foundry.sh.\n` +
        '      A browser from the developer machine gives machine-dependent results.\n'
    )
    return 1
  }
  console.log('\n\x1b[32m\x1b[1mRESULT: PASS\x1b[0m — every Playwright run goes through Docker\n')
  return 0
}

process.exit(main())

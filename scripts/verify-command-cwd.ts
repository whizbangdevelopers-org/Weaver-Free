// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:command-cwd — a committed script must not invoke npm or git cwd-dependently.
 *
 * WHY THIS EXISTS
 * ---------------
 * Two invariants — "pin every npm op" and "pin every git op" — were enforced ONLY by Claude Code
 * PreToolUse hooks (~/.claude/hooks/enforce-absolute-{npm,git}-cwd.sh). Measured 2026-07-31 while
 * recording FORGE-36 (Agent-governance substrate is vendor-neutral from row one — Engram rows,
 * projected per consumer): neither had any vendor-neutral backstop. They are real controls that
 * exist inside one vendor's tool, on one machine. Switch AI, or run on any host that is not king,
 * and they vanish — silently, with no failing check to notice it. foundry already has zero hooks
 * and runs an agent daily.
 *
 * WHAT THIS CAN AND CANNOT DO — state it plainly, because the difference matters
 * -----------------------------------------------------------------------------
 * It CANNOT replace the hooks. A hook intercepts a command before it runs; an auditor inspects
 * files after they are written. Nothing vendor-neutral can intercept an agent's live shell.
 *
 * What it CAN do is stop the bad form being COMMITTED, and that is the half that compounds. A
 * script or runbook carrying `npm run x` teaches the failure to every future reader — human or
 * AI, on any machine — and gets copied. The hook protects one session; this protects the corpus.
 *
 * THE IGNORE HALF IS THE HARD HALF
 * --------------------------------
 * 39 of 69 tracked scripts legitimately anchor their own directory first
 * (`cd "$(dirname "$0")"`, `SCRIPT_DIR=`, `ROOT="$(cd …)"`). Those are cwd-independent BY
 * CONSTRUCTION and flagging them would make this a rule that fires on correct code — which,
 * per ~/.claude/rules/never-game-auditors.md, is how an auditor gets switched off on its first
 * real run. Git hooks are also exempt: git guarantees cwd = the working-tree root.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Paths are DERIVED, never hardcoded to a project's layout — this auditor is fed to the template
 * and from there to every WBD project, and a literal `code/` segment would make each copy subtly
 * project-shaped and put them out of sync (which `audit:template-divergence` then flags forever).
 *
 *   PKG  = the npm package root — this file is always at <pkg>/scripts/verify-command-cwd.ts
 *   REPO = the git repo root — ASKED OF GIT, not assumed to be PKG/..
 *
 * The repo root is not a fixed distance from the package. In weaver, the template and Gantry the
 * package is `code/` one level below the git root; in Qepton the product repos are nested
 * (`code/Qepton-Dev/` is itself a git root), so `PKG/..` would resolve to a directory belonging to
 * a DIFFERENT repository and `git ls-files` would then scan the wrong tree — reporting honestly
 * about the wrong project, the exact failure this auditor exists to prevent.
 */
const PKG = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = execFileSync('git', ['-C', PKG, 'rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim()

/**
 * npm ops that resolve a package root from cwd. Matched in two parts, NOT as one pattern:
 * `npm` must be at command position, and an op word must appear somewhere after it. A single
 * `npm\s+(run|ci|…)` regex — the obvious first cut — misses `npm --prefix code run build`,
 * because the flag sits between the two. That is precisely the RELATIVE-prefix form the rule
 * forbids, so the naive pattern was blind to the most likely real violation. The self-test
 * corpus caught it before this auditor ever scanned a file.
 */
const NPM_CMD = /^\s*npm\b/
const NPM_OP = /\b(run|ci|install|i|test|exec|audit|rebuild|update|prune|dedupe)\b/
/** git ops that resolve a repository from cwd. Read-only ones count: they report the WRONG repo. */
const GIT_OP = /^\s*git\s+(add|commit|push|pull|checkout|switch|fetch|merge|rebase|status|diff|log|rev-parse|ls-files|stash|tag)\b/

/** An absolute pin on the invocation itself. */
const NPM_PINNED = /--prefix\s+\//
const GIT_PINNED = /git\s+-C\s+\//

/**
 * The file establishes its own directory anchor, so every later relative command is
 * cwd-independent by construction. This is the correct pattern, not a violation.
 */
const ANCHORS = [
  /cd\s+"?\$\(dirname\s/,           // cd "$(dirname "$0")"
  /cd\s+"?\$\{0%\/\*\}/,            // cd "${0%/*}"
  /SCRIPT_DIR=/,
  /ROOT="?\$\(cd\s/,
  /cd\s+"\$REPO_ROOT"/,
  /cd\s+\//,                        // an absolute cd anywhere earlier
]

export interface Finding { file: string; line: number; text: string; kind: 'npm' | 'git' }

/** Pure: given a file's contents, which lines invoke npm/git cwd-dependently? */
export function findCwdDependentCommands(content: string, path = ''): Finding[] {
  // Git hooks run with cwd = the working-tree root, guaranteed by git itself.
  if (/\.githooks\//.test(path)) return []

  const lines = content.split('\n')
  const anchored = ANCHORS.some(a => a.test(content))
  if (anchored) return []

  const out: Finding[] = []
  lines.forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '')            // strip trailing comments
    if (!line.trim() || /^\s*#/.test(raw)) return
    if (NPM_CMD.test(line) && NPM_OP.test(line) && !NPM_PINNED.test(line)) {
      out.push({ file: path, line: i + 1, text: raw.trim(), kind: 'npm' })
    }
    if (GIT_OP.test(line) && !GIT_PINNED.test(line)) {
      out.push({ file: path, line: i + 1, text: raw.trim(), kind: 'git' })
    }
  })
  return out
}

/**
 * Self-test. An auditor with no corpus only ever reports that it found nothing; it can never
 * report that it CANNOT find anything, and those are indistinguishable from outside
 * (.claude/rules/core/security.md). Both halves are asserted: what it MUST catch, and what it
 * MUST NOT flag — a checker that flags everything is as broken as one that flags nothing.
 */
const MUST_CATCH: [string, string][] = [
  ['bare npm run', 'npm run build\n'],
  ['relative --prefix', 'npm --prefix code run build\n'],
  ['bare npm ci', '  npm ci\n'],
  ['bare git add', 'git add src/foo.ts\n'],
  ['bare git push', 'git push origin main\n'],
  ['read-only git is still wrong', 'git status --short\n'],
]
const MUST_IGNORE: [string, string][] = [
  ['absolute --prefix', 'npm --prefix /abs/pkg run build\n'],
  ['git -C absolute', 'git -C /abs/repo status\n'],
  ['self-anchored via dirname', 'cd "$(dirname "$0")"\nnpm run build\ngit add .\n'],
  ['self-anchored via SCRIPT_DIR', 'SCRIPT_DIR=/x\ncd "$SCRIPT_DIR"\nnpm ci\n'],
  ['absolute cd first', 'cd /home/mark/proj\nnpm run test\n'],
  ['commented out', '# npm run build\n'],
  ['prose mentioning npm run', 'echo "then npm run build"\n'],
  ['unrelated npm word', 'echo npm-is-great\n'],
]

function selfTest(): string[] {
  const fails: string[] = []
  for (const [name, src] of MUST_CATCH) {
    if (findCwdDependentCommands(src, 'x.sh').length === 0) fails.push(`MUST CATCH but did not: ${name}`)
  }
  for (const [name, src] of MUST_IGNORE) {
    const f = findCwdDependentCommands(src, 'x.sh')
    if (f.length > 0) fails.push(`MUST IGNORE but flagged: ${name} -> ${f[0]!.text}`)
  }
  return fails
}

function main(): void {
  console.log('\x1b[1mCommand cwd-Independence Audit\x1b[0m')
  console.log('\x1b[2mCommitted scripts must not invoke npm/git cwd-dependently (FORGE-36)\x1b[0m\n')

  const fails = selfTest()
  if (fails.length) {
    console.log('\x1b[31m✗ SELF-TEST FAILED — refusing to scan with a broken matcher\x1b[0m')
    fails.forEach(f => console.log(`    ${f}`))
    process.exit(1)
  }
  console.log(`  \x1b[32m✓\x1b[0m self-test: ${MUST_CATCH.length} catch + ${MUST_IGNORE.length} ignore cases\n`)

  const tracked = execFileSync('git', ['-C', REPO, 'ls-files', '*.sh'], { encoding: 'utf-8' })
    .split('\n').filter(f => f && !f.includes('node_modules'))

  const findings: Finding[] = []
  for (const f of tracked) {
    let content: string
    try { content = readFileSync(join(REPO, f), 'utf-8') } catch { continue }
    findings.push(...findCwdDependentCommands(content, f))
  }

  const dir = join(PKG, 'reports', 'command-cwd')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'latest.json'), JSON.stringify({ scanned: tracked.length, findings }, null, 2))

  if (findings.length) {
    console.log(`\x1b[31m✗ ${findings.length} cwd-dependent invocation(s) in ${tracked.length} scanned script(s):\x1b[0m\n`)
    for (const f of findings) {
      console.log(`  \x1b[31m${f.file}:${f.line}\x1b[0m  ${f.text}`)
    }
    console.log('\n  Fix: `npm --prefix /abs/path run x`, `git -C /abs/path <cmd>`, or anchor the')
    console.log('  script once with `cd "$(dirname "$0")"` / an absolute cd before the command.')
    console.log('  See ~/.claude/rules/cwd-independent-tooling.md')
    process.exit(1)
  }

  console.log(`\x1b[32m\x1b[1mRESULT: PASS\x1b[0m — ${tracked.length} script(s), no cwd-dependent npm/git`)
}

if (process.argv[1] && process.argv[1].endsWith('verify-command-cwd.ts')) main()

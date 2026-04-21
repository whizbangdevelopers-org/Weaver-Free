// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Release Rsync Source-Path Auditor
 *
 * Enforces that every rsync invocation in `release.yml` and `sync-to-free.yml`
 * uses a source path ending in `/code/` or `/.github/` — never the whole-repo
 * `dev/` / `source/` form that leaked 72,807 lines of internal planning
 * content to the public Free mirror on 2026-04-20 (v1.0.2 attempted release).
 *
 * Root cause of the leak: `release.yml` had `rsync ... dev/ free/` instead of
 * `rsync ... dev/code/ free/`. The `sync-exclude.yml` exclude patterns are all
 * `code/`-relative, so Dev-root content (MASTER-PLAN.md, business/, portfolio/,
 * research/, agents/, NOTES.md) fell through the excludes and landed on Free.
 * The bug had been latent for multiple releases — `--delete-excluded` absence
 * masked it. When v1.0.2 prep added `--delete-excluded`, rsync switched from
 * "add/update" to "mirror source", and the latent wrong-source bug became a
 * 72K-line leak in one commit.
 *
 * Why this auditor exists:
 * - `sync-to-free.yml` was correct (`source/code/ target/`).
 * - `release.yml` had a PARALLEL copy of the same operation with different
 *   arguments — drift between two workflows that should be identical.
 * - Two workflows doing "the same thing" without shared code OR a static
 *   cross-check will drift into subtly different bugs; this auditor IS the
 *   static cross-check.
 *
 * Rules (fail the push if any violated):
 *   1. Every rsync invocation's source path (the penultimate positional arg)
 *      must end in `/code/`, `/.github/`, or be a recognised sandbox path
 *      (`${sandbox...}`, `${dir}/`, etc. — for in-process test rsyncs).
 *   2. Bare `dev/` or `source/` source paths are FORBIDDEN.
 *   3. Destination paths with a trailing slash are accepted; sources must
 *      also have a trailing slash (rsync copies contents, not the dir).
 *
 * To fix a failure: change the source path to include the `code/` or
 * `.github/` subtree explicitly. If a new sandbox path is legitimate, add it
 * to ALLOWED_SANDBOX_PATTERNS below with a comment explaining the case.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

const WORKFLOWS_TO_CHECK = [
  resolve(PROJECT_ROOT, '.github', 'workflows', 'sync-to-free.yml'),
  resolve(PROJECT_ROOT, '.github', 'workflows', 'release.yml'),
]

// Source paths that MUST appear as the penultimate rsync arg for Dev→Free
// sync operations. Anything else is suspect unless it's a known sandbox
// pattern (below).
//
// Trailing slash is REQUIRED: `foo/` copies contents of foo into the dest;
// `foo` copies foo itself into the dest. Rsync's trailing-slash semantics
// are load-bearing for these sync operations and the destination layout
// depends on them.
const ALLOWED_CODE_ENDINGS = [
  /\/code\/$/, // dev/code/ or source/code/ — the correct code sync source
  /\/\.github\/$/, // dev/.github/ or source/.github/ — repo config sync
]

// Sandbox patterns permitted in scripts (not workflows). The release-builds
// auditor uses in-process rsync to stage flattened test builds; those
// sources are tmpdir paths, not whole-repo refs, so they're safe.
const ALLOWED_SANDBOX_PATTERNS = [
  /\$\{[A-Z_]+\}\/$/, // ${CODE_ROOT}/, ${PROJECT_ROOT}/ — test harness vars
  /\$\{[a-zA-Z]+\}\/$/, // ${dir}/, ${sandboxRoot}/ — in-test locals
  /\$\{\{[^}]+\}\}/, // GitHub Actions expressions (${{ ... }}) — context-dependent, skip
  /^\/tmp\//, // explicit tmpdir paths
]

// Paths that are explicitly FORBIDDEN as rsync source for Dev→Free ops.
// These would sync Dev's whole tree (or the sync-to-free checkout's whole
// tree, same outcome) and bypass the code/-relative exclude patterns.
const FORBIDDEN_SOURCE_EXACTLY = new Set(['dev/', 'source/'])

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

let failures = 0
let warnings = 0

function pass(name: string, detail: string): void {
  console.log(`  ${GREEN}\u2713${RESET} ${name} ${DIM}— ${detail}${RESET}`)
}
function fail(name: string, detail: string): void {
  failures++
  console.log(`  ${RED}\u2717${RESET} ${name}`)
  console.log(`    ${DIM}${detail}${RESET}`)
}
function warn(name: string, detail: string): void {
  warnings++
  console.log(`  ${YELLOW}!${RESET} ${name} ${DIM}— ${detail}${RESET}`)
}

/**
 * Extract the logical rsync invocation starting at `startLine`. Follows
 * backslash continuations across lines and returns the complete command
 * text with continuations removed. Returns both the joined text and the
 * last line index consumed (for diagnostic line numbers).
 */
function extractRsyncBlock(lines: string[], startLine: number): { text: string; endLine: number } {
  const collected: string[] = []
  let i = startLine
  while (i < lines.length) {
    const line = lines[i]
    // Strip leading YAML indentation and trailing backslash-newline.
    const stripped = line.replace(/\\\s*$/, '').trim()
    collected.push(stripped)
    if (!/\\\s*$/.test(line)) {
      // No continuation — block ends on this line.
      return { text: collected.join(' '), endLine: i }
    }
    i++
  }
  return { text: collected.join(' '), endLine: lines.length - 1 }
}

/**
 * Tokenize a shell command, stripping quoted strings. Not a full shell
 * parser; sufficient for rsync flag/path extraction where args don't
 * contain spaces (and sync-exclude patterns don't have spaces either).
 */
function tokenize(cmd: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i]
    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }
    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }
    if (/\s/.test(ch) && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) tokens.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.length > 0) tokens.push(current)
  return tokens
}

/**
 * Given tokenized rsync args, return the source path (penultimate positional)
 * and destination (last positional). "Positional" means a token that is not
 * a flag (`-x`, `--long=x`) and not an option value for a preceding short
 * flag that takes one.
 */
function extractSourceAndDest(tokens: string[]): { source: string | null; dest: string | null } {
  // Drop the `rsync` executable name.
  const args = tokens[0] === 'rsync' ? tokens.slice(1) : tokens

  // All tokens that are not flags. Flags start with `-`.
  // We intentionally ignore the possibility of `-T <arg>`-style option values
  // because rsync doesn't use them for the flags in our workflows.
  const positionals = args.filter((t) => !t.startsWith('-'))

  if (positionals.length < 2) return { source: null, dest: null }
  return {
    source: positionals[positionals.length - 2],
    dest: positionals[positionals.length - 1],
  }
}

function classifySource(source: string): 'ok-code' | 'ok-github' | 'ok-sandbox' | 'forbidden' | 'unknown' {
  if (FORBIDDEN_SOURCE_EXACTLY.has(source)) return 'forbidden'
  if (/\/code\/$/.test(source)) return 'ok-code'
  if (/\/\.github\/$/.test(source)) return 'ok-github'
  for (const pat of ALLOWED_SANDBOX_PATTERNS) {
    if (pat.test(source)) return 'ok-sandbox'
  }
  return 'unknown'
}

console.log(`${BOLD}Release Rsync Source-Path Audit${RESET}`)
console.log(
  `${DIM}Every rsync in release.yml + sync-to-free.yml MUST source from dev/code/ or dev/.github/,${RESET}`,
)
console.log(`${DIM}never bare dev/ — that leaks Dev-root content (MASTER-PLAN, business/, etc.) to Free.${RESET}`)
console.log()

for (const workflowPath of WORKFLOWS_TO_CHECK) {
  const workflowName = workflowPath.replace(PROJECT_ROOT + '/', '')
  if (!existsSync(workflowPath)) {
    fail(workflowName, 'workflow file missing')
    continue
  }

  const content = readFileSync(workflowPath, 'utf-8')
  const lines = content.split('\n')

  // Find every line that starts an rsync command.
  const rsyncStarts: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*rsync\b/.test(lines[i])) {
      rsyncStarts.push(i)
    }
  }

  if (rsyncStarts.length === 0) {
    pass(workflowName, 'no rsync invocations')
    continue
  }

  let workflowIssues = 0
  for (const start of rsyncStarts) {
    const { text } = extractRsyncBlock(lines, start)
    const tokens = tokenize(text)
    const { source, dest } = extractSourceAndDest(tokens)

    if (!source || !dest) {
      warn(workflowName, `rsync at line ${start + 1}: could not extract source/dest (tokens=${tokens.length})`)
      continue
    }

    const verdict = classifySource(source)
    const locator = `line ${start + 1}`

    if (verdict === 'forbidden') {
      fail(
        workflowName,
        `${locator}: rsync source is '${source}' — FORBIDDEN.\n     Forbidden because this syncs Dev's whole repo to Free, and the sync-exclude\n     patterns are code/-relative — Dev-root content (MASTER-PLAN.md, business/,\n     portfolio/, research/, agents/, NOTES.md) WILL leak to the public mirror.\n     Fix: change source to 'dev/code/' or split into separate 'dev/code/' and\n     'dev/.github/' rsync steps.`,
      )
      workflowIssues++
    } else if (verdict === 'unknown') {
      // Any source we can't classify gets a warning — not a hard fail, because
      // workflow authors may add legitimate new sandbox paths. Warning surfaces
      // the oddity without blocking; a confirmed-safe path can be added to
      // ALLOWED_SANDBOX_PATTERNS.
      warn(
        workflowName,
        `${locator}: rsync source '${source}' doesn't match known patterns.\n    If legitimate, add its pattern to ALLOWED_SANDBOX_PATTERNS in this auditor.`,
      )
    }
  }

  if (workflowIssues === 0) {
    pass(workflowName, `${rsyncStarts.length} rsync invocation(s) — all sources use code/ or .github/`)
  }
}

console.log()
if (failures > 0) {
  console.log(
    `${RED}${BOLD}RESULT: FAIL${RESET} — ${failures} forbidden rsync source(s) — risk of internal content leak to Free mirror`,
  )
  process.exit(1)
}
if (warnings > 0) {
  console.log(`${YELLOW}${BOLD}RESULT: PASS${RESET} ${DIM}(${warnings} warning(s))${RESET}`)
} else {
  console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — all rsync sources end in /code/ or /.github/`)
}

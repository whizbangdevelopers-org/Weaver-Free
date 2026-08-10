// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:shell-safety — a committed heredoc must not execute its own body.
 *
 * WHY THIS EXISTS
 * ---------------
 * `<<EOF` (bare delimiter) expands the body; `<<'EOF'` and `<<"EOF"` do not. So a document body
 * containing a backtick or `$( )` is COMMAND SUBSTITUTION: the shell runs it and replaces it with
 * the output.
 *
 * Measured 2026-08-07: a knowledge entry appended with `<<ENTRY` — deliberately unquoted, because
 * the entry id had to interpolate — contained the column name `created_at` in backticks. zsh
 * executed it. The entry shipped reading
 *
 *     "an age control bucketing by  was already in place"
 *
 * with the term silently deleted, and the only trace was a stray `command not found: created_at`
 * in the middle of an otherwise successful write. Prose is data; a document body that runs is not
 * a document.
 *
 * BACKSTOP ROLE
 * ------------------------
 * This is the vendor-neutral half of ~/.claude/hooks/enforce-shell-safety.sh, rule H. The hook
 * intercepts an agent's live command; nothing vendor-neutral can. What this covers is the half
 * that compounds: a committed script carrying the pattern teaches it to every future reader and
 * gets copied.
 *
 * The hook's rule C (multi-line constructs must run under `bash -c`) has NO analogue here, and
 * that is not an oversight: a committed script declares `#!/usr/bin/env bash` in its shebang, so
 * constructs are safe in it. Rule C's hazard exists only in the agent's zsh execution context,
 * where there is no artifact to inspect. Said plainly rather than papered over.
 *
 * `$VAR` IS ALLOWED, DELIBERATELY
 * -------------------------------
 * Interpolating a variable is usually why the delimiter was left unquoted. Only command
 * substitution is refused. In a generator script `$( )` inside a heredoc can be intentional — so
 * the suppression exists and, per ~/.claude/rules/never-game-auditors.md, requires a reason:
 *
 *     # shell-safety-ok: <why this body must be executed>
 *
 * Measured at introduction: 0 occurrences across 71 tracked shell files, so this starts green and
 * only ever fires on something new. A guard added over known violations is one that gets disabled
 * on its first real run.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = execFileSync('git', ['-C', PKG, 'rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim()

const OPENER = /<<-?[ \t]*("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_]*)/g
const SUBST = /`|\$\(/
const SUPPRESS = /shell-safety-ok:\s*\S+/

export interface Finding { file: string; line: number; text: string }

/** Pure: which lines sit inside an UNQUOTED heredoc body and contain command substitution? */
export function findHeredocSubstitutions(content: string, path = ''): Finding[] {
  const lines = content.split('\n')
  const out: Finding[] = []
  const stack: { delim: string; expands: boolean; suppressed: boolean }[] = []

  lines.forEach((raw, i) => {
    if (stack.length) {
      const top = stack[stack.length - 1]
      if (raw.trim() === top.delim) { stack.pop(); return }
      if (top.expands && !top.suppressed && SUBST.test(raw)) {
        out.push({ file: path, line: i + 1, text: raw.trim() })
      }
      return
    }
    const suppressed = SUPPRESS.test(raw)
    for (const m of raw.matchAll(OPENER)) {
      const tok = m[1]
      // Quoting ANY part of the delimiter disables expansion — both ' and " forms.
      const expands = !/["']/.test(tok)
      stack.push({ delim: tok.replace(/["']/g, ''), expands, suppressed })
    }
  })
  return out
}

const MUST_CATCH: [string, string][] = [
  ['the 2026-08-07 entry mangle', 'cat >> f.md <<ENTRY\nbucketing by `created_at` was in place\nENTRY\n'],
  ['dollar-paren in an unquoted body', 'cat <<EOF\nbuilt at $(date)\nEOF\n'],
  ['interpolating id AND a backtick', 'cat <<ENTRY\nid: L-x-$U\nsee `col_name`\nENTRY\n'],
]
const MUST_IGNORE: [string, string][] = [
  ["single-quoted delimiter", "cat <<'EOF'\nbucketing by `created_at`\nEOF\n"],
  ['double-quoted delimiter', 'cat <<"EOF"\n`whoami`\nEOF\n'],
  // The usual reason a delimiter is left unquoted — and not the hazard.
  ['unquoted, only $VAR', 'cat <<ENTRY\nid: L-analysis-$U\nENTRY\n'],
  ['plain prose body', 'git commit -F - <<EOF\nfix: a normal message\nEOF\n'],
  ['substitution outside any heredoc', 'D=$(date)\necho "$D"\n'],
  ['backtick after the terminator', "cat <<'EOF'\nbody\nEOF\necho `date`\n"],
  ['suppressed with a reason', 'cat <<EOF # shell-safety-ok: generator, the body is meant to expand\nbuilt $(date)\nEOF\n'],
]

function selfTest(): string[] {
  const fails: string[] = []
  for (const [name, src] of MUST_CATCH) {
    if (findHeredocSubstitutions(src, 'x.sh').length === 0) fails.push(`MUST CATCH but did not: ${name}`)
  }
  for (const [name, src] of MUST_IGNORE) {
    const got = findHeredocSubstitutions(src, 'x.sh')
    if (got.length) fails.push(`MUST IGNORE but flagged: ${name} -> ${JSON.stringify(got)}`)
  }
  return fails
}

function isShell(path: string, body: string): boolean {
  if (/\.(sh|bash)$/.test(path)) return true
  return /^#!.*\b(bash|sh|zsh)\b/.test(body.split('\n')[0] ?? '')
}

function main(): number {
  console.log('\x1b[1mShell Safety Audit\x1b[0m')
  console.log('\x1b[2mA committed heredoc must not execute its own body (FORGE-36)\x1b[0m\n')

  const fails = selfTest()
  if (fails.length) {
    console.error('\x1b[31m✗ SELF-TEST FAILED — refusing to scan with a broken matcher\x1b[0m')
    for (const f of fails) console.error(`    ${f}`)
    return 1
  }
  console.log(`  \x1b[32m✓\x1b[0m self-test: ${MUST_CATCH.length} catch + ${MUST_IGNORE.length} ignore cases\n`)

  const tracked = execFileSync('git', ['-C', REPO, 'ls-files'], { encoding: 'utf-8' })
    .split('\n').filter(Boolean)
  const found: Finding[] = []
  let scanned = 0
  for (const rel of tracked) {
    let body: string
    try { body = readFileSync(join(REPO, rel), 'utf-8') } catch { continue }
    if (!isShell(rel, body)) continue
    scanned++
    found.push(...findHeredocSubstitutions(body, rel))
  }

  if (found.length) {
    for (const f of found) console.log(`\x1b[31m  ✗ ${f.file}:${f.line}\x1b[0m  ${f.text.slice(0, 96)}`)
    console.log(`\n\x1b[31m\x1b[1mRESULT: FAIL\x1b[0m — ${found.length} heredoc line(s) will be EXECUTED, not written.`)
    console.log("  Use a quoted delimiter:  <<'EOF'   (both ' and \" disable expansion)")
    console.log('  $VAR interpolation is fine unquoted — it is ` and $( ) that run.')
    console.log('  Genuinely a generator? add:  # shell-safety-ok: <reason>')
    return 1
  }
  console.log(`\x1b[32m\x1b[1mRESULT: PASS\x1b[0m — ${scanned} shell file(s), no self-executing heredocs`)
  return 0
}

process.exit(main())

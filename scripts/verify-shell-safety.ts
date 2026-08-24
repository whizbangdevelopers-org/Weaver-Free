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
  const stack: { delim: string; expands: boolean; suppressed: boolean; found: Finding[] }[] = []
  const closed: Finding[] = []

  lines.forEach((raw, i) => {
    if (stack.length) {
      const top = stack[stack.length - 1]!
      if (raw.trim() === top.delim) {
        // The heredoc genuinely closed, so its body really was a body. Only now do its findings
        // count.
        stack.pop()
        closed.push(...top.found)
        return
      }
      if (top.expands && !top.suppressed && SUBST.test(raw)) {
        top.found.push({ file: path, line: i + 1, text: raw.trim() })
      }
      return
    }
    const suppressed = SUPPRESS.test(raw)
    // Scan for openers on the line with QUOTED SPANS REMOVED.
    //
    // `<<WORD` inside a string is text, not a redirect — `echo '<<NOPE'`, or a test fixture
    // asserting on heredoc handling. Without this, such a line opens a phantom frame, and the
    // frame then SHADOWS every real heredoc after it: the loop below is only reached when the
    // stack is empty, so a genuine `cat <<EOF` two lines later is read as phantom body and its
    // command substitution is never reported. Discarding unclosed frames at EOF does not save it,
    // because the finding was attributed to the phantom.
    //
    // Removing a quoted delimiter (`<<'EOF'`) also removes that opener — which changes nothing,
    // since a quoted delimiter disables expansion and was never reportable. Same verdict, and now
    // by a route that cannot shadow.
    const scan = raw.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '')
    for (const m of scan.matchAll(OPENER)) {
      const tok = m[1]!
      // Quoting ANY part of the delimiter disables expansion — both ' and " forms.
      const expands = !/["']/.test(tok)
      stack.push({ delim: tok.replace(/["']/g, ''), expands, suppressed, found: [] })
    }
  })

  // ── Frames still open at EOF are DISCARDED, deliberately ──────────────────────────────────
  //
  // OPENER matches `<<WORD` anywhere on a line, including inside a string. A file that TALKS
  // about heredocs — a hook that parses them, a test fixture that asserts on them — therefore
  // opens phantom heredocs that never close, and every line after one was being reported as its
  // body. Measured 2026-08-24: 9 findings against `.claude/hooks/block-dangerous.sh`, every one a
  // comment or a normal line of shell, and the auditor blind to the real remainder of the file
  // from the phantom opener onward.
  //
  // The discriminator is exact rather than heuristic: an UNTERMINATED heredoc is a SYNTAX ERROR.
  // A file containing one does not run at all, so `bash -n` would reject it and there would be
  // nothing to audit. If a frame is still open when the input ends, that `<<WORD` was not an
  // opener — it was text. Its "body" was ordinary code, and reporting it is a false positive by
  // construction.
  //
  // This cannot hide a true positive: a real heredoc closes, which is precisely the condition for
  // keeping its findings. Asserted both ways in the corpus below.
  return closed
}

/**
 * Rule G — a GATE whose exit status is discarded.
 *
 * `npm run audit:x || true` converts a refusal into an invisible success: the command still
 * prints its finding, the script still exits 0, and CI still goes green. That is the same act as
 * `--no-verify`, one layer in — see ~/.claude/rules/bypass-permissions-is-not-bypass-the-system.md,
 * whose PreToolUse hook blocks it at the moment of typing. This is that hook's ARTIFACT backstop:
 * the hook protects one agent in one tool on one machine, and a committed script outlives all
 * three.
 *
 * `|| true` is legitimate on CLEANUP and on PROBES, where a non-zero exit carries no verdict —
 * `rm -f`, `pkill`, an existence test. It is never legitimate on something whose whole purpose is
 * to fail. So the rule keys on the COMMAND being swallowed, not on `|| true` itself.
 */
const GATE = /(?:npm(?:[ \t]+--prefix[ \t]+\S+)?[ \t]+run[ \t]+(?:audit|test|check|verify|lint|typecheck)[:a-z0-9-]*|(?:\.\/|bash[ \t]+|npx[ \t]+tsx[ \t]+|python3[ \t]+)?[\w./-]*(?:audit|verify|check)[\w./-]*\.(?:sh|ts|py|mjs))[^\n|&]*\|\|[ \t]*(?:true|:)(?=[ \t;&|#]|$)/
/** A deliberate, reasoned exemption. Checked over the WHOLE line — the comment trails the `||`. */
const GATE_OK = /#[^\n]*gate-ok:\s*\S/

/** Pure: which lines discard a gate's exit status? */
export function findSwallowedGates(content: string, path = ''): Finding[] {
  const out: Finding[] = []
  content.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    if (SUPPRESS.test(raw) || GATE_OK.test(raw)) return
    if (GATE.test(raw)) out.push({ file: path, line: i + 1, text: line })
  })
  return out
}

const MUST_CATCH: [string, string][] = [
  ['the 2026-08-07 entry mangle', 'cat >> f.md <<ENTRY\nbucketing by `created_at` was in place\nENTRY\n'],
  ['dollar-paren in an unquoted body', 'cat <<EOF\nbuilt at $(date)\nEOF\n'],
  ['interpolating id AND a backtick', 'cat <<ENTRY\nid: L-x-$U\nsee `col_name`\nENTRY\n'],
  // The discard must not become a bypass: a heredoc that DOES close is still judged, including
  // when more code follows it.
  ['closed heredoc, code after it', 'cat <<EOF\nbuilt $(date)\nEOF\necho done\n'],
  ['second heredoc closes, first is phantom', "echo '<<NOPE'\ncat <<EOF\n`whoami`\nEOF\n"],
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
  // A file that TALKS about heredocs. `<<SH` here is inside a string and never terminates, so it
  // was never an opener — an unterminated heredoc would be a syntax error and the file would not
  // run. Everything after it is ordinary code, not a body.
  ['a fixture string that merely contains an opener', "check 0 $'cat > e.sh <<SH\\nbody\\nSH'\nD=$(date)\n"],
  ['prose naming a delimiter, then real code', '# see the <<ENTRY form below\nX=`date`\n'],
]

const GATE_CATCH: [string, string][] = [
  ['npm audit script swallowed', 'npm --prefix /a/b run audit:vocabulary || true\n'],
  ['bare npm run test swallowed', 'npm run test:compliance || true\n'],
  ['a verify script swallowed', './scripts/verify-shell-safety.ts || true\n'],
  ['swallowed with : instead of true', 'npm run audit:sast || :\n'],
  ['tsx-invoked auditor swallowed', 'npx tsx scripts/audit-code-scanning.ts || true\n'],
]
const GATE_IGNORE: [string, string][] = [
  // The reason `|| true` exists at all — a non-zero exit here carries no verdict.
  ['cleanup', 'rm -f /tmp/scratch || true\n'],
  ['a probe whose failure is expected', 'pgrep -f thing >/dev/null || true\n'],
  ['unmount that may not be mounted', 'umount /mnt/x || true\n'],
  // The gate is RUN, not swallowed.
  ['gate run normally', 'npm --prefix /a/b run audit:vocabulary\n'],
  ['gate whose status IS checked', 'npm run audit:sast || exit 1\n'],
  ['a comment about the pattern', '# never write: npm run audit:x || true\n'],
  ['deliberate, with a stated reason', 'npm run audit:optional || true  # gate-ok: advisory, no verdict\n'],
  ['shell-safety-ok suppression honoured', 'npm run audit:x || true  # shell-safety-ok: fixture\n'],
]

function selfTest(): string[] {
  const fails: string[] = []
  for (const [name, src] of MUST_CATCH) {
    if (findHeredocSubstitutions(src, 'x.sh').length === 0) fails.push(`MUST CATCH but did not: ${name}`)
  }
  for (const [name, src] of GATE_CATCH) {
    if (findSwallowedGates(src, 'x.sh').length === 0) fails.push(`GATE MUST CATCH but did not: ${name}`)
  }
  for (const [name, src] of GATE_IGNORE) {
    const g = findSwallowedGates(src, 'x.sh')
    if (g.length) fails.push(`GATE MUST IGNORE but flagged: ${name} -> ${JSON.stringify(g)}`)
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
  console.log('\x1b[2mA committed heredoc must not execute its own body\x1b[0m\n')

  const fails = selfTest()
  if (fails.length) {
    console.error('\x1b[31m✗ SELF-TEST FAILED — refusing to scan with a broken matcher\x1b[0m')
    for (const f of fails) console.error(`    ${f}`)
    return 1
  }
  console.log(`  \x1b[32m✓\x1b[0m self-test: ${MUST_CATCH.length + GATE_CATCH.length} catch + ` +
    `${MUST_IGNORE.length + GATE_IGNORE.length} ignore cases (heredoc + swallowed-gate)\n`)

  // audit:auditor-contracts reads this line to see BOTH halves rather than trust they exist.
  console.log(`  auditor-contract: catch=${MUST_CATCH.length + GATE_CATCH.length} ` +
    `ignore=${MUST_IGNORE.length + GATE_IGNORE.length}`)
  const tracked = execFileSync('git', ['-C', REPO, 'ls-files'], { encoding: 'utf-8' })
    .split('\n').filter(Boolean)
  const found: Finding[] = []
  const gates: Finding[] = []
  let scanned = 0
  for (const rel of tracked) {
    let body: string
    try { body = readFileSync(join(REPO, rel), 'utf-8') } catch { continue }
    if (!isShell(rel, body)) continue
    scanned++
    found.push(...findHeredocSubstitutions(body, rel))
    gates.push(...findSwallowedGates(body, rel))
  }

  if (gates.length) {
    for (const g of gates) console.log(`\x1b[31m  ✗ ${g.file}:${g.line}\x1b[0m  ${g.text.slice(0, 96)}`)
    console.log(`\n\x1b[31m\x1b[1mRESULT: FAIL\x1b[0m — ${gates.length} gate(s) with a discarded exit status.`)
    console.log('  `|| true` on something whose purpose is to FAIL converts a refusal into an')
    console.log('  invisible success — the same act as --no-verify, one layer in.')
    console.log('  Fine on cleanup and probes. If genuinely advisory, say so:  # gate-ok: <reason>')
    return 1
  }

  if (found.length) {
    for (const f of found) console.log(`\x1b[31m  ✗ ${f.file}:${f.line}\x1b[0m  ${f.text.slice(0, 96)}`)
    console.log(`\n\x1b[31m\x1b[1mRESULT: FAIL\x1b[0m — ${found.length} heredoc line(s) will be EXECUTED, not written.`)
    console.log("  Use a quoted delimiter:  <<'EOF'   (both ' and \" disable expansion)")
    console.log('  $VAR interpolation is fine unquoted — it is ` and $( ) that run.')
    console.log('  Genuinely a generator? add:  # shell-safety-ok: <reason>')
    return 1
  }
  console.log(`\x1b[32m\x1b[1mRESULT: PASS\x1b[0m — ${scanned} shell file(s), no self-executing heredocs, no swallowed gates`)
  return 0
}

process.exit(main())

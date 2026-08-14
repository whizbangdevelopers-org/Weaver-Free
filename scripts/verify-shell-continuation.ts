// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:shell-continuation — a comment must not interrupt a backslash-continued command.
 *
 * WHY THIS EXISTS
 * ---------------
 * A `\`+newline is consumed BEFORE comment processing, so a comment placed between two continued
 * lines begins at the end of the joined logical line and comments out the remainder of it.
 * Everything below then executes as a SEPARATE command:
 *
 *     rsync -av --delete --delete-excluded \
 *       --exclude=A \
 *       # why this one must stay
 *       --exclude=B \
 *       source/ target/
 *
 *     + rsync -av --delete --delete-excluded --exclude=A     <- source and destination GONE
 *     + --exclude=B source/ target/                          <- command not found (127)
 *
 * Both halves are wrong in the worst way for a sync: the command loses its trailing arguments,
 * and every flag below the comment silently stops applying.
 *
 * WHY A CHECKER AND NOT A RULE
 * ----------------------------
 * `~/.claude/rules/standardize-on-bash.md` already says to keep narration outside the command
 * block. It was loaded, and the defect was introduced anyway — while documenting an rsync
 * exclusion, i.e. by someone actively thinking about that exact command. A control you must
 * remember is not a control; this is the same escalation `cwd-independent-tooling.md` records
 * after its behavioural rule failed eight times.
 *
 * NEITHER `bash -n` NOR shellcheck CATCHES IT — both verified, not assumed. `bash -n` reports the
 * file VALID, because it is syntactically valid; only the meaning changed. `shellcheck -s bash`
 * exits 0 with no output. So a green syntax check is not evidence, and nothing else in the chain
 * looks at this.
 *
 * SCANS SHELL FILES *AND* WORKFLOW `run:` BODIES
 * ----------------------------------------------
 * The defect this was written from lived in a GitHub Actions `run:` block, not a `.sh` file. An
 * auditor modelled on verify-shell-safety.ts's `isShell()` alone would have missed the very case
 * that motivated it — so `run:` block scalars in .github YAML are extracted (with their real line
 * numbers) and scanned as shell.
 *
 * THE FOUR SHAPES THAT ARE *NOT* THE DEFECT — each verified by running bash, not by reasoning:
 *   1. A usage/comment block (`# cmd -a \` continued by `#   --flag x`). A comment line ending in
 *      `\` does NOT continue, so the following comment is innocent. This is the false positive the
 *      first draft of this detector produced against scripts/add-decision.sh.
 *   2. A BLANK line after the continuation. The blank already terminated the command, so a later
 *      comment is not the cause.
 *   3. An EVEN number of trailing backslashes (`foo\\`) — an escaped backslash, not a continuation.
 *   4. A heredoc body. `\` and `#` inside one are DATA. Same lesson as the cwd hook, which had to
 *      learn to strip heredoc bodies rather than only quoted substrings.
 *
 * Suppression, per ~/.claude/rules/never-game-auditors.md, requires a reason:
 *     # shell-continuation-ok: <why this comment genuinely belongs here>
 *
 * Measured at introduction: 0 occurrences across the tracked shell files and .github workflows, so
 * this starts green and only ever fires on something new — the same footing shell-safety shipped
 * on. A guard added over known violations is one that gets disabled on its first real run.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = execFileSync('git', ['-C', PKG, 'rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim()

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m', OFF = '\x1b[0m'

const COMMENT = /^[ \t]*#/
const BLANK = /^[ \t]*$/
const HEREDOC_OPEN = /<<-?[ \t]*("[^"]+"|'[^']+'|[A-Za-z_][A-Za-z0-9_]*)/g
const SUPPRESS = /shell-continuation-ok:[^\S\r\n]*\S+/

export interface Finding {
  file: string
  line: number
  /** The continued command line whose meaning the comment truncates. */
  command: string
  /** The comment that does the truncating. */
  comment: string
}

/** Trailing backslashes: an ODD count continues the line, an EVEN count is an escaped backslash. */
function continuesLine(raw: string): boolean {
  const m = /(\\+)[ \t]*$/.exec(raw)
  if (!m) return false
  return m[1].length % 2 === 1
}

/**
 * Pure: which comment lines sit inside a backslash-continued command?
 *
 * `offset` shifts reported line numbers so an extracted YAML `run:` body reports against the
 * workflow file's real lines rather than the body's own.
 */
export function findInterruptedContinuations(content: string, path = '', offset = 0): Finding[] {
  const lines = content.split('\n')
  const out: Finding[] = []
  const heredoc: { delim: string }[] = []
  let pending: { line: number; text: string } | null = null

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]

    // 4. A heredoc body is DATA — never commands. Consume it wholesale.
    if (heredoc.length) {
      if (raw.trim() === heredoc[heredoc.length - 1].delim) heredoc.pop()
      continue
    }

    // 2. A blank line terminates the continuation, so any later comment is innocent.
    if (BLANK.test(raw)) {
      pending = null
      continue
    }

    if (COMMENT.test(raw)) {
      if (pending && !SUPPRESS.test(raw)) {
        out.push({
          file: path,
          line: pending.line + offset,
          command: pending.text.trim(),
          comment: raw.trim(),
        })
      }
      // 1. A comment line never continues, whatever it ends with.
      pending = null
      continue
    }

    // A heredoc opened on this line: its body starts next line.
    for (const m of raw.matchAll(HEREDOC_OPEN)) {
      heredoc.push({ delim: m[1].replace(/["']/g, '') })
    }

    // 3. Odd trailing backslashes only.
    pending = continuesLine(raw) ? { line: i + 1, text: raw } : null
  }
  return out
}

/** `run:` block scalars in a workflow, each with the absolute line its body starts on. */
export function extractRunBlocks(yaml: string): { body: string; startLine: number }[] {
  const lines = yaml.split('\n')
  const blocks: { body: string; startLine: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const m = /^([ \t]*)(?:-[ \t]+)?run:[ \t]*[|>][-+]?[ \t]*$/.exec(lines[i])
    if (!m) continue
    const keyIndent = m[1].length
    const body: string[] = []
    let j = i + 1
    for (; j < lines.length; j++) {
      const l = lines[j]
      if (BLANK.test(l)) { body.push(''); continue }
      const indent = l.length - l.replace(/^[ \t]*/, '').length
      if (indent <= keyIndent) break
      body.push(l)
    }
    if (body.length) blocks.push({ body: body.join('\n'), startLine: i + 1 })
    i = j - 1
  }
  return blocks
}

// ── Corpus ───────────────────────────────────────────────────────────────────────────────────
// Every CATCH case is a shape bash was OBSERVED to truncate; every IGNORE case is one bash was
// observed to leave intact. None of these were reasoned about — two of the IGNOREs (blank line,
// even backslashes) contradicted the first draft's assumptions and were corrected by running them.

const MUST_CATCH: [string, string][] = [
  ['the rsync defect this was written from',
    'rsync -av --delete \\\n  --exclude=A \\\n  # why this one must stay\n  --exclude=B \\\n  src/ dst/\n'],
  ['minimal two-line', 'cmd -a \\\n# c\ncmd -b\n'],
  ['indented comment mid-chain', 'cmd \\\n  --a \\\n     # note\n  --b\n'],
  ['comment interrupts the FIRST continuation', 'cmd \\\n# note\n  --a\n'],
  ['three backslashes still continues', 'printf "a\\\\\\\n# note\necho b\n'],
  ['second interruption in the same file',
    'cmd --x \\\n  --y\ncmd2 \\\n  # here\n  --z\n'],
  ['after a closed heredoc', "cat <<'EOF'\nbody\nEOF\ncmd \\\n# note\n  --a\n"],
]

const MUST_IGNORE: [string, string][] = [
  // The false positive the first draft produced, against a real repo file.
  ['usage block: comment continued by comment',
    '# usage: cmd -a \\\n#   --flag x\ncmd\n'],
  ['clean continuation', 'cmd -a \\\n  --flag b \\\n  src dst\n'],
  ['comment above the command', '# explain\ncmd -a --b\n'],
  ['comment after a NON-continued command', 'cmd -a\n# unrelated note\ncmd -b\n'],
  ['blank line terminated it first', 'cmd -a \\\n\n# innocent\ncmd -b\n'],
  ['even backslashes are an escaped backslash', 'printf "x" ends\\\\\n# innocent\ncmd\n'],
  ['heredoc body containing \\ then #',
    "cat <<'EOF'\nline one \\\n# prose, not a comment\nEOF\n"],
  ['unquoted heredoc body is still data',
    'cat <<EOF\nvalue \\\n# still prose\nEOF\n'],
  ['hash inside a string on a continued line', 'cmd --title "a # b" \\\n  --flag\n'],
  ['suppressed with a reason',
    'cmd -a \\\n# shell-continuation-ok: verified inert, this block is quoted data\n  --b\n'],
  ['no continuations at all', 'set -euo pipefail\nif true; then\n  # fine\n  echo ok\nfi\n'],
]

const YAML_CATCH = `jobs:
  a:
    steps:
      - name: sync
        run: |
          rsync -av \\
            --exclude=A \\
            # a note
            --exclude=B \\
            src/ dst/
`

const YAML_IGNORE = `jobs:
  a:
    steps:
      - name: sync
        run: |
          # a leading note is fine
          rsync -av \\
            --exclude=A \\
            src/ dst/
      - name: next
        run: echo done
`

function selfTest(): string[] {
  const fails: string[] = []
  for (const [name, src] of MUST_CATCH) {
    if (findInterruptedContinuations(src, 'x.sh').length === 0) fails.push(`MUST CATCH but did not: ${name}`)
  }
  for (const [name, src] of MUST_IGNORE) {
    const got = findInterruptedContinuations(src, 'x.sh')
    if (got.length) fails.push(`MUST IGNORE but flagged: ${name} -> ${JSON.stringify(got)}`)
  }
  // The YAML half must be exercised separately: the motivating defect lived in a run: body, and a
  // shell-only scan would have missed it entirely.
  const cb = extractRunBlocks(YAML_CATCH)
  if (cb.length !== 1) fails.push(`YAML: expected 1 run block, got ${cb.length}`)
  else if (findInterruptedContinuations(cb[0].body, 'w.yml', cb[0].startLine).length === 0) {
    fails.push('MUST CATCH but did not: interrupted continuation inside a workflow run: body')
  }
  const ib = extractRunBlocks(YAML_IGNORE)
  if (ib.length !== 1) fails.push(`YAML: expected 1 block-scalar run, got ${ib.length}`)
  else if (findInterruptedContinuations(ib[0].body, 'w.yml', ib[0].startLine).length) {
    fails.push('MUST IGNORE but flagged: clean workflow run: body')
  }
  return fails
}

function isShell(path: string, body: string): boolean {
  if (/\.(sh|bash)$/.test(path)) return true
  return /^#!.*\b(bash|sh|zsh)\b/.test(body.split('\n')[0] ?? '')
}

function isWorkflow(path: string): boolean {
  return /^\.github\/(workflows|workflow-templates)\/.*\.ya?ml$/.test(path)
}

function main(): number {
  console.log(`\n  ${BOLD}Shell Continuation${OFF}`)
  console.log(`  ${DIM}A comment must not interrupt a backslash-continued command${OFF}\n`)

  const fails = selfTest()
  if (fails.length) {
    console.error(`${RED}✗ SELF-TEST FAILED — refusing to scan with a broken matcher${OFF}`)
    for (const f of fails) console.error(`    ${f}`)
    return 1
  }
  const catchN = MUST_CATCH.length + 1
  const ignoreN = MUST_IGNORE.length + 1
  console.log(`  ${GREEN}✓${OFF} self-test: ${catchN} catch + ${ignoreN} ignore cases ${DIM}(incl. the YAML run: pair)${OFF}`)
  // audit:auditor-contracts reads this line to see BOTH halves rather than trust they exist.
  console.log(`  auditor-contract: catch=${catchN} ignore=${ignoreN}`)

  const tracked = execFileSync('git', ['-C', REPO, 'ls-files'], { encoding: 'utf-8' }).split('\n').filter(Boolean)
  const found: Finding[] = []
  let shellFiles = 0
  let runBlocks = 0

  for (const rel of tracked) {
    let body: string
    try { body = readFileSync(join(REPO, rel), 'utf-8') } catch { continue }

    if (isWorkflow(rel)) {
      for (const blk of extractRunBlocks(body)) {
        runBlocks++
        found.push(...findInterruptedContinuations(blk.body, rel, blk.startLine))
      }
      continue
    }
    if (!isShell(rel, body)) continue
    shellFiles++
    found.push(...findInterruptedContinuations(body, rel))
  }

  if (found.length) {
    for (const f of found) {
      console.log(`${RED}  ✗ ${f.file}:${f.line}${OFF}`)
      console.log(`      ${DIM}continued:${OFF} ${f.command.slice(0, 88)}`)
      console.log(`      ${DIM}truncated by:${OFF} ${f.comment.slice(0, 88)}`)
    }
    console.log(`\n${RED}${BOLD}RESULT: FAIL${OFF} — ${found.length} command(s) silently truncated by a comment.`)
    console.log('  The \\+newline is consumed before comment processing, so the comment ends the')
    console.log('  logical line: trailing arguments are lost and the rest runs as its own command.')
    console.log(`  ${DIM}bash -n and shellcheck both report this as valid — they cannot be the check.${OFF}`)
    console.log('  Move the note ABOVE the whole command. Genuinely belongs inline?')
    console.log('  add:  # shell-continuation-ok: <reason>')
    return 1
  }

  console.log(
    `\n${GREEN}${BOLD}RESULT: PASS${OFF} — ${shellFiles} shell file(s) + ${runBlocks} workflow run: block(s), ` +
      'no interrupted continuations\n'
  )
  return 0
}

process.exit(main())

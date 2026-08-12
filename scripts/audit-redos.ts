// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * ReDoS (Regular Expression Denial of Service) Auditor
 *
 * Scans source code for regex literals and new RegExp() constructions whose
 * patterns exhibit catastrophic backtracking. A line-level heuristic extractor
 * finds regexes in .ts, .js, and .vue files, then a TWO-STAGE check classifies
 * each one:
 *
 *   Stage 1 — `safe-regex` (star-height heuristic): cheap pre-filter. Catches
 *     the broad class of nested-quantifier patterns but OVER-FIRES: its star
 *     height counts a bounded outer quantifier (`?`, `{0,1}`, `{m,n}`) as added
 *     nesting depth, so provably-safe patterns like `([a-z-]*[a-z])?` (a `?`
 *     wrapper that permits at most one repetition) get flagged.
 *
 *   Stage 2 — `isCatastrophic` (regexp-tree AST analysis): confirmation gate.
 *     A pattern is reported ONLY if stage 1 flags it AND the AST confirms a real
 *     super-linear nest. The confirmed-dangerous shapes are:
 *       (a) an amplifying repetition (unbounded `*`/`+`/`{n,}`, or bounded
 *           `{m,n}` with n>=2) whose subtree contains an UNBOUNDED repetition
 *           — e.g. `(a+)+`, `([a-z]+)*`, `(.*a){10}`; and
 *       (b) an UNBOUNDED repetition over a disjunction (overlapping-branch
 *           risk) — e.g. `(a|a)*`, `(a|ab)*`.
 *     Bounded×bounded nests (e.g. IPv4 `\d{1,3}(\.\d{1,3}){3}`) do constant
 *     work and are correctly cleared. Parse failures default to "catastrophic"
 *     so an unparseable flagged pattern is never silently suppressed.
 *
 * This staged design fixes the star-height false-positive class WITHOUT
 * weakening detection: stage 2 never suppresses a pattern stage 1 passed, and
 * it confirms every known catastrophic form (validated against a dangerous/safe
 * battery — see the auditor's commit). Per ~/.claude/rules/never-game-auditors:
 * the fix tightens the rule, it does not reword the input to dodge the trigger.
 *
 * Suppress a residual finding with `redos-ignore[<match-snippet>]` anywhere in
 * the 5 lines before the flagged line. The snippet is any substring of the
 * regex pattern string (e.g., `redos-ignore[a+]+` for `/^(a+)+$/`). Document WHY.
 *
 * Usage: npm run audit:redos
 *
 * The capability split between this auditor and CodeQL is recorded in the internal
 * engineering notes.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, extname } from 'path'
import { createRequire } from 'module'

const _require = createRequire(import.meta.url)
const safeRegex = _require('safe-regex') as (re: string | RegExp, opts?: { limit?: number }) => boolean
const regexpTree = _require('regexp-tree') as { parse: (re: string | RegExp) => RegexpNode }

// ── Stage 2: AST-based catastrophic-backtracking confirmation ────────────────
//
// regexp-tree AST nodes we care about. `quantifier.kind` is '+', '*', '?', or
// 'Range' (with numeric `from` and optional `to`; `to` undefined => unbounded).

interface Quantifier {
  kind: '+' | '*' | '?' | 'Range'
  from?: number
  to?: number
}
interface RegexpNode {
  type: string
  quantifier?: Quantifier
  expression?: RegexpNode
  expressions?: RegexpNode[]
  body?: RegexpNode
  left?: RegexpNode
  right?: RegexpNode
  assertion?: RegexpNode
}

// An unbounded quantifier permits arbitrarily many repetitions of its body.
function isUnbounded(q?: Quantifier): boolean {
  if (!q) return false
  if (q.kind === '+' || q.kind === '*') return true
  if (q.kind === 'Range') return q.to === undefined || q.to === null
  return false // '?'
}

// An amplifier permits >=2 repetitions (so it multiplies inner backtracking).
// '?' / {0,1} / {1,1} cannot amplify (max one repetition) — provably safe outer.
function isAmplifier(q?: Quantifier): boolean {
  if (!q) return false
  if (isUnbounded(q)) return true
  if (q.kind === 'Range') return (q.to ?? 0) >= 2
  return false
}

function childrenOf(n?: RegexpNode): RegexpNode[] {
  if (!n) return []
  switch (n.type) {
    case 'RegExp':
      return n.body ? [n.body] : []
    case 'Alternative':
      return n.expressions ?? []
    case 'Disjunction':
      return [n.left, n.right].filter(Boolean) as RegexpNode[]
    case 'Group':
    case 'Repetition':
      return n.expression ? [n.expression] : []
    case 'Assertion':
      return n.assertion ? [n.assertion] : []
    default:
      return []
  }
}

function subtreeHasUnbounded(n?: RegexpNode): boolean {
  if (!n) return false
  if (n.type === 'Repetition' && isUnbounded(n.quantifier)) return true
  return childrenOf(n).some(subtreeHasUnbounded)
}

function subtreeHasDisjunction(n?: RegexpNode): boolean {
  if (!n) return false
  if (n.type === 'Disjunction') return true
  return childrenOf(n).some(subtreeHasDisjunction)
}

// True iff the pattern contains a super-linear backtracking nest. Conservative:
// an unparseable pattern returns true (never silently suppress a flagged regex).
function isCatastrophic(pattern: string): boolean {
  let ast: RegexpNode
  try {
    ast = regexpTree.parse(new RegExp(pattern))
  } catch {
    return true
  }
  let dangerous = false
  const walk = (n?: RegexpNode): void => {
    if (!n || dangerous) return
    if (n.type === 'Repetition') {
      // (a) amplifying outer over an unbounded inner — incl. bounded {m,n>=2}
      //     over `.*`/`.+` (polynomial-degree blowup, e.g. `(.*a){10}`).
      if (isAmplifier(n.quantifier) && subtreeHasUnbounded(n.expression)) {
        dangerous = true
        return
      }
      // (b) unbounded outer over a disjunction (overlapping-branch risk).
      if (isUnbounded(n.quantifier) && subtreeHasDisjunction(n.expression)) {
        dangerous = true
        return
      }
    }
    for (const c of childrenOf(n)) walk(c)
  }
  walk(ast)
  return dangerous
}

interface Finding {
  file: string
  line: number
  pattern: string
  source: 'literal' | 'new-regexp'
}

// Pre-context characters that reliably precede a regex literal (not division).
// After an identifier or closing bracket/paren the `/` is almost always division.
const REGEX_CONTEXT = /(?:^|[=({[!&|?:,;<>+\-*~^%])[ \t]*\/(?!\*|\/)/

// Flags suffix on regex literals.
const FLAGS_RE = /^[gimsuy]*/

// new RegExp("...") or new RegExp('...') with a static string argument.
const NEW_REGEXP_STR = /\bnew\s+RegExp\(\s*(['"])([^'"\\]+(?:\\.[^'"\\]*)*)\1\s*(?:[,)])/g

// Tokens that will cause the whole line to be skipped as a likely false
// positive (URLs, import paths, CSS/HTML, pure comment lines).
const SKIP_LINE = /https?:\/\/|^\s*[\/*]|^\s*<!--/

function extractLiterals(line: string): string[] {
  // Strip inline // comment before scanning so comment text isn't parsed.
  const commentAt = line.indexOf('//')
  const scanLine = commentAt >= 0 ? line.slice(0, commentAt) : line

  if (SKIP_LINE.test(scanLine)) return []

  const patterns: string[] = []
  let i = 0
  while (i < scanLine.length) {
    // Find the next `/` that looks like the start of a regex literal.
    const slashPos = scanLine.indexOf('/', i)
    if (slashPos === -1) break

    const nextCh = scanLine[slashPos + 1]

    // Skip comment starts: // or /*
    if (nextCh === '/' || nextCh === '*') {
      i = slashPos + 2
      continue
    }

    const prefix = scanLine.slice(0, slashPos + 1)
    if (!REGEX_CONTEXT.test(prefix)) {
      i = slashPos + 1
      continue
    }

    // Scan forward to find the matching closing `/`, respecting escapes and
    // character classes.
    let body = ''
    let j = slashPos + 1
    let inClass = false
    while (j < scanLine.length) {
      const ch = scanLine[j]!
      if (ch === '\\') {
        body += ch + (scanLine[j + 1] ?? '')
        j += 2
        continue
      }
      if (ch === '[') inClass = true
      else if (ch === ']') inClass = false
      else if (ch === '/' && !inClass) break
      body += ch
      j++
    }

    // Minimum body length and validity checks — skip obvious false positives:
    //   - Empty or single-char bodies (division operators, path separators)
    //   - Bodies containing `<` or `>` (HTML attributes / JSX, not regex)
    //   - Bodies containing `{{` or `}}` (Vue template expressions)
    //   - Bodies starting with `)` (extracted from mid-expression)
    if (
      j >= scanLine.length ||
      body.length < 2 ||
      body.includes('<') ||
      body.includes('>') ||
      body.includes('{{') ||
      body.startsWith(')')
    ) {
      i = slashPos + 1
      continue
    }

    // Consume flags.
    const tail = scanLine.slice(j + 1)
    const flagsMatch = FLAGS_RE.exec(tail)
    const flags = flagsMatch ? flagsMatch[0] : ''
    // Validate the extracted body is actually parseable as a regex before
    // adding it. Malformed bodies (mid-expression false positives from
    // .replace() chains, template expressions, etc.) will throw here.
    try {
      new RegExp(body)
    } catch {
      i = slashPos + 1
      continue
    }

    patterns.push(body)
    i = j + 1 + flags.length
  }
  return patterns
}

function extractNewRegexps(line: string): string[] {
  const patterns: string[] = []
  NEW_REGEXP_STR.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = NEW_REGEXP_STR.exec(line)) !== null) {
    if (m[2]) patterns.push(m[2])
  }
  return patterns
}

function walkDir(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    if (['node_modules', 'dist', 'coverage', '.stryker-tmp'].includes(entry)) continue
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...walkDir(fullPath))
    } else if (['.ts', '.js', '.vue'].includes(extname(entry))) {
      files.push(fullPath)
    }
  }
  return files
}

function scanFile(filePath: string): Finding[] {
  const relPath = relative(process.cwd(), filePath)
  if (/node_modules|\.spec\.ts$|\.spec\.js$/.test(relPath)) return []

  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const findings: Finding[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lookback = lines.slice(Math.max(0, i - 5), i).join('\n')

    for (const pat of extractLiterals(line)) {
      if (lookback.includes(`redos-ignore[${pat}]`)) continue
      try {
        // Stage 1 (safe-regex) flags, Stage 2 (AST) confirms — both required.
        if (!safeRegex(pat) && isCatastrophic(pat)) {
          findings.push({ file: relPath, line: i + 1, pattern: pat, source: 'literal' })
        }
      } catch {
        // Malformed pattern extracted by heuristic; skip.
      }
    }

    for (const pat of extractNewRegexps(line)) {
      if (lookback.includes(`redos-ignore[${pat}]`)) continue
      try {
        if (!safeRegex(pat) && isCatastrophic(pat)) {
          findings.push({ file: relPath, line: i + 1, pattern: pat, source: 'new-regexp' })
        }
      } catch {
        // Malformed pattern; skip.
      }
    }
  }
  return findings
}

function main() {
  const rootDir = process.cwd()
  // scripts/ is excluded: audit scripts process trusted internal data (docs,
  // package.json, spec files) with no user-supplied input, so their regex
  // complexity cannot be exploited externally. Same precedent as audit-sast.ts.
  const scanDirs = ['src', 'backend/src', 'tui/src']
    .map((d) => join(rootDir, d))
    .filter((d) => {
      try {
        statSync(d)
        return true
      } catch {
        return false
      }
    })

  const allFiles = scanDirs.flatMap((d) => walkDir(d))
  const findings: Finding[] = allFiles.flatMap((f) => scanFile(f))

  const fileCount = allFiles.length
  console.log(`\n  ReDoS Scan — ${fileCount} files\n`)

  if (findings.length === 0) {
    console.log('  ✓ No catastrophic-backtracking patterns detected\n')
    process.exit(0)
  }

  console.log(`  FINDINGS (${findings.length}):\n`)
  for (const f of findings) {
    console.log(`    ✗ ${f.file}:${f.line}  [${f.source}]`)
    console.log(`      Pattern: /${f.pattern}/\n`)
  }

  console.log(`  ${findings.length} unsafe regex pattern(s) found.`)
  console.log(`  Suppress with: redos-ignore[<pattern>] in a comment within 5 lines above.\n`)
  process.exit(1)
}

main()

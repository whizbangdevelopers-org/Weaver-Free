// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * ReDoS (Regular Expression Denial of Service) Auditor
 *
 * Scans source code for regex literals and new RegExp() constructions whose
 * patterns exhibit catastrophic backtracking. Uses `safe-regex` for the safety
 * check (star-height heuristic) and a line-level heuristic extractor to find
 * regexes in .ts, .js, and .vue files.
 *
 * Suppress a finding with `redos-ignore[<match-snippet>]` anywhere in the 5
 * lines before the flagged line. The snippet is any substring of the regex
 * pattern string (e.g., `redos-ignore[a+]+` for `/^(a+)+$/`). Document WHY —
 * safe-regex produces false positives on anchored character-class repetitions
 * where the character sets are provably disjoint at runtime.
 *
 * `regexp-tree` (installed alongside safe-regex) is available for future
 * template-literal regex analysis; it is not yet used in the scan loop.
 *
 * Usage: npm run audit:redos
 *
 * See NOTES.md #365 for the capability split between this auditor and CodeQL.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, extname } from 'path'
import { createRequire } from 'module'

const _require = createRequire(import.meta.url)
const safeRegex = _require('safe-regex') as (re: string | RegExp, opts?: { limit?: number }) => boolean

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
        if (!safeRegex(pat)) {
          findings.push({ file: relPath, line: i + 1, pattern: pat, source: 'literal' })
        }
      } catch {
        // Malformed pattern extracted by heuristic; skip.
      }
    }

    for (const pat of extractNewRegexps(line)) {
      if (lookback.includes(`redos-ignore[${pat}]`)) continue
      try {
        if (!safeRegex(pat)) {
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

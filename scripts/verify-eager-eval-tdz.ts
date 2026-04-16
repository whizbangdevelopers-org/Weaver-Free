// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * verify-eager-eval-tdz.ts — Static TDZ auditor for eager-eval composables.
 *
 * Detects the class of bug introduced on 2026-04-15 by MainLayout.vue:
 *
 *   const pageTitle = computed(() => appName.value + '...')
 *   useMeta(() => ({ title: pageTitle.value }))   // ← eager-eval NOW
 *   // ... 90 lines later:
 *   const appName = computed(() => 'Weaver Solo')  // ← TDZ
 *
 * `useMeta` (and other eager consumers like `watchEffect({immediate:true})`)
 * synchronously calls the passed getter at declaration time to set an
 * initial value. If that getter transitively reads a `const` declared
 * BELOW the eager call in the same <script setup>, the const is still in
 * the Temporal Dead Zone and JS throws:
 *
 *   ReferenceError: Cannot access 'X' before initialization
 *
 * Setup function dies, exposed bindings never reach the render context,
 * and the error surfaces downstream as "Cannot read properties of
 * undefined (reading 'isFabrick')" or similar — a misleading symptom that
 * burns hours in static analysis.
 *
 * See docs/development/LESSONS-LEARNED.md (2026-04-15) and KNOWN-GOTCHAS.md
 * § Frontend for full context.
 *
 * Usage:  npx tsx scripts/verify-eager-eval-tdz.ts
 * Exit:   0 = no violations, 1 = violations found
 */

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, resolve, relative } from 'path'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const ROOT = resolve(import.meta.dirname, '..')
const REPORT_DIR = join(ROOT, 'reports', 'eager-eval-tdz')

/**
 * Eager-eval composables — functions that synchronously call a passed
 * getter at declaration time. Extend this list when new patterns surface.
 *
 * Pattern: function name followed by `(` and a getter (arrow fn or inline
 * function) as its first argument.
 */
const EAGER_EVAL_FNS = [
  'useMeta',       // Quasar meta plugin — reads getter to set initial <title>
  'useHead',       // @vueuse/head / unhead — same pattern
]

/**
 * watchEffect is special: it's only eager when { immediate: true } is
 * passed (default is eager — `watchEffect(fn)` runs immediately). We
 * flag ALL `watchEffect` calls since the default is eager.
 */
const EAGER_EVAL_REGEX = new RegExp(
  `\\b(?:${EAGER_EVAL_FNS.join('|')}|watchEffect)\\s*\\(`,
  'g',
)

interface Violation {
  file: string
  callLine: number
  callText: string
  eagerFn: string
  tdzRef: string
  declLine: number
  severity: 'error'
}

interface Declaration {
  name: string
  line: number
  /** If this const is a computed/ref with a function body, the body text. */
  body?: string
}

/**
 * Extract the `<script setup>` block from a .vue file. Returns the script
 * body + the file-relative line offset (so we can report line numbers that
 * match the original file).
 */
function extractScriptSetup(src: string): { body: string; offset: number } | null {
  const match = src.match(/<script\s+[^>]*\bsetup\b[^>]*>([\s\S]*?)<\/script>/)
  if (!match) return null
  const scriptStart = match.index! + match[0].indexOf('>') + 1
  const preamble = src.slice(0, scriptStart)
  const offset = preamble.split('\n').length - 1
  return { body: match[1]!, offset }
}

/**
 * Find all top-level `const <name> =` declarations in a <script setup>
 * body. "Top-level" means outside any function body — we detect this by
 * tracking brace depth. Only top-level consts can cause TDZ for eager
 * consumers, because anything inside a function body runs lazily on call.
 */
function findTopLevelDeclarations(body: string): Declaration[] {
  const decls: Declaration[] = []
  const lines = body.split('\n')
  let depth = 0
  let inString: string | null = null
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    // Strip strings + comments character by character while tracking depth
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]!
      const next = line[j + 1]
      if (inLineComment) continue
      if (inBlockComment) {
        if (ch === '*' && next === '/') { inBlockComment = false; j++ }
        continue
      }
      if (inString) {
        if (ch === '\\') { j++; continue }
        if (ch === inString) inString = null
        continue
      }
      if (ch === '/' && next === '/') { inLineComment = true; break }
      if (ch === '/' && next === '*') { inBlockComment = true; j++; continue }
      if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue }
      if (ch === '{' || ch === '(' || ch === '[') depth++
      if (ch === '}' || ch === ')' || ch === ']') depth--
    }
    inLineComment = false

    // Only record decls that START at depth 0 (before any braces open on this line)
    // We approximate: if depth was 0 at the START of this line AND the line
    // starts with `const <name> =`, record it.
    // For simplicity, check any line whose trimmed content starts with `const`
    // and whose depth at line-end is equal to the depth at line-start or 1 more
    // (for destructuring blocks). Keep it simple — accept false-matches at
    // depth 0 and a declaration context, reject anything clearly nested.
  }

  // Simpler second pass: find `const X = ` at start of trimmed line, AND
  // verify it's outside a `function` / `=>` block by checking the brace
  // depth at the start of that line. For function-body consts (computed,
  // ref-returning composables, arrow-fn assignments), capture the body so
  // we can walk transitive dependencies later.
  const depthAtLineStart = computeLineStartDepth(body)
  const declRegex = /^\s*const\s+(?:\{[^}]+\}\s*=|([a-zA-Z_$][a-zA-Z_0-9$]*)\s*=)/
  const body_ = body
  lines.forEach((line, idx) => {
    if (depthAtLineStart[idx] !== 0) return
    const m = declRegex.exec(line)
    if (!m) return
    if (m[1]) {
      // Try to capture the function body of this const's RHS if it's
      // `computed(() => ...)`, `computed(function () { ... })`, or similar.
      // We find the `=` then look for `computed(` or `(` followed by `=>`.
      const rhsStart = sumLineLengths(lines, idx) + line.indexOf('=') + 1
      const fnBody = extractFunctionBodyAfterEquals(body_, rhsStart)
      decls.push({ name: m[1], line: idx, body: fnBody ?? undefined })
    } else {
      // Destructuring: const { a, b } = ... — extract names (no body to track)
      const destructure = line.match(/^\s*const\s+\{([^}]+)\}/)
      if (destructure) {
        for (const name of destructure[1]!.split(',')) {
          const clean = name.trim().split(':')[0]!.trim()
          if (/^[a-zA-Z_$][a-zA-Z_0-9$]*$/.test(clean)) {
            decls.push({ name: clean, line: idx })
          }
        }
      }
    }
  })
  return decls
}

/**
 * Starting just after the `=` of a `const X = ...` declaration, try to
 * extract a function body. Recognizes:
 *   computed(() => ...)        → body is the arrow fn body
 *   computed(function () { })  → body is the function body
 *   () => expr                 → body is `expr`
 *   function () { }            → body is the function body
 * Returns the inner text of the function body as a string, or null.
 */
function extractFunctionBodyAfterEquals(src: string, start: number): string | null {
  // Skip whitespace
  let i = start
  while (i < src.length && /\s/.test(src[i]!)) i++
  // Peek for computed(/ref(/watchEffect( wrapper
  const wrapperMatch = src.slice(i).match(/^(computed|ref|watch|watchEffect)\s*\(/)
  if (wrapperMatch) {
    i += wrapperMatch[0].length
  }
  // Skip whitespace
  while (i < src.length && /\s/.test(src[i]!)) i++
  // Now expect `() => ...` or `function () { ... }` or `(args) => ...`
  // Arrow function: match `(...) =>`
  const arrowMatch = src.slice(i).match(/^(\([^)]*\))\s*=>\s*/)
  if (arrowMatch) {
    i += arrowMatch[0].length
    // Body is either `{ ... }` or a single expression until `,` or `)`
    if (src[i] === '{') {
      // Brace body — find matching close
      return extractBracedBody(src, i)
    }
    // Expression body — extract until matching `)` at depth 0 or `,` at depth 1
    return extractFirstArgument(src, i)
  }
  // Function expression: `function ... () { ... }`
  const fnMatch = src.slice(i).match(/^function\s*[a-zA-Z_$]*\s*\([^)]*\)\s*/)
  if (fnMatch) {
    i += fnMatch[0].length
    if (src[i] === '{') return extractBracedBody(src, i)
  }
  return null
}

function extractBracedBody(src: string, openBraceIdx: number): string | null {
  if (src[openBraceIdx] !== '{') return null
  let depth = 1
  let inString: string | null = null
  let inBlockComment = false
  const chars: string[] = []
  for (let i = openBraceIdx + 1; i < src.length; i++) {
    const ch = src[i]!
    const next = src[i + 1]
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++ }
      continue
    }
    if (inString) {
      chars.push(ch)
      if (ch === '\\') { chars.push(src[i + 1] ?? ''); i++; continue }
      if (ch === inString) inString = null
      continue
    }
    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; chars.push(ch); continue }
    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return chars.join('')
    }
    chars.push(ch)
  }
  return null
}

/** Track brace depth at the start of each line in the script body. */
function computeLineStartDepth(body: string): number[] {
  const lines = body.split('\n')
  const depths: number[] = new Array(lines.length)
  let depth = 0
  let inString: string | null = null
  let inBlockComment = false

  for (let i = 0; i < lines.length; i++) {
    depths[i] = depth
    const line = lines[i]!
    let inLineComment = false
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]!
      const next = line[j + 1]
      if (inLineComment) continue
      if (inBlockComment) {
        if (ch === '*' && next === '/') { inBlockComment = false; j++ }
        continue
      }
      if (inString) {
        if (ch === '\\') { j++; continue }
        if (ch === inString) inString = null
        continue
      }
      if (ch === '/' && next === '/') { inLineComment = true; break }
      if (ch === '/' && next === '*') { inBlockComment = true; j++; continue }
      if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue }
      if (ch === '{' || ch === '(' || ch === '[') depth++
      if (ch === '}' || ch === ')' || ch === ']') depth--
    }
  }
  return depths
}

/**
 * Find eager-eval call sites in the body. Returns the call's start line
 * (0-indexed, relative to body) and the captured getter body.
 */
interface EagerCall {
  fnName: string
  callLine: number
  getterBody: string
}

function findEagerCalls(body: string): EagerCall[] {
  const calls: EagerCall[] = []
  const depthAtLineStart = computeLineStartDepth(body)
  const lines = body.split('\n')

  // Match `<fn>(` where fn is one of the known eager consumers. Only
  // consider calls at top-level (depth 0) — calls inside function bodies
  // (e.g. inside onMounted) run lazily and don't cause TDZ.
  const fnPattern = new RegExp(`\\b(${EAGER_EVAL_FNS.join('|')}|watchEffect)\\s*\\(`, 'g')

  // Walk the body to find call sites and extract their first-argument getter.
  // Approach: scan char by char, when we hit a matching fn name followed by
  // `(`, extract the balanced first argument.
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    if (depthAtLineStart[lineIdx] !== 0) continue
    const line = lines[lineIdx]!
    fnPattern.lastIndex = 0
    const m = fnPattern.exec(line)
    if (!m) continue

    const fnName = m[1]!
    const openParen = m.index + m[0].length - 1
    // Extract the full first arg starting at openParen+1
    const absoluteStart = sumLineLengths(lines, lineIdx) + openParen + 1
    const firstArg = extractFirstArgument(body, absoluteStart)
    if (!firstArg) continue
    calls.push({ fnName, callLine: lineIdx, getterBody: firstArg })
  }
  return calls
}

function sumLineLengths(lines: string[], upto: number): number {
  let sum = 0
  for (let i = 0; i < upto; i++) sum += lines[i]!.length + 1 // +1 for newline
  return sum
}

/**
 * Starting at `start` (character position inside `body`, right after the
 * open paren of a function call), extract the text of the first argument
 * up to the matching comma at depth 0 or the closing paren. Handles
 * nested parens, brackets, braces, strings, and line/block comments.
 */
function extractFirstArgument(body: string, start: number): string | null {
  let depth = 1 // we're inside the opening (
  let inString: string | null = null
  let inBlockComment = false
  const chars: string[] = []

  for (let i = start; i < body.length; i++) {
    const ch = body[i]!
    const next = body[i + 1]

    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++ }
      continue
    }
    if (inString) {
      chars.push(ch)
      if (ch === '\\') { chars.push(body[i + 1] ?? ''); i++; continue }
      if (ch === inString) inString = null
      continue
    }
    if (ch === '/' && next === '/') {
      // Skip to end of line
      while (i < body.length && body[i] !== '\n') i++
      continue
    }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; chars.push(ch); continue }

    if (ch === '(' || ch === '[' || ch === '{') depth++
    if (ch === ')' || ch === ']' || ch === '}') {
      depth--
      if (depth === 0) return chars.join('')
    }
    if (ch === ',' && depth === 1) return chars.join('')

    chars.push(ch)
  }
  return null
}

/**
 * Extract identifier names referenced by a getter body. Returns bare
 * identifiers that look like local references to setup-scope consts.
 * Skips property accesses after `.`, keywords, method calls on literals, etc.
 */
function extractReferencedIdentifiers(getterBody: string): string[] {
  const identifiers = new Set<string>()
  // Strip strings and comments first
  const stripped = stripStringsAndComments(getterBody)
  // Match identifiers but skip ones preceded by `.` (property access)
  const idRegex = /(?<![.\w$])([a-zA-Z_$][a-zA-Z_0-9$]*)/g
  const KEYWORDS = new Set([
    'true', 'false', 'null', 'undefined', 'return', 'if', 'else', 'const',
    'let', 'var', 'function', 'new', 'typeof', 'instanceof', 'in', 'of',
    'this', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'throw', 'try', 'catch', 'finally', 'async', 'await', 'void', 'delete',
    'as', 'from', 'import', 'export', 'default', 'class', 'extends', 'super',
    'yield', 'static', 'get', 'set', 'Math', 'Object', 'Array', 'String',
    'Number', 'Boolean', 'Date', 'JSON', 'Error', 'Promise', 'Symbol',
    'console', 'window', 'document', 'globalThis',
  ])
  let match
  while ((match = idRegex.exec(stripped)) !== null) {
    const name = match[1]!
    if (!KEYWORDS.has(name)) identifiers.add(name)
  }
  return Array.from(identifiers)
}

function stripStringsAndComments(src: string): string {
  const out: string[] = []
  let inString: string | null = null
  let inBlockComment = false
  let inLineComment = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    const next = src[i + 1]
    if (inLineComment) {
      if (ch === '\n') { inLineComment = false; out.push(ch) }
      continue
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++ }
      continue
    }
    if (inString) {
      if (ch === '\\') { i++; continue }
      if (ch === inString) inString = null
      continue
    }
    if (ch === '/' && next === '/') { inLineComment = true; continue }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue }
    out.push(ch)
  }
  return out.join('')
}

// ---------------------------------------------------------------------------
// File walker
// ---------------------------------------------------------------------------

function walkVueFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue
      results.push(...walkVueFiles(fullPath))
    } else if (entry.endsWith('.vue')) {
      results.push(fullPath)
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function checkFile(file: string): Violation[] {
  const src = readFileSync(file, 'utf-8')
  const scriptSetup = extractScriptSetup(src)
  if (!scriptSetup) return []

  const { body, offset } = scriptSetup
  const decls = findTopLevelDeclarations(body)
  const declByName = new Map<string, Declaration>()
  for (const d of decls) declByName.set(d.name, d)

  const eagerCalls = findEagerCalls(body)
  const violations: Violation[] = []
  const bodyLines = body.split('\n')

  /**
   * Walk the transitive reference chain starting from a getter body.
   * Returns the set of const names the getter (transitively) reads.
   * Uses a visited set to avoid infinite recursion on circular refs.
   */
  function transitiveRefs(getterBody: string, visited = new Set<string>()): Set<string> {
    const all = new Set<string>()
    const direct = extractReferencedIdentifiers(getterBody)
    for (const ref of direct) {
      if (visited.has(ref)) continue
      visited.add(ref)
      all.add(ref)
      const decl = declByName.get(ref)
      // If the ref is itself a const with a function body (e.g. another
      // computed), recurse into it. This catches the chain:
      //   useMeta(() => pageTitle.value)
      //   → pageTitle body: `appName.value + ...`
      //   → appName declared later → TDZ
      if (decl?.body) {
        for (const t of transitiveRefs(decl.body, visited)) all.add(t)
      }
    }
    return all
  }

  for (const call of eagerCalls) {
    const refs = transitiveRefs(call.getterBody)
    for (const ref of refs) {
      const decl = declByName.get(ref)
      if (!decl) continue // not a local const — skip
      if (decl.line > call.callLine) {
        violations.push({
          file: relative(ROOT, file),
          callLine: call.callLine + offset + 1,
          callText: bodyLines[call.callLine]!.trim().slice(0, 100),
          eagerFn: call.fnName,
          tdzRef: ref,
          declLine: decl.line + offset + 1,
          severity: 'error',
        })
      }
    }
  }
  return violations
}

function main(): number {
  const srcDir = join(ROOT, 'src')
  if (!existsSync(srcDir)) {
    console.error(`${RED}src/ not found${RESET}`)
    return 1
  }

  const files = walkVueFiles(srcDir)
  const allViolations: Violation[] = []
  for (const file of files) {
    allViolations.push(...checkFile(file))
  }

  console.log(`${BOLD}Eager-Eval TDZ Report${RESET}`)
  console.log('======================\n')
  console.log(`Scanned ${files.length} .vue files`)
  console.log(`Eager-eval fns: ${EAGER_EVAL_FNS.join(', ')}, watchEffect\n`)

  if (allViolations.length === 0) {
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — no eager-eval TDZ risks found\n`)
  } else {
    for (const v of allViolations) {
      console.log(`${RED}✗${RESET} ${v.file}:${v.callLine}`)
      console.log(`  ${DIM}${v.callText}${RESET}`)
      console.log(`  ${YELLOW}${v.eagerFn}${RESET} reads ${BOLD}${v.tdzRef}${RESET} ${DIM}(declared at line ${v.declLine})${RESET}`)
      console.log(`  ${DIM}Fix: move '${v.tdzRef}' declaration above the ${v.eagerFn} call, OR move the ${v.eagerFn} call below line ${v.declLine}.${RESET}\n`)
    }
    console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${allViolations.length} eager-eval TDZ risk(s) found\n`)
  }

  // Write report
  mkdirSync(REPORT_DIR, { recursive: true })
  const reportPath = join(REPORT_DIR, `eager-eval-tdz-${new Date().toISOString().slice(0, 10)}.json`)
  writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    scanned: files.length,
    violations: allViolations,
    eagerFns: [...EAGER_EVAL_FNS, 'watchEffect'],
  }, null, 2))
  console.log(`${DIM}Report: ${relative(ROOT, reportPath)}${RESET}`)

  return allViolations.length > 0 ? 1 : 0
}

process.exit(main())

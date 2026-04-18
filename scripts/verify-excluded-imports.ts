// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Excluded-Imports Auditor
 *
 * Prevents the class of bug where a file in the public Free repo imports
 * a path that is sync-excluded (and therefore absent on Free). Left
 * unchecked, these regressions only surface when someone tries to build
 * Free's tarball — too late. The auditor catches them at push time.
 *
 * Rules:
 *
 *   1. If the IMPORTING file is itself sync-excluded, skip — it never
 *      ships to Free, so its imports don't need to be Free-safe.
 *
 *   2. `import X from '<excluded>'` (static top-level) is always a
 *      violation. Static imports can't be conditionally omitted.
 *
 *   3. `import('<excluded>')` (dynamic) is a violation UNLESS the call
 *      is inside a VITE_FREE_BUILD guard:
 *
 *        ...(import.meta.env.VITE_FREE_BUILD === 'true' ? [] : [
 *          { component: () => import('<excluded>') }
 *        ])
 *
 *      Rolldown tree-shakes the false branch, so the excluded import
 *      never needs to resolve on Free builds.
 *
 *   4. `import.meta.glob('<pattern that matches excluded>')` is always
 *      fine — glob returns an empty object when the directory is
 *      absent; callers must use ?? '' fallbacks.
 *
 * Usage:
 *   npx tsx scripts/verify-excluded-imports.ts
 *   npx tsx scripts/verify-excluded-imports.ts --verbose
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, relative, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

// ---------------------------------------------------------------------------
// Path alias resolution — matches tsconfig.json + Quasar conventions
// ---------------------------------------------------------------------------

const ALIASES: Record<string, string> = {
  'src/': 'src/',
  'components/': 'src/components/',
  'pages/': 'src/pages/',
  'stores/': 'src/stores/',
  'services/': 'src/services/',
  'composables/': 'src/composables/',
  'layouts/': 'src/layouts/',
  'boot/': 'src/boot/',
  'css/': 'src/css/',
  'assets/': 'src/assets/',
}

/**
 * Resolve an import specifier to a path relative to code/, or return
 * null if the specifier is a bare npm module, a node: protocol, or
 * otherwise not a local file.
 */
function resolveImportPath(specifier: string, importerFile: string): string | null {
  if (
    !specifier ||
    specifier.startsWith('node:') ||
    specifier.startsWith('virtual:') ||
    specifier.match(/^[a-z@][\w\-@/]*$/i) && !specifier.includes('/')
  ) {
    // npm bare module (no slash), e.g. 'vue', 'axios'
    if (!specifier.startsWith('.') && !specifier.startsWith('/') && !isAliased(specifier)) {
      // bare module with path — could be npm scoped, skip if no alias match
      if (!isAliased(specifier)) return null
    }
  }

  // Ignore obvious npm modules
  if (/^[a-z@][^/]*$/.test(specifier) || specifier.startsWith('@')) return null

  // Alias-resolved path
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (specifier.startsWith(alias)) {
      return target + specifier.slice(alias.length)
    }
  }

  // Relative path
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const importerDir = dirname(importerFile)
    const absolute = resolve(CODE_ROOT, importerDir, specifier)
    const rel = relative(CODE_ROOT, absolute)
    if (rel.startsWith('..')) return null // escaped code/
    return rel
  }

  // Absolute path from code/
  if (specifier.startsWith('/')) {
    return specifier.slice(1)
  }

  return null
}

function isAliased(specifier: string): boolean {
  return Object.keys(ALIASES).some((a) => specifier.startsWith(a))
}

// ---------------------------------------------------------------------------
// Sync exclusion parsing
// ---------------------------------------------------------------------------

const BASE_CODE_EXCLUDES = [
  'testing/',
  '.claude/',
  'CLAUDE.md',
  'TESTING.md',
  'playwright.config.ts',
  'vitest.config.ts',
  '.mcp.json',
  'flake.nix',
  'flake.lock',
]

function readSyncExcludes(): string[] {
  const path = resolve(PROJECT_ROOT, '.github', 'sync-exclude.yml')
  if (!existsSync(path)) return []
  const content = readFileSync(path, 'utf-8')
  const excludes: string[] = []
  for (const rawLine of content.split('\n')) {
    const stripped = rawLine.replace(/#.*$/, '').trim()
    if (!stripped || stripped === 'exclude:') continue
    const path = stripped.replace(/^-\s*/, '').trim()
    if (!path) continue
    excludes.push(path)
  }
  return excludes
}

function isExcluded(codeRelativePath: string, excludes: string[]): boolean {
  const normalized = codeRelativePath.replace(/^\.\//, '')
  for (const pattern of excludes) {
    // Directory match (pattern ends with /)
    if (pattern.endsWith('/')) {
      if (normalized.startsWith(pattern) || normalized.startsWith(pattern.slice(0, -1) + '/')) {
        return true
      }
      continue
    }
    // Exact file match — or file match when we drop the extension (for TS/JS imports that may not carry one)
    if (normalized === pattern) return true
    // Permit import specifier without extension to match '.ts' pattern
    const patternNoExt = pattern.replace(/\.(ts|tsx|js|jsx|vue|mjs|cjs)$/, '')
    const normalizedNoExt = normalized.replace(/\.(ts|tsx|js|jsx|vue|mjs|cjs)$/, '')
    if (normalizedNoExt === patternNoExt) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// File scanning
// ---------------------------------------------------------------------------

const SCAN_DIRS = ['src', 'backend/src', 'tui/src']
const SCAN_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs']
const SKIP_DIRS = new Set(['node_modules', 'dist', '.quasar', '.q-cache', 'reports', 'coverage', 'test-results'])

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walk(full, acc)
    } else if (SCAN_EXTS.some((e) => full.endsWith(e))) {
      acc.push(full)
    }
  }
  return acc
}

// ---------------------------------------------------------------------------
// Import extraction
// ---------------------------------------------------------------------------

interface ImportRef {
  specifier: string
  kind: 'static' | 'dynamic' | 'glob'
  line: number
  col: number
  /** Line text for --verbose context */
  lineText: string
  /**
   * A window of surrounding lines for guard detection. We widen the
   * window to catch the opening of a conditional that spans multiple
   * lines, e.g., a ternary that starts 4 lines earlier.
   */
  contextBefore: string
}

const STATIC_IMPORT_RE = /^\s*import\s+(?:(?:type\s+)?[^'"`]+\s+from\s+)?['"]([^'"]+)['"]/gm
// Match `import(...)` but NOT `typeof import(...)` (which is type-only and has no runtime).
const DYNAMIC_IMPORT_RE = /(?<!typeof\s)\bimport\s*\(\s*['"]([^'"]+)['"]/g
const GLOB_IMPORT_RE = /import\.meta\.glob\s*\(\s*['"]([^'"]+)['"]/g

function extractImports(content: string): ImportRef[] {
  const lines = content.split('\n')
  const refs: ImportRef[] = []

  const charToLineCol = (idx: number) => {
    let c = 0
    for (let i = 0; i < lines.length; i++) {
      const len = lines[i].length + 1
      if (c + len > idx) return { line: i + 1, col: idx - c + 1, lineText: lines[i] }
      c += len
    }
    return { line: lines.length, col: 0, lineText: lines[lines.length - 1] ?? '' }
  }

  const getContextBefore = (line: number) => {
    // Widened to 40 lines so guards that open a longer array of route
    // entries or nested blocks still reach later imports. Deeper guards
    // than 40 lines suggest the block should be extracted into a helper.
    const start = Math.max(0, line - 60)
    return lines.slice(start, line).join('\n')
  }

  for (const [re, kind] of [
    [STATIC_IMPORT_RE, 'static'] as const,
    [DYNAMIC_IMPORT_RE, 'dynamic'] as const,
    [GLOB_IMPORT_RE, 'glob'] as const,
  ]) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      const { line, col, lineText } = charToLineCol(m.index)
      refs.push({
        specifier: m[1],
        kind,
        line,
        col,
        lineText,
        contextBefore: getContextBefore(line),
      })
    }
  }
  return refs
}

/**
 * Is this dynamic import lexically guarded against Free-build evaluation?
 *
 * Accepted guard patterns within the preceding context window:
 *
 *   1. `VITE_FREE_BUILD === 'true' ?` — any ternary with the Free-build
 *      flag as its predicate. Free branch (stub) must come first; the
 *      import lives in the false branch that rolldown tree-shakes.
 *
 *   2. `try {` — the import is inside a try/catch block that catches
 *      the missing-module error at runtime. Applies to backend files
 *      that aren't Vite-bundled and so can't use the ternary pattern.
 *
 *   3. `import.meta.glob(` — declared elsewhere (already handled by
 *      the 'glob' ref kind), never reaches this check.
 */
function isGuarded(ref: ImportRef): boolean {
  const freeBuildGuard = /VITE_FREE_BUILD\s*===?\s*['"]true['"]\s*\?/
  const tryGuard = /\btry\s*\{/
  return freeBuildGuard.test(ref.contextBefore) || tryGuard.test(ref.contextBefore)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface Violation {
  file: string
  ref: ImportRef
  target: string
}

function main(): void {
  const excludes = [...BASE_CODE_EXCLUDES, ...readSyncExcludes()]
  const files: string[] = []
  for (const dir of SCAN_DIRS) walk(resolve(CODE_ROOT, dir), files)

  const violations: Violation[] = []
  let scanned = 0
  let importRefs = 0
  let skipExcludedImporter = 0

  for (const absFile of files) {
    scanned++
    const rel = relative(CODE_ROOT, absFile)
    // Rule 1: skip files that are themselves sync-excluded
    if (isExcluded(rel, excludes)) {
      skipExcludedImporter++
      continue
    }
    const content = readFileSync(absFile, 'utf-8')
    const refs = extractImports(content)
    importRefs += refs.length

    for (const ref of refs) {
      const target = resolveImportPath(ref.specifier, rel)
      if (!target) continue
      if (ref.kind === 'glob') continue // globs fail gracefully on missing files
      if (!isExcluded(target, excludes)) continue

      // Static imports are always violations
      if (ref.kind === 'static') {
        violations.push({ file: rel, ref, target })
        continue
      }

      // Dynamic imports: violation unless guarded
      if (ref.kind === 'dynamic' && !isGuarded(ref)) {
        violations.push({ file: rel, ref, target })
      }
    }
  }

  console.log(`${BOLD}Excluded-Imports Audit${RESET}`)
  console.log(`${DIM}Scanned ${scanned} files, ${importRefs} imports, skipped ${skipExcludedImporter} excluded importers${RESET}`)
  console.log()

  if (violations.length === 0) {
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — no unguarded imports of sync-excluded paths.`)
    return
  }

  console.log(`${RED}${BOLD}RESULT: FAIL${RESET} — ${violations.length} unguarded import(s) of sync-excluded paths.`)
  console.log()
  for (const v of violations) {
    console.log(`${YELLOW}${v.file}${RESET}:${v.ref.line}:${v.ref.col}`)
    console.log(`  ${RED}\u2717${RESET} ${v.ref.kind} import of ${BOLD}${v.ref.specifier}${RESET} \u2192 ${DIM}${v.target}${RESET}`)
    if (verbose) console.log(`     ${DIM}${v.ref.lineText.trim()}${RESET}`)
  }
  console.log()
  console.log(`Fix: either (a) wrap dynamic imports in a \`VITE_FREE_BUILD === 'true' ? [] : [...]\` ternary,`)
  console.log(`(b) use \`import.meta.glob\` for filesystem-driven collections, or (c) restructure so the`)
  console.log(`reference goes through a helper that is itself sync-excluded.`)
  process.exit(1)
}

main()

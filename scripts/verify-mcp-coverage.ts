// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * MCP Coverage Auditor
 *
 * Enforces parity between the MCP server's coverage manifest and the on-disk
 * institutional-knowledge surface. Three checks:
 *
 *   1. Coverage — every file matching KNOWLEDGE_SCAN_GLOBS is listed in
 *      KNOWLEDGE_SOURCES or INTENTIONALLY_UNCOVERED. A new rule file or
 *      dev-doc landing without manifest acknowledgment fails the push.
 *
 *   2. Manifest freshness — every path in KNOWLEDGE_SOURCES exists on disk.
 *      Catches stale entries left behind after a rename or delete.
 *
 *   3. Reader pattern — every MCP tool file at mcp-server/src/tools/*.ts
 *      uses a file-reading primitive (safeReadFile, readFileSync, readFile,
 *      or import.meta.glob). A tool that bakes content into code violates
 *      single-source-of-truth; source docs become authoritative only if
 *      tools read them at runtime.
 *
 * On failure: update the manifest, add a tool via `/umcp`, or explicitly
 * catalog the file under INTENTIONALLY_UNCOVERED with a reason.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'
import {
  KNOWLEDGE_SOURCES,
  INTENTIONALLY_UNCOVERED,
  KNOWLEDGE_SCAN_GLOBS,
  SOURCE_TO_TOOL,
} from '../mcp-server/src/coverage-manifest.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const PROJECT_ROOT = resolve(CODE_ROOT, '..')
const MCP_TOOLS_DIR = resolve(CODE_ROOT, 'mcp-server', 'src', 'tools')

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
  console.log(`  ${YELLOW}\u26A0${RESET} ${name}`)
  console.log(`    ${DIM}${detail}${RESET}`)
}

// ---------------------------------------------------------------------------
// Glob expansion (zero-dep — our globs are simple: literal paths with one *)
// ---------------------------------------------------------------------------

function expandGlob(pattern: string): string[] {
  // Supports: literal paths, `dir/*.ext`, `dir/*`. Not recursive.
  if (!pattern.includes('*')) {
    const abs = resolve(PROJECT_ROOT, pattern)
    return existsSync(abs) && statSync(abs).isFile() ? [pattern] : []
  }
  const starIdx = pattern.lastIndexOf('/')
  const dirPart = pattern.slice(0, starIdx)
  const filePart = pattern.slice(starIdx + 1)
  const absDir = resolve(PROJECT_ROOT, dirPart)
  if (!existsSync(absDir) || !statSync(absDir).isDirectory()) return []
  // Glob → regex: escape EVERY regex metacharacter, then re-expand `*` to `.*`.
  // The prior two-step escape (just `.`) left backslashes and other metachars
  // (+, ?, |, (, ), [, ], {, }, ^, $) unescaped — CodeQL's incomplete-sanitization
  // rule correctly flagged this. A manifest entry containing those metachars
  // would have produced a malformed regex or an accidentally-permissive match.
  const escaped = filePart
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // escape every regex metachar
    .replace(/\*/g, '.*')                    // then expand glob `*` to regex `.*`
  const re = new RegExp('^' + escaped + '$')
  return readdirSync(absDir)
    .filter((f) => re.test(f))
    .map((f) => join(dirPart, f))
    .filter((rel) => {
      const abs = resolve(PROJECT_ROOT, rel)
      return statSync(abs).isFile()
    })
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkCoverage(): void {
  const discovered = new Set<string>()
  for (const pattern of KNOWLEDGE_SCAN_GLOBS) {
    for (const p of expandGlob(pattern)) discovered.add(p)
  }

  const acknowledged = new Set<string>([
    ...KNOWLEDGE_SOURCES,
    ...Object.keys(INTENTIONALLY_UNCOVERED),
  ])

  const uncovered: string[] = []
  for (const path of discovered) {
    if (!acknowledged.has(path)) uncovered.push(path)
  }

  if (uncovered.length === 0) {
    pass(
      'Coverage',
      `all ${discovered.size} knowledge source(s) acknowledged in manifest`
    )
    return
  }
  fail(
    'Coverage',
    `${uncovered.length} knowledge source(s) present on disk but missing from manifest — add to KNOWLEDGE_SOURCES (if MCP should cover) or INTENTIONALLY_UNCOVERED (with a reason):\n     ${uncovered.join('\n     ')}\n\n     Consider invoking /umcp to propose new MCP tool coverage for these files.`
  )
}

function checkManifestFreshness(): void {
  const stale: string[] = []
  for (const path of KNOWLEDGE_SOURCES) {
    const abs = resolve(PROJECT_ROOT, path)
    if (!existsSync(abs)) stale.push(path)
  }
  for (const path of Object.keys(INTENTIONALLY_UNCOVERED)) {
    const abs = resolve(PROJECT_ROOT, path)
    if (!existsSync(abs)) stale.push(path + ' (in INTENTIONALLY_UNCOVERED)')
  }
  if (stale.length === 0) {
    pass(
      'Manifest freshness',
      `all ${KNOWLEDGE_SOURCES.length + Object.keys(INTENTIONALLY_UNCOVERED).length} manifest entry(s) resolve to real files`
    )
    return
  }
  fail(
    'Manifest freshness',
    `${stale.length} manifest entry(s) point at files that no longer exist — remove or update:\n     ${stale.join('\n     ')}`
  )
}

function checkReaderPattern(): void {
  if (!existsSync(MCP_TOOLS_DIR)) {
    warn('Reader pattern', 'mcp-server/src/tools/ not found — skipping')
    return
  }
  const toolFiles = readdirSync(MCP_TOOLS_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(MCP_TOOLS_DIR, f))

  // A tool that reads source docs at runtime uses at least one of:
  //   - safeReadFile (project helper)
  //   - readFileSync / readFile (node:fs)
  //   - import.meta.glob (Vite build-time, used in some adapters)
  //   - execSync/spawnSync (for tools that shell out — e.g. git log queries)
  const READER_PATTERNS = [
    /safeReadFile\b/,
    /\breadFileSync\b/,
    /\breadFile\b/,
    /import\.meta\.glob/,
    /\bexecSync\b/,
    /\bexecFileSync\b/,
    /\bspawnSync\b/,
  ]

  const bakers: string[] = []
  for (const file of toolFiles) {
    const content = readFileSync(file, 'utf-8')
    const hasReader = READER_PATTERNS.some((re) => re.test(content))
    if (!hasReader) {
      bakers.push(relative(PROJECT_ROOT, file))
    }
  }

  if (bakers.length === 0) {
    pass(
      'Reader pattern',
      `all ${toolFiles.length} tool(s) read source docs at runtime`
    )
    return
  }
  fail(
    'Reader pattern',
    `${bakers.length} tool(s) do not read source docs at runtime — content may be baked into code, violating single-source-of-truth:\n     ${bakers.join('\n     ')}\n\n     Refactor to import safeReadFile from ../utils/file-reader.js and read the canonical markdown source.`
  )
}

/**
 * Check 4: Source-to-tool mapping.
 *
 * For each source explicitly mapped in SOURCE_TO_TOOL, verify:
 *   a. The mapped tool file exists in mcp-server/src/tools/
 *   b. The tool source contains the expected path hint — confirming it
 *      actually reaches the source at runtime, not just reads something else.
 *
 * Sources in KNOWLEDGE_SOURCES without a SOURCE_TO_TOOL entry emit a WARNING
 * (not a failure) — they're acknowledged but not yet precisely mapped.
 * Sources WITH a mapping that fails either check cause a FAILURE.
 */
function checkSourceToToolMapping(): void {
  if (!existsSync(MCP_TOOLS_DIR)) {
    warn('Source→tool mapping', 'mcp-server/src/tools/ not found — skipping')
    return
  }

  const failures_local: string[] = []
  const warnings_local: string[] = []

  // Check that all KNOWLEDGE_SOURCES have a SOURCE_TO_TOOL entry
  for (const source of KNOWLEDGE_SOURCES) {
    if (!SOURCE_TO_TOOL[source]) {
      warnings_local.push(`No SOURCE_TO_TOOL entry for "${source}" — add to coverage-manifest.ts to enforce runtime reading`)
    }
  }

  // For each mapped source, verify the tool exists and contains the hint
  for (const [source, { tool, hint }] of Object.entries(SOURCE_TO_TOOL)) {
    const toolPath = join(MCP_TOOLS_DIR, tool)
    if (!existsSync(toolPath)) {
      failures_local.push(`"${source}" maps to tool "${tool}" which does not exist at ${relative(PROJECT_ROOT, toolPath)}`)
      continue
    }
    const toolSource = readFileSync(toolPath, 'utf-8')
    if (!toolSource.includes(hint)) {
      failures_local.push(
        `"${source}" maps to "${tool}" but the tool source does not contain the expected path hint "${hint}" — the tool may not actually read this source`
      )
    }
  }

  if (failures_local.length > 0) {
    fail(
      'Source→tool mapping',
      `${failures_local.length} source(s) mapped to tools that don't read them:\n     ${failures_local.join('\n     ')}`
    )
  } else if (warnings_local.length > 0) {
    pass(
      'Source→tool mapping',
      `all ${Object.keys(SOURCE_TO_TOOL).length} explicitly mapped source(s) verified`
    )
    for (const w of warnings_local) warn('Source→tool gap', w)
  } else {
    pass(
      'Source→tool mapping',
      `all ${Object.keys(SOURCE_TO_TOOL).length} explicitly mapped source(s) verified, all ${KNOWLEDGE_SOURCES.length} sources mapped`
    )
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log(`${BOLD}MCP Coverage Audit${RESET}`)
  console.log(
    `${DIM}Enforces parity between coverage manifest, on-disk knowledge sources, and MCP tool implementations${RESET}`
  )
  console.log()

  checkCoverage()
  checkManifestFreshness()
  checkReaderPattern()
  checkSourceToToolMapping()

  console.log()
  if (failures > 0) {
    console.log(
      `${RED}${BOLD}RESULT: FAIL${RESET} — ${failures} check(s) failed, ${warnings} warning(s)`
    )
    process.exit(1)
  }
  if (warnings > 0) {
    console.log(
      `${YELLOW}${BOLD}RESULT: PASS${RESET} with ${warnings} warning(s).`
    )
  } else {
    console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} — MCP coverage clean.`)
  }
}

main()

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
  const re = new RegExp(
    '^' + filePart.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
  )
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

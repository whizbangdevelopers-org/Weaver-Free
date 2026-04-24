// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Bundle Size Budget Enforcement
 *
 * Reads the built PWA output at dist/pwa/assets/ and checks each JS/CSS
 * chunk against size budgets. Exits with code 1 if any budget is exceeded.
 *
 * Budgets:
 *   - Individual JS chunk: 500 KB
 *   - Total JS: 2000 KB
 *   - Total CSS: 600 KB  (mdi-v7 webfont ~408 KB + Quasar components ~90 KB + app CSS ~50 KB)
 *
 * Usage:
 *   npx tsx scripts/check-bundle-size.ts
 */

import { readdirSync, statSync } from 'fs'
import { resolve, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const ASSETS_DIR = resolve(ROOT, 'dist/pwa/assets')

// ---------------------------------------------------------------------------
// ANSI Colors
// ---------------------------------------------------------------------------

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

// ---------------------------------------------------------------------------
// Budgets (in KB)
// ---------------------------------------------------------------------------

const BUDGET_CHUNK_KB = 500
// Budget breakdown: core app ~1750 KB + live docs ~240 KB + v1.0 snapshot ~240 KB = ~2230 KB.
// Versioned doc snapshots (docs/v*/**) are demo-only lazy chunks; each release cycle adds ~240 KB.
// Budget covers through v1.1 snapshot. Revisit at v1.2 when total will approach 2480 KB.
const BUDGET_TOTAL_JS_KB = 2500
// mdi-v7 webfont CSS alone is ~408 KB; 600 KB gives headroom for Quasar components + app CSS
const BUDGET_TOTAL_CSS_KB = 600

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FileEntry {
  name: string
  sizeKB: number
  type: 'js' | 'css' | 'other'
  overBudget: boolean
}

function formatSize(kb: number): string {
  if (kb >= 1000) return `${(kb / 1000).toFixed(2)} MB`
  return `${kb.toFixed(1)} KB`
}

function statusIcon(pass: boolean): string {
  return pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log(`\n${BOLD}Bundle Size Budget Check${RESET}\n`)

  // Verify assets directory exists — skip gracefully if no build output
  let files: string[]
  try {
    files = readdirSync(ASSETS_DIR)
  } catch {
    console.log(`${DIM}SKIP: dist/pwa/assets/ not found (no build output). Run "npm run build" first.${RESET}\n`)
    process.exit(0)
  }

  // Collect file entries
  const entries: FileEntry[] = []
  for (const file of files) {
    const filePath = resolve(ASSETS_DIR, file)
    const stat = statSync(filePath)
    if (!stat.isFile()) continue

    const ext = extname(file).toLowerCase()
    const sizeKB = stat.size / 1024
    let type: FileEntry['type'] = 'other'

    if (ext === '.js' || ext === '.mjs') type = 'js'
    else if (ext === '.css') type = 'css'

    const overBudget = type === 'js' && sizeKB > BUDGET_CHUNK_KB
    entries.push({ name: file, sizeKB, type, overBudget })
  }

  // Sort by size descending
  entries.sort((a, b) => b.sizeKB - a.sizeKB)

  const jsEntries = entries.filter((e) => e.type === 'js')
  const cssEntries = entries.filter((e) => e.type === 'css')
  const totalJS = jsEntries.reduce((sum, e) => sum + e.sizeKB, 0)
  const totalCSS = cssEntries.reduce((sum, e) => sum + e.sizeKB, 0)

  // Print JS chunks table
  console.log(`${BOLD}JS Chunks${RESET} ${DIM}(budget: ${BUDGET_CHUNK_KB} KB per chunk, ${BUDGET_TOTAL_JS_KB} KB total)${RESET}`)
  console.log(`${'─'.repeat(70)}`)

  for (const entry of jsEntries) {
    const status = entry.overBudget ? `${RED}OVER${RESET}` : `${GREEN}OK${RESET}`
    const sizeStr = formatSize(entry.sizeKB).padStart(10)
    console.log(`  ${status}  ${sizeStr}  ${entry.name}`)
  }

  console.log(`${'─'.repeat(70)}`)
  const jsTotalStatus = totalJS > BUDGET_TOTAL_JS_KB
  console.log(`  ${statusIcon(!jsTotalStatus)}  ${formatSize(totalJS).padStart(10)}  ${BOLD}Total JS${RESET}`)
  console.log()

  // Print CSS table
  console.log(`${BOLD}CSS Files${RESET} ${DIM}(budget: ${BUDGET_TOTAL_CSS_KB} KB total)${RESET}`)
  console.log(`${'─'.repeat(70)}`)

  for (const entry of cssEntries) {
    const sizeStr = formatSize(entry.sizeKB).padStart(10)
    console.log(`        ${sizeStr}  ${entry.name}`)
  }

  console.log(`${'─'.repeat(70)}`)
  const cssTotalStatus = totalCSS > BUDGET_TOTAL_CSS_KB
  console.log(`  ${statusIcon(!cssTotalStatus)}  ${formatSize(totalCSS).padStart(10)}  ${BOLD}Total CSS${RESET}`)
  console.log()

  // Summary
  const chunkFailures = jsEntries.filter((e) => e.overBudget)
  const hasFailure = chunkFailures.length > 0 || jsTotalStatus || cssTotalStatus

  if (hasFailure) {
    console.log(`${RED}${BOLD}Budget exceeded:${RESET}`)
    if (chunkFailures.length > 0) {
      console.log(`  ${RED}${chunkFailures.length} JS chunk(s) over ${BUDGET_CHUNK_KB} KB:${RESET}`)
      for (const f of chunkFailures) {
        console.log(`    - ${f.name} (${formatSize(f.sizeKB)})`)
      }
    }
    if (jsTotalStatus) {
      console.log(`  ${RED}Total JS ${formatSize(totalJS)} exceeds ${formatSize(BUDGET_TOTAL_JS_KB)} budget${RESET}`)
    }
    if (cssTotalStatus) {
      console.log(`  ${RED}Total CSS ${formatSize(totalCSS)} exceeds ${formatSize(BUDGET_TOTAL_CSS_KB)} budget${RESET}`)
    }
    console.log()
    process.exit(1)
  }

  console.log(`${GREEN}${BOLD}All bundle size budgets passed.${RESET}\n`)
}

main()

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * verify-ws-codes.ts — WebSocket close code documentation parity checker.
 *
 * Scans backend source for .close(4xxx, ...) calls and verifies each code
 * is documented in DEVELOPER-GUIDE.md's WebSocket close codes table.
 * Also detects stale docs (codes in the table but not in code).
 *
 * Usage:  npx tsx scripts/verify-ws-codes.ts
 * Exit:   0 = all codes documented, 1 = parity issues found
 */

import { readFileSync, readdirSync } from 'fs'
import { resolve, join } from 'path'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const ROOT = resolve(import.meta.dirname, '..')
const BACKEND_SRC = resolve(ROOT, 'backend/src')
const DEV_GUIDE = resolve(ROOT, 'docs/DEVELOPER-GUIDE.md')

// ---------------------------------------------------------------------------
// 1. Scan backend source for .close(4xxx, '...') patterns
// ---------------------------------------------------------------------------

interface CodeUsage {
  code: number
  message: string
  file: string
  line: number
}

function scanDir(dir: string): CodeUsage[] {
  const results: CodeUsage[] = []
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...scanDir(fullPath))
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      const content = readFileSync(fullPath, 'utf-8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        // Match: .close(4xxx, 'message') or .close(4xxx, "message")
        const match = lines[i]!.match(/\.close\(\s*(4\d{3})\s*,\s*['"]([^'"]+)['"]/)
        if (match) {
          results.push({
            code: parseInt(match[1]!, 10),
            message: match[2]!,
            file: fullPath.replace(ROOT + '/', ''),
            line: i + 1,
          })
        }
      }
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// 2. Parse DEVELOPER-GUIDE.md close codes table
// ---------------------------------------------------------------------------

interface DocEntry {
  code: number
  meaning: string
}

function parseDocsTable(): DocEntry[] {
  const content = readFileSync(DEV_GUIDE, 'utf-8')
  const entries: DocEntry[] = []

  // Find the table that starts with | Code | Meaning |
  const lines = content.split('\n')
  let inTable = false

  for (const line of lines) {
    if (line.includes('| Code |') && line.includes('| Meaning |')) {
      inTable = true
      continue
    }
    if (inTable && line.match(/^\|[\s-|]+$/)) {
      // Separator row
      continue
    }
    if (inTable && line.startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean)
      if (cells.length >= 2) {
        const code = parseInt(cells[0]!, 10)
        if (code >= 4000 && code <= 4999) {
          entries.push({ code, meaning: cells[1]! })
        }
      }
    } else if (inTable) {
      // End of table
      break
    }
  }

  return entries
}

// ---------------------------------------------------------------------------
// 3. Compare and report
// ---------------------------------------------------------------------------

const codeUsages = scanDir(BACKEND_SRC)
const docEntries = parseDocsTable()

const codesInCode = new Map<number, CodeUsage[]>()
for (const usage of codeUsages) {
  if (!codesInCode.has(usage.code)) codesInCode.set(usage.code, [])
  codesInCode.get(usage.code)!.push(usage)
}

const codesInDocs = new Set(docEntries.map(e => e.code))

let issues = 0

console.log(`${BOLD}WebSocket Close Code Parity${RESET}\n`)

// Codes in code but not docs
for (const [code, usages] of [...codesInCode.entries()].sort((a, b) => a[0] - b[0])) {
  if (codesInDocs.has(code)) {
    console.log(`${GREEN}PASS${RESET} ${code} — documented`)
    for (const u of usages) {
      console.log(`  ${DIM}${u.file}:${u.line} → "${u.message}"${RESET}`)
    }
  } else {
    issues++
    console.log(`${RED}FAIL${RESET} ${code} — used in code but NOT documented in DEVELOPER-GUIDE.md`)
    for (const u of usages) {
      console.log(`  ${DIM}${u.file}:${u.line} → "${u.message}"${RESET}`)
    }
  }
}

// Codes in docs but not code (stale)
for (const entry of docEntries) {
  if (!codesInCode.has(entry.code)) {
    issues++
    console.log(`${YELLOW}STALE${RESET} ${entry.code} — documented but not found in backend code: "${entry.meaning}"`)
  }
}

console.log(`\n${BOLD}Results:${RESET} ${codesInCode.size} codes in code, ${docEntries.length} codes in docs, ${issues} issue(s)`)

if (issues > 0) {
  console.log(`\n${DIM}Add missing codes to the WebSocket close codes table in docs/DEVELOPER-GUIDE.md.`)
  console.log(`Remove stale entries for codes no longer used in backend source.${RESET}`)
  process.exit(1)
}

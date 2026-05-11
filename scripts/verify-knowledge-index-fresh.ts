// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Knowledge Index Freshness Auditor
 *
 * Regenerates INDEX.md in memory and diffs it against the committed file.
 * Fails if there is any difference — meaning INDEX.md is stale and needs
 * to be regenerated via `npm run generate:knowledge-index`.
 *
 * The pre-commit hook runs the generator and restages INDEX.md automatically
 * whenever a knowledge category file is staged. This auditor is the
 * push-time backstop that catches hand-edits or skipped commits.
 *
 * Invocation:
 *   npx tsx scripts/verify-knowledge-index-fresh.ts
 *   or: npm run audit:knowledge-index-fresh
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { collectEntries, generateIndex } from './generate-knowledge-index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const INDEX_PATH = resolve(CODE_ROOT, 'docs/knowledge/INDEX.md')

const fresh = generateIndex(collectEntries())

if (!existsSync(INDEX_PATH)) {
  console.error('audit:knowledge-index-fresh FAIL — INDEX.md does not exist; run: npm run generate:knowledge-index')
  process.exit(1)
}

const committed = readFileSync(INDEX_PATH, 'utf8')

if (fresh === committed) {
  console.log('audit:knowledge-index-fresh PASS — INDEX.md is up-to-date')
  process.exit(0)
}

// Show a compact diff summary: first 10 lines that differ
const freshLines = fresh.split('\n')
const committedLines = committed.split('\n')
const maxLines = Math.max(freshLines.length, committedLines.length)

console.error('audit:knowledge-index-fresh FAIL — INDEX.md is stale; run: npm run generate:knowledge-index')
console.error('')

let shown = 0
for (let i = 0; i < maxLines && shown < 10; i++) {
  const f = freshLines[i] ?? '(missing)'
  const c = committedLines[i] ?? '(missing)'
  if (f !== c) {
    console.error(`  line ${i + 1}`)
    console.error(`  - committed: ${c}`)
    console.error(`  + expected:  ${f}`)
    shown++
  }
}

if (shown === 10) {
  console.error('  … (more differences; run generate:knowledge-index to see full output)')
}

process.exit(1)

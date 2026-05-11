// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Knowledge ID Uniqueness Auditor
 *
 * Scans all code/docs/knowledge/{lessons,gotchas}/*.md files and checks
 * that every <!-- entry:ID --> marker ID is unique across the entire
 * knowledge corpus.
 *
 * Duplicate IDs would cause Engram to collapse two distinct entities into
 * one, losing one entry silently. The llgd skill generates IDs by reading
 * the last NNN in the target file; a duplicate can only arise from a
 * hand-edit or a copy-paste error — this auditor catches it at push time.
 *
 * Passes trivially when no entries exist.
 *
 * Invocation:
 *   npx tsx scripts/verify-knowledge-ids-unique.ts
 *   or: npm run audit:knowledge-ids-unique
 */

import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const KNOWLEDGE_ROOT = resolve(CODE_ROOT, 'docs/knowledge')

// Regex defined locally per file — not module-level to avoid `g` flag state bleed

function collectCategoryFiles(): string[] {
  const files: string[] = []
  for (const type of ['lessons', 'gotchas']) {
    const dir = resolve(KNOWLEDGE_ROOT, type)
    let names: string[]
    try {
      names = readdirSync(dir).filter((f) => f.endsWith('.md'))
    } catch {
      continue
    }
    for (const name of names.sort()) {
      files.push(resolve(dir, name))
    }
  }
  return files
}

interface IdOccurrence {
  id: string
  file: string
}

const seen = new Map<string, IdOccurrence>()
const duplicates: Array<{ id: string; first: IdOccurrence; duplicate: IdOccurrence }> = []
let totalIds = 0

for (const filePath of collectCategoryFiles()) {
  const content = readFileSync(filePath, 'utf8')
  const relPath = filePath.replace(resolve(CODE_ROOT, '..', '..') + '/', '')

  const entryMarkerRe = /<!--\s*entry:([\w-]+)\s*-->/g
  let match: RegExpExecArray | null

  while ((match = entryMarkerRe.exec(content)) !== null) {
    const id = match[1]!
    totalIds++
    const occurrence: IdOccurrence = { id, file: relPath }

    if (seen.has(id)) {
      duplicates.push({ id, first: seen.get(id)!, duplicate: occurrence })
    } else {
      seen.set(id, occurrence)
    }
  }
}

if (duplicates.length === 0) {
  console.log(`audit:knowledge-ids-unique PASS — ${totalIds} IDs across ${seen.size} unique entries, 0 duplicates`)
  process.exit(0)
}

console.error(`audit:knowledge-ids-unique FAIL — ${duplicates.length} duplicate ID(s):`)
for (const d of duplicates) {
  console.error(`  ${d.id}`)
  console.error(`    first:     ${d.first.file}`)
  console.error(`    duplicate: ${d.duplicate.file}`)
}
process.exit(1)

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Knowledge Index Generator
 *
 * Reads every entry block from code/docs/knowledge/{lessons,gotchas}/*.md,
 * parses the YAML frontmatter, and writes a sorted summary table to
 * code/docs/knowledge/INDEX.md.
 *
 * Output is deterministic (sorted by ID). Never writes timestamps or
 * run-specific identifiers — audit:knowledge-index-fresh diffs the
 * regenerated output against the committed file and fails on any diff.
 *
 * Invocation:
 *   npx tsx scripts/generate-knowledge-index.ts
 *   or: npm run generate:knowledge-index
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const KNOWLEDGE_ROOT = resolve(CODE_ROOT, 'docs/knowledge')
const INDEX_PATH = resolve(KNOWLEDGE_ROOT, 'INDEX.md')

// ── Regex ─────────────────────────────────────────────────────────────────────
// Not module-level constants: global regexes with the `g` flag carry lastIndex
// state across calls when shared as module-level singletons. Create fresh
// instances per call site to avoid state bleed between imports and direct runs.

// ── Types ────────────────────────────────────────────────────────────────────

interface KnowledgeEntry {
  id: string
  type: 'lesson' | 'gotcha'
  domain: string
  tags: string[]
  since_version: string
  status: 'active' | 'superseded' | 'retired'
  related: string[]
  graduated_to: string
  title: string
  sourceFile: string
}

// ── Entry block parser ────────────────────────────────────────────────────────

// blockContent starts with \n--- (newline before opening ---), so no ^ anchor
const FRONTMATTER_RE = /---\n([\s\S]+?)\n---/

function parseYamlLine(line: string): [string, string] | null {
  const idx = line.indexOf(':')
  if (idx === -1) return null
  const key = line.slice(0, idx).trim()
  const raw = line.slice(idx + 1).trim()
  // Strip surrounding YAML string quotes: "" → '', "value" → value
  const unquoted = /^["'].*["']$/.test(raw) ? raw.slice(1, -1) : raw
  return [key, unquoted]
}

function parseYamlArray(raw: string): string[] {
  // Handles: [] or [a, b, c] or ["a", "b"]
  const inner = raw.replace(/^\[/, '').replace(/\]$/, '').trim()
  if (!inner) return []
  return inner
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

function extractTitle(body: string): string {
  // First markdown heading after the frontmatter block
  const match = body.match(/^##\s+(.+)$/m)
  if (!match) return '(no title)'
  // Strip the " — YYYY-MM-DD · Author" suffix if present
  return match[1]!.replace(/\s*—\s*.+$/, '').trim()
}

function parseEntryBlock(id: string, blockContent: string, sourceFile: string): KnowledgeEntry | null {
  const fmMatch = blockContent.match(FRONTMATTER_RE)
  if (!fmMatch) return null

  const fm: Record<string, string> = {}
  for (const line of fmMatch[1]!.split('\n')) {
    const parsed = parseYamlLine(line)
    if (parsed) {
      const [k, v] = parsed
      fm[k] = v
    }
  }

  const bodyAfterFm = blockContent.slice((fmMatch.index ?? 0) + fmMatch[0].length)
  const title = extractTitle(bodyAfterFm)

  return {
    id: fm['id'] ?? id,
    type: (fm['type'] as KnowledgeEntry['type']) ?? 'lesson',
    domain: fm['domain'] ?? 'unknown',
    tags: parseYamlArray(fm['tags'] ?? '[]'),
    since_version: fm['since_version'] ?? '',
    status: (fm['status'] as KnowledgeEntry['status']) ?? 'active',
    related: parseYamlArray(fm['related'] ?? '[]'),
    graduated_to: fm['graduated_to'] ?? '',
    title,
    sourceFile,
  }
}

// ── File discovery ────────────────────────────────────────────────────────────

function collectCategoryFiles(): string[] {
  const files: string[] = []
  // Categories are DERIVED from the store's own subdirectories, never hardcoded. The category
  // set has a single source (the knowledge vocab) that this TypeScript cannot import, so the
  // next best thing is to read what the projection actually wrote — a list that cannot drift
  // away from it.
  //
  // Hardcoding ['lessons', 'gotchas'] silently dropped every `heuristic` on the day heuristics
  // began projecting into templates (2026-08-08): 346 entries present in the store and absent
  // from INDEX.md, which is the file a reader consults to find out what exists. Unindexed
  // knowledge is knowledge that did not arrive.
  let categories: string[]
  try {
    categories = readdirSync(KNOWLEDGE_ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  } catch {
    return files
  }
  for (const type of categories) {
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

// ── Main ─────────────────────────────────────────────────────────────────────

export function collectEntries(): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = []
  for (const filePath of collectCategoryFiles()) {
    const content = readFileSync(filePath, 'utf8')
    // Create regex fresh per file — global regexes with the `g` flag carry
    // lastIndex state and behave incorrectly when reused across calls.
    const entryBlockRe = /<!--\s*entry:([\w-]+)\s*-->([\s\S]*?)<!--\s*\/entry\s*-->/g
    let match: RegExpExecArray | null
    while ((match = entryBlockRe.exec(content)) !== null) {
      const id = match[1]!
      const blockContent = match[2]!
      const entry = parseEntryBlock(id, blockContent, filePath)
      if (entry) entries.push(entry)
    }
  }
  // Sort by ID for deterministic output
  return entries.sort((a, b) => a.id.localeCompare(b.id))
}

export function generateIndex(entries: KnowledgeEntry[]): string {
  const fileCount = collectCategoryFiles().length
  const header = [
    // Emitted by the generator, not stamped afterwards: a hand-added header on a generated
    // file is removed by the next regeneration, and the drift then surfaces as a freshness
    // failure rather than as "the header is missing". scripts/add-copyright-headers.sh
    // deliberately steps aside for this file. (code/ → AGPL/BSL flavour, per the copyright rule.)
    '<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->',
    '<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->',
    '<!-- GENERATED by scripts/generate-knowledge-index.ts — do not edit by hand. Source: code/docs/knowledge/**/*.md -->',
    '# Knowledge Index',
    '',
    `_${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} across ${fileCount} category files._`,
    '',
  ]

  if (entries.length === 0) {
    header.push('_No entries yet. Use the `llgd` skill to add structured lessons and gotchas._')
    header.push('')
    return header.join('\n')
  }

  const tableHeader = [
    '| ID | Type | Domain | Tags | Status | Title |',
    '|---|---|---|---|---|---|',
  ]

  const rows = entries.map((e) => {
    const tags = e.tags.length ? e.tags.join(', ') : '—'
    const graduatedNote = e.graduated_to ? ` → \`${e.graduated_to}\`` : ''
    return `| \`${e.id}\` | ${e.type} | ${e.domain} | ${tags} | ${e.status}${graduatedNote} | ${e.title} |`
  })

  return [...header, ...tableHeader, ...rows, ''].join('\n')
}

// Run when executed directly (not when imported as a library)
if (import.meta.url === `file://${process.argv[1]}`) {
  const entries = collectEntries()
  const content = generateIndex(entries)
  writeFileSync(INDEX_PATH, content, 'utf8')
  console.log(`Knowledge index written: ${entries.length} entries across ${collectCategoryFiles().length} files → docs/knowledge/INDEX.md`)
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Engram Knowledge Ingestion
 *
 * Reads every structured entry from code/docs/knowledge/{lessons,gotchas}/*.md,
 * formats each as rich prose (metadata + full body), and POSTs to the Cognee
 * sidecar's /api/v1/cognify endpoint into the `knowledge_entries` dataset.
 *
 * Ingestion is full-replace: the dataset is reset before each run so entries
 * removed from the knowledge store are removed from Engram too.
 *
 * Cognee's LLM entity extractor builds a knowledge graph from the prose,
 * connecting entries via their ID references in `related:` and `graduated_to:`.
 *
 * Requires the Cognee sidecar to be running. Fails gracefully if unreachable.
 *
 * Flags:
 *   --dry-run     Print what would be ingested; do not POST to the sidecar.
 *   --no-reset    Skip dataset reset; add entries without wiping existing graph.
 *
 * Invocation:
 *   npx tsx scripts/ingest-knowledge-to-engram.ts
 *   npm run engram:ingest-knowledge
 *   npm run engram:ingest-knowledge -- --dry-run
 */

import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const KNOWLEDGE_ROOT = resolve(CODE_ROOT, 'docs/knowledge')
const COGNEE_URL = process.env.COGNEE_URL ?? 'http://localhost:8765'
const DATASET = 'knowledge_entries'
const DRY_RUN = process.argv.includes('--dry-run')
const NO_RESET = process.argv.includes('--no-reset')

// ── ANSI ─────────────────────────────────────────────────────────────────────
const GREEN = '\x1b[32m'
const RED   = '\x1b[31m'
const DIM   = '\x1b[2m'
const BOLD  = '\x1b[1m'
const RESET = '\x1b[0m'

// ── Types ────────────────────────────────────────────────────────────────────

interface RawEntry {
  id: string
  type: string
  domain: string
  tags: string[]
  since_version: string
  status: string
  related: string[]
  graduated_to: string
  title: string
  body: string         // full prose body after frontmatter (not stripped)
  sourceFile: string
}

// ── Parser ────────────────────────────────────────────────────────────────────

// Not module-level: global regexes with `g` carry lastIndex state across calls.

const FRONTMATTER_RE = /---\n([\s\S]+?)\n---/

function parseYamlLine(line: string): [string, string] | null {
  const idx = line.indexOf(':')
  if (idx === -1) return null
  const key = line.slice(0, idx).trim()
  const raw = line.slice(idx + 1).trim()
  const unquoted = /^["'].*["']$/.test(raw) ? raw.slice(1, -1) : raw
  return [key, unquoted]
}

function parseYamlArray(raw: string): string[] {
  const inner = raw.replace(/^\[/, '').replace(/\]$/, '').trim()
  if (!inner) return []
  return inner
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

function extractTitle(body: string): string {
  const match = body.match(/^##\s+(.+)$/m)
  if (!match) return '(no title)'
  return match[1]!.replace(/\s*—\s*.+$/, '').trim()
}

function parseEntry(id: string, blockContent: string, filePath: string): RawEntry | null {
  const fmMatch = blockContent.match(FRONTMATTER_RE)
  if (!fmMatch) return null

  const fm: Record<string, string> = {}
  for (const line of fmMatch[1]!.split('\n')) {
    const parsed = parseYamlLine(line)
    if (parsed) fm[parsed[0]] = parsed[1]
  }

  const body = blockContent.slice((fmMatch.index ?? 0) + fmMatch[0].length).trim()

  return {
    id: fm['id'] ?? id,
    type: fm['type'] ?? 'lesson',
    domain: fm['domain'] ?? 'unknown',
    tags: parseYamlArray(fm['tags'] ?? '[]'),
    since_version: fm['since_version'] ?? '',
    status: fm['status'] ?? 'active',
    related: parseYamlArray(fm['related'] ?? '[]'),
    graduated_to: fm['graduated_to'] ?? '',
    title: extractTitle(body),
    body,
    sourceFile: filePath,
  }
}

function collectEntries(): RawEntry[] {
  const entries: RawEntry[] = []
  for (const subdir of ['lessons', 'gotchas']) {
    const dir = resolve(KNOWLEDGE_ROOT, subdir)
    let names: string[]
    try {
      names = readdirSync(dir).filter((f) => f.endsWith('.md')).sort()
    } catch {
      continue
    }
    for (const name of names) {
      const filePath = resolve(dir, name)
      const content = readFileSync(filePath, 'utf8')
      // Create regex fresh per file — global `g` flag carries lastIndex state
      const entryBlockRe = /<!--\s*entry:([\w-]+)\s*-->([\s\S]*?)<!--\s*\/entry\s*-->/g
      let match: RegExpExecArray | null
      while ((match = entryBlockRe.exec(content)) !== null) {
        const entry = parseEntry(match[1]!, match[2]!, filePath)
        if (entry) entries.push(entry)
      }
    }
  }
  return entries.sort((a, b) => a.body.length - b.body.length)
}

// ── Prose formatter ───────────────────────────────────────────────────────────

function formatEntryForEngram(entry: RawEntry): string {
  const lines: string[] = []

  lines.push(`KNOWLEDGE ENTRY: ${entry.id}`)
  lines.push(`Type: ${entry.type} | Domain: ${entry.domain} | Status: ${entry.status}`)
  if (entry.tags.length > 0) lines.push(`Tags: ${entry.tags.join(', ')}`)
  if (entry.since_version) lines.push(`Since version: ${entry.since_version}`)
  lines.push('')
  lines.push(entry.body)

  if (entry.related.length > 0) {
    lines.push('')
    lines.push(`This entry is related to the following knowledge entries: ${entry.related.join(', ')}`)
  }
  if (entry.graduated_to) {
    lines.push('')
    lines.push(`This lesson has graduated to a universal rule recorded at: ${entry.graduated_to}`)
  }

  return lines.join('\n')
}

// ── Cognee API ────────────────────────────────────────────────────────────────

async function checkCognee(): Promise<boolean> {
  try {
    const res = await fetch(`${COGNEE_URL}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

async function resetDataset(): Promise<void> {
  const res = await fetch(`${COGNEE_URL}/api/v1/datasets`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset: DATASET }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)')
    throw new Error(`Dataset reset failed: ${res.status} ${text}`)
  }
}

async function ingestEntry(text: string): Promise<void> {
  const res = await fetch(`${COGNEE_URL}/api/v1/cognify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: text, datasets: [DATASET] }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)')
    throw new Error(`Cognify failed: ${res.status} ${body}`)
  }
}

async function improveDataset(_sessionId: string): Promise<void> {
  const res = await fetch(`${COGNEE_URL}/api/v1/improve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_name: DATASET }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)')
    throw new Error(`Improve failed: ${res.status} ${body}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`${BOLD}Engram Knowledge Ingestion${RESET}`)
  console.log(`${DIM}Dataset: ${DATASET}  ·  Sidecar: ${COGNEE_URL}${DRY_RUN ? '  ·  DRY RUN' : ''}${RESET}`)
  console.log()

  const entries = collectEntries()
  if (entries.length === 0) {
    console.log(`${DIM}No entries found in docs/knowledge/. Nothing to ingest.${RESET}`)
    process.exit(0)
  }

  console.log(`Collected ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} from docs/knowledge/`)

  if (DRY_RUN) {
    console.log()
    for (const entry of entries) {
      const text = formatEntryForEngram(entry)
      console.log(`${DIM}─── ${entry.id} (${entry.type}, ${entry.domain}) ───${RESET}`)
      console.log(text.slice(0, 300) + (text.length > 300 ? '…' : ''))
      console.log()
    }
    console.log(`${GREEN}Dry run complete. ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} previewed.${RESET}`)
    return
  }

  // Check sidecar
  const available = await checkCognee()
  if (!available) {
    console.error(`${RED}${BOLD}Cognee sidecar unreachable at ${COGNEE_URL}${RESET}`)
    console.error(`${DIM}Start it via: systemctl start weaver-cognee  or  uvx cognee-mcp --api-url${RESET}`)
    process.exit(1)
  }

  console.log(`${GREEN}✓${RESET} Cognee sidecar reachable`)

  // Reset dataset
  if (!NO_RESET) {
    process.stdout.write(`Resetting dataset "${DATASET}"… `)
    try {
      await resetDataset()
      console.log(`${GREEN}done${RESET}`)
    } catch (err) {
      // 404 means dataset doesn't exist yet — that's fine
      const msg = String(err)
      if (msg.includes('404')) {
        console.log(`${DIM}(dataset not yet created — first run)${RESET}`)
      } else {
        console.error(`\n${RED}${msg}${RESET}`)
        process.exit(1)
      }
    }
  }

  // Ingest
  let ingested = 0
  let failed = 0
  const sessionId = `knowledge-ingest-${Date.now()}`

  for (const entry of entries) {
    const text = formatEntryForEngram(entry)
    process.stdout.write(`  ingesting ${entry.id}… `)
    try {
      await ingestEntry(text)
      ingested++
      console.log(`${GREEN}✓${RESET}`)
    } catch (err) {
      failed++
      console.log(`${RED}✗ ${String(err)}${RESET}`)
    }
  }

  console.log()

  // Entity extraction (improve)
  if (ingested > 0) {
    process.stdout.write(`Promoting ${ingested} entr${ingested === 1 ? 'y' : 'ies'} to knowledge graph… `)
    try {
      await improveDataset(sessionId)
      console.log(`${GREEN}done${RESET}`)
    } catch (err) {
      console.log(`${RED}✗ ${String(err)}${RESET}`)
      failed++
    }
  }

  console.log()
  if (failed === 0) {
    console.log(`${GREEN}${BOLD}Ingestion complete.${RESET} ${ingested} entr${ingested === 1 ? 'y' : 'ies'} ingested into Engram dataset "${DATASET}".`)
  } else {
    console.log(`${RED}${BOLD}Ingestion finished with ${failed} failure(s).${RESET} ${ingested} succeeded.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(`${RED}${BOLD}Fatal:${RESET}`, err)
  process.exit(1)
})

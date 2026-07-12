// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Engram Knowledge Ingestion — incremental (embed-only / pgvector, no SQLite)
 *
 * Reads every structured entry from code/docs/knowledge/{lessons,gotchas}/*.md,
 * chunks + embeds each, and upserts it into the served pgvector store
 * (engram_chunks, project='weaver'). The served store's content_hash is the
 * incremental-diff source of truth (§10 step 3B) — only new or changed entries
 * are re-embedded; entries removed from source are deleted from the store.
 *
 * Run telemetry is written to the ingestion_runs table in the same Postgres
 * (WVR-198 §5.3 / convergence §10 Phase B — the SQLite engram.db is retired).
 * The retired embed+graph (Kuzu) and full-engram (Cognee sidecar) strategies were
 * removed with the Cognee decommission (WVR-195 §10 step 3C).
 *
 * Flags:
 *   --dry-run        Print what would be added/skipped/deleted; do not embed.
 *   --force-reset    Wipe this project's chunks and re-embed from scratch.
 *
 * Invocation:
 *   npx tsx scripts/ingest-knowledge-to-engram.ts
 *   npm run engram:ingest-knowledge
 *   npm run engram:ingest-knowledge -- --dry-run
 *   npm run engram:ingest-knowledge -- --force-reset
 */

import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'
import {
  getPgPool, closePgPool, ensureSchema, embedText, checkEmbedService,
  upsertChunk, deleteChunks, clearProjectChunks, getProjectHashes, logIngestionRunPg,
} from '../codebase-mcp/src/utils/pgvector-embed.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const KNOWLEDGE_ROOT = resolve(CODE_ROOT, 'docs/knowledge')
const DATASET = 'project_knowledge'
const DRY_RUN = process.argv.includes('--dry-run')
const FORCE_RESET = process.argv.includes('--force-reset')

// ── ANSI ─────────────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM    = '\x1b[2m'
const BOLD   = '\x1b[1m'
const RESET  = '\x1b[0m'

// ── Types ────────────────────────────────────────────────────────────────────

interface RawEntry {
  id: string
  type: string
  domain: string
  scope: string        // project | transferable | transient (defaults to project)
  tags: string[]
  since_version: string
  status: string
  related: string[]
  graduated_to: string
  title: string
  body: string
  sourceFile: string
}

// ── Parser ────────────────────────────────────────────────────────────────────

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
  return inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
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
    scope: fm['scope'] ?? 'project',
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
    } catch { continue }
    for (const name of names) {
      const filePath = resolve(dir, name)
      const content = readFileSync(filePath, 'utf8')
      const entryBlockRe = /<!--\s*entry:([\w-]+)\s*-->([\s\S]*?)<!--\s*\/entry\s*-->/g
      let match: RegExpExecArray | null
      while ((match = entryBlockRe.exec(content)) !== null) {
        const entry = parseEntry(match[1]!, match[2]!, filePath)
        if (entry) entries.push(entry)
      }
    }
  }
  return entries
}

// ── Prose formatter ───────────────────────────────────────────────────────────

function formatEntryForEngram(entry: RawEntry): string {
  const lines: string[] = []
  lines.push(`KNOWLEDGE ENTRY: ${entry.id}`)
  lines.push(`Type: ${entry.type} | Domain: ${entry.domain} | Scope: ${entry.scope} | Status: ${entry.status}`)
  if (entry.tags.length > 0) lines.push(`Tags: ${entry.tags.join(', ')}`)
  if (entry.since_version) lines.push(`Since version: ${entry.since_version}`)
  lines.push('')
  lines.push(entry.body)
  if (entry.related.length > 0) {
    lines.push('')
    lines.push(`Related knowledge entries: ${entry.related.join(', ')}`)
  }
  if (entry.graduated_to) {
    lines.push('')
    lines.push(`Graduated to universal rule at: ${entry.graduated_to}`)
  }
  return lines.join('\n')
}

function computeHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

/** §10 step 3B: the incremental-ingest diff key, read from the served store
 *  (engram_chunks.content_hash) scoped to this ingestor's own (project, chunk_type)
 *  slice — the source of truth for the diff. Manages its own pool lifecycle so it is
 *  safe to call before the dry-run early return. */
async function readWeaverHashes(): Promise<Map<string, string>> {
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await ensureSchema(client)
    return await getProjectHashes(client, 'weaver')
  } finally {
    client.release()
    await closePgPool()
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const ingestStart = Date.now()
  console.log(`${BOLD}Engram Knowledge Ingestion${RESET}`)
  console.log(`${DIM}Dataset: ${DATASET}  ·  pgvector (embed-only)${DRY_RUN ? '  ·  DRY RUN' : FORCE_RESET ? '  ·  FORCE RESET' : '  ·  incremental'}${RESET}`)
  console.log()

  const entries = collectEntries()

  if (entries.length === 0) {
    console.log(`${DIM}No entries found in docs/knowledge/. Nothing to ingest.${RESET}`)
    process.exit(0)
  }

  console.log(`Collected ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} from docs/knowledge/`)

  // §10 step 3B: the served store (engram_chunks.content_hash) is the diff source of truth.
  const dbHashes = await readWeaverHashes()
  const currentIds = new Set(entries.map((e) => e.id))

  const toAdd: RawEntry[] = []
  const toUpdate: RawEntry[] = []
  const toDelete: Array<{ entryId: string }> = []
  const skipped: string[] = []

  for (const entry of entries) {
    const text = formatEntryForEngram(entry)
    const hash = computeHash(text)
    const dbHash = dbHashes.get(entry.id)

    if (dbHash === undefined) {
      toAdd.push(entry)
    } else if (dbHash !== hash) {
      toUpdate.push(entry)
    } else {
      skipped.push(entry.id)
    }
  }

  for (const entryId of dbHashes.keys()) {
    if (!currentIds.has(entryId)) {
      toDelete.push({ entryId })
    }
  }

  console.log(`  ${GREEN}new${RESET}: ${toAdd.length}  ${YELLOW}changed${RESET}: ${toUpdate.length}  ${DIM}unchanged: ${skipped.length}  deleted: ${toDelete.length}${RESET}`)
  console.log()

  if (DRY_RUN) {
    if (FORCE_RESET) console.log(`${DIM}[force-reset] Would wipe this project's chunks and re-embed all ${entries.length} entries.${RESET}`)
    for (const e of toAdd)    console.log(`  ${GREEN}+ ${e.id}${RESET} (${e.domain} ${e.type})`)
    for (const e of toUpdate) console.log(`  ${YELLOW}~ ${e.id}${RESET} (${e.domain} ${e.type}) — changed`)
    for (const d of toDelete) console.log(`  ${RED}- ${d.entryId}${RESET} — deleted from source`)
    console.log()
    console.log(`${GREEN}Dry run complete.${RESET}`)
    return
  }

  let added = 0
  let updated = 0
  let deleted = 0
  let failed = 0
  let improved = false

  // ── embed-only path: chunk + embed → engram_chunks (project='weaver') ──────────
  const embedOk = await checkEmbedService()
  if (!embedOk) {
    console.error(`${RED}${BOLD}nomic-embed unreachable at ${process.env.EMBED_URL ?? 'http://localhost:8767'}${RESET}`)
    console.error(`${DIM}Start it via: systemctl start weaver-llama-embed${RESET}`)
    process.exit(1)
  }
  console.log(`${GREEN}✓${RESET} nomic-embed reachable`)

  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await ensureSchema(client)

    // Force reset: wipe our chunks
    if (FORCE_RESET) {
      process.stdout.write(`Force-resetting dataset "${DATASET}" (embed-only)… `)
      await clearProjectChunks(client, 'weaver')
      console.log(`${GREEN}done${RESET}`)
      toAdd.push(...toUpdate, ...entries.filter((e) => skipped.includes(e.id)))
      toUpdate.length = 0
      toDelete.length = 0
      skipped.length = 0
    }

    // Deletions
    for (const { entryId } of toDelete) {
      process.stdout.write(`  ${RED}delete${RESET} ${entryId}… `)
      try {
        await deleteChunks(client, 'weaver', entryId)
        deleted++
        console.log(`${GREEN}✓${RESET}`)
      } catch (err) {
        failed++
        console.log(`${RED}✗ ${String(err)}${RESET}`)
      }
    }

    // Updates fold into adds (upsertChunk deletes existing chunk first)
    for (const entry of toUpdate) {
      toAdd.push(entry)
    }

    // Adds
    for (const entry of toAdd) {
      const text = formatEntryForEngram(entry)
      const hash = computeHash(text)
      const isUpdate = toUpdate.includes(entry)
      if (!isUpdate) process.stdout.write(`  ${GREEN}embed${RESET} ${entry.id}… `)
      else process.stdout.write(`  ${YELLOW}re-embed${RESET} ${entry.id}… `)
      try {
        const embedding = await embedText(text)
        await upsertChunk(client, { project: 'weaver', entryId: entry.id, content: text, embedding, contentHash: hash, metadata: { domain: entry.domain, type: entry.type, scope: entry.scope, status: entry.status, tags: entry.tags, related: entry.related, title: entry.title, since_version: entry.since_version } })
        if (isUpdate) updated++; else added++
        console.log(`${GREEN}✓${RESET}`)
      } catch (err) {
        failed++
        console.log(`${RED}✗ ${String(err)}${RESET}`)
      }
    }
    improved = failed === 0

    // Run telemetry → Postgres (ingestion_runs), replacing the retired SQLite log.
    await logIngestionRunPg(client, {
      dataset: DATASET,
      entryCount: entries.length,
      successCount: added + updated,
      failureCount: failed,
      improved,
      durationMs: Date.now() - ingestStart,
      flags: { dryRun: DRY_RUN, forceReset: FORCE_RESET },
    })
  } finally {
    client.release()
    await closePgPool()
  }

  console.log()
  if (failed === 0) {
    console.log(`${GREEN}${BOLD}Done.${RESET} +${added} added  ~${updated} updated  -${deleted} deleted  (${skipped.length} unchanged)`)
  } else {
    console.log(`${RED}${BOLD}Finished with ${failed} failure(s).${RESET} +${added} added  ~${updated} updated  -${deleted} deleted`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(`${RED}${BOLD}Fatal:${RESET}`, err)
  process.exit(1)
})

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Engram Knowledge Ingestion — incremental
 *
 * Reads every structured entry from code/docs/knowledge/{lessons,gotchas}/*.md,
 * compares each against the ingested_entries registry in engram.db, and only
 * sends entries that are new or changed to the Engram service. Deleted entries
 * are forgotten from the graph automatically.
 *
 * After all adds/removals, cognify is called once to rebuild the knowledge graph
 * from the updated dataset — no per-entry graph rebuild.
 *
 * Flags:
 *   --dry-run        Print what would be added/skipped/deleted; do not POST.
 *   --force-reset    Wipe dataset + registry and re-ingest everything from scratch.
 *   --metadata-only  Update SQLite ingested_entries (title, domain, related, etc.)
 *                    without touching the Cognee/Engram service. Useful when YAML
 *                    metadata changed (e.g. related[] populated) but no re-embed needed.
 *                    Preserves existing dataId/datasetId for already-ingested entries.
 *
 * Invocation:
 *   npx tsx scripts/ingest-knowledge-to-engram.ts
 *   npm run engram:ingest-knowledge
 *   npm run engram:ingest-knowledge -- --dry-run
 *   npm run engram:ingest-knowledge -- --force-reset
 *   npm run engram:ingest-knowledge -- --metadata-only
 */

import { readFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'
import {
  openEngramDb, logIngestionRun, resolveEngramDbPath,
  getAllIngestedEntries, upsertIngestedEntry, deleteIngestedEntry, clearIngestedEntries,
  getLastIngestionRun,
} from '../codebase-mcp/src/utils/engram-db.js'
import {
  getPgPool, closePgPool, ensureSchema, embedText, checkEmbedService,
  upsertChunk, deleteChunks, clearDatasetChunks,
} from '../codebase-mcp/src/utils/pgvector-embed.js'
import {
  openEngramGraphWriter, resolveEngramGraphPath,
} from './engram-graph.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CODE_ROOT = resolve(__dirname, '..')
const KNOWLEDGE_ROOT = resolve(CODE_ROOT, 'docs/knowledge')
// In production, use VM_DATA_DIR as the DB root to match the backend service path.
// In dev (VM_DATA_DIR unset), falls back to code/data/engram.db.
const ENGRAM_DB_PATH = process.env.VM_DATA_DIR
  ? resolve(process.env.VM_DATA_DIR, 'engram.db')
  : resolveEngramDbPath(CODE_ROOT)
const COGNEE_URL = process.env.COGNEE_URL ?? 'http://localhost:8765'
// Default to the weaver service account so the dataset lands in the same namespace
// as the Engram UI and CSM hooks. Override via env vars if needed.
const COGNEE_USER = process.env.COGNEE_USER ?? 'weaver@weaver.dev'
const COGNEE_PASSWORD = process.env.COGNEE_PASSWORD ?? 'weaver-dev-2026'
const DATASET = 'project_knowledge'
const DRY_RUN = process.argv.includes('--dry-run')
const FORCE_RESET = process.argv.includes('--force-reset')
const METADATA_ONLY = process.argv.includes('--metadata-only')

// Processing strategy for this dataset.
// embed-only:  chunk + embed → weaver_knowledge_chunks (pgvector), skip Cognee pipeline.
// embed+graph: embed-only PLUS LLM entity extraction → Kuzu (owned graph, no Cognee).
// full-cognify: Cognee /add + /cognify (entity extraction + graph via Cognee sidecar).
const STRATEGY: 'embed-only' | 'embed+graph' | 'full-cognify' = 'embed-only'

const LLAMA_GEN_URL = process.env.LLAMA_GEN_URL ?? 'http://localhost:8769'

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

// ── Cognee API ────────────────────────────────────────────────────────────────

/** Authenticate as COGNEE_USER and return a Bearer token.
 *  Returns null if no credentials are configured (fully open dev mode). */
async function getToken(): Promise<string | null> {
  if (!COGNEE_USER || !COGNEE_PASSWORD) return null
  const body = new URLSearchParams({ username: COGNEE_USER, password: COGNEE_PASSWORD })
  const res = await fetch(`${COGNEE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text().catch(() => '')}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

function authHeader(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function checkCognee(): Promise<boolean> {
  try {
    const res = await fetch(`${COGNEE_URL}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch { return false }
}

/** Add a single entry as a .txt file; returns { dataId, datasetId }. */
async function addEntry(text: string, entryId: string, token: string | null): Promise<{ dataId: string; datasetId: string }> {
  const formData = new FormData()
  formData.append('data', new Blob([text], { type: 'text/plain' }), `${entryId}.txt`)
  formData.append('datasetName', DATASET)

  const res = await fetch(`${COGNEE_URL}/api/v1/add`, {
    method: 'POST',
    headers: authHeader(token),
    body: formData,
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)')
    throw new Error(`Add failed: ${res.status} ${body}`)
  }
  const json = await res.json() as {
    dataset_id?: string
    data_ingestion_info?: Array<{ data_id: string }>
  }
  const dataId = json.data_ingestion_info?.[0]?.data_id
  const datasetId = json.dataset_id ?? ''
  if (!dataId) throw new Error('Add succeeded but no data_id in response')
  return { dataId, datasetId }
}

/** Forget a single entry by its Cognee data_id. */
async function forgetEntry(dataId: string, token: string | null): Promise<void> {
  const res = await fetch(`${COGNEE_URL}/api/v1/forget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ dataId, dataset: DATASET }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)')
    throw new Error(`Forget failed: ${res.status} ${body}`)
  }
}

/** Look up a dataset UUID by name. Returns null if not found. */
async function findDatasetId(name: string, token: string | null): Promise<string | null> {
  const res = await fetch(`${COGNEE_URL}/api/v1/datasets`, {
    headers: authHeader(token),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return null
  const datasets = await res.json() as Array<{ id: string; name: string }>
  return datasets.find((d) => d.name === name)?.id ?? null
}

/** Wipe the entire dataset from Cognee including all extracted graph nodes (used by --force-reset).
 *
 * Uses DELETE /api/v1/datasets/{id} which removes the dataset record AND its graph nodes.
 * POST /api/v1/forget with {dataset} always returns 500 and leaves graph nodes intact — do not use.
 * Cognee returns 403 on successful delete (known Cognee API bug) — treat as success.
 */
async function wipeDataset(token: string | null): Promise<void> {
  const datasetId = await findDatasetId(DATASET, token)
  if (!datasetId) return  // Dataset doesn't exist yet — nothing to wipe

  const res = await fetch(`${COGNEE_URL}/api/v1/datasets/${datasetId}`, {
    method: 'DELETE',
    headers: authHeader(token),
    signal: AbortSignal.timeout(15000),
  })
  // Cognee returns 403 even on successful deletion (known Cognee API bug).
  // 404 = already gone, which is fine.
  if (!res.ok && res.status !== 403 && res.status !== 404) {
    const body = await res.text().catch(() => '')
    throw new Error(`Dataset wipe failed: ${res.status} ${body}`)
  }
}

/** Poll /api/v1/activity/pipeline-runs until cognify_pipeline reaches a terminal state.
 *  Polls every 30 s, up to maxWaitMs. Returns true on COMPLETED, false on ERRORED,
 *  throws on timeout. */
async function pollCognifyCompletion(token: string | null, maxWaitMs = 45 * 60 * 1000): Promise<boolean> {
  const pollIntervalMs = 30_000
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, pollIntervalMs))
    const pollRes = await fetch(`${COGNEE_URL}/api/v1/activity/pipeline-runs`, {
      headers: authHeader(token),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null)
    if (!pollRes?.ok) continue
    const runs = await pollRes.json() as Array<{ pipeline_name: string; status: string }>
    const run = runs.find((r) => r.pipeline_name === 'cognify_pipeline')
    if (!run) continue
    if (run.status === 'DATASET_PROCESSING_COMPLETED') return true
    if (run.status === 'DATASET_PROCESSING_ERRORED') return false
    // DATASET_PROCESSING_STARTED — still running
  }
  throw new Error(`Cognify pipeline did not complete within ${Math.round(maxWaitMs / 60000)} minutes`)
}

/** Run knowledge graph construction on the dataset (called once after all adds).
 *  Uses run_in_background=true so Cognee returns immediately; then polls
 *  /api/v1/activity/pipeline-runs until cognify_pipeline COMPLETED or ERRORED.
 *  Skips the POST if the pipeline already shows COMPLETED (prevents duplicate
 *  accumulation when re-running after a timeout). Local llama-cpp can take
 *  25+ minutes for ~20 entries — polls every 30 s, up to 45 min total.
 *
 *  Stale STARTED guard: pipeline-runs table caps at 50 rows. If add_pipeline events
 *  fill the table, the terminal COMPLETED/ERRORED event is pushed out, leaving only
 *  the STARTED event visible. A STARTED event older than the poll timeout (45 min)
 *  is definitionally stale — the pipeline finished one way or another. Fall through
 *  to start a fresh cognify rather than polling forever. */
async function cognifyDataset(token: string | null): Promise<boolean> {
  const POLL_TIMEOUT_MS = 45 * 60 * 1000
  // Skip POST if the pipeline already completed (re-run-safe guard)
  const checkRes = await fetch(`${COGNEE_URL}/api/v1/activity/pipeline-runs`, {
    headers: authHeader(token),
    signal: AbortSignal.timeout(10000),
  }).catch(() => null)
  if (checkRes?.ok) {
    const runs = await checkRes.json() as Array<{ pipeline_name: string; status: string; created_at: string }>
    const existing = runs.find((r) => r.pipeline_name === 'cognify_pipeline')
    if (existing?.status === 'DATASET_PROCESSING_COMPLETED') return true
    if (existing?.status === 'DATASET_PROCESSING_STARTED') {
      const startedAt = new Date(existing.created_at).getTime()
      const ageMs = Date.now() - startedAt
      if (ageMs < POLL_TIMEOUT_MS) {
        // Pipeline is actively running — poll for completion
        return pollCognifyCompletion(token)
      }
      // STARTED event is older than the poll timeout — the pipeline finished but
      // its terminal event was pushed out of the 50-row table by add_pipeline events.
      // Fall through to start a fresh cognify run.
      console.log(`  ${YELLOW}⚠ cognify STARTED event is ${Math.round(ageMs / 60000)}m old — stale (terminal event off-table), starting fresh cognify${RESET}`)
    }
    // ERRORED or stale STARTED: fall through to start a new cognify run
  }

  const res = await fetch(`${COGNEE_URL}/api/v1/cognify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(token) },
    body: JSON.stringify({ datasets: [DATASET], run_in_background: true }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // 409 = "Dataset is already being processed" — poll for it
    if (res.status !== 409) throw new Error(`Cognify failed: ${res.status} ${body}`)
  }

  return pollCognifyCompletion(token)
}

// ── Entity extraction (embed+graph) ──────────────────────────────────────────

interface ExtractedEntity {
  name: string
  type: string
  description: string
}

async function extractEntities(entryId: string, text: string): Promise<ExtractedEntity[]> {
  const prompt = `Extract named entities from the following technical knowledge entry.
Return a JSON object with an "entities" array. Each entity has: name (string), type (one of: concept, technology, tool, pattern, rule, component), description (one sentence).
Extract 3-8 entities maximum. Focus on the most specific and useful technical concepts.

Text:
${text.slice(0, 2000)}

Respond with ONLY valid JSON, no explanation.`

  try {
    const res = await fetch(`${LLAMA_GEN_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`llama-gen ${res.status}`)
    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    const content = data.choices[0]?.message?.content ?? ''
    const parsed = JSON.parse(content) as { entities?: ExtractedEntity[] }
    return Array.isArray(parsed.entities) ? parsed.entities.slice(0, 8) : []
  } catch (err) {
    console.log(`  ${YELLOW}⚠ entity extraction skipped for ${entryId}: ${String(err)}${RESET}`)
    return []
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const ingestStart = Date.now()
  console.log(`${BOLD}Engram Knowledge Ingestion${RESET}`)
  console.log(`${DIM}Dataset: ${DATASET}  ·  Sidecar: ${COGNEE_URL}${DRY_RUN ? '  ·  DRY RUN' : FORCE_RESET ? '  ·  FORCE RESET' : '  ·  incremental'}${RESET}`)
  console.log()

  const db = openEngramDb(ENGRAM_DB_PATH)
  const entries = collectEntries()

  if (entries.length === 0) {
    console.log(`${DIM}No entries found in docs/knowledge/. Nothing to ingest.${RESET}`)
    process.exit(0)
  }

  console.log(`Collected ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} from docs/knowledge/`)

  // Compute hashes and diff against registry
  const existing = getAllIngestedEntries(db)
  const currentIds = new Set(entries.map((e) => e.id))

  const toAdd: RawEntry[] = []
  const toUpdate: RawEntry[] = []
  const toDelete: Array<{ entryId: string; dataId: string }> = []
  const skipped: string[] = []

  for (const entry of entries) {
    const text = formatEntryForEngram(entry)
    const hash = computeHash(text)
    const rec = existing.get(entry.id)

    if (!rec) {
      toAdd.push(entry)
    } else if (rec.contentHash !== hash) {
      toUpdate.push(entry)
    } else {
      skipped.push(entry.id)
    }
  }

  for (const [entryId, rec] of existing) {
    if (!currentIds.has(entryId)) {
      toDelete.push({ entryId, dataId: rec.dataId })
    }
  }

  console.log(`  ${GREEN}new${RESET}: ${toAdd.length}  ${YELLOW}changed${RESET}: ${toUpdate.length}  ${DIM}unchanged: ${skipped.length}  deleted: ${toDelete.length}${RESET}`)
  console.log()

  if (DRY_RUN) {
    if (FORCE_RESET) console.log(`${DIM}[force-reset] Would wipe dataset and re-ingest all ${entries.length} entries.${RESET}`)
    for (const e of toAdd)    console.log(`  ${GREEN}+ ${e.id}${RESET} (${e.domain} ${e.type})`)
    for (const e of toUpdate) console.log(`  ${YELLOW}~ ${e.id}${RESET} (${e.domain} ${e.type}) — changed`)
    for (const d of toDelete) console.log(`  ${RED}- ${d.entryId}${RESET} — deleted from source`)
    console.log()
    console.log(`${GREEN}Dry run complete.${RESET}`)
    return
  }

  // Metadata-only: sync SQLite without touching Cognee (useful when related[] or other
  // YAML metadata changed but re-embedding is not needed or Cognee is unavailable).
  if (METADATA_ONLY) {
    let synced = 0
    for (const entry of entries) {
      const text = formatEntryForEngram(entry)
      const hash = computeHash(text)
      const rec = existing.get(entry.id)
      upsertIngestedEntry(db, {
        entryId: entry.id,
        contentHash: hash,
        dataId:    rec?.dataId    ?? '',
        datasetId: rec?.datasetId ?? '',
        domain: entry.domain,
        type: entry.type,
        scope: entry.scope,
        status: entry.status,
        tags: JSON.stringify(entry.tags),
        sinceVersion: entry.since_version,
        title: entry.title,
        related: JSON.stringify(entry.related),
        ingestedAt: Date.now(),
      })
      synced++
    }
    logIngestionRun(db, {
      dataset: DATASET,
      entryCount: entries.length,
      successCount: synced,
      failureCount: 0,
      improved: false,
      durationMs: Date.now() - ingestStart,
      flags: { dryRun: false, forceReset: false, metadataOnly: true },
    })
    console.log(`${GREEN}✓${RESET} Metadata sync complete — ${synced} entries updated in SQLite (Cognee untouched)`)
    return
  }

  let added = 0
  let updated = 0
  let deleted = 0
  let failed = 0
  let improved = false

  // ── Strategy dispatch ────────────────────────────────────────────────────────
  if (STRATEGY === 'embed-only') {
    // Direct pgvector path — no Cognee. Chunk + embed → weaver_knowledge_chunks.
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

      // Force reset: wipe our chunks + registry
      if (FORCE_RESET) {
        process.stdout.write(`Force-resetting dataset "${DATASET}" (embed-only)… `)
        await clearDatasetChunks(client, DATASET)
        clearIngestedEntries(db)
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
          await deleteChunks(client, entryId, DATASET)
          deleteIngestedEntry(db, entryId)
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
          await upsertChunk(client, { entryId: entry.id, dataset: DATASET, chunkText: text, embedding })
          upsertIngestedEntry(db, {
            entryId: entry.id,
            contentHash: hash,
            dataId: '',
            datasetId: DATASET,
            domain: entry.domain,
            type: entry.type,
            scope: entry.scope,
            status: entry.status,
            tags: JSON.stringify(entry.tags),
            sinceVersion: entry.since_version,
            title: entry.title,
            related: JSON.stringify(entry.related),
            ingestedAt: Date.now(),
          })
          if (isUpdate) updated++; else added++
          console.log(`${GREEN}✓${RESET}`)
        } catch (err) {
          failed++
          console.log(`${RED}✗ ${String(err)}${RESET}`)
        }
      }
      improved = failed === 0
    } finally {
      client.release()
      await closePgPool()
    }

  } else if (STRATEGY === 'embed+graph') {
    // ── embed+graph path: pgvector embed + LLM entity extraction → owned Kuzu ──
    const embedOk = await checkEmbedService()
    if (!embedOk) {
      console.error(`${RED}${BOLD}nomic-embed unreachable at ${process.env.EMBED_URL ?? 'http://localhost:8767'}${RESET}`)
      process.exit(1)
    }
    console.log(`${GREEN}✓${RESET} nomic-embed reachable`)

    const graph = await openEngramGraphWriter(resolveEngramGraphPath(CODE_ROOT))
    const pool = getPgPool()
    const client = await pool.connect()
    try {
      await ensureSchema(client)

      if (FORCE_RESET) {
        process.stdout.write(`Force-resetting dataset "${DATASET}" (embed+graph)… `)
        await clearDatasetChunks(client, DATASET)
        await graph.clearAllEntries()
        clearIngestedEntries(db)
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
          await deleteChunks(client, entryId, DATASET)
          await graph.deleteEntry(entryId)
          deleteIngestedEntry(db, entryId)
          deleted++
          console.log(`${GREEN}✓${RESET}`)
        } catch (err) {
          failed++
          console.log(`${RED}✗ ${String(err)}${RESET}`)
        }
      }

      // Updates fold into adds
      for (const entry of toUpdate) toAdd.push(entry)

      // Adds — embed + upsert Kuzu entry node + extract entities
      for (const entry of toAdd) {
        const text = formatEntryForEngram(entry)
        const hash = computeHash(text)
        const isUpdate = toUpdate.includes(entry)
        process.stdout.write(`  ${isUpdate ? YELLOW + 're-embed' : GREEN + 'embed+graph'}${RESET} ${entry.id}… `)
        try {
          const embedding = await embedText(text)
          await upsertChunk(client, { entryId: entry.id, dataset: DATASET, chunkText: text, embedding })
          await graph.upsertEntry({
            entryId: entry.id,
            title: entry.title,
            domain: entry.domain,
            type: entry.type,
            scope: entry.scope,
            status: entry.status,
          })
          upsertIngestedEntry(db, {
            entryId: entry.id,
            contentHash: hash,
            dataId: '',
            datasetId: DATASET,
            domain: entry.domain,
            type: entry.type,
            scope: entry.scope,
            status: entry.status,
            tags: JSON.stringify(entry.tags),
            sinceVersion: entry.since_version,
            title: entry.title,
            related: JSON.stringify(entry.related),
            ingestedAt: Date.now(),
          })
          if (isUpdate) updated++; else added++
          console.log(`${GREEN}✓${RESET}`)

          // Entity extraction (non-fatal)
          const entities = await extractEntities(entry.id, text)
          const entityIds: string[] = []
          for (const entity of entities) {
            const entityId = `${entry.id}:${slugify(entity.name)}`
            await graph.upsertEntity({ entityId, name: entity.name, type: entity.type, description: entity.description })
            entityIds.push(entityId)
          }
          if (entityIds.length > 0) await graph.addMentions(entry.id, entityIds)
        } catch (err) {
          failed++
          console.log(`${RED}✗ ${String(err)}${RESET}`)
        }
      }

      // Sync RELATED_TO edges for all entries (including unchanged — relations may have changed)
      process.stdout.write(`Syncing graph relations… `)
      for (const entry of entries) {
        try { await graph.setRelations(entry.id, entry.related) } catch { /* non-fatal */ }
      }
      console.log(`${GREEN}✓${RESET}`)

      improved = failed === 0
    } finally {
      graph.close()
      client.release()
      await closePgPool()
    }

  } else {
    // ── full-cognify path (Cognee /add + /cognify) ─────────────────────────────
    const available = await checkCognee()
    if (!available) {
      console.error(`${RED}${BOLD}Engram service unreachable at ${COGNEE_URL}${RESET}`)
      console.error(`${DIM}Start it via: systemctl start weaver-cognee${RESET}`)
      process.exit(1)
    }
    console.log(`${GREEN}✓${RESET} Engram service reachable`)

    const token = await getToken()
    if (!token) {
      console.error(`${RED}${BOLD}Auth failed — cannot ingest to anonymous namespace (would be invisible to Engram UI).${RESET}`)
      console.error(`${DIM}Check COGNEE_USER / COGNEE_PASSWORD env vars or Cognee service availability.${RESET}`)
      process.exit(1)
    }
    console.log(`${GREEN}✓${RESET} Authenticated as ${COGNEE_USER}`)

    if (FORCE_RESET) {
      process.stdout.write(`Force-resetting dataset "${DATASET}"… `)
      await wipeDataset(token)
      clearIngestedEntries(db)
      console.log(`${GREEN}done${RESET}`)
      toAdd.push(...toUpdate, ...entries.filter((e) => skipped.includes(e.id)))
      toUpdate.length = 0
      toDelete.length = 0
      skipped.length = 0
    }

    for (const { entryId, dataId } of toDelete) {
      process.stdout.write(`  ${RED}forget${RESET} ${entryId}… `)
      try {
        await forgetEntry(dataId, token)
        deleteIngestedEntry(db, entryId)
        deleted++
        console.log(`${GREEN}✓${RESET}`)
      } catch (err) {
        failed++
        console.log(`${RED}✗ ${String(err)}${RESET}`)
      }
    }

    for (const entry of toUpdate) {
      const rec = existing.get(entry.id)!
      process.stdout.write(`  ${YELLOW}update${RESET} ${entry.id}… `)
      try { await forgetEntry(rec.dataId, token) } catch { /* non-fatal */ }
      toAdd.push(entry)
    }

    for (const entry of toAdd) {
      const text = formatEntryForEngram(entry)
      const hash = computeHash(text)
      const isUpdate = toUpdate.includes(entry)
      if (!isUpdate) process.stdout.write(`  ${GREEN}add${RESET} ${entry.id}… `)
      try {
        const { dataId, datasetId } = await addEntry(text, entry.id, token)
        upsertIngestedEntry(db, {
          entryId: entry.id,
          contentHash: hash,
          dataId,
          datasetId,
          domain: entry.domain,
          type: entry.type,
          scope: entry.scope,
          status: entry.status,
          tags: JSON.stringify(entry.tags),
          sinceVersion: entry.since_version,
          title: entry.title,
          related: JSON.stringify(entry.related),
          ingestedAt: Date.now(),
        })
        if (isUpdate) { updated++; console.log(`${GREEN}✓${RESET}`) }
        else added++
        console.log(`${GREEN}✓${RESET}`)
      } catch (err) {
        failed++
        console.log(`${RED}✗ ${String(err)}${RESET}`)
      }
    }

    console.log()
    const anyChange = added + updated + deleted > 0
    const lastRun = getLastIngestionRun(db, DATASET)
    const needsRebuild = anyChange || (lastRun !== null && !lastRun.improved && lastRun.successCount > 0)
    if (needsRebuild) {
      process.stdout.write(`Building knowledge graph (may take several minutes)… `)
      try {
        improved = await cognifyDataset(token)
        console.log(improved ? `${GREEN}done${RESET}` : `${RED}✗ cognify returned error${RESET}`)
      } catch (err) {
        console.log(`${RED}✗ ${String(err)}${RESET}`)
        failed++
      }
    } else {
      console.log(`${DIM}Graph up to date — skipping cognify.${RESET}`)
      improved = true
    }
  }

  logIngestionRun(db, {
    dataset: DATASET,
    entryCount: entries.length,
    successCount: added + updated,
    failureCount: failed,
    improved,
    durationMs: Date.now() - ingestStart,
    flags: { dryRun: DRY_RUN, forceReset: FORCE_RESET },
  })

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

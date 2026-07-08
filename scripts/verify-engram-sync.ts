// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * audit:engram-sync — verify the Engram pgvector projection is current with the
 * markdown knowledge source for THIS repo (project = 'weaver').
 *
 * The invariant (WVR-188): every ingestable knowledge entry in
 * docs/knowledge/{lessons,gotchas}/*.md must have exactly one knowledge_entry
 * row in the shared engram_chunks pgvector table on king. This is the md->DB
 * half of the write->md->db chain — the half that silently drifts because the
 * ingest is a manual step. The other two knowledge auditors already guard
 * md->INDEX (audit:knowledge-index-fresh) and id uniqueness
 * (audit:knowledge-ids-unique); this one guards md->DB.
 *
 * Native-per-codebase port of anvil's Python scripts/audit-engram-sync.py: the
 * writer/auditor is TS here (weaver is a TS codebase), Python in anvil/engram-nix.
 * The shared, invariant contract is NOT the language — it is the SQL + the entry
 * format. So this reuses weaver's OWN parser and PG client rather than
 * re-implementing either:
 *   - markdown count  = collectEntries() from generate-knowledge-index.ts — the
 *     SAME parser the INDEX is built from, so "what the auditor counts" can never
 *     drift from "what the INDEX counts". (Raw <!-- entry: --> markers are NOT the
 *     count: a marker without a closing <!-- /entry --> or frontmatter is not an
 *     ingestable entry and never reaches the DB.)
 *   - DB count        = distinct knowledge_entry rows via the shared pgvector pool.
 *
 * Behaviour — the ingest is a REQUIRED md->DB sync, not best-effort:
 *   - Engram reachable + counts match  -> OK   (exit 0)
 *   - Engram reachable + counts differ -> FAIL (exit 1); fix: npm run engram:ingest-knowledge
 *   - Engram unreachable (dev store down, or CI off the LAN) -> SKIP with a loud
 *     notice (exit 0). Never blocks a push on a down dev store; never a silent
 *     green — the skip prints the reason so an auth/config break stays visible.
 */

import { collectEntries } from './generate-knowledge-index.js'
import { getPgPool, closePgPool } from '../codebase-mcp/src/utils/pgvector-embed.js'

const PROJECT = 'weaver'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

const FIX = 'npm run engram:ingest-knowledge'

/** Distinct ingested knowledge entries for this project, or null when the store
 *  is unreachable (connection refused, auth failure, timeout). The reason is
 *  returned so the skip notice can surface a misconfig instead of hiding it. */
async function queryEngramCount(): Promise<{ count: number | null; reason: string }> {
  const pool = getPgPool()
  try {
    const client = await pool.connect()
    try {
      const { rows } = await client.query<{ n: string }>(
        `SELECT count(DISTINCT entry_id) AS n FROM engram_chunks
          WHERE project = $1 AND chunk_type = 'knowledge_entry'`,
        [PROJECT],
      )
      return { count: parseInt(rows[0]?.n ?? '0', 10), reason: '' }
    } finally {
      client.release()
    }
  } catch (err) {
    return { count: null, reason: err instanceof Error ? err.message : String(err) }
  } finally {
    await closePgPool()
  }
}

async function main(): Promise<void> {
  const mdCount = collectEntries().length
  const { count: dbCount, reason } = await queryEngramCount()

  if (dbCount === null) {
    console.log(
      `${YELLOW}audit:engram-sync SKIPPED${RESET} — Engram store unreachable (${reason}).`,
    )
    console.log(
      `${YELLOW}  Drift NOT verified against ${mdCount} markdown entries. Run ` +
        `\`${FIX}\` once the store is up to re-project it.${RESET}`,
    )
    process.exit(0)
  }

  if (dbCount === mdCount) {
    console.log(
      `${GREEN}audit:engram-sync OK${RESET} — Engram '${PROJECT}' dataset matches ` +
        `${mdCount} markdown entries.`,
    )
    process.exit(0)
  }

  const delta = mdCount - dbCount
  const drift =
    delta > 0 ? 'markdown ahead — ingest needed' : 'Engram ahead — stale rows or source deleted'
  console.error(
    `${RED}audit:engram-sync FAILED${RESET} — Engram '${PROJECT}' dataset is out of ` +
      `sync with the markdown source.`,
  )
  console.error(`  markdown entries : ${mdCount}`)
  console.error(`  Engram pgvector  : ${dbCount}`)
  console.error(`  drift            : ${delta > 0 ? '+' : ''}${delta}  (${drift})`)
  console.error(
    `\nFix: ${FIX}\n  (run it plainly, check its own exit code, and reconcile the ` +
      `new/changed/unchanged/deleted summary — never pipe it through tail/head, ` +
      `which masks the exit code.)`,
  )
  process.exit(1)
}

void main()

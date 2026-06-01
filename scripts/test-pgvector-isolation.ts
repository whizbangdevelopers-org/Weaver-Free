// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Dataset isolation smoke test — two synthetic datasets, verify no cross-contamination.
 *
 * Does NOT require nomic-embed — uses zero vectors as placeholder embeddings.
 * Verifies: insert isolation, search isolation, clear isolation.
 *
 * Usage: npx tsx scripts/test-pgvector-isolation.ts
 */

import {
  getPgPool, closePgPool, ensureSchema,
  upsertChunk, searchChunks, clearProjectChunks, countProjectChunks,
} from '../codebase-mcp/src/utils/pgvector-embed.js'

const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const DIM    = '\x1b[2m'
const BOLD   = '\x1b[1m'
const RESET  = '\x1b[0m'

const DS_A = 'ns_isolation_test_alpha'
const DS_B = 'ns_isolation_test_beta'
const DIM_768 = 768

function zeroVec(): number[] { return new Array(DIM_768).fill(0) }

// Slightly perturb a zero vector so vectors are not identical (pgvector handles equal vecs, but be explicit)
function vecFor(seed: number): number[] {
  const v = zeroVec()
  v[seed % DIM_768] = 0.01
  return v
}

let passed = 0
let failed = 0

function assert(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  ${GREEN}✓${RESET} ${label}`)
    passed++
  } else {
    console.log(`  ${RED}✗ FAIL${RESET} ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

async function main() {
  console.log(`${BOLD}pgvector Dataset Isolation Test${RESET}`)
  console.log(`${DIM}Datasets: ${DS_A}  ·  ${DS_B}${RESET}`)
  console.log()

  const pool = getPgPool()
  const client = await pool.connect()

  try {
    await ensureSchema(client)

    // ── Setup: wipe any leftover test data ───────────────────────────────────
    await clearProjectChunks(client, DS_A)
    await clearProjectChunks(client, DS_B)
    console.log(`${DIM}Cleared any prior test data.${RESET}`)
    console.log()

    // ── Phase 1: Insert ──────────────────────────────────────────────────────
    console.log(`Phase 1 — Insert`)
    await upsertChunk(client, { project: DS_A, entryId: 'alpha-entry-1', content: 'alpha content one',   embedding: vecFor(1) })
    await upsertChunk(client, { project: DS_A, entryId: 'alpha-entry-2', content: 'alpha content two',   embedding: vecFor(2) })
    await upsertChunk(client, { project: DS_B, entryId: 'beta-entry-1',  content: 'beta content one',    embedding: vecFor(3) })
    await upsertChunk(client, { project: DS_B, entryId: 'beta-entry-2',  content: 'beta content two',    embedding: vecFor(4) })

    const countA = await countProjectChunks(client, DS_A)
    const countB = await countProjectChunks(client, DS_B)
    assert(`DS_A has 2 chunks`,  countA === 2, `got ${countA}`)
    assert(`DS_B has 2 chunks`,  countB === 2, `got ${countB}`)
    console.log()

    // ── Phase 2: Search isolation ────────────────────────────────────────────
    console.log(`Phase 2 — Search isolation`)

    const resultsA = await searchChunks(client, zeroVec(), { project: DS_A, limit: 10 })
    const resultsB = await searchChunks(client, zeroVec(), { project: DS_B, limit: 10 })
    const aIds = resultsA.map(r => r.entryId)
    const bIds = resultsB.map(r => r.entryId)

    assert(`DS_A query returns only DS_A chunks`,   resultsA.every(r => r.project === DS_A),   `projects: ${[...new Set(resultsA.map(r => r.project))].join(', ')}`)
    assert(`DS_A query returns 2 results`,          resultsA.length === 2,                      `got ${resultsA.length}`)
    assert(`DS_A query contains alpha-entry-1`,     aIds.includes('alpha-entry-1'))
    assert(`DS_A query contains alpha-entry-2`,     aIds.includes('alpha-entry-2'))
    assert(`DS_A query has NO beta entries`,        !aIds.some(id => id.startsWith('beta-')),   `found: ${aIds.filter(id => id.startsWith('beta-'))}`)

    assert(`DS_B query returns only DS_B chunks`,   resultsB.every(r => r.project === DS_B),   `projects: ${[...new Set(resultsB.map(r => r.project))].join(', ')}`)
    assert(`DS_B query returns 2 results`,          resultsB.length === 2,                      `got ${resultsB.length}`)
    assert(`DS_B query contains beta-entry-1`,      bIds.includes('beta-entry-1'))
    assert(`DS_B query contains beta-entry-2`,      bIds.includes('beta-entry-2'))
    assert(`DS_B query has NO alpha entries`,       !bIds.some(id => id.startsWith('alpha-')), `found: ${bIds.filter(id => id.startsWith('alpha-'))}`)

    // Verify both projects coexist in the table (count-based, not search-position-based,
    // since production rows can saturate a fixed-limit unfiltered search result window).
    const countBoth = await countProjectChunks(client, DS_A) + await countProjectChunks(client, DS_B)
    assert(`both test projects present in table simultaneously (count=4)`, countBoth === 4, `got ${countBoth}`)
    console.log()

    // ── Phase 3: Clear isolation ─────────────────────────────────────────────
    console.log(`Phase 3 — Clear isolation`)
    await clearProjectChunks(client, DS_A)

    const countAAfter = await countProjectChunks(client, DS_A)
    const countBAfter = await countProjectChunks(client, DS_B)
    assert(`DS_A cleared to 0 chunks`,         countAAfter === 0, `got ${countAAfter}`)
    assert(`DS_B unaffected after DS_A clear`, countBAfter === 2, `got ${countBAfter}`)

    const bAfterClear = await searchChunks(client, zeroVec(), { project: DS_B, limit: 10 })
    assert(`DS_B still searchable after DS_A clear`, bAfterClear.length === 2, `got ${bAfterClear.length}`)
    console.log()

    // ── Phase 4: Upsert idempotency ──────────────────────────────────────────
    console.log(`Phase 4 — Upsert idempotency (re-insert same entry)`)
    await upsertChunk(client, { project: DS_B, entryId: 'beta-entry-1', content: 'beta content one UPDATED', embedding: vecFor(3) })
    const countBUpsert = await countProjectChunks(client, DS_B)
    assert(`Upsert keeps count at 2 (no duplicate row)`, countBUpsert === 2, `got ${countBUpsert}`)
    const bUpserted = await searchChunks(client, zeroVec(), { project: DS_B, limit: 10 })
    const updatedEntry = bUpserted.find(r => r.entryId === 'beta-entry-1')
    assert(`Upserted entry has updated text`, updatedEntry?.content === 'beta content one UPDATED', `got: "${updatedEntry?.content}"`)
    console.log()

  } finally {
    // ── Cleanup ──────────────────────────────────────────────────────────────
    await clearProjectChunks(client, DS_A)
    await clearProjectChunks(client, DS_B)
    client.release()
    await closePgPool()
  }

  console.log(`─────────────────────────────────`)
  if (failed === 0) {
    console.log(`${GREEN}${BOLD}PASS${RESET} — ${passed} assertions, 0 failures`)
    console.log(`${DIM}Dataset isolation is confirmed: no cross-namespace contamination.${RESET}`)
  } else {
    console.log(`${RED}${BOLD}FAIL${RESET} — ${passed} passed, ${failed} failed`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(`${RED}${BOLD}Error:${RESET}`, err)
  process.exit(1)
})

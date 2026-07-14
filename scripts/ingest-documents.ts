// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * ingest-documents.ts — the **cited document-index** ingest modality (WVR-201 / KNOWLEDGE-ARCHITECTURE §4).
 *
 * Prose (business decisions/sales/strategy, ADRs, vendor/compliance docs) is NOT distilled into
 * `knowledge_entry` lessons — it is **indexed and pointed at**. This tool chunks a markdown document
 * into paragraphs, embeds each, and upserts them into `engram_chunks` as `chunk_type='document_paragraph'`.
 *
 *   - The **document stays authoritative** in git/forgejo; this index is a DERIVED, regenerable projection
 *     (WVR-202: it needs no backup of its own — re-run this tool to rebuild).
 *   - Each record carries a **stable pointer** — `doc` + `heading_path` + paragraph **content-hash** anchor
 *     (edit-stable; never line numbers, WVR-201) — so a query cites its exact source and paragraphs sharing
 *     an anchor form the cross-reference graph.
 *
 * Run against bedrock (the WBD Layer-1 db) with the client env sourced:
 *   ./scripts/with-engram-env.sh bash -c 'npx tsx scripts/ingest-documents.ts --project business docs...'
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { getPgPool, closePgPool, embedText } from '../codebase-mcp/src/utils/pgvector-embed.js'

const REPO_ROOT = '/home/mark/Projects/active/fabrick-weaver-project'
const GREEN = '\x1b[32m', DIM = '\x1b[2m', RESET = '\x1b[0m'

export interface Paragraph {
  text: string
  headingPath: string   // "Section › Subsection" — the heading stack above this paragraph
  paraIndex: number     // ordinal within the document (stable ordering, not a line number)
  anchor: string        // sha256(normalized text)[:16] — edit-stable; changes only if the text changes
}

/** Markdown → prose paragraphs, tracking the heading hierarchy. Skips fenced code, headings,
 *  and copyright/license boilerplate. A blank line ends a paragraph. */
export function chunkMarkdown(md: string): Paragraph[] {
  const headings: string[] = []
  const out: Paragraph[] = []
  let buf: string[] = []
  let inCode = false
  let idx = 0
  const flush = () => {
    const text = buf.join(' ').replace(/\s+/g, ' ').trim()
    buf = []
    if (!text || text.length < 24) return   // skip fragments (a lone "|" row, a stray word)
    if (/^(<!--\s*)?(copyright|licensed|proprietary and confidential)/i.test(text)) return
    const anchor = createHash('sha256').update(text).digest('hex').slice(0, 16)
    out.push({ text, headingPath: headings.join(' › '), paraIndex: idx++, anchor })
  }
  for (const raw of md.split('\n')) {
    if (/^\s*```/.test(raw)) { flush(); inCode = !inCode; continue }
    if (inCode) continue
    const h = /^(#{1,6})\s+(.*)$/.exec(raw)
    if (h) { flush(); const lvl = h[1].length; headings.length = lvl - 1; headings[lvl - 1] = h[2].trim(); continue }
    if (raw.trim() === '') { flush(); continue }
    buf.push(raw.trim())
  }
  flush()
  return out
}

async function ingestDoc(project: string, absPath: string): Promise<number> {
  const docRel = relative(REPO_ROOT, absPath)
  const paras = chunkMarkdown(readFileSync(absPath, 'utf8'))
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    // A doc-index is a regenerable projection: clear this doc's prior paragraphs, then re-insert.
    // (WVR-202 — deactivate/rebuild, not destroy: the authoritative document is untouched in git.)
    await client.query(
      `DELETE FROM engram_chunks WHERE project=$1 AND chunk_type='document_paragraph' AND metadata->>'doc'=$2`,
      [project, docRel],
    )
    for (const p of paras) {
      const embedding = await embedText(p.text)
      const entryId = `${docRel}::${p.anchor}`
      const metadata = { doc: docRel, heading_path: p.headingPath, anchor: p.anchor, para_index: p.paraIndex }
      await client.query(
        `INSERT INTO engram_chunks
           (project, entry_id, chunk_index, chunk_type, content, embedding, embedding_model, metadata, content_hash, created_at)
         VALUES ($1,$2,0,'document_paragraph',$3,$4::vector,'nomic-embed-text-v1.5',$5,$6,$7)
         ON CONFLICT (project, entry_id, chunk_index) DO UPDATE
           SET content=EXCLUDED.content, embedding=EXCLUDED.embedding, metadata=EXCLUDED.metadata, content_hash=EXCLUDED.content_hash`,
        [project, entryId, p.text, `[${embedding.join(',')}]`, JSON.stringify(metadata), p.anchor, Date.now()],
      )
    }
    return paras.length
  } finally {
    client.release()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const pIdx = args.indexOf('--project')
  if (pIdx === -1) { console.error('usage: ingest-documents.ts --project <name> <doc.md ...>'); process.exit(2) }
  const project = args[pIdx + 1]
  const docs = args.filter((a, i) => i !== pIdx && i !== pIdx + 1 && !a.startsWith('--'))
  if (!docs.length) { console.error('no documents given'); process.exit(2) }

  console.log(`${DIM}cited document-index → project=${project}  (chunk_type=document_paragraph)${RESET}`)
  let total = 0
  for (const doc of docs) {
    const n = await ingestDoc(project, resolve(doc))
    console.log(`  ${GREEN}✓${RESET} ${relative(REPO_ROOT, resolve(doc))} — ${n} paragraph(s)`)
    total += n
  }
  console.log(`${GREEN}✓${RESET} indexed ${total} paragraph(s) across ${docs.length} document(s)`)
  await closePgPool()
}

// Only run the ingest when executed directly (not when the chunker is imported for tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1) })
}

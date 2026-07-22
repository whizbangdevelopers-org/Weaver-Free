// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * ingest-documents.ts — the **cited document-index** ingest modality (WVR-201 / KNOWLEDGE-ARCHITECTURE §4).
 *
 * Prose (business decisions/sales/strategy, ADRs, vendor/compliance docs) is NOT distilled into
 * distilled `lesson`/`gotcha` entries — it is **indexed and pointed at**. This tool chunks a markdown
 * document into paragraphs and, per paragraph, authors a `type='document'` structured_entries source row
 * (entry_ref = `doc::anchor`, title = heading-path) and derives its vector into entry_vectors.
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
import { getPgPool, closePgPool, embedText, upsertVector } from '../codebase-mcp/src/utils/pgvector-embed.js'

const REPO_ROOT = '/home/mark/Projects/active/fabrick-weaver-project'
const GREEN = '\x1b[32m', DIM = '\x1b[2m', RESET = '\x1b[0m'
// nomic-embed's context is 2048 tokens; cap the embedded text well under it (~2 chars/token worst case,
// e.g. a dense table). The FULL paragraph is always stored as the SE body — only the text fed to the
// embedder is truncated, so the paragraph stays complete + citeable and is still recalled by its prefix.
const MAX_EMBED_CHARS = 4000

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
    // A doc-index is a regenerable projection (WVR-201/202): clear this doc's prior paragraph
    // rows — entry_vectors cascade on the structured_entries delete — then re-author + re-embed.
    // The authoritative document is untouched in git.
    await client.query(
      `DELETE FROM structured_entries
        WHERE project=$1 AND type='document' AND entry_ref LIKE $2 || '::%'`,
      [project, docRel],
    )
    let skipped = 0
    for (const p of paras) {
      const entryRef = `${docRel}::${p.anchor}`
      try {
        // Embed a bounded prefix (the model's context cap); the full text is stored as the body.
        const embedding = await embedText(p.text.slice(0, MAX_EMBED_CHARS))
        // Author the cited-document source row (WVR-201: paragraph-grain, type='document',
        // entry_ref = doc::anchor = the stable pointer, title = heading-path). content_hash is
        // DB-generated (WVR-192); paragraphs sharing a doc form the cross-reference graph.
        const seRes = await client.query<{ id: string; content_hash: string }>(
          `INSERT INTO structured_entries
             (entry_ref, layer, scope, project, type, status, title, body, source, author, approved_by)
           VALUES ($1, 'L1-dev', 'project', $2, 'document', 'active', $3, $4,
                   'document-index', 'ingest-documents', 'git-review')
           RETURNING id, content_hash`,
          [entryRef, project, p.headingPath, p.text],
        )
        const row = seRes.rows[0]!
        // Derive the vector projection off the source row (source_content_hash = SE.content_hash).
        await upsertVector(client, row.id, embedding, row.content_hash)
      } catch (e) {
        // One bad paragraph (e.g. an embed error) must never abort the whole multi-doc run.
        skipped++
        console.warn(`  ${DIM}⚠ skipped paragraph in ${docRel} (${p.anchor}): ${e instanceof Error ? e.message : String(e)}${RESET}`)
      }
    }
    return paras.length - skipped
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

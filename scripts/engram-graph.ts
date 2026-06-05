// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Engram Graph — direct Kuzu wrapper for owned entity/relationship storage.
 *
 * SEPARATE from Cognee's Kuzu DB at /var/lib/cognee/db/databases/cognee_graph_kuzu.
 * We own the schema, the dataset isolation, and the delete semantics.
 * No shared-namespace bug, no additive accumulation, no broken /forget endpoint.
 *
 * Schema:
 *   KnowledgeEntry  — knowledge registry nodes (entry_id, title, domain, type, scope, status)
 *   EntityNode      — LLM-extracted entities from chunk content (entity_id, name, type, description)
 *   RELATED_TO      — human-curated entry↔entry relationships (from related: [] YAML field)
 *   MENTIONS        — entity↔entry provenance (which entry mentions this entity)
 *   CO_OCCURS       — entity co-occurrence relationships extracted by embed+graph pipeline
 *
 * Usage (ingest script, embed+graph strategy):
 *   const g = await openEngramGraphWriter(dbPath)
 *   await g.upsertEntry({ entryId, title, domain, type, scope, status })
 *   await g.setRelations(entryId, relatedIds)   // replaces all RELATED_TO for this entry
 *   await g.upsertEntity({ entityId, name, type, description })
 *   await g.addMentions(entryId, [entityId, ...])
 *   await g.deleteEntry(entryId)
 *   g.close()
 *
 * Usage (backend stats, read-only):
 *   const g = await openEngramGraphReader(dbPath)
 *   const stats = await g.getStats()
 *   g.close()
 */

import kuzu, { type KuzuValue, type Connection, type QueryResult } from 'kuzu'
import { mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

// ── Schema ────────────────────────────────────────────────────────────────────

const SCHEMA_QUERIES = [
  `CREATE NODE TABLE IF NOT EXISTS KnowledgeEntry (
     entryId   STRING,
     title     STRING,
     domain    STRING,
     type      STRING,
     scope     STRING,
     status    STRING,
     PRIMARY KEY (entryId)
   )`,
  `CREATE NODE TABLE IF NOT EXISTS EntityNode (
     entityId    STRING,
     name        STRING,
     type        STRING,
     description STRING,
     PRIMARY KEY (entityId)
   )`,
  `CREATE REL TABLE IF NOT EXISTS RELATED_TO (FROM KnowledgeEntry TO KnowledgeEntry)`,
  `CREATE REL TABLE IF NOT EXISTS MENTIONS    (FROM KnowledgeEntry TO EntityNode)`,
  `CREATE REL TABLE IF NOT EXISTS CO_OCCURS   (FROM EntityNode TO EntityNode, weight DOUBLE)`,
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KnowledgeEntryNode {
  entryId: string
  title: string
  domain: string
  type: string
  scope: string
  status: string
  // Node records are also passed as Cypher $param maps (Record<string, unknown>).
  [key: string]: unknown
}

export interface EntityNodeRecord {
  entityId: string
  name: string
  type: string
  description: string
  [key: string]: unknown
}

export interface EngramGraphStats {
  entryNodes: number
  entityNodes: number
  relatedEdges: number
  mentionEdges: number
  coOccursEdges: number
}

export interface EngramGraphHandle {
  // Knowledge entry nodes (registry)
  upsertEntry(entry: KnowledgeEntryNode): Promise<void>
  setRelations(entryId: string, relatedIds: string[]): Promise<void>
  deleteEntry(entryId: string): Promise<void>
  clearAllEntries(): Promise<void>
  getAllEntries(): Promise<KnowledgeEntryNode[]>
  getRelations(): Promise<Array<{ fromId: string; toId: string }>>
  // Entity nodes (embed+graph extracted)
  upsertEntity(entity: EntityNodeRecord): Promise<void>
  addMentions(entryId: string, entityIds: string[]): Promise<void>
  addCoOccurrence(entityIdA: string, entityIdB: string, weight: number): Promise<void>
  // Stats
  getStats(): Promise<EngramGraphStats>
  close(): void
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// kuzu 0.11+: conn.query() accepts no params (2nd arg is progressCallback).
// Parameterized queries require conn.prepare() + conn.execute(prepared, params).
async function runQuery(conn: Connection, q: string, params?: Record<string, unknown>): Promise<void> {
  let raw: QueryResult | QueryResult[]
  if (params) {
    const prepared = await conn.prepare(q)
    raw = await conn.execute(prepared, params as unknown as Record<string, KuzuValue>)
  } else {
    raw = await conn.query(q)
  }
  const result = Array.isArray(raw) ? raw[0]! : raw
  result.close()
}

async function fetchAll<T>(conn: Connection, q: string, params?: Record<string, unknown>): Promise<T[]> {
  let raw: QueryResult | QueryResult[]
  if (params) {
    const prepared = await conn.prepare(q)
    raw = await conn.execute(prepared, params as unknown as Record<string, KuzuValue>)
  } else {
    raw = await conn.query(q)
  }
  const result = Array.isArray(raw) ? raw[0]! : raw
  const rows = await result.getAll() as T[]
  result.close()
  return rows
}

function buildHandle(conn: Connection): EngramGraphHandle {
  return {
    async upsertEntry(entry) {
      await runQuery(conn,
        `MERGE (e:KnowledgeEntry {entryId: $entryId})
         SET e.title = $title, e.domain = $domain, e.type = $type,
             e.scope = $scope, e.status = $status`,
        entry,
      )
    },

    async setRelations(entryId, relatedIds) {
      // Delete all existing outgoing RELATED_TO edges from this entry, then re-add.
      await runQuery(conn,
        `MATCH (a:KnowledgeEntry {entryId: $entryId})-[r:RELATED_TO]->() DELETE r`,
        { entryId },
      )
      for (const toId of relatedIds) {
        await runQuery(conn,
          `MATCH (a:KnowledgeEntry {entryId: $fromId}), (b:KnowledgeEntry {entryId: $toId})
           MERGE (a)-[:RELATED_TO]->(b)`,
          { fromId: entryId, toId },
        )
      }
    },

    async deleteEntry(entryId) {
      await runQuery(conn,
        `MATCH (e:KnowledgeEntry {entryId: $entryId}) DETACH DELETE e`,
        { entryId },
      )
    },

    async clearAllEntries() {
      await runQuery(conn, `MATCH (e:KnowledgeEntry) DETACH DELETE e`)
    },

    async getAllEntries() {
      type Row = { 'e.entryId': string; 'e.title': string; 'e.domain': string; 'e.type': string; 'e.scope': string; 'e.status': string }
      const rows = await fetchAll<Row>(conn,
        `MATCH (e:KnowledgeEntry) RETURN e.entryId, e.title, e.domain, e.type, e.scope, e.status`,
      )
      return rows.map((r) => ({
        entryId: r['e.entryId'],
        title: r['e.title'],
        domain: r['e.domain'],
        type: r['e.type'],
        scope: r['e.scope'],
        status: r['e.status'],
      }))
    },

    async getRelations() {
      type Row = { 'a.entryId': string; 'b.entryId': string }
      const rows = await fetchAll<Row>(conn,
        `MATCH (a:KnowledgeEntry)-[:RELATED_TO]->(b:KnowledgeEntry) RETURN a.entryId, b.entryId`,
      )
      return rows.map((r) => ({ fromId: r['a.entryId'], toId: r['b.entryId'] }))
    },

    async upsertEntity(entity) {
      await runQuery(conn,
        `MERGE (e:EntityNode {entityId: $entityId})
         SET e.name = $name, e.type = $type, e.description = $description`,
        entity,
      )
    },

    async addMentions(entryId, entityIds) {
      for (const entityId of entityIds) {
        await runQuery(conn,
          `MATCH (entry:KnowledgeEntry {entryId: $entryId}), (entity:EntityNode {entityId: $entityId})
           MERGE (entry)-[:MENTIONS]->(entity)`,
          { entryId, entityId },
        )
      }
    },

    async addCoOccurrence(entityIdA, entityIdB, weight) {
      await runQuery(conn,
        `MATCH (a:EntityNode {entityId: $entityIdA}), (b:EntityNode {entityId: $entityIdB})
         MERGE (a)-[r:CO_OCCURS]->(b) SET r.weight = $weight`,
        { entityIdA, entityIdB, weight },
      )
    },

    async getStats() {
      type CountRow = { n: bigint | number }
      const [entry, entity, related, mentions, coOccurs] = await Promise.all([
        fetchAll<CountRow>(conn, `MATCH (e:KnowledgeEntry) RETURN count(e) AS n`),
        fetchAll<CountRow>(conn, `MATCH (e:EntityNode) RETURN count(e) AS n`),
        fetchAll<CountRow>(conn, `MATCH ()-[r:RELATED_TO]->() RETURN count(r) AS n`),
        fetchAll<CountRow>(conn, `MATCH ()-[r:MENTIONS]->() RETURN count(r) AS n`),
        fetchAll<CountRow>(conn, `MATCH ()-[r:CO_OCCURS]->() RETURN count(r) AS n`),
      ])
      const n = (rows: CountRow[]) => Number(rows[0]?.n ?? 0)
      return {
        entryNodes: n(entry),
        entityNodes: n(entity),
        relatedEdges: n(related),
        mentionEdges: n(mentions),
        coOccursEdges: n(coOccurs),
      }
    },

    close() {
      conn.close?.()
    },
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Open in read-write mode; creates schema on first run. Use in ingest script. */
export async function openEngramGraphWriter(dbPath: string): Promise<EngramGraphHandle> {
  // Only create the parent directory — kuzu creates the DB path itself.
  // Pre-creating an empty directory at dbPath causes kuzu to reject it with
  // "Database path cannot be a directory" (kuzu 0.11+).
  if (!existsSync(dbPath)) mkdirSync(dirname(dbPath), { recursive: true })
  const db = new kuzu.Database(dbPath)
  const conn = new kuzu.Connection(db)
  for (const q of SCHEMA_QUERIES) {
    await runQuery(conn, q)
  }
  return buildHandle(conn)
}

/** Open in read-only mode for stat queries from the backend. */
export async function openEngramGraphReader(dbPath: string): Promise<EngramGraphHandle | null> {
  if (!existsSync(dbPath)) return null
  try {
    const db = new kuzu.Database(dbPath, 0, true)  // read-only
    const conn = new kuzu.Connection(db)
    return buildHandle(conn)
  } catch {
    return null
  }
}

export function resolveEngramGraphPath(projectRoot: string): string {
  return resolve(projectRoot, 'data', 'engram_graph_kuzu')
}

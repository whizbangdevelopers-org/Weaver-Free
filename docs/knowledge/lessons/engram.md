<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — engram

Lessons learned in the **engram** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-engram-2026-05-13-001 -->
---
id: L-engram-2026-05-13-001
type: lesson
domain: engram
tags: [strategy, pipeline, dataset, architecture]
since_version: "1.0.5"
status: active
scope: project
related: [G-engram-2026-05-12-006, G-engram-2026-05-12-001, G-engram-2026-05-12-002]
graduated_to: ""
---

## Dataset strategy registry as Engram processing architecture — 2026-05-13 · Claude

**Root cause:** Different datasets have different LLM-cost/quality tradeoffs. `project_knowledge` is human-authored structured YAML — no entity extraction needed. `fom_registry` is rich operational data — full graph cognify makes sense. Treating all datasets identically wastes cost or loses quality.

**Rule:** Declare a `DATASET_STRATEGIES` constant mapping dataset name → strategy (`embed-only` | `embed+graph` | `full-cognify`). Pipeline execution reads the strategy at runtime; switching a dataset's processing path is a one-line config change with no pipeline code change.

**Why this shape wins:** Config and execution stay decoupled. Adding a new dataset means adding one entry to the map, not forking the pipeline. The strategy enum is the extension point — not the ingest loop.

<!-- /entry -->

<!-- entry:L-engram-2026-05-13-002 -->
---
id: L-engram-2026-05-13-002
type: lesson
domain: engram
tags: [sqlite, graph, related, visualization]
since_version: "1.0.5"
status: active
scope: project
related: [G-engram-2026-05-12-004, G-engram-2026-05-12-005]
graduated_to: ""
---

## SQLite `related` column as graph edge backbone — 2026-05-13 · Claude

**Root cause:** The knowledge entry YAML already has a `related: []` field — human-authored cross-references between entries. Storing this in the SQLite `ingested_entries` table and deriving graph edges from it gives a visualization-ready graph with zero AI extraction cost and zero graph DB dependency in the backend API path.

**Rule:** When building a registry graph visualization, check whether structured metadata already captures the edge relationships before reaching for AI extraction or a graph DB. The `related` YAML field → SQLite column → `/api/engram/graph-data` endpoint pattern costs nothing at query time and makes the graph auditable.

**Why this shape wins:** The backend API serves graph data from SQLite with no Kuzu/pgvector dependency. The graph reflects human-authored intent, not probabilistic extraction. It degrades gracefully when entries have no relations (just shows isolated nodes).

<!-- /entry -->

<!-- entry:L-engram-2026-05-13-003 -->
---
id: L-engram-2026-05-13-003
type: lesson
domain: engram
tags: [graph, related, dedup, visualization, bidirectional]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-05-13-002]
graduated_to: ""
---

## Deduplicate bidirectional `related[]` edges with a canonical sorted pair key — 2026-05-13 · Claude

**Root cause:** The `related: []` YAML field is intentionally bidirectional — both linked entries list each other explicitly. When ingested into SQLite and served via `/api/engram/graph-data`, each entry's `related` array produces a directed edge, yielding two edges per relationship pair. A graph visualization renders both edges as visual double-lines between the same two nodes.

**Rule:** In the graph-data API endpoint, deduplicate bidirectional edge pairs before returning. Canonical pattern:
```typescript
const seenPairs = new Set<string>()
for (const r of rows) {
  for (const targetId of related) {
    const pairKey = [r.entry_id, targetId].sort().join('|')
    if (seenPairs.has(pairKey)) continue
    seenPairs.add(pairKey)
    edges.push({ source: r.entry_id, target: targetId })
  }
}
```

**Why this shape wins:** The `sort().join('|')` canonical key makes `(A,B)` and `(B,A)` identical regardless of which entry is processed first. The deduplication is in the API response, not in the data store — the back-links remain in SQLite and can be used for non-visual graph queries (e.g., "what links to this entry?"). 19 directed edges in data → 15 visual edges after dedup (4 bidirectional pairs collapsed).

<!-- /entry -->

<!-- entry:L-engram-2026-05-16-001 -->
---
id: L-engram-2026-05-16-001
type: lesson
domain: engram
tags: [sqlite, vm-data-dir, ingest, data-dir, production]
since_version: "1.0.5"
status: active
scope: project
related: [G-nixos-2026-05-15-001]
graduated_to: ""
---

## DB producers must follow the backend's VM_DATA_DIR path atomically — 2026-05-16 · Claude

**Root cause:** Adding `VM_DATA_DIR` support to the backend changes where `engram.db` is read from. Any script that writes to `engram.db` (the ingest pipeline) also needs `VM_DATA_DIR` support in the same change — otherwise writes land in `code/data/engram.db` while the backend reads from `$VM_DATA_DIR/engram.db`. The Monitor shows an empty registry with no error; it silently reads from a different file than the one ingest is populating.

**Rule:** When adding or changing the DB path resolution logic in the backend (`engramDataDir` in `index.ts`), update every DB producer atomically in the same PR: `code/scripts/ingest-knowledge-to-engram.ts` and any future scripts that open `engram.db`. Both must resolve path via `VM_DATA_DIR` with the same fallback.

**Why this shape wins:** The silent symptom (empty UI, no 500, no stderr) makes this the kind of bug that wastes hours. Making the path change atomic at the PR level and having a single `ENGRAM_DB_PATH` constant (shared across producers) ensures the two files can never diverge silently again.

<!-- /entry -->

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
related: []
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
related: []
graduated_to: ""
---

## SQLite `related` column as graph edge backbone — 2026-05-13 · Claude

**Root cause:** The knowledge entry YAML already has a `related: []` field — human-authored cross-references between entries. Storing this in the SQLite `ingested_entries` table and deriving graph edges from it gives a visualization-ready graph with zero AI extraction cost and zero graph DB dependency in the backend API path.

**Rule:** When building a registry graph visualization, check whether structured metadata already captures the edge relationships before reaching for AI extraction or a graph DB. The `related` YAML field → SQLite column → `/api/engram/graph-data` endpoint pattern costs nothing at query time and makes the graph auditable.

**Why this shape wins:** The backend API serves graph data from SQLite with no Kuzu/pgvector dependency. The graph reflects human-authored intent, not probabilistic extraction. It degrades gracefully when entries have no relations (just shows isolated nodes).

<!-- /entry -->

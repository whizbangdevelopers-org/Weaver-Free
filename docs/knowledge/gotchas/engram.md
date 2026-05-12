<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — engram

Known gotchas in the **engram** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-engram-2026-05-12-001 -->
---
id: G-engram-2026-05-12-001
type: gotcha
domain: engram
tags: [cognee, auth, namespaces, datasets, anonymous-user]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## REQUIRE_AUTHENTICATION=false still enforces per-user data namespaces — 2026-05-12 · Claude

**Problem:** With `REQUIRE_AUTHENTICATION=false`, it looks like Cognee runs in an open "no auth" mode. In practice, Cognee still routes every request through a user context. Unauthenticated requests get the anonymous user context (fixed UUID `5df5948b-…`); authenticated requests (Bearer token) get the token's user. These are **separate namespaces** — datasets created by unauthenticated calls are invisible to authenticated users, and vice versa. An ingest script that runs without credentials writes `project_knowledge` into the anonymous namespace. The Engram UI and CSM hooks, which both authenticate as `weaver@weaver.dev`, see an empty registry.

**Fix:** Always pass a Bearer token in scripts that create or modify Cognee datasets if those datasets need to be visible to authenticated sessions. Obtain the token via `POST /api/v1/auth/login` with `application/x-www-form-urlencoded` body (`username=`, `password=`). Unauthenticated operation is only appropriate for truly shared/anonymous data.

**Rule:** Cognee's `REQUIRE_AUTHENTICATION=false` disables login enforcement — it does NOT merge namespaces. Treat it as "auth optional," not "auth off." Any dataset that must be visible to an authenticated user must be created by an authenticated caller.

<!-- /entry -->

<!-- entry:G-engram-2026-05-12-002 -->
---
id: G-engram-2026-05-12-002
type: gotcha
domain: engram
tags: [cognee, cognify, async, fetch, pipeline-runs]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## cognify is fire-and-forget — Node.js fetch failure ≠ pipeline failure — 2026-05-12 · Claude

**Problem:** `POST /api/v1/cognify` starts the knowledge graph pipeline asynchronously and returns immediately with `{"status": "PipelineRunStarted", ...}`. Node.js's `fetch()` may throw `TypeError: fetch failed` (connection reset/dropped) even when the response was sent and the pipeline is running correctly server-side. The pipeline_run_id in Cognee service logs (`run_tasks_with_telemetry` context) is a DIFFERENT UUID from the `pipeline_run_id` in the `/api/v1/activity/pipeline-runs` table — they are separate tracking mechanisms and cannot be correlated by ID.

**Fix:** Verify cognify completion via `GET /api/v1/activity/pipeline-runs` (filter by `pipeline_name == "cognify_pipeline"` and check for `DATASET_PROCESSING_COMPLETED`), not by the HTTP response status. A `TypeError: fetch failed` from cognify should be treated as "uncertain, check pipeline-runs" rather than "definitely failed." If the pipeline-runs table still shows `STARTED` after several minutes, THEN consider it failed.

**Rule:** Cognify completion is an async event, not an HTTP response. Always poll `pipeline-runs` to confirm — never rely on the fetch response alone.

<!-- /entry -->

<!-- entry:G-engram-2026-05-12-003 -->
---
id: G-engram-2026-05-12-003
type: gotcha
domain: engram
tags: [cognee, forget, dataset-delete, graph-nodes, postgresql]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## POST /api/v1/forget always fails for dataset-level deletion; use DELETE /api/v1/datasets/{id} — 2026-05-12 · Claude

**Problem:** `POST /api/v1/forget` with `{ dataset: "name" }` (the documented way to delete an entire dataset) always returns `500 {"error":"An error occurred during deletion."}` in Cognee 1.0.3. Code that treats this error as "not found / already gone" will silently succeed while leaving all extracted graph nodes intact. Subsequent cognify runs then accumulate nodes on top of the old ones.

**Fix:** Use `GET /api/v1/datasets` to find the dataset UUID by name, then `DELETE /api/v1/datasets/{id}`. This endpoint removes the dataset record AND its relational ownership records. **Important:** Cognee returns 403 (Permission Denied) even on a completely successful deletion — treat 200, 403, and 404 all as success. Only non-403/404 error codes should be treated as failure. **Caveat:** see G-engram-2026-05-12-005 — graph nodes from OTHER datasets (e.g., CSM runs under a different dataset ID) that happened to share the same Kuzu graph_db are NOT cleaned up by this endpoint.

**Rule:** For full dataset + graph reset: look up UUID → `DELETE /api/v1/datasets/{id}`, tolerating 403. Never use `POST /api/v1/forget` for dataset-level cleanup — it is broken in Cognee 1.0.3. For a truly clean graph, see G-engram-2026-05-12-005.

<!-- /entry -->

<!-- entry:G-engram-2026-05-12-004 -->
---
id: G-engram-2026-05-12-004
type: gotcha
domain: engram
tags: [cognee, cognify, graph-nodes, accumulation, idempotency]
since_version: "1.0.5"
status: active
scope: project
related: [G-engram-2026-05-12-003]
graduated_to: ""
---

## cognify is additive — repeated runs accumulate graph nodes — 2026-05-12 · Claude

**Problem:** Running `POST /api/v1/cognify` multiple times on the same dataset does NOT replace the graph — it adds to it. After 6 cognify runs on 16 entries, the graph had 1231 nodes instead of ~200. Cognee's graph store (PostgreSQL) has no built-in "replace" mode for cognify; each run extracts entities and relationships from the current documents and writes them as new rows.

**Fix:** Before re-ingesting (e.g., `--force-reset`), fully delete the dataset using `DELETE /api/v1/datasets/{id}` (see G-engram-2026-05-12-003). This is the only reliable way to return to a clean graph state. The normal incremental path (add/forget individual entries) is fine since it doesn't re-cognify unchanged documents.

**Rule:** Treat cognify results as append-only. If you need a clean graph, delete the dataset first — don't just re-run cognify.

<!-- /entry -->

<!-- entry:G-engram-2026-05-12-005 -->
---
id: G-engram-2026-05-12-005
type: gotcha
domain: engram
tags: [cognee, kuzu, graph-db, orphaned-nodes, cleanup]
since_version: "1.0.5"
status: active
scope: project
related: [G-engram-2026-05-12-003, G-engram-2026-05-12-004]
graduated_to: ""
---

## Cognee API deletion does NOT clean up Kuzu graph_db — orphaned nodes require manual file removal — 2026-05-12 · Claude

**Problem:** With `ENABLE_BACKEND_ACCESS_CONTROL=false` (the NixOS service default), Cognee uses a single shared Kuzu graph database at `/var/lib/cognee/db/databases/cognee_graph_kuzu` for ALL datasets. `GET /api/v1/datasets/{id}/graph` returns ALL nodes in this shared Kuzu DB, not just the queried dataset's nodes. When datasets are deleted via `DELETE /api/v1/datasets/{id}` or `DELETE /api/v1/datasets` (all), Cognee's `get_global_dataset_related_nodes()` only removes nodes that have matching relational ownership records AND are not shared with other datasets. Nodes written by OTHER datasets (e.g., CSM auto-capture runs under the anonymous user or `__probe__` dataset) survive in the Kuzu graph_db indefinitely, appearing as "orphaned" nodes when any subsequent graph query is made. Confirmed: 747 orphaned CSM nodes persisted through all API deletions including `DELETE /api/v1/datasets` (all).

**Fix:** The only reliable way to clear orphaned Kuzu graph nodes is direct file system access:
```bash
sudo systemctl stop cognee.service
sudo rm -rf /var/lib/cognee/db/databases/cognee_graph_kuzu
sudo rm -f /var/lib/cognee/db/databases/cognee_db*
sudo systemctl start cognee.service
```
This wipes both the Kuzu graph and the relational SQLite DB (dataset/node ownership records), giving a completely fresh Cognee state. After restart, re-run `npm run engram:ingest-knowledge -- --force-reset` to rebuild the knowledge graph cleanly.

**Rule:** If the graph node count looks wrong (hundreds of nodes for a small knowledge base), the graph_db has orphaned CSM nodes. The API cannot fix it — only the 4-command manual wipe above will. Mark the Kuzu path in NixOS runbooks so the correct wipe path is known for future sessions.

<!-- /entry -->

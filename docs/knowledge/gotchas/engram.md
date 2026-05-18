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
related: [L-engram-2026-05-13-001]
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

<!-- entry:G-engram-2026-05-12-006 -->
---
id: G-engram-2026-05-12-006
type: gotcha
domain: engram
tags: [cognee, instructor, llama-cpp, json-schema-mode, structured-output]
since_version: "1.0.5"
status: active
scope: project
related: [L-engram-2026-05-13-001]
graduated_to: ""
---

## instructor.Mode.JSON fails with llama-3.1-8b — model returns schema description instead of instance — 2026-05-12 · Claude

**Problem:** With `LLM_PROVIDER=llama_cpp` and the default `instructor.Mode.JSON`, Cognee sends `response_format={"type":"json_object"}` and embeds the Pydantic model's JSON schema in the system prompt. llama-3.1-8b-instruct confuses "describe the schema" with "fill in the schema" — it returns the schema structure itself (with `"properties"`, `"required"`, `"title"`, `"type": "object"` keys) instead of a JSON instance conforming to it. This causes Pydantic validation errors: `1 validation error for SummarizedContent; summary Field required`. The cognify pipeline errored for all documents except the first, leaving pgvector nearly empty (1 doc/chunk/summary for a 19-entry knowledge base) and the knowledge graph useless.

**Fix:** Set `LLM_INSTRUCTOR_MODE=json_schema_mode` in the Cognee service environment (`cognee.nix`). This selects `instructor.Mode.JSON_SCHEMA`, which sends `response_format={"type":"json_schema","json_schema":{...}}` — triggering llama-server's grammar-constrained token generation. The model is physically prevented from emitting tokens that violate the JSON schema, making structured output reliable regardless of the model's instruction-following quality.

**Rule:** `instructor.Mode.JSON` (default) is unreliable for structured output extraction with local llama models that follow instructions loosely. Use `LLM_INSTRUCTOR_MODE=json_schema_mode` for any llama-cpp server deployment. After changing, rebuild the Cognee service (`sudo nixos-rebuild switch`) and re-run `npm run engram:ingest-knowledge -- --force-reset` to clear the partially-processed data.

<!-- /entry -->

<!-- entry:G-engram-2026-05-12-007 -->
---
id: G-engram-2026-05-12-007
type: gotcha
domain: engram
tags: [cognee, pipeline-runs, table-cap, stale-state, polling]
since_version: "1.0.5"
status: active
scope: project
related: [G-engram-2026-05-12-002]
graduated_to: ""
---

## pipeline-runs 50-row cap hides terminal events — STARTED looks like "still running" — 2026-05-12 · Claude

**Problem:** `GET /api/v1/activity/pipeline-runs` returns at most 50 rows, newest-first. A single `npm run engram:ingest-knowledge` run writes ~60 add_pipeline events (3 rows × 19 entries). After those events, the cognify_pipeline STARTED event remains visible but its COMPLETED or ERRORED terminal event has been pushed off the end of the table. Any code that checks `status == "STARTED"` and treats it as "currently running" will poll indefinitely (up to the 45-minute timeout) for a pipeline that already finished.

**Fix:** Check the `created_at` timestamp of the STARTED event. If the event is older than the poll timeout (45 min), it is definitionally stale — the pipeline finished but its terminal event is off-table. Fall through to start a fresh cognify run. Implemented in `cognifyDataset()` in `scripts/ingest-knowledge-to-engram.ts`.

**Rule:** Never trust `DATASET_PROCESSING_STARTED` as proof that a pipeline is currently running. Always compare `created_at` to the poll timeout. The 50-row cap is a hard Cognee limit and cannot be configured away.

<!-- /entry -->

<!-- entry:G-engram-2026-05-13-001 -->
---
id: G-engram-2026-05-13-001
type: gotcha
domain: engram
tags: [kuzu, parameterized-queries, api-change, prepare-execute]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## kuzu 0.11+: conn.query() second argument is progressCallback, not params — 2026-05-13 · Claude

**Problem:** In kuzu ≤ 0.10.x, `conn.query(statement, params)` accepted a plain object of query parameters. In kuzu 0.11+, the signature changed to `conn.query(statement, progressCallback?)` — the second argument is an optional callback function. Passing a params object as the second argument causes kuzu to validate it as a function: `Error: progressCallback must be a function`. All parameterized cypher queries silently fail at runtime, with no compile-time warning (the TypeScript types correctly reflect the new signature, but callers using the old pattern don't notice until tested).

**Fix:** Use the two-step prepare/execute API for all parameterized queries:
```typescript
const prepared = await conn.prepare(statement)
const result = await conn.execute(prepared, params as unknown as Record<string, KuzuValue>)
```
Unparam queries (no variables) can still use `conn.query(statement)` directly.

**Rule:** With kuzu 0.11+, never pass params to `conn.query()`. Always use `conn.prepare()` + `conn.execute(prepared, params)` for any statement containing `$varName` placeholders.

<!-- /entry -->

<!-- entry:G-engram-2026-05-13-002 -->
---
id: G-engram-2026-05-13-002
type: gotcha
domain: engram
tags: [kuzu, database-init, directory, empty-dir]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## kuzu 0.11+: pre-creating an empty directory at the DB path causes "cannot be a directory" — 2026-05-13 · Claude

**Problem:** Calling `mkdirSync(dbPath, { recursive: true })` before `new kuzu.Database(dbPath)` causes `Error: Runtime exception: Database path cannot be a directory: <path>`. Kuzu 0.11+ requires that it creates and owns the DB path itself. An empty directory at that path is rejected — but an existing kuzu-owned directory (from a prior session) is accepted. The failure mode is non-obvious because creating directories before opening files is a standard defensive pattern.

**Fix:** Create only the PARENT directory; let kuzu create the DB path itself on first open:
```typescript
if (!existsSync(dbPath)) mkdirSync(dirname(dbPath), { recursive: true })
const db = new kuzu.Database(dbPath)
```
On subsequent opens (kuzu directory already exists), no `mkdirSync` call is needed and kuzu opens the directory cleanly.

**Rule:** Never pre-create the directory you pass to `new kuzu.Database(dbPath)`. Only ensure the parent directory exists. This applies on first run; subsequent runs where kuzu already owns the path are unaffected.

<!-- /entry -->

<!-- entry:G-engram-2026-05-18-001 -->
---
id: G-engram-2026-05-18-001
type: gotcha
domain: engram
tags: [ingest, vm-data-dir, engram-db, llgd]
since_version: "1.0.5"
status: active
scope: project
related: ["G-devops-2026-05-18-003"]
graduated_to: ""
---

## `ingestion_runs` in dev db look "automatic" but are all from llgd Step 4 — 2026-05-18 · Claude

**Problem:** `code/data/engram.db` accumulates `ingestion_runs` rows during Claude sessions on king even though no cron or systemd timer runs the ingest script. Investigating shows runs at consistent intervals (aligning with session activity) with entry counts that grow by 1–2 per run. This looks like a scheduled auto-ingest but is not.

**Root cause:** `ingest-knowledge-to-engram.ts` resolves its db path as `VM_DATA_DIR + /engram.db` when set, else `code/data/engram.db`. The `llgd` skill always runs this script in Step 4 (after writing entries) without `VM_DATA_DIR`. So every `llgd` invocation from any Claude Code session running in the fabrick-weaver-project directory on king writes an `ingestion_runs` row to the dev db.

**Rule:** When investigating unexpected `ingestion_runs` entries in `code/data/engram.db` on king: count the llgd invocations from recent sessions first. If the run count matches, there is no runaway process. Production ingest runs use `VM_DATA_DIR=/var/lib/weaver` and appear only in `/var/lib/weaver/engram.db`.

<!-- /entry -->

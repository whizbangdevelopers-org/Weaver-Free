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

<!-- entry:G-engram-2026-06-02-001 -->
---
id: G-engram-2026-06-02-001
type: gotcha
domain: engram
tags: [ollama, keep-alive, cold-load, pipeline, llama-server, latency]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-001]
graduated_to: ""
---

## Ollama keep_alive auto-unload introduces repeated cold-load latency in pipeline inference — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-03)

**Problem:** Ollama unloads models from memory after `keep_alive` (default 5 min). A pipeline making sequential inference calls — Cognee entity extraction over a batch of documents, an agent processing a queue — cold-loads the model on every call that follows a quiet window. Cold-load is seconds per occurrence. It accumulates invisibly: the pipeline appears to work, but wall-clock time is dominated by model loading, not inference.

**Fix:** Use llama-server (llama.cpp) with `--mlock` for pipeline workloads. `--mlock` pins the model in RAM for the process lifetime — no eviction, no cold-load. llama-server exposes an OpenAI-compatible API (`/v1/chat/completions`), so Cognee, Open WebUI, and any OpenAI-compatible client point at it with no code changes.

**Rule:** If inference calls are sequential and inter-call latency matters, use llama-server with `--mlock`. Ollama's auto-unload is a UX feature for interactive use and a performance cliff for pipeline use. The symptom is hard to notice — individual calls succeed, but aggregate throughput is far below the model/hardware capability.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-002 -->
---
id: G-engram-2026-06-02-002
type: gotcha
domain: engram
tags: [cognee, auth, env-vars, 401, flags]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-002, G-engram-2026-05-12-001]
graduated_to: ""
---

## ENABLE_BACKEND_ACCESS_CONTROL=false alone does not disable Cognee auth — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Problem:** Setting only `ENABLE_BACKEND_ACCESS_CONTROL=false` in a Cognee NixOS service still returns 401 on all API calls. The effective auth check is an OR of two independent env vars, both defaulting to `true`:
```python
REQUIRE_AUTHENTICATION = (
    os.getenv("REQUIRE_AUTHENTICATION", "true").lower() == "true"
    or os.environ.get("ENABLE_BACKEND_ACCESS_CONTROL", "true").lower() == "true"
)
```
One flag cannot override the other.

**Fix:** Set both `REQUIRE_AUTHENTICATION=false` and `ENABLE_BACKEND_ACCESS_CONTROL=false` in the NixOS service environment block.

**Rule:** Cognee auth is two independent flags ORed together. Always set both to `false` for a local unauthenticated sidecar. (This disables route-level access control only — it does NOT merge per-user dataset namespaces; see G-engram-2026-05-12-001.)

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-003 -->
---
id: G-engram-2026-06-02-003
type: gotcha
domain: engram
tags: [cognee, anthropic, instructor, connection-test, timeout, startup]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-003]
graduated_to: ""
---

## Cognee LLM connection test times out with Anthropic provider — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Problem:** Cognee's startup connection test logs a `TimeoutError` when using Anthropic. The test calls the LLM adapter with `response_model=str` (a Python primitive). `instructor` in `anthropic_tools` mode retries indefinitely on incomplete output (`stop_after_delay(128)`, `wait_exponential_jitter(8,128)`) until the outer `asyncio.wait_for(30s)` fires. The real API key and network are fine — only the test is broken.

**Fix:** Set `COGNEE_SKIP_CONNECTION_TEST=true`. The actual cognify pipeline uses proper pydantic models and works correctly.

**Rule:** On Anthropic + NixOS Cognee deployments, `COGNEE_SKIP_CONNECTION_TEST=true` must be set. Do not diagnose API-key or network issues from this error alone.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-004 -->
---
id: G-engram-2026-06-02-004
type: gotcha
domain: engram
tags: [cognee, telemetry, nix-store, erofs, read-only]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## Cognee telemetry writes to Nix store (EROFS) — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Problem:** On startup Cognee logs: `Could not create or read anonymous id file: [Errno 30] Read-only file system: '.../site-packages/.anon_id'`. The telemetry module computes the `.anon_id` path relative to `__file__` (site-packages in the Nix store), which is read-only.

**Fix:** Set `TELEMETRY_DISABLED=true` in the service environment. The telemetry function returns early before calling `get_anonymous_id()`.

**Rule:** On any NixOS Cognee deployment, `TELEMETRY_DISABLED=true` is required, not optional — the Nix store is always read-only.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-005 -->
---
id: G-engram-2026-06-02-005
type: gotcha
domain: engram
tags: [cognee, login, oauth2, form-encoded, auth]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Cognee login requires form-encoded body, not JSON — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Problem:** `POST /api/v1/auth/jwt/login` with `Content-Type: application/json` and `{"username":..., "password":...}` returns `LOGIN_BAD_CREDENTIALS` even with correct credentials.

**Fix:** Use `Content-Type: application/x-www-form-urlencoded` with body `username=<email>&password=<pass>`. This is OAuth2 password flow, not a JSON API.

**Rule:** Cognee login is OAuth2 password grant. Always send credentials as form-encoded, not JSON.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-006 -->
---
id: G-engram-2026-06-02-006
type: gotcha
domain: engram
tags: [cognee, fastapi-users, jwt, users-me, health-check]
since_version: "1.0.5"
status: active
scope: project
related: [G-engram-2026-06-02-002]
graduated_to: ""
---

## /api/v1/users/me always requires JWT regardless of auth flags — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Problem:** Even with `REQUIRE_AUTHENTICATION=false` and `ENABLE_BACKEND_ACCESS_CONTROL=false`, `GET /api/v1/users/me` still returns 401. This route is registered by fastapi-users directly and uses its own auth dependency that ignores the Cognee env flags.

**Fix:** Do not use `/api/v1/users/me` for unauthenticated health checks or session probing. Use `/api/v1/health` or any Cognee-specific route that respects the `optional=True` auth dependency.

**Rule:** fastapi-users native routes (`/users/me`, `/users/{id}`) always require a real JWT. The Cognee auth flags only affect routes using Cognee's custom `get_authenticated_user` dependency.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-007 -->
---
id: G-engram-2026-06-02-007
type: gotcha
domain: engram
tags: [cognee, max-tokens, rate-limit, 429, anthropic]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-004]
graduated_to: ""
---

## Cognee max_tokens above org rate limit → every request fails with 429 — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Setting `LLM_ARGS='{"max_tokens": 16384}'` causes every `extract_graph_and_summarize` LLM call to fail immediately with `429 rate_limit_error: This request would exceed your organization's rate limit of 8,000 output tokens per minute`. Zero calls succeed; the cognify pipeline produces no graph.

**Fix:** Set `max_tokens` below the org's output-token-per-minute ceiling. For graph extraction (entity/relationship JSON), 1024 is sufficient. At 1024, ~7 requests can be in-flight before hitting an 8000-token/minute limit.

**Rule:** Anthropic reserves `max_tokens` capacity per request at submission time. A value exceeding the per-minute ceiling means every request is rejected before a token is generated. Never set `max_tokens` to the model's architectural maximum for rate-limited deployments.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-008 -->
---
id: G-engram-2026-06-02-008
type: gotcha
domain: engram
tags: [cognee, rate-limit, litellm, burst, concurrency]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-005, G-engram-2026-06-02-007]
graduated_to: ""
---

## Cognee rate limiter does not prevent burst dispatch — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Setting `LLM_RATE_LIMIT_REQUESTS=10` and `LLM_RATE_LIMIT_INTERVAL=60` does not prevent all document chunks from launching simultaneous `extract_graph_and_summarize` coroutines. The rate limiter queues litellm API calls, but the coroutines are already dispatched; the first burst still saturates the API before the queue can space them out.

**Fix:** Combine the rate limiter with a low enough `max_tokens` that each call fits within the per-minute token budget individually, and pass `chunks_per_batch` on the cognify call to bound concurrency. The rate limiter then serves as a throughput governor rather than a concurrency guard.

**Rule:** Cognee's `LLM_RATE_LIMIT_*` env vars are a litellm-layer throttle, not a task-dispatch throttle. Treat them as best-effort rate smoothing, not a hard concurrency cap.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-009 -->
---
id: G-engram-2026-06-02-009
type: gotcha
domain: engram
tags: [cognee, max-tokens, truncation, graph-extraction, retry]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-007, G-engram-2026-06-02-014]
graduated_to: ""
---

## Cognee max_tokens=1024 truncates graph extraction on large document chunks — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Large documents are split into chunks of ~7000 input tokens each. The KnowledgeGraph entity/relationship extraction output for these chunks exceeds 1024 tokens. Cognee hits `stop_reason='max_tokens'`, instructor sees an incomplete ToolUseBlock with `input={}`, and retries — burning another request against the rate limit for a chunk that will truncate again.

**Fix:** Either (a) raise `max_tokens` to 4096 (but this halves throughput at an 8000-output-token/min limit), or (b) don't seed very large files — they saturate both input and output rate limits across hundreds of chunks. Files already served by dedicated MCP tools (`getDecisions`, `getLessonsLearned`, `getKnownGotchas`) should be excluded from the Cognee seed entirely.

**Rule:** Cognee graph extraction suits small-to-medium docs (10–50 KB). Seeding 100–600 KB files generates 50–200+ chunks per file; at ~7000 input tokens per chunk and a 30,000 input-token/minute org limit, a single large file alone can saturate the API budget.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-010 -->
---
id: G-engram-2026-06-02-010
type: gotcha
domain: engram
tags: [cognee, seed, mcp-tools, large-files, strategy]
since_version: "1.0.5"
status: active
scope: project
related: [G-engram-2026-06-02-009]
graduated_to: ""
---

## Cognee seed: large MCP-served files belong in tools, not in Cognee — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** MASTER-PLAN.md (~600 KB), LESSONS-LEARNED.md (~150 KB), and KNOWN-GOTCHAS.md (~100 KB) are already served by structured MCP tools (`getDecisions`, `getLessonsLearned`, `getKnownGotchas`) that parse them from disk with section filtering. Adding them to the Cognee seed generates hundreds of chunks, saturates rate limits, and adds no semantic-search value the tool doesn't already provide.

**Fix:** Exclude files with dedicated MCP tool coverage from the Cognee seed. Seed only files that lack a dedicated tool and are small enough to process in a reasonable number of chunks — strategic planning docs (10–30 KB each) are the right target.

**Rule:** Cognee semantic search complements structured tool access; it doesn't replace it. If a file already has a dedicated MCP tool, leave it out of the Cognee seed.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-011 -->
---
id: G-engram-2026-06-02-011
type: gotcha
domain: engram
tags: [cognee, chunk-strategy, paragraph, chunk-size, embedding]
since_version: "1.0.5"
status: active
scope: project
related: [G-engram-2026-06-02-015]
graduated_to: ""
---

## Cognee PARAGRAPH chunk strategy ignores chunk_size for large paragraphs — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Setting `CHUNK_SIZE=500` and `CHUNK_STRATEGY=paragraph` (default) does nothing to reduce chunk size for documents with large paragraphs. Dense technical docs have 1500–7000+ character paragraphs; the PARAGRAPH strategy respects the paragraph boundary regardless of `chunk_size`, producing chunks larger than the setting — 1700+ token inputs to `extract_graph_and_summarize` that exceed the `max_tokens` budget even at 2048.

**Fix:** Set `CHUNK_STRATEGY=exact`. The EXACT strategy splits strictly at `chunk_size` characters regardless of paragraph structure. Each 500-char chunk produces a ~125-token input, well within the extraction budget. (Note: for the web API pipeline these CLI vars are ignored entirely — see G-engram-2026-06-02-015.)

**Rule:** `CHUNK_STRATEGY=exact` is required when seeding dense technical markdown via the CLI path. `CHUNK_STRATEGY=paragraph` suits only prose documents with short paragraphs.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-012 -->
---
id: G-engram-2026-06-02-012
type: gotcha
domain: engram
tags: [cognee, litellm, embedding, dimensions, drop-params, 422]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-006]
graduated_to: ""
---

## Cognee / litellm: `dimensions` parameter rejected for local embedding models — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** With `EMBEDDING_PROVIDER=litellm`, `EMBEDDING_MODEL=openai/nomic-embed-text`, and `EMBEDDING_DIMENSIONS=768`, Cognee sends `dimensions=768` in the litellm embedding call. litellm validates this against the model and raises `UnsupportedParamsError: Setting dimensions is not supported for OpenAI text-embedding-3 and later models` — without making the HTTP call. Every embed attempt fails with 422.

**Root cause:** litellm checks whether `dimensions` is supported for the model family. For `openai/` prefix models, only `text-embedding-3-small` and `text-embedding-3-large` may pass `dimensions`. Local llama-server models registered under `openai/` fail the check.

**Fix:** Set `LITELLM_DROP_PARAMS=true` in the service environment. litellm silently drops unsupported parameters rather than raising. `EMBEDDING_DIMENSIONS` still correctly configures LanceDB's vector table schema — only the redundant `dimensions` kwarg is dropped.

**Rule:** Any local embedding sidecar behind an `openai/` litellm prefix requires `LITELLM_DROP_PARAMS=true`. The sidecar always returns its native dimensionality regardless of the `dimensions` parameter.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-013 -->
---
id: G-engram-2026-06-02-013
type: gotcha
domain: engram
tags: [cognee, db-wipe, alembic, sqlite, recovery, register]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## Cognee DB wipe recovery: alembic raises NoSuchTableError on blank database — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Wiping Cognee's data directories removes the SQLite database. On the next start, alembic's `ab7e313804ae_permission_system_rework.py` migration queries for existing tables (`acls`, `principals`) and raises `sqlalchemy.exc.OperationalError: no such table: acls` because they don't exist yet.

**Fix:** The error is non-fatal — Cognee catches it and falls back to `create_all`, creating the full schema from scratch. The service starts normally. After a wipe the user account is also gone; re-register with `POST /api/v1/auth/register {"email":"...","password":"..."}` before seeding.

**Rule:** After a data wipe, ignore the alembic NoSuchTableError in the logs — it is cosmetic. Wait for "startup migration completed" before seeding. The seed script handles registration automatically via `register()` (409 = already exists, safe to ignore).

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-014 -->
---
id: G-engram-2026-06-02-014
type: gotcha
domain: engram
tags: [cognee, knowledge-graph, max-tokens, chunks-search, graph-completion]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-007, G-engram-2026-06-02-009]
graduated_to: ""
---

## Cognee KnowledgeGraph JSON consistently exceeds 2048 tokens — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Even with `CHUNK_SIZE=500` and `CHUNK_STRATEGY=exact`, `extract_graph_and_summarize` produces KnowledgeGraph JSON (entities + relationships) exceeding 2048 output tokens for most real technical chunks. The extraction prompt itself is ~3000 input tokens; a 500-char chunk produces 26+ entities, which cannot serialize into under 2048 tokens. instructor retries with doubled `max_tokens` (2048→4096) — still truncated. Both generations fail and the data item is marked failed.

**Fix:** Graph extraction cannot reliably complete with Anthropic models at max_tokens≤4096 for technical documents. Use CHUNKS search type (LanceDB embeddings) instead of GRAPH_COMPLETION for `cogRecall`. Embeddings are produced independently and don't require graph extraction to succeed; `cogRecall` defaults to CHUNKS for this reason.

**Rule:** Cognee's GRAPH_COMPLETION search requires successful graph extraction. For Anthropic-backed instances on technical documentation, CHUNKS is the reliable search type. GRAPH_COMPLETION requires either a model with a higher output budget (local llama-server) or documents short enough that KnowledgeGraph JSON fits in 2048 tokens.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-015 -->
---
id: G-engram-2026-06-02-015
type: gotcha
domain: engram
tags: [cognee, chunk-size, web-api, embedding-max-completion-tokens, cli]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-008, G-engram-2026-06-02-016]
graduated_to: ""
---

## Cognee CHUNK_SIZE/CHUNK_STRATEGY only affect the CLI, not the Web API — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Setting `CHUNK_SIZE=500` and `CHUNK_STRATEGY=exact` in a Cognee NixOS service has zero effect on the web API cognify pipeline. These env vars are read by `ChunkConfig`, which is only instantiated by the CLI code path. The API pipeline builds tasks using `get_max_chunk_tokens()` from `embedding_engine.max_completion_tokens` (set by `EMBEDDING_MAX_COMPLETION_TOKENS`). The default is 8191 chars — far too large for a local embedding sidecar.

**Fix:** Remove `CHUNK_SIZE` and `CHUNK_STRATEGY` from the NixOS service config. Set `EMBEDDING_MAX_COMPLETION_TOKENS` to the desired chunk size in characters. A value of 2048 gives ~512 tokens per chunk; with `EMBEDDING_BATCH_SIZE=4` that's 4 × 512 = 2048 tokens per embedding batch — safe within llama-server `--batch-size 2048`.

**Rule:** For API cognify, `EMBEDDING_MAX_COMPLETION_TOKENS` controls chunk size. `CHUNK_SIZE` and `CHUNK_STRATEGY` are silently ignored.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-016 -->
---
id: G-engram-2026-06-02-016
type: gotcha
domain: engram
tags: [cognee, embedding, batch-size, llama-server, chunk-size]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-06-02-015]
graduated_to: ""
---

## Cognee default chunk size overflows llama-server batch budget — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Without `EMBEDDING_MAX_COMPLETION_TOKENS`, `get_max_chunk_tokens()` returns `min(8191, llm_max_completion_tokens // 2) = 8191` chars per chunk. With `EMBEDDING_BATCH_SIZE=4`, that's 4 × ~2000 tokens = ~8000 tokens per embedding request — well over llama-server's `--batch-size 2048`. The embedding call fails: `"Error: Input is too large to process. Please increase the physical batch size."` The entire `add_data_points` task fails; no vectors are written to LanceDB.

**Fix:** Set `EMBEDDING_MAX_COMPLETION_TOKENS=2048`. With `EMBEDDING_BATCH_SIZE=4` this gives 4 × ~512 tokens = ~2048 tokens per llama-server request, exactly within the batch budget. For more headroom use `EMBEDDING_BATCH_SIZE=2`.

**Rule:** Any Cognee deployment using a local llama-server embedding sidecar must set `EMBEDDING_MAX_COMPLETION_TOKENS` explicitly. Never rely on the 8191-char default with a batch-constrained local server.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-017 -->
---
id: G-engram-2026-06-02-017
type: gotcha
domain: engram
tags: [cognee, incremental-loading, pipeline-run-id, stuck, wipe]
since_version: "1.0.5"
status: active
scope: project
related: [G-engram-2026-06-02-028]
graduated_to: ""
---

## Cognee stuck pipeline: incremental_loading returns same pipeline_run_id after failure — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** If the cognify pipeline fails mid-run (e.g., an embedding connection error crashes `add_data_points`), subsequent `POST /api/v1/cognify` calls return the same `pipeline_run_id` as the failed run without starting new work. The system appears to start (`PipelineRunStarted`) but the same ID repeats and no new tasks are logged.

**Root cause:** Cognee's `incremental_loading=True` (default) skips documents that have database state from a prior run — even a failed one. The partial state blocks a clean re-run.

**Fix:** Wipe the database directories and restart the service before re-seeding:
```bash
sudo systemctl stop cognee.service
sudo rm -rf /var/lib/cognee/data /var/lib/cognee/db /var/lib/cognee/cache
sudo systemd-tmpfiles --create --prefix=/var/lib/cognee
sudo systemctl start cognee.service
```
A fresh `pipeline_run_id` (different UUID) on the next cognify call confirms the wipe succeeded.

**Rule:** After any cognify pipeline failure, wipe the database before re-seeding. A successful re-seed is confirmed by "Registered new user account" in the seed output (the previous account was wiped).

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-018 -->
---
id: G-engram-2026-06-02-018
type: gotcha
domain: engram
tags: [cognee, instructor-retry, large-docs, max-tokens, seed-size]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-007, G-engram-2026-06-02-014]
graduated_to: ""
---

## Cognee large documents cause InstructorRetryException at max_tokens=4096 — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Documents over ~15 KB (e.g., a 55 KB plan with 63+ entities) cause `InstructorRetryException` during `extract_graph_and_summarize`. instructor doubles `max_tokens` on `IncompleteOutputException` (4096→8192); if the full KnowledgeGraph JSON still doesn't fit in 8192 output tokens, instructor exhausts its retries and raises. The data item is marked failed and all API credits consumed by retries are wasted.

**Root cause:** `extract_graph_and_summarize` expects a complete `KnowledgeGraph` JSON per chunk. For large dense chunks, even 8192 output tokens can be insufficient. 8192 is Haiku 4.5's effective output maximum after instructor's doubling.

**Fix:** Exclude documents too large for the seed. Keep individual seed files under ~10 KB to stay within the graph-extraction budget. Larger files should have dedicated MCP tools instead.

**Rule:** The practical size limit for Cognee seed files with Haiku 4.5 + `max_tokens=4096` is ~10 KB per file. Beyond that, `InstructorRetryException` risk grows sharply. If a file must be included, split it first.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-019 -->
---
id: G-engram-2026-06-02-019
type: gotcha
domain: engram
tags: [next-js, nix, buildnpmpackage, env-vars, cognee-frontend]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## `NEXT_PUBLIC_*` env var names must be verified from source — never guessed — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Problem:** Setting `NEXT_PUBLIC_BACKEND_API_URL` in a `buildNpmPackage` derivation for the Cognee frontend has no effect. The built bundle still hardcodes `localhost:8000`.

**Root cause:** The actual env var used by Cognee's frontend is `NEXT_PUBLIC_LOCAL_API_URL`. Additionally, Cognee defaults to cloud mode — local API calls are only enabled when `NEXT_PUBLIC_IS_CLOUD_ENVIRONMENT=false` is also set. Both vars must be present.

**Fix:** Grep the source for `process.env.NEXT_PUBLIC_` before declaring env vars. For Cognee: `env.NEXT_PUBLIC_LOCAL_API_URL = "http://localhost:8765"; env.NEXT_PUBLIC_IS_CLOUD_ENVIRONMENT = "false";`

**Rule:** `NEXT_PUBLIC_*` var names are application-specific. Verify from source (`grep -r "NEXT_PUBLIC_" src/`) before adding them to a Nix derivation. A wrong var name silently bakes the fallback default into the bundle with no build error.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-020 -->
---
id: G-engram-2026-06-02-020
type: gotcha
domain: engram
tags: [cognee-mcp, uvx, ml-dependencies, nixos, mcp]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## uvx cognee-mcp downloads 1 GB+ of ML dependencies — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** `uvx cognee-mcp` installs the full Cognee ML stack including nvidia-cuda-*, transformers, lancedb, and psycopg2-binary (1 GB+) on every cold start. This is wrong for a NixOS MCP client where Cognee already runs as a sidecar.

**Fix:** Remove `uvx cognee-mcp` from `.mcp.json`. Use the codebase-mcp tools (`cogStatus`, `cogRecall`, `cogRemember`, etc.) which call the running sidecar's HTTP API directly.

**Rule:** Never add `uvx cognee-mcp` to a project `.mcp.json` on NixOS. The codebase-mcp integration is the correct approach when Cognee runs as a system service.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-021 -->
---
id: G-engram-2026-06-02-021
type: gotcha
domain: engram
tags: [anthropic, rate-limit, instructor, token-math, storm, cognee]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-009]
graduated_to: ""
---

## Anthropic rate limit storm: derive the interval from token math, not examples — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** `LLM_RATE_LIMIT_REQUESTS=3, LLM_RATE_LIMIT_INTERVAL=10` gives 18 requests/minute. Anthropic's limit for claude-haiku at the relevant org tier is 10,000 output tokens/minute. `instructor` retries on `IncompleteOutputException` by doubling `max_tokens` (4096→8192). Worst case: 18 req/min × 8192 = ~147,456 tokens/min — 14× over the limit. The 429 retry storm blocked the asyncio event loop for 114 minutes, froze the HTTP endpoint, pinned CPU at 96%, and grew RSS to 4.6 GB before the service was killed. The storm is self-reinforcing.

**Fix:** Calculate the safe interval from first principles:
- Limit: 10,000 output tokens/min; worst-case per request: 8192 (instructor doubling)
- Safe request ceiling: `floor(10,000 / 8192) = 1.22 req/min`
- Setting: `LLM_RATE_LIMIT_REQUESTS=1, LLM_RATE_LIMIT_INTERVAL=55` → 1.09 req/min × 8192 = 8,926 tokens/min

**Rule:** When setting Cognee LLM rate limits against Anthropic, always derive: `interval_seconds = ceil(60 / floor(output_token_limit / max_tokens_per_request))`. Account for instructor's retry doubling: if `max_tokens=4096`, worst-case is 8192. Never copy a "looks reasonable" setting without checking the token math.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-022 -->
---
id: G-engram-2026-06-02-022
type: gotcha
domain: engram
tags: [cognee, add-data-points, asyncio-gather, memory, chunks-per-batch]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-009]
graduated_to: ""
---

## Cognee `add_data_points` unbatched asyncio.gather causes memory explosion — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Cognee's `add_data_points` task fans out ALL data points in a single `asyncio.gather`. Without `chunks_per_batch`, `data_points` = ALL chunks from ALL documents at once. For 7 documents producing ~48 chunks × ~30 extracted entities each, this creates ~1440 concurrent coroutines. `get_graph_from_model` recursively traverses Pydantic models — each coroutine holds its full traversal state in memory simultaneously. RSS grew 11 GB → 19+ GB in 5 minutes; the event loop was blocked 46+ minutes; the HTTP endpoint was unresponsive throughout.

**Root cause:** `add_data_points` calls `asyncio.gather(*[get_graph_from_model(dp, ...) for dp in data_points])`. This is expected behavior for a system that assumes `chunks_per_batch` will be set by the caller.

**Fix:** Pass `chunks_per_batch=10` to `/api/v1/cognify`. This controls batch size for both `extract_graph_and_summarize` and `add_data_points`. For 7 documents, `chunks_per_batch=10` keeps RSS well under 1 GB.

**Rule:** Never call the cognify API without `chunks_per_batch`. The default (no batching) is only safe for trivially small single-document calls. For any corpus of more than 2–3 documents, set `chunks_per_batch` — start at 10, reduce to 5 beyond ~10 files. The seeding script should enforce this as a default.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-023 -->
---
id: G-engram-2026-06-02-023
type: gotcha
domain: engram
tags: [nomic-embed, asyncio-timeout, cpu, embedding, postinstall-patch]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-009]
graduated_to: ""
---

## nomic-embed-text-v1.5 Q8_0 exceeds asyncio.wait_for 30s timeout on CPU — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Cognee's `OpenAICompatibleEmbeddingEngine.py` hardcodes `timeout=30.0` on the `asyncio.wait_for` wrapping embedding requests. nomic-embed-text-v1.5 Q8_0 uses BERT-style O(n²) attention. At 1395 tokens on an E5-1620 v3 CPU, the model takes ~36 seconds — 6 seconds past the 30s timeout. The pipeline aborts silently mid-run with a `TimeoutError` on large document summaries; the error is swallowed inside the async coroutine and may not appear prominently in logs.

**Fix:** A `postInstall` override in the cognee-nix flake patches the installed wheel at build time:
```nix
substituteInPlace $out/lib/python3.12/site-packages/cognee/infrastructure/databases/vector/embeddings/OpenAICompatibleEmbeddingEngine.py --replace-fail 'timeout=30.0' 'timeout=120.0'
```
The maximum input (2048 tokens, the training context cap) takes ~78s on the same hardware; 120s gives margin for all reachable sizes.

**Rule:** When running nomic-embed-text-v1.5 Q8_0 on any vintage single-core CPU (E5-1620 v3 class or older), patch the 30s timeout to ≥120s. The `postInstall` wheel-patch is the correct Nix approach for vendored Python packages — do not fork the upstream package to change a constant.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-024 -->
---
id: G-engram-2026-06-02-024
type: gotcha
domain: engram
tags: [cognee, lancedb, search, hang, restart, post-pipeline]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## Cognee LanceDB search hangs after a long cognify pipeline — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** After a cognify pipeline run completes, the first `POST /api/v1/search` with `searchType=CHUNKS` hangs indefinitely — `ChunksRetriever` logs "Starting chunk retrieval" and then nothing. The process stays at ~33% CPU but never returns. Subsequent searches also hang. The issue is specific to the post-pipeline state of LanceDB; llama-embed responds normally throughout (verify with a direct `curl` to `/v1/embeddings`).

**Fix:** Restart the Cognee service after the cognify pipeline completes: `sudo systemctl restart cognee`. On next start the LanceDB files are in a clean state and the first search completes in under 2 seconds.

**Rule:** After any cognify seeding run, restart Cognee before issuing search queries. Add this step to the seeding runbook. The restart is fast (<5s) and the data persists — only the in-memory LanceDB connection state is cleared.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-025 -->
---
id: G-engram-2026-06-02-025
type: gotcha
domain: engram
tags: [cognee, run-in-background, cognify, async, fire-and-forget]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-05-12-002]
graduated_to: ""
---

## Cognee `run_in_background` parameter is ignored — cognify always fires async — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** `POST /api/v1/cognify` with `{"run_in_background": false}` returns in under 100ms regardless. The parameter has no effect — the cognify pipeline always fires as an async background task. There is no synchronous execution mode. (Confirmed by live test: the endpoint returned in 0.087 seconds with `run_in_background=False`.)

**Fix:** Never rely on `run_in_background=False` as a completion signal. The HTTP response only confirms the pipeline was *started*, not completed.

**Rule:** Treat every `/api/v1/cognify` call as fire-and-forget. Completion must be detected by polling an independent signal (e.g., `DocumentChunk` count stability on `GET /api/v1/datasets/{uuid}/graph`).

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-026 -->
---
id: G-engram-2026-06-02-026
type: gotcha
domain: engram
tags: [cognee, pipeline-status, completion, document-chunk, polling]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-06-02-025, G-engram-2026-05-12-007]
graduated_to: ""
---

## Cognee has no pipeline status endpoint — completion requires graph polling — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** There is no `GET /api/v1/cognify/{pipeline_run_id}/status` or equivalent. All attempts to poll progress via `/cognify/{id}` return 404. The only health endpoint is `/health`, which reports sidecar readiness, not pipeline completion.

**Fix:** Poll `GET /api/v1/datasets/{uuid}/graph` and count nodes with `"type": "DocumentChunk"`. When the count is stable for N consecutive intervals (e.g., 3 × 30s), the pipeline has finished processing new content.

**Rule:** Use `DocumentChunk` count stabilization as the completion signal for any cognify run. The graph endpoint is the only reliable post-pipeline state indicator. Stable count for 3 rounds of 30s suffices for datasets up to ~30 documents; increase `max_wait_s` for larger corpora.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-027 -->
---
id: G-engram-2026-06-02-027
type: gotcha
domain: engram
tags: [cognee, pipeline-run-id, indexed, stuck-detection, polling]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-06-02-026]
graduated_to: ""
---

## Cognee returns the same `pipeline_run_id` if the dataset is already fully indexed — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Triggering `/api/v1/cognify` on a dataset Cognee already considers fully indexed returns the same `pipeline_run_id` as the previous call. This looks like a "stuck" pipeline but is correct behavior — Cognee recognized there was nothing new to process and returned the cached run ID.

**Fix:** Stuck detection must require BOTH the same `pipeline_run_id` AND no graph growth across multiple consecutive cognify calls — not just the same ID on a single call. Initialize `last_pipeline_run_id = None` and only increment the stuck counter when a non-None ID repeats.

**Rule:** Do not treat a repeated `pipeline_run_id` on the first invocation as stuck. Stuck = same ID returned N times in a row (N ≥ 5) with no `DocumentChunk` count growth. A stable fully-indexed dataset is indistinguishable from a stuck pipeline on a single call; consecutive repetition with zero graph growth is the correct signal.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-028 -->
---
id: G-engram-2026-06-02-028
type: gotcha
domain: engram
tags: [cognee, pipeline-run, killed, non-terminal-status, staleness]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-engram-2026-06-02-010, G-engram-2026-06-02-017]
graduated_to: ""
---

## Cognee killed pipeline run leaves non-terminal status permanently — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** When the Cognee sidecar is killed (SIGKILL, OOM, `systemctl stop`) during a cognify run, the pipeline run record in SQLite stays in `DATASET_PROCESSING_STARTED` or `DATASET_PROCESSING_INITIATED` indefinitely. The sidecar does not finalize in-flight records on restart. Any client polling `GET /api/v1/activity/pipeline-runs` sees the dead run forever as "running"; any `isInFlight()` check that looks only at status polls indefinitely.

**Fix:** Add a time-based staleness threshold to any in-flight check. Runs older than a practical maximum job duration (2 hours covers the current corpus) in a non-terminal state are "Interrupted" — they don't drive polling and should display distinctly. In the Quasar UI: `const STALE_MS = 2 * 60 * 60 * 1000; isInFlight = non-terminal AND age < STALE_MS`.

**Rule:** Never use status fields alone to detect in-flight pipeline runs. Always pair status with a `STALE_MS` cutoff. Show stale non-terminal runs as "Interrupted" (grey icon), not "Running…" — they are zombie records from killed jobs.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-029 -->
---
id: G-engram-2026-06-02-029
type: gotcha
domain: engram
tags: [python, naive-datetime, javascript, timeago, nan, serialization]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Python naive datetime serialization produces NaN in JavaScript `timeAgo()` — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Python FastAPI serializes naive `datetime` objects without a timezone suffix (e.g., `"2026-05-06T14:23:11.123456"`). In some JS environments `new Date("2026-05-06T14:23:11.123456").getTime()` returns `NaN`. A `timeAgo()` that doesn't guard against NaN displays `NaNd ago`, `NaNh ago`, etc. Cognee's file data endpoint (`GET /api/v1/datasets/{id}/data`) returns naive datetimes for `created_at`.

**Fix:** Always check `isNaN(ms)` before arithmetic in any relative-time function that receives API-provided timestamp strings. Return `"—"` on NaN.

**Rule:** All `timeAgo()` / relative-time functions must guard: `const ms = new Date(iso).getTime(); if (isNaN(ms)) return '—'`. Never assume an API-provided datetime string parses cleanly — Python naive datetimes, nulls, and missing timezone info all produce NaN via `Date` parsing.

<!-- /entry -->

<!-- entry:G-engram-2026-06-02-030 -->
---
id: G-engram-2026-06-02-030
type: gotcha
domain: engram
tags: [cognee, pipeline-runs, dedup, status-events, counting]
since_version: "1.0.5"
status: active
scope: project
related: [L-engram-2026-06-02-011, G-engram-2026-05-12-007]
graduated_to: ""
---

## Cognee `GET /api/v1/activity/pipeline-runs` returns multiple rows per logical run — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** The pipeline-runs endpoint returns one row per status transition (INITIATED, STARTED, COMPLETED) for each file added. A batch of 7 files produces 21 rows. Any grouping or file-count display that iterates raw rows counts status events, not logical runs, producing inflated counts (21 instead of 7).

**Fix:** Deduplicate by `pipeline_run_id` before grouping or counting. For each unique `pipeline_run_id`, keep the row with the highest-priority terminal status (COMPLETED > ERRORED > STARTED > INITIATED). Rows with `pipeline_run_id = null` are treated as unique and not deduplicated.

**Rule:** Never count or group raw pipeline-run rows — they are status events, not file counts. Always deduplicate by `pipeline_run_id` first. Use two separate rank functions: `dedupeRank` (terminal states win) for collapsing a single run's events; `groupRank` (active states win) for surfacing the most notable status across a batch.

<!-- /entry -->

<!-- entry:G-engram-2026-06-05-001 -->
---
id: G-engram-2026-06-05-001
type: gotcha
domain: engram
tags: [cognee, auth, registration, fastapi-users]
since_version: "1.0"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Cognee auth=false means no user is ever registered — flipping to true bricks every consumer — 2026-06-05 · Claude

**Problem:** With `REQUIRE_AUTHENTICATION=false`, cognee accepts unauthenticated requests, so no client ever logs in — and therefore **no user account is ever registered**. `POST /api/v1/auth/login` returns `400 LOGIN_BAD_CREDENTIALS` for *every* email, even the configured/seeded one, because the record doesn't exist. Flipping `REQUIRE_AUTHENTICATION=true` in this state 400s every consumer (MCP, ingest, UI, memory clients) at once. The flake's `/api/v1/users/me` stub is also **only active when auth=false**, so under auth=true the UI must perform a real login.

**Fix:** Before flipping auth on, **register the admin user** while still auth=false: `POST /api/v1/auth/register {email,password}` (expect 201), then confirm `POST /api/v1/auth/login` returns 200 with an `access_token`. Register with the same credential the sops secret holds so all consumers share it. Only then set `REQUIRE_AUTHENTICATION=true`.

**Rule:** Enabling auth on a service that ran open is a *provisioning* task, not a flag flip — register + prove a working login first, or every client breaks simultaneously.

<!-- /entry -->

<!-- entry:G-engram-2026-06-05-002 -->
---
id: G-engram-2026-06-05-002
type: gotcha
domain: engram
tags: [cognee, auth, access-control, datasets]
since_version: "1.0"
status: active
scope: transferable
related: [G-engram-2026-06-05-001]
graduated_to: ""
---

## cognee REQUIRE_AUTHENTICATION ≠ ENABLE_BACKEND_ACCESS_CONTROL — 2026-06-05 · Claude

**Problem:** When enabling auth on the shared Engram service it's tempting to flip both
`ENABLE_BACKEND_ACCESS_CONTROL` and `REQUIRE_AUTHENTICATION` to `true` together (the env comment
even implies "both flags required"). They are independent: `REQUIRE_AUTHENTICATION` enforces a
valid login on every request; `ENABLE_BACKEND_ACCESS_CONTROL` turns on per-resource ACLs that
scope datasets to their owner. Enabling ACCESS_CONTROL on an install with a shared corpus (e.g. one
`project_knowledge` dataset every consumer reads) hides that dataset from any user who isn't its
owner — breaking recall for everyone.

**Fix:** For "require a login but keep data shared," set `REQUIRE_AUTHENTICATION=true` and leave
`ENABLE_BACKEND_ACCESS_CONTROL=false`. Only enable ACCESS_CONTROL when you genuinely want
per-user/per-tenant dataset isolation.

**Rule:** Authentication (who are you) and authorization/ACLs (what can you see) are separate flags
— flip only the one the requirement names. Don't bundle ACLs into an "add auth" change.

<!-- /entry -->

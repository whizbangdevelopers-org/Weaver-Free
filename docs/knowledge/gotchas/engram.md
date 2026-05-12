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

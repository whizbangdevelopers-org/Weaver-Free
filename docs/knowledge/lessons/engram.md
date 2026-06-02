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

<!-- entry:L-engram-2026-06-02-001 -->
---
id: L-engram-2026-06-02-001
type: lesson
domain: engram
tags: [llama-server, ollama, inference, pipeline, mlock, grammar]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-06-02-001]
graduated_to: ""
---

## llama-server is the right inference backend for pipelines; Ollama is for interactive browsing — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-03)

**Root cause:** Ollama is a model registry + daemon + opinionated config layer on top of llama.cpp. It earns that overhead only for interactive use (model switching, friendly `pull`-by-name). For pipeline inference (Cognee batched entity extraction, repeated sequential calls) Ollama introduces three compounding problems llama-server avoids: (1) `keep_alive` auto-unload evicts the model after 5 min idle, cold-loading on every post-timeout call; (2) no `--grammar-file` access for GBNF-constrained JSON, forcing retry-on-parse-fail; (3) quant opacity — Ollama hides quantization behind tag names and ships generic K-quants, while llama-server loads any GGUF directly (Bartowski/Unsloth imatrix quants are measurably better at the same size).

**Rule:** Classify the inference workload before choosing a backend. Batched/pipeline (Cognee, automated extraction, long-running agents) → llama-server with `--mlock` (pins the model resident for the process lifetime). Interactive/multi-model (operator chat, model discovery, Open WebUI) → Ollama. Both expose OpenAI-compatible APIs, so the UI layer is unaffected by the choice. The Weaver split: llama-server for Foundry/Cognee pipeline; Ollama for the customer-facing AI assistant MicroVM template (Decision #154).

**Why this shape wins:** Matching the backend to the workload eliminates the entire class of cold-load-latency and structured-output-reliability failures at the source, rather than papering over them with retries. `pkgs.llama-cpp` (CUDA/Vulkan/ROCm flavors) slots cleanly into a systemd unit; Ollama on NixOS wants to own `/var/lib/ollama`, awkward when storage layout is flake-controlled.

<!-- /entry -->

<!-- entry:L-engram-2026-06-02-002 -->
---
id: L-engram-2026-06-02-002
type: lesson
domain: engram
tags: [cognee, auth, env-vars, flags]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-06-02-002, G-engram-2026-05-12-001]
graduated_to: ""
---

## Cognee auth requires two independent flags, not one — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Root cause:** Disabling Cognee's auth gate requires setting BOTH `REQUIRE_AUTHENTICATION=false` AND `ENABLE_BACKEND_ACCESS_CONTROL=false`. The effective flag in `get_authenticated_user.py` is `REQUIRE_AUTHENTICATION = (getenv("REQUIRE_AUTHENTICATION","true")=="true") or (getenv("ENABLE_BACKEND_ACCESS_CONTROL","true")=="true")` — both default to `true` and are OR'd. Setting only one leaves the other at its `true` default, keeping auth active. The README mentions only `ENABLE_BACKEND_ACCESS_CONTROL`, creating the false impression it is the single control.

**Rule:** On a local Engram service that should be unauthenticated, set both flags to `false`. One flag is never sufficient. (Note: this disables route-level access control only — it does NOT merge per-user dataset namespaces; see G-engram-2026-05-12-001.)

**Why this shape wins:** Knowing the OR semantics stops you from chasing a phantom config error when one flag "didn't work." The fix is permanent and explicit in the NixOS `environment` block where both flags live together.

<!-- /entry -->

<!-- entry:L-engram-2026-06-02-003 -->
---
id: L-engram-2026-06-02-003
type: lesson
domain: engram
tags: [cognee, anthropic, instructor, connection-test, startup]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-06-02-003]
graduated_to: ""
---

## Cognee LLM connection test is broken with Anthropic/instructor — set COGNEE_SKIP_CONNECTION_TEST — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Root cause:** Cognee's startup connection test calls the Anthropic adapter with `response_model=str` (a Python primitive). `instructor` in `anthropic_tools` mode cannot produce a validated `str` from the API response, so it retries via tenacity (`stop_after_delay(128)`, `wait_exponential_jitter(8,128)`) until the outer `asyncio.wait_for(30s)` fires. The resulting `TimeoutError` misleadingly implies a broken API key or network — but the real cognify pipeline uses proper pydantic models and works correctly.

**Rule:** Set `COGNEE_SKIP_CONNECTION_TEST=true` on any NixOS Cognee instance using the Anthropic provider. Do not diagnose API-key or network issues from this error alone. Removing the env var re-enables the broken test on every restart.

**Why this shape wins:** Bypassing the test is correct here — the test is wrong, not the infrastructure. Skipping it removes a recurring false-failure on every service start.

<!-- /entry -->

<!-- entry:L-engram-2026-06-02-004 -->
---
id: L-engram-2026-06-02-004
type: lesson
domain: engram
tags: [anthropic, rate-limit, max-tokens, cognee, 429]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-06-02-007, G-engram-2026-06-02-008]
graduated_to: ""
---

## Anthropic rate limiting reserves max_tokens capacity, not actual output tokens — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Root cause:** Anthropic's output-token-per-minute limit is enforced by reserving `max_tokens` per request at submission time, not by counting tokens after the response. If `max_tokens` exceeds the per-minute ceiling (e.g. 16384 > 8000), every single request is rejected with 429 before a token is generated. Cognee's `AnthropicAdapter.acreate_structured_output` requires `max_tokens` (the SDK rejects calls without it); setting it high to "give the model room" directly violates the rate limit because the reservation is per-request.

**Rule:** Keep `max_tokens` comfortably below the org's output-token-per-minute ceiling. For structured extraction (entity/relationship JSON) 1024 tokens is sufficient and leaves room for ~7 concurrent requests at an 8000-token/minute limit. Never set `max_tokens` to the model's architectural maximum on a rate-limited deployment.

**Why this shape wins:** The reservation semantics make the failure binary — zero requests succeed, not "some throttling." Sizing `max_tokens` from the rate ceiling makes every request admissible instead of every request rejected.

<!-- /entry -->

<!-- entry:L-engram-2026-06-02-005 -->
---
id: L-engram-2026-06-02-005
type: lesson
domain: engram
tags: [cognee, rate-limit, litellm, concurrency, asyncio]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-06-02-008]
graduated_to: ""
---

## Cognee rate limiter throttles litellm calls, not task dispatch — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Root cause:** Cognee's `LLM_RATE_LIMIT_REQUESTS` / `LLM_RATE_LIMIT_INTERVAL` apply a limit at the litellm call layer, not at the task-dispatch layer. When cognify processes a dataset, all document chunks are dispatched as concurrent coroutines simultaneously; the rate limiter queues the actual API calls but all tasks are already in-flight. The first burst can still saturate the API before the limiter takes effect, and a per-task timeout firing before a queued call gets its turn causes a failure.

**Rule:** Treat the rate limiter as a best-effort throughput governor, not a concurrency cap. Combine it with a `max_tokens` value that keeps each individual call within the org's token budget so early burst calls succeed within the limiter's queue window. For a hard concurrency bound, use `chunks_per_batch` on the cognify call instead.

**Why this shape wins:** Understanding that the throttle is downstream of dispatch prevents the trap of tuning the rate limit alone and expecting burst protection. The durable fix combines token sizing + batching, which actually bounds concurrency.

<!-- /entry -->

<!-- entry:L-engram-2026-06-02-006 -->
---
id: L-engram-2026-06-02-006
type: lesson
domain: engram
tags: [cognee, embedding, litellm, openai-prefix, sidecar, drop-params]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-06-02-012]
graduated_to: ""
---

## llama-server embedding sidecar wires into Cognee via litellm openai/ prefix — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Root cause:** Adding a local embedding sidecar to Cognee requires three coordinated env vars: `EMBEDDING_PROVIDER=litellm`, `EMBEDDING_MODEL=openai/nomic-embed-text`, `EMBEDDING_ENDPOINT=http://127.0.0.1:8767`. The `openai/` prefix is litellm's provider-routing token — it selects the OpenAI-compatible HTTP API against the custom endpoint. A fourth var, `LITELLM_DROP_PARAMS=true`, is required because litellm validates `dimensions` against a whitelist of OpenAI model names and rejects it for any non-`text-embedding-3-*` model, even when the endpoint would ignore it.

**Rule:** Any local embedding server registered under `openai/` in litellm requires `LITELLM_DROP_PARAMS=true`. The sidecar's native output dimensionality is authoritative — the `dimensions` API parameter is irrelevant for llama-server. `EMBEDDING_DIMENSIONS=768` still correctly configures LanceDB's schema; only the redundant kwarg is dropped.

**Why this shape wins:** The four-var contract is the minimal, complete wiring — getting all four right once makes the sidecar work permanently, versus discovering `LITELLM_DROP_PARAMS` only after every embed call 422s.

<!-- /entry -->

<!-- entry:L-engram-2026-06-02-007 -->
---
id: L-engram-2026-06-02-007
type: lesson
domain: engram
tags: [cognee, graph-extraction, anthropic, max-tokens, chunks, search-type]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-06-02-009, G-engram-2026-06-02-014, G-engram-2026-06-02-018]
graduated_to: ""
---

## Cognee graph extraction is not viable for technical docs with Anthropic at max_tokens≤4096 — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Root cause:** `extract_graph_and_summarize` uses instructor to extract a `KnowledgeGraph` pydantic model from each chunk. For technical documentation this JSON (entities + relationships + descriptions) consistently exceeds 2048 output tokens even for 500-char chunks. The extraction prompt is ~3000 input tokens regardless of chunk size; a 500-char chunk produces 26+ entities, whose JSON cannot fit in 2048 tokens. instructor doubles `max_tokens` on `IncompleteOutputException` (2048→4096→…) but the JSON is structurally large regardless; both generations fail and the data item fails. The pydantic constraint is a hard ceiling — the JSON must be complete to validate.

**Rule:** For Anthropic-backed Cognee, use CHUNKS search (LanceDB embeddings) rather than GRAPH_COMPLETION. Embeddings succeed independently of graph extraction; the MCP `cogRecall` tool defaults to CHUNKS for this reason. GRAPH_COMPLETION becomes viable only with local text generation (llama-server, no output-token budget) or with documents short enough that KnowledgeGraph JSON fits in 2048 tokens.

**Why this shape wins:** Choosing the search type that doesn't depend on a failing step gives a working recall path immediately, instead of fighting an unwinnable token-budget battle on every technical chunk.

<!-- /entry -->

<!-- entry:L-engram-2026-06-02-008 -->
---
id: L-engram-2026-06-02-008
type: lesson
domain: engram
tags: [cognee, chunk-size, embedding, api-pipeline, env-vars]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-06-02-015, G-engram-2026-06-02-016]
graduated_to: ""
---

## EMBEDDING_MAX_COMPLETION_TOKENS is the chunk-size control for API cognify, not CHUNK_SIZE — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Root cause:** `CHUNK_SIZE` and `CHUNK_STRATEGY` are read by `ChunkConfig`, which is only instantiated by the Cognee CLI code path. The web API cognify pipeline builds its task list using `get_max_chunk_tokens()`, which reads `embedding_engine.max_completion_tokens` from `EMBEDDING_MAX_COMPLETION_TOKENS` via `min(embedding_engine.max_completion_tokens, llm_client.max_completion_tokens // 2)`. Despite its name the function returns a CHARACTER count used as `max_chunk_size` for `TextChunker`. The default (8191) produces 8191-char chunks — far too large for a local llama-server batch budget.

**Rule:** For any Cognee NixOS service using the web API cognify pipeline, set `EMBEDDING_MAX_COMPLETION_TOKENS` to control chunk size; `CHUNK_SIZE`/`CHUNK_STRATEGY` are silently ignored. It controls both embedding and graph-extraction chunk size in one var. Tradeoff: smaller = more LLM calls + weaker entity context; larger = fewer calls + richer entities, but must keep `EMBEDDING_BATCH_SIZE × chunk_tokens ≤ llama-server --batch-size`.

**Why this shape wins:** One env var that actually wires through to the API path eliminates the failure mode of tuning a silently-ignored knob and concluding "Cognee config doesn't work."

<!-- /entry -->

<!-- entry:L-engram-2026-06-02-009 -->
---
id: L-engram-2026-06-02-009
type: lesson
domain: engram
tags: [cognee, pipeline, debugging, rate-limit, memory, embedding-timeout]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-06-02-021, G-engram-2026-06-02-022, G-engram-2026-06-02-023]
graduated_to: ""
---

## Cognee AI memory pipeline: three independent compounding bugs — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Root cause:** A single Cognee pipeline run on NixOS exposed three independent failures that compound differently by dataset size and hardware. (1) `OpenAICompatibleEmbeddingEngine.py` hardcodes `timeout=30.0` on the embedding `asyncio.wait_for`; nomic-embed-text-v1.5 Q8_0 uses BERT O(n²) attention and takes ~36s at 1395 tokens on an E5-1620 v3 CPU — the coroutine aborts silently mid-run. (2) `LLM_RATE_LIMIT_REQUESTS=3,INTERVAL=10` (18 req/min) × instructor's doubled `max_tokens` (4096→8192) = ~147K tokens/min, 14× over the 10K limit; the 429 storm blocked the event loop 114 min, pinned CPU 96%, grew RSS to 4.6 GB. (3) `add_data_points` fans out ALL data points in one unbatched `asyncio.gather` — ~1440 concurrent coroutines for 7 docs, RSS 11→19+ GB, loop blocked 46+ min.

**Rule:** (1) Patch the embedding timeout to ≥120s via `postInstall` `substituteInPlace` on the installed wheel (`'timeout=30.0' → 'timeout=120.0'`) — never fork the package for a constant. (2) Derive the rate limit from token math: `interval_seconds = ceil(60 / floor(output_token_limit / worst_case_tokens_per_request))`, accounting for instructor's doubling (4096→8192). For Haiku at 10K tokens/min use `LLM_RATE_LIMIT_REQUESTS=1,INTERVAL=55`. (3) Always pass `chunks_per_batch` (start at 10) to the cognify endpoint — the unbatched default is only safe for trivially small single-document calls.

**Why this shape wins:** Treating the three as separate root causes — each with its own permanent fix — prevents "fixed one, the run still hangs" whack-a-mole. The wheel patch, the token-math formula, and the mandatory batch param each close a distinct failure class for good.

<!-- /entry -->

<!-- entry:L-engram-2026-06-02-010 -->
---
id: L-engram-2026-06-02-010
type: lesson
domain: engram
tags: [cognee, pipeline-runs, polling, staleness, zombie, status]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-engram-2026-06-02-029]
graduated_to: ""
---

## Pair status-based in-flight polling with a time-based staleness cutoff — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-07)

**Root cause:** Background job systems (Cognee cognify runs, CI builds, VM provisioning) can enter zombie states where the status field never transitions to terminal — killed processes, OOM events, and crashed workers all leave records stranded in non-terminal states. Any `isInFlight()` check that reads only `status` treats zombie records as active, driving continuous polling indefinitely and showing misleading "Running…" indicators.

**Rule:** A run is in-flight only if its status is non-terminal AND its age is below a practical maximum job duration (`STALE_MS`, e.g. 2h). Zombie records get a distinct "Interrupted" visual state — not "Running…", not silently hidden:
```typescript
const STALE_MS = 2 * 60 * 60 * 1000
const age = Date.now() - new Date(r.created_at).getTime()
return !TERMINAL.has(r.status) && !isNaN(age) && age < STALE_MS
```

**Why this shape wins:** `status` is set by the worker (killed workers can't set terminal status); `created_at` is set at creation and immune to crashes. The combination is robust where status alone is not, and it generalizes to any polling UI over a killable job system.

<!-- /entry -->

<!-- entry:L-engram-2026-06-02-011 -->
---
id: L-engram-2026-06-02-011
type: lesson
domain: engram
tags: [cognee, pipeline-runs, status-aggregation, dedup, ranking]
since_version: "1.0.5"
status: active
scope: project
related: [G-engram-2026-06-02-030]
graduated_to: ""
---

## Two rank functions for Cognee status aggregation: dedup vs. group surfacing — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-08)

**Root cause:** Cognee emits multiple `/api/v1/activity/pipeline-runs` rows per logical run (INITIATED→STARTED→COMPLETED), all sharing one `pipeline_run_id`. A display that shows "7 files uploading" must (1) collapse status events per logical run and (2) pick the most notable status across the batch. Both pick a "winning" row, but the criterion is opposite: step 1 wants terminal states to win (COMPLETED beats STARTED); step 2 wants active states to win (one RUNNING run makes the batch show as running). Conflating them produces wrong results.

**Rule:** Use two separate rank functions, never one for both: `dedupeRank` (terminal wins): `COMPLETED=3, ERRORED=2, RUNNING=1` — applied per `pipeline_run_id`; `groupRank` (active wins): `RUNNING=4, INITIATED=3, ERRORED=2, STALE=1` — applied across the deduplicated batch.

**Why this shape wins:** Separating "what happened to this file?" (terminal truth) from "what should I show about this batch?" (most attention-worthy state) stops completed runs displaying as still-running and in-progress batches displaying as done.

<!-- /entry -->

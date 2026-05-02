<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Cognee Integration — Design Reference

**Decision #151.** Authoritative reference for the cognee persistent memory sidecar. Read by `getCogneeIntegration()` in the coding MCP server to surface API shape, dataset schema, session lifecycle, and TypeScript client contract.

---

## Sidecar URL

Default: `http://localhost:8765`

Overridable via `COGNEE_URL` environment variable. Port 8765 is reserved in `PORT-ALLOCATION.md` for the cognee sidecar (Weaver-specific allocation; sidecar runs only on Foundry at v1.4.0, on customer inference node at the same version).

---

## REST API Endpoints

### POST /api/v1/cognify — Remember

Store text or structured data in the permanent knowledge graph.

**Request:**
```json
{
  "data": "string | object",
  "datasets": ["dataset_name"]
}
```

**Response:**
```json
{ "status": "ok" }
```

### POST /api/v1/search — Recall

Query the permanent knowledge graph or session cache.

**Request:**
```json
{
  "query": "string",
  "datasets": ["dataset_name"],
  "searchType": "GRAPH_COMPLETION | SUMMARIES | CHUNKS"
}
```

**Response:**
```json
[
  { "text": "string", "score": 0.92, "metadata": {} }
]
```

Use `GRAPH_COMPLETION` for structured recall (LLM-synthesised answer from the graph). Use `SUMMARIES` for pre-computed summaries. Use `CHUNKS` for raw stored text fragments.

### POST /api/v1/cognify/improve — Improve

Promote session cache entries to the permanent graph via LLM entity extraction. Called at operation close with the operationId as the session identifier.

**Request:**
```json
{ "sessionId": "string" }
```

**Response:**
```json
{ "status": "ok", "entitiesExtracted": 12 }
```

### DELETE /api/v1/datasets — Forget

Reset a named dataset (removes all stored knowledge for that dataset).

**Request:**
```json
{ "dataset": "dataset_name" }
```

**Response:**
```json
{ "status": "ok" }
```

### GET /api/v1/datasets — List Datasets

Return all dataset names with entry counts.

**Response:**
```json
[
  { "name": "host_foundry_patterns", "entryCount": 147 },
  { "name": "workload_web-nginx_behavior", "entryCount": 83 }
]
```

### GET /health — Status

**Response:**
```json
{ "status": "ok", "version": "0.1.60", "llmBackend": "claude-sonnet-4-6" }
```

---

## Dataset Naming Convention

| Dataset name pattern | Purpose | First written | Available from |
|----------------------|---------|---------------|---------------|
| `host_{hostId}_patterns` | Per-host failure, drain, cordon, and configuration patterns | v1.4.0 | v1.4.0 |
| `workload_{workloadId}_behavior` | Per-workload deployment stabilisation windows, regression fingerprints | v1.4.0 | v1.4.0 |
| `model_deployments` | Known-bad model version fingerprints for pre-shift checks | v1.4.0 | v1.4.0 |
| `fleet_routing` | Cross-host topology routing patterns | v3.0.0 | v3.0.0 (Fabrick) |

Dataset names are URL-safe. `hostId` and `workloadId` values are the NixOS service name strings (e.g., `foundry`, `web-nginx`).

---

## Session / Graph Lifecycle

```
operation starts
    │
    ▼
sessionId = operationId (UUID)
    │
    ▼
remember(observation, [dataset], sessionId=sessionId)   ← during operation
    │   (fast session cache write, no graph traversal)
    ▼
operation completes (success or rollback)
    │
    ▼
improve(sessionId)   ← background task on operation close
    │   (LLM entity extraction, promotes cache → permanent graph)
    ▼
future operation for same workload/host:
recall(query, [dataset])   ← reads permanent graph
    │   (GRAPH_COMPLETION search, LLM-synthesised answer)
    ▼
context injected into agent prompt before decision
```

**Key invariant:** `remember()` calls during an operation write to the session cache only (no graph traversal cost, safe in hot path). `improve()` is deferred to operation close and runs as a background task. `recall()` always reads from the permanent graph (never the active session cache), so it reflects only completed + promoted operations.

This lifecycle describes the **Fleet Operational Memory (FOM)** pattern — used by Smart Bridges AI agents at runtime. The same sidecar also powers a second distinct use case: Coding Session Memory (CSM).

---

## Coding Session Memory (CSM)

**CSM** captures Claude Code tool calls into cognee automatically as a developer works, then injects relevant past context at the start of each prompt. It is a developer-tool concern, not a fleet-runtime concern. The sidecar is shared; the dataset is separate.

### Dataset

| Dataset | Populated by | Queried by |
|---------|-------------|------------|
| `claude_sessions` | `csm-post-tool-use.sh` (PostToolUse hook) | `csm-user-prompt-submit.sh` (UserPromptSubmit hook) |

### Three hooks (`.claude/hooks/`)

| Hook file | Event | What it does |
|-----------|-------|-------------|
| `csm-post-tool-use.sh` | PostToolUse | Fire-and-forget `POST /api/v1/cognify` — stores tool name + input + output (truncated) to `claude_sessions`. Skips self-referential cognee calls. Triggers on: `Bash\|Agent\|Read\|Write\|Edit\|Grep\|Glob`. |
| `csm-user-prompt-submit.sh` | UserPromptSubmit | `POST /api/v1/search` with `searchType: SUMMARIES` (fast, no LLM) against `claude_sessions`. Injects top-3 results as `systemPromptSuffix` via `hookSpecificOutput`. Timeout: 3s. |
| `csm-pre-compact.sh` | PreCompact | `POST /api/v1/cognify/improve` before context window compaction — promotes active session cache to permanent graph so nothing is lost. Timeout: 10s. |

All three hooks exit 0 when the sidecar is unreachable — they never block Claude.

### Session ID strategy

```bash
SESSION_ID="${COGNEE_SESSION_ID:-$(basename "$(pwd)")}"
```

Defaults to the project directory name (`fabrick-weaver-project`). Override `COGNEE_SESSION_ID` in the shell environment to scope a session within a project.

### CSM vs FOM distinction

| | CSM | FOM |
|-|-----|-----|
| Actor | Claude Code (developer tool) | Smart Bridges AI agent (fleet runtime) |
| Dataset | `claude_sessions` | `host_*`, `workload_*`, `model_deployments`, `fleet_routing` |
| Written by | Bash hooks (REST API calls) | `ai-memory.service.ts` (TypeScript client) |
| Read by | UserPromptSubmit hook | Agent prompt assembly before each decision |
| Lifecycle trigger | PreCompact hook calls `improve()` | Agent operation close calls `improve()` |
| Available from | Any dev session (hooks in `.claude/settings.json`) | v1.4.0 (Foundry + inference node) |

The cognee sidecar serves both use cases simultaneously. Running `npm run dev` or starting a coding session does not start the sidecar — start it separately via the cognee-api systemd service or `uvx cognee-mcp --api-url`.

---

## NixOS Packaging

The cognee Python package is distributed as a local Nix flake at `~/Projects/active/cognee-nix` (uv2nix, Python 3.12, cognee 1.0.3). Three output tiers:

| Output | Contents | Use |
|--------|----------|-----|
| `cognee` | core only | library import |
| `cognee-api` | core + FastAPI/uvicorn | **sidecar — use this one** |
| `cognee-full` | core + Neo4j + Postgres + LangChain | full stack (not needed for Weaver) |

The `weaver-inference-node` flake references this as the `cognee-nix` input. The `services.weaver.cognee` NixOS module (v1.4.0) wraps `cognee-api` in a systemd service. See `Forge/research/cognee-nix.md` for uv2nix gotchas and version update procedure.

---

## Vault Integration

The cognee sidecar reads its frontier model API key from the Weaver AI credential vault (Decision #73) at startup. The NixOS module injects the active key into the sidecar's environment:

```nix
services.weaver.cognee = {
  enable = true;
  vaultKeyRef = "anthropic-api-key";  # name of the vault credential
  port = 8765;
  dataDir = "/var/lib/weaver/cognee";
};
```

Key rotation propagates on sidecar service restart (`systemctl restart weaver-cognee`). No separate credential surface — vault is the single source.

---

## TypeScript Client Contract — `ai-memory.service.ts`

```typescript
// Sidecar search type enum
export type CogneeSearchType = 'GRAPH_COMPLETION' | 'SUMMARIES' | 'CHUNKS'

// Result item from recall()
export interface CogneeRecallItem {
  text: string
  score: number
  metadata?: Record<string, unknown>
}

// Dataset entry from listDatasets()
export interface CogneeDataset {
  name: string
  entryCount: number
}

// Status returned by status()
export interface CogneeStatus {
  available: boolean
  version?: string
  llmBackend?: string
  error?: string
}

// The AiMemoryService interface
export interface AiMemoryService {
  /** Store text in the session cache for this operation */
  remember(text: string, datasets: string[], sessionId: string): Promise<void>

  /** Query the permanent knowledge graph. Use GRAPH_COMPLETION for structured recall. */
  recall(query: string, datasets?: string[], searchType?: CogneeSearchType): Promise<CogneeRecallItem[]>

  /** Promote session cache to permanent graph (call at operation close) */
  improve(sessionId: string): Promise<void>

  /** Reset a named dataset */
  forget(dataset: string): Promise<void>

  /** List all datasets with entry counts */
  listDatasets(): Promise<CogneeDataset[]>

  /** Check sidecar availability */
  status(): Promise<CogneeStatus>
}
```

**Implementation file:** `backend/src/services/ai-memory.service.ts` (created at v1.4.0)

**Constructor:** `new AiMemoryServiceImpl(sidecarUrl: string)` — reads from `config.cogneeUrl` (defaults to `http://localhost:8765`, set via `COGNEE_URL` env var in NixOS module).

---

## Usage Pattern in Cross-Resource Agent

```typescript
// In the agent operation handler:
const sessionId = operationId  // UUID generated for this operation

// During operation — write observations (session cache only):
await aiMemory.remember(
  `Restarted workload ${workloadName}: prior health-check failure at ${timestamp}`,
  [`workload_${workloadName}_behavior`],
  sessionId
)

// Before traffic shift decision — recall from permanent graph:
const history = await aiMemory.recall(
  `deployment stabilisation window for ${workloadName}`,
  [`workload_${workloadName}_behavior`],
  'GRAPH_COMPLETION'
)
// Inject history into agent prompt context

// At operation close (background task):
await aiMemory.improve(sessionId)
```

---

## Decision References

- **Decision #151** — cognee selection, sidecar architecture, dataset naming, tier deployment (Team=embedded KuzuDB+LanceDB, Fabrick=Neo4j+pgvector hub)
- **Decision #73** — AI vendor controls and vault; cognee key comes from vault
- **Decision #112** — Smart Bridges AI agent; cognee provides the memory substrate
- **Decision #153** — AI autonomy levels; `recall()` pre-flight is the Level 2 safety gate

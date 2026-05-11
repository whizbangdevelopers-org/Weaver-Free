<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge Schema

Defines the entry format for `code/docs/knowledge/` category files. Every entry
block is human-readable prose with a machine-readable YAML header — giving both
Engram (graph ingestion) and humans (grep, read) a first-class experience.

---

## Entry Format

```markdown
<!-- entry:L-testing-2026-05-07-001 -->
---
id: L-testing-2026-05-07-001
type: lesson
domain: testing
tags: [playwright, auth, storageState]
since_version: "1.2"
status: active
related: []
graduated_to: ""
---

## Title of the lesson — YYYY-MM-DD · Author

**Root cause:** ...
**Rule:** ...
**Why:** ...

<!-- /entry -->
```

---

## ID Convention

Format: `{prefix}-{domain}-{YYYY-MM-DD}-{NNN}`

| Prefix | Type |
|--------|------|
| `L` | lesson |
| `G` | gotcha |

- `{domain}` — one of the valid domains below (lowercase)
- `{YYYY-MM-DD}` — date the entry was written
- `{NNN}` — three-digit sequence number within that domain+date (001, 002, …)

**Example IDs:** `L-testing-2026-05-07-001`, `G-nixos-2026-04-22-003`

---

## Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Must match the `<!-- entry:ID -->` marker exactly |
| `type` | enum | yes | `lesson` or `gotcha` |
| `domain` | enum | yes | See valid domains below |
| `tags` | string[] | yes | Lowercase keywords; can be empty `[]` |
| `since_version` | string | yes | Semver string of the version when this entry was captured; `""` if pre-versioned |
| `status` | enum | yes | `active`, `graduated`, `deprecated`, or `historical` |
| `related` | string[] | yes | IDs of related entries; can be empty `[]` |
| `graduated_to` | string | yes | Path+anchor where this lesson graduated to (e.g. `.claude/rules/testing.md#storagestate`); `""` if not graduated |

### Status values

| Status | Meaning |
|--------|---------|
| `active` | Current, applicable |
| `graduated` | Promoted to a rule/policy; `graduated_to` field has the destination |
| `deprecated` | No longer applicable (tech changed, behaviour removed) |
| `historical` | Context-only; correct at time of capture but superseded by newer entries |

---

## Valid Domains

`frontend` · `backend` · `testing` · `nixos` · `security` · `process` · `mcp` · `engram` · `devops` · `licensing` · `analysis`

---

## File Layout

```
code/docs/knowledge/
  SCHEMA.md            ← this file
  INDEX.md             ← GENERATED — do not edit by hand
  lessons/
    frontend.md
    backend.md
    testing.md
    nixos.md
    security.md
    process.md
    mcp.md
    engram.md
    devops.md
    licensing.md
    analysis.md
  gotchas/
    frontend.md
    ...                ← same domain set
```

---

## Auditors

| Auditor | What it checks |
|---------|---------------|
| `audit:knowledge-schema` | Every `<!-- entry:ID -->` block has valid YAML frontmatter with all required fields and correct types |
| `audit:knowledge-index-fresh` | `INDEX.md` matches what `generate:knowledge-index` would produce today |
| `audit:knowledge-ids-unique` | No duplicate IDs across all category files |

---

## System Overview

```d2
direction: down

DEV: Developer Session {shape: oval}
LLGD: "llgd skill\n~/.claude/skills/llgd/"
CAT: "docs/knowledge/\nlessons │ gotchas / domain.md\n22 category files · 11 domains"
IDX: "docs/knowledge/INDEX.md\n— GENERATED —"
LEGACY: "LESSONS-LEARNED.md\nKNOWN-GOTCHAS.md\nread-only archive"

DEV -> LLGD
LLGD -> CAT: "appends entry block"

WRITE: "① Write" {
  direction: down
  HOOK: pre-commit hook
  GEN: generate-knowledge-index.ts
  HOOK -> GEN
}

VALIDATE: "② Validate — 3 of 56 auditors" {
  direction: down
  A1: "audit:knowledge-schema\nfrontmatter validity"
  A2: "audit:knowledge-index-fresh\nINDEX.md ↔ generator"
  A3: "audit:knowledge-ids-unique\nno duplicate IDs"
  A1 -> A2 -> A3
}

READ: "③ Read — MCP Tools" {
  direction: down
  KS: "knowledge-store.ts\ncollectStructuredEntries"
  QK: "queryKnowledge\ndomain · tags · type · status"
  LL: "getLessonsLearned\ncategory · keyword"
  KG: "getKnownGotchas\nsection"
  KS -> QK
  KS -> LL
  KS -> KG
}

INGEST: "④ Ingest — Engram / on-demand" {
  direction: down
  ING: "ingest-knowledge-to-engram.ts\nnpm run engram:ingest-knowledge"
  SIDE: "Cognee Sidecar · localhost:8765"
  GRAPH: "knowledge_entries\nentity graph" {shape: cylinder}
  ING -> SIDE: "reset → ingest → improve"
  SIDE -> GRAPH: "LLM entity extraction"
  GRAPH -> GRAPH: "RELATED_TO · GRADUATED_TO" {style.stroke-dash: 5}
}

CAT -> WRITE.HOOK: staged
WRITE.GEN -> IDX: re-stages
IDX -> VALIDATE.A1
CAT -> VALIDATE.A1: source {style.stroke-dash: 5}
CAT -> VALIDATE.A3: source {style.stroke-dash: 5}
VALIDATE.A3 -> READ.KS
CAT -> READ.KS: "query-time parse" {style.stroke-dash: 5}
LEGACY -> READ.LL: "legacy sections" {style.stroke-dash: 5}
LEGACY -> READ.KG: "legacy sections" {style.stroke-dash: 5}
READ.KS -> INGEST.ING
CAT -> INGEST.ING: "reads all entries" {style.stroke-dash: 5}
```

Three paths:

- **Write** — `llgd` appends an entry block to the category file; the pre-commit hook regenerates `INDEX.md` automatically.
- **Read** — MCP tools call `knowledge-store.ts` which parses category files at query time; legacy files flow into `getLessonsLearned`/`getKnownGotchas` as a separate stream during the transition.
- **Engram** — `npm run engram:ingest-knowledge` resets the `knowledge_entries` dataset, POSTs rich prose per entry (metadata + body + relationship hints), then calls `/improve` so Cognee's LLM extracts entities and wires `RELATED_TO`/`GRADUATED_TO` edges into the graph.

---

## Engram Integration

`related: [id1, id2]` and `graduated_to: path` fields are expressed as natural language
in the ingested prose so Cognee's LLM entity extractor wires them as typed graph edges
(`RELATED_TO`, `GRADUATED_TO`). `domain` and `tags` become searchable entity attributes.

Run: `npm run engram:ingest-knowledge` (requires Cognee sidecar on `localhost:8765`).
Use `--dry-run` to preview without posting.

---

## Legacy Files

`code/docs/development/LESSONS-LEARNED.md` and `code/docs/development/KNOWN-GOTCHAS.md`
are the legacy monolithic files. New entries go to the category files above. Legacy
files become read-only archive when category files have meaningful coverage (Phase 6).

The `audit:mcp-parser-baseline` auditor guards the legacy files during the transition.

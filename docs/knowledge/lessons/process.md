<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — process

Lessons learned in the **process** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-process-2026-05-10-001 -->
---
id: L-process-2026-05-10-001
type: lesson
domain: process
tags: [esm, typescript, dual-mode, import.meta.url, scripts]
since_version: "1.0.5"
status: active
related: [G-process-2026-05-10-002]
graduated_to: ""
---

## ESM dual-mode script guard — import.meta.url — 2026-05-10 · Claude

**Root cause:** In Node.js ESM, top-level code in a module runs unconditionally — both when the file is executed directly (`npx tsx script.ts`) and when it is imported as a library (`import { fn } from './script.js'`). A script that exports utility functions AND performs side effects at the top level (writing files, spawning processes) will execute those side effects on every import, which is almost never the intended behaviour.

**Rule:** Any TypeScript script that is both a standalone CLI tool and an importable library must guard its entry-point code:

```typescript
if (import.meta.url === `file://${process.argv[1]}`) {
  // side-effecting entry-point code here
}
```

**Why this shape wins:** The guard is zero-cost when the module is imported — `import.meta.url` is a static string evaluated at parse time, `process.argv[1]` is the actual entry-point file path. When imported as a library, the comparison is false and the block is skipped entirely. The exported functions remain available. This pattern surfaces naturally any time a script doubles as a library — build it in from the start, not as a retrofit.

<!-- /entry -->

<!-- entry:L-process-2026-05-10-002 -->
---
id: L-process-2026-05-10-002
type: lesson
domain: process
tags: [bash, set-e, arithmetic]
since_version: "1.0.5"
status: active
related: []
graduated_to: ""
---

## Shell script arithmetic with `set -e` — 2026-05-10 · Claude

**Root cause:** `((var++))` post-increment returns the pre-increment value. When `var=0`, `((0))` evaluates as falsy (exit code 1), and `set -e` kills the script silently.

**Rule:** Never use `((var++))` in `set -e` scripts. Use `var=$((var + 1))` (assignment form, always exits 0) or `((++var))` (pre-increment, evaluates to 1 when starting from 0).

**Why this shape wins:** The assignment form `var=$((var + 1))` makes intent explicit and is immune to `set -e` because assignment always exits 0. The `((++var))` form works but requires knowing that pre-increment evaluates to the post-increment value. Prefer the assignment form in any `set -e` script.

<!-- /entry -->

<!-- entry:L-process-2026-05-13-001 -->
---
id: L-process-2026-05-13-001
type: lesson
domain: process
tags: [auditor, naming, rebrand, terminology, compliance]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-process-2026-05-10-001, L-engram-2026-05-13-001]
graduated_to: ""
---

## Enforce a product rename with a named auditor, not a one-time grep — 2026-05-13 · Claude

**Root cause:** Renaming a product noun in a codebase (e.g., "Cognee" → "Engram") spans variable names, comments, strings, UI labels, docs, and API identifiers. A one-time search-and-replace clears the backlog but provides no protection: new code written the next day can silently reintroduce the old term, and the migration is never truly done.

**Rule:** When renaming a product noun, write a named auditor (`audit:<noun>-naming`) that scans for the forbidden terms and register it in the compliance chain. The auditor is the exit criterion for the migration — it passes when the rename is complete, and fires on every push thereafter to prevent regression.

**Why this shape wins:** The auditor makes the migration's completion state machine-readable. No future session needs context about "we used to call this X" — the auditor fails if X appears. Adding a new forbidden variant (a typo, an old alias, a case variant) is a one-line auditor change. The compliance chain's auditor count increasing triggers the marker-sync pattern automatically in any doc that summarises the CI chain, so documentation stays current. The pattern generalises: API deprecation (forbid old endpoint strings in client code), dependency retirement (forbid old import paths), terminology shifts (forbid "backlog" in user-facing copy).

<!-- /entry -->

<!-- entry:L-process-2026-06-02-001 -->
---
id: L-process-2026-06-02-001
type: lesson
domain: process
tags: [nixos, config-ownership, single-source, homelab, duplication]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-devops-2026-06-01-002]
graduated_to: ""
---

## Find a host's canonical config repo before reconstructing it — 2026-06-02 · Claude

**Root cause:** Bringing a gateway host under declarative management, I reconstructed its full NixOS config "from running state" into the repo I happened to be working in (the consumer node's repo) — not realizing a canonical, richer config for that host already existed in a different repo (the homelab repo that owns it). That created a duplicate, deployed the wrong one, and the canonical config's NAT was missing from the deployed copy — which silently broke the consumer's uplink.

**Rule:** The convention is one repo per host's `/etc/nixos` (each host deploys its own repo; the workstation is the exemplar). Before reconstructing or relocating any host's config, grep the other active repos for `hosts/<name>/` and check each flake's `nixosConfigurations` — the host may already be owned elsewhere. Reconcile into the canonical owner; never duplicate a host definition across two flakes.

**Why this shape wins:** Drift between two host definitions is invisible until a deploy picks the wrong one. This is the single-source rule applied to whole-host configs — see `~/.claude/rules/single-source-generated` and [[L-devops-2026-06-01-002]] (per-host infra ownership).

<!-- /entry -->

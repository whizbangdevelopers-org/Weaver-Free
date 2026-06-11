<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — licensing

Lessons learned in the **licensing** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-licensing-2026-06-02-001 -->
---
id: L-licensing-2026-06-02-001
type: lesson
domain: licensing
tags: [license-key, offline-validation, hmac, tier-prefix]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ".claude/rules/terminology.md"
---

## License key format: `WVR-{TIER}-{PAYLOAD}-{CHECKSUM}` with HMAC checksum for offline validation — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-24)

**Root cause:** A license-gated product must validate keys without phoning home — air-gapped and offline NixOS hosts are a core deployment target. A network-validated key would make the product unusable in exactly the high-value environments it targets.

**Rule:** Encode the tier into the key prefix (`WVR-FRE-`, `WVR-WVS-`, `WVR-WVT-`, `WVR-FAB-`, `WVR-ENT-CP-`) and append an HMAC-SHA256 checksum over the payload. Validation is purely local: recompute the HMAC and compare. The tier is readable from the prefix before any crypto runs, so tier-gating can short-circuit on a malformed or wrong-tier key. This is "honest user" protection, not DRM — it stops accidental tier mixups and casual key sharing, not a determined attacker with the signing secret.

**Why this shape wins:** Offline validation is a hard requirement for NixOS / air-gapped fleets; any scheme that needs a license server is disqualified. Embedding the tier in the prefix means the format is self-describing — logs, support tickets, and the UI can show the tier without decoding the payload. Canonical prefix table lives in `.claude/rules/terminology.md` (Decision #87).

<!-- /entry -->

<!-- entry:L-licensing-2026-06-02-002 -->
---
id: L-licensing-2026-06-02-002
type: lesson
domain: licensing
tags: [tier-gating, scaffolding, sequencing, retrofit]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-licensing-2026-06-02-003]
graduated_to: ""
---

## Scaffold the tier/license gating framework before building features, not after — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-24)

**Root cause:** The 4-tier licensing system was added in Phase 6, after the dashboard, VM management, AI agent, and help system were already built ungated. Every existing component, route, and page then needed tier-aware conditionals retrofitted — premium gates, demo-mode bypass logic, upgrade prompts in place of locked features. The retrofit touched nearly every surface and rewrote a large share of the tests, mirroring the same cost auth incurred when it landed late.

**Rule:** Define and scaffold the tier/licensing model alongside auth, before building feature surfaces. Even when the tier values are placeholders, the gating infrastructure (`requireTier()` backend gates, `isWeaver`/`isFabrick` frontend guards, the tier-matrix source of truth) must exist from day one so each feature is built with its gate baked in.

**Why this shape wins:** Tier gating is a cross-cutting concern like auth — retrofitting it means revisiting every feature surface and edge case ("does this work at Free? does the nag show? does the demo bypass apply?"). Building it in from the start makes the gate a one-line addition per feature instead of a project-wide sweep, and keeps the tier matrix and the code in lockstep from the first commit.

<!-- /entry -->

<!-- entry:L-licensing-2026-06-02-003 -->
---
id: L-licensing-2026-06-02-003
type: lesson
domain: licensing
tags: [code-protection, multi-tier, agpl, bsl, distribution, obfuscation]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-licensing-2026-06-02-004]
graduated_to: ""
---

## Code protection is per-distribution-license, not per-repo — start from each target's license — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-10)

**Root cause:** When a product ships from one dev repo to multiple tier-specific repos, the instinct is to apply one protection method (bytecode/obfuscation) uniformly. But the Free tier is AGPL and must remain source-available — obfuscation and V8-bytecode compilation are fundamentally incompatible with AGPL's source-availability requirement. A uniform model creates a direct contradiction with the license of one of the targets.

**Rule:** Choose code protection per distribution target, driven by that target's license, not by what the dev repo contains:
- **Free repo (public, AGPL-3.0):** source-available. Protected by copyleft + AI Training Restriction (Commons Clause was dropped 2026-04-19).
- **Weaver Solo/Team repo (private, BSL-1.1):** sealed binary — bytenode backend + obfuscated frontend + signed Nix closure. No source ships.
- **Fabrick repo (private, BSL-1.1):** same sealed-binary pipeline.

The sealed-binary pipeline (bytenode + javascript-obfuscator + Nix closure + cosign/Nix signing) is integrated into each paid-tier sync workflow, never the dev build — the dev repo always retains source.

**Why this shape wins:** AGPL and BSL have fundamentally different protection models. Anchoring the decision on each target's license avoids the contradiction of trying to obfuscate source you are legally required to publish, and lets each tier use the strongest protection its license permits. Of the four methods evaluated (JS obfuscation, V8 bytecode, sealed Nix closure, encrypted source w/ runtime decryption), only source-availability is viable for AGPL; the full sealed stack is reserved for BSL tiers.

<!-- /entry -->

<!-- entry:L-licensing-2026-06-02-004 -->
---
id: L-licensing-2026-06-02-004
type: lesson
domain: licensing
tags: [nur, community-distribution, free-tier, sync-exclude, ci-assertion, defense-in-depth]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-licensing-2026-06-02-003]
graduated_to: ""
---

## Three-layer licensing gate for community-distributed artifacts (structural + CI assertion + docs) — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-17)

**Root cause:** When an open-source Free tier (AGPL-3.0) and commercial tiers (BSL-1.1) ship from the same dev repo, community distribution channels (NUR, AUR, Homebrew) must receive *only* the Free content. A single gate is fragile — structural separation is invisible to new maintainers, a CI assertion can be bypassed by editing the env var, and docs alone enforce nothing.

**Rule:** Gate community distribution at three independent layers:
- **Layer 1 — Structural (strongest):** the public mirror is produced by a sync workflow that excludes all paid-tier paths via `.github/sync-exclude.yml` (e.g. `backend/src/routes/weaver/`, `fabrick/`, `src/components/fabrick/`). Paid code physically cannot reach the Free repo; the NUR package fetches from Free only.
- **Layer 2 — CI assertion:** the release workflow's NUR dispatch step asserts `FREE_REPO == whizbangdevelopers-org/Weaver-Free` and fails loud with `::error::` if mis-set. Changing the var to a private repo gets a hard failure, not a silent dispatch. The receiver also accepts only the `weaver-free-release` dispatch event type, so wrong-package dispatches drop rather than mis-match.
- **Layer 3 — Documentation:** a header comment in the NUR package file + a NUR README callout + a release-checklist step teach future contributors *why* the gate exists before they try to "fix" it.

**Why this shape wins:** Each layer covers a different failure mode of the others — structural gating is strong but invisible, the assertion makes the rule runtime-enforceable, and the documentation transfers intent. Any one layer alone is fragile; together they are defense-in-depth. NUR dispatch fires for the AGPL-3.0 Free tier only — BSL-1.1 tiers must never be dispatched to a community channel.

<!-- /entry -->

<!-- entry:L-licensing-2026-06-02-005 -->
---
id: L-licensing-2026-06-02-005
type: lesson
domain: licensing
tags: [tier-license-table, decision-137, commons-clause, agpl, bsl]
since_version: "1.0.5"
status: deprecated
scope: project
related: [L-licensing-2026-06-02-003]
graduated_to: ""
---

## License-strategy-by-tier table (Free & Premium = AGPL + Commons Clause; Enterprise = BSL) — 2026-06-02 · Claude (migrated from legacy archive, orig. pre-versioned)

**Superseded:** Tier names "Premium"/"Enterprise" were retired by Decision #137 (tiers are Free / Solo / Team / Fabrick) and the Commons Clause was dropped from Weaver-Free on 2026-04-19. Current policy: Weaver Free = **pure AGPL-3.0 + AI Training Restriction** (AGPL §7 additional term); Weaver Solo / Team / Fabrick = **BSL-1.1**, distributed through commercial channels only (never in the public repo). Canonical license header: `Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.` Live mapping is in `LICENSE` + the `audit:license-parity` auditor (`license-matrix.json`).

**Root cause (historical):** Original two-row strategy table — "Free & Premium → AGPL-3.0 + Commons Clause + AI Training Restriction" and "Enterprise → BSL" — predated both the Decision #137 tier rename and the Commons Clause drop. Kept here for lineage; do not reintroduce "Premium"/"Enterprise" tier names or Commons Clause in any license claim.

<!-- /entry -->

<!-- entry:L-licensing-2026-06-11-001 -->
---
id: L-licensing-2026-06-11-001
type: lesson
domain: licensing
tags: [agpl, bsl, dual-license, tier-split, monorepo, mirror]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Tier-keyed AGPL/BSL split for a separate off-host binary — one dev codebase, two license faces — 2026-06-11 · Claude

**Root cause:** A binary that is free to *use* but part of a tiered product (Observer: Free-floored host-local agent, Fabrick-gated cross-host features) has no off-the-shelf license. Closing it forfeits the open-source trust signal; opening all of it under AGPL gives away the paid surface; inventing a "closed freeware" license is a novel legal category nobody wants to defend in court.

**Rule:** Split the codebase by tier at the *crate/module* granularity, not the repo granularity. Free-facing crates → AGPL-3.0 (synced to the public mirror, like the main product's Free tier). Paid crates → BSL-1.1 (never synced, never NUR-dispatched). Crates *shared* by both faces are **dual-licensed AGPL-3.0 OR BSL-1.1**, so the paid build links them under BSL and inherits no copyleft — the dual grant is what stops AGPL infecting the Fabrick binary. Maintain it as *one* dev repo that *provisions* the Free mirror (same `sync-to-free.yml` exclusion model as Weaver: Dev is private, the mirror is the AGPL projection), not two hand-kept codebases. A license-matrix.json + parity auditor keeps the per-crate tier→license claim honest.

**Why this shape wins:** every part has a court-tested license (AGPL or BSL — no bespoke terms), the paid IP stays protected, and there's a single source tree so a fix lands once. The "what license is the binary?" question dissolves: the binary inherits whichever license its highest-tier linked crate carries, decided per build target. Pairs with [[L-analysis-2026-06-11-001]] — the protocol seam is why the agent can be licensed independently of the hub at all.

<!-- /entry -->

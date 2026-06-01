<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — security

Lessons learned in the **security** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-security-2026-05-12-001 -->
---
id: L-security-2026-05-12-001
type: lesson
domain: security
tags: [semgrep, taint, path-traversal, temp-files]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-security-2026-05-12-002, G-security-2026-05-12-003]
graduated_to: ""
---

## Use only server-side data in temp file paths — 2026-05-12 · Claude

**Root cause:** When a route creates a temp file, using user-provided fields (domain, scope, type) in the filename seems harmless after Zod validation. But Semgrep's taint analysis traces the source (`request.body`) forward through all derived variables and fires CWE-22 findings even when each individual input is validated. The right security model matches the right SAST model: server-generated identifiers in paths, user data in content only.

**Rule:** Temp file paths written by API handlers must derive exclusively from server-side data (e.g., `Date.now()`, a UUID, a content hash). User-provided fields belong in the file content, not the filename.

**Why this shape wins:** It's correct security AND correct SAST. Path traversal risk is eliminated structurally, not by trusting that validation was applied correctly. The temp file is opaque to the caller; its name carries no information the caller shouldn't have.

<!-- /entry -->

<!-- entry:L-security-2026-06-01-001 -->
---
id: L-security-2026-06-01-001
type: lesson
domain: security
tags: [redos, regex, auditor, safe-regex, false-positive, sast]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## ReDoS auditor: add an AST confirmation gate, never reword the regex — 2026-06-01 · Claude

**Root cause:** `audit:redos` used `safe-regex` alone. `safe-regex`'s star-height heuristic counts a *bounded outer quantifier* as added nesting depth, so a provably-safe pattern like the hostname validator `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$` reads as "star height 2" and fails the auditor. The outer `?` permits at most one repetition — it cannot amplify backtracking — but the heuristic can't see that. IPv4-style `\d{1,3}(\.\d{1,3}){3}` fails for the same reason (bounded×bounded reads as nested).

**Rule:** When a SAST heuristic over-fires on legitimate input, tighten the auditor with a precise second stage — do **not** reword the input to dodge the trigger (that's gaming, per `~/.claude/rules/never-game-auditors.md`). Here: keep `safe-regex` as a cheap stage-1 pre-filter, then confirm each flagged pattern with a `regexp-tree` AST analysis (`isCatastrophic`) before reporting. Report only on a real super-linear nest: (a) an amplifying repetition (`*`/`+`/`{n,}`, or `{m,n>=2}`) whose subtree contains an **unbounded** repetition, or (b) an **unbounded** repetition over a disjunction. Bounded×bounded is constant work — clear it. Parse failure ⇒ conservative `true` (never silently suppress).

**Why this shape wins:** Gating stage 2 *behind* stage 1 makes it impossible to weaken detection — stage 2 only ever runs on patterns stage 1 already flagged, so it can only *remove* false positives, never hide a true positive. Validated both directions before shipping: a dangerous/safe battery (`(a+)+`, `([a-z]+)*`, `(.*a){10}`, `(a|ab)*` → flagged; hostname, IPv4, `(a?)*`, `(a{2,3}){3}` → cleared) AND an end-to-end probe dropping live dangerous regexes into a scanned path to confirm the auditor still fires. Residual known gap (documented, not hidden): `safe-regex` rates single-star-over-overlapping-alternation like `(x|xy)*` as safe, so that class is still missed — a pre-existing `safe-regex` limitation, not a regression from this change. Closing it would mean running the AST check as the *primary* gate, which expands false-positive surface and is a separate decision.

<!-- /entry -->

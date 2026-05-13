<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — analysis

Lessons learned in the **analysis** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-analysis-2026-05-13-001 -->
---
id: L-analysis-2026-05-13-001
type: lesson
domain: analysis
tags: [vendor, kuzu, cognee, exit-ramp, architecture]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Own vendor wrapper as exit ramp before you need it — 2026-05-13 · Claude

**Root cause:** When evaluating whether to replace a vendor (Cognee), the question isn't "replace now or never" — it's "do we own the seam?" If the call site imports vendor APIs directly, replacement requires touching every caller. If callers go through an owned wrapper, replacement happens in one file.

**Rule:** Before committing to a full vendor replacement, write an owned wrapper with your schema, your delete semantics, and your write contract. This wrapper becomes: (1) an isolation layer so vendor changes don't propagate, (2) the site where you implement the replacement incrementally, (3) proof that your mental model of the domain is correct before you write the full implementation.

**Why this shape wins:** The three-phase arc (Phase 1: own wrapper alongside vendor → Phase 2: wrapper replaces vendor internals → Phase 3: vendor removed) allows each phase to be independently shippable. The risk of Phase 3 is carried by Phase 1 design — if the wrapper's API is clean, Phase 3 is a mechanical swap. Applied here: `code/scripts/engram-graph.ts` wraps Kuzu with owned schema, isolated from Cognee's Kuzu DB, non-additive writes, and full delete semantics — the seam that makes Cognee removal a future option.

<!-- /entry -->

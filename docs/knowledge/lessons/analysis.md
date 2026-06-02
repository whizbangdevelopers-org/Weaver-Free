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

<!-- entry:L-analysis-2026-06-02-001 -->
---
id: L-analysis-2026-06-02-001
type: lesson
domain: analysis
tags: [scaling, isolation, scheduling, capacity, schema]
since_version: "1.0"
status: active
scope: transferable
related: []
graduated_to: ""
---

## The unit of independent scaling is the unit of isolation — 2026-06-02 · Claude

**Root cause:** When designing horizontal scaling (replicas, load-balancing, fan-out), the granularity at which you can scale a thing *independently* is exactly the granularity of its isolation boundary — not finer. A "function" that is one process among several inside a shared boundary cannot be scaled alone; the smallest independently-scalable unit is the whole shared boundary. This decided Weaver's Ply granularity (Decision #168): a workload is independently ply-able only if it owns its isolation boundary (its own MicroVM/container); co-resident functions scale at their shared VM boundary.

**Rule:** Before designing a scaling operation, identify the isolation boundary, because that *is* the scaling unit. This forces an upstream schema requirement: the system's model of a host/node must decompose it into independently-addressable units each with their own state lineage — never a monolithic image. (Cloning a whole host to scale one function duplicates sibling singletons — a correctness bug, not just waste.) A downstream capability question can thus impose a hard requirement on an already-agreed upstream schema; settle granularity before committing the schema.

**Why this shape wins:** Two corollaries fall out for free. (1) **Capacity is a verdict, not an error** — admission control runs a deterministic pre-flight (footprint × count vs. free headroom) and returns a verdict tree (fits-local → spill-elsewhere → refuse-with-numbers → explicit-degrade), instead of try-and-fail. (2) **Resource exhaustion becomes a natural tier/scope boundary** — "no room in the local box" is exactly the moment a local operation must escalate to a fleet-scoped one (in Weaver: Team same-host → Fabrick cross-host). Designing the granularity correctly up front makes both the scale-out *and* its inverse (drain-then-destroy, floored at the lineage anchor) derive from the same primitive rather than needing bolt-ons.

<!-- /entry -->

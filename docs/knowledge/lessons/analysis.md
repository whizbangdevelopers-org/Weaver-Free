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

<!-- entry:L-analysis-2026-06-02-002 -->
---
id: L-analysis-2026-06-02-002
type: lesson
domain: analysis
tags: [boundary, product-vs-tool, pattern-extraction, architecture, forge]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Extract the pattern, not the codebase, across a product/tool boundary — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Root cause:** When a new product feature shares pattern DNA with an existing internal tool, "we already built this — reuse it" is a category error. Reuse at the *implementation* level couples two systems whose operational requirements diverge. Concretely (Decision #149): Shed Builder (a customer-facing feature *inside* Weaver that builds customer software) shares build-VM orchestration, provenance schema, and security-baseline patterns with Forge (the internal tool WBD uses to build Weaver) — but reusing the Forge codebase would have made customer ingestion depend on Anthropic API availability, let Forge failures break customer compliance infrastructure, and chained the two security models together.

**Rule:** Product features and developer tools live in separate codebases even when they share pattern DNA. Identify the boundary by asking *who operates this and what is its failure-domain* — "the tool WBD uses to build the product" vs. "a feature inside the product the customer uses." Extract the reusable pattern (orchestration model, audit/provenance schema, security baseline, declarative jobset shape), document the extraction, then write a fresh implementation scoped to the consuming system's operational constraints. The same logic rejected importing Hydra: adopt its jobset → reproducible builder → signed output → substituter → notify *pattern* without inheriting its perl+postgres+multi-service operational burden.

**Why this shape wins:** Architecture transfer without operational burden gives independent evolution. Each side's security model, dependency surface, and availability requirements move on their own schedule; a failure or API-credit cost in one never propagates to the other. The split is cheap when made at design time and expensive to retrofit after two systems have grown shared call sites — so the decision belongs at the moment you first notice the shared DNA, not after the coupling exists.

<!-- /entry -->

<!-- entry:L-analysis-2026-06-02-003 -->
---
id: L-analysis-2026-06-02-003
type: lesson
domain: analysis
tags: [tier, upgrade-nag, conversion, ui-gating, monetization]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## An upgrade nag renders at the tier it converts FROM, not the tier it converts TO — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Root cause:** Upgrade messaging is naturally authored alongside the paid feature it advertises, so it tends to inherit that feature's tier gate — `v-if="isPaidTier"`. That gate renders the nag only to users who have *already upgraded*, i.e. the exact audience that no longer needs converting. In Weaver, two perfectly-crafted Settings upgrade sections were gated on `isWeaver`, so Free-tier users (the target) never saw them — the conversion touchpoint was dead-code-gated to the converted.

**Rule:** When reviewing any `v-if` chain on upgrade/conversion UI, explicitly ask "at which tier is this message supposed to be seen?" The answer is almost always the lower tier — so gate on `!isPaidTier`, not `isPaidTier`. As a sweep: grep every `UpgradeNag` / `upgrade-nag` usage and verify each one's enclosing condition actually lets the lower tier see it. Watch for the nested trap — a correctly-gated badge (`v-if="!isWeaver"`) inside a card that itself requires `isWeaver` is still dead code.

**Why this shape wins:** Conversion is a property of the audience being converted, so the render condition must name *that* audience, not the destination state. Tests are the contract that catches the drift cheaply: a `describe('Free Tier — …')` spec that asserts the lock message appears at Free tier fails the moment the nag is mis-gated to a paid tier — turning an invisible monetization leak into a red test.

<!-- /entry -->

<!-- entry:L-analysis-2026-06-02-004 -->
---
id: L-analysis-2026-06-02-004
type: lesson
domain: analysis
tags: [observer-pattern, tier-cap, resource-limit, trust, primitive]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-analysis-2026-06-02-003]
graduated_to: ""
---

## The observer pattern is the right shape for a free-tier resource cap — show everything, gate actions — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Root cause:** A tier cap on a resource (VM count, total memory) can be enforced three ways, and two of them corrode user trust. *Hiding overage* (list only the first N) makes the system appear broken when the same resource is visible via another tool. *Hard-rejection* (refuse to register past the cap) is destructive and leaves "missing" resources invisible even after an upgrade. The third — *observer pattern* — shows every resource but makes only the in-cap subset controllable; over-cap items are read-only and mutating them returns 403 + an upgrade nag.

**Rule:** For any tier cap on a countable/measurable resource, prefer the observer pattern over hiding or hard-rejection. Implement it as a single pure function `check{Cap}(target, all, tier)` returning a typed error object or `null`, called from every mutation route handler. Backend-as-single-enforcement-point means every current and future client (web, TUI) inherits the cap automatically. Asymmetric verbs keep the cap non-punitive: block the action that grows usage (start when it would exceed the memory ceiling) while always allowing the action that shrinks it (stop), so a user can trim back under the cap without upgrading.

**Why this shape wins:** Showing everything keeps the mental model honest ("Weaver sees this; I just can't act on it at this tier") and turns the cap itself into an implicit conversion touchpoint — the user sees exactly what an upgrade would unlock. It mirrors the existing Observer/Viewer role (read-only everywhere), so the codebase gets one consistent "visible but not actionable" primitive instead of three different cap mechanics.

<!-- /entry -->

<!-- entry:L-analysis-2026-06-02-005 -->
---
id: L-analysis-2026-06-02-005
type: lesson
domain: analysis
tags: [shim, sync-exclusion, module-split, architecture, conditional-stub]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Split a sync-excluded module into shim + data so the public build never loses an import target — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-18)

**Root cause:** A module that must not ship to a public mirror (demo mock data, tier-gated source, sensitive config) is often statically imported by files that *do* ship. Excluding the whole module from sync makes the dev tree build fine but breaks the public build — the import target is simply absent.

**Rule:** When you are about to add a file to the sync-exclude list and you already know a non-excluded file imports it, don't exclude it whole. Split first: a **shim** that ships everywhere + a **data-impl** that is sync-excluded. The shim loads the data file when present (`import.meta.glob` in Vite, `try { import() } catch` in Node) and falls back to type-compatible no-op stubs when absent. Preserve types across the seam with `typeof import('./data')` so tsc still checks call sites against the real module on the dev side, and call sites never change their imports. Pair the split with a scanner (`verify-excluded-imports`) that fails the push on any raw import of a sync-excluded path — the scanner, not the one-time sweep, is the permanent fix.

**Why this shape wins:** The shim is a real TypeScript module, so types flow normally to call sites with no build-config coordination — strictly better than `resolve.alias` conditional stubs, which are config-level and force every consumer to stay alias-aware. Dropping the shim later (when the content becomes non-sensitive) is a delete, not a config change. Applied to 6 modules in v1.0.1, this eliminated 85+ of 97 sync-exclusion violations with zero call-site refactor.

<!-- /entry -->

<!-- entry:L-analysis-2026-06-02-006 -->
---
id: L-analysis-2026-06-02-006
type: lesson
domain: analysis
tags: [parallelization, amdahl, profiling, performance, tradeoff]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Parallelization gains are Amdahl-limited — profile end-to-end before claiming a speedup — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-23)

**Root cause:** Parallelizing N tasks feels like an automatic win, but wall-clock is governed by the longest serial phase, not the count of things now running concurrently. Parallelizing the compliance runner's 42 fast auditors saved ~10–15s, yet total time *rose* from 53s to 80s because one auditor (`generated-artifact-freshness` at 61s, since it shelled out to vitest ×3) dominated the critical path. Removing that one serial bottleneck — not adding more parallelism — dropped wall-clock to 21s.

**Rule:** Before declaring a parallelization win, measure end-to-end, not the parallel portion in isolation. Amdahl's law applies: if one unit is ~3× longer than any other, parallelizing the rest yields diminishing returns. Diagnose with a per-task timing report (`--json` ms per auditor); the unit closest to the phase wall-clock ceiling is the bottleneck — fix that first. Structure the work as three phases: prerequisites → parallel-safe → serial-only. When adding a task that shells out to a slow tool (vitest, Playwright, nix-build), classify it by cost: runtime-bound tasks belong in a slow/pre-release gate, not the hot pre-push path.

**Why this shape wins:** The goal is shortest wall-clock, not maximum parallelism — and those are different objectives. Profiling first prevents the common failure mode of optimizing the cheap-to-parallelize majority while the real cost sits in one serial phase you never measured. Classifying by cost at insertion time keeps the bottleneck out of the hot path permanently rather than re-discovering it each release.

<!-- /entry -->

<!-- entry:L-analysis-2026-06-02-007 -->
---
id: L-analysis-2026-06-02-007
type: lesson
domain: analysis
tags: [preflight, diagnostics, capability-check, install, fail-early]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-analysis-2026-06-02-008]
graduated_to: ""
---

## A capability pre-flight must diagnose in layers before prescribing a fix — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-24)

**Root cause:** A single fail-or-pass capability gate assumes one root cause for one symptom, but identical-looking failures have distinct causes needing opposite remediations. `/dev/kvm` missing-or-inaccessible can mean BIOS virtualization off, kernel module not loaded, wrong group permissions, nested-VM without nested-virt enabled, or nested-VM without microcode updates — five causes, five fixes. A one-size message ("enable VT-x in BIOS") sent to someone running *inside* KVM sends them to the wrong place; a mis-diagnosed pre-flight is worse than none because it consumes time on the wrong fix.

**Rule:** Write capability pre-flights as ordered diagnostic layers, each narrowing the cause and emitting remediation specific to *that* layer: (1) device accessible read+write → pass; (2) exists but wrong perms → group-membership fix; (3) running inside a VM (`systemd-detect-virt`) → nested-virt fix with CPU-specific commands; (4) `/proc/cpuinfo` exposes `vmx`/`svm` but device absent → kernel module not loaded; (5) no flags at all → BIOS likely disabled, *acknowledging* "or inside a VM without flags exposed" rather than asserting bare-metal. The remediation string must be actionable for the *specific* mode detected, never generic.

**Why this shape wins:** Layered diagnosis converts an ambiguous symptom into a precise instruction, which is the entire value of a pre-flight — a wrong instruction costs more than silence. The structure also forces you to enumerate the real failure modes up front (e.g. on NixOS, nested KVM needs both `boot.extraModprobeConfig` nested=1 *and* `updateMicrocode` — two distinct options, the latter not optional on some CPU generations), which is exactly the knowledge a generic check would have papered over.

<!-- /entry -->

<!-- entry:L-analysis-2026-06-02-008 -->
---
id: L-analysis-2026-06-02-008
type: lesson
domain: analysis
tags: [install, fail-early, capability-check, diagnostics, ux]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-analysis-2026-06-02-007]
graduated_to: ""
---

## Block, don't warn, when a missing capability defeats the installed thing's primary job — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-24)

**Root cause:** When an install/configure script hits a missing system capability, a warning-then-continue produces the worst outcome: a "successfully installed" service that silently cannot perform its core function. The user discovers the gap only when they first try to use it — far from the install, with no obvious link back to the warning they scrolled past.

**Rule:** If a missing capability means the installed service cannot do its *primary* job, fail early with a clear diagnostic and remediation, and exit non-zero — do not complete the install. Reserve non-blocking warnings for capabilities that affect *secondary* features only, where the service is still useful without them. Applied to Weaver: `nix-install.sh` / `nix-fresh-install.sh` changed `/dev/kvm` absence from warn+continue to layered fail + `exit 1`, because VM provisioning is Weaver's primary differentiator — an install that can't provision is incomplete, not "installed with reduced capability." The user should fix the host config before the NixOS rebuild runs, not after.

**Why this shape wins:** Failing at the point of detection collapses the distance between cause and discovered effect, which is the single biggest lever on debugging time. The block/warn decision is a clean design test — "is this capability load-bearing for the primary job?" — that scales to any installer, and it pairs with the layered-pre-flight rule (L-analysis-2026-06-02-007) so the early exit also carries a cause-specific fix rather than a generic one.

<!-- /entry -->

<!-- entry:L-analysis-2026-06-02-009 -->
---
id: L-analysis-2026-06-02-009
type: lesson
domain: analysis
tags: [two-document-contract, audience, public-vs-internal, docs-as-code, boundary]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## When one title must be both private inventory and public rhetoric, split by filename and add a per-doc parity auditor — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-21)

**Root cause:** A document that serves two audiences with one file accumulates two failure modes. Weaver's in-app `ENGINEERING-DISCIPLINE.md` (shipped to every user via DocsPage) listed every auditor by filename — a useful internal maintenance reference, but a verbatim gap-analysis blueprint for an adversary, written in their preferred format — and drifted internally to four different auditor counts because the cross-doc regex auditor matched only one phrasing of the claim.

**Rule:** When the same logical title must exist as private inventory AND public rhetoric, split into two files: (1) **filename disambiguation, not just H1** — an `-INTERNAL` suffix answers "which doc is this?" before the file is opened; H1 wording is only secondary signal. (2) **a per-doc parity auditor on the public side**, not a widened cross-doc regex — a focused auditor that cross-references multiple claims *within one document* catches the four-way internal drift that a cross-doc pattern misses. (3) **maintenance workflow in the internal file's header** — who owns it, when each public copy updates, which relationships are CI-enforced vs. human-enforced. Do not try to serve both audiences from one file with conditional blocks; that eliminates drift by construction but at the cost of a long-tail build-step generator.

**Why this shape wins:** The split treats public in-product docs as *code* — held to the same compile-time guardrails (per-doc parity, link integrity) as backend handlers — which is what stops multi-release drift from accumulating on a surface every user sees. Filename-level disambiguation is robust because it survives grep, file listings, and tab titles, whereas H1-only disambiguation is invisible until the file is open. The public side carries category-level coverage rhetoric with no inventory, so the marketing surface never doubles as an attacker's checklist.

<!-- /entry -->

<!-- entry:L-analysis-2026-06-03-001 -->
---
id: L-analysis-2026-06-03-001
type: lesson
domain: analysis
tags: [information-architecture, navigation, refactor, ui, first-principles]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Don't encode a per-entity attribute as a top-level navigation axis — 2026-06-03 · Claude

**Root cause:** Engram-UI's top tabs (Knowledge / Graph / Engram) were a projection of each dataset's *processing strategy* (embed-only / embed+graph / full-engram). The same attribute was then encoded a second time as the drawer's grouping. Two symptoms followed inevitably: (1) the most common verb — Recall/search — got trapped under whichever mode happened to match a strategy, so you couldn't search an embed-only dataset at all; and (2) shared surfaces (the Monitor) had to be duplicated per mode, each self-fetching. Switching modes also wiped the selected entity, because the mode *was* the filter.

**Rule:** When a navigation axis turns out to be a filter on one attribute of an entity, it is in the wrong place. Make the entity the noun (selected once, persistently), let its attribute light up *capabilities* within a workspace, and make top-level destinations **verbs/tasks** (Search, Browse, Monitor) that are reachable regardless of any entity's attribute. Test the smell: "to do X I first have to be in mode Y" and "switching tabs clears my selection" both mean the axis is a disguised filter.

**Why this shape wins:** Verbs-as-destinations keep the primary action (search) always one click away instead of N levels deep behind a mode that has nothing to do with searching; capability-gating (show the Graph tab only when the entity supports it) communicates the attribute without making it navigation; and shared/global surfaces collapse to a single instance because they no longer wear a per-mode costume. The attribute still belongs *somewhere* — as a badge/grouping on the entity list — just not as a place you navigate to.

<!-- /entry -->

<!-- entry:L-analysis-2026-06-04-001 -->
---
id: L-analysis-2026-06-04-001
type: lesson
domain: analysis
tags: [agentic, task-design, bulk-transform, spec, executor]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-devops-2026-06-04-001]
graduated_to: ""
---

## Direct the script approach for bulk transforms — don't let an agent edit file-by-file — 2026-06-04 · Claude

**Root cause:** A broad mechanical rename (18 files / 71 sites) handed to a local agentic executor as "rename X to Y everywhere" → the model reads and edits **file-by-file**, ~1 file per several turns → impractically slow (est. ~70 min) and times out mid-task. Even a capable model is slow doing a bulk transform as N agentic read-edit cycles; for a local model it blows the time budget outright.

**Rule:** When the task is a BULK mechanical transform, the spec (the DESIGN) must direct the **script** approach — e.g. `grep -rl X | xargs sed -i 's/X/Y/g'`, then `typecheck` — not leave the model to choose. Specify the HOW, not just the WHAT, for bulk work. (Same task, directive spec: minutes instead of timing out.)

**Why this shape wins:** agentic file-by-file is right when each file needs *judgment*; a cross-cutting identifier rename has no per-file judgment, so it's a one-command job. Match the execution shape to the task shape — route only the judgment work through turns.

<!-- /entry -->

<!-- entry:L-analysis-2026-06-04-002 -->
---
id: L-analysis-2026-06-04-002
type: lesson
domain: analysis
tags: [observer, fabrick, prototype, fleet, architecture]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## Observer's cost is the fleet plumbing, not the binary — scope a pull-forward by the unbuilt dependency stack, not the headline feature — 2026-06-04 · Claude

**Root cause:** "What would it take to build `weaver-observer` now?" reads as "write the agent binary." A one-session Node dogfood proved the actual collection core (enumerate Docker/Podman/libvirt + host telemetry, normalized to `vmInfoResponseSchema`) is a few hours and OS-agnostic. The real cost is everything the binary *reports to*, none of which exists: a fleet **gRPC** protocol (needed by Managed hosts too, not just Observer), the **hub** (`backend/src/routes/fabrick/*` is an empty placeholder — no registry, no fleet map, no poller), and **mTLS + pairing-token + `weaverRole=observer` x509** (Decision #101). So pulling Observer forward = pulling the entire multi-host on-ramp forward.

**Rule:** When scoping a pull-forward of a planned feature, cost the **unbuilt dependency stack it lands on**, not the headline artifact. The feature that names the request is often the cheap leaf; the platform it assumes is the spend. Build the cheap leaf as a throwaway prototype first precisely to expose where the real cost sits before committing a version slot.

**Why this shape wins:** the prototype reused the existing single-host REST contract (`vmInfoResponseSchema`, `/api/workload`, `/api/containers`) as the Observer's output shape, making "Observer mimics a Weaver host" nearly free and forward-compatible — gRPC+mTLS later becomes a transport swap, not a rewrite. Structuring the prototype so the enumeration logic is the keeper and the REST transport is explicitly throwaway (marked in-file) avoids the dead-code/architecture-mismatch trap when the real transport lands.

<!-- /entry -->

<!-- entry:L-analysis-2026-06-04-003 -->
---
id: L-analysis-2026-06-04-003
type: lesson
domain: analysis
tags: [observer, fabrick, microvm, scope, boundary]
since_version: "1.0.5"
status: active
scope: project
related: [L-analysis-2026-06-04-002]
graduated_to: ""
---

## Observer never enumerates MicroVMs — that is Weaver's job; sharpens Decision #101 — 2026-06-04 · Mark

**Root cause:** Building the Observer prototype, it was tempting to make it enumerate everything a host runs, including MicroVMs (read `/var/lib/microvms`, reconcile against `microvm@<name>.service` units / bare `qemu -name` processes). That crosses a product boundary: MicroVMs are Weaver's primitive. A host with MicroVMs is a *Managed* host (or should be) — Weaver itself reports its MicroVMs. Having the Observer also enumerate them duplicates and competes with Weaver's own reporting.

**Rule:** Observer scope = **containers (Docker/Podman) + traditional libvirt/QEMU VMs + host telemetry**, on hosts Weaver does NOT manage. **MicroVMs are out of scope.** If you want MicroVM visibility on a host, the answer is "run Weaver there" (it becomes Managed), not "teach the Observer to read MicroVM state." This is the Managed-vs-Observed line drawn at the workload level, sharpening Decision #101's "read-only visibility."

**Why this shape wins:** the boundary keeps Observer cheap and the tier story clean — Observer is the land (read-only, free up to 5× headroom, Decision #102), and MicroVM management is the expand (run Weaver → Managed). Letting Observer reach into MicroVMs would blur the conversion lever Observer exists to create. When a feature can technically do more, scope it by *which product owns the primitive*, not by what the code can reach.

<!-- /entry -->

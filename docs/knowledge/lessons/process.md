<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — process

Lessons learned in the **process** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-process-2026-05-10-001 -->
---
id: L-process-2026-05-10-001
scope: transferable
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
scope: transferable
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

<!-- entry:L-process-2026-06-02-002 -->
---
id: L-process-2026-06-02-002
type: lesson
domain: process
tags: [no-quick-fix, root-cause, scripts, data-lifecycle, discipline]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-003]
graduated_to: ""
---

## No quick fixes — root cause or nothing — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-24)

**Root cause:** `fresh-install.sh` cleared `backend/data/` but the running backend re-persisted stale state during graceful shutdown — the script killed dev servers and only waited `sleep 1`, but the backend's shutdown flush completed after the sleep and before the wipe, re-creating the files. The tempting "fix" was to manually clear the files. That is a one-time patch that breaks again the next time anyone runs the script with a live server.

**Rule:** Manual data clearing (or any one-time intervention to make a script "work") is a symptom, not a fix. If a script needs manual steps to behave correctly, the script is broken — fix the script so the failure can never recur. Here: replace `sleep 1` with a per-process `tail --pid=PID` wait + timeout so each killed process fully exits before any data file is touched. Applies to all lifecycle scripts (fresh-install, rebuild, test-harness setup) across all environments.

**Why this shape wins:** A permanent fix moves the guarantee into the system instead of into the operator's memory. The same session also surfaced a second instance — dev mode seeded mock VMs via a blanket `NODE_ENV !== 'production'` check — fixed with an explicit `SEED_SAMPLE_VMS=true` env var rather than a blanket environment branch. Root-cause fixes compound; quick fixes re-spawn the same incident under a new disguise.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-003 -->
---
id: L-process-2026-06-02-003
type: lesson
domain: process
tags: [shell, set-e, error-handling, silent-failure, scripts]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-002, L-process-2026-05-10-002]
graduated_to: ""
---

## Scripts must never fail silently — every exit path produces visible output — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-24)

**Root cause:** `nix-fresh-install.sh` exited with no output after "Computing npm dependency hashes…" — looked successful, rebuilt nothing. The chain: a sibling dev script had deleted the lockfiles; `nix-rebuild-local.sh` ran `prefetch-npm-deps` on the missing lockfiles with `2>/dev/null`; the missing lockfile made it exit non-zero; `set -euo pipefail` caught it and exited immediately — but with no visible error because stderr was suppressed. `set -e` + `2>/dev/null` is a silent-failure factory.

**Rule:** Every script exit path must produce visible output — either a success message or an error explaining what went wrong and how to fix it. Never combine `2>/dev/null` with `set -e` on a command that can fail: either handle the error explicitly (`|| { echo "…"; exit 1; }`) or don't suppress stderr. Add existence checks with actionable messages (`npm install --package-lock-only`) before commands that assume a file is present. Silent success is fine; silent failure is a bug.

**Why this shape wins:** A script that fails loud with a fix-hint costs seconds to diagnose; a script that fails silent costs an entire debugging session to even locate. The cost asymmetry is enormous and one-directional — there is no downside to a visible error path.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-004 -->
---
id: L-process-2026-06-02-004
type: lesson
domain: process
tags: [parity-check, plans, source-of-truth, memory, verification]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Parity-check against the actual plan file, not memory vocabulary — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Root cause:** Writing a parity-check document, I targeted a "v2.5 storage substrate" migration target pulled from memory-note vocabulary without opening `plans/v2.5.0/EXECUTION-ROADMAP.md`. The actual v2.5 plan was Copy-on-Write / storage pools / quotas — nothing resembling the substrate I was checking against. The migration target I was parity-checking didn't exist, and the whole decision was built on a phantom.

**Rule:** Memory vocabulary is a pointer, not ground truth. Before writing any parity check, migration plan, or decision that references a named target version/feature, open the target file and verify what it actually says. When an investigation reveals your architecture was designed against a nonexistent target, escalate loudly and reframe — don't try to rescue the original framing.

**Why this shape wins:** Reading the source file costs 30 seconds; building on a phantom target costs a rewrite plus the risk that the phantom ships. Verifying against the authoritative artifact also frequently collapses a planned migration entirely (here: ship Attic at v2.2 directly instead of nix-serve + migrate-to-nothing).

<!-- /entry -->

<!-- entry:L-process-2026-06-02-005 -->
---
id: L-process-2026-06-02-005
type: lesson
domain: process
tags: [single-source, generator, auditor, marker, cross-doc, meta-pattern]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-006, L-process-2026-06-02-007, G-process-2026-05-10-001]
graduated_to: ".claude/rules/single-source-generated.md"
---

## Single-source data + generator + parity auditor is the shape for cross-doc consistency — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-17)

**Root cause:** 13 vertical sales docs each carried a hand-maintained compliance-framework table. Every framework addition or term rename had to land in 13 places; drift was constant because catching drift by review is expensive and forgetting is free.

**Rule:** When one structured fact must appear identically in many documents, never hand-propagate. Build the four-layer shape: (1) structured data in a typed source file (TS module / YAML / JSON); (2) a generator that writes between idempotent marker pairs (`<!-- name:start -->…<!-- name:end -->`) in each target doc; (3) a parity auditor that re-runs the generator in `--check` mode and exits non-zero on any diff; (4) wire the auditor into the pre-push compliance chain (and a pre-commit hook that regenerates on source change). Exclude data+generator+auditor from public sync if the content is internal-only.

**Why this shape wins:** One edit regenerates N docs mechanically and CI fails the instant any doc drifts — drift becomes structurally impossible rather than reviewer-dependent. Does NOT apply where each doc needs its own prose voice; for genuinely narrative content, feedback memories + auditors catch drift without constraining the writing. This is the project's canonical "single source → generated" meta-pattern (full-artifact, marker-bounded, or JSON-threshold variants).

<!-- /entry -->

<!-- entry:L-process-2026-06-02-006 -->
---
id: L-process-2026-06-02-006
type: lesson
domain: process
tags: [version-drift, parity-auditor, ai-amplification, external-ecosystem, source-of-truth]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-005, G-nixos-2026-06-02-011]
graduated_to: ""
---

## Any external-ecosystem version referenced in >3 files needs a parity auditor — AI amplifies the drift — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-09)

**Root cause:** A value that originates in an external ecosystem (NixOS channel, Node major, distro release) tends to get copied into many files. Each copy is internally consistent, so tests pass and nothing breaks — the drift is invisible until a human notices. AI-assisted development amplifies this: the model defaults to its training-cutoff version and writes the wrong value confidently everywhere.

**Rule:** When a value derives from an external ecosystem version and is referenced in more than three files, designate exactly one file as the source of truth and build a parity auditor that reads the canonical value and verifies every other reference matches. Run it in the compliance chain on every push. (The concrete nixos-version implementation is captured at [[G-nixos-2026-06-02-011]]; this is the generalized auditor principle.)

**Why this shape wins:** A parity auditor turns an invisible, slowly-rotting drift class into a machine-checked invariant that fails in milliseconds with the exact stale references named. It is the read-only sibling of the single-source-generated pattern: where that pattern *writes* derived views, this one *verifies* hand-written references converge on one source.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-007 -->
---
id: L-process-2026-06-02-007
type: lesson
domain: process
tags: [auditor, scanner, permanent-fix, sweep, enforcement]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-008, L-process-2026-06-02-005]
graduated_to: ""
---

## The scanner is the permanent fix — ship the auditor with the sweep — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-18)

**Root cause:** Fixing 97 cross-module-boundary import violations by hand was a one-time win with no durability — the next developer (or the same one six months later) adds a new import of a sync-excluded path and the Free build breaks again. The sweep cleared the backlog but installed no guard.

**Rule:** When you do a cross-cutting sweep, ship the scanner in the same PR. The PR that fixes N violations must include the auditor that keeps them fixed and wires it into the pre-push compliance chain. No scanner → no permanent fix. This is the durable form behind `verify-excluded-imports`, `verify-tier-parity`, `verify-demo-guards`, `verify-license-parity`, `verify-compliance-matrix-parity`, `verify-release-builds`.

**Why this shape wins:** The sweep is cheap once; the scanner makes it stay fixed forever at near-zero ongoing cost. A fix without an auditor is a fix with an expiry date. This reinforces the "no quick fixes" principle — a sweep without enforcement is a quick fix on the cleanliness layer.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-008 -->
---
id: L-process-2026-06-02-008
type: lesson
domain: process
tags: [gotcha, enforcement, auditor, specification, drift, llgd]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-007, G-process-2026-05-10-001]
graduated_to: ""
---

## Documented gotchas without enforcement drift back into code — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Root cause:** A KNOWN-GOTCHAS entry correctly prescribed `nix-prefetch-url --unpack` over `curl | sha256sum`. The gotcha shipped in the docs — but `release.yml` kept using the exact `curl | sha256sum` anti-pattern the gotcha described, and every NUR update since produced mismatched hashes. The gotcha lived in a doc; the code had no test for it. Gotchas are specifications, and specifications without enforcement drift.

**Rule:** Every KNOWN-GOTCHAS (or knowledge-base) entry that describes a workflow, config, or script anti-pattern earns a static auditor in the compliance chain within one release of being written. When running `llgd`, explicitly ask "which of these new gotchas earn a new auditor, and when does it land?" — the answer is never "someday." Put a version target on every deferred auditor.

**Why this shape wins:** Any doc that tells future-you "don't do X" is a standing offer for a regression until paired with a test that fails on X. Enforcement converts a memory-dependent rule into a machine-checked one. This is the gotcha-side corollary of "the scanner is the permanent fix."

<!-- /entry -->

<!-- entry:L-process-2026-06-02-009 -->
---
id: L-process-2026-06-02-009
type: lesson
domain: process
tags: [release, simulator, auditor, systems-signal, repeated-failure]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-007]
graduated_to: ""
---

## A repeated-failure streak is a systems signal — build the simulator, not five more fixes — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Root cause:** One release attempted to ship five times in an evening; each fix (docker-context audit, cosign flag drift, attestation on a free-plan repo, openssf baseline exemption, sync-path + NUR-hash content leak) exposed the next layer. The first four were caught by existing auditors before data loss; the fifth shipped briefly because no test exercised the actual release behavior end-to-end. Pre-push auditors enforce invariants about the *code* — they don't run the workflow file as a *program*.

**Rule:** When an operation fails repeatedly in CI and each fix is correct-in-isolation, stop shipping fixes one at a time and ask "what single simulator would have caught all of these simultaneously?" For load-bearing workflows (release pipeline, mirror sync, package dispatch), build a local end-to-end dry-run that parses the job DAG and executes each step against a sandbox with forged env/inputs (sign steps mocked), verifying the produced tree and computed hashes. The answer to a streak is usually a new auditor — build it.

**Why this shape wins:** A simulator collapses five gambled tag-cycles into a single pre-push failure naming the specific step and expected-vs-actual output. Without it, every workflow edit gambles on the next production run; with it, the gamble moves to the developer's machine where it's free.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-010 -->
---
id: L-process-2026-06-02-010
type: lesson
domain: process
tags: [never-game-auditors, fix-the-rule, suppression, specification, integrity]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-008]
graduated_to: "~/.claude/rules/never-game-auditors.md"
---

## Never game auditors — if the rule catches legitimate input, fix the rule — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-21)

**Root cause:** A roadmap doc used phrases like "from 37 → 38 auditors" describing forward work; the `audit:doc-parity` count check matched the numbers and false-positived. The reflex was to reword the plan to dodge the trigger. That's gaming: it converts documentation into keyword-avoidance trivia, teaches that dodging is cheaper than fixing, leaves the auditor's bug in place to ambush the next author, and corrodes trust in every other check.

**Rule:** An auditor firing on legitimate input is an auditor bug — fix the auditor (here: require plural `auditors\b`, skip lines with range arrows, skip `plans/vX.Y.Z/` files). An auditor firing on illegitimate input is real drift — fix the input. Rewording input to silence the trigger is neither and is forbidden, with no exemptions. Same principle covers test suppressions: `eslint-disable` / `sast-ignore` / skipping a flaky test / accepting a warning baseline are gaming unless paired with an auditable justification.

**Why this shape wins:** Fixing the rule made doc-parity *tighter* and surfaced a real stale "18 static auditors" claim the old fuzzy regex had been obscuring — gaming would have left that drift undetected. Spot-the-gaming heuristic: "would an adversarial reviewer believe I fixed the underlying issue, or just the surface trigger?" If the latter, you're gaming — stop and fix the rule.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-011 -->
---
id: L-process-2026-06-02-011
type: lesson
domain: process
tags: [release-discipline, finish-the-sweep, defer, context-cost]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-013]
graduated_to: ""
---

## Finish the sweep — don't defer fixes while the context is already loaded — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Root cause:** Mid-release, I proposed deferring a batch of code-scanning findings (TOCTOU, network-JSON-to-disk, insecure-temp, use-before-declaration) to a future "clean sweep." Each one, approached individually, had a fast correct fix (3–40 line diffs, ~90 lines total across 9 files). Deferring would front-load that work onto a future session that inherits the context-reload penalty: re-reading the code, reloading auditor output, re-deriving the reasoning.

**Rule:** In a cycle where the bug is already front-of-mind and the files are already open, prefer finish-the-sweep over minimum-viable-fix. Before deferring any fix, ask "what's the 1-hour-from-now cost of carrying this into a future session?" — memory reload, context re-read, auditor re-run. If that exceeds the fix itself, don't defer. Legitimate exceptions: (a) the fix needs real new design work; (b) the fix touches a module outside the current change's blast radius.

**Why this shape wins:** Deferral feels cheaper but silently capitalizes a context-reload tax that usually exceeds the fix. Doing the work while reasoning is loaded is the lowest-total-cost path. Corollary: run `llgd` at session end (not just start) so the "defer → no, do it now" inversions and their rationale are captured before context is lost.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-012 -->
---
id: L-process-2026-06-02-012
type: lesson
domain: process
tags: [codeql, sast, security, flow-analysis, fix-at-source, moat]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-010]
graduated_to: ""
---

## CodeQL flow findings are the moat — fix at source, don't annotate away — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Root cause:** When CodeQL alerts surfaced (shell-injection-from-env, TOCTOU file-system-race, http-to-file SSRF-adjacent, incomplete-sanitization), the first-read instinct was "these are noise / false positives." On reflection they were exactly the cross-file data-flow categories an in-repo regex SAST auditor is *designed not to compete with* — CodeQL was earning its keep by finding taint paths the regex auditor cannot see.

**Rule:** When a CodeQL alert involves *flow* (environment → shell, user-input → file path, network → disk, request param → redirect), the default posture is fix-at-source, not annotate-away. Reserve suppression for true false positives backed by an auditable reason (author-controlled value, mis-modeled sanitizer) — never "we think it's probably safe." A custom regex SAST auditor is complementary to CodeQL, not a substitute; don't defer CodeQL fixes waiting on the custom auditor.

**Why this shape wins:** Flow-based findings are the highest-value, hardest-to-self-detect class — treating them as noise discards the exact signal the tool exists to provide. Cheap non-flow hygiene findings (insecure-temp, unused-local, use-before-declaration) are handled opportunistically in bulk.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-013 -->
---
id: L-process-2026-06-02-013
type: lesson
domain: process
tags: [notes, roadmap, timing, validated-premise, bundling]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-011]
graduated_to: ""
---

## Execute a parked roadmap when the current session validates its premise — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-21)

**Root cause:** A NOTES.md item parked a plan to extend the custom SAST auditor (the "easy 4 + medium 2" rules) as future test-building work. During a release we spent hours fixing findings CodeQL caught that the custom auditor could not — which *was the parked item's motivating evidence*. Leaving the companion work parked while its justification was being proven would let the memory decay before execution.

**Rule:** When a session's own work validates a parked roadmap item's premise, that's the moment to ship the companion work, not defer it. Parked items decay in relevance over time; they compound when bundled with the release that revealed their value. Here six of seven roadmap rules shipped in ~90 minutes once the framework was loaded, taking the SAST auditor from 9 to 19 rules and catching a real log-injection with zero false positives.

**Why this shape wins:** Deferred memory and NOTES entries lose context with every session boundary; executing them while the motivating evidence is fresh is when future-you has the strongest context. Run `llgd` after such work so "and we also shipped X because it became urgent" is captured, not just the plan.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-014 -->
---
id: L-process-2026-06-02-014
type: lesson
domain: process
tags: [release-gates, cadence, patch-vs-minor, ratchet, single-file]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Release review gates must be cadence-aware — patches skip the manual battery by design — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-21)

**Root cause:** Human-attention review gates (keyboard-only UI pass, CII Best Practices review) naturally ratchet — each new gate gets added as "one more item for every release" until patches cost as much as minors, which creates pressure to skip gates informally, which silently corrodes every downstream trust claim.

**Rule:** Make review gates cadence-aware. Gates requiring human attention run at every minor/major (`v<M>.<m>.0`) and are skipped on patches (`p > 0`). Keep them in one canonical file (`plans/cross-version/RELEASE-REVIEW-GATES.md`), not sprinkled per-version — sprinkling means N edits to add one gate. Each gate states *why* it's minor/major-gated and lists out-of-cadence triggers that fire even on patches. When adding a "check this manually" item, ask whether it fires every release or only minor/major; if unsure, default to minor/major (easier to tighten later than to loosen an always-on gate that starts being skipped).

**Why this shape wins:** Codifying the cadence split keeps the patch path cheap (bug fixes / small-surface security) while concentrating human verification where tier/UI/compliance boundaries actually move. One-file ownership keeps the gate list maintainable; per-version sprinkling guarantees drift.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-015 -->
---
id: L-process-2026-06-02-015
type: lesson
domain: process
tags: [auditor, queue-state, calendar, execution-readiness, forge-status]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-016]
graduated_to: ""
---

## Queue-state beats calendar for execution-readiness auditor gates — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-23)

**Root cause:** `audit:agent-knowledge-coverage` used a 180-day calendar threshold to warn about knowledge-freshness stubs awaiting real MCP-tool citations. At the project's release cadence, 180 days spans 2–3 cycles — a spec could enter the queue and execute with a "fresh" stub that was actually stale. Calendar is a proxy for readiness; the project's own queue state is authoritative.

**Rule:** When an auditor's real question is "is this thing ready to execute?", derive the signal from structured project state, not calendar days. Stack two gates: a queue-aware hard error keyed on the explicit `ready: true` flag in `forge/STATUS.json` (a stub on a spec about to execute is a blocker — don't key on "blocked-by-current-version" or you false-positive the whole future queue), plus a short calendar warn (45 days) so distant-version specs still get periodic review. Generalizes to any "is X due now?" auditor — release gates, compliance re-cert, dependency audits.

**Why this shape wins:** The project almost always has a better signal than "N days ago" — a queue, a feature flag, a release gate. Using it makes the auditor fire exactly when it matters and stay quiet otherwise, instead of guessing from a calendar proxy.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-016 -->
---
id: L-process-2026-06-02-016
type: lesson
domain: process
tags: [auditor, threshold, json-baseline, refresh-script, reviewable]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-015, L-process-2026-06-02-005]
graduated_to: ".claude/rules/single-source-generated.md"
---

## Externalize auditor thresholds to a JSON baseline with a refresh script — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-23)

**Root cause:** Auditors with numeric thresholds (minimum section/entry counts, growth-warn ratios) tend to hard-code those magic numbers in TypeScript source. A reviewer reading a threshold-bump commit can't tell at a glance whether it was a legitimate re-baseline or a dodge of a real failure, and the auditor code mixes the *shape* of the check with the *value* of the limit.

**Rule:** Keep tunable thresholds in a JSON file alongside the auditor (pattern match: `tier-matrix.json`, `license-matrix.json`, `scripts/baselines/mcp-parser.json`). The auditor reads from JSON; a `baseline:<thing>:refresh` script regenerates the JSON from current measurements minus a documented buffer, producing a human-reviewed diff committed with justification — never auto-committed. Include audit-trail fields (`_lastRefreshed`, `_currentMeasurements`). Add an in-band growth advisory: when actual exceeds threshold by a ratio (e.g. 1.15×), print a non-failing nudge on success so the human re-baselines before the threshold goes useless.

**Why this shape wins:** A baseline diff becomes a pure, reviewable data change; the auditor stays focused on check logic. This is the JSON-threshold variant of the single-source-generated meta-pattern — externalized, reviewable data instead of source-code magic numbers.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-017 -->
---
id: L-process-2026-06-02-017
type: lesson
domain: process
tags: [generated-artifact, determinism, timestamp, freshness-auditor, git-date]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-005]
graduated_to: ""
---

## Generated artifacts must be deterministic — no clock-based fields, derive dates from git — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-23 / 2026-04-25)

**Root cause:** Two failure instances, same cause. (1) A generator wrote `generated: <ISO timestamp>` into a JSON artifact; the timestamp churned every run, so `audit:generated-artifact-freshness` failed every push even when every substantive number was unchanged. (2) A generator embedded `new Date().toISOString().slice(0,10)` as a "last updated" field; the committed file always held yesterday's date, so every CI run after midnight diffed and failed even with no schema change. A clock reading is not a source.

**Rule:** Any generator subject to a freshness/parity auditor must be a deterministic function of its sources — running it twice back-to-back with no source change must produce byte-identical output. Never embed a clock reading. When a "last updated" date is genuinely needed, derive it from the source's last git-commit date (`git log -1 --format=%cs -- <source>`, fall back to `new Date()` only if git is unavailable). When a true wall-clock timestamp is required (e.g. "last measured at" for investor materials), split into two files — one deterministic (registered with the auditor), one mutable (not registered).

**Why this shape wins:** Determinism makes the auditor's diff mean "the content actually changed," not "the clock advanced." Non-deterministic generators fail the auditor forever and train people to ignore it — the worst outcome for a freshness check. Git-derived dates are also more meaningful: they reflect when the source was edited, not when the generator happened to run.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-018 -->
---
id: L-process-2026-06-02-018
type: lesson
domain: process
tags: [jsdoc, generator, auditor, catalog, allowlist, per-file-metadata]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-005, L-process-2026-06-02-017]
graduated_to: ""
---

## JSDoc header + generator + auditor is the pattern for per-file catalogs — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-23)

**Root cause:** When a class of files needs a catalog (E2E specs, migrations, feature flags, compliance controls), a hand-maintained index rots — entries fall out of sync with the files they describe, and typos silently create ghost categories.

**Rule:** Don't hand-maintain the catalog. Encode per-file metadata at the source in a structured JSDoc header with required tags (`@purpose`, `@feature`, `@since`); a generator parses all files and emits a *deterministic* markdown catalog (no timestamps — parity with the freshness auditor is automatic); an auditor enforces every file has a header, tag values come from a maintained allowlist (typo-guard against ghost categories), and the catalog is fresh (diff-check, fail if stale); a pre-commit hook regenerates when any source file is staged. First use: `testing/e2e/*.spec.ts` → `docs/E2E-COVERAGE.md`.

**Why this shape wins:** Metadata lives next to the thing it describes (less rot than a standalone index), the catalog is always current with no manual sync step to forget, and the allowlist turns a mis-tagged file into a loud failure instead of a silent new category. Same mental model as every other "structured source → generated artifact" in the project.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-019 -->
---
id: L-process-2026-06-02-019
type: lesson
domain: process
tags: [version-renumbering, replace-all, temp-markers, git-mv, body-label-drift]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-process-2026-06-02-011]
graduated_to: ""
---

## Renumbering a version arc needs staged replace_all through temp markers — and a body-label sweep — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Root cause:** Shifting multiple version slots in one file (v2.2→v2.3 while v2.3→v2.4, etc.) with naive sequential `replace_all` cascades: the `v2.3→v2.4` pass then re-catches the v2.4 references the previous pass just created. Separately, a *prior* renumbering had renamed directories and file titles but never swept body content, leaving three roadmap files whose internal "Phase Overview" headers labeled themselves one version off — invisible because `audit:doc-parity` compares the title line, not body text against the title.

**Rule:** When shifting multiple version slots in the same file, stage replacements through unique temporary markers (`__TMPV24__`) so no `replace_all` collides with a later one; order the shifts deliberately. For directory renames, `git mv` in reverse order (highest→lowest) to avoid filesystem collisions. After any version-directory rename, `grep -rn "v2\.X" plans/v2.Y.0/` for the *old* string and fix every body occurrence in the same commit — title/body drift is not caught by the doc-parity title check.

**Why this shape wins:** Temp markers make a multi-slot shift collision-free and auditable; the reverse-order `git mv` avoids clobbering. The body-label sweep closes the exact gap the auditor can't see, and fixing it in the discovering commit prevents it rotting through another rename cycle.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-020 -->
---
id: L-process-2026-06-02-020
type: lesson
domain: process
tags: [decision-parity, master-plan, ascending, append, auditor]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ".claude/rules/decisions.md"
---

## Decision rows go at the bottom, ascending — the parity auditor enforces it — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Root cause:** New decisions added "just above the last row" (the natural mid-file insertion reflex) break the Decisions table's strict-ascending requirement; `audit:decision-parity` fails with e.g. "#146 follows #148 — out of order." Inserting via an Edit tool replace always lands the new row *before* the matched existing row, which is exactly the wrong order.

**Rule:** New decision rows go at the *bottom* of the `MASTER-PLAN.md` Decisions table, highest number last — use the `scripts/add-decision.sh` helper, never a manual mid-file Edit insertion. If an out-of-order row already exists, duplicate it to the correct position and delete the original (two surgical edits). Verify with `npx tsx scripts/verify-decision-parity.ts` after any decision-table edit.

**Why this shape wins:** Ascending order makes the table diff-stable and lets the parity auditor catch insertion mistakes mechanically. The dedicated script removes the failure mode entirely by always appending after the last row and stamping the revision date.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-021 -->
---
id: L-process-2026-06-02-021
type: lesson
domain: process
tags: [test-gate, compliance, prepush, false-confidence, whole-repo]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## test:compliance runs only the auditors — run test:prepush for the full gate — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Root cause:** `npm run test:compliance` runs only the static auditors — not `lint`, `typecheck`, `test:unit:run`, `test:backend`, `test:tui`, or `test:security`. Treating it as the full pre-push gate for a doc-only change pushed, then the push hook's `test:prepush` caught lint/audit failures not run locally. Worse, the whole-repo lint in `test:prepush` fails on *any* file in the working tree — including another developer's in-progress unstaged work — so a clean doc commit can still be blocked.

**Rule:** For any change touching more than one file — even pure documentation — run `npm run test:prepush` locally before pushing, not just `test:compliance`. The gate hierarchy: `test:precommit` (lint + typecheck + unit + backend + tui) + `test:security` + `test:compliance` (the auditors) = `test:prepush` (all three). Running the auditors alone is a false-confidence trap.

**Why this shape wins:** Knowing exactly which composite covers which checks prevents the "I ran the audits, why did the push fail" cycle. The whole-repo scope of `test:prepush` is correct — it's the last gate before origin — so reproduce that scope locally rather than discovering it at push time.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-022 -->
---
id: L-process-2026-06-02-022
type: lesson
domain: process
tags: [directory-rename, grep, surface-forms, cross-reference, refactor]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-process-2026-06-02-012]
graduated_to: ""
---

## Directory renames — grep the bare old name, not just the path-with-slash — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-01)

**Root cause:** A renamed directory (`mcp-server` → `codebase-mcp`) appears in at least four distinct surface forms a single search pattern misses: path with trailing slash (`code/mcp-server/`), path without (`cd code/mcp-server`), a segment inside `resolve(ROOT, 'mcp-server', …)`, and a bare name in prose. A `replace_all` targeting `code/mcp-server/` fixes prose and imports but silently misses `cd code/mcp-server` — invisible until someone runs that shell command.

**Rule:** After any directory rename, grep for the *bare* old name (`grep -rn "mcp-server"`), not the path-with-slash form — the bare-name grep catches all four surface forms in one pass. Explicitly filter intentional hits (e.g. a different tool sharing the substring). Sibling-script corollary: when fixing a stale path in one script, grep for similarly-named siblings — they usually carry the same bug.

**Why this shape wins:** A path-shaped search pattern is biased toward path-shaped occurrences and structurally blind to the no-slash and embedded-segment forms. The bare-name grep is the superset that can't have that blind spot.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-023 -->
---
id: L-process-2026-06-02-023
type: lesson
domain: process
tags: [auditor-count, propagation, doc-parity, single-source, drift]
since_version: "1.0.5"
status: active
scope: project
related: [G-process-2026-05-10-001, L-process-2026-06-02-005]
graduated_to: ""
---

## A count propagated across N docs wants a single source — until then, doc-parity catches drift — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Root cause:** Adding one auditor required bumping the auditor count in five separate docs (`code/CLAUDE.md`, `STATUS.md`, `NOTES.md`, `MASTER-PLAN.md`, `ENGINEERING-DISCIPLINE.md`). One was missed on the first pass; `audit:doc-parity` caught it next push ("STATUS.md says 36 but package.json has 37"). The five-doc cost is a smell: the same machine-derivable fact is hand-maintained in five places.

**Rule:** A count derivable from a structured source (here `jq` over `package.json` `audit:*` scripts) should not be hand-maintained in N docs — promote it to the marker-sync single-source pattern (`<!-- auditor-count:begin -->N<!-- auditor-count:end -->` regenerated by `scripts/sync-markers.ts`). Until that's in place, `audit:doc-parity` makes the N-doc cost tractable by failing fast on drift. When adding an auditor, the checklist is: create `verify-X.ts`, add `audit:X` to package.json, chain into `test:compliance`, update every count reference, let doc-parity catch any miss.

**Why this shape wins:** Doc-parity converts silent drift into a loud pre-push failure, but the durable fix is to delete the hand-maintenance entirely via markers — the count then derives from one source and can't drift. This is the marker-bounded variant of single-source-generated applied to a propagated number.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-024 -->
---
id: L-process-2026-06-02-024
type: lesson
domain: process
tags: [typescript, tsconfig, baseurl, bundler, deprecation, tooling-hygiene]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## tsconfig baseUrl is redundant with moduleResolution "bundler" — remove it — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-01)

**Root cause:** With `moduleResolution: "bundler"`, TypeScript delegates module location to the bundler (Vite) and only type-checks `paths` mappings — it does not resolve module locations itself. That makes `"baseUrl": "."` a no-op anchor: the `paths` values (`"./src/*"`) are already relative to the tsconfig file. TypeScript 6.0 deprecates `baseUrl` in this role ("will stop functioning in TypeScript 7.0").

**Rule:** In any project using `moduleResolution: "bundler"`, do not include `baseUrl` in `tsconfig.json`. Remove it; no other change is needed because `paths` values already use `./` prefixes. It is a legacy artifact from when TypeScript owned module resolution.

**Why this shape wins:** Dropping the redundant option clears the 6.0 deprecation warning ahead of the 7.0 removal and removes a stale mental model (that baseUrl is load-bearing) that misleads future config edits.

<!-- /entry -->

<!-- entry:L-process-2026-06-02-025 -->
---
id: L-process-2026-06-02-025
type: lesson
domain: process
tags: [parsefloat, version-comparison, semver, compliance-page]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-process-2026-06-02-013]
graduated_to: ""
---

## parseFloat breaks version ordering past v1.9 — semver parts are integers, not decimals — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Root cause:** `CompliancePage.vue` used `parseFloat('1.0.0') >= parseFloat(standard.fullVersion)` to check whether a standard was fully implemented at the current app version. It works for 1.0 vs 1.1 vs 1.5, but breaks at 1.10 because `parseFloat('1.10.0')` returns `1.1`, which equals `parseFloat('1.1.0')` — so v1.10 and v1.1 are treated as identical. It works for v0.x through v1.9, then silently reorders at v1.10.

**Rule:** Never use `parseFloat` for version comparison. Semver parts are integers, not decimals. For a quick comparison, combine parts with a large multiplier: `(major * 1000 + minor) >= (standard.major * 1000 + standard.minor)`. For full semver, use a library.

**Why this shape wins:** The bug is invisible for the entire v0.x–v1.9 window — the exact window in which a young project lives — so it ships clean and detonates at the first double-digit minor. Treating version segments as integers from the start makes the comparison correct at every version instead of just the early ones. (Companion gotcha: [[G-process-2026-06-02-013]].)

<!-- /entry -->

<!-- entry:L-process-2026-06-02-026 -->
---
id: L-process-2026-06-02-026
type: lesson
domain: process
tags: [docs, sync-exclude, doc-classification, developer-guide, public-repo]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## DEVELOPER-GUIDE.md is internal, not user-facing — doc-classification rule for sync-exclude — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-16)

**Root cause:** The Developer Guide (3000+ lines) was syncing to Weaver-Free as if it were a user-facing doc. It contained MCP tool descriptions referencing MASTER-PLAN.md, Forge resource-locking docs, Weaver-Dev repo paths, and internal architecture details that help competitors more than users.

**Rule:** User-facing docs answer "how do I use this?" Internal docs answer "how do I build this?" Only the former go to the public repo. The dividing line: if a doc references MASTER-PLAN, Decision #, Forge, `agents/`, or test infrastructure, it is internal and belongs in `sync-exclude.yml`. Free users get ADMIN-GUIDE, USER-GUIDE, PRODUCTION-DEPLOYMENT, COMPATIBILITY, and compliance docs; contributors who need the developer guide clone Dev (which they need anyway for hooks and auditors).

**Why this shape wins:** A single mechanical test ("does it reference MASTER-PLAN / Decision / Forge / agents / test infra?") classifies every doc deterministically, so the next doc added doesn't require a judgment call about whether it leaks internal posture — it either trips the test or it doesn't.

<!-- /entry -->

<!-- entry:L-process-2026-06-05-001 -->
---
id: L-process-2026-06-05-001
type: lesson
domain: process
tags: [ci, release, github-actions, pre-push-hook]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## "CI on releases only" is only safe if the release tag re-verifies — 2026-06-05 · Claude

**Root cause:** To save runner minutes, the goal was "local CI (the pre-push hook) is the gate; GitHub Actions runs on release tags only." But the release workflow only built + signed + published — it never ran the test/typecheck/compliance suite. So dropping the PR test trigger would leave the LOCAL hook as the *only* gate before a release — and a hook is bypassable (`--no-verify`) and runs on a developer's env, not clean infra. A tag could ship code that never passed CI anywhere.

**Rule:** When you move test CI to release-only, the release tag must be SELF-SUFFICIENT: add a `verify` job that re-runs the full suite (lint/typecheck/unit/compliance) on clean infra and gate build→sign→publish on it. Then the local hook is the per-push gate and the release tag is the independent backstop. Keep security scanners (CodeQL) on PR/push — those minutes are worth it. E2E that only runs in Docker on a dedicated host stays out of the GitHub job; the hook owns it.

**Why this shape wins:** two real verification points (every push via the hook, every release via the self-sufficient tag) with zero redundant per-PR runs — the cost saving without the "no GitHub-side verification ever" hole.
<!-- /entry -->

<!-- entry:L-process-2026-06-06-001 -->
---
id: L-process-2026-06-06-001
type: lesson
domain: process
tags: [memory, infrastructure, verification, anvil, subagent]
since_version: "1.0"
status: graduated
scope: transferable
related: []
graduated_to: "~/.claude/rules/verify-infra-from-anvil.md"
---

## Treat "X doesn't exist / X lives in Y" memory + docs as hypotheses, not facts — 2026-06-06 · Claude

**Root cause:** An always-loaded memory line asserted a negative+location fact ("`test-infra/` doesn't exist; weaver-lab config lives in Forge"). It was relayed into a subagent prompt as a constraint; the subagent then read a stale `Forge/infrastructure/weaverlab.md` (Proxmox era) that *agreed*, and the two stale sources reinforced each other into a confidently-wrong assessment (weaver-lab "pending Proxmox→NixOS" when it was already a deployed NixOS host). Two stale sources agreeing is not verification.

**Rule:** Before answering an infrastructure question, read the live source of truth (`anvil/hosts/inventory.yaml` + `anvil/flake.nix` + `anvil/hosts/<host>/`) first; treat memory and prose docs as hints. Distrust especially **negative claims** ("doesn't exist"), **status claims** ("pending"/"planned"), and **location claims** ("lives in repo W") — one `ls`/`grep` settles them. When you find drift, fix the stale source the same turn so it can't re-poison the next session, and record infra facts in memory as *pointers* to the live source, not copied values.

**Why this shape wins:** copied facts rot the instant the thing changes; pointers to a structured source can't rot the same way. Killing the stale assertion and redirecting to the live source removes the poison for every future session instead of correcting one answer.
<!-- /entry -->

<!-- entry:L-process-2026-06-07-001 -->
---
id: L-process-2026-06-07-001
type: lesson
domain: process
tags: [engram, auth, migration, silent-failure, health-check]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Flipping auth on a shared service is a fleet-wide change — sweep every consumer; health checks lie — 2026-06-07 · Claude

**Root cause:** Engram/Cognee was flipped to require authentication (FI-4 / Decision #171), but the rollout updated only some consumers. A missed one — the foundry forge-loop agent's MCP config — still passed only `ENGRAM_COGNEE_URL`, no credentials, so its knowledge calls (`cogRecall`/`queryKnowledge`/`cogRemember`) 401'd. Nothing surfaced it: the agent's status probe (`cogStatus` → `/health`) stayed **green** because health endpoints don't require auth. Net effect — the dark-factory agents silently stopped reading institutional knowledge, discoverable only by asking "does it actually see the registry?"

**Rule:**
- Enabling auth on a shared backend is a **fleet-wide change**. In the same change, enumerate EVERY consumer — MCP configs, Claude hooks, services, scripts, UIs — and give each credentials. `grep` the endpoint/port (`:8765`, `ENGRAM_COGNEE_URL`) across all repos + host configs to find them; the "URL set, creds absent" pairing is the silent-401 signature.
- **Health ≠ function.** A green `/health` (or any unauthenticated probe) does NOT mean a consumer can authenticate. Verify an *authenticated* call per consumer (`/api/v1/datasets` → 200, not just `/health` → 200), ideally as the consumer's actual runtime user.
- A consumer that authenticates via a **hardcoded credential** (e.g. a password baked into a hook script) is a related smell — it "works" but leaks the secret into source and the template. Provision the secret to the consumer's user and read it from a file instead.

**Why this shape wins:** auth migrations fail *open-ended and silent* — the server is up, health is green, only the authenticated code path breaks — so the failure surfaces weeks later as "the agent isn't using knowledge," not as an error at migration time. Sweeping all consumers + verifying one authenticated call each converts a silent, deferred failure into a checked invariant at the moment you flip the switch.

<!-- /entry -->

<!-- entry:L-process-2026-06-07-002 -->
---
id: L-process-2026-06-07-002
type: lesson
domain: process
tags: [relocation, security-boundary, ownership, cross-session, microvm]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Relocating a sealed service: the data migrates trivially; the security boundary stays with its designers — 2026-06-07 · Claude

**Root cause:** Relocating a verdaccio mirror (built + sealed by another session) king → weaver-lab, the easy parts went fast — port the module, copy the storage image, the mirror serves. But the reachability change entangled the **two-layer egress seal** (designed for SLIRP's network model), and reworking that seal for a real-NIC model risks silently *un-sealing* the air-gapped mirror (a supply-chain regression). I started down that path before recognizing it wasn't mine to change blind.

**Rule:** When relocating a service that carries a security boundary (a seal, a firewall posture, an auth model) built by another track, split the work: **do the boundary-agnostic parts** (config port, data migration, storage) and **hand the boundary itself back to the team that designed it** — or change it only with their explicit verification. Data is portable; a security invariant is not a refactor you do on someone else's behalf.

**Why this shape wins:** getting a security boundary subtly wrong fails *silent* (it still "works," just insecurely) and the cost lands on the people who own it. Keeping the boundary with its designers preserves both the invariant and the accountability, while the cheap split (data now, boundary by the owner) unblocks the relocation without gating it on a risky rewrite.

<!-- /entry -->

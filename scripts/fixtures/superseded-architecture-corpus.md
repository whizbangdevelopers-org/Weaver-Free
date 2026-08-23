<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Regression corpus for `audit:superseded-architecture`
#
# Read and asserted by the auditor ON EVERY RUN. If any CATCH line stops being caught, or any
# IGNORE line starts being flagged, the auditor fails BEFORE it scans a single spec.
#
# WHY THIS EXISTS
#
# WVR-72 eliminated the `/api/containers` vs `/api/vms` split on 2026-03-20. The v1.1.0 and
# v1.2.0 agent specs went on specifying it until 2026-07-26 — four months of handing Forge a
# dead architecture to build. One manual review caught it. No review will keep catching it.
#
# Both halves of this corpus are load-bearing, and the IGNORE half is the one that decides
# whether this auditor survives. Every document that RECORDS a retirement necessarily names
# the retired thing — often dozens of times. An auditor that flags the retirement notice is an
# auditor somebody disables on its first real run, and a disabled auditor catches nothing at
# all. A rule that flags everything is exactly as useless as one that flags nothing; the two
# halves below are what make "found nothing" distinguishable from "cannot find anything".
#
# Format:  CATCH <line>   — the auditor MUST report this
#          IGNORE <line>  — the auditor MUST NOT report this
# Blank lines and #-comments are skipped.

# --- CATCH: a spec naming a retired artifact as the thing to build -------------------------
CATCH Add `POST /api/containers` for container creation.
CATCH | `backend/src/routes/containers.ts` | New | Registers the `/api/containers` tree |
CATCH Extract the runtime adapters into `backend/src/services/container-registry.ts`.
CATCH New file: `backend/src/services/container-runtime.ts` — runtime dispatch.
CATCH Adapters live under `backend/src/services/runtimes/` (docker.ts, podman.ts).
CATCH Stand up the Cognee sidecar with KuzuDB + LanceDB behind a FastAPI process.
CATCH The memory layer is provided by cognee running as a sidecar container.
CATCH Gate the route with `requireTier('premium')`.
CATCH Guard the panel on `TIERS.WEAVER`.
CATCH Mount the view at `WorkbenchPage.vue`.
CATCH Frontend calls `GET /api/vms` to list virtual machines.

# --- IGNORE: the retirement being recorded, not repeated -----------------------------------
# The single most common shape — a spec correcting itself.
IGNORE `/api/containers` was retired by WVR-72; use `/api/workload`.
IGNORE Do not build `/api/containers` — the unified prefix supersedes it.
IGNORE WVR-72 eliminated the `/api/containers` vs `/api/vms` split.
IGNORE `container-registry.ts` no longer exists; container support widens `microvm.ts`.
IGNORE Cognee is retired (WVR-190) — Engram replaces it.
IGNORE The Cognee sidecar was decommissioned on 2026-07-13.
IGNORE Previously the memory layer was Cognee; it is now Engram.
IGNORE `requireTier('premium')` is deprecated — the gate reads `requireTier(config, TIERS.SOLO)`.
IGNORE `TIERS.WEAVER` was renamed to `TIERS.SOLO` in v1.1.0.
IGNORE `WorkbenchPage` is historical; the page is `WeaverPage`.
IGNORE Use `/api/workload` rather than `/api/containers`.
IGNORE The old `services/runtimes/` layout was removed in favour of a single service.
IGNORE Never reintroduce cognee or build against it.
IGNORE Use `microvm.ts` — there is no `container-runtime.ts` and no `services/runtimes/` tree.
IGNORE None of these exist: `/api/containers`, `container-registry.ts`.
IGNORE That design was abandoned — `/api/containers` would be a parallel duplicate stack.
IGNORE No second store and no `/api/containers/:id/tags` — the unified model made this free.

# --- IGNORE: structural historical context -------------------------------------------------
IGNORE | WVR-190 | Cognee retired | The Cognee sidecar is replaced by Engram. |
IGNORE | WVR-72 | Unified workload routes | A single prefix removes /api/containers. |
IGNORE <!-- superseded-ok --> Cognee ran on port 8000 behind the sidecar. <!-- /superseded-ok -->

# --- CATCH: the FRONTEND half of the retired container stack -------------------------------
# Added 2026-07-30. The pattern list carried only container-registry.ts, container-runtime.ts and
# services/runtimes/ — the first three entries of the "Files that must NOT be created" block in
# agents/v1.1.0/container-visibility.md. The other five were unguarded, so a spec could prescribe
# container-store.ts or ContainerDetailPage and pass clean. A Forge sample did exactly that
# (v1.1-container-frontend, live in the queue) and this auditor could not see it.
CATCH Create `code/src/stores/container-store.ts` — a Pinia store for containers.
CATCH Add `src/services/container-api.ts` extending ApiService.
CATCH New route plugin: `backend/src/routes/containers.ts`.
CATCH Zod schemas live in `backend/src/schemas/containers.ts`.
CATCH Mount the detail view at `ContainerDetailPage.vue`.
CATCH Expose `GET /api/runtimes` to list available container runtimes.

# --- IGNORE: the live equivalents of that frontend half ------------------------------------
IGNORE Containers use `src/stores/workload-store.ts` — there is no container-store.ts.
IGNORE `ContainerDetailPage` was never built; the page is `WorkloadDetailPage.vue`.
IGNORE Runtimes are reported inline on `/api/workload`; there is no `/api/runtimes` route.
#
# NOTE — the bare "no <X> route exists" form is DELIBERATELY NOT a marker, and the IGNORE case
# above uses "there is no" instead. That is a judgement, not an oversight, so it is recorded here.
#
# The phrase is real (sub-archive-export.md, config-export-import.md and
# AGENT-PROCESSING-REVIEW-SYNTHESIS.md all use it) — but it appears in genuinely PRESCRIPTIVE
# sentences: "no `/export` route exists anywhere … this agent therefore builds it from zero."
# Admitting it as a historical marker would suppress exactly the sentence shape
# "no <retired thing> exists — so create it", which is a real violation and the single worst thing
# this auditor could learn to ignore. That is the `\breplaces\b` mistake with the polarity
# reversed, and once was enough.
#
# "never built/created/existed/shipped" IS admitted (added alongside these cases): past tense
# cannot carry a live instruction, so it has no such failure mode.
CATCH No `container-store.ts` exists yet — create it as a Pinia store for containers.

# --- CATCH: an ORDINARY-ENGLISH verb must not exonerate a live prescription ----------------
# Added 2026-07-30. `\breplaces\b` sat in same_line_phrases as a bare historical marker and
# suppressed any line that happened to use the verb in its everyday sense. It hid three real
# findings while the suite reported 0 across 140 specs — the exact "green that proves nothing"
# shape core/testing.md warns about. It cannot be narrowed: in both the true and the false case
# the object of "replaces" is an unrelated noun with the retired token elsewhere on the line, so
# no lexical form separates them. The phrase was removed; these pin that it stays removed.
CATCH Toggling to "Run as Container" replaces the preview and routes the import through `POST /api/containers`.
CATCH | Now | Cognee HTTP API | Shim only replaces cognify pipeline — CSM unaffected |
CATCH The dialog replaces its body when the user picks a target, then calls `GET /api/vms`.

# --- IGNORE: genuine supersession prose still has to pass -----------------------------------
# The passive form points at the retirement by construction, and the active form is carried by
# the decision-id correlation. Citing the decision is the house norm anyway.
IGNORE `/api/containers` was replaced by the unified `/api/workload` prefix.
IGNORE Engram replaces the Cognee sidecar (WVR-190).
IGNORE WVR-72 replaced `/api/containers` with a single workload prefix.

# --- IGNORE: near-misses that must NOT trip the patterns -----------------------------------
# Live, correct architecture — the replacement itself is never a violation.
IGNORE Add `POST /api/workload` for unified workload creation.
IGNORE Gate the route with `requireTier(config, TIERS.SOLO)`.
IGNORE Mount the view at `WeaverPage.vue`.
IGNORE The container runtime is auto-detected at scan time.
IGNORE Engram is the knowledge substrate; it is a NixOS service, not a sidecar.
# Substring traps: these contain a pattern's letters but are different tokens.
IGNORE See `docs/api/containers-guide.md` for the container walkthrough.
IGNORE The `cogneeful` identifier is unrelated and must not match.
IGNORE Premium support contracts are sold separately from tiers.

# --- CATCH: the retired licence OPERATOR SECRET, WVR-226 -----------------------------------
# Added 2026-08-23, closing §6.5 of LICENSE-ENFORCEMENT-PLAN — "the gate ships with the fix".
# It did not ship with it. The options were deleted from nixos/default.nix via
# mkRemovedOptionModule, and for six days nothing stopped a spec prescribing them again. On its
# first run this rule found exactly that: plans/v1.3.0/EXECUTION-ROADMAP.md carried a live
# High-priority task row telling Forge to provision `licenseHmacSecret` as a sops secret — an
# instruction that now fails NixOS evaluation on the operator's host rather than in review.
CATCH Provision keys as sops secrets (`licenseKeyFile` + `licenseHmacSecret`), fleet-secrets standard
CATCH Set `services.weaver.licenseHmacSecretFile` to the sops-decrypted path.
CATCH Export `LICENSE_HMAC_SECRET` in the entrypoint so the backend can validate the key.
CATCH The harness passes `LICENSE_HMAC_SECRET_FILE` to each licensed tier node.

# --- IGNORE: that retirement being recorded ------------------------------------------------
IGNORE `licenseHmacSecret` was removed by WVR-226; the host reads `licenseKeyFile`.
IGNORE Never reintroduce `LICENSE_HMAC_SECRET` — verification material is compiled into the build.
IGNORE Previously every host set `LICENSE_HMAC_SECRET`; that option no longer exists.
IGNORE | WVR-226 | Operator secret removed | `licenseHmacSecret` is replaced by an Ed25519 signature. |

# --- IGNORE: near-misses that must NOT trip the licence patterns ---------------------------
# The live option is a different token, and the trailing-underscore trap is why the pattern
# spells `(?:_FILE)?` explicitly instead of ending at a word boundary.
IGNORE Set `services.weaver.licenseKeyFile` to the sops-decrypted path.
IGNORE `LICENSE_HMAC_SECRET_ROTATION_NOTES` is an unrelated identifier and must not match.
IGNORE Mint the lab keys with `generateLicenseKey` and install them as `licenseKeyFile`.

# --- CATCH: the retired a-la-carte EXTENSION ENTITLEMENTS, WVR-96 --------------------------
# Added 2026-08-23. WVR-96 retired this on 2026-03-25 and it has needed a mechanism ever since:
# WVR-216 and WVR-218 each re-targeted work that ORIGINALLY carried the entitlements design, and
# each had to warn in prose that re-targeting must not resurrect it. Three prose warnings and no
# checker is how a dead design comes back inside a live re-scoping.
CATCH Add an entitlements parser in `license.ts` reading `PLUGIN_ENTITLEMENTS`.
CATCH The Stripe webhook writes a signed entitlements file to `PLUGIN_ENTITLEMENTS_FILE`.
CATCH | Env var | `PLUGIN_ENTITLEMENTS` | Signed JSON, HMAC over the plugin list |

# --- IGNORE: the retirement being recorded, and the gate that SURVIVED it -------------------
# requirePlugin() is deliberately absent from the patterns. WVR-96 kept it and repointed it at the
# tier key, so flagging it would flag live architecture — the failure mode that gets an auditor
# switched off, after which it catches nothing at all.
IGNORE Do not resurrect the entitlements model — `PLUGIN_ENTITLEMENTS` is retired by WVR-96.
IGNORE `PLUGIN_ENTITLEMENTS_FILE` no longer exists; extensions derive from the tier key.
IGNORE The signed entitlements JSON was replaced by tier gating (WVR-96).
IGNORE Gate the extension with `requirePlugin('dns-core')` — it reads the tier key.

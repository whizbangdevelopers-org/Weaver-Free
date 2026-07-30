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

# --- IGNORE: structural historical context -------------------------------------------------
IGNORE | WVR-190 | Cognee retired | The Cognee sidecar is replaced by Engram. |
IGNORE | WVR-72 | Unified workload routes | A single prefix removes /api/containers. |
IGNORE <!-- superseded-ok --> Cognee ran on port 8000 behind the sidecar. <!-- /superseded-ok -->

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

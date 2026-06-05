<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — devops

Lessons learned in the **devops** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-devops-2026-05-14-001 -->
---
id: L-devops-2026-05-14-001
type: lesson
domain: devops
tags: [deploy, npm-scripts, rsync, build-pipeline, tool]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-devops-2026-05-13-001]
graduated_to: ""
---

## Root-level `build:<tool>` script for tools with external deploy targets — 2026-05-14 · Claude

**Root cause:** A tool with its own `package.json` and an external deploy target (rsync, scp, S3 upload) naturally gets a `build` script that only builds locally. When a developer runs `npm run build` from inside the tool directory, the build succeeds but nothing reaches the live environment — the deploy step is a separate script that's easy to forget. This pattern caused repeated "why aren't my changes visible?" confusion with engram-ui, even after the gotcha was documented.

**Rule:** For any tool with an external deploy target, add a `build:<tool>` script at the project root that chains build + deploy in a single command. Name it following the existing `build:backend`, `build:tui` convention so it's discoverable alongside other build targets. Document it in `CLAUDE.md` Key Commands with a note that this is the only correct build command for that tool.

**Why this shape wins:** A developer running builds from the project root sees `build:engram-ui` alongside `build:backend` and `build:tui` — the deploy is not a separate mental step, it's baked into the standard build invocation. The bare `build` script inside the tool directory can remain for CI contexts that need build-only, but the root script is the canonical developer path. Documentation alone (gotchas, CLAUDE.md) doesn't prevent the mistake — the script structure does.

<!-- /entry -->

<!-- entry:L-devops-2026-06-01-001 -->
---
id: L-devops-2026-06-01-001
type: lesson
domain: devops
tags: [storage, nas, nfs, llm, mlock, mount-naming]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Store large model files on NAS with mlock — single load, free local SSD — 2026-06-01 · Claude

**Root cause:** Considered storing a 32GB Q8_0 model on the local NVMe of the inference machine. The NVMe is 2TB and would fit, but it would consume a third of the drive that's better used for the Nix store and build artifacts — which are large, frequently written, and don't benefit from NAS latency.

**Rule:** For inference machines where the model is mlock'd into RAM on startup: store the model file on NAS. The load time penalty (1G NIC at ~125 MB/s → ~4 minutes for 32GB) only occurs at llama-server startup. Once locked, the model never touches storage again until the service restarts. Local NVMe is better used for Nix store, Docker image layers, and build caches — all of which benefit from low-latency random I/O.

Name the mount point after the share, not the device: `/mnt/foundry-models` not `/mnt/nas`. When multiple machines share a NAS, `/mnt/nas` is ambiguous — `/mnt/foundry-models` communicates exactly what the mount contains and which machine it's for.

**Why this shape wins:** The NAS stores the model once. If the inference machine is replaced, reprovisioned, or re-imaged, the model is already where it needs to be — no 32GB re-download. The per-share mount name also prevents confusion when the NAS serves multiple hosts from different shares.

<!-- /entry -->

<!-- entry:L-devops-2026-06-01-002 -->
---
id: L-devops-2026-06-01-002
type: lesson
domain: devops
tags: [ssh, infra-users, root, service-accounts, privilege-separation, headless]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-01-004]
graduated_to: ""
---

## Headless infra nodes get no human login user — root-from-admin-host + purpose-named service users — 2026-06-01 · Claude

**Root cause:** We copied a workstation-identity user (`mark`) onto a headless inference/agent node because the scaffold config came from a workstation (king) that has one. An infra node managed entirely from an admin host has no interactive human at its console — so the human user is an identity that corresponds to no one, an extra key to rotate, and (when root SSH is disabled in the same rebuild) the direct cause of a lockout.

**Rule:** Decide accounts from what the node *is*, not from the config you copied:
- **Admin** → `root` over SSH, key-only (`PermitRootLogin = "prohibit-password"`, `PasswordAuthentication = false`), keys for each admin host (workstation + any orchestrator). Keeping root SSH alive is what makes the node lockout-proof — there is always one management path that no per-user provisioning step can break.
- **Workloads that must not run as root** (agents, builders, CI) → a **purpose-named, unprivileged service user** (`forge`, `builder`) with only the groups it needs (`docker`) and **no sudo**. Never a mirror of the workstation identity. If a task needs one privileged action, add a narrow audited NOPASSWD rule for that exact command — never blanket wheel.
- **Interactive human user** → none, unless someone genuinely sits at the box.

**Why this shape wins:** It removes a whole failure class instead of working around it. There is no half-provisioned login account to lock you out, the agent blast radius is bounded (unprivileged, no sudo), and "who is this user" always has an answer. The contrast is sharp: the workaround was "add NOPASSWD sudo + an initial password so the human user can self-manage"; the root-cause fix is "the node has no human user, and root-from-admin-host is the management path." See [[G-nixos-2026-06-01-004]].

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-001 -->
---
id: L-devops-2026-06-02-001
type: lesson
domain: devops
tags: [nfs, nfsv3, nat, passthrough, gateway, model-storage, nolock]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-devops-2026-06-02-001, G-nixos-2026-06-02-001]
graduated_to: ""
---

## NFSv3 survives NAT masquerade with nolock — gateway-passthrough model storage — 2026-06-02 · Claude

**Root cause:** A GPU/inference node with only a private-subnet NIC needed a 34 GB model that lives on a NAS on another VLAN, reachable only through a NAT gateway. NFSv4 (single port 2049) would NAT cleanly, but the NAS is NFSv3-only. NFSv3's "doesn't survive NAT" reputation comes from its ancillary services (mountd/statd/lockd on dynamic ports + server→client lock callbacks).

**Rule:** Mount NFSv3 through a masquerade with `-o nfsvers=3,nolock,ro,proto=tcp`. `nolock` drops statd/lockd, so every connection is client-initiated (portmapper 111 → mountd → nfsd 2049) and conntrack/SNAT carries it — no inbound callbacks to break. `ro`+`nolock` is exactly right for a read-only mmap/mlock model load. The gateway stores nothing — pure passthrough; the model lives only on the NAS, so both the gateway and the consumer keep their disk free and models stay swappable from one place.

**Why this shape wins:** One canonical copy on the NAS, zero duplication, no fragile NFS re-export server — the gateway is just the router it already is. Caveats: a 32 GB read over a 1 G NAS link takes ~4–5 min at service start (one-time with mlock; set `TimeoutStartSec` generously), the mount-root dir must be traversable by the service user (see [[G-devops-2026-06-02-001]]), and the gateway's forwarding must be networkd-proof (see [[G-nixos-2026-06-02-001]]).

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-002 -->
---
id: L-devops-2026-06-02-002
type: lesson
domain: devops
tags: [release, ci, workflow, dry-run, github-actions]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Dry-run every release workflow on an RC tag — never-triggered workflows accumulate silent failures — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-10)

**Root cause:** The v1.0.0 `release.yml` had never been executed. Code, tests, and docs were ready, but the first RC tag push failed immediately and surfaced four-plus stacked failures, each masking the next: `setup-node` cache path searched the repo root instead of `code/`; Node pinned to 20 while `@quasar/app-vite` needs 22; CI installed only frontend+backend deps but `build:all` builds the TUI; Quasar PWA mode outputs `dist/pwa/` not `dist/spa/`; `attest-build-provenance` requires a public repo or paid plan. Every fix unblocked the next.

**Rule:** Always run a release workflow as a dry-run (RC tag or `workflow_dispatch`) well before the actual release tag. A workflow that has never been triggered has accumulated path mismatches, version drift, and missing deps that only surface at the worst possible time. Each fix exposes the next failure in sequence, so the dry-run must be early enough to absorb multiple round-trips.

**Why this shape wins:** The cost of a dry-run is a throwaway RC tag; the cost of skipping it is discovering the same failures at release hour under time pressure. Network-dependent steps (cosign OIDC, NUR dispatch, demo deploy, attestations) cannot be simulated locally — they only run in Actions with live secrets — so the dry-run is the only place those steps get validated before they're load-bearing.

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-003 -->
---
id: L-devops-2026-06-02-003
type: lesson
domain: devops
tags: [npm-workspaces, buildnpmpackage, lockfile, nix, monorepo]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-02-004, G-nixos-2026-06-02-010]
graduated_to: ""
---

## One product = one lockfile — npm workspaces beats per-package lockfiles for Nix packaging — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Root cause:** The project shipped with three `package-lock.json` files (root, `backend/`, `tui/`), each with its own `fetchNpmDeps` entry and a manual `npm ci --cache` in `buildPhase`. It worked until the v1.0 Nix install smoke test: `fetchNpmDeps`' cache format was unreadable by `npm ci --cache` in the sandbox (`ENOTCACHED ... cache mode is 'only-if-cached'`), and the backend lockfile had 322 packages without `integrity` fields (lockfile v3 drops them for bundled/git deps), so `prefetch-npm-deps` panicked with `dependency should have a hash`. The real cause was architectural — `buildNpmPackage`'s `npmConfigHook` handles cache setup correctly for exactly ONE lockfile.

**Rule:** Use npm workspaces from day one for related packages of a single product. Root `package.json` declares `"workspaces": [...]`, sub-package lockfiles are deleted, one `npm install` produces a unified tree, and `nixos/package.nix` collapses to a single `npmDepsHash` with `npmConfigHook` doing all the work. The custom `buildPhase` just runs `npm run build` per workspace — deps are already in place.

**Why this shape wins:** Multiple lockfiles for one product are architectural debt — three lockfiles mean three incompatible install paths, and you eventually ship bespoke cache-wrangling code to bridge them under Nix. A single root lockfile is the only shape `buildNpmPackage` supports cleanly, and the upfront workspaces complexity is trivial by comparison.

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-004 -->
---
id: L-devops-2026-06-02-004
type: lesson
domain: devops
tags: [sync-to-free, rsync, pat, mirror, public-repo, content-audit]
since_version: "1.0.5"
status: active
scope: project
related: [G-devops-2026-06-02-002, G-devops-2026-06-02-003, G-devops-2026-06-02-005]
graduated_to: ""
---

## Dev→Free sync is a real subsystem — PAT scope, rsync semantics, and content audit all carry product risk — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-16)

**Root cause:** The sync-to-free Action failed silently for 6+ days (37 consecutive runs) because the PAT lacked `pull-request: write` scope — it pushed sync branches but couldn't open PRs, so Weaver-Free's main was frozen at a pre-automation state still containing the full Dev repo root (`agents/`, `business/`, `forge/`, `plans/`, `MASTER-PLAN.md`). Compounding it: `rsync --delete` with `--exclude` does NOT delete previously-synced files now matching an exclude — exclude means "don't touch" in both directions — so newly-added exclusions never cleaned up files already mirrored. A deep content audit then found leaks the file-level exclude list couldn't catch: `generateLicenseKey()`'s full HMAC algorithm, competitive positioning in `demo.ts`, and `Decision #NNN` references across 21 files.

**Rule:** Treat the Dev→Free sync workflow as a real subsystem, not plumbing. (1) After creating or rotating a PAT, trigger the workflow manually and watch it — don't assume the next automatic run will surface a scope problem. (2) Tier-prefix PAT names (`WEAVER_FREE_SYNC`), one PAT per target repo. (3) When expanding the exclude list, do a manual cleanup pass or use `--delete-excluded` — `--exclude` alone protects existing copies from deletion. (4) The exclude list catches FILES but not CONTENT within shipped files — run a deep content grep (competitive comments, internal references, algorithm source) after any major exclude expansion. (5) Demo stays in Dev: the public demo is built from Dev, so Free never needs `demo.ts`/pricing/mock data — that single decision eliminated every HIGH content-audit finding.

**Why this shape wins:** The sync workflow carries load-bearing decisions about exactly what reaches the public mirror; a wrong change doesn't just fail to copy — it leaks proprietary content or breaks rebuild-from-source for Free users in ways that take significant debugging to trace back to a one-line sync tweak. Naming, scope, and a content-audit gate make the leak surface auditable instead of trusting reviewers to notice.

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-005 -->
---
id: L-devops-2026-06-02-005
type: lesson
domain: devops
tags: [release, immutable-tags, git-worktree, ci, patch-release]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Released tags are immutable — build artifacts from a worktree, ship a patch, never move the tag — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-18)

**Root cause:** Two release-engineering traps converged. (1) `gh run rerun` replays a workflow at the commit that originally triggered it (the tag's commit), not at current `main` — so a CI fix merged to `main` never reaches a rerun of an already-tagged release. (2) Moving the tag forward to pick up the fix is destructive: a tag is a reproducibility contract, downstream package managers (NUR, Homebrew, nixpkgs) cache hashes keyed to the tag, and any attestation of the original commit becomes meaningless when the tag moves.

**Rule:** For a tagged release with broken CI whose fix is already on `main`, the non-destructive order is: (1) merge the fix to `main`; (2) `git worktree add /tmp/build <tag>` for a clean checkout at the tagged commit and build artifacts locally with the fixed approach (`npm ci` + `npm run build:all` + tarball + SBOM); (3) `gh release upload <tag> ...` the artifacts; (4) the next tag gets green CI for free. If the *content* (not just CI) was broken, ship a patch release — the original tag stays at its original SHA with its original artifacts, and the CHANGELOG documents it as a known-limited bootstrap. When automation blocks mid-flight, doing the manual steps (create the Free tag via API, download Dev artifacts, `gh release create` on Free, compute NAR hash, dispatch NUR) is the right fallback — commit the automation fix separately.

**Why this shape wins:** Immutable tags keep the build-provenance log monotonic and downstream hash caches valid. The worktree-build path completes a release in ~15 minutes without rewriting history, where waiting for an unblocked pipeline leaves the release half-shipped for an indefinite window. Manual fallback is a core release-engineering skill, not a failure mode.

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-006 -->
---
id: L-devops-2026-06-02-006
type: lesson
domain: devops
tags: [free-tarball, downstream-build, sync-flatten, nur, release-builds]
since_version: "1.0.5"
status: active
scope: project
related: [G-nixos-2026-06-02-004]
graduated_to: ""
---

## Every source transformation needs its own sandbox build — Dev's monorepo layout doesn't validate the Free tarball — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-18)

**Root cause:** Until v1.0.1, nobody had ever successfully built Weaver from the public Free tarball. Dev CI ran `npm run build:all` on the monorepo layout every push, but the Free repo is flattened (`code/` → root) by the sync workflow, and nothing tested the flattened layout. v1.0.0 published with PWA tarball + SBOMs, but the auto-attached source tarball was effectively unbuildable — ~97 unguarded imports of sync-excluded paths, a `../scripts/` path escape in `prebuild`, and an `audit:docs-links` call referencing a sync-excluded auditor. NUR dispatch hit this the instant it ran `nix-build -A weaver-free`.

**Rule:** Every release pipeline that applies a transformation to source — sync-flattening, rsync filtering, Docker layering — must simulate that transformation and run a real build in a fresh sandbox before the release tag is pushed. Smoke testing on Dev's monorepo layout does not validate what downstream consumers (Free tarball, Docker image, NUR package, external contributors) actually see. The `audit:release-builds` auditor now does this for the `free-tarball` context. Corollary: GitHub's auto-attached source tarball is not a shipping artifact unless some CI job has actually built from it.

**Why this shape wins:** The sandbox build is the only thing that exercises the exact tree a downstream consumer receives; everything short of it (auditors, Dev builds) tests a different layout. Pairing the transformation with a sandbox build turns "ship and find out from an NUR failure" into a pre-push gate.

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-007 -->
---
id: L-devops-2026-06-02-007
type: lesson
domain: devops
tags: [nur, dispatch, npm-deps-hash, workflow-handshake, payload-parity]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-02-010]
graduated_to: ""
---

## A workflow handshake where the receiver tolerates missing fields needs a sender-side parity auditor — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-21)

**Root cause:** v1.0.2 ran all release jobs green, then NUR's auto-update failed at `-npm-deps.drv` with a hash mismatch. The "got" value was the current `code/nixos/package.nix` `npmDepsHash`; the "specified" value was a stale hash in NUR's `default.nix`. This was a two-hash problem masquerading as one: `src.hash` (source tarball SRI) was dispatched and worked, but `npmDepsHash` (buildNpmPackage's lockfile prefetch) was never sent. The receiver was *correctly* designed — it read `npmDepsHash` from the payload, fell back gracefully when absent, and left the field alone — and that graceful fallback is exactly what let the bug hide across multiple releases. The sender was never updated to match the receiver's accepted-fields contract.

**Rule:** When workflow A dispatches a payload to workflow B and B handles missing fields gracefully, the handshake has no natural failure mode at integration time — a silently-stale field will ship in a release eventually. Add a static auditor on the sender that cross-checks the receiver's accepted-fields list (here `audit:nur-dispatch-completeness` parses `release.yml`, finds every `repository-dispatch` targeting the NUR repo, and verifies the payload carries `version`, `hash`, AND `npmDepsHash` — and refuses hardcoded hash literals so CI must compute them at release time). The auditor IS the handshake.

**Why this shape wins:** A receiver with `if (x) applyX()` fallback-on-missing logic for a field that should always be present is baked-in future staleness. Either make the receiver fail loud on the missing field, or guarantee the sender always sends it with a static check on the same PR that introduces the handshake. This is the same class as parallel sync-path drift — two workflows that must agree on a contract with nothing checking that they do.

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-008 -->
---
id: L-devops-2026-06-02-008
type: lesson
domain: devops
tags: [ci, push-triggers, pre-push-hook, release-certification, schedule]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## When the pre-push hook does verification, GitHub CI's role is release certification — drop redundant push triggers — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-27)

**Root cause:** CI workflows are usually set up early — before robust hooks exist — with push triggers as the default. Once a pre-push hook runs lint, typecheck, the full unit suite, security audit, and every static auditor before a commit reaches GitHub, those push-triggered Tests/Security/lint workflows duplicate work the hook already did, but nothing enforces removing the redundant triggers.

**Rule:** Pick the trigger by the workflow's actual role. Workflows that duplicate the pre-push hook (Tests, Security Scan, lint) trigger on tags only. Genuinely release-specific workflows (Release, Sync to Free, Demo Deploy) stay on tags. Workflows that scan the public repo's outputs (CodeQL, Socket) run on schedule. Dependabot runs on PR. The deciding question for any synced Dev→Free workflow: does the trigger have value on at least one of the two repos? If yes on Free only → keep it and accept the Dev runner-startup cost; if no on either → remove it. Exception: keep the `push:` trigger on `codeql.yml` — OpenSSF Scorecard's SAST check requires it for 10/10 (`audit:openssf-baseline` enforces this).

**Why this shape wins:** Trigger-by-role eliminates wasted runner minutes without losing any coverage the hook already guarantees, and it makes each workflow's purpose legible from its trigger. The one accepted exception (CodeQL push) is cheap (seconds to evaluate a visibility check and exit on Dev) and buys a concrete score the alternative — per-repo workflow forks — doesn't justify.

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-009 -->
---
id: L-devops-2026-06-02-009
type: lesson
domain: devops
tags: [ci, shallow-clone, fetch-depth, git-log, developer-machine-state, auditor-guard]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## CI auditors that read git history need fetch-depth:0; auditors that read developer-machine state need a CI guard — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-25)

**Root cause:** Two auditors passed locally but failed in every CI compliance run. (1) `audit:feature-lifecycle-parity` calls `git log --follow -1 --format=%cs -- <file>` for a file's last-commit date; with a shallow checkout (depth 1), if the file wasn't in the most recent commit `git log` returns empty and the fallback `new Date()` produces today's date, which never matches the committed view date → always "stale." (2) `audit:skill-parity` requires `scope: both` skills to exist in both `~/.claude/skills/` and the project; CI runners have no user home `.claude` directory, so the user-copy check always failed.

**Rule:** Any CI job whose auditors call `git log` internally needs `fetch-depth: 0` on the checkout step — full history lets `git log` find the correct last-commit date for any file. Any auditor that relies on developer-machine state (user home directory, installed tools, credentials) needs a `GITHUB_ACTIONS` env guard that skips the machine-specific check in CI — the fix goes in the auditor, not the CI environment. (Related trap: count auditors from the authoritative source, not a regex over `package.json` — refactoring the `test:compliance` script from an `&&`-chain to a runner script silently zeroed a regex-based auditor count.)

**Why this shape wins:** `fetch-depth: 0` makes the deterministic-date contract hold in CI exactly as it does locally, eliminating a class of false "stale" failures. Guarding machine-state checks in the auditor keeps the auditor honest on developer machines (where the invariant is real) while not failing CI for state CI legitimately can't have.

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-010 -->
---
id: L-devops-2026-06-02-010
type: lesson
domain: devops
tags: [socket-dev, supply-chain, ci, cli, scan]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Socket.dev CI: call @socketsecurity/cli directly — the Action's cli mode is unimplemented — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-25)

**Root cause:** `SocketDev/action@v1.3.2` documents `mode: cli` in its `action.yml` but never implemented it in the compiled `dist/main.js` — it exits with "Unsupported mode: cli" while confusingly listing cli among supported modes. Calling the npm CLI directly then surfaced more friction: `socket scan` (no subcommand) shows help and exits 2 (use `socket scan create`); `scan create` without `--org` exits 2 ("no default org") because the org slug is not inferred from the API key; and `scan create --report` exits 1 when it finds policy violations, which is intended, not an error.

**Rule:** Don't use `SocketDev/action` until a version actually implements CLI mode — call `npx --yes @socketsecurity/cli scan create` directly. Always pass `--org "${{ secrets.SOCKET_ORG_SLUG }}"` (the slug must be explicit), `--no-interactive`, and `continue-on-error: true` while establishing a baseline (so an intended policy-violation exit-1 doesn't fail the job). Setup needs two secrets: `SOCKET_SECURITY_API_KEY` and `SOCKET_ORG_SLUG`. The IDE YAML linter flagging unverifiable `secrets.*` references is a false positive.

**Why this shape wins:** Going straight to the CLI bypasses the Action's unbuilt code path entirely and gives explicit control over org, interactivity, and exit-code handling — the three things the Action obscured. Socket.dev's flow-based supply-chain analysis is complementary to CodeQL and npm audit (distinct threat models, no overlap), so it earns its place in CI once wired correctly.

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-011 -->
---
id: L-devops-2026-06-02-011
type: lesson
domain: devops
tags: [release-checklist, prerelease, e2e, regression, trigger-files]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Re-run the release-critical test layer when a session touched any file feeding a checklist step — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-24)

**Root cause:** A release-checklist step can pass early in a release cycle and then be silently invalidated by a later commit in the same session. Files like `src/pages/DocsPage.vue` or bundle scripts feed `test:prerelease`; `scripts/test-distros-live.sh` feeds `test:distros:live`; backend route/auth files feed `test:prerelease`. Editing them after the gate ran means the green result no longer reflects the shipped tree.

**Rule:** After any session that modifies files in the release-critical surface (scripts, frontend pages that affect the bundle, backend routes, auth middleware), re-run `test:prerelease` before continuing to the NixOS gate — even if it passed earlier. The E2E suite is the only layer that exercises the full bundle + backend + spec path together; `test:compliance` alone won't catch a catalog label misspelling or a wrong spec assertion.

**Why this shape wins:** The cost of re-running `test:prerelease` is ~4 minutes; catching the same bug post-tag is far more expensive (immutable tags mean a patch release, not an edit). Mapping trigger-files to checklist steps makes "did my changes invalidate a gate?" a mechanical check instead of a judgment call.

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-012 -->
---
id: L-devops-2026-06-02-012
type: lesson
domain: devops
tags: [git, filter-repo, remotes, tracking-ref, history-rewrite]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## git filter-repo strips remotes and upstream tracking refs — restore both after every run — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-03-27)

**Root cause:** After running `git filter-repo --message-callback` to rewrite commit messages across 4 repos, VSCode showed "Publish Branch" on all of them. The force-push had succeeded, but branches had no upstream. `filter-repo` removes all remote-tracking refs and remote definitions as a deliberate safety measure — it doesn't want a dirty push to happen automatically after a history rewrite. The `origin` entry disappears entirely, and even after re-adding it the local branch still has no `branch.<name>.remote` / `branch.<name>.merge` config.

**Rule:** After any `git filter-repo` run, two steps are required before the repo is fully operational:
1. `git remote add origin <url>` — re-add the remote (filter-repo removes it).
2. `git branch --set-upstream-to=origin/main main` — restore the tracking ref.
Both are needed — re-adding the remote alone does not restore tracking; VSCode keeps showing "Publish Branch" until the tracking ref is set.

**Why this shape wins:** Treating the two-step restore as a mandatory post-filter-repo ritual removes the "why does VSCode want to publish an already-pushed branch?" confusion class entirely, because the safety-stripping is expected and immediately reversed.

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-013 -->
---
id: L-devops-2026-06-02-013
type: lesson
domain: devops
tags: [npm, npm-run, cli-args, nested-scripts, arg-passthrough]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ".claude/rules/scripts.md"
---

## Double-nested npm run silently swallows CLI args — invoke the binary directly — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-25)

**Root cause:** The `start:tui` script was `npm --prefix tui run start` — a nested npm call. When the user runs `npm run start:tui -- --demo`, npm appends `--demo`, producing `npm --prefix tui run start --demo`. The inner npm sees `--demo` as its OWN flag (no `--` separator precedes it), so the flag is silently ignored — no error, no warning. The final `node dist/index.js` runs with zero args, and demo mode falls through to the auth flow as if nothing was passed.

**Rule:** Never nest `npm run` inside an `npm run` script when the outer script must pass CLI args through. Invoke the binary directly (`node tui/dist/index.js`) or use a shell wrapper that forwards `"$@"`. This applies to any user-invoked script chain where `--` args must survive: `start:*`, `dev:*`, or any wrapper.

**Why this shape wins:** The failure is completely silent — npm doesn't warn about unknown flags and the app launches "normally." A single-hop invocation makes arg passthrough deterministic, removing an entire class of "the flag had no effect and nothing told me why" debugging.

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-014 -->
---
id: L-devops-2026-06-02-014
type: lesson
domain: devops
tags: [local-llm, model-selection, agentic, tool-calling, llama-cpp, qwen]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-devops-2026-06-02-030]
graduated_to: ""
---

## Local agentic models: start near the newest, not the oldest "safe" one — 2026-06-02 · Mark + Claude

**Root cause:** We started the local agent-model search at a conservative older model (Qwen2.5-Coder-32B) and had to climb a ladder, paying a full download + debug cycle per rung:
- Qwen2.5-Coder-32B → tool-calling fundamentally broken (llama.cpp emits the wrong `<tools>` tag, nothing parses).
- Qwen3-Coder-30B-A3B → tool calls parse, but fail whenever the model writes a preamble before the call (#20260).
- Qwen3.5-35B-A3B → first generation where agentic tool-calling is a *solved* problem (community ships fixed chat templates; Unsloth bakes them into the GGUF).

**Rule:** For local models used as agents (tool-calling via llama.cpp + Claude Code / similar), **start near the top of the model ladder — roughly the second-from-newest — not the oldest model you trust.** The capability gap between generations on *agentic tool-calling* is large and improving fast (bigger than quant differences). Newer models behave better AND the ecosystem (GGUF quants, fixed minijinja templates, llama.cpp tool parsers) has caught up by the second-newest. Avoid the absolute bleeding edge only because of tooling *lag* (a brand-new tool format llama.cpp can't parse yet, MTP needing a newer build) — hence *second*-from-newest as the pragmatic sweet spot: recent enough to benefit, mature enough to be supported.

**Why this shape wins:** Starting old means paying a download + debug cycle for every rung you climb to discover newer was the answer all along (this session: 3 generations, 3 cycles). The NAS-passthrough model storage makes swapping cheap, so the cost of biasing toward newer is low and the upside is large. See [[G-devops-2026-06-02-030]].

<!-- /entry -->

<!-- entry:L-devops-2026-06-04-001 -->
---
id: L-devops-2026-06-04-001
type: lesson
domain: devops
tags: [local-llm, model-selection, agentic, coder, moe, tool-calling]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-devops-2026-06-02-014, G-devops-2026-06-03-001]
graduated_to: ""
---

## Pick a local agentic CODE executor for coding ability, not for tool-calling — 2026-06-04 · Claude

**Root cause:** Climbing the model ladder to fix agentic TOOL-CALLING landed us on a general/uncensored MoE (Qwen3.x-35B-A3B, ~3B ACTIVE params). It drove Claude Code's tools fine but **wandered on real code** — made one correct edit on a multi-file rename, then lost the thread and timed out. The "newest model" heuristic ([[L-devops-2026-06-02-014]]) optimized the wrong axis. Swapping to a **coder-tuned** model (Qwen3-Coder-30B-A3B-Instruct) on the same harness completed the same task.

**Rule:** For an agentic code executor, select for **coding capability** — coder-tuned, and enough ACTIVE params (a 3B-active MoE is far weaker at code than a dense ~32B, regardless of total params). **Decouple tool-calling from model choice** with a proxy (route the OpenAI endpoint, strip the per-turn billing header for caching, recover leaked `<function=>` calls — see [[G-devops-2026-06-03-001]]). Then you're free to pick the best coder instead of the cleanest native tool-caller.

**Why this shape wins:** tool-calling is a *harness* problem — solve it once in the proxy and it's done for any model. Coding ability is the model's irreducible job. Optimizing the model pick for the harness problem starves the real one.

<!-- /entry -->

<!-- entry:L-devops-2026-06-04-002 -->
---
id: L-devops-2026-06-04-002
type: lesson
domain: devops
tags: [ssh, agentless, fleet, observability, heterogeneous]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Agentless SSH-stdin collection beats deploy-an-agent for heterogeneous fleets without a common runtime — 2026-06-04 · Claude

**Root cause:** The first fleet-view cut required Node ≥18 on each target (rsync the tool, `ssh host node observer.mjs`). A real fleet sweep killed that assumption: of 11 hosts, only 2 had modern Node — the rest were CentOS 7 (Node 14/16), a Synology NAS, and Node-less NixOS/Ubuntu boxes. Deploying a runtime to each (or installing the agent) is a non-starter for "observe now."

**Rule:** To collect from a heterogeneous fleet *now*, push a **POSIX `sh` collector over SSH stdin** (`ssh host 'sh -s' < collect.sh`, or spawn ssh and write the script to stdin) and parse a simple delimited line protocol on the aggregator. Nothing installed, nothing copied, no runtime assumed beyond `sh`/`awk`/`grep`. Run the aggregator from any one host that *does* have your tooling. This reached all 9 reachable hosts in one pass.

**Why this shape wins:** it cleanly separates the prototype-now bridge from the shipping answer. Agentless SSH is a *pull from a privileged box* — fine for dogfooding, wrong as a foundation (no security boundary, needs SSH to every host). The permanent answer for no-runtime hosts is a **static binary** (Rust here) with zero deps, installed once. Use agentless to prove value and discover the fleet's real shape; let what it can't do (permanent, secured, on-host presence) define the binary's spec.

<!-- /entry -->

<!-- entry:L-devops-2026-06-04-003 -->
---
id: L-devops-2026-06-04-003
type: lesson
domain: devops
tags: [forge-loop, review, diff, orchestrator, accumulate]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## A review tier must judge the cumulative slice, not the incremental fix, across reject cycles — 2026-06-04 · Claude

**Root cause:** In an accumulate-on-a-feature-branch loop, capturing each gate-green diff as `git diff --cached HEAD` (vs the immediate parent) means that after a review-reject re-execute, the reviewer sees only the *patch* the executor just made — not the whole slice. It loses the context to judge whether the slice as a whole is correct, and an accept on a fix-only diff is judging the wrong artifact.

**Rule:** Record the slice's BASE ref (the feature-branch tip when the slice first started) once, and diff every gate-green state against that base (`git diff --cached <slice_base>`). The review tier then always evaluates the cumulative slice, stable across any number of reject→re-execute cycles. Store the base in the task's runtime record so a resumed/re-executed run reuses it.

**Why this shape wins:** the gate proves *behavior* on the current tree regardless of diff framing, but the human-replacing REVIEW is only as good as the artifact it reads. Anchoring the review diff to the slice base decouples "what the reviewer sees" from "how many commits the executor needed" — exactly the property you want when the executor iterates.
<!-- /entry -->

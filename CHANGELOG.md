<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.4] - 2026-04-26

Closes the security hardening backlog for the v1.0 series: username-in-password check, Terms of Service scroll-to-accept gate on first-run setup, Semgrep taint analysis for the four highest-priority injection classes, and a CodeQL ↔ Semgrep coverage gap detector that keeps the two tools honest against each other. No user-visible product changes beyond the ToS gate.

### Added

- **Username-in-password validation** — backend `validatePasswordStrength()` now rejects passwords that contain the account username (case-insensitive substring match). Applied at register and `POST /api/auth/change-password`. Frontend mirrors the check in real-time on the `UsersPage` and `LoginPage` first-run forms. All test fixtures updated to `T3stP@ssw0rd!X` (a role-independent constant that satisfies every constraint including the new rule).
- **Terms of Service scroll-to-accept gate** — first-run admin setup now requires the user to scroll to the bottom of the Terms of Service before the acceptance checkbox is enabled and the submit button becomes active. Uses a native scroll event (`scrollTop + clientHeight >= scrollHeight - 20`) on the dialog's overflow container; more reliable than `v-intersection` inside `overflow:auto`. `TERMS-OF-SERVICE.md` and new `TERMS-OF-SERVICE-COMMERCIAL.md` (BSL-1.1, for Solo/Team/Fabrick tiers) are both loaded raw and rendered in the dialog. Tier-gated routing in `DocsPage` routes commercial-tier users to the correct ToS via a reactive `slugToGlobKey` computed map. ADMIN-GUIDE and USER-GUIDE updated with the new setup step and password rule.
- **Semgrep taint analysis (`audit:taint`, auditor #49)** — four custom Semgrep YAML rules scan `backend/src/` for the highest-priority injection classes: `no-raw-execfile-args` (CWE-78, user input → shell command args), `no-user-input-in-path` (CWE-22, user input → filesystem paths), `no-unvalidated-jwt-claim` (CWE-347, unverified JWT payload in auth decisions), `no-ssrf-in-fetch` (CWE-918, user input → outbound HTTP URLs). Exits 0 with a warning when `semgrep` is not in PATH so CI on the Free repo stays green without a semgrep runner. Baseline: 0 findings on 99 backend source files. Wired into `test:compliance`.
- **CodeQL ↔ Semgrep coverage gap detector (`audit:codeql-coverage`, auditor #50)** — `scripts/data/codeql-semgrep-map.json` maps all 21 CodeQL rules active on Weaver-Free against their Semgrep equivalents (4 covered, 1 partially-covered, 5 known-missing, 10 tool-handled, 1 not-applicable). `verify-codeql-semgrep-coverage.ts` reads the map locally (no network), reports coverage % against a committed baseline (current 50%, baseline 45%), and fails on unknown rules or coverage regression. `refresh-codeql-coverage-map.ts` + `codeql-feedback.yml` (daily cron + post-CodeQL trigger) keep the map current using `WEAVER_FREE_CODEQL_READ` and auto-open tracking issues for newly detected unknown rules. Wired into `test:compliance`.

## [1.0.3] - 2026-04-23

Closes the last open item from the NOTES.md #365 SAST roadmap (ReDoS detection), adds a local release-workflow simulator that would have caught all five failures from the v1.0.2 five-attempt release streak before the first tag push, and explains the OpenSSF Scorecard Security-tab meta-findings that first-time visitors sometimes read as code bugs. No user-visible product changes.

### Added

- **New auditor `audit:redos`** — ReDoS (regular expression denial of service) detection using `safe-regex`. Scans `src/`, `backend/src/`, and `tui/src/` for regex literals and `new RegExp()` constructions with catastrophic backtracking potential (star-height ≥ 2). Found and fixed one real star-height-2 pattern in `HostConfigViewer.vue` (NIX_ATTR_PATH syntax-highlighting regex). Closes NOTES.md #365 PR 3. Wired into `test:compliance`.
- **New auditor `audit:release-workflow-dry-run`** — local simulator for the `release.yml` release pipeline. 11 static YAML assertions (workflow permissions posture, cosign version pin, attestation soft-fail guards, rsync source safety, NUR dispatch payload completeness) plus 8 runtime rsync assertions (no Dev-root content leak, `flake.nix`/`flake.lock` present, core files present, CLAUDE.md and `testing/` excluded). Each assertion maps to a class of failure from the v1.0.2 five-attempt release streak. Wired into `test:prerelease`.
- **`docs/security/SCORECARD-FINDINGS-EXPLAINED.md`** — public explainer for the 5 findings shown as "errors" on Weaver-Free's Security tab (Code-ReviewID, FuzzingID, MaintainedID, SASTID, VulnerabilitiesID). Documents what each measures, our current state, and the roadmap to address gaps. Linked from README Security section.

### Fixed

- **`HostConfigViewer.vue` NIX_ATTR_PATH regex** — replaced `/\b([\w-]+(?:\.[\w-]+)+)\s*(?==)/g` (star-height 2: `[\w-]+` inside `(?:...)+`) with `/\b([\w][\w.-]*[\w])(?=\s*=)/g` (star-height 1). The original pattern could exhibit super-linear backtracking on pathological NixOS config content; the replacement matches the same attribute-path-before-`=` patterns with no nested quantifiers. Surfaced by the new `audit:redos` auditor.
- **`nixos/package.nix` and `nixos/nur-package.nix` `npmDepsHash`** — updated to `sha256-Fm+NfFiCrNW6rxYg1Sy12p/Mxl02uZ+I6jTnuWFm85c=` after adding `safe-regex` and `regexp-tree` as devDependencies.
- **`src/css/app.scss` `:focus-visible` rule** — Quasar's global stylesheet removes `outline` from all interactive components (`.q-btn`, `.q-field__native`, etc.) unconditionally. Added a `:focus-visible` override that restores a 2 px `currentColor` outline for keyboard-navigated elements only; mouse users are unaffected. Required to pass the new `keyboard-reachability.spec.ts` Gate 1 auditor.
- **`testing/e2e/keyboard-reachability.spec.ts` ARIA role detection** — the interactive-element check now recognizes ARIA interactive roles (`tab`, `button`, `link`, `menuitem`, `option`, `radio`, `checkbox`, `switch`, and others). Previously, Quasar `q-tab` components (rendered as `<div role="tab">` using the roving-tabindex pattern) were misclassified as non-interactive because the check only looked at HTML element names and explicit `tabindex` attributes.
- **CirrOS added to `DISTRO_IMAGES` (`backend/src/services/image-manager.ts`)** — CirrOS was referenced throughout the codebase (release checklist, `test-distro-catalog.ts` smoke test, CLAUDE.md, docs) as the default fast lifecycle validation image but was never added to `DISTRO_IMAGES`. The smoke test exited with "CirrOS distro not found in catalog" on every run. Added entry: `http://download.cirros-cloud.net/0.6.2/cirros-0.6.2-x86_64-disk.img`, format `qcow2`, `cloudInit: false` (~20 MB, designed for rapid boot testing with no cloud-init overhead). Also fixed `/api/distros` list endpoint to use actual source metadata (format, cloudInit, guestOs) rather than hardcoded `qcow2`/`true`/`linux` for all builtins; updated `BUILTIN_LABELS` map; added `ImageManager.builtinSource()` static accessor. Distros backend tests updated to reflect cirros as builtin (count 5 → 6).
- **`scripts/test-distros-live.sh`** — new orchestration script for release checklist step 5 (`npm run test:distros:live`). Automates the 5-step distro catalog smoke test: br-microvm pre-flight, dev:provision backend startup on port 3110 with a `mktemp` data directory (fresh DB → autoLogin register works on first boot), health-wait loop, dry-run readiness check, and CirrOS smoke test with cleanup. Fixed `autoLogin()` password in `test-distro-catalog.ts` from `TestAdmin1` (10 chars, no special character — fails 14-char security policy) to `TestAdmin1!@#$` (14 chars, meets policy). The `mktemp` data directory sidesteps the "existing DB with unknown password" problem that caused `Distros: 0` on repeat runs.
- **`backend/data/distro-catalog.json` CirrOS entry `cloudInit: true → false`** — the shipped default catalog had CirrOS marked as `cloudInit: true`, which caused `getAllSources()` to override the `DISTRO_IMAGES` builtin entry (which correctly had `cloudInit: false`) and triggered a failed `genisoimage`/`mkisofs` call during every CirrOS provision. CirrOS boots and passes smoke tests without cloud-init; smoke-testing provisioning does not require IP configuration inside the guest. Fixed `backend/src/services/weaver/provisioner.ts` `provisionCloudVm()` to check `distroSrc?.cloudInit !== false` before calling `generateCloudInit()`, and `startCloudVm()` to skip attaching the cloud-init ISO when `needsCloudInit` is false — so future catalog entries with `cloudInit: false` are handled correctly at runtime, not just at the catalog level.

## [1.0.2] - 2026-04-21

Closes a Free-tier monetization gap (unlimited VM control), tightens the release/sync machinery (root cause: a parallel broken copy of sync logic in release.yml leaked Dev-root content to the public Free mirror during a v1.0.2 attempted release — contained before public indexing), and sweeps through the CodeQL code-scanning backlog on Weaver-Free. End-to-end upgrade path validated on a live non-flake NixOS VM, plus a fresh NixOS 25.11 flake-install smoke test.

### Added

- **New auditor `audit:release-rsync-paths`** (#37) — static check that every rsync invocation in `release.yml` and `sync-to-free.yml` sources from `dev/code/` or `dev/.github/`, never bare `dev/`. Catches the latent bug class that leaked 72,807 lines of internal planning content (MASTER-PLAN.md, business/, portfolio/, research/, agents/, NOTES.md) to the public Free mirror during the v1.0.2 attempted release. Runs on every push via `test:compliance`.
- **`audit:sast` extended with 9 new rules (NOTES.md #365 easy 4 + medium 2 roadmap).** Up from 9 to 19 regex rules. Easy tier (pattern-level): `weak-crypto-hash` (MD5/SHA-1 in createHash), `weak-crypto-cipher` (createCipher → use createCipheriv), `weak-crypto-ecb` (aes-*-ecb mode), `jwt-algo-none` (algorithm: 'none' auth bypass), `jwt-verify-missing-algorithms` (jwt.verify without algorithms option), `unsafe-deserialization-yaml` (yaml.load + DEFAULT_FULL_SCHEMA), `unsafe-deserialization-xml2js` (xml2js without guards), `zip-slip` (path.join with archive-entry filenames). Medium tier: `log-injection` (logger.* interpolating req.body/query/params), `open-redirect-shallow` (res.redirect with req.* target). Deferred to v1.0.3: `audit:redos` wrapping `safe-regex` npm package (needs devDependency install). Complementary to CodeQL flow analysis on the public mirror — see [NOTES.md #365](../../NOTES.md) for the capability split rationale.
- **Structured logging for provisioning failures.** `backend/src/routes/workloads.ts` now logs failed provisioner runs as `fastify.log.error({ err, vmName }, 'Provisioning failed')` rather than interpolating `${request.body.name}` into the message. Closes the `log-injection` finding surfaced by the new SAST rule; also makes log aggregators filter/facet by VM name.

### Security

- **Content-leak remediation on Weaver-Free (2026-04-20).** The `release-to-free` job in `release.yml` had always rsynced `dev/ free/` (the entire Dev repo) instead of `dev/code/ free/`. sync-exclude patterns are `code/`-relative, so Dev-root content fell through the excludes. v1.0.1 masked the bug because its rsync lacked `--delete-excluded` and Free's correctly-flattened layout was preserved. Adding `--delete-excluded` (a separate correctness fix) escalated the latent bug into a 72,807-line leak in a single commit. Remediated by (a) force-resetting Weaver-Free `main` to the pre-release sync commit before public indexing, (b) deleting the v1.0.2 tag + release on Weaver-Free, (c) fixing the rsync source path in release.yml to `dev/code/ free/` with a separate `dev/.github/ free/.github/` step, (d) adding `audit:release-rsync-paths` as a compile-time guard. No credentials were involved; no secret rotation performed.

### Fixed

- **`release.yml` rsync source path** — `dev/ free/` → `dev/code/ free/` with a separate `dev/.github/ free/.github/` sync. Matches sync-to-free.yml semantics. See Security note above.
- **NUR dispatch hash was computed at the file level.** `release.yml` was doing `curl | sha256sum` on the Free tarball and dispatching that to NUR. `fetchFromGitHub` hashes the EXTRACTED source tree — the two values differ by construction, so every post-v1.0.1 NUR update would fail with a hash mismatch. Replaced with `nix-prefetch-url --unpack` + `nix-hash --to-sri` so the dispatched hash is what Nix re-computes at build time by definition. KNOWN-GOTCHAS entry "fetchFromGitHub Expects NAR Hash, Not Tarball Hash" now has matching enforcement in release.yml; the gotcha-without-enforcement pattern that masked this for a release cycle is documented as a LESSON.
- **Cosign pinned to v2.5.3.** `sigstore/cosign-installer@v4.1.1` defaulted to cosign v3.0.5, which changed `sign-blob` to require `--bundle <path>` or bare `--new-bundle-format`, dropping the legacy `--output-signature` / `--output-certificate` flags. Pinning to v2.x preserves the separate `.sig` + `.pem` artifact contract that README verification and downstream consumers expect. Migration to cosign v3's bundle format is a deliberate v1.0.3+ change.
- **`attest-build-provenance` soft-fails on private Dev via `continue-on-error` + pragma.** GitHub Attestations API requires a paid org plan OR a public repo. Weaver-Dev is private on the free plan, so attestations fundamentally cannot succeed. Prior sessions correctly used `continue-on-error: true`; this session added an explicit `# openssf-baseline-allow: attest-continue-on-error (private repo + free org plan)` pragma and extended `audit:openssf-baseline` to accept the flag when the pragma is present. The Signed-Releases check still fails loudly for un-pragma'd `continue-on-error: true` on attestation steps, so the exemption is documented and auditable rather than silent.
- **`release.yml` Token-Permissions** — moved from top-level `contents: write / id-token: write / attestations: write` to `permissions: read-all` at the workflow level with job-scoped elevation (`release` elevates contents/id-token/attestations; `publish` elevates contents; others inherit read-all). Closes Scorecard Token-Permissions alert flagging top-level write as a default-deny violation.
- **`scripts/fresh-install.sh` unpinned deps + workspace staleness** — replaced `npm install` (three per-workspace calls, unpinned) with a single root `npm ci` that covers all workspaces deterministically. The script was also trying to delete nonexistent `backend/package-lock.json` / `tui/package-lock.json` left over from pre-workspaces structure; removed those refs. Lockfile is now preserved across a "fresh install" so the operation is reproducible. Closes Scorecard Pinned-Dependencies alerts on lines 105, 108, 111.
- **`verify-release-builds.ts` shell-command-injection surface eliminated.** The internal `sh(cmd: string, ...)` helper used `spawnSync('bash', ['-c', cmd])` with `rsync` commands constructed by string-interpolating `CODE_ROOT` and sync-exclude.yml paths. CodeQL flagged this as `js/shell-command-injection-from-environment`. Refactored to argv-based `run(argv: string[], ...)` with `spawnSync(cmd, args)` and `shell: false` (default). No interpolation, no shell parsing, no injection surface. Exclude patterns are pushed into argv as `--exclude=<path>` entries — a pattern containing spaces or shell metacharacters now becomes a literal rsync pattern rather than a command fragment.
- **`compliance-pdf.ts` file-system-race (TOCTOU)** — replaced `existsSync(cachePath) + readFileSync(cachePath)` check-then-use sequence with `readFile(cachePath)` + ENOENT-catch. Atomic at the kernel level; eliminates the race where the cache file could be deleted between the exists check and the read.
- **`catalog-store.ts` http-to-file-access flow** — remote-catalog refresh now uses a Zod schema (`catalogDataSchema: z.ZodType<CatalogData>`) to parse-and-validate network-fetched JSON before persisting to disk, plus a 1 MiB size cap before parse. Closes CodeQL's `js/http-to-file-access`. Local-disk load path keeps its original lenient filter (trusted origin written by a previously-validated refresh).
- **Test-file hygiene.** Replaced predictable `join(tmpdir(), 'name-${Date.now()}')` with `mkdtemp(...)` in `catalog-store.spec.ts` and `json-registry.spec.ts` (closes 9× `js/insecure-temporary-file`). Moved `import { vi } from 'vitest'` above `vi.mock()` / `vi.hoisted()` usage in 4 test files (closes 4× `js/use-before-declaration`). Removed 3 unused `vitest` imports and 1 unused module-level variable (closes 4× `js/unused-local-variable`).
- **`verify-mcp-coverage.ts` incomplete-sanitization** — glob-to-regex conversion now escapes every regex metacharacter before re-expanding `*` to `.*`. Prior two-step escape missed backslashes, brackets, parens, etc.; CodeQL correctly flagged this.
- **`VmConsole.vue` trivial-conditional** — removed dead `bootTimeout` declaration and its always-false `if` branch in cleanup. Vestigial from a prior boot-sequence implementation.
- **Dependabot running independently on Weaver-Free.** `sync-to-free.yml` and `release.yml` both had `.github` rsync exclude lists that omitted `dependabot.yml`, so Dependabot was running on Weaver-Free and accumulating unmergeable PRs (17 open at time of fix — force-push sync would clobber any merge). Both workflows now exclude `dependabot.yml`; Dev is the sole Dependabot control point. `--delete-excluded` removed the stale config from Free automatically.
- **`release.yml` Summary typo** — final step referenced `${{ steps.sri.outputs.sri }}` but the computing step id is `hash`; emitted an empty Hash (SRI) line in the release summary on every run. Now `steps.hash.outputs.sri`.
- **SETUP-FLAKES.md fresh-install gaps.** Added §1 "First-time setup" covering `git init` + `git add -A` for `/etc/nixos`, the `hardware-configuration.nix` untracked-by-default gotcha, the harmless "Git tree is dirty" warning, and an expected-phases table for the 5-10 min first build. Surfaced while smoke-testing v1.0.2 flake install on a fresh NixOS 25.11 VM — every new flake user hit the same four gotchas without the doc.
- **LLGD Coverage Baseline script** (`code/scripts/audit-llgd-coverage-baseline.ts`) — one-shot read-only measurement of what fraction of historical CodeQL findings on Weaver-Free produced an `llgd` entry in LESSONS-LEARNED.md or KNOWN-GOTCHAS.md. Baseline capture rate: 75.2% (109/145). Serves as the "before" half of a before/after comparison when v1.0.4 Semgrep rolls out. Report: `code/reports/llgd-coverage-baseline.{json,md}`.
- **`UNINSTALL.md` + ADMIN-GUIDE "Removing Weaver" section** — canonical uninstall documentation covering flake and traditional-channel paths, with data/config cleanup warnings.

### Changed

- **`audit:openssf-baseline` accepts `openssf-baseline-allow: attest-continue-on-error` pragma** — see Fixed section above. Prior behavior: any `continue-on-error: true` on attestation steps fails the audit. New behavior: passes when the pragma is present, still fails when missing. Pass output notes "attest soft-fail exempted by pragma" so the exemption is visible in CI output (won't silently decay into "we forgot we were ignoring failures").

### Added

- **Free-tier VM control cap (observer pattern).** Free-tier installations can register and observe unlimited VMs, but lifecycle actions (start/restart) are gated to the first 10 VMs alphabetically plus a 64 GB total running-memory ceiling. Pure-function gate at `backend/src/services/free-tier-cap.ts` with 11 unit tests; wired into `POST /api/workload/:name/start` and `/:name/restart` with a 403 response and audit-logged denial. Upgrade nags (AI Default, Resource Quotas) are now visible to Free admins as conversion touchpoints.
- **New auditor `audit:mcp-coverage`** (#34) — three-layer parity check that the code MCP server's knowledge manifest covers every source it claims to, that the manifest is fresher than its sources, and that the reader pattern matches what the manifest declares.
- **New auditor `audit:nix-deps-hash`** (#35) — computes a sha256 fingerprint of `package-lock.json` and compares it against a `# lockfile-marker:` comment in `nixos/package.nix`. Fails the push with remediation steps when the pairing drifts, so downstream Nix builds can't surface with an outdated `npmDepsHash`.
- **New auditor `audit:sync-exclude-cruft`** (#36) — greps every rsync invocation in `sync-to-free.yml` and `release.yml` to ensure `--delete-excluded` is present. Prevents the class of bug where a pattern added to `sync-exclude.yml` silently leaves pre-existing files behind on the Free mirror.
- **`docs/UPGRADE.md`** — canonical upgrade runbook covering three installation paths: flake + NUR, flake + direct GitHub input, and traditional channels + NUR (pinned and unpinned sub-cases). Includes an 8-point post-upgrade verification checklist, rollback guidance, and a staging-VM validation pattern.
- **`ADMIN-GUIDE.md` — "Validating Upgrades in a Staging VM"** section documents the two-VM recommendation (flake-managed and channels-managed) and the per-release six-step validation workflow.
- **Sigstore cosign keyless signing** on all release tarballs and SBOMs. Release assets now include `.sig` and `.pem` files signed via Fulcio with Rekor transparency-log inclusion. Cosign pinned to v2.5.3 in `sigstore/cosign-installer` — cosign v3 dropped `--output-signature` / `--output-certificate` in favor of a single `--bundle` output; the migration is a deliberate v1.0.3+ change.
- **Badge wiring (Row 2 + Row 3).** README now shows a total-tests badge that sums unit + backend + TUI + E2E pass/fail counts from per-job gist writes, plus per-suite badges. Row 3 adds compliance-auditors, cosign-signed, SLSA L3, and a live CII Best Practices Passing badge (project #12592).
- **`docs/security/COMPENSATING-CONTROLS.md`** — documents 7 structural gaps (solo-maintainer, second reviewer, etc.) and the compensating controls that offset each. AI review is recognized as a first-layer compensating control alongside automated auditors and recorded exceptions.
- **`docs/security/CONTRACTED-REVIEW-OFFERING.md`** — Fabrick-tier bolt-on for customers who need human second-reviewer coverage on their Weaver deployments.
- **`CONTRIBUTING.md` — "About this project"** + Governance sections now spell out the two-admin model (Mark Wriver primary; Yuri Jacuk secondary-admin-on-standby, activating June 2026) and the committed roadmap through v2.x and v3.x.

### Fixed

- **`/api/health` missing `version` field.** The health route now resolves the backend package version at module load and includes `version` in the response. Catches version drift on upgraded installs.
- **`VITE_FREE_BUILD` auto-detect in Nix builds.** When `src/pages/fabrick/` is absent (the Weaver-Free tarball), `nixos/package.nix` now sets `VITE_FREE_BUILD=true` automatically so rolldown tree-shakes the paid-tier route ternary. Previously the env var had to be set by the caller; omitting it produced `UNLOADABLE_DEPENDENCY` failures on pages that were supposed to be excluded.
- **Sync workflow preserved stale excluded files** on the Free mirror. `sync-to-free.yml` now passes `--delete-excluded` on both the `code/ → target/` rsync and the `.github/ → target/.github/` rsync, so files newly added to `sync-exclude.yml` are removed from Free on the next sync instead of lingering as cruft. A `--filter='P /.git'` protect rule guards `target/.git` from being deleted by `--delete-excluded` combined with `--exclude='.git'`.
- **`release.yml` rsync path symmetry.** The release workflow's final sync to Free now uses `dev/code/ free/` (not `dev/ free/`) + a separate `.github` sync, matching sync-to-free.yml semantics. Also adds `--delete-excluded` + `--filter='P /.git'` discipline.
- **NUR dispatch hash was computed at the file level.** `release.yml` was doing `curl | sha256sum` on the Free tarball and dispatching that to NUR. `fetchFromGitHub` hashes the EXTRACTED source tree — the two values differ by construction, so every post-v1.0.1 NUR update would fail with a hash mismatch. Replaced with `nix-prefetch-url --unpack` + `nix-hash --to-sri` so the dispatched hash is what Nix re-computes at build time by definition.
- **Over-broad rsync exclusion patterns.** `- /reports/`, `- /coverage/`, `- /logs/`, `- /data/`, `- /playwright-report/`, `- /test-results/` are now anchored with leading slashes so they match ONLY the top-level path. Unanchored `- data/` was matching `backend/data/` (which holds `distro-catalog.json`, a real shipped file) and deleting it on sync — the Nix build then failed with `cp: cannot stat backend/data/distro-catalog.json`. `dist/` is intentionally kept unanchored; nested `backend/dist`, `tui/dist`, and `src-pwa/dist` are all build artifacts that should be excluded.
- **`audit:doc-parity` counter drift** — auditor-count references in `CLAUDE.md`, `MASTER-PLAN.md`, `NOTES.md`, `STATUS.md`, and `ENGINEERING-DISCIPLINE.md` brought back into sync at 36.
- **Test-badge pipeline schema violation.** `.github/workflows/test.yml` `if:` expressions no longer reference `secrets.*` (forbidden at the job/step `if:` level in GitHub Actions). Badge publishing now keys off `workflow_dispatch || startsWith(github.ref, 'refs/tags/v')` and sends to a classic-PAT-authenticated gist owned by the weaver-dev user.
- **Backend + TUI lint drift** — `test:precommit` now covers backend lint + typecheck and TUI typecheck, catching three pre-existing backend lint errors (unused imports + unused caught-error) that had slipped past the root-scoped precommit.
- **OpenSSF CII Passing unblocked** — Commons Clause dropped from the Weaver-Free LICENSE (Decision recap: AGPL-3.0 only for Free). Combined with the new Governance doc, this let us earn the CII Passing badge on first submission.
- **`audit:release-builds` docker context removed.** Weaver is a NixOS module, not a Docker image — it manages `microvm@*.service` units and `br-microvm` bridge networking at host level. Running Weaver in a container would require `--privileged` or Docker-in-Docker, either of which defeats the isolation model. Docker is a workload Weaver **manages**, not a shipping format for Weaver itself. The aspirational `docker build -t ghcr.io/...` line was also struck from the release checklist in `code/CLAUDE.md`.

### Changed

- **Upgrade nags visible on Free.** `SettingsPage.vue` no longer gates the AI Default and Resource Quotas cards behind `appStore.isWeaver`. Free-tier admins see the same cards with tier-upgrade messaging — a deliberate conversion touchpoint at the tier boundary.
- **`nixos/package.nix`** now copies `docs/UPGRADE.md`, `docs/ADMIN-GUIDE.md`, and `docs/USER-GUIDE.md` into `$out/lib/weaver/docs/` so installed binaries ship with their own upgrade and operator documentation.
- **`attest-build-provenance` documented as soft-fail on the private Dev repo.** GitHub attestations require either a paid org plan or a public repo. Weaver-Dev is private on the free plan, so attestations fail with "Feature not available for the organization." `continue-on-error: true` is retained with a workflow comment explaining the constraint — the flag becomes removable when the org upgrades to Team/Enterprise or this workflow is moved to run on the public Free repo directly.

### Security

- **Internal content leak in the release-to-Free rsync (discovered and remediated 2026-04-20).** The `release-to-free` job in `release.yml` had a latent bug where the rsync source was `dev/` (the entire Dev repo) instead of `dev/code/`. The sync-exclude patterns cover `code/`-relative paths only, so Dev-root content (`MASTER-PLAN.md`, `NOTES.md`, `business/`, `portfolio/`, `research/`, `agents/archive/`) fell through and was being published as the Free mirror tree. v1.0.1 masked the bug because its rsync omitted `--delete-excluded` and Free's existing flattened state was preserved. Adding `--delete-excluded` in this release (a separate correctness fix) caused the latent bug to manifest loudly — the first v1.0.2 release commit on Weaver-Free added 72,807 lines of internal planning content. **Remediation:** Weaver-Free `main` was force-reset to the pre-release sync commit before any public indexing could occur, and the v1.0.2 release + tag were deleted from Weaver-Free. The rsync source path has been corrected to `dev/code/ free/` and `.github` config is now synced separately (`dev/.github/ free/.github/`). No credentials were involved; no secret rotation required.

### Validated

- **Non-flake upgrade path end-to-end.** The traditional-channels + NUR upgrade path was smoke-tested against v1.0.1 on a live NixOS VM. Six cascading bugs discovered during the test are all fixed in this release: npmDepsHash drift, `VITE_FREE_BUILD` auto-detect missing from Nix build, `--delete-excluded` missing from sync rsyncs, `--exclude='.git'` combined with `--delete-excluded` trashing target `.git`, unanchored `/data/` exclusion pattern deleting `backend/data/distro-catalog.json`, and `/api/health` missing a `version` field. Flake-based upgrade paths share the same `nixos/package.nix` derivation and are covered transitively.

## [1.0.1] - 2026-04-18

Non-security patch release. Fixes a critical release-mechanics bug that prevented the Weaver Free public tarball from being built from source. Tightens CI guardrails against the bug class that caused it.

### Fixed

- **Free tarball now builds from source.** v1.0.0 shipped with latent build failures on the Weaver-Free public repo: `../scripts/` path escapes in `prebuild` and `audit:docs-links` scripts, plus ~97 unguarded imports of sync-excluded paths across source, that only surfaced when someone tried to `nix-build` from the released tarball. Refactored with a stub-shim pattern: `demo.ts`, `mock-vm.ts`, `mock-container.ts`, `useDemoContainerState.ts`, `useMilestoneModal.ts`, and `mock-agent.ts` are now thin shims that ship to Free and eagerly glob (or `try/catch` dynamic-import) their `-data.ts` siblings that remain sync-excluded. Paid-tier route imports in `routes.ts` are now inside a `VITE_FREE_BUILD === 'true'` ternary guard that rolldown tree-shakes. Fabrick-tier pages (`FabrickOverviewPage.vue`, `LoomPage.vue`) moved into `src/pages/fabrick/` so they're auto-excluded by the existing directory rule.
- **OpenSSF Scorecard badge was showing "invalid repo path"** due to the deprecated `api.securityscorecards.dev` domain. Updated `code/README.md` to the current `api.scorecard.dev`.
- **Scorecard workflow rejected on "global perm is set to write"** — flipped `default_workflow_permissions` from `write` to `read` on both Weaver-Dev and Weaver-Free via the GitHub API, and added top-level `permissions: read-all` to 7 workflows that had only job-level permissions (codeql, demo-deploy, demo-reset, dependabot-labeler, dependabot-tracker, security-scan, stale).
- **sync-to-free workflow** had the `- demo/` pattern matching `src/components/demo/` at any depth (rsync pattern semantics). Anchored to `- /demo/` so only `code/demo/` is excluded.
- **`npm ci` anti-pattern in workspaces.** release.yml, test.yml, and release-verify-create.yml had redundant `cd backend && npm ci` and `cd tui && npm ci` steps that pruned root devDependencies (including `@quasar/app-vite` which provides the `quasar` binary) after the workspaces refactor. Collapsed to a single root `npm ci`.
- **NUR dispatch payload** sent raw-hex source hashes; `fetchFromGitHub` expects SRI format. Added hex→SRI conversion step in release.yml and changed the dispatch event-type from generic `update-package` to the per-package `weaver-free-release` convention (matching the Qepton precedent).
- **Dependency vulnerabilities** — `npm audit fix` (non-breaking) addressed 4 high-severity vulns; 11 dev-only issues remain.

### Added

- **New auditor `audit:excluded-imports`** — scans source for static or dynamic imports of sync-excluded paths without a guard. Static imports are always flagged; dynamic imports must be inside a `VITE_FREE_BUILD === 'true' ? [] : […]` ternary or a `try { … }` block. Wired into `test:compliance`.
- **New auditor `audit:release-builds`** — pre-flight simulation of downstream build contexts before a release tag is pushed. Currently covers the `free-tarball` context (sync-flattened `npm ci + build:all`); docker, public-demo, private-demo contexts planned. Wired into `test:prerelease`.
- **New auditor `audit:openssf-baseline`** — pre-OpenSSF Scorecard baseline check. Validates 7 Scorecard concerns locally (no network) so regressions fail the push rather than surfacing on the next weekly scan: Token-Permissions, Pinned-Dependencies, Dependency-Update-Tool, Security-Policy, SAST, License, Signed-Releases. Wired into `test:compliance`.
- **New product doc `docs/security/ENGINEERING-DISCIPLINE.md`** — ships with Weaver Free, registered in DocsPage. Tells the "internal CI vs Enterprise CI" credibility story with enumerated, verifiable checks. Available as a compliance doc slug.
- **Branch protection** enabled on `whizbangdevelopers-org/Weaver-Free` `main` (required_approving_review_count: 0, dismiss_stale_reviews: true, enforce_admins: false, allow_force_pushes: false, allow_deletions: false).
- **Dependabot** — `.github/dependabot.yml` removed from the sync exclusion list so Weaver-Free gets weekly dependency updates.
- **CodeQL push trigger** — codeql.yml now triggers on push to main (not just PRs and the weekly schedule).

### Changed

- **`src/config/demo.ts` split into `demo-mode.ts` (ships) + `demo-data.ts` (sync-excluded)**. 51 non-demo files migrated from `src/config/demo` to `src/config/demo-mode` for their flag-only imports (`isDemoMode`, `isPublicDemo`, `DEMO_LINKS`, `PUBLIC_DEMO_LINKS`, `DEMO_TIER_STAGES`). The mock-data side uses the stub-shim pattern — old `from 'src/config/demo'` imports still work; `demo.ts` is now a small shim with eager `import.meta.glob` fallback to `demo-data.ts`.
- **Demo UI scaffolding** (`src/components/demo/`, `DemoBanner.vue`, `DemoToolbar.vue`, `DemoLoginModal.vue`, `src/pages/DemoLoginPage.vue`, `src/pages/funnel/`, `src/constants/pricing.ts`) is no longer sync-excluded. These files are small, not commercially sensitive, and publicly viewable at weaver-dev.github.io. Paid-tier components (`src/components/weaver/`, `src/components/fabrick/`, `src/pages/fabrick/`) remain excluded.
- **Release-process documentation** now explicitly states patch releases aren't security-only: release-mechanics fixes, build regressions, pipeline fixes, and documentation corrections are all valid patch-release triggers.
- **`audit:docs-links`** is now a no-op on Free builds where `scripts/verify-docs-links.ts` is sync-excluded. On Dev where the script exists, behavior is unchanged.
- **`generate:versions`** is a no-op on Free builds where `../scripts/delivery-projection.ts` doesn't exist. On Dev, the script runs as before.

## [1.0.0] - 2026-04-17

Initial public release. Production-ready NixOS MicroVM management dashboard.

### Added

**Core Dashboard**
- Real-time VM monitoring via WebSocket (2-second broadcast interval)
- Dashboard page with VM status cards (grid + compact list view toggle)
- VM detail page with configuration, networking, provisioning logs, and AI analysis tabs
- Start / Stop / Restart lifecycle management from the browser
- VM scanning and auto-discovery of `microvm@*.service` systemd units
- Keyboard shortcuts (?, D, S, N) and drag-and-drop card sorting
- Responsive PWA with mobile-optimized layouts and touch toolbar

**VM Provisioning (Weaver Solo+)**
- Async VM creation with cloud-init image provisioning pipeline
- Multi-hypervisor support: QEMU, Cloud Hypervisor, crosvm, kvmtool, Firecracker
- Windows guest support via BYOISO with VNC install (IDE disk + e1000 networking)
- Desktop mode toggle (QEMU VGA + VNC)
- Bridge networking with configurable subnet (default `10.10.0.0/24`)

**Distribution Catalog**
- Three-tier distro system: built-in, curated catalog, and custom user-defined
- Shipped catalog: NixOS, Arch, Fedora, Ubuntu, Debian, Alpine, Rocky, Alma, openSUSE, CirrOS, Windows
- URL health monitoring with HEAD-request validation and admin override
- "Will it boot?" smoke test from Settings UI and CLI
- Remote catalog refresh endpoint

**AI Agent Diagnostics**
- Diagnose, Explain, and Suggest actions per VM with streaming markdown output
- Pluggable LLM provider architecture (Anthropic, extensible to other vendors)
- BYOK (Bring Your Own Key) and BYOV (Bring Your Own Vendor) support
- Mock agent auto-fallback for demo and keyless environments
- Tiered rate limiting: 5/10/30 requests per minute (free/premium/enterprise)

**Serial Console**
- In-browser serial console via xterm.js and WebSocket-to-TCP proxy
- VNC console support for desktop-mode VMs
- Mobile touch toolbar (Paste, Ctrl+C, Ctrl+D, Tab)

**Authentication & Authorization**
- Cookie-based JWT session auth with bcrypt password hashing (cost 13)
- First-run admin account detection and setup wizard
- Role-based access control: admin / operator / viewer
- Per-VM access control lists (enterprise)
- Account lockout (5 attempts / 15 minutes, persisted to disk)
- 30-minute access tokens with 7-day refresh tokens
- Single-session enforcement: new login revokes all prior sessions for that user (all tiers, last login wins)

**Tier System**
- 4-tier licensing: demo / free / premium / enterprise
- License key validation with HMAC-SHA256 checksum (offline-capable)
- Frontend tier gating via `useTierFeature` reactive composable
- Backend tier gating via `requireTier()` middleware
- Demo tier-switcher toolbar for live feature showcase

**Notifications**
- In-app notification bell with event history (free)
- Push notification channels: ntfy, email (SMTP), webhook (Slack/Discord/PagerDuty), Web Push (premium)
- Per-channel event subscriptions with dynamic adapter loading
- Resource alerts with configurable CPU/memory thresholds (premium)

**User Management**
- User list, create, role change, and delete (admin)
- VM resource quotas with enforcement (enterprise)
- Bulk VM operations: multi-select start/stop/restart (enterprise)

**Audit & Compliance**
- Audit log with queryable API (enterprise): all VM, user, and agent actions
- Per-user rate limiting with tier gradient and response headers

**Network**
- Network topology page with auto-detected bridges (free)
- Bridge management: create/delete managed bridges and IP pools (premium)

**Host Info**
- Host info strip: NixOS version, CPU topology, disk usage, network interfaces, live metrics (premium)
- KVM availability detection

**Help System**
- Searchable help page with Getting Started, VM Management, AI Features, Settings, and FAQ sections
- Contextual help tooltips with global toggle
- Getting Started wizard (auto-triggers on first visit, auto-dismisses when VMs arrive)

**Settings**
- AI provider configuration with vendor selector and API key management
- Custom distribution CRUD with URL override and validation
- Tag management with preset vocabulary
- Notification channel configuration (premium)
- View preferences persistence

**NixOS Integration**
- Declarative NixOS module with full option set (port, host, auth, licensing, provisioning, bridge)
- Dedicated system user with restricted sudo (microvm@*.service only)
- Flake and non-flake installation paths
- Secrets management integration (sops-nix)

**Terminal UI (TUI)**
- Ink/React terminal client with VM list, detail, and status views
- `--demo` mode with mock clients for offline use
- Credential storage via XDG-compliant `conf` package
- WebSocket reconnection with 4401 close code handling
- Server-side session revocation on logout and quit

**Demo Site**
- Static SPA deployment to GitHub Pages
- 8 sample VMs (multi-distro, multi-hypervisor, varied states including Windows)
- Tier-switcher toolbar: Free / Weaver / Fabrick live toggle
- Mock VM create/delete for interactive demo

**DevOps & Quality**
- GitHub Actions CI/CD: test, release, sync-to-free, CodeQL, security-scan, stale
- Release workflow with approval gate and post-release verification
- Dev-to-Free repo sync (PR-based, excludes internal files)
- Dockerized Playwright E2E testing (never bare `npx playwright test`)
- Dynamic test count badges via Gist
- Security audit pipeline with blocked-package tracking
- Form validation audit (static + E2E coverage gap checker)
- Git hooks: pre-commit linting, pre-push testing

### Security

- JWT secret required in production (no auto-generation)
- Access token TTL reduced to 30 minutes (from 24 hours during development)
- Token refresh timer corrected to 25 minutes (was incorrectly set to 23 hours)
- Bcrypt rounds increased to 13 (OWASP 2024+)
- Account lockout persisted to disk (survives restarts)
- CORS wildcard rejected in production
- `file://` URL validation restricted to allowed directories
- All GitHub Actions SHA-pinned (40 actions across 10 workflows)
- License HMAC empty-secret bypass prevented
- Rate limit bypass decoupled from NODE_ENV
- Agent context uses configurable binary paths (defense-in-depth)
- Parallel VM status fetching (prevents sequential timing leaks)
- 5-domain non-code security audit: legal/IP, secrets, supply chain, deployment, org governance

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

<!-- entry:L-security-2026-06-02-001 -->
---
id: L-security-2026-06-02-001
type: lesson
domain: security
tags: [sops, sops-nix, secrets, mac, nixos, operator-tooling]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-security-2026-06-02-002]
graduated_to: ""
---

## sops files are not hand-editable — ship a sops-edit wrapper, never document "open in an editor" — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Root cause:** sops stores a cryptographic MAC of the entire encrypted file. Any direct editor touch — even opening and saving without changes — invalidates the MAC. The next `nixos-rebuild switch` then fails at the secrets-activation step with a MAC mismatch, leaving services stopped. Operators who "just edit the file" silently corrupt it.

**Rule:** Ship a `sops-edit` shell function (or alias) to every NixOS host that uses sops-nix. Never document "open the file in an editor." The wrapper derives the age key from the SSH host key and passes it via `SOPS_AGE_KEY_FILE`, so editing collapses to `sudo sops-edit /path/to/file.yaml`.

**Why this shape wins:** The wrapper is ~5 lines and eliminates the entire MAC-corruption error class. The alternative is every operator independently rediscovering that sops-nix uses the SSH host key, figuring out `ssh-to-age`, and exporting `SOPS_AGE_KEY_FILE` every time — error-prone and repeated forever.

<!-- /entry -->

<!-- entry:L-security-2026-06-02-002 -->
---
id: L-security-2026-06-02-002
type: lesson
domain: security
tags: [sops, secrets, config, separation, rotation, nixos]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-security-2026-06-02-001]
graduated_to: ""
---

## Separate genuine secrets from config in sops templates — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-05)

**Root cause:** When using `sops.templates` to render an env file for a systemd service, mixing non-secret config (provider names, model identifiers, feature flags) into sops creates two problems: sops MAC fragility (any sops file edit is a potential rebuild failure — see L-security-2026-06-02-001), and a false impression that the values are sensitive (confusing what actually needs rotation or protection).

**Rule:** Before adding a value to sops, ask "would this cause a security incident if it leaked in a git commit?" API keys: yes. `LLM_PROVIDER=anthropic`: no. Keep the sops template minimal — ideally one entry per genuine secret — and put non-sensitive config in the NixOS `environment` block as plain strings.

**Why this shape wins:** A minimal sops template has the smallest possible edit-and-corrupt surface and makes the security model legible: everything in sops is a real secret, so rotation and access policy apply uniformly. Config that masquerades as a secret dilutes both.

<!-- /entry -->

<!-- entry:L-security-2026-06-02-003 -->
---
id: L-security-2026-06-02-003
type: lesson
domain: security
tags: [authorization, rbac, requirerole, requiretier, access-control, owasp-a01]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ".claude/rules/security.md"
---

## Every route needs requireRole — a tier gate is not an authorization gate — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-19)

**Root cause:** An OWASP A01 (Broken Access Control) audit found three High findings: `GET /api/network/topology` and `GET /api/notifications` had no `requireRole`, so any authenticated user — including read-only viewers — could see all VM IPs/bridges/subnets and read security events (auth failures with IPs and usernames). The network-management GET routes were tier-gated (`requireTier`) but not role-gated. The mental trap: a `requireTier` preHandler *looks* like protection, so reviewers assumed authorization was covered.

**Rule:** Every route gets a `requireRole` preHandler unless there is an explicit, documented reason for viewer access. `requireTier` protects feature *availability* (which plan unlocks the feature); it does NOT protect *authorization* (which logged-in user may call it). The two are orthogonal and both must be present on any sensitive route.

**Why this shape wins:** Treating tier and role as independent gates closes the silent class where a feature-gated route is reachable by every authenticated principal. The `audit:routes` auditor enforces the presence of role gates so a missing `requireRole` fails the build rather than shipping as a latent A01.

<!-- /entry -->

<!-- entry:L-security-2026-06-02-004 -->
---
id: L-security-2026-06-02-004
type: lesson
domain: security
tags: [validation, defense-in-depth, zod, server-side, frontend, provisioning]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-security-2026-06-02-005]
graduated_to: ""
---

## "Rejected at X level" is a claim to verify with a test at X level — frontend filters are not security boundaries — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-09)

**Root cause:** The provisioning docs claimed "Firecracker is rejected at Zod validation level," but the only enforcement was a frontend filter in `CreateVmDialog.vue`. The backend Zod schema accepted `firecracker` without complaint. The gap stayed invisible because no test exercised `POST /api/workload` with `hypervisor: 'firecracker'` + a flake distro, a downstream provisioner error masked the missing validation, and the doc asserted the rejection existed so nobody checked.

**Rule:** When documentation says "rejected at X level," verify it with a test at that exact level. Frontend filters are UX conveniences, not security boundaries. Every constraint that matters must be enforced server-side with a test that proves the server rejects it (here: route-handler rejection in `workloads.ts`, `isFlakeDistro + firecracker → 400`, with backend tests).

**Why this shape wins:** A server-side test pins the boundary to reality. Documentation drifts; a passing test that POSTs the forbidden payload and asserts 400 cannot. This is the general antidote to "the doc says it's handled" — make the doc claim executable.

<!-- /entry -->

<!-- entry:L-security-2026-06-02-005 -->
---
id: L-security-2026-06-02-005
type: lesson
domain: security
tags: [password-validation, write-paths, shared-utility, test-fixtures, baseline]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-security-2026-06-02-004]
graduated_to: ""
---

## Promoting frontend-only validation server-side: cover ALL write paths and fix every test fixture at once — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-25)

**Root cause:** A username-in-password check lived only in `LoginPage.vue`. Adding it server-side surfaced two easy-to-miss obligations. (1) The check must apply to *all* write paths, not just `register` — `changePassword` also persists a new password and was unguarded, so a user could still set a weak password via the change-password flow. (2) Every test fixture that registered with a non-compliant password broke simultaneously across unrelated specs (`audit.spec.ts`, `host.spec.ts`, `rbac.spec.ts`, …) because fixtures historically used semantically-named passwords (`AdminPass123!`) that contain the username or are too short.

**Rule:** When adding server-side password validation: (1) extract a shared `validatePasswordStrength(password, username)` utility and call it from *every* method that persists a password, (2) grep for every test that hits those paths and update all fixtures to a single role-independent, fully-compliant constant (e.g. `T3stP@ssw0rd!X`) in one pass.

**Why this shape wins:** Password strength is a cross-cutting concern — frontend enforcement is UX, backend enforcement is the security baseline, and they must be identical on every write path. A shared utility makes "every path" enforceable by inspection; a single compliant test constant makes the fixture churn a one-time fix instead of a recurring whack-a-mole.

<!-- /entry -->

<!-- entry:L-security-2026-06-02-006 -->
---
id: L-security-2026-06-02-006
type: lesson
domain: security
tags: [codeql, npm-audit, socket-dev, supply-chain, sast, threat-model]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-security-2026-06-02-004]
graduated_to: ""
---

## Three-tool security stack — CodeQL + npm audit + Socket.dev cover non-overlapping threat models — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-25)

**Root cause:** CodeQL and npm audit together leave a structural blind spot: a *new* malicious package with no published CVE passes `npm audit` cleanly, and CodeQL does taint analysis on your source but never looks inside `node_modules`. Neither can detect a typosquat, a dependency-confusion attack, or a package that exfiltrates at install time. The three tools operate on different inputs, so each misses what the others catch.

**Rule:** Run all three. `npm audit` = known CVEs in published versions. CodeQL = taint flows in your own source (injection, SSRF, path traversal, crypto misuse). Socket.dev = behavioral analysis of packages at install time (obfuscated code, install scripts, network calls, typosquats, dep confusion, hijacked maintainers). Wire Socket.dev via the GitHub App for PR-time coverage (no secret) plus a CI workflow gated on `package.json`/`package-lock.json` path changes — and guarded with `if: repository.visibility != 'private'` since the free tier needs a public repo.

**Why this shape wins:** A supply-chain compromise reaching production is as damaging as a SQL injection, and it lands through a channel npm audit and CodeQL cannot see. Layering by threat model — known-CVE vs source-taint vs package-behavior — means no single tool has to do a job it structurally can't, and a gap in one is covered by another.

<!-- /entry -->

<!-- entry:L-security-2026-06-02-007 -->
---
id: L-security-2026-06-02-007
type: lesson
domain: security
tags: [auth, session, router-guard, httponly, persisted-state, jwt]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-security-2026-06-02-008]
graduated_to: ""
---

## Persisted auth state is a UX optimization, not ground truth — verify with the server on first protected navigation — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Root cause:** After a reinstall with a fresh JWT secret, the browser still held a cookie from the old install. The Pinia auth store's `isAuthenticated` getter only checks `state.user != null` (persisted via `pinia-plugin-persistedstate`), so the router guard saw "authenticated" and admitted the user to the dashboard — but every API call failed silently because the old cookie couldn't be validated against the new secret. Symptom: dashboard shell renders, WebSocket reconnect-loops, no error shown because the guard never talked to the server.

**Rule:** The first protected navigation must verify with the server at least once per tab. The router guard calls `authStore.fetchMe()`; on 401 it runs `clearAuth()` and redirects to login. A non-persisted `sessionVerified: boolean` flag forces re-verification on every fresh tab/reload while persisted state still provides instant-feeling auth. Clear state on 401 — don't merely bounce to login, or the stale cookie creates confusing half-authenticated states.

**Why this shape wins:** Persisted state gives instant perceived auth; one server roundtrip per tab confirms it's actually valid. "Trust but verify" eliminates the silent-failure class where the UI believes a session that the server has already invalidated.

<!-- /entry -->

<!-- entry:L-security-2026-06-02-008 -->
---
id: L-security-2026-06-02-008
type: lesson
domain: security
tags: [websocket, httponly, cookies, auth, upgrade-request, localstorage]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-security-2026-06-02-007]
graduated_to: ""
---

## WebSocket auth with httpOnly cookies must be checked server-side on the upgrade request — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Root cause:** The WebSocket client read `localStorage.auth` to extract a token and append it as `?token=...`. This was dead code — the app had migrated to httpOnly cookies and `localStorage.auth` was never populated. On a real install the WS connected, the server rejected with close code 4401 (no token in query), the client reconnected per exponential backoff, and the cycle repeated forever. Symptom: a WebSocket-Offline chip flashing green/red, dashboard appearing frozen.

**Rule:** httpOnly cookies are invisible to JavaScript by design — that *is* the security property — so the client cannot read the token to forward it. For WebSocket auth over httpOnly cookies, the server must read the cookie from the upgrade request (the browser auto-attaches httpOnly cookies to the WS upgrade): fall back to `request.cookies?.weaver_token` when the `token` query param is absent. Delete client-side `localStorage` token lookups entirely; the query-param path remains only for non-browser clients (curl, tests) that set it explicitly.

**Why this shape wins:** It puts the auth check where the credential actually exists. Leaving a client stub that "helpfully" reads localStorage produces a silent production failure plus a reconnect storm — strictly worse than no stub. The server-side cookie check is the only path consistent with the httpOnly guarantee.

<!-- /entry -->

<!-- entry:L-security-2026-06-02-009 -->
---
id: L-security-2026-06-02-009
type: lesson
domain: security
tags: [cors, hardening, same-origin, dev-workflow, release-checklist]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Defer CORS hardening to the release pass — production is same-origin, dev/E2E are the only cross-origin cases — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-20)

**Root cause:** Configuring CORS early (during active development) caused repeated debugging sessions where requests silently failed on origin mismatches, because each environment has different origin needs: NixOS production serves frontend and backend on the same port (same-origin, CORS irrelevant), while only the dev server (9010→3110) and E2E Docker (9020→3120) are genuinely cross-origin. Time spent tuning CORS early was time not spent on features, for zero security benefit during solo development.

**Rule:** Start development with permissive CORS (`origin: true` / allow-all) and lock it down in the pre-release hardening pass once all environments are stable. The current production posture is same-origin (`origin: false` when `NODE_ENV=production`, explicit `CORS_ORIGIN` required for a reverse proxy) with wildcard-plus-credentials rejected at startup. Note: this differs from the earlier `cors: true` (reflect-origin) production setting — production was tightened to `origin: false` because it is same-origin by deployment design.

**Why this shape wins:** CORS only matters where origins actually differ, and in this deployment that is exclusively dev and test. Hardening once at release — when the deployment model is final — avoids paying the cross-environment-mismatch debugging cost repeatedly against a moving target.

<!-- /entry -->

<!-- entry:L-security-2026-06-02-010 -->
---
id: L-security-2026-06-02-010
type: lesson
domain: security
tags: [code-scanning, codeql, triage, automation, ci, false-positive]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-security-2026-06-02-004]
graduated_to: ""
---

## Automate Code Scanning triage by location and dedup by path — let CI carry the GitHub API load — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-25)

**Root cause:** GitHub CodeQL alerts accumulate across categories (real security, code quality, Scorecard posture, false positives) with no automated triage, so a human has to know which findings block a release versus which are informational noise — and the synced Free repo double-reports many findings (see G-security-2026-06-02-004), inflating counts.

**Rule:** Build three layers. (1) A standalone `scripts/audit-code-scanning.ts` that fetches open alerts via `gh api`, deduplicates on `{rule, normalizedPath, startLine}` after stripping the `code/` prefix, and classifies into FAIL/WARN/SKIP — production paths (`backend/src/`, `src/`, `tui/src/`) FAIL on security warnings and all errors; test/script/docs WARN only; Scorecard `*ID` posture rules SKIP. (2) A `workflow_run`-triggered GHA workflow that runs the classifier after CodeQL completes and exits 1 on production security findings — keeping the expensive API call off the developer's machine. (3) A post-release verification domain that reads the latest CI run result.

**Why this shape wins:** Classifying by *location* (production vs test/script/docs) maps directly onto release-blocking severity, and deduping by normalized path removes the synced-mirror inflation. Putting the fetch+classify in CI means the gate runs the same way for every author with no local credentials, and post-release verification confirms the gate actually ran rather than assuming it did.

<!-- /entry -->

<!-- entry:L-security-2026-06-05-001 -->
---
id: L-security-2026-06-05-001
type: lesson
domain: security
tags: [ai-agents, supply-chain, containment, selvedge, red-team]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Containing an autonomous AI code pipeline — the judge isn't the hole, the trust spine is — 2026-06-05 · Claude

**Root cause:** When red-teaming an autonomous AI-dev loop (a model that writes code, self-reviews, and merges), the instinct is to attack the LLM reviewer. But a well-prompted reviewer is robust: 0/7 crafted prompt-injections subverted it (it flagged embedded "approve this" instructions as findings, not commands). The real holes are all OUTSIDE the diff the reviewer reads — "the only guarded door in a building with three open windows": (1) the **executor** runs with no tool sandbox (`--dangerously-skip-permissions`, full Bash) while the reviewer/decomposer tiers are correctly read-only; (2) **design-tier artifacts** — an AI-authored gate/test command run as `bash` BEFORE review is RCE-by-construction (`curl|sh`); (3) the **state store** the scheduler trusts is an attacker-writable plain file (forgeable `DONE`); (4) the **supply chain** — `npm ci` runs lifecycle scripts before any test.

**Rule:** Sandbox the executor to the minimum tools (file-editing only — mirror the reviewer's allowlist; deny Bash/network/sub-agents). Treat every AI-authored command string as untrusted: allowlist + argv, never `bash "$string"`, and validate it at AUTHORING time (decomposer emit) AND at execution. Feed the reviewer `git status --porcelain --ignored` so off-diff payloads (`node_modules`, `.git/hooks`) aren't invisible behind `git diff --cached`. Re-assert dependency manifests + run installs `--ignore-scripts` from a vetted mirror.

**Why this shape wins:** the reviewer's strength is *judgment*, and judgment must be the LAST line of defense, not the only one. Structural controls (allowlist, manifest immutability, state integrity) make a single poisoned input — one comment, one lock entry, one state file — non-fatal. Bonus: red-teaming your own pipeline *is* how you author the spec for a host-level AI-shell-containment product — the threat model from a real adversary, dogfooded on the most demanding workload (an AI writing code unattended).
<!-- /entry -->

<!-- entry:L-security-2026-06-05-002 -->
---
id: L-security-2026-06-05-002
type: lesson
domain: security
tags: [integrity, hmac, control-flow, state-store]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-security-2026-06-05-001]
graduated_to: ""
---

## Any control-flow decision derived from an attacker-writable file must be integrity-signed — 2026-06-05 · Claude

**Root cause:** A scheduler that decides dispatch/unblock/accept by reading a plain `state/<id>.json` is trivially subverted: write `{state:"DONE"}` by hand and the dependents launch with no gate and no review ever having run. Confirmed working in a probe — a forged record flipped a blocked task to ready. The record *asserts* that review happened; nothing verifies it did.

**Rule:** HMAC-sign every control-state record with a key the untrusted tiers do NOT hold (orchestrator-owned, mode 600, gitignored), re-signing on every legitimate write. Verify the signature on the trust-critical READ — specifically the predicate that unblocks downstream work (`task_done`) — and treat a record that fails verification as TAMPERED (surface to a human), never as its claimed state. Keep an append-only transition journal for tamper-evidence. Migrate existing legit records by signing them once.

**Why this shape wins:** it converts forgery from "write any file" to "hold the signing key," which raises the bar to a full orchestrator-host compromise. The control is cheap (one `openssl dgst -sha256 -hmac` per write/read) and localized — the writers sign, one read predicate verifies, and the whole forgery class closes without changing the state-machine logic.
<!-- /entry -->

<!-- entry:L-security-2026-06-05-003 -->
---
id: L-security-2026-06-05-003
type: lesson
domain: security
tags: [sops, sops-nix, fleet, key-management, threat-model]
since_version: "1.0"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Fleet sops-nix: shared key registry, but per-secret recipient scoping — 2026-06-05 · Claude

**Root cause:** "Every host holds every host's public key" (a uniform recipient registry) gets conflated with "every secret is encrypted to every host." They are independent — and conflating them hands the most-exposed host the keys to the trust root.

**Rule:**
- Put **all** fleet public age keys in every host's `.sops.yaml` `keys:` block (uniform registry — a fleet-wide secret becomes a one-line recipient add).
- Scope each secret via `creation_rules`: host-local → `[host, admin-master]`; fleet-wide → all (opt-in per secret).
- **Never encrypt a trust-root secret to a host you are hardening *against*.** If host X runs untrusted/automated workloads (a CI/agent executor), X must not be a recipient of the control host's secrets — an X compromise would otherwise decrypt the trust root.
- Use a dedicated, backed-up **admin master key** as a recipient on every secret so management survives a control-host reinstall; back its private key up encrypted, off-host.

**Why this shape wins:** Powered-off hosts are a non-issue — a host must be online only to *decrypt its own* secrets (automatic at boot via its host key). You can `updatekeys`/add secrets for it anytime from the registry and it self-decrypts on next boot. The registry stays uniform and trivial to extend while decrypt capability stays least-privilege and matches the threat model.

<!-- /entry -->

<!-- entry:L-security-2026-06-07-001 -->
---
id: L-security-2026-06-07-001
type: lesson
domain: security
tags: [mirror, proxy, verdaccio, airgap, egress]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## A caching proxy's "no uplinks" config is not a seal — cut network egress — 2026-06-07 · Claude

**Root cause:** A caching registry proxy (verdaccio) stores, alongside each cached packument, the *upstream* tarball URLs (`_distfiles`). Once a package's packument is cached, the proxy fetches arbitrary tarball *versions* straight from those URLs — bypassing `uplinks: {}` entirely. The app-level "no fall-through" is real for packages with no cached packument, and a no-op for ones that do.
**Rule:** Enforce a cache/proxy seal at the **network layer** (block the guest's egress), not just in app config. "No uplinks" is necessary but insufficient. Pair it with a build-time assertion that the egress block is present whenever the proxy is in "sealed" mode.
**Why this shape wins:** verified empirically — `express-3.0.0` (never warmed, not allowlisted) was served despite `uplinks: {}` until a firewall `OUTPUT … REJECT` cut egress; then it 500s. The network cut is the only layer that holds once *any* packument is cached.

<!-- /entry -->

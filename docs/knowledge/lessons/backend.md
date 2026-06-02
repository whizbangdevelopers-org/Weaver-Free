<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — backend

Lessons learned in the **backend** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-backend-2026-05-15-001 -->
---
id: L-backend-2026-05-15-001
type: lesson
domain: backend
tags: [typescript, monorepo, rootdir, sqlite, shared-module, engram]
since_version: "1.0.5"
status: active
scope: project
related: [G-backend-2026-05-15-002]
graduated_to: ""
---

## TypeScript `rootDir: ./src` prevents cross-package DB module import in a non-workspace monorepo — 2026-05-15 · Claude

**Root cause:** The backend's `tsconfig.json` sets `rootDir: ./src` and `outDir: ./dist`. Any file imported from outside `src/` causes tsc to fail: "File is not under 'rootDir'." This blocked the direct import of `openEngramDb()` from `codebase-mcp/src/utils/engram-db.ts`, even though the two packages share a DB file. The result was that `engramRoutes` re-implemented its own DB opener, got it wrong (lazy instead of eager), and the canonical initialization logic (schema + seed) was never called by the backend.

**Rule:** When two packages in a non-workspace monorepo share a SQLite DB file and one needs to initialize it, there are three options:
1. **Workspace package** — extract the DB module to `@weaver/engram-db`, list it in both consumers' `package.json`. Correct long-term.
2. **Relax tsconfig** — remove `rootDir` restriction, adjust outDir structure. Messy but fast.
3. **Co-maintain** — duplicate the init function with an explicit comment: "Co-maintained with `<canonical path>` — direct import blocked by rootDir constraint." This is honest bounded duplication, not silent drift.

Until option 1 ships, apply option 3: mark the duplicate with a comment, keep it structurally identical to the canonical, and add a `related:` link in the knowledge entry so neither can be changed without awareness of the other.

**Why this shape wins:** Silent drift between two "independent" openers is what caused this bug. An explicit comment + `related:` knowledge link makes the co-maintenance intentional and visible. A future reader who changes `openEngramDb` sees the note and knows to update `initEngramDb` too.

<!-- /entry -->

<!-- entry:L-backend-2026-06-02-001 -->
---
id: L-backend-2026-06-02-001
type: lesson
domain: backend
tags: [typescript, declare-global, type-inference, noemitonerror, zod, build]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-backend-2026-05-18-001]
graduated_to: ""
---

## One mismatched `declare global` type parameter poisoned 392 type errors across 51 files — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-02)

**Root cause:** A `declare global { interface Array<_T> { ... } }` in a parser utility used `_T` instead of `T` as the type parameter name. TypeScript requires every declaration of a global interface to use **identical** type parameter names (TS2428); the single-character mismatch poisoned the global `Array` interface, which collapsed every array-derived type — `z.infer`, `Promise.allSettled` tuples, `Object.entries`, every `.map()/.filter()/.includes()` — to `{}` across the whole backend. 386 downstream errors from one line. The cascade was invisible because `backend/tsconfig.json` had `strict: true` but not `noEmitOnError: true`, so `tsc` exited code 2 yet still wrote every `.js` file; the backend ran and all tests passed. Investigation burned hours on TS/Zod versions and tsconfig toggles because single-file compilation (which excluded the poisoned file) always worked and the symptom looked like a `z.infer` complexity ceiling.

**Rule:** (1) Set `noEmitOnError: true` in every backend tsconfig — a build that emits despite type errors is a linter that logs and ignores. (2) Never `declare global` to augment a built-in type (`Array`, `Set`, `Map`, `Promise`); use local utility types or standalone functions. (3) When facing hundreds of `{}` errors, grep for `declare global` FIRST — one mismatched type parameter produces hundreds of unrelated-looking downstream errors.

**Why this shape wins:** `noEmitOnError` would have caught the defect the day it was introduced instead of months later during PDF work. Banning built-in augmentation removes the entire class of global-poisoning at the source. The grep-first heuristic short-circuits the misdirection — the TS2428 root error is buried among the errors it causes, so symptom-driven debugging always points away from it.

<!-- /entry -->

<!-- entry:L-backend-2026-06-02-002 -->
---
id: L-backend-2026-06-02-002
type: lesson
domain: backend
tags: [zod, typescript, explicit-interfaces, z-infer, parse-dont-validate, codeql]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-backend-2026-06-02-001]
graduated_to: ""
---

## Pair Zod schemas with explicit interfaces, not `z.infer`, for any type consumed outside the schema file — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-20)

**Root cause:** `z.infer<>` depends on deep conditional type chains that are the first thing to break under type-system stress (see the `declare global` cascade). Beyond fragility, a bare `as CatalogData` cast on `await response.json()` gives the compiler types but no runtime validation — CodeQL flagged `writeFile(path, JSON.stringify(networkData))` as http-to-file-access because unverified network data flowed to disk with only a type assertion vouching for its shape.

**Rule:** Use a three-part pattern at every external boundary: (1) an explicit `interface` as the single source of type truth; (2) a Zod schema annotated `const schema: z.ZodType<Interface>` so compiler and validator stay in lockstep; (3) parse-don't-validate — `const data: Interface = schema.parse(JSON.parse(raw))` — so everything below the parse is both typed and provably shaped. `z.infer` is acceptable only for local use within the schema module itself.

**Why this shape wins:** The explicit interface survives type-graph stress that collapses `z.infer` to `{}`. The `z.ZodType<Interface>` annotation makes the compiler enforce structural match between schema and interface. And parse-don't-validate converts a CodeQL taint finding into provably-shaped data at zero ongoing cost — the runtime check that the `as` cast was pretending to be.

<!-- /entry -->

<!-- entry:L-backend-2026-06-02-003 -->
---
id: L-backend-2026-06-02-003
type: lesson
domain: backend
tags: [authorization, requiretier, requirerole, rbac, rate-limit, security-audit]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## A tier gate is not an authorization gate — every route needs an explicit `requireRole` — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-19)

**Root cause:** An OWASP A01 pass found three Broken-Access-Control highs where routes were tier-gated (`requireTier`) but not role-gated: `GET /api/network/topology`, `GET /api/notifications`, and the network-management GET routes (bridges, IP pool, firewall, VM config) all let any authenticated user — including viewers — read VM IPs, subnets, and security events with usernames. The mental error: treating "this feature is available at this tier" as if it also answered "this user is allowed to call it." `requireTier` protects *feature availability*; it says nothing about *authorization*.

**Rule:** Every new route gets an explicit `requireRole` preHandler unless there is a stated reason for viewer access — the tier gate never substitutes for it. For rate limiting, always use the `createRateLimit()` helper from `middleware/rate-limit.ts` (driven by a dedicated `DISABLE_RATE_LIMIT` env var rejected in production); never branch on `NODE_ENV` for any security-relevant decision, because a leaked `NODE_ENV=test` would silently disable the control.

**Why this shape wins:** Making `requireRole` mandatory turns "did we authorize this route?" from a per-route judgment call into a checklist invariant an auditor can enforce. Decoupling rate-limit bypass from `NODE_ENV` removes a whole class of "test flag escaped into prod" failures — the security knob has its own name and its own production guard.

<!-- /entry -->

<!-- entry:L-backend-2026-06-02-004 -->
---
id: L-backend-2026-06-02-004
type: lesson
domain: backend
tags: [config, default-tier, mock-data, fallback, demo-mode, fail-safe]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## A backend's default state must be the least-privileged *real* mode, never the synthetic/mock mode — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Root cause:** `backend/src/config.ts` defaulted `tier = TIERS.DEMO` when no license key was configured. Demo tier triggers mock data from `host-info.ts` (`demo-host`, `192.168.1.100`, fake CPU/metrics). A real install with no license key therefore served fabricated hardware — the operator saw "Demo" tier and fake metrics on a real box and assumed a deep failure. The invariant that was violated: demo/mock modes are reachable only via an explicit build flag (`VITE_DEMO_MODE` frontend SPAs that never hit a real backend); a running backend process must never resolve a synthetic mode as its *default*.

**Rule:** Default to `TIERS.FREE` (real host, Free-tier gating). Invalid license key, missing HMAC secret, and expired-past-grace all degrade to Free — not Demo. A paid customer whose license lapses keeps their real VMs and loses only paid features until renewal. Separate "unknown/misconfigured state" from "test mode": mock-data modes require explicit opt-in and are never the fallback for misconfiguration.

**Why this shape wins:** Fallbacks should be the least-privileged *real* mode, not the synthetic one. Mock data as a default fallback is actively misleading — it makes a misconfiguration look like a working (but wrong) system, which is harder to diagnose than an honest degraded-but-real state. Degrading to Free is also less punitive than dumping a lapsed customer into fake data.

<!-- /entry -->

<!-- entry:L-backend-2026-06-02-005 -->
---
id: L-backend-2026-06-02-005
type: lesson
domain: backend
tags: [websocket, httponly-cookie, auth, fastify, upgrade-request, reconnect-storm]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## WebSocket auth over httpOnly cookies must validate on the server's upgrade request — the client can't read the cookie — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Root cause:** The WS client read `localStorage.auth` to append `?token=...` to the WS URL. After the app moved to httpOnly cookies, `localStorage.auth` was never populated — dead code. The server rejected the tokenless upgrade with close code 4401, the client reconnected per exponential backoff, and the loop ran forever ("WebSocket Offline" chip flickering, dashboard frozen). httpOnly cookies are invisible to JavaScript by design, so the client *cannot* extract the token to put in a query param.

**Fix:** Backend (`routes/ws.ts`): when the `token` query param is absent, fall back to `request.cookies?.weaver_token` — the browser auto-attaches cookies (including httpOnly) to the WS upgrade request. Frontend: delete the `localStorage.auth` lookup entirely; the browser sends the cookie automatically. Keep the query-param path only for non-browser clients (curl, tests) that set it explicitly.

**Why this shape wins:** With httpOnly cookies the *only* place the credential is readable is the server's upgrade-request cookie header, so that's where validation must live. Leaving a client-side stub that "helpfully" reads localStorage doesn't degrade gracefully — it silently fails in production and triggers a reconnect storm that looks like a network outage rather than an auth bug.

<!-- /entry -->

<!-- entry:L-backend-2026-06-02-006 -->
---
id: L-backend-2026-06-02-006
type: lesson
domain: backend
tags: [websocket, broadcast, race, optimistic-delete, periodic-sync, interval]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## A fixed-interval WebSocket broadcast races API mutations — a stale snapshot resurrects a just-deleted resource — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-24)

**Root cause:** The backend's WS broadcast timer reads the VM list on a fixed 2-second interval, independently of API calls. When a `DELETE /api/workload/:name` is in flight, the timer can fire and capture a list that *still includes* the VM, then push that stale snapshot to clients *after* the DELETE response landed. On the client, the periodic sync (`updateWorkloads()`) blindly replaces the full list and re-adds the just-removed item — the deleted card reappears even though the delete succeeded.

**Rule:** Any time a server emits a periodic full-list broadcast that a client uses as ground truth, recognize that the broadcast timer is an independent producer racing every API mutation. The broadcast cannot be assumed fresh relative to a just-completed request. Guard the consumer: track pending deletes and filter them out of incoming snapshots until a clean broadcast (resource absent) confirms convergence, then self-clear the guard. (The implemented fix lives in the frontend store's `_pendingDeletes`; see the frontend domain for the client-side mechanics.)

**Why this shape wins:** The race window equals the broadcast interval and cannot be closed by ordering alone — the timer and the request handler don't coordinate. A reconcile guard keyed on "explicitly removed, awaiting confirmation" is the general shape for any optimistic-mutation-plus-periodic-full-sync system, at any interval, and it self-heals once the server's own state catches up.

<!-- /entry -->

<!-- entry:L-backend-2026-06-02-007 -->
---
id: L-backend-2026-06-02-007
type: lesson
domain: backend
tags: [promise-allsettled, pure-parser, subprocess, testability, degradation]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Aggregate independent shell commands with Promise.allSettled + pure parser functions — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-20)

**Root cause:** `HostInfoService` aggregates four independent shell commands (`lscpu`, `df -h`, `ip link show`, `nixos-version`). With `Promise.all`, one failing command (e.g. `nixos-version` on a non-NixOS host) rejects the whole aggregate. And folding parse logic into the service class forced subprocess mocking in tests, which is flaky.

**Rule:** Use `Promise.allSettled` so each field degrades independently to `null`/`[]` when its command fails. Factor each command's output parsing into a *pure* exported function (`parseLscpu`, `parseDf`, `parseIpLink`) separate from the service class — the class handles execution and caching only; parsers are pure input→output and unit-test against hardcoded stdout strings with no subprocess mocking. Parser gotcha that recurs: a single regex with an optional trailing group after a non-greedy `.*?` silently fails to capture (e.g. `ip link` state); split into two matches instead.

**Why this shape wins:** `allSettled` makes the aggregate as robust as its most-available source instead of as fragile as its least-available one — exactly right for host telemetry where some probes are platform-conditional. Pure parsers move all the brittle string logic into deterministic, fast, mock-free unit tests; the service class shrinks to orchestration that rarely changes.

<!-- /entry -->

<!-- entry:L-backend-2026-06-02-008 -->
---
id: L-backend-2026-06-02-008
type: lesson
domain: backend
tags: [http-client, auth-token, test-injection, lazy-init, mcp, module-state]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Export a `setAuthToken()` injector for any HTTP-client module that authenticates lazily — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Root cause:** Adding authentication to an HTTP-client module (here, the `cognee-memory` MCP tool) introduces a new lazy `fetch` — the login. Tests that mock `fetch` for the feature call don't account for the extra login call, so the login receives the *feature's* mock response and the feature call gets nothing — silent parse failures and wrong assertions, with no change to test logic. Auth plumbing leaks into every test that merely needs a token.

**Rule:** Export `setAuthToken(token: string | null, expiresAt?)` alongside the module's public API and back it with a module-level token cache. `beforeEach` pre-seeds (`setAuthToken('test-token')`); `afterEach` resets (`setAuthToken(null)`). Production performs a real login only when the cache is empty or expired. The one test that exercises the login path calls `setAuthToken(null)` first, then supplies two mock responses (login + actual call).

**Why this shape wins:** Tests stay focused on behavior (search, error handling) instead of auth plumbing, and the login path gets exactly one dedicated test rather than being implicitly wired into every token-needing test. The same injector pattern generalizes to any module with lazy-initialized credentials — API keys, OAuth tokens, license HMAC — keeping the credential lifecycle test-controllable without per-test mock gymnastics.

<!-- /entry -->

<!-- entry:L-backend-2026-06-02-009 -->
---
id: L-backend-2026-06-02-009
type: lesson
domain: backend
tags: [sighup, hot-reload, in-memory-store, systemd, users-json]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## SIGHUP hot-reload for in-memory stores with external on-disk writers — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-25)

**Root cause:** The backend loads `users.json` into memory at startup. The `reset-admin-password.sh` script writes directly to `users.json` on disk. Without a restart, the running service still holds the old password hash in memory, so the reset appears to fail. An admin API can't help — a password reset endpoint requires auth, but the admin is locked out; that's the whole point of the script, and an unauthenticated reset endpoint would be a security hole (root-on-the-box is the correct trust boundary).

**Rule:** When a service holds data in memory that external tools can modify on disk, use SIGHUP for reload — not file watchers (race conditions, platform differences), not restart-the-service (downtime, lost connections), not an API endpoint (requires auth the user might not have). `UserStore.reload()` re-reads the file and rebuilds the index; `process.on('SIGHUP', ...)` calls it; the writer sends `systemctl kill --signal=HUP weaver.service` after writing.

**Why this shape wins:** SIGHUP is the standard Unix reload protocol (nginx, PostgreSQL, systemd) — instant, zero-downtime, no lost connections, and enterprise-safe. It cleanly separates the privileged disk writer (root) from the running service without opening an unauthenticated mutation path.

<!-- /entry -->

<!-- entry:L-backend-2026-06-02-010 -->
---
id: L-backend-2026-06-02-010
type: lesson
domain: backend
tags: [eventemitter, websocket, session-revoke, cross-module, fastify, close-code-4402]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## EventEmitter as a cross-module session bus — auth revokes, WS closes with code 4402 — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-25)

**Root cause:** Single-session enforcement requires the auth service (which revokes tokens) to notify the WebSocket handler (which holds live client connections), but those modules have no direct dependency — auth routes register separately from WS routes.

**Rule:** Export a `sessionEvents` EventEmitter from `auth.ts` (the same pattern as `provisioningEvents` from `provisioner-types.ts`). The auth service emits `session-revoked` with the userId after revoking; the WS route listens and closes matching connections with close code 4402, tearing down cleanly via Fastify's `onClose` hook. Use 4402 (distinct from 4401 "auth expired") so clients can show "logged in from another location" rather than a generic session-expired message — both codes stop reconnection.

**Why this shape wins:** The EventEmitter is already the established cross-module pattern in this codebase (provisioning events), so it avoids coupling the auth service to WS implementation details and works naturally with Fastify's plugin lifecycle — no DI wiring, no circular import between the two route plugins.

<!-- /entry -->

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — backend

Known gotchas in the **backend** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-backend-2026-05-13-001 -->
---
id: G-backend-2026-05-13-001
type: gotcha
domain: backend
tags: [tsx, watch, fastify, hot-reload, dev-workflow]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## tsx watch does not reload imported route files — touch the entry-point to force reload — 2026-05-13 · Claude

**Problem:** `tsx watch src/index.ts` monitors filesystem events on the entry-point file only. Editing a route file that is imported by `index.ts` (e.g., `src/routes/engram.ts`) does not trigger a reload. The running process continues serving the old code silently — no error, no "rebuilding" message, no indication that the change was ignored.

**Fix:** After editing any imported route file, touch the entry-point: `touch src/index.ts`. The watcher sees a change to the watched file and restarts the process with all imports fresh.

**Rule:** In a `tsx watch` dev session, any code change in an imported module (route, service, middleware) requires touching the entry-point to take effect. Confirm the change is live by checking the request behavior, not by looking for reload output — tsx watch is silent on ignored imports.

<!-- /entry -->

<!-- entry:G-backend-2026-05-13-002 -->
---
id: G-backend-2026-05-13-002
type: gotcha
domain: backend
tags: [fastify, auth, middleware, public-routes, onrequest-hook]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## Fastify global `onRequest` auth hook silently blocks new routes missing from PUBLIC_ROUTES — 2026-05-13 · Claude

**Problem:** A global `fastify.addHook('onRequest', authMiddleware)` applies to every route, including newly added ones. If the auth middleware uses a `PUBLIC_ROUTES` whitelist allowlist, any route not in that list gets silently blocked — the UI fetch returns 401 with no server-side error logged, no console output, no obvious clue. For endpoints fetched with `credentials: 'include'` from an Engram UI that expects a 200, the graph simply doesn't render and there's no visible error.

**Fix:** Whenever a new route is added to a plugin that's under the global auth hook scope, immediately add its path to `PUBLIC_ROUTES` in `backend/src/middleware/auth.ts`. The symptoms of a missing route path: frontend gets empty data or silently skips render; no backend logs; 401 visible only in DevTools Network tab.

**Rule:** After adding any new API endpoint, grep `auth.ts` PUBLIC_ROUTES. If the route should be public (or auth-deferred), add it immediately — don't discover the miss during UI testing.

<!-- /entry -->

<!-- entry:G-backend-2026-05-14-001 -->
---
id: G-backend-2026-05-14-001
type: gotcha
domain: backend
tags: [fastify, route, side-effects, delivery-path, subprocess]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Dual delivery path accumulation: old side-effect code survives alongside new in-band response — 2026-05-14 · Claude

**Problem:** A route was extended to add in-band content delivery (returning file content in the JSON response body). The old delivery path — `writeFileSync` to a temp file followed by `execFileAsync('code', [tempPath])` to open VSCode — was not removed when the new `content` field was added. Both paths fired on every request: VSCode opened AND the response included the content. The symptom was "it opened VSCode *and* showed content", not just one or the other, making it look like the fix hadn't landed.

**Fix:** When replacing a side-effect delivery mechanism (subprocess spawn, file write, external notification) with an in-band response field, explicitly remove all imports and code paths belonging to the old mechanism in the same commit. Leaving them in causes both to fire. In this case: removed `writeFileSync`, `execFileAsync`, `promisify`, `execFile`, `const execFileAsync`, the temp file write, the subprocess call, and the `opened`/`path` fields from the response schema.

**Rule:** Adding a new delivery path does not automatically disable the old one. Search the handler for every artifact of the prior approach (imports, variables, the call itself, return fields) and delete them. The test: after the change, no code path in the handler should reference the old mechanism.

<!-- /entry -->

<!-- entry:G-backend-2026-05-15-001 -->
---
id: G-backend-2026-05-15-001
type: gotcha
domain: backend
tags: [auth, middleware, routes, dynamic-segments, fastify]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## `PUBLIC_ROUTES.includes()` silently rejects all dynamic route paths like `/api/x/:name/y` — 2026-05-15 · Claude

**Problem:** New Engram dataset-management routes (`/api/engram/datasets/:name/config`, `/api/engram/datasets/:name/upgrade`, `/api/engram/queue/:id`) were added but never added to `PUBLIC_ROUTES` in `auth.ts`. The auth middleware uses `PUBLIC_ROUTES.includes(path)` — exact-string matching. The actual request path contains a real segment value (e.g., `/api/engram/datasets/myds/config`), which never matches the `:name` placeholder pattern, so every request returned 401. No error, no log — just silent rejection.

**Fix:** Add a separate `PUBLIC_PREFIXES` array for route families with parameterised segments, and update `isPublicRoute` to check both:

```ts
const PUBLIC_PREFIXES = ['/api/engram/datasets/', '/api/engram/queue/']

function isPublicRoute(url: string): boolean {
  const path = url.split('?')[0]
  return PUBLIC_ROUTES.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))
}
```

**Rule:** When adding a new parameterised route family to a public allowlist that uses exact-string matching, always add a prefix entry at the same time. The exact-string list is only correct for routes with no path parameters. Symptom of missing entry: 401 responses with a valid session, reproducible by curling the route unauthenticated — the same 401 you'd expect, so it's easy to misdiagnose as a Cognee/upstream error rather than an auth middleware gap.

<!-- /entry -->

<!-- entry:G-backend-2026-05-15-002 -->
---
id: G-backend-2026-05-15-002
type: gotcha
domain: backend
tags: [sqlite, database, lazy-init, silent-failure, engram]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-backend-2026-05-15-001]
graduated_to: ""
---

## Lazy `existsSync → null` DB opener silently breaks all routes without any error — 2026-05-15 · Claude

**Problem:** A SQLite DB accessor that checks `if (!existsSync(dbPath)) return null` causes every route handler to silently degrade: `/strategies` returns `{}`, `/datasets/:name/config` returns 503, `/queue` returns `{ queue: [] }`. No error log, no startup warning, no crash. The DB file is absent because no initializer ever created it — the opener only opens existing files. The symptom looks like "data not ingested yet" rather than "DB never initialized."

**Fix:** Replace the lazy opener with an eager `initDb(dbPath)` called once at plugin registration: `mkdirSync` to ensure directory, `new DatabaseSync(dbPath)` to create the file, `handle.exec(SCHEMA)` for schema, migrations, and seed rows. Store the returned handle in the plugin closure. Remove all `null` guards from route handlers — the handle is always valid after initialization.

**Rule:** Never write a DB opener that returns null on a missing file. A missing file is an initialization event, not an error condition. Any route that handles `db() === null` by returning empty data is converting a startup failure into silent data loss. Fix at the opener, not at every call site.

<!-- /entry -->

<!-- entry:G-backend-2026-05-18-001 -->
---
id: G-backend-2026-05-18-001
type: gotcha
domain: backend
tags: [zod, semver, npm, typescript, v4-bridge]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## zod@3.25.x is a Zod v4 compatibility bridge, not a real v3 release — 2026-05-18 · Claude

**Problem:** `zod@^3.x.x` installed `3.25.76` via semver, which appeared to be a patch bump. But the `3.25.x` series is Zod v4 shipped as a backward-compat bridge — `index.d.cts` does `export * from "./v3/external.cjs"` rather than exporting the real v3 types. The compat layer doesn't implement the full v3 API, so `tsc` emitted 625 errors on existing Zod v3 code despite the lockfile claiming v3.25. The breakage looked like `@types/node` corruption because the errors appeared across every file that imported from `zod`.

**Fix:** Pin `backend/package.json` to the exact last real Zod v3: `"zod": "3.24.4"` (no caret, no tilde). Run `npm install --workspace=backend`.

**Rule:** Use an exact version pin (`3.24.4`, not `^3.24.4`) for Zod in any project on v3. The `3.25.x` range is permanently occupied by the v4 bridge; a range specifier will re-promote on the next `npm install` after a cache clear.

<!-- /entry -->

<!-- entry:G-backend-2026-06-02-001 -->
---
id: G-backend-2026-06-02-001
type: gotcha
domain: backend
tags: [fastify, fastify-type-provider-zod, zod, validation, error-handler]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-backend-2026-05-18-001]
graduated_to: ""
---

## fastify-type-provider-zod v4 surfaces validation errors on error.validation — old `.issues` check is dead — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-02)

**Problem:** Handling Zod validation failures in a custom error handler is version-dependent. In the old v1.2.0 (Fastify 4) line, `wrapValidationError` returned the raw `ZodError` (which `instanceof Error`) with `statusCode=400` but **never set `.validation`** — so a handler checking `error.validation` always missed Zod errors, and you had to detect them via the `.issues` array. On the current `fastify-type-provider-zod@4.x` (Fastify 5), that is reversed: errors are wrapped as `ZodFastifySchemaValidationError` objects on the standard `error.validation` property, and the old `.issues` probe no longer fires.

**Fix:** On the current v4 stack, detect via `error.validation` (or the library's `hasZodFastifySchemaValidationErrors(error)` type guard) and read `.message` per entry:
```typescript
if (error.validation) {
  const messages = error.validation
    .map((v: { message?: string }) => v.message ?? '')
    .filter(Boolean)
  return reply.status(400).send({ error: 'Validation failed', details: messages })
}
```
The `details` field is a string array — the frontend joins with `Array.isArray(data?.details) ? data.details.join('. ') : ...`.

**Rule:** The Zod-error surface depends on the `fastify-type-provider-zod` major: v1 → raw ZodError with `.issues` and no `.validation`; v4 → wrapped on `error.validation`. The project is pinned to v4.0.2 (the ceiling for Zod 3 — v5+ requires Zod 4), so use `error.validation`. When the validation branch stops firing after a plugin bump, check which major you're on before debugging the handler.

<!-- /entry -->

<!-- entry:G-backend-2026-06-02-002 -->
---
id: G-backend-2026-06-02-002
type: gotcha
domain: backend
tags: [fastify, decorate-request, fastify-5, custom-properties, tests]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Fastify 5 requires decorateRequest before setting any custom request property — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-02)

**Problem:** Fastify 5 enforces request-object shape optimization. Setting a custom property on `request` (e.g. `request.userId` in an auth hook) without first declaring it via `decorateRequest()` can throw or behave incorrectly. The `declare module 'fastify'` TypeScript augmentation only fixes *types* — it does nothing for the *runtime* shape.

**Fix:** Call `decorateRequest()` for each custom property immediately after creating the Fastify instance, before any hooks or route registration:
```typescript
fastify.decorateRequest('userId', undefined)
fastify.decorateRequest('userRole', undefined)
fastify.decorateRequest('username', undefined)
fastify.decorateRequest('tokenId', undefined)
fastify.decorateRequest('authRejectionReason', undefined)
```

**Rule:** Every custom request property in Fastify 5 needs a matching `decorateRequest()` at instance creation. This includes test files: any test that builds its own Fastify instance AND uses custom request properties (via auth middleware or a manual hook) needs the same `decorateRequest()` calls, or the assignment fails only under test.

<!-- /entry -->

<!-- entry:G-backend-2026-06-02-003 -->
---
id: G-backend-2026-06-02-003
type: gotcha
domain: backend
tags: [fastify-5, error-handler, typescript, ts18046, fastifyerror]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Fastify 5 setErrorHandler types the error as `unknown` — annotate it FastifyError — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-02)

**Problem:** In Fastify 5, `setErrorHandler` defaults its error type parameter to `unknown`. Accessing `error.validation`, `error.statusCode`, or `error.message` without a type annotation fails with TS18046 ("error is of type unknown").

**Fix:** Explicitly type the error parameter:
```typescript
import Fastify, { type FastifyError } from 'fastify'
fastify.setErrorHandler((error: FastifyError, request, reply) => { ... })
```

**Rule:** Always annotate the `setErrorHandler` callback's first parameter as `FastifyError` in Fastify 5. The default `unknown` is intentional (forces handling), not a bug to work around with `as any`.

<!-- /entry -->

<!-- entry:G-backend-2026-06-02-004 -->
---
id: G-backend-2026-06-02-004
type: gotcha
domain: backend
tags: [fastify, plugin, version-compat, peer-deps, npm-ci, docker]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## @fastify/<plugin>@N targets Fastify N-1 — wrong major only fails in fresh npm ci — 2026-06-02 · Claude (migrated from legacy archive, orig. legacy backend section)

**Problem:** Each `@fastify/<plugin>` major targets a specific Fastify major (the plugin major is one ahead). Installing a plugin major that doesn't match the Fastify version often works locally (deduped tree) but fails in Docker on a fresh `npm ci` — the mismatch only surfaces with a clean install.

**Fix:** Check peer deps before installing. Current baseline (Fastify 5):

| Plugin | Version | Fastify |
|--------|---------|---------|
| @fastify/compress | 8.x | 5 |
| @fastify/cors | 11.x | 5 |
| @fastify/helmet | 13.x | 5 |
| @fastify/rate-limit | 10.x | 5 |
| @fastify/static | 9.x | 5 |
| @fastify/websocket | 11.x | 5 |

**Rule:** Always verify a `@fastify/*` plugin's required Fastify version before installing — never assume the latest major matches your Fastify major. If it works locally but breaks in Docker/CI, suspect a plugin-major-vs-Fastify-major mismatch first.

<!-- /entry -->

<!-- entry:G-backend-2026-06-02-005 -->
---
id: G-backend-2026-06-02-005
type: gotcha
domain: backend
tags: [fastify-type-provider-zod, version-ceiling, zod-3, zod-4]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-backend-2026-05-18-001, G-backend-2026-06-02-001]
graduated_to: ""
---

## fastify-type-provider-zod v5+ requires Zod 4 — Zod-3 projects ceiling at 4.0.2 — 2026-06-02 · Claude (migrated from legacy archive, orig. legacy backend section)

**Problem:** `fastify-type-provider-zod` v5+ requires Zod 4 (peer `zod@>=3.25.56`, which is Zod v4's npm range — see the zod@3.25.x bridge gotcha). A project on Zod 3 that lets the type-provider float to v5 gets a peer-dep mismatch and broken validation typing.

**Fix:** Pin to `fastify-type-provider-zod@4.0.2` (the last major compatible with Zod 3). The project's `backend/package.json` carries `"fastify-type-provider-zod": "^4.0.2"` alongside the exact `"zod": "3.24.4"` pin.

**Rule:** The Zod major and the `fastify-type-provider-zod` major are coupled: Zod 3 → type-provider 4.x; Zod 4 → type-provider 5+. Pin both together. Bumping one without the other breaks request/response validation typing.

<!-- /entry -->

<!-- entry:G-backend-2026-06-02-006 -->
---
id: G-backend-2026-06-02-006
type: gotcha
domain: backend
tags: [rate-limit, fastify, per-route, node-env, test-mode, 429]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## @fastify/rate-limit per-route config fully replaces global — test mode must be re-checked per route — 2026-06-02 · Claude (migrated from legacy archive, orig. legacy backend section)

**Problem:** A per-route `config: { rateLimit: { max: 10 } }` does **not** merge with the global rate-limit config — it replaces it entirely. So a global `max: 1_000_000` set for test mode is ignored on any route that declares its own limit, and parallel E2E/unit tests hit 429 after 10 calls on that route.

**Fix:** Route every per-route limit through the `createRateLimit()` helper, which independently checks the bypass flag:
```typescript
const authRateLimit = { max: process.env.NODE_ENV === 'test' ? 1_000_000 : 10, timeWindow: '1 minute' }
```
The project's helper is driven by a dedicated `DISABLE_RATE_LIMIT` env var (rejected in production) rather than a bare `NODE_ENV` check.

**Rule:** Because per-route rate-limit config wholly replaces the global, every per-route limit must independently encode the test-mode/bypass branch. Never assume a global test-mode loosening protects a route that sets its own `max`.

<!-- /entry -->

<!-- entry:G-backend-2026-06-02-007 -->
---
id: G-backend-2026-06-02-007
type: gotcha
domain: backend
tags: [rate-limit, diagnostic-endpoint, execfileasync, doctor, polling]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-backend-2026-06-02-006]
graduated_to: ""
---

## Diagnostic endpoints that shell out must be rate-limited hard and never polled — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-09)

**Problem:** The doctor endpoint (`backend/src/routes/doctor.ts`) runs `execFileAsync` against system binaries (`qemu`, `df`, `ip`, `nixos-version`) and reads `/proc`. Each call is expensive and shells out, so an unthrottled or polled diagnostic endpoint is an abuse/DoS vector.

**Fix:** Rate-limit aggressively — `config: { rateLimit: createRateLimit(5) }` (5/min) — and call it at most once on mount, never on a poll cycle. The UI uses a passive indicator (colored dot) with an explicit "Run" button for fresh results.

**Rule:** Any endpoint that spawns subprocesses or reads system files gets an aggressive per-route rate limit and is never wired to a polling interval. Drive fresh diagnostics from an explicit user action, not a timer.

<!-- /entry -->

<!-- entry:G-backend-2026-06-02-008 -->
---
id: G-backend-2026-06-02-008
type: gotcha
domain: backend
tags: [pino-pretty, transport, devdependency, startup-crash, production]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## pino-pretty is a devDependency — installing with --production crashes startup — 2026-06-02 · Claude (migrated from legacy archive, orig. legacy backend section)

**Problem:** The backend crashes at startup with "unable to determine transport target for pino-pretty" when `pino-pretty` is missing — which happens after `npm install --production` (it lives in devDependencies).

**Fix:** Install backend deps without `--production` in dev (`cd backend && npm install`). In production, configure pino to emit plain JSON (no `pino-pretty` transport) so the package is genuinely unneeded — don't ship the pretty transport to production at all.

**Rule:** `pino-pretty` is a development-only transport. Keep it in devDependencies and ensure the production logger config never references it. A production build that requires `pino-pretty` is misconfigured logging, not a missing dependency to add.

<!-- /entry -->

<!-- entry:G-backend-2026-06-02-009 -->
---
id: G-backend-2026-06-02-009
type: gotcha
domain: backend
tags: [distro-catalog, image-manager, spread, merge-order, runtime-override]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## ImageManager.getAllSources() spread lets the catalog JSON silently override DISTRO_IMAGES builtins — 2026-06-02 · Claude (migrated from legacy archive, orig. legacy backend section)

**Problem:** `getAllSources()` returns `{ ...DISTRO_IMAGES, ...catalogSources, ...customSources }`. Any distro present in both the in-code `DISTRO_IMAGES` and the shipped `backend/data/distro-catalog.json` takes its properties from the catalog. A fix to a property in `DISTRO_IMAGES` (e.g. `cloudInit: false`) has zero runtime effect if the catalog still defines that distro with the old value. The real failure: CirrOS's catalog entry `cloudInit: true` overrode the builtin `cloudInit: false`, so `generateCloudInit()` fired and every provision failed with `spawn mkisofs ENOENT`.

**Fix:** When correcting a distro property, update all three layers that can define it: (1) `DISTRO_IMAGES` in `image-manager.ts` (builtin default), (2) `backend/data/distro-catalog.json` (catalog override), (3) any custom distro records in the live DB. Diagnose effective behavior via `GET /api/distros` (reflects the merged result), not by reading `DISTRO_IMAGES` in source.

**Rule:** In a later-spread-wins merge, the last source is authoritative — treat `distro-catalog.json` as the runtime source of truth for catalog distros and `DISTRO_IMAGES` as the fallback for distros absent from the catalog, not as an override layer. Any property fix must touch whichever layer actually wins the spread.

<!-- /entry -->

<!-- entry:G-backend-2026-06-02-010 -->
---
id: G-backend-2026-06-02-010
type: gotcha
domain: backend
tags: [typescript, z-infer, explicit-interface, type-stress]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-backend-2026-06-02-002, L-backend-2026-06-02-001]
graduated_to: ""
---

## z.infer is the first type to collapse to `{}` under type-system stress — prefer explicit interfaces for exported types — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-02)

**Problem:** `z.infer<>` relies on deep conditional type chains and is the first construct to break under any type-graph stress (e.g. the `declare global` poisoning that collapsed all array-derived inference to `{}`). When `z.infer` is used for types exported and consumed across modules, a single upstream type defect silently degrades every downstream consumer to `{}` with no local clue.

**Fix:** Use an explicit `interface` for any type consumed outside its schema file, kept in lockstep with the schema via a `z.ZodType<Interface>` annotation. Reserve `z.infer` for local use within the schema module only.

**Rule:** Exported types get explicit interfaces; `z.infer` stays internal to the schema file. This provides resilience against type-graph stress and makes consuming modules self-documenting. See [[L-backend-2026-06-02-002]] for the full parse-don't-validate pattern.

<!-- /entry -->

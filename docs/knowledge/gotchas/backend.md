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

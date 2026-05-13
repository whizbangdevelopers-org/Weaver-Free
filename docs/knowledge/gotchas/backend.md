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

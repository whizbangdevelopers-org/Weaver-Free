<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: QA — Route Auth Coverage Checker

**Priority:** Cross-cutting (security infrastructure)
**Tier:** All
**Parallelizable:** Yes (independent)
**Plan:** Prevents recurrence of Phase 6 OWASP A01 findings (3 High — routes missing `requireRole`)

---

## Scope

Automated verification that all backend routes have proper authorization controls. Scans all route files and reports routes missing `requireRole`, `requireTier`, `createRateLimit`, or Zod schema validation.

**Core rule (from OWASP audit):** "Every new route must have a `requireRole` preHandler unless there's an explicit reason for viewer access. The tier gate (`requireTier`) protects feature availability; it does NOT protect authorization."

**Standards enforced:**
1. Every route has `requireRole` OR is explicitly exempted (auth routes, health, public reads)
2. Weaver/Fabrick features have `requireTier` alongside `requireRole`
3. Mutation routes (POST/PUT/DELETE) have rate limiting via `createRateLimit()` helper (not inline objects)
4. All request bodies validated with Zod schemas
5. No raw `err.message` from system calls in API responses

### What's Already Done

- Phase 6 OWASP audit found and fixed 3 High A01 findings (3eb4ac9, 1675b0b)
- `requireRole` helper in `backend/src/middleware/auth.ts`
- `requireTier` helper in `backend/src/middleware/tier.ts`
- `createRateLimit` helper in `backend/src/middleware/rate-limit.ts`
- Rules documented in `.claude/rules/backend.md` and `.claude/rules/security.md`

### What This Agent Catches on Re-Scan

- New routes added without `requireRole`
- New weaver/fabrick routes missing `requireTier`
- Mutation routes using inline rate limit objects instead of `createRateLimit()`
- Routes missing Zod schema validation on request body
- Raw `err.message` leaking in new error responses

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/routes/*.ts` | All core route files — scan for auth patterns |
| `backend/src/routes/premium/*.ts` | Weaver route files — verify both role + tier gates |
| `backend/src/routes/enterprise/*.ts` | Fabrick routes — verify Fabrick tier gate |
| `backend/src/middleware/auth.ts` | `requireRole` implementation — understand the pattern |
| `backend/src/middleware/tier.ts` | `requireTier` implementation |
| `backend/src/middleware/rate-limit.ts` | `createRateLimit` helper |
| `.claude/rules/backend.md` | Route compliance rules |
| `.claude/rules/security.md` | Security requirements per route |

---

## Outputs

### Script

| File | Type | Description |
|------|------|-------------|
| `scripts/verify-route-auth.ts` | New | Static scanner — audits all route files for auth/tier/rate-limit compliance |

### Config

| File | Type | Description |
|------|------|-------------|
| `package.json` | Modify | Add `audit:routes` npm script |

---

## Design

### Scanner Algorithm

1. **Discover route files:**
   - Glob `backend/src/routes/**/*.ts`
   - Skip `index.ts` files that only re-export

2. **Parse each route file:**
   - Extract all route registrations: `fastify.get()`, `fastify.post()`, `fastify.put()`, `fastify.delete()`
   - For each route, extract: HTTP method, path, preHandler array, config object, handler body

3. **Check requireRole:**
   - Does the route have `requireRole` in its `preHandler` or `onRequest`?
   - If not, is it on the known exemption list?
   - Known exemptions:
     - `GET /api/health` — public endpoint
     - `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/setup-required` — pre-auth
     - `POST /api/auth/refresh` — uses refresh token, not session
     - Routes with explicit ACL preHandlers (agent, VM list/detail)
     - `GET /api/distros`, `GET /api/distros/url-status` — read-only catalog data
     - `GET /api/tags` — read-only tag list
     - WebSocket routes (use `verifyWsToken` instead)

4. **Check requireTier:**
   - For routes in `routes/premium/` — verify `requireTier('premium')` at route or plugin level
   - For routes in `routes/enterprise/` — verify `requireTier('enterprise')`
   - For routes that create/delete VMs — verify tier gate exists

5. **Check rate limiting:**
   - For POST/PUT/DELETE routes — verify `createRateLimit()` or inline `rateLimit` config
   - Flag routes using inline `config: { rateLimit: { ... } }` instead of `createRateLimit()` helper
   - Known acceptable: routes that inherit plugin-level rate limits

6. **Check Zod validation:**
   - For POST/PUT routes with request bodies — verify `schema.body` references a Zod schema
   - For routes with path params — verify `schema.params` exists

7. **Check error responses:**
   - Scan handler bodies for `err.message` passed directly to `reply.send()`
   - Exclude typed `AuthError` catches (these are intentionally user-facing)
   - Flag any `catch (err)` blocks where `err.message` flows to response body

### Output Format

```
Route Auth Coverage Report
==========================

ROUTES SCANNED: 47 across 16 files

COMPLIANT: 42
  GET  /api/vms          — role: ACL preHandler, tier: none, rateLimit: global
  POST /api/vms          — role: admin,operator, tier: free+, rateLimit: 30/min
  ...

ISSUES FOUND: 3
  [MISSING_ROLE] POST /api/foo/bar — no requireRole or ACL preHandler
  [INLINE_RATELIMIT] POST /api/distros/:name/test — uses inline config, should use createRateLimit()
  [MISSING_TIER] DELETE /api/weaver/widget — in weaver/ directory but no requireTier

EXEMPTED: 7
  GET  /api/health        — public endpoint (health check)
  POST /api/auth/login    — pre-authentication route
  ...
```

Exit code: 0 = all pass, 1 = issues found.

---

## Known Current Issues (to be flagged, not necessarily fixed by this agent)

These are known deviations from the ideal pattern, documented for visibility:

1. `vms.ts` mutation routes use inline `rateLimit` config objects instead of `createRateLimit()` helper
2. `premium/notification-config.ts` channel test route uses inline rate limit
3. `distros.ts` test route uses inline rate limit
4. `auth.ts` uses manual `request.userRole` checks instead of `requireRole` (acceptable — auth routes establish identity)
5. `audit.ts` uses manual role check instead of `requireRole` (fixable)
6. `premium/web-push.ts` subscribe/unsubscribe use manual `request.userId` checks (acceptable — user-scoped)

---

## Safety Rules

1. Script is read-only — never modifies source files
2. Exit codes: 0 = all clean, 1 = issues found (CI-friendly)
3. Exemption list is hardcoded in the scanner — adding new exemptions requires updating the script

---

## Acceptance Criteria

1. `npx tsx scripts/verify-route-auth.ts` reports all 47+ routes with correct categorization
2. Scanner correctly identifies the 3 known inline rate limit deviations
3. Scanner correctly exempts auth, health, and public read routes
4. New routes added without `requireRole` are flagged
5. `npm run audit:routes` runs clean (exits 0) on current codebase (known issues can be exempted)

---

## E2E Notes

- **E2E impact:** None — read-only static analysis
- **Temp resources:** None
- **Cleanup:** None

---

## Documentation

| Target | Updates |
|--------|---------|
| `docs/DEVELOPER-GUIDE.md` | Add "Route Auth Audit" under Development Tools |
| `CLAUDE.md` | Add `audit:routes` to Key Commands |

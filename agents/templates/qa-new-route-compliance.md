<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: QA — New Route Compliance Checklist

**Priority:** Cross-cutting (development infrastructure)
**Tier:** All
**Parallelizable:** Yes (independent)
**Plan:** Enforces the full compliance checklist for every new backend route — combines auth, validation, rate limiting, error handling, audit logging, Zod schemas, and documentation requirements into a single pass/fail scan

---

## Scope

Comprehensive per-route compliance scanner. While the Route Auth Coverage Checker (qa-route-auth-coverage) focuses on authorization gates, this agent verifies the **complete** set of requirements every route must satisfy. Think of it as the "linter for routes" — every new route file must pass before merge.

**Why this exists separately from route auth coverage:** Route auth coverage answers "is this route protected?" This agent answers "does this route follow ALL project patterns?" — including Zod schemas with error status codes, audit logging for mutations, the `createRateLimit()` helper pattern, error sanitization, and documentation in CLAUDE.md + DEVELOPER-GUIDE.

**Standards enforced (from `.claude/rules/backend.md` + `.claude/rules/security.md`):**

1. **Zod validation:** Request body, params, and query validated with Zod schemas
2. **Zod response schemas:** Must cover ALL response status codes (200, 400, 403, 404, 409) — Fastify validates responses too
3. **requireRole preHandler:** Every route has one (or documented exemption)
4. **requireTier preHandler:** Weaver routes have `requireTier('premium')`, Fabrick routes `requireTier('enterprise')`
5. **Rate limiting:** Mutation routes use `createRateLimit()` helper (not inline objects)
6. **Error sanitization:** No raw `err.message` from system calls in responses — sanitized user-facing message only
7. **Audit logging:** All state-mutating routes call `auditService?.log()` with userId, username, action, resource, ip, success
8. **System commands:** Via `execFileAsync` with argument arrays, NEVER `shell: true`
9. **Path validation:** User-supplied names validated against safe patterns before use in file paths
10. **Documentation:** New routes appear in CLAUDE.md API table and DEVELOPER-GUIDE

### What's Already Done

- All current routes follow these patterns (verified during Phase 6 OWASP audit)
- Rules documented in `.claude/rules/backend.md` and `.claude/rules/security.md`
- `feature-agent.md` template includes "All Endpoints Affected" section requiring this info

### What This Agent Catches

- New routes that skip any of the 10 compliance items
- Existing routes that regress (e.g., someone removes a Zod schema during refactoring)
- Response schemas missing error status codes (the most common Fastify gotcha)
- Mutation routes without audit logging
- System command calls using `shell: true`

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/routes/*.ts` | All route files — scan targets |
| `backend/src/routes/premium/*.ts` | Weaver routes |
| `backend/src/schemas/*.ts` | Zod schema definitions |
| `backend/src/middleware/auth.ts` | requireRole pattern |
| `backend/src/middleware/tier.ts` | requireTier pattern |
| `backend/src/middleware/rate-limit.ts` | createRateLimit helper |
| `.claude/rules/backend.md` | Full backend rules |
| `.claude/rules/security.md` | Security requirements |
| `CLAUDE.md` | API endpoint table (check new routes appear) |
| `docs/DEVELOPER-GUIDE.md` | API documentation (check new routes documented) |

---

## Outputs

### Script

| File | Type | Description |
|------|------|-------------|
| `scripts/verify-route-compliance.ts` | New | Full route compliance scanner — 10-point checklist per route |

### Config

| File | Type | Description |
|------|------|-------------|
| `package.json` | Modify | Add `audit:route-compliance` npm script |

---

## Design

### Scanner Algorithm

For each route file in `backend/src/routes/**/*.ts`:

1. **Parse route registrations** — extract all `fastify.{method}(path, opts, handler)` calls
2. **For each route, check all 10 compliance items:**

```
┌─────────────────────────────────────────────────────┐
│ Route: POST /api/widgets                            │
├─────────────────────────────────────────────────────┤
│ 1. Zod body schema        ✓  widgetCreateSchema     │
│ 2. Zod response schemas   ✗  Missing 409 status     │
│ 3. requireRole            ✓  admin,operator          │
│ 4. requireTier            ✓  weaver                 │
│ 5. Rate limit             ✓  createRateLimit(10)     │
│ 6. Error sanitization     ✓  No raw err.message      │
│ 7. Audit logging          ✗  No auditService.log()   │
│ 8. System commands        —  N/A (no execFileAsync)   │
│ 9. Path validation        —  N/A (no file paths)      │
│10. Documentation          ✗  Not in CLAUDE.md table   │
└─────────────────────────────────────────────────────┘
```

### Check Details

**Check 1 — Zod body schema:**
- POST/PUT routes: verify `schema: { body: someZodSchema }` in route options
- GET/DELETE routes: verify `schema: { params: ... }` if path has `:param`
- Detection: look for `schema` property in route options object

**Check 2 — Zod response schemas:**
- Verify `schema: { response: { ... } }` exists
- For mutation routes: verify `400`, `403`, `404` status codes have schemas
- Common miss: only defining `200` response schema
- Detection: parse the `response` object keys, compare against route's error `reply.status()` calls

**Check 3 — requireRole:**
- Verify `preHandler` array includes `requireRole(...)` call
- Or verify route is on exemption list (auth, health, public reads)
- Detection: grep for `requireRole` in route options or preHandler

**Check 4 — requireTier:**
- For files in `routes/premium/`: verify `requireTier('premium')` at route or plugin level
- For files in `routes/enterprise/`: verify `requireTier('enterprise')`
- Detection: grep for `requireTier` in route or parent plugin registration

**Check 5 — Rate limiting:**
- Mutation routes (POST/PUT/DELETE): verify rate limit exists
- Must use `createRateLimit()` helper, not inline `config: { rateLimit: {} }`
- Detection: grep for `createRateLimit` vs inline `rateLimit:` in config

**Check 6 — Error sanitization:**
- In `catch` blocks: verify `err.message` is not passed to `reply.send()`
- Exception: `AuthError` catches are acceptable (typed user-facing errors)
- Detection: parse catch blocks, check if `err.message` flows to reply

**Check 7 — Audit logging:**
- POST/PUT/DELETE routes: verify `auditService?.log()` or `auditService.log()` call exists
- Must include: userId, username, action, resource, ip, success
- Detection: grep for `auditService` in handler body

**Check 8 — System commands:**
- If route calls `execFileAsync` or `execFile`: verify no `shell: true` option
- Verify commands use full paths (contain `/` in command string)
- Detection: grep for `exec` in handler, check options object

**Check 9 — Path validation:**
- If route uses `:name` param in file path construction: verify regex validation
- Expected pattern: `/^[a-z][a-z0-9-]*$/` test before path concatenation
- Detection: check if param is used in `path.join()`, `path.resolve()`, or string template with `/`

**Check 10 — Documentation:**
- New routes must appear in `CLAUDE.md` API endpoint table
- Parse CLAUDE.md table, extract documented endpoints, compare against actual routes
- Detection: read CLAUDE.md, parse markdown table, diff against route list

### Output Format

```
Route Compliance Report
=======================

FILES SCANNED: 16
ROUTES SCANNED: 47

FULLY COMPLIANT: 39/47

NON-COMPLIANT ROUTES:

  POST /api/distros/:name/test (distros.ts:234)
    [5] RATE_LIMIT: Uses inline rateLimit config — should use createRateLimit()

  PUT /api/notifications/config/resource-alerts (notification-config.ts:89)
    [2] RESPONSE_SCHEMA: Missing 404 status in response schema

  GET /api/vms/:name/agent/:operationId (agent.ts:67)
    [3] REQUIRE_ROLE: No requireRole — uses ACL preHandler (add to exemptions if intentional)

DOCUMENTATION GAPS:
  POST /api/distros/:name/test — not in CLAUDE.md API table
  GET  /api/distros/url-status — not in CLAUDE.md API table

SUMMARY: 4 issues across 3 routes, 2 documentation gaps
```

Exit code: 0 = all pass, 1 = issues found.

---

## Relationship to Other Audit Agents

| Agent | Scope | Overlap |
|-------|-------|---------|
| Route Auth Coverage (`qa-route-auth-coverage`) | Checks 3, 4, 5 only | This agent is a superset — covers all 10 checks |
| CRUD Completeness (`qa-crud-completeness`) | Backend → frontend mapping | Complementary — no overlap |
| Form Validation Audit (`qa-form-validation-audit`) | Frontend form rules | No overlap |
| Legal/IP Audit (`security-legal-ip-audit`) | Licensing and copyright | No overlap |

**Recommendation:** Run `audit:route-compliance` as the primary backend audit. `audit:routes` (auth coverage) can be retired once this agent is built, or kept as a lightweight fast-check alternative.

---

## Safety Rules

1. Script is read-only — never modifies source files
2. Exit codes: 0 = all clean, 1 = issues found (CI-friendly)
3. False positives are possible for complex handler patterns — exemption mechanism provided
4. Documentation check requires CLAUDE.md to be parseable markdown

---

## Acceptance Criteria

1. `npx tsx scripts/verify-route-compliance.ts` scans all 47+ routes
2. Each route gets all 10 compliance checks (or N/A where not applicable)
3. Known inline rate limit deviations are flagged
4. New routes missing from CLAUDE.md API table are flagged
5. Mutation routes without `auditService.log()` are flagged
6. `npm run audit:route-compliance` runs clean on current codebase (with known exemptions)

---

## E2E Notes

- **E2E impact:** None — read-only static analysis
- **Temp resources:** None
- **Cleanup:** None

---

## Documentation

| Target | Updates |
|--------|---------|
| `docs/DEVELOPER-GUIDE.md` | Add "Route Compliance Audit" under Development Tools |
| `CLAUDE.md` | Add `audit:route-compliance` to Key Commands |

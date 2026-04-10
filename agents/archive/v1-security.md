<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-security — Security Hardening

**Plan:** [V1-PRODUCTION-PLAN](../plans/V1-PRODUCTION-PLAN.md) (Track 3)
**Parallelizable:** Yes (independent of auth/rbac/audit/license)
**Blocks:** None (v1-release depends on all tracks)

---

## Scope

Harden the application for production deployment: rate limiting, CORS, CSP headers, WebSocket authentication, input validation audit, error response sanitization. No new features — only security infrastructure.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/index.ts` | Plugin registration order |
| `backend/src/routes/ws.ts` | WebSocket setup to add auth |
| `backend/src/routes/vms.ts` | Route pattern, existing Zod validation |
| `backend/src/schemas/agent.ts` | Existing Zod schema pattern |
| `backend/package.json` | Current dependencies |
| `scripts/security-audit.sh` | Existing audit script |
| `nixos/default.nix` | NixOS module for HTTPS docs |

---

## Inputs

- Existing Fastify backend with no rate limiting, no CORS config, no security headers
- WebSocket connections currently unauthenticated
- Some routes have Zod validation, some may not
- `scripts/security-audit.sh` exists but may need enhancement

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/plugins/rate-limit.ts` | New | @fastify/rate-limit: 100/min general, 10/min auth endpoints |
| `backend/src/plugins/cors.ts` | New | @fastify/cors: configurable allowed origins |
| `backend/src/plugins/helmet.ts` | New | @fastify/helmet: CSP, X-Frame-Options, X-Content-Type-Options, etc. |
| `backend/src/index.ts` | Modify | Register security plugins before routes |
| `backend/src/routes/ws.ts` | Modify | Validate JWT token on WebSocket upgrade (query param or first message) |
| All route files | Audit | Verify every user input goes through Zod schema |
| Error handlers | Modify | Ensure no stack traces leak in production (NODE_ENV=production) |
| `backend/src/config.ts` | Modify | Add `corsOrigins`, `rateLimitMax`, `trustedProxies` config options |

### Infrastructure

| File | Type | Description |
|------|------|-------------|
| `scripts/security-audit.sh` | Modify | Enhanced audit: npm audit + known vulnerability check |
| `docs/deployment/SECURITY.md` | New | Security configuration guide (HTTPS, CORS, rate limits) |

### NixOS

| File | Type | Description |
|------|------|-------------|
| `nixos/default.nix` | Modify | Add `corsOrigins`, `forceHttps` options |
| Nginx config docs | New section | Recommended nginx security headers |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/plugins/rate-limit.spec.ts` | New | Verify 429 after threshold, different limits per route group |
| `backend/tests/plugins/cors.spec.ts` | New | Allowed origin passes, blocked origin rejected |
| `backend/tests/security/error-responses.spec.ts` | New | No stack traces in production mode |
| `backend/tests/security/input-validation.spec.ts` | New | All mutating endpoints reject invalid input |
| `backend/tests/routes/ws-auth.spec.ts` | New | WebSocket rejects without token, accepts with valid token |

---

## Security Checklist

### Rate Limiting

| Route Group | Limit | Window | Purpose |
|------------|-------|--------|---------|
| POST /auth/login | 10 | 1 minute | Brute force protection |
| POST /auth/register | 5 | 1 minute | Registration abuse |
| POST /api/vms/*/agent | 20 | 1 minute | AI API cost protection |
| All other routes | 100 | 1 minute | General DDoS mitigation |

### CORS

```typescript
{
  origin: config.corsOrigins || ['http://localhost:9010'],  // Dev default
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}
```

- Production: set `CORS_ORIGINS` to actual domain
- NixOS module: `corsOrigins = [ "https://microvm.local" ]`

### Security Headers (via @fastify/helmet)

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` | XSS prevention |
| X-Frame-Options | DENY | Clickjacking prevention |
| X-Content-Type-Options | nosniff | MIME sniffing prevention |
| Strict-Transport-Security | max-age=31536000; includeSubDomains | HTTPS enforcement |
| Referrer-Policy | no-referrer | Privacy |

Note: CSP needs to allow `'unsafe-inline'` for styles (Quasar uses inline styles) and possibly adjust for xterm.js and v-network-graph.

### WebSocket Authentication

```
// Option 1: Token in query string (simpler)
ws://host/ws/status?token=<jwt>

// Option 2: First message authentication
ws://host/ws/status → { type: 'auth', token: '<jwt>' }
```

Recommendation: Query string (Option 1) — simpler, works with browser WebSocket API directly. Token is in server logs but WebSocket connections are typically over WSS (encrypted).

### Input Validation Audit

Walk every route handler and verify:
1. Request body validated by Zod schema
2. URL parameters validated (especially `:name` — alphanumeric + hyphens only)
3. Query parameters validated
4. No raw user input interpolated into shell commands (already using `execFileAsync`)
5. No raw user input interpolated into SQL/JSON queries without escaping

### Error Response Sanitization

```typescript
// Production mode: strip internal details
if (process.env.NODE_ENV === 'production') {
  fastify.setErrorHandler((error, request, reply) => {
    reply.status(error.statusCode || 500).send({
      error: error.message || 'Internal Server Error',
      statusCode: error.statusCode || 500,
    })
    // Log full error internally
    fastify.log.error(error)
  })
}
```

No stack traces, no file paths, no internal state in error responses.

---

## Dependencies to Add

| Package | Version | Purpose |
|---------|---------|---------|
| @fastify/rate-limit | ^10.x | Rate limiting |
| @fastify/cors | ^10.x | CORS headers |
| @fastify/helmet | ^12.x | Security headers |

---

## Acceptance Criteria

1. Rapid requests to auth endpoints return 429 after 10 attempts
2. Rapid requests to general endpoints return 429 after 100 attempts
3. Cross-origin requests from non-whitelisted domains are rejected
4. All security headers present in HTTP responses
5. WebSocket connections without valid token are rejected
6. Error responses in production mode contain no stack traces
7. All user inputs validated by Zod schemas (no unvalidated routes)
8. `npm audit` reports no high or critical vulnerabilities
9. Documentation covers HTTPS setup and security configuration
10. All existing tests pass
11. `npm run test:precommit` passes

---

## Estimated Effort

Rate limiting + CORS + Helmet: 1 day
WebSocket auth: 0.5 days
Input validation audit: 0.5 days
Error sanitization: 0.5 days
Tests: 1 day
Documentation: 0.5 days
Total: **4 days**

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add Security section: rate limiting config, CORS, CSP, error sanitization |
| `docs/development/LESSONS-LEARNED.md` | Capture Fastify security plugin patterns, rate limit tuning |

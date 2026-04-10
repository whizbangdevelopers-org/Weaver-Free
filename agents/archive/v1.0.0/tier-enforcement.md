<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-H-1-tier-enforcement — Tier Enforcement Wiring

**Priority:** High #1
**Tier:** All
**Parallelizable:** Yes (independent)
**Plan:** [EXECUTION-ROADMAP Phase 6 — Tier Gating Infrastructure + Rate Limiting](../../../plans/v1.0.0/EXECUTION-ROADMAP.md)

---

## Scope

Wire three existing features to the tier system. The tier infrastructure (`license.ts`, `requireTier()`, `useTierFeature.ts`) is already complete — this agent connects the remaining ungated features.

### What's Already Done

- `license.ts` — HMAC license key validation, tier extraction, expiry
- `requireTier()` — Fastify route-level tier enforcement
- `useTierFeature.ts` — Frontend tier-gated component wrapper
- `UpgradeNag.vue` — Upgrade prompt component
- `config.ts` — Tier resolution order (LICENSE_KEY → LICENSE_KEY_FILE → PREMIUM_ENABLED → demo)
- Per-route rate limiting via `@fastify/rate-limit` (static values per route)
- Push notification channels already tier-gated (`requireTier(config, 'premium')`)
- Network management already tier-gated

### What's Missing

1. **AI agent tier-gradient rate limits** — Agent route hardcoded at `10 req/min` for all users. Tier matrix: free=5, premium=10, enterprise=30 (configurable).
2. **Server-provided AI key gating** — Free users can use the server-side `ANTHROPIC_API_KEY`. Should be premium+ only; free users must BYOK.
3. **Bulk VM operations tier gate** — `BulkActionBar.vue` works for all tiers. Should be enterprise-only.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/license.ts` | `requireTier()` helper and `TIER_ORDER` |
| `backend/src/routes/agent.ts` | Agent route — currently `{ max: 10, timeWindow: '1 minute' }` |
| `backend/src/config.ts` | `config.tier` and `config.anthropicApiKey` |
| `backend/src/index.ts` | Global rate limit plugin registration |
| `src/components/BulkActionBar.vue` | Bulk actions — no tier gate currently |
| `src/composables/useTierFeature.ts` | Frontend tier-gating pattern |
| `src/stores/app.ts` | `tier`, `isPremium`, `isEnterprise` getters |

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/routes/agent.ts` | Modify | Dynamic rate limit based on `config.tier`: free=5, premium=10, enterprise=30 |
| `backend/src/routes/agent.ts` | Modify | If no `apiKey` in request body and `config.tier` < premium, return 403 |
| `backend/src/config.ts` | Modify | Add `aiRateLimitPerMin` field derived from tier (or configurable for enterprise) |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/components/BulkActionBar.vue` | Modify | Wrap with `useTierFeature('enterprise')` or `v-if="appStore.isEnterprise"` |
| `src/components/AgentDialog.vue` | Modify | Show BYOK field prominently for free tier; hide server-key option |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/routes/agent-tier.spec.ts` | New | Free blocked from server key, rate limits vary by tier |
| `testing/e2e/tier-gating.spec.ts` | New | Bulk actions hidden on non-enterprise, agent BYOK prompt on free |

---

## Implementation Details

### Dynamic Rate Limit (agent.ts)

```typescript
const AI_RATE_LIMITS: Record<Tier, number> = {
  demo: 5, free: 5, premium: 10, enterprise: 30
}

// In route config:
config: {
  rateLimit: {
    max: AI_RATE_LIMITS[config.tier],
    timeWindow: '1 minute'
  }
}
```

### Server Key Gating (agent.ts)

```typescript
// If no BYOK key provided, check tier for server key access
if (!apiKey && config.anthropicApiKey) {
  requireTier(config, 'premium') // throws 403 for free/demo
}
```

---

## Acceptance Criteria

1. Free-tier AI agent capped at 5 req/min (not 10)
2. Free-tier users without BYOK get 403 when server has `ANTHROPIC_API_KEY`
3. Free-tier users WITH BYOK can use agent (up to 5 req/min)
4. Premium users get 10 req/min, enterprise 30 req/min
5. Bulk action bar hidden for non-enterprise tiers
6. All existing tests pass
7. `npm run test:precommit` passes

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Backend (rate limits + key gating) | 30 min |
| Frontend (bulk gate + agent dialog) | 20 min |
| Tests | 20 min |
| **Total** | **~1 hour** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add tier-gradient rate limit table, server key gating behavior |
| `src/pages/HelpPage.vue` | Update AI agent FAQ: free=BYOK only, premium=server key |

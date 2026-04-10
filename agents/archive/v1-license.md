<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-license — License Key System

**Plan:** [V1-PRODUCTION-PLAN](../plans/V1-PRODUCTION-PLAN.md) (Track 2)
**Parallelizable:** Yes (independent of auth/rbac/audit)
**Blocks:** None (v1-release depends on all tracks)

---

## Scope

Replace the `PREMIUM_ENABLED` boolean with a 4-tier license key system (demo/free/premium/enterprise). Keys are self-validating (offline-first, HMAC checksum), encode tier and expiry. Free tier requires a license key obtained via registration, enabling adoption tracking without telemetry. No key = demo mode (limited eval). The frontend shows tier information and gates features accordingly.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `../business/product/TIER-MANAGEMENT.md` | Full license key design document (project level) |
| `../business/archive/TIER-STRATEGY.md` | Feature tier assignments (project level) |
| `backend/src/config.ts` | Current `premiumEnabled` boolean |
| `backend/src/routes/health.ts` | Health endpoint to extend with tier info |
| `backend/src/routes/network-mgmt.ts` | Example of premium gate pattern |
| `src/stores/app.ts` | Current `premiumEnabled` in frontend |
| `src/pages/SettingsPage.vue` | Settings page to add license section |
| `nixos/default.nix` | NixOS module to add license options |

---

## Inputs

- `TIER-MANAGEMENT.md` contains the complete design (key format, validation, storage, NixOS changes)
- Current codebase uses `config.premiumEnabled` boolean in ~10 route files
- Frontend reads premium status from `GET /api/health`

---

## Outputs

### Backend

| File | Type | Description |
|------|------|-------------|
| `backend/src/license.ts` | New | Key parsing, HMAC validation, tier extraction, expiry check |
| `backend/src/config.ts` | Modify | Replace `premiumEnabled: boolean` with `tier: Tier`, add `licenseExpiry`, backwards compat |
| `backend/src/routes/health.ts` | Modify | Add `tier`, `tierExpiry` to response |
| All premium-gated routes | Modify | Replace `if (!config.premiumEnabled)` with `requireTier(config, 'premium')` |
| `nixos/default.nix` | Modify | Add `licenseKey`, `licenseKeyFile`, deprecate `premiumEnabled` |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/stores/app.ts` | Modify | Replace `premiumEnabled: boolean` with `tier`, add `isPremium`/`isEnterprise` getters |
| `src/pages/SettingsPage.vue` | Modify | Add License section: key input, tier badge, expiry display |
| All `premiumEnabled` checks | Modify | Replace with `isPremium` or tier check |

### Internal Tooling

| File | Type | Description |
|------|------|-------------|
| `scripts/generate-license.sh` | New | CLI: `--tier premium --expires 2027-02-01 --secret $HMAC_SECRET` → key |

### Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/license.spec.ts` | New | Parse valid/invalid keys, checksum validation, tier extraction, expiry |
| `backend/tests/config-tier.spec.ts` | New | Tier from key, tier from PREMIUM_ENABLED, default free |
| Update all premium route tests | Modify | Use tier-based config instead of boolean |
| `testing/e2e/license.spec.ts` | New | Enter key in settings, verify premium unlocks |

---

## Key Format

```
CL-<tier>-<payload>-<checksum>

WVR-FRE-Z1A2B3C4D5E6-W7X8    # Free (from registration)
WVR-PRE-A1B2C3D4E5F6-X7Y8    # Premium
WVR-ENT-G9H0I1J2K3L4-M5N6    # Enterprise
```

- **Prefix:** `CL-` (Weaver)
- **Tier:** `FRE` (free) or `PRE` (premium) or `ENT` (enterprise)
- **Payload:** 12 chars (base36), encodes: issue date (4), expiry (4), customer ID (4)
- **Checksum:** 4-char HMAC-SHA256 suffix (truncated)
- **No key:** Demo mode (limited eval, no license required)

### Validation Flow

```
1. Regex format check: /^CL-(FRE|PRE|ENT)-[A-Z0-9]{12}-[A-Z0-9]{4}$/
2. Extract tier from position [4:7]
3. Compute HMAC-SHA256(secret, "CL-{tier}-{payload}"), take first 4 chars
4. Compare computed checksum with provided checksum
5. Decode expiry from payload bytes [4:8]
6. Compare expiry against current date
```

---

## Config Changes

```typescript
// Before
interface DashboardConfig {
  premiumEnabled: boolean
}

// After
type Tier = 'demo' | 'free' | 'premium' | 'enterprise'

interface DashboardConfig {
  tier: Tier
  licenseExpiry: Date | null  // null = perpetual (free/premium) or demo
}
```

### Resolution Order

```
1. LICENSE_KEY env var → parse → tier + expiry
2. LICENSE_KEY_FILE env var → read file → parse → tier + expiry
3. PREMIUM_ENABLED=true → tier='premium', expiry=null (backwards compat, log deprecation warning)
4. Default → tier='demo' (no key = demo mode, limited eval)
```

---

## Route Guard Helper

```typescript
const TIER_ORDER = { demo: 0, free: 1, premium: 2, enterprise: 3 }

function requireTier(config: DashboardConfig, minimum: Tier): void {
  if (TIER_ORDER[config.tier] < TIER_ORDER[minimum]) {
    throw { statusCode: 403, message: `Requires ${minimum} tier` }
  }
}
```

**Usage in routes:**
```typescript
// Replace: if (!config.premiumEnabled) return reply.status(403)...
// With: requireTier(config, 'premium')
```

---

## Health Response Change

```json
{
  "status": "healthy",
  "tier": "premium",
  "tierExpiry": "2027-02-01T00:00:00Z",
  "service": "weaver",
  "version": "1.0.0"
}
```

---

## Frontend Store Change

```typescript
// Before
premiumEnabled: boolean

// After
tier: 'demo' | 'free' | 'premium' | 'enterprise'
tierExpiry: string | null

get isDemo(): boolean { return this.tier === 'demo' }
get isFree(): boolean { return this.tier === 'free' }
get isPremium(): boolean { return this.tier === 'premium' || this.tier === 'enterprise' }
get isEnterprise(): boolean { return this.tier === 'enterprise' }
get isLicensed(): boolean { return this.tier !== 'demo' }
```

---

## NixOS Module Change

```nix
# New options
licenseKey = mkOption {
  type = types.nullOr types.str;
  default = null;
  description = "License key for premium/enterprise features.";
};

licenseKeyFile = mkOption {
  type = types.nullOr types.path;
  default = null;
  description = "Path to file containing license key. Compatible with sops-nix/agenix.";
};

# Deprecated (log warning if used)
premiumEnabled = mkOption {
  type = types.bool;
  default = false;
  description = "Deprecated: use licenseKey instead.";
};
```

---

## Acceptance Criteria

1. No key → demo mode (limited eval, upgrade prompt in UI)
2. Free license key (`WVR-FRE-...`) → full free tier features
3. Premium license key (`WVR-PRE-...`) → premium features unlocked
4. Enterprise license key (`WVR-ENT-...`) → all features unlocked
5. Invalid key format rejected with clear error message
6. Tampered key (wrong checksum) rejected
7. Expired key results in demo tier (with expiry warning in UI)
8. `PREMIUM_ENABLED=true` still works, logs deprecation warning, maps to premium
9. `GET /api/health` returns tier and expiry info
10. Settings page shows license section with tier badge and upgrade prompts
11. Key can be entered in Settings UI and takes effect immediately
12. `generate-license.sh` creates valid keys for all tiers (free, premium, enterprise)
13. All existing premium route tests updated and passing
14. `npm run test:precommit` passes

---

## Estimated Effort

Backend (license module + config + routes): 2 days
Frontend (store + settings UI): 1 day
NixOS module: 0.5 days
Key generator script: 0.5 days
Tests: 1 day
Total: **5 days**

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add License Tiers section: 4-tier model, config resolution, requireTier(), health endpoint |
| `src/pages/HelpPage.vue` | Add "License & Tiers" help section: what tiers exist, where to see tier |
| `docs/development/LESSONS-LEARNED.md` | Capture HMAC key validation, backwards-compat PREMIUM_ENABLED pattern |

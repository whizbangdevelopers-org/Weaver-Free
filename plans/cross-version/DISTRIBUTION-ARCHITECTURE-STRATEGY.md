<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Distribution Architecture Strategy: Per-Tier Repos, Code Separation, Sealed Binaries

**Last updated:** 2026-04-10

## Problem Statement

Dev repo is the single source of truth containing all tier code (demo/free/weaver/fabrick). The current `sync-to-free.yml` workflow strips **dev tooling** (testing, CLAUDE.md, git hooks) but ships **all feature code** — including Weaver-only backend routes, UI components, and future FabricK features — to the public Free repo.

**Goal:** The Free repo should contain only free-tier functionality. Where Weaver/FabricK features exist in the UI, users should see an upgrade prompt ("nag") instead of the feature. Weaver Solo/Team and FabricK source code should not be publicly visible. **All BSL-licensed tiers ship as sealed binaries — no source code in any paid distribution.**

**Extended goal:** The separation architecture must scale to serve four distinct customer segments — not just "free vs paid" — because the revenue opportunity spans homelab to datacenter.

## Current State

### What the sync already excludes (file-level)
- Dev tooling: `testing/`, `.claude/`, `CLAUDE.md`, `.githooks/`, `.mcp.json`
- Build config: `flake.nix`, `flake.lock`, `vitest.config.ts`, `playwright.config.ts`
- Internal docs: `docs/planning/`
- Sync infrastructure: `sync-to-free.yml`, `sync-exclude.yml`

### What the sync does NOT handle (the gap)
- **Backend routes** with `requireTier('weaver')`: `vms.ts` (provisioning), `network-mgmt.ts`, `notification-config.ts`
- **Frontend components** gated by `appStore.isWeaver`: `NotificationSettings.vue`, `NetworkMapPage.vue` Weaver sections
- **Backend services** that are Weaver-only: agent with real LLM providers, notification adapters
- **License system** itself (ships in full — generates Weaver/FabricK keys)

### Existing tier enforcement (runtime)
- Backend: `requireTier(config, 'weaver')` → 403 on Weaver-gated routes
- Frontend: `appStore.isWeaver` conditionals hide UI sections
- Health endpoint: broadcasts tier to frontend on connect

**Key insight:** Runtime enforcement already works — a free-tier user can't *use* Weaver features even in Dev. But the *source code* is visible in the public Free repo.

---

## Multi-Segment Revenue Impact

Building this separation correctly at v1.0 is a **one-time architecture decision** that either enables or constrains every future tier. The customer segments map to tiers as follows:

### Customer → Tier → Revenue Mapping

| Segment | Tier | Key Features They Buy | Est. WTP | Volume |
|---------|------|----------------------|----------|--------|
| **Self-hosters** | Free | VM dashboard, Apptainer read-only, mock AI | $0 | 5k-15k users (evangelists) |
| **HPC / Research Labs** | Weaver | Apptainer full mgmt, GPU passthrough, AI BYOK, resource metrics | $50-200/mo | 500-2k labs |
| **Power Users / Prosumers** | Weaver | All runtimes, push notifications, Windows/macOS guests, serial console | $20-50/mo | 2k-5k users |
| **Small Teams / Startups** | Fabrick | Multi-node, RBAC, audit log, SSO | $200-500/mo | 500-2k teams |
| **Datacenter / Large Org** | Fabrick | HA, Redis sessions, gRPC, topology, unlimited nodes, SLA | $500-2k/mo | 50-200 orgs |

### Why This Changes the Architecture

A binary "free vs paid" separation would force re-architecture at FabricK launch. The separation needs **three tiers of exclusion**:

```
Free (public, AGPL)              = core + free features (source-available)
Weaver Solo/Team (private, BSL)  = core + free + Weaver features (sealed binary)
FabricK (private, BSL)           = core + free + Weaver + FabricK features (sealed binary)
```

This maps directly to the existing tier ladder (Decision #3) and the container strategy (Decision #7):

| Feature | Free | Weaver Solo/Team | FabricK |
|---------|:----:|:-------:|:----------:|
| VM dashboard (read-only ops) | X | X | X |
| Apptainer visibility | X | X | X |
| VM provisioning | | X | X |
| All container runtimes (Docker, Podman) | | X | X |
| Full container management + GPU | | X | X |
| Push notifications (ntfy.sh) | | X | X |
| Windows/macOS guests | | X | X |
| AI diagnostics (BYOK) | | X | X |
| Multi-node hub | | | X |
| RBAC + audit logging | | | X |
| SSO/LDAP/OIDC | | | X |
| gRPC protocol | | | X |
| Redis sessions + HA | | | X |
| All notification adapters | | | X |

### The HPC Opportunity Specifically

Decision #7 (Apptainer-first) already identified HPC/research as a zero-competition market. The separation architecture makes this concrete:

- **Free tier gives HPC users Apptainer read-only** — this is the hook. No other dashboard does this. Research labs discover the product, install it, see value immediately.
- **Weaver Solo/Team unlocks full Apptainer management + GPU passthrough** — the moment a lab wants to manage containers (not just observe them), they upgrade. This is the conversion event.
- **FabricK adds multi-node** — HPC clusters with 10-100 nodes need central management. This is the expansion event.

The nag component at free tier says "Manage your Apptainer containers — upgrade to Weaver" exactly where they'd look for management features. This is not a theoretical conversion path; it's the natural workflow interruption.

### The Datacenter Opportunity Specifically

Datacenter customers follow a different path but the same tier ladder:

- They likely skip free entirely (or evaluate briefly)
- **Weaver Solo/Team** gives them Docker/Podman management for a single node (POC/evaluation)
- **FabricK** gives them the fleet they need: multi-node, RBAC, audit, HA

The architecture decision here is: FabricK features must be separable from Weaver features. If FabricK code lives mixed into `weaver/` directories, a future "Weaver-only distribution" becomes impossible.

### Architectural Requirement

The separation must use **tier-named directories** (`weaver/`, `fabrick/`), not a single `paid/` bucket. This creates three clean distribution targets:

| Distribution | Includes | Excludes | Format |
|-------------|----------|----------|--------|
| Free repo (sync-to-free) | `core`, `free`, `nag` | `weaver/`, `fabrick/`, dev tooling | Source (AGPL) |
| Weaver Solo/Team repo | `core`, `free`, `weaver`, `nag` | `fabrick/`, dev tooling | **Sealed binary (BSL)** |
| FabricK repo | Everything | dev tooling only | **Sealed binary (BSL)** |

The Weaver Solo/Team repo is not yet provisioned — Solo doesn't start until v1.4. FabricK repo likewise not yet provisioned.

### Sealed Binary Distribution (BSL Tiers)

All BSL-licensed tiers (Solo, Team, FabricK) ship as **sealed binaries** — no source code in any paid distribution. The sync workflow for paid tiers includes a build step that produces sealed artifacts:

1. **V8 bytecode compilation (backend)** — `bytenode` or `pkg` compiles backend `.ts`/`.js` to `.jsc` bytecode blobs. Source files never appear in the paid distribution.
2. **JavaScript obfuscation (frontend)** — `javascript-obfuscator` in the Quasar build. Control flow flattening, string encryption, dead code injection.
3. **Sealed Nix closure** — package as a compiled, signed Nix derivation. The flake outputs a binary closure — users install it like any NixOS service but never see source.
4. **Artifact signing** — cosign for Docker images, Nix signing for packages. Prevents modified builds claiming to be official.

This means:
- **Free users** can read, audit, and build from source (AGPL requires this).
- **Paid users** get a working product as a sealed binary. BSL-1.1 license terms apply — not redistributable.
- **No source leakage** from paid repos. Runtime tier gating (`requireTier()`) is defense-in-depth, not the primary protection.

---

## Solution A: Tier-Named Directory Separation (Recommended)

**Approach:** Reorganize tier-exclusive code into clearly delimited directories named by tier, then exclude those directories during sync. Replace excluded UI with nag-stub components. Each tier directory contains only features exclusive to that tier and above. BSL-licensed tier syncs include a sealed binary build step.

### Structure

```
backend/src/
  routes/
    vms.ts              ← free (read-only VM ops stay)
    health.ts           ← free
    auth.ts             ← free (basic auth is free-tier)
    ws.ts               ← free
    console.ts          ← free
    distros.ts          ← free
    weaver/             ← excluded from free sync
      vm-provisioning.ts      (VM create/delete)
      network-mgmt.ts         (network management)
      notification-config.ts  (push channel config)
      web-push.ts             (push delivery)
      container-mgmt.ts       (v1.2: full container actions)
    fabrick/            ← excluded from free sync AND Weaver sync
      multi-node.ts           (v2: hub + agent registration)
      rbac-admin.ts           (RBAC management endpoints)
      audit-export.ts         (audit log export/query)
      grpc-bridge.ts          (v2: gRPC protocol adapter)
  services/
    microvm.ts          ← free (read-only)
    weaver/             ← excluded from free sync
      microvm-provision.ts
      notification-adapters/
      container-runtime/      (v1.1-1.2: Docker/Podman full mgmt)
    fabrick/            ← excluded from free + Weaver sync
      session-redis.ts
      ha-coordinator.ts
      node-registry.ts

src/
  components/
    weaver/             ← excluded from free sync
      NotificationSettings.vue
      NetworkMgmtPanel.vue
      ContainerActions.vue    (v1.2)
      GpuPassthrough.vue      (v1.2)
    fabrick/            ← excluded from free + Weaver sync
      MultiNodePanel.vue
      RbacAdmin.vue
      AuditViewer.vue
    nag/                ← synced everywhere (free, weaver, fabrick)
      UpgradeNag.vue    ← generic upgrade prompt, tier-aware
  pages/
    weaver/             ← excluded from free sync
    fabrick/            ← excluded from free + Weaver sync
```

### Sync workflow change

`sync-exclude.yml` (already updated):
```yaml
# Tier-gated feature code (excluded from free public repo)
- backend/src/routes/weaver/
- backend/src/routes/fabrick/
- backend/src/services/weaver/
- backend/src/services/fabrick/
- src/components/weaver/
- src/components/fabrick/
- src/pages/weaver/
- src/pages/fabrick/
- tui/src/components/weaver/
- tui/src/components/fabrick/
# License tooling (prevents key generation from public source)
- scripts/generate-license.ts
```

### Weaver Solo/Team sync workflow (v1.4.0 — not yet provisioned)

A second sync workflow (`sync-to-weaver.yml`) mirrors the free sync but:
1. Excludes only `fabrick/` directories (Weaver code is included)
2. Includes a **sealed binary build step**: bytenode backend compilation + frontend obfuscation + Nix binary closure
3. Pushes sealed artifacts, not source, to the private Weaver repo
4. Signs artifacts with cosign (Docker) and Nix signing (packages)

### FabricK sync workflow (future — not yet provisioned)

A third sync workflow (`sync-to-fabrick.yml`):
1. Includes everything except dev tooling
2. Same sealed binary build step as Weaver
3. Pushes to private FabricK repo

### Nag component (tier-aware)

A generic `UpgradeNag.vue` in `src/components/nag/` (synced to all editions). It's **tier-aware** — shows different messaging depending on what the user needs to unlock:

```vue
<template>
  <q-card flat bordered class="upgrade-nag">
    <q-card-section class="text-center q-pa-lg">
      <q-icon :name="tierIcon" size="48px" :color="tierColor" />
      <div class="text-h6 q-mt-md">{{ title }}</div>
      <div class="text-body2 text-grey-7 q-mt-sm">{{ description }}</div>
      <div v-if="features.length" class="q-mt-md text-left">
        <div v-for="f in features" :key="f" class="text-body2">
          <q-icon name="mdi-check" color="positive" size="xs" class="q-mr-xs" />{{ f }}
        </div>
      </div>
      <q-btn
        :color="tierColor"
        :label="ctaLabel"
        class="q-mt-lg"
        :href="pricingUrl"
        target="_blank"
      />
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
// Props: tier ('weaver' | 'fabrick'), title, description, features[], pricingUrl
// Computes tierIcon, tierColor, ctaLabel from tier prop
</script>
```

This means a free user seeing a Weaver nag gets "Upgrade to Weaver" with a star icon, while a Weaver user seeing a FabricK nag (e.g., multi-node panel) gets "Upgrade to FabricK" with a domain icon. The **same component** serves every tier boundary in every edition.

### How tier-gated features render in lower editions

Parent components use a `useTierFeature` composable that handles both runtime check and dynamic import fallback:

```typescript
// src/composables/useTierFeature.ts — synced to all editions
import type { Component } from 'vue'
import { defineAsyncComponent } from 'vue'
import { useAppStore } from 'stores/app'
import UpgradeNag from 'components/nag/UpgradeNag.vue'

interface TierFeatureOpts {
  tier: 'weaver' | 'fabrick'
  loader: () => Promise<{ default: Component }>
  nagTitle: string
  nagDescription: string
  nagFeatures?: string[]
}

export function useTierFeature(opts: TierFeatureOpts) {
  const appStore = useAppStore()

  // Two layers of gating:
  // 1. Runtime: appStore.isWeaver / isFabrick (works in Dev with wrong license)
  // 2. Import: weaver/ dir doesn't exist in free repo (catches at build/import time)
  const component = defineAsyncComponent({
    loader: () => opts.loader().catch(() => {
      // Directory doesn't exist in this edition — return nag with bound props
      return { default: UpgradeNag }
    }),
  })

  return { component }
}
```

**Usage in SettingsPage.vue:**
```vue
<script setup>
const { component: NotificationSettings } = useTierFeature({
  tier: 'weaver',
  loader: () => import('components/weaver/NotificationSettings.vue'),
  nagTitle: 'Push Notifications',
  nagDescription: 'Configure notification channels to get alerts on your phone',
  nagFeatures: ['ntfy.sh integration', 'Custom alert rules', 'Per-VM notification settings'],
})
</script>
<template>
  <component :is="NotificationSettings" />
</template>
```

**In free repo:** The import fails (directory doesn't exist), `UpgradeNag` renders with the contextual props.
**In dev/Weaver:** The import succeeds, real component renders.
**Runtime double-check:** Even if someone manually copies Weaver files into free, `requireTier()` on the backend still returns 403.

### Backend route registration

```typescript
// backend/src/app.ts — tier-aware dynamic route loading
const TIER_ROUTE_DIRS = ['weaver', 'fabrick'] as const

for (const tier of TIER_ROUTE_DIRS) {
  try {
    const tierRoutes = await import(`./routes/${tier}/index.js`)
    tierRoutes.register(app, config)
    app.log.info(`Loaded ${tier} routes`)
  } catch {
    // Tier routes not present in this edition — expected in free/weaver builds
    app.log.info(`${tier} routes not available in this edition`)
  }
}
```

This means:
- **Free edition:** Neither `weaver/` nor `fabrick/` exist → both catch blocks fire → backend runs with free routes only
- **Weaver Solo/Team edition:** `weaver/` loads, `fabrick/` doesn't exist → Weaver features active
- **Dev/FabricK:** Both load → all features active

### Pros
- Clean physical boundary — Weaver code is never in free repo, FabricK code is never in Weaver repo
- Easy to audit: `ls weaver/` and `ls fabrick/` show exactly what's gated per tier
- Sync exclusion is simple directory rules (no script transforms) — same pattern already used
- `UpgradeNag.vue` is reusable across all tier boundaries with contextual messaging
- Aligns with existing `requireTier()` runtime enforcement (defense in depth)
- **Scales to three distribution targets** (free/weaver/fabrick) without restructure
- **HPC conversion path is built-in**: Apptainer read-only is free, full management is in `weaver/`
- **Datacenter path is built-in**: multi-node/HA/RBAC admin is in `fabrick/`
- **Sealed binary for BSL tiers**: paid distributions ship compiled artifacts, not source

### Cons
- Requires one-time code reorganization (moving files into tier dirs)
- Cross-cutting features (e.g., `vms.ts` has both read-only and provisioning) need refactoring to split
- Dynamic imports add slight complexity to component loading
- Two new directory naming conventions to document and enforce

### Effort: Medium (1-2 days for reorganization + nag component + testing)

---

## Solution B: Build-Time Feature Flags (Vite Define + Dead Code Elimination)

**Approach:** Use Vite's `define` to inject `__WEAVER__` and `__FREE__` compile-time constants. Weaver code blocks get tree-shaken from the free build. The sync workflow builds the free edition before publishing.

### Implementation

**`vite` config (or `quasar.config.ts`):**
```typescript
define: {
  __WEAVER__: JSON.stringify(process.env.TIER !== 'free'),
  __FREE__: JSON.stringify(process.env.TIER === 'free'),
}
```

**In source code:**
```typescript
if (__WEAVER__) {
  // This entire block is removed by tree-shaking in free builds
  app.register(notificationConfigRoutes)
}
```

**In Vue templates:**
```vue
<template>
  <NotificationSettings v-if="__WEAVER__" />
  <UpgradeNag v-else tier="weaver" title="Push Notifications" description="Configure notification channels with Weaver" />
</template>
```

### Sync workflow change

Instead of syncing source, the workflow would:
1. Build with `TIER=free`
2. Sync the **built output** (not source) to free repo

**OR** keep source sync but use a preprocessing step:
1. rsync source to staging area
2. Run a transform script that replaces `if (__PREMIUM__)` blocks
3. Commit transformed source to free repo

### Pros
- No directory reorganization needed — features stay where they are
- Vite's tree-shaking is proven and handles deep dead-code elimination
- Single source of truth with zero code duplication
- Works for both UI and backend

### Cons
- **Source code still ships to free repo** (unless you sync built output only, which loses the "source available" aspect of the free repo)
- Preprocessor approach is fragile — regex-based transforms on TypeScript/Vue are error-prone
- `__WEAVER__` guards scattered across codebase are harder to audit than directory boundaries
- Developers must remember to wrap new Weaver code in flags
- If syncing built output: free repo becomes a dist repo, not a source repo (users can't contribute or build from source)

### Effort: Low initial, high maintenance risk

---

## Solution C: Hybrid Runtime Enforcement + Source Stripping

**Approach:** Keep existing runtime tier checks as primary enforcement. Add a sync-time script that replaces Weaver component implementations with nag stubs, leaving the file structure identical between dev and free.

### Implementation

Mark Weaver-only files with a header comment:
```typescript
// @tier weaver
```

Sync workflow adds a transform step after rsync:
```bash
# Find files with @tier weaver marker
find target/ -type f \( -name '*.vue' -o -name '*.ts' \) | while read file; do
  if head -5 "$file" | grep -q '@tier weaver'; then
    generate_nag_stub "$file"
  fi
done
```

The `generate_nag_stub` function replaces the file contents with a nag component (for `.vue`) or a 403 stub (for backend `.ts` routes).

### Stub templates

**Vue component stub:**
```vue
<!-- This feature requires Weaver -->
<template>
  <UpgradeNag tier="weaver" title="[Feature Name]" description="Upgrade to unlock this feature" />
</template>
<script setup lang="ts">
import UpgradeNag from 'components/nag/UpgradeNag.vue'
</script>
```

**Backend route stub:**
```typescript
// @tier weaver — stubbed for free edition
import type { FastifyInstance } from 'fastify'
export default async function (app: FastifyInstance) {
  // Weaver feature — not available in free edition
}
```

### Pros
- Zero reorganization — files stay in existing locations
- File paths remain identical (imports don't break)
- Nag appears seamlessly where Weaver component was
- Simple to implement — just a bash script in the workflow

### Cons
- Fragile: relies on comment markers that developers might forget
- Stub generation is a custom script that needs maintenance
- Harder to verify correctness (what if a stub is malformed?)
- `git diff` between dev and free is noisy (every Weaver file differs completely)
- Testing the free edition requires running the transform locally

### Effort: Low initial, medium maintenance

---

## Solution D: Monorepo Workspace Packages

**Approach:** Extract Weaver features into separate npm workspace packages. Free repo simply doesn't include those packages.

### Structure

```
packages/
  core/           ← shared types, utilities (both editions)
  free/           ← free-tier features
  weaver/         ← Weaver features (excluded from free sync)
  fabrick/        ← FabricK features (excluded from free + Weaver sync)
  nag/            ← upgrade nag components (all editions)
backend/
  packages/
    core/         ← shared backend (auth, health, base VM routes)
    weaver/       ← Weaver routes + services (excluded from free sync)
    fabrick/      ← FabricK routes + services (excluded from free + Weaver sync)
```

### Pros
- Strongest isolation — each tier is a separate package with its own `package.json`
- Dependency graph is explicit
- Could publish Weaver as a private npm package for FabricK customers
- Testable independently

### Cons
- **Massive refactor** — restructuring the entire project into workspaces
- Over-engineered for current scale (solo dev, <15 route files)
- Breaks existing import paths project-wide
- Quasar CLI doesn't natively support workspace consumption well
- Would delay v1.0 significantly

### Effort: High (3-5 days, plus risk of regressions)

---

## Recommendation

### Primary: Solution A (Tier-Named Directory Separation)

**Why this wins for a multi-segment business:**

1. **Physical boundary = auditable boundary.** `ls backend/src/routes/weaver/` and `ls backend/src/routes/fabrick/` show exactly what each tier adds. No markers to forget, no build flags to audit.

2. **Sync is trivial.** Adding directories to `sync-exclude.yml` is the existing pattern — zero workflow changes beyond adding paths.

3. **Three distribution targets, one architecture.** Free repo excludes `weaver/` + `fabrick/`. Weaver Solo/Team repo excludes only `fabrick/`. Dev repo ships everything. All three are the same codebase minus directories.

4. **UpgradeNag is contextual.** A free user hitting a Weaver feature sees "Upgrade to Weaver." A Weaver user hitting a FabricK feature sees "Upgrade to FabricK." Same component, different props.

5. **HPC conversion funnel is structural.** Apptainer read-only lives in free code. Apptainer full management goes in `weaver/container-mgmt.ts`. The upgrade boundary is literally where the directory boundary is. When an HPC researcher clicks "Manage Container" and sees the nag, the conversion path is obvious.

6. **Datacenter expansion funnel is structural.** Multi-node, HA, and RBAC admin go in `fabrick/`. When a team outgrows single-node Weaver, the nag says "Manage your fleet — upgrade to FabricK."

7. **Extends existing patterns.** The project already uses `requireTier()` for runtime enforcement and `sync-exclude.yml` for sync exclusion. This adds a directory convention on top — not a new system.

8. **One-time cost, permanent benefit.** The reorganization is a few hours of moving files. After that, every new feature goes into the right tier directory by convention.

9. **Sealed binary for BSL tiers.** The per-tier sync workflows for Solo/Team and FabricK include bytecode compilation + obfuscation + Nix closure. No source code leaks from paid distributions.

### Fallback enrichment: Borrow from Solution B for mixed-tier files

For cases where a single file has mixed free/weaver logic (e.g., `vms.ts` has both read-only and provisioning routes), use Solution B's build-time flag as a **secondary** mechanism:

```typescript
// In vms.ts — the file stays in the free directory
if (__WEAVER__) {
  app.post('/api/vms', createVmHandler)  // stripped in free build
}
```

This handles the edge cases where splitting into separate files would be awkward, while Solution A handles the clear-cut Weaver-only files. The flags are a secondary mechanism — directory separation is primary.

---

## Implementation Phases

### Phase 1: Foundation (part of Phase 6 v1.0 production work)
1. Create `UpgradeNag.vue` — tier-aware, configurable title/description/features/CTA
2. Create `useTierFeature` composable — dynamic import with nag fallback
3. Create tier directories: `weaver/` and `fabrick/` under `backend/src/routes/`, `backend/src/services/`, `src/components/`, `src/pages/`
4. Create `weaver/index.ts` and `fabrick/index.ts` barrel files for route registration
5. Add tier-aware dynamic route loading in `backend/src/app.ts`
6. Add all tier directories + `scripts/generate-license.ts` to `sync-exclude.yml`
7. Test: backend starts cleanly with empty `weaver/` and `fabrick/` directories

### Phase 2: Move existing Weaver code
1. Extract provisioning routes from `vms.ts` → `weaver/vm-provisioning.ts`
2. Move `network-mgmt.ts` → `weaver/network-mgmt.ts`
3. Move `notification-config.ts` + `web-push.ts` → `weaver/`
4. Move `NotificationSettings.vue` → `components/weaver/NotificationSettings.vue`
5. Move Weaver section of `NetworkMapPage.vue` → `components/weaver/NetworkMgmtPanel.vue`
6. Update all imports; wire `useTierFeature` in parent components
7. Verify: `npm run dev:full` works (all features), simulated free build works (nag displays)

### Phase 3: FabricK directory prep (skeleton for v2+ features)
1. Create placeholder `fabrick/` index files (empty route registration)
2. Move existing RBAC admin endpoints (if any) to `fabrick/`
3. Document convention: what goes in `weaver/` vs `fabrick/` (add to `.claude/rules/`)
4. Verify: backend starts cleanly with empty FabricK directory

### Phase 4: Nag integration + conversion design
1. Design upgrade CTA content per segment:
   - HPC nag: "Full Apptainer Management — upgrade to Weaver"
   - Power user nag: "Push Notifications, Windows Guests — upgrade to Weaver"
   - Team nag: "Multi-Node Fleet Management — upgrade to FabricK"
2. Wire `UpgradeNag` into all tier touchpoints with segment-appropriate copy
3. Add pricing/upgrade URL to nag component (demo site `/pricing` or landing page)
4. Manual sync test: run sync-to-free workflow, verify free repo builds, nags display correctly

### Phase 5: Validation
1. Full E2E test on free edition (via Docker): all free features work, Weaver features show nag, no 500 errors
2. Full E2E test on dev edition: all features work, no regressions
3. Verify `npm run build` succeeds in both editions
4. Verify sync workflow produces clean free repo

### Phase 6: Sealed binary pipeline (v1.4.0 gate — before first Solo release)
1. Provision private Weaver Solo/Team repo on GitHub
2. Create `sync-to-weaver.yml` workflow: sync from dev, exclude `fabrick/`, build sealed binary
3. Integrate bytenode (backend → `.jsc` bytecode), javascript-obfuscator (frontend), Nix binary closure
4. Artifact signing: cosign for Docker images, Nix signing for packages
5. Validate: sealed Weaver repo installs and runs correctly on NixOS without any source files present
6. Repeat for FabricK repo when FabricK tier is ready to ship

---

## Segment-Specific Conversion Flows

### HPC / Research Lab → Weaver

```
Discovery:     HPC admin finds Weaver (NixOS Discourse, r/HPC, paper citation)
Installation:  Free edition, registers for free license key
Hook:          Apptainer container visibility works immediately (read-only)
Trigger:       Clicks "Start Container" or "Manage" → sees UpgradeNag
                "Full Apptainer Management — Create, stop, configure GPU passthrough"
                [Upgrade to Weaver →]
Conversion:    Purchases Weaver key, enters in Settings
Expansion:     Lab grows to 5 nodes → hits single-node limit → Fabrick nag
```

### Datacenter / Small Team → FabricK

```
Discovery:     DevOps engineer finds project (VMware alternative searches, NixCon talk)
Evaluation:    Installs free, evaluates briefly, likely upgrades to Weaver quickly
Hook:          Single-node Docker/Podman management works in Weaver
Trigger:       Adds second node → sees UpgradeNag
                "Manage Your Fleet — Hub + N nodes, RBAC, audit logging, HA"
                [Upgrade to FabricK →]
Conversion:    Purchases FabricK key (or contract for >10 nodes)
Expansion:     Volume licensing, SLA, custom integrations
```

### Self-Hoster → Weaver (Organic)

```
Discovery:     r/homelab, YouTube, blog post
Installation:  Free edition, immediate value
Hook:          VM dashboard is genuinely useful at free tier
Trigger:       Wants push notifications OR Windows guest → sees UpgradeNag
                "Push Notifications — Get alerts on your phone via ntfy.sh"
                [Upgrade to Weaver →]
Conversion:    $20-50/mo or one-time purchase (low friction)
Advocacy:      Blogs about it, recommends to colleagues → Team discovers → FabricK
```

---

## Resolved Decisions (2026-02-15)

1. **Free repo distribution model:** **Source Available (public).** Free-tier source code is public and buildable. Weaver/FabricK source is excluded by directory separation. HPC/research institutions can audit free-tier code before deploying — this is the primary organic adoption path.

2. **Pricing/upgrade page location:** **Demo site `/pricing`.** The nag CTA links to the demo site pricing page — evaluators already go there.

3. **License key generation script:** **Excluded from free repo.** `scripts/generate-license.ts` added to `sync-exclude.yml` in Phase 1 to prevent key forgery from public source.

4. **AI Agent tier split:** **BYOK stays free, server-side key is Weaver.** BYOK costs nothing (user's API key). Gating it behind Weaver adds friction without revenue. Mock-only + BYOK free follows the Grafana model. Server-side key configuration (operator provides key for all users) is Weaver tier.

5. **Notification gating:** **In-app notifications free, push channel configuration Weaver.** `NotificationSettings.vue` moves to `components/weaver/`. Free users see `UpgradeNag` via `useTierFeature()` import fallback. Defense in depth: sync exclusion (source absent) + import fallback (nag renders) + runtime enforcement (`requireTier` 403).

6. **Container runtime tier split:** **Confirmed with multi-node context.**
   - Free: Apptainer read-only visibility (list, inspect) — the HPC hook
   - Weaver Solo/Team: Apptainer full management (create, stop, GPU passthrough) + Docker + Podman full management
   - FabricK: All runtimes + RBAC on containers + cross-node container topology
   - Multi-node implication: node agents are tier-unaware; the hub gates requests based on license tier. Agent code is a separate deployable (no tier directories). Hub routes split into `weaver/container-mgmt.ts` (single-node CRUD) and `fabrick/container-fleet.ts` (cross-node ops, RBAC).

7. **Demo and implementation sequencing:** **Reorganize first, test completely, then demo, test completely.** Dev repo = full product at v1.0 (no separate Weaver artifact until v1.4). Demo site showcases all tiers with mock data — Weaver and FabricK features render with sample data and tier badges. Implementation order:
   1. Solution A directory reorganization + nag components + full test pass
   2. Demo site tier showcase (mock Weaver/FabricK features) + full test pass

8. **BSL tiers ship sealed binaries (2026-04-10).** All BSL-licensed distributions (Solo, Team, FabricK) ship as sealed binaries — V8 bytecode (backend), obfuscated JS (frontend), signed Nix closure. No source code in any paid distribution. Free repo remains source-available under AGPL. Sealed binary pipeline is a v1.4.0 release gate (first Solo release).

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Service Health Probes & Clickable Links — Implementation Plan

**Date:** 2026-02-08 (original), 2026-03-04 (rewritten against current architecture)
**Target:** v1.1.0
**Tier:** Free (core feature — read-only health visibility)
**Status:** PLANNED — rewritten to align with dynamic VM registry, tier model, container support

---

## Problem

The dashboard shows VM status from `systemctl is-active`. A VM can be "running" but its service (nginx, postgres, etc.) could be crashed inside. Users need:

1. **Health probe** — backend checks each VM's service port, reports healthy/unhealthy
2. **Service link** — clickable "Open" button for HTTP-based VMs
3. **Container health** — same probing for container-exposed ports (post-v1.1 container visibility)

All flow through the existing WebSocket broadcast (every 2s), so the UI updates in real time.

---

## Tier Model

| Capability | Tier | Rationale |
|------------|------|-----------|
| Health status display (badge on card/detail) | Free | Read-only visibility, like topology view |
| "Open" button for HTTP services | Free | Zero-cost to serve, makes free tier feel complete |
| Service probe configuration (custom ports/intervals) | Weaver | Mutations follow provisioning gate pattern (Decision #12) |
| Health-based alerting (unhealthy → push notification) | Weaver | Extends existing push notification channels |
| SLA tracking / uptime metrics | Fabrick | Audit-adjacent, enterprise governance |

**Insurance principle (Decision #30):** Free tier shows health status but makes no uptime guarantees. Weaver/Fabrick probe configuration = insurable claims backed by audit trails.

---

## Architecture Overview

```
VM/Container creation (or registration) includes: serviceProbes[]
        │
        ▼
Backend health-probe.ts ── TCP connect or HTTP GET to target:port
        │                   (runs inside listVms() broadcast cycle)
        ▼
VmInfo gains: serviceProbes[] with per-probe health status
        │
        ▼
WebSocket broadcast { type: 'vm-status', data: VmInfo[] }
        │         (unchanged — health data rides existing payload)
        ▼
Frontend VmCard / VmDetailPage shows health indicators + Open button
Demo mode: mock health in demo.ts VmInfo arrays
```

**Key difference from original plan:** Service metadata is part of the dynamic VM registry (attached at creation/registration time via `VmCreateInput`), not hardcoded in `VM_DEFINITIONS`. This works with Live Provisioning — users define probes when creating VMs.

---

## Step 1: Extend Types

### Backend (`backend/src/services/microvm.ts`)

```typescript
export interface VmServiceProbe {
  port: number
  type: 'http' | 'tcp'
  url?: string        // HTTP only — the URL to open in browser
  label?: string      // display name, e.g. "Nginx", "PostgreSQL"
  health: 'healthy' | 'unhealthy' | 'unknown'
}

// Add to existing VmInfo:
export interface VmInfo {
  // ... existing fields (name, status, ip, mem, vcpu, hypervisor, etc.)
  serviceProbes?: VmServiceProbe[]    // <-- new: multiple probes per VM
}
```

### Frontend (`src/types/vm.ts`)

```typescript
export interface VmServiceProbe {
  port: number
  type: 'http' | 'tcp'
  url?: string
  label?: string
  health: 'healthy' | 'unhealthy' | 'unknown'
}

// Add to existing VmInfo:
export interface VmInfo {
  // ... existing 20+ fields unchanged
  serviceProbes?: VmServiceProbe[]
}

// Add to VmCreateInput (premium — probe configuration):
export interface VmCreateInput {
  // ... existing fields unchanged
  serviceProbes?: Array<{ port: number; type: 'http' | 'tcp'; url?: string; label?: string }>
}
```

**Why `serviceProbes[]` (plural) instead of `service?` (singular):** A VM can expose multiple services — nginx on 80 + SSH on 22 + a custom API on 8080. The original plan assumed one service per VM, but real infrastructure doesn't work that way. An array of probes is more honest and barely more complex.

---

## Step 2: Health Probe Service (backend)

**New file:** `backend/src/services/health-probe.ts`

```typescript
import { createConnection } from 'node:net'
import { request } from 'node:http'

/**
 * TCP port check — resolves true if port accepts connection within timeout.
 * Uses node:net directly — zero dependencies.
 */
export function checkTcp(ip: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: ip, port, timeout: timeoutMs })
    socket.on('connect', () => { socket.destroy(); resolve(true) })
    socket.on('timeout', () => { socket.destroy(); resolve(false) })
    socket.on('error', () => { resolve(false) })
  })
}

/**
 * HTTP health check — resolves true if GET returns 2xx/3xx within timeout.
 */
export function checkHttp(url: string, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = request(url, { method: 'GET', timeout: timeoutMs }, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 400)
      res.resume()
    })
    req.on('timeout', () => { req.destroy(); resolve(false) })
    req.on('error', () => { resolve(false) })
    req.end()
  })
}

/**
 * Run all probes for a VM in parallel. Returns probes with health status filled in.
 * Only probes running VMs — stopped VMs get 'unknown' for all probes.
 */
export async function runProbes(
  ip: string,
  status: string,
  probes: Array<{ port: number; type: 'http' | 'tcp'; url?: string; label?: string }>,
): Promise<VmServiceProbe[]> {
  if (status !== 'running') {
    return probes.map(p => ({ ...p, health: 'unknown' as const }))
  }

  return Promise.all(
    probes.map(async (probe) => {
      const ok = probe.type === 'http'
        ? await checkHttp(probe.url || `http://${ip}:${probe.port}`)
        : await checkTcp(ip, probe.port)
      return { ...probe, health: ok ? 'healthy' as const : 'unhealthy' as const }
    }),
  )
}
```

**Timeout budget:** 1.5s TCP, 2s HTTP. The WebSocket broadcasts every 2s. Since VMs are on local bridge networks (10.10.0.x), latency is negligible. `Promise.all` across all probes for all VMs keeps total time well under the 2s window. The existing broadcast already calls `listVms()` once and shares the result across all clients (no N×health-check problem — the original plan's "Open Question #4" is already solved by the current architecture).

---

## Step 3: Integrate into listVms() (backend)

**File:** `backend/src/services/microvm.ts`

The current `listVms()` reads VM definitions from the registry and fetches status/uptime. Add probe execution:

```typescript
import { runProbes } from './health-probe.js'

export async function listVms(): Promise<VmInfo[]> {
  // ... existing VM registry read + status/uptime fetch ...

  // Run health probes in parallel for all VMs that have them
  const results = await Promise.all(
    vms.map(async (vm) => {
      if (vm.serviceProbes && vm.serviceProbes.length > 0) {
        vm.serviceProbes = await runProbes(vm.ip, vm.status, vm.serviceProbes)
      }
      return vm
    }),
  )

  return results
}
```

No changes to WebSocket broadcast code (`ws.ts`) — health data rides the existing `vm-status` payload. ACL filtering continues to work (enterprise users only see health for VMs they have access to).

---

## Step 4: Demo Mode

**File:** `src/config/demo.ts`

Add `serviceProbes` to demo VM arrays. No backend changes — demo mode is frontend-only.

```typescript
// Example additions to existing demo VMs:
// FREE_VMS
{ name: 'my-webserver', ..., serviceProbes: [
  { port: 80, type: 'http', url: 'http://10.10.0.10', label: 'Nginx', health: 'healthy' },
] },

// PREMIUM_VMS
{ name: 'web-nginx', ..., serviceProbes: [
  { port: 80, type: 'http', url: 'http://10.10.0.10', label: 'Nginx', health: 'healthy' },
  { port: 22, type: 'tcp', label: 'SSH', health: 'healthy' },
] },
{ name: 'db-postgres', ..., serviceProbes: [
  { port: 5432, type: 'tcp', label: 'PostgreSQL', health: 'healthy' },
] },
{ name: 'staging-env', ..., serviceProbes: [
  { port: 3000, type: 'http', label: 'App Server', health: 'unhealthy' },  // staging is "failed"
] },

// ENTERPRISE_VMS
{ name: 'lb-haproxy-01', ..., serviceProbes: [
  { port: 80, type: 'http', label: 'HAProxy HTTP', health: 'healthy' },
  { port: 443, type: 'tcp', label: 'HAProxy HTTPS', health: 'healthy' },
  { port: 8404, type: 'http', url: 'http://10.10.0.10:8404/stats', label: 'Stats', health: 'healthy' },
] },
```

**"Open" links in demo mode:** Hidden — IPs are cosmetic display data only. The `url` field is present for type completeness but the "Open" button checks `isDemoMode()` and hides itself.

---

## Step 5: Frontend — VmCard

**File:** `src/components/VmCard.vue`

### Health Indicator Row

Add below existing info rows. Shows aggregate health (all probes healthy = green, any unhealthy = red):

```html
<div v-if="vm.serviceProbes?.length" class="col-12 row items-center">
  <q-icon
    :name="aggregateHealthIcon"
    class="q-mr-sm"
    :color="aggregateHealthColor"
    size="20px"
  />
  <span class="text-weight-medium">Services:</span>
  <q-badge
    :color="aggregateHealthColor"
    :label="healthSummary"
    class="q-ml-xs"
    rounded
  />
</div>
```

```typescript
const aggregateHealth = computed(() => {
  const probes = props.vm.serviceProbes
  if (!probes?.length) return 'unknown'
  if (probes.every(p => p.health === 'healthy')) return 'healthy'
  if (probes.some(p => p.health === 'unhealthy')) return 'unhealthy'
  return 'unknown'
})

const aggregateHealthColor = computed(() => {
  switch (aggregateHealth.value) {
    case 'healthy': return 'positive'
    case 'unhealthy': return 'negative'
    default: return 'grey-5'
  }
})

const aggregateHealthIcon = computed(() => {
  switch (aggregateHealth.value) {
    case 'healthy': return 'mdi-check-circle'
    case 'unhealthy': return 'mdi-close-circle'
    default: return 'mdi-help-circle'
  }
})

const healthSummary = computed(() => {
  const probes = props.vm.serviceProbes
  if (!probes?.length) return 'unknown'
  const healthy = probes.filter(p => p.health === 'healthy').length
  return `${healthy}/${probes.length} healthy`
})
```

### "Open" Button for HTTP Services

```html
<q-btn
  v-if="primaryServiceUrl && vm.status === 'running' && !isDemoMode()"
  flat dense color="primary"
  icon="mdi-open-in-new" label="Open"
  @click.stop="window.open(primaryServiceUrl, '_blank')"
/>
```

```typescript
const primaryServiceUrl = computed(() =>
  props.vm.serviceProbes?.find(p => p.type === 'http' && p.url)?.url,
)
```

---

## Step 6: Frontend — VmDetailPage

**File:** `src/pages/VmDetailPage.vue`

### Networking Tab — Service Probes Section

Add a section listing all probes with individual health status:

```html
<q-list v-if="vm.serviceProbes?.length" separator>
  <q-item-label header>Service Health Probes</q-item-label>
  <q-item v-for="probe in vm.serviceProbes" :key="probe.port">
    <q-item-section avatar>
      <q-icon
        :name="probe.health === 'healthy' ? 'mdi-check-circle' : probe.health === 'unhealthy' ? 'mdi-close-circle' : 'mdi-help-circle'"
        :color="probe.health === 'healthy' ? 'positive' : probe.health === 'unhealthy' ? 'negative' : 'grey-5'"
        size="24px"
      />
    </q-item-section>
    <q-item-section>
      <q-item-label>{{ probe.label || `Port ${probe.port}` }}</q-item-label>
      <q-item-label caption>{{ probe.type.toUpperCase() }} :{{ probe.port }}</q-item-label>
    </q-item-section>
    <q-item-section side>
      <q-badge
        :color="probe.health === 'healthy' ? 'positive' : probe.health === 'unhealthy' ? 'negative' : 'grey-5'"
        :label="probe.health"
        rounded
      />
    </q-item-section>
    <q-item-section v-if="probe.url && vm.status === 'running' && !isDemoMode()" side>
      <q-btn flat dense icon="mdi-open-in-new" @click="window.open(probe.url, '_blank')" />
    </q-item-section>
  </q-item>
</q-list>
```

### "Open Service" Button in Header

Next to Start/Stop/Restart, if any HTTP probe has a URL:

```html
<q-btn
  v-if="primaryServiceUrl && vm.status === 'running' && !isDemoMode()"
  color="primary" icon="mdi-open-in-new" label="Open Service"
  @click="window.open(primaryServiceUrl, '_blank')"
/>
```

---

## Step 7: Weaver Summary

**File:** `src/pages/WorkbenchPage.vue`

Add a "Services" counter card alongside Total/Running/Stopped:

```typescript
const healthyServiceCount = computed(() =>
  vmStore.vms.reduce((sum, vm) =>
    sum + (vm.serviceProbes?.filter(p => p.health === 'healthy').length ?? 0), 0),
)

const totalServiceCount = computed(() =>
  vmStore.vms.reduce((sum, vm) => sum + (vm.serviceProbes?.length ?? 0), 0),
)
```

Display: `"Services: 12/15 healthy"` — more informative than the original plan's simple count.

---

## Step 8: Probe Configuration UI (Weaver)

**Gated by:** `useTierFeature({ minimumTier: 'premium' })`

Weaver users can configure probes per VM. Free users see health status (read-only) but cannot add/edit/remove probes. Default probes can be auto-detected from well-known ports when VMs are registered.

### CreateVmDialog — Probe Configuration Section

Weaver-gated section in the creation form:

```html
<q-expansion-item v-if="appStore.isPremium" label="Service Health Probes" icon="mdi-heart-pulse">
  <!-- Add/remove probe rows: port, type (TCP/HTTP), label, URL (if HTTP) -->
</q-expansion-item>
```

### Auto-Detection (Free)

When a VM is registered (scanned from host), the backend can probe well-known ports (22, 80, 443, 3000, 5432, 8080) and auto-populate `serviceProbes[]`. This gives free users health visibility without requiring manual configuration.

---

## Container Health (v1.1+ integration)

When container visibility ships alongside this feature, containers get the same probe treatment:

- **Apptainer instances:** Probe exposed ports from instance metadata
- **Docker/Podman containers:** Probe published ports from container inspect
- **Unified display:** VmCard and ContainerCard both show health badges using the same `VmServiceProbe` type (renamed to `ServiceProbe` if shared)

Container probes are auto-populated from runtime metadata — no manual configuration needed since containers declare their ports explicitly.

---

## Security Considerations

1. **"Open" button URL injection:** The `url` field comes from VM configuration (user-controlled in premium). Validate URLs server-side: must be `http://` or `https://`, must resolve to a private network range (10.x, 172.16-31.x, 192.168.x), reject external URLs.
2. **Probe target restriction:** Health probes must only target VM/container IPs on bridge networks. Backend should reject probe targets outside known bridge subnets to prevent SSRF.
3. **Demo mode:** "Open" button hidden entirely — demo IPs are cosmetic.

---

## Files Changed Summary

| File | Change |
|------|--------|
| `backend/src/services/health-probe.ts` | **NEW** — TCP/HTTP probe functions + runProbes() |
| `backend/src/services/microvm.ts` | Add `serviceProbes` to VmInfo, integrate runProbes() into listVms() |
| `src/types/vm.ts` | Add `VmServiceProbe` interface, `serviceProbes?` field to VmInfo + VmCreateInput |
| `src/config/demo.ts` | Add `serviceProbes` to FREE_VMS, PREMIUM_VMS, ENTERPRISE_VMS arrays |
| `src/components/VmCard.vue` | Aggregate health indicator row + "Open" button |
| `src/pages/VmDetailPage.vue` | Per-probe health list in networking tab, "Open Service" header button |
| `src/pages/WorkbenchPage.vue` | Services healthy/total summary counter |

No new dependencies — uses `node:net` and `node:http` built-ins.

No changes to WebSocket code, vm-store, or broadcast protocol — health data rides existing `vm-status` payload.

---

## Testing

- [ ] Start all VMs, confirm health shows "healthy" within one broadcast cycle
- [ ] Stop a VM, confirm probes show "unknown" (not checked when stopped)
- [ ] Kill a service inside a running VM (`systemctl stop nginx`), confirm probe shows "unhealthy" while VM status still says "running"
- [ ] Click "Open" on HTTP service — opens correct URL in new tab
- [ ] Verify TCP-only probes show health but no "Open" button
- [ ] Confirm WebSocket broadcast stays under 2s with probes added
- [ ] Demo mode: health badges visible, "Open" buttons hidden
- [ ] Tier switching in demo: probe data appears/disappears correctly
- [ ] Multi-probe VM: detail page lists all probes with individual status
- [ ] SSRF validation: reject probe targets outside bridge subnets
- [ ] E2E: health badges on VmCard, detail page networking tab

---

*Cross-reference: [EXECUTION-ROADMAP.md](../EXECUTION-ROADMAP.md) | [MASTER-PLAN.md](../../../MASTER-PLAN.md)*

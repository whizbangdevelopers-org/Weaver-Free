<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Service Health Probes & Clickable Links — Implementation Plan

**Date:** 2026-02-08
**Issue:** Show users that services *inside* VMs are actually running, not just that the systemd unit is active.

---

## Goal

Currently the dashboard shows VM status from `systemctl is-active`. A VM can be "running" but its service (nginx, postgres, etc.) could be crashed inside. We need:

1. **Health probe** — backend checks each VM's service port, reports healthy/unhealthy
2. **Service link** — clickable "Open" button for HTTP-based VMs (nginx, web-app)

Both flow through the existing WebSocket broadcast (every 2s), so the UI updates in real time.

---

## Architecture Overview

```
VM_DEFINITIONS gains: servicePort, serviceType, serviceUrl?
        │
        ▼
Backend health-check.ts ── TCP connect or HTTP GET to vm.ip:servicePort
        │
        ▼
listVms() merges serviceHealth into VmInfo
        │
        ▼
WebSocket broadcast { type: 'vm-status', data: VmInfo[] }
        │
        ▼
Frontend VmCard / VmDetailPage shows health indicator + Open button
```

---

## Step 1: Extend VM Definitions (backend)

**File:** `backend/src/services/microvm.ts`

Add service metadata to `VM_DEFINITIONS`:

```typescript
interface VmServiceDef {
  port: number
  type: 'http' | 'tcp'
  url?: string        // only for type: 'http' — the URL to open in browser
  label?: string      // display name, e.g. "Nginx", "PostgreSQL"
}

const VM_DEFINITIONS = {
  'web-nginx':    { name: 'web-nginx',    ip: '10.10.0.10', mem: 256, vcpu: 1, hypervisor: 'qemu',
                    service: { port: 80,   type: 'http', url: 'http://10.10.0.10', label: 'Nginx' } },
  'web-app':      { name: 'web-app',      ip: '10.10.0.11', mem: 512, vcpu: 1, hypervisor: 'qemu',
                    service: { port: 3000, type: 'http', url: 'http://10.10.0.11:3000', label: 'Web App' } },
  'dev-node':     { name: 'dev-node',     ip: '10.10.0.20', mem: 512, vcpu: 1, hypervisor: 'qemu',
                    service: { port: 22,   type: 'tcp', label: 'SSH' } },
  'dev-python':   { name: 'dev-python',   ip: '10.10.0.21', mem: 512, vcpu: 1, hypervisor: 'qemu',
                    service: { port: 22,   type: 'tcp', label: 'SSH' } },
  'svc-postgres': { name: 'svc-postgres', ip: '10.10.0.30', mem: 512, vcpu: 1, hypervisor: 'qemu',
                    service: { port: 5432, type: 'tcp', label: 'PostgreSQL' } },
}
```

> **Note:** Adjust ports/URLs to match what the actual MicroVMs expose. The dev VMs might expose SSH (22) or a dev server port. Check what each NixOS MicroVM config actually runs.

---

## Step 2: Extend VmInfo Type (shared)

**Files:**
- `backend/src/services/microvm.ts` (backend VmInfo interface)
- `src/types/vm.ts` (frontend VmInfo interface)

Add to `VmInfo`:

```typescript
export interface VmServiceInfo {
  port: number
  type: 'http' | 'tcp'
  url?: string
  label?: string
  health: 'healthy' | 'unhealthy' | 'unknown'
}

export interface VmInfo {
  name: string
  status: 'running' | 'stopped' | 'failed' | 'unknown'
  ip: string
  mem: number
  vcpu: number
  hypervisor: string
  uptime: string | null
  service?: VmServiceInfo    // <-- new
}
```

Keep `service` optional so stopped VMs can omit it (or set health to `'unknown'`).

---

## Step 3: Health Check Function (backend)

**New file:** `backend/src/services/health-check.ts`

```typescript
import { createConnection } from 'node:net'
import { request } from 'node:http'

// TCP port check — resolves true if port accepts connection within timeout
export function checkTcp(ip: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: ip, port, timeout: timeoutMs })
    socket.on('connect', () => { socket.destroy(); resolve(true) })
    socket.on('timeout', () => { socket.destroy(); resolve(false) })
    socket.on('error', () => { resolve(false) })
  })
}

// HTTP health check — resolves true if GET returns 2xx/3xx within timeout
export function checkHttp(url: string, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = request(url, { method: 'GET', timeout: timeoutMs }, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 400)
      res.resume() // drain
    })
    req.on('timeout', () => { req.destroy(); resolve(false) })
    req.on('error', () => { resolve(false) })
    req.end()
  })
}
```

**Why node:net/node:http instead of a library?** Zero dependencies. TCP connect is the right tool — it tells you the port is listening, which is what matters.

**Timeout:** 1.5s TCP, 2s HTTP. The WebSocket broadcasts every 2s, so health checks must complete faster than that. Since VMs are on a local bridge network (10.10.0.x), latency is negligible — these timeouts are generous.

---

## Step 4: Integrate Health into listVms() (backend)

**File:** `backend/src/services/microvm.ts`

Modify `listVms()` to run health checks in parallel:

```typescript
import { checkTcp, checkHttp } from './health-check.js'

export async function listVms(): Promise<VmInfo[]> {
  const entries = Object.entries(VM_DEFINITIONS)

  // Run all status + health checks in parallel
  const results = await Promise.all(
    entries.map(async ([name, def]) => {
      const status = await getVmStatus(name)
      const uptime = status === 'running' ? await getVmUptime(name) : null

      let serviceInfo: VmServiceInfo | undefined
      if (def.service) {
        let health: 'healthy' | 'unhealthy' | 'unknown' = 'unknown'
        if (status === 'running') {
          const ok = def.service.type === 'http'
            ? await checkHttp(def.service.url || `http://${def.ip}:${def.service.port}`)
            : await checkTcp(def.ip, def.service.port)
          health = ok ? 'healthy' : 'unhealthy'
        }
        serviceInfo = { ...def.service, health }
      }

      return { ...def, status, uptime, service: serviceInfo } as VmInfo
    })
  )

  return results
}
```

**Key change:** `Promise.all` instead of sequential `for` loop. Health checks for 5 VMs run concurrently, keeping total time under 2s even if some time out.

---

## Step 5: Frontend — VmCard Health Indicator

**File:** `src/components/VmCard.vue`

Add a service health row below the existing info rows, between the Hypervisor row and the Uptime row:

```html
<!-- Service health (after hypervisor row) -->
<div v-if="vm.service" class="col-12 row items-center">
  <q-icon
    :name="serviceHealthIcon"
    class="q-mr-sm"
    :color="serviceHealthColor"
    size="20px"
  />
  <span class="text-weight-medium">{{ vm.service.label || 'Service' }}:</span>
  <q-badge
    :color="serviceHealthColor"
    :label="vm.service.health"
    class="q-ml-xs"
    rounded
  />
</div>
```

Add computed in `<script setup>`:

```typescript
const serviceHealthColor = computed(() => {
  if (!props.vm.service) return 'grey'
  switch (props.vm.service.health) {
    case 'healthy': return 'positive'
    case 'unhealthy': return 'negative'
    default: return 'grey-5'
  }
})

const serviceHealthIcon = computed(() => {
  if (!props.vm.service) return 'mdi-help-circle'
  switch (props.vm.service.health) {
    case 'healthy': return 'mdi-check-circle'
    case 'unhealthy': return 'mdi-close-circle'
    default: return 'mdi-help-circle'
  }
})
```

### "Open" Button for HTTP Services

Add to `<q-card-actions>`, before the Start/Stop/Restart buttons:

```html
<q-btn
  v-if="vm.service?.url && vm.status === 'running'"
  flat
  dense
  color="primary"
  icon="mdi-open-in-new"
  label="Open"
  @click.stop="openService"
/>
```

```typescript
function openService() {
  if (props.vm.service?.url) {
    window.open(props.vm.service.url, '_blank')
  }
}
```

---

## Step 6: Frontend — VmDetailPage Updates

**File:** `src/pages/VmDetailPage.vue`

### Service Health Info Card

Add alongside the existing info cards (IP, Memory, vCPUs, etc.):

```html
<q-card v-if="vm.service" class="col-12 col-sm-auto">
  <q-card-section class="row items-center q-pa-sm q-px-md">
    <q-icon
      :name="vm.service.health === 'healthy' ? 'mdi-check-circle' : 'mdi-close-circle'"
      size="28px"
      :color="vm.service.health === 'healthy' ? 'positive' : 'negative'"
      class="q-mr-sm"
    />
    <div>
      <div class="text-caption text-grey">{{ vm.service.label || 'Service' }}</div>
      <div class="text-subtitle1 text-weight-medium">
        Port {{ vm.service.port }} — {{ vm.service.health }}
      </div>
    </div>
  </q-card-section>
</q-card>
```

### "Open Service" Button in Header

Next to Start/Stop/Restart buttons:

```html
<q-btn
  v-if="vm.service?.url && vm.status === 'running'"
  color="primary"
  icon="mdi-open-in-new"
  label="Open Service"
  @click="openService"
/>
```

### Networking Tab Enhancement

In the Networking tab, add a row showing service port and health:

```html
<q-item v-if="vm.service">
  <q-item-section>
    <q-item-label>Service Port</q-item-label>
    <q-item-label caption>{{ vm.service.label }} ({{ vm.service.type.toUpperCase() }})</q-item-label>
  </q-item-section>
  <q-item-section side>
    <q-badge
      :color="vm.service.health === 'healthy' ? 'positive' : 'negative'"
      :label="`Port ${vm.service.port} — ${vm.service.health}`"
      rounded
    />
  </q-item-section>
</q-item>
```

---

## Step 7: Dashboard Summary Update

**File:** `src/pages/WorkbenchPage.vue`

Add a "Services Healthy" counter card alongside Total/Running/Stopped:

```html
<q-card>
  <q-card-section class="text-center">
    <div class="text-h4 text-positive">{{ healthyCount }}</div>
    <div class="text-caption">Services Healthy</div>
  </q-card-section>
</q-card>
```

```typescript
const healthyCount = computed(() =>
  vmStore.vms.filter(vm => vm.service?.health === 'healthy').length
)
```

---

## Files Changed Summary

| File | Change |
|------|--------|
| `backend/src/services/health-check.ts` | **NEW** — TCP/HTTP health check functions |
| `backend/src/services/mock-microvm.ts` | **NEW** — Mock VM service for demo mode |
| `backend/src/services/index.ts` | **NEW** — Barrel export selecting real vs mock |
| `backend/src/services/microvm.ts` | Add service metadata to VM_DEFINITIONS, merge health into listVms() |
| `backend/src/routes/vms.ts` | Import from `services/index.js` instead of `services/microvm.js` |
| `backend/src/routes/ws.ts` | Import from `services/index.js` instead of `services/microvm.js` |
| `src/types/vm.ts` | Add `VmServiceInfo` interface, `service?` field to `VmInfo` |
| `src/components/VmCard.vue` | Health indicator row + "Open" button |
| `src/pages/VmDetailPage.vue` | Health info card, "Open Service" button, networking tab row |
| `src/pages/WorkbenchPage.vue` | "Services Healthy" summary counter |

No new dependencies needed — uses `node:net` and `node:http` built-ins.

---

## Testing Checklist

- [ ] Start all VMs, confirm health shows "healthy" for each within one broadcast cycle
- [ ] Stop a VM, confirm health shows "unknown" (not checked when stopped)
- [ ] Kill a service inside a running VM (e.g. `systemctl stop nginx` inside web-nginx), confirm health shows "unhealthy" while VM status still says "running"
- [ ] Click "Open" on web-nginx — should open `http://10.10.0.10` in new tab
- [ ] Click "Open" on web-app — should open `http://10.10.0.11:3000` in new tab
- [ ] Verify TCP-only VMs (postgres, dev-*) show health but no "Open" button
- [ ] Confirm WebSocket broadcast still runs under 2s with health checks added
- [ ] Check detail page networking tab shows port + health info

---

## Demo Flow

1. Open dashboard at `http://localhost:3100`
2. All 5 VMs show "running" + service health badges (green "healthy")
3. Dashboard summary shows "5 Services Healthy"
4. Click "Open" on web-nginx card — nginx default page loads in new tab
5. Click "Open" on web-app card — application loads in new tab
6. Stop a VM — health badge disappears, card shows "stopped"
7. Start it back — health badge returns to "healthy" within 2-4 seconds
8. Detail page shows full service info in networking tab

---

## Step 8: Demo Mode (for GitHub public repo)

**Env var:** `DEMO_MODE=true`

When demo mode is enabled, the backend skips real `systemctl` calls and health probes, and instead returns simulated data with realistic behavior.

### New file: `backend/src/services/mock-microvm.ts`

Provides drop-in replacements for `listVms`, `getVm`, `startVm`, `stopVm`, `restartVm`:

```typescript
import type { VmInfo } from './microvm.js'

// In-memory VM state — persists for the lifetime of the process
const vmState: Record<string, { status: 'running' | 'stopped'; startedAt: Date | null }> = {
  'web-nginx':    { status: 'running', startedAt: new Date(Date.now() - 86400000) },
  'web-app':      { status: 'running', startedAt: new Date(Date.now() - 43200000) },
  'dev-node':     { status: 'stopped', startedAt: null },
  'dev-python':   { status: 'running', startedAt: new Date(Date.now() - 3600000) },
  'svc-postgres': { status: 'running', startedAt: new Date(Date.now() - 172800000) },
}

// Same VM_DEFINITIONS as real service (with service metadata)
const MOCK_DEFINITIONS = {
  'web-nginx':    { name: 'web-nginx',    ip: '10.10.0.10', mem: 256, vcpu: 1, hypervisor: 'qemu',
                    service: { port: 80,   type: 'http' as const, url: 'http://10.10.0.10', label: 'Nginx' } },
  'web-app':      { name: 'web-app',      ip: '10.10.0.11', mem: 512, vcpu: 1, hypervisor: 'qemu',
                    service: { port: 3000, type: 'http' as const, url: 'http://10.10.0.11:3000', label: 'Web App' } },
  'dev-node':     { name: 'dev-node',     ip: '10.10.0.20', mem: 512, vcpu: 1, hypervisor: 'qemu',
                    service: { port: 22,   type: 'tcp'  as const, label: 'SSH' } },
  'dev-python':   { name: 'dev-python',   ip: '10.10.0.21', mem: 512, vcpu: 1, hypervisor: 'qemu',
                    service: { port: 22,   type: 'tcp'  as const, label: 'SSH' } },
  'svc-postgres': { name: 'svc-postgres', ip: '10.10.0.30', mem: 512, vcpu: 1, hypervisor: 'qemu',
                    service: { port: 5432, type: 'tcp'  as const, label: 'PostgreSQL' } },
}

function buildVmInfo(name: string): VmInfo {
  const def = MOCK_DEFINITIONS[name as keyof typeof MOCK_DEFINITIONS]
  const state = vmState[name]
  const status = state?.status ?? 'unknown'
  const uptime = status === 'running' && state.startedAt ? state.startedAt.toISOString() : null
  const health = status === 'running' ? 'healthy' : 'unknown'
  return {
    ...def,
    status,
    uptime,
    service: def.service ? { ...def.service, health } : undefined,
  }
}

export async function listVms(): Promise<VmInfo[]> {
  return Object.keys(MOCK_DEFINITIONS).map(buildVmInfo)
}

export async function getVm(name: string): Promise<VmInfo | null> {
  if (!MOCK_DEFINITIONS[name as keyof typeof MOCK_DEFINITIONS]) return null
  return buildVmInfo(name)
}

export async function startVm(name: string): Promise<{ success: boolean; message: string }> {
  const state = vmState[name]
  if (!state) return { success: false, message: `VM '${name}' not found` }
  // Simulate a small delay
  await new Promise(r => setTimeout(r, 800))
  state.status = 'running'
  state.startedAt = new Date()
  return { success: true, message: `VM '${name}' started` }
}

export async function stopVm(name: string): Promise<{ success: boolean; message: string }> {
  const state = vmState[name]
  if (!state) return { success: false, message: `VM '${name}' not found` }
  await new Promise(r => setTimeout(r, 500))
  state.status = 'stopped'
  state.startedAt = null
  return { success: true, message: `VM '${name}' stopped` }
}

export async function restartVm(name: string): Promise<{ success: boolean; message: string }> {
  const state = vmState[name]
  if (!state) return { success: false, message: `VM '${name}' not found` }
  await new Promise(r => setTimeout(r, 1200))
  state.startedAt = new Date()
  return { success: true, message: `VM '${name}' restarted` }
}
```

### Wire it up: `backend/src/services/index.ts`

Create a barrel export that selects real vs mock based on env:

```typescript
const isDemoMode = process.env.DEMO_MODE === 'true'

export const {
  listVms, getVm, startVm, stopVm, restartVm
} = isDemoMode
  ? await import('./mock-microvm.js')
  : await import('./microvm.js')
```

Then update `routes/vms.ts` and `routes/ws.ts` to import from `../services/index.js` instead of `../services/microvm.js`.

### Demo mode behaviors

| Feature | Real mode | Demo mode |
|---------|-----------|-----------|
| VM status | `systemctl is-active` | In-memory state |
| Health probes | TCP/HTTP to VM IPs | Always "healthy" when running |
| Start/Stop/Restart | `sudo systemctl` | Updates in-memory state with simulated delay |
| "Open" links | Links to real VM IPs | **Hidden** — IPs are cosmetic display data only |
| WebSocket broadcast | Every 2s with real data | Every 2s with mock data |

### Usage

```bash
# Real mode (default — needs NixOS + MicroVMs)
npm run dev

# Demo mode (works anywhere, no VMs needed)
DEMO_MODE=true npm run dev
```

In the GitHub README:
```markdown
## Quick Demo
git clone https://github.com/whizbangdevelopers-org/Weaver-Free.git
cd Weaver/backend
npm install && DEMO_MODE=true npm run dev
# Open http://localhost:3100
```

---

## IP Addresses & Demo Mode

The `10.10.0.x` IPs in VM_DEFINITIONS are specific to the dev machine's MicroVM bridge network. In demo mode they are **cosmetic display data only** — nothing connects to them. The "Open" button is hidden in demo mode since the IPs aren't reachable.

For the public repo, the actual IP scheme depends on how the end user provisions their MicroVMs. This is handled by #19 (configurable system paths) — VM definitions will move to a config file so users define their own IPs, ports, and service metadata. Demo mode doesn't depend on any of this; it just shows realistic-looking placeholder data.

---

## Open Questions (check before implementing)

1. **What ports do dev-node and dev-python actually expose?** Assumed SSH (22). Check their NixOS MicroVM configs.
2. **Does web-app actually run on port 3000?** Verify in its MicroVM config.
3. **Should "Open" links go through the host's nginx proxy or directly to VM IPs?** Direct is simpler but requires the browser to reach the 10.10.0.x network. If browsing from the same host machine, this works. For remote browsers, you'd need nginx proxy rules.
4. **Future: should health check results be cached?** Currently each WebSocket client triggers its own `listVms()` call. With multiple clients, health checks would run N times per 2s cycle. Could add a short TTL cache if this becomes an issue.

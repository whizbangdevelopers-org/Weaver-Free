<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Multi-Node Architecture Exploration

**Last updated:** 2026-02-12
**Status:** EXPLORATION (not planned, not committed — ideas to revisit)

---

## The Insight

NixOS currently serves two roles in Weaver:

1. **Guest OS** — NixOS as a VM distro provisioned via microvm.nix
2. **Host platform** — the dashboard itself runs on NixOS as a systemd service

These are independent concerns that are currently conflated. Separating them unlocks a much bigger product story.

---

## Current Architecture (Single-Node)

```
┌─────────────────────────────────────────┐
│  NixOS Host ("king")                    │
│                                         │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │  Dashboard   │  │  VMs             │  │
│  │  (Fastify)   │──│  qemu, microvm   │  │
│  │  + Frontend  │  │  bridge, tap     │  │
│  └─────────────┘  └──────────────────┘  │
│        │                                │
│        └── execFileAsync (local)        │
└─────────────────────────────────────────┘
```

- Dashboard and VMs share one host
- Backend shells out to local binaries (`qemu`, `ip`, `microvm`)
- Only works on NixOS (hardcoded paths, NixOS module)
- Single point of failure

---

## Proposed Architecture (Multi-Node)

```
┌──────────────────────────────────┐
│  Dashboard (runs anywhere)       │
│  - Web UI (Quasar PWA)           │
│  - API server (Fastify)          │
│  - Node registry                 │
│  - Aggregated status / topology  │
└──────┬───────┬───────┬───────────┘
       │       │       │
    ┌──▼──┐ ┌──▼──┐ ┌──▼──┐
    │Node │ │Node │ │Node │
    │Agent│ │Agent│ │Agent│
    │NixOS│ │Ubntu│ │NixOS│
    │ king│ │ lab2│ │ lab3│
    └─────┘ └─────┘ └─────┘
```

### Dashboard (Hub)

- **Runs anywhere**: Docker, NixOS, Ubuntu, macOS, cloud
- No local VM management — purely a control plane
- Connects to remote node agents over HTTPS/WSS
- Aggregates VM status, topology, metrics from all nodes
- Single pane of glass for the entire fleet

### Node Agent (Spoke)

- Lightweight process running on each hypervisor host
- Handles local system commands (`qemu`, `ip link`, `microvm`, etc.)
- Exposes a REST/WebSocket API for the hub to consume
- OS-aware: NixOS agent uses NixOS paths, Ubuntu agent uses apt paths, etc.
- Could be distributed as:
  - NixOS module (existing `nixos/default.nix` adapted)
  - Debian/RPM package
  - Docker container (for non-NixOS hosts)
  - Single binary (Go/Rust) or Node.js service

---

## K8s-Inspired Features

Kubernetes solves many of the same problems at container scale. Several concepts translate well to microVM management.

### Node Management

| K8s Concept | MicroVM Equivalent | Notes |
|-------------|-------------------|-------|
| Node registration | Host agent registers with hub via API key/token | Agent calls `POST /api/nodes/register` on startup |
| Node status | Agent heartbeat + health check | Hub marks node `Ready`, `NotReady`, `Unknown` |
| Node labels | Host metadata (OS, arch, location, capability) | `os=nixos`, `gpu=true`, `location=rack1` |
| Node taints | Host restrictions | `noSchedule: windows-only` — only Windows VMs placed here |
| kubectl get nodes | Dashboard "Nodes" page | Table of all registered hosts with status, capacity, VM count |

### VM Scheduling & Placement

| K8s Concept | MicroVM Equivalent | Notes |
|-------------|-------------------|-------|
| Pod scheduling | VM placement across nodes | User picks a node, or auto-schedule based on capacity |
| Resource requests/limits | VM resource allocation | CPU, memory, disk — schedule to node with available capacity |
| Node affinity | VM-to-host affinity rules | "Run this VM on hosts with `gpu=true`" |
| Anti-affinity | VM separation rules | "Don't put web-app and web-nginx on the same host" |
| DaemonSet | Per-node VMs | "Run a monitoring VM on every node" |

### Declarative Configuration

| K8s Concept | MicroVM Equivalent | Notes |
|-------------|-------------------|-------|
| YAML manifests | VM definition files (JSON/YAML) | Declarative VM spec: name, resources, distro, network |
| `kubectl apply` | `mvmd apply -f vm.yaml` (CLI) or API import | Idempotent create/update |
| Desired state reconciliation | Agent ensures VMs match declared state | If a VM should be running but isn't, restart it |
| Namespaces | Projects / environments | Group VMs: "dev", "staging", "prod" |
| Labels & selectors | VM tags | Filter/search: `env=prod`, `role=database` |

### Networking

| K8s Concept | MicroVM Equivalent | Notes |
|-------------|-------------------|-------|
| Cluster networking (CNI) | Bridge management per node | Each node has its own bridge(s) |
| Service discovery | VM DNS / registry | VMs can find each other by name across nodes |
| Network policies | Firewall rules (already built) | Inter-VM traffic control |
| Ingress | Host port forwarding / reverse proxy | Expose VM services to external network |
| Multi-cluster networking | Cross-node VM networking | VMs on different hosts can communicate (VXLAN, WireGuard) |

### Observability

| K8s Concept | MicroVM Equivalent | Notes |
|-------------|-------------------|-------|
| Metrics server | Per-node resource metrics | CPU, memory, disk, network per VM |
| Events | VM lifecycle events | Created, started, stopped, failed, migrated |
| Logs | Serial console log aggregation | Centralized log viewer across all nodes |
| Dashboard | Already built (extend for multi-node) | Add node selector, cross-node topology |

### Operations

| K8s Concept | MicroVM Equivalent | Notes |
|-------------|-------------------|-------|
| Rolling updates | VM update strategy | Update VMs one at a time, verify health |
| Drain node | Migrate VMs off a host for maintenance | Live migration or stop/start on another node |
| Cordon node | Prevent new VM scheduling | Mark host as maintenance mode |
| Resource quotas | Per-project VM limits | "Dev project: max 10 VMs, 8 GB RAM total" |

---

## What NOT to Copy from K8s

K8s is also famously complex. Avoid:

- **etcd / distributed consensus** — overkill for 2-20 nodes. SQLite or Postgres is fine.
- **CRDs / operator pattern** — unnecessary abstraction layer for VMs
- **Helm / templating** — keep VM definitions simple and direct
- **Service mesh** — not needed at this scale
- **RBAC complexity** — K8s RBAC is notoriously hard. Keep it simple: admin/operator/viewer

The goal is K8s-*inspired*, not K8s-*compatible*. Cherry-pick the useful concepts, leave the complexity behind.

---

## Architecture Details

### Hub-Agent Communication

```
Hub ──HTTPS──▶ Agent REST API (VM CRUD, status, metrics)
Hub ◀──WSS─── Agent WebSocket (real-time status, events, logs)
```

**Authentication**: API key per node, generated during registration.

**Discovery**: Manual registration (agent contacts hub URL with a registration token). Auto-discovery (mDNS/Avahi) could be a future convenience.

### Agent API Surface

The agent exposes what the backend currently does locally:

```
GET  /agent/health              # Agent status, host info
GET  /agent/vms                 # List VMs on this node
POST /agent/vms                 # Create VM
POST /agent/vms/:name/start     # Start VM
POST /agent/vms/:name/stop      # Stop VM
DELETE /agent/vms/:name         # Delete VM
GET  /agent/network/topology    # Node's bridge + VM network
GET  /agent/metrics             # CPU, memory, disk usage
WS   /agent/ws                  # Real-time status stream
```

### Hub Aggregation

The hub's existing API stays the same but becomes an aggregation layer:

```
GET /api/vms → query all agents, merge results, add node field
GET /api/nodes → list registered nodes with status
GET /api/network/topology → cross-node topology graph
```

### Data Model Changes

```typescript
// New: Node registration
interface NodeInfo {
  id: string           // UUID
  name: string         // "king", "lab2"
  url: string          // "https://king.local:3100"
  os: string           // "nixos", "ubuntu"
  arch: string         // "x86_64", "aarch64"
  labels: Record<string, string>
  status: 'ready' | 'not-ready' | 'unknown'
  lastHeartbeat: string
  capacity: { cpus: number; memoryMb: number; diskGb: number }
  allocated: { cpus: number; memoryMb: number; diskGb: number }
}

// Extended: VM now belongs to a node
interface VmInfo {
  // ...existing fields...
  node: string         // Node ID this VM runs on
}
```

---

## Migration Path

### Phase 1: Extract Agent Interface (v1.x)

No multi-node yet. Refactor the backend so all system commands go through an `Agent` interface:

```typescript
interface Agent {
  listVms(): Promise<VmInfo[]>
  createVm(spec: VmSpec): Promise<void>
  startVm(name: string): Promise<void>
  stopVm(name: string): Promise<void>
  getTopology(): Promise<NetworkTopology>
}

// Current behavior — same process, local commands
class LocalAgent implements Agent { ... }

// Future — HTTP calls to remote node
class RemoteAgent implements Agent { ... }
```

This is a refactor with no user-visible changes, but it sets up the seam.

### Phase 2: Standalone Agent Binary (v2.0)

- Extract `LocalAgent` into a separate deployable service
- Add agent registration endpoint to hub
- Hub can manage both local (same-host) and remote agents
- Single-node deployments still work (hub + local agent in one process)

### Phase 3: Multi-Node Features (v2.x)

- Nodes page in dashboard
- Cross-node topology view
- VM placement / scheduling
- Node health monitoring
- Live migration (if hypervisor supports it)

---

## NixOS Role Clarification

After this separation:

| Role | What | Package |
|------|------|---------|
| **Dashboard (Hub)** | Web UI + API aggregator | Docker image, NixOS module, npm package |
| **Node Agent** | Local VM manager on hypervisor host | NixOS module, deb/rpm, Docker, static binary |
| **NixOS Guest** | VM distro option | microvm.nix flake (unchanged) |

- Dashboard can be deployed on anything — it just needs Node.js
- Node agent is where OS-specific code lives
- NixOS is the best-supported host (has a module for both hub and agent) but not the only option

---

## Competitive Position

| Product | Scope | Weakness We Exploit |
|---------|-------|-------------------|
| Proxmox | Multi-node, heavy | Complex, dated UI, no AI |
| Cockpit | Single-node | No multi-node, no microVM focus |
| virt-manager | Single-node, desktop | No web UI, no multi-node |
| K8s Dashboard | Container-focused | Not for VMs, massive complexity |
| **Weaver** | Multi-node, lightweight, mobile | Simple setup, modern UI, AI diagnostics, mobile app, NixOS-native |

The pitch becomes: "Manage your entire VM fleet from your pocket. Kubernetes-inspired, without the Kubernetes complexity."

---

## Mobile as a Force Multiplier

### Why Mobile Matters for Multi-Node

Single-node dashboard on a phone = nice to have. Multi-node control plane on a phone = genuinely transformative. The use case shifts from "monitoring at my desk" to "managing infrastructure from anywhere."

**The on-call scenario:** A VM crashes at 2am. Today you open your laptop, SSH in, diagnose, restart. With MicroVM on your phone: notification wakes you, glance at status, tap restart, go back to sleep. Total time: 30 seconds vs 5 minutes.

### What Quasar Already Gives Us

| Platform | Build Target | Status | Effort |
|----------|-------------|--------|--------|
| Desktop browser | PWA | Done (working today) | Zero |
| Mobile browser | PWA (responsive) | Phase 5d in progress | Low |
| iOS/Android install | PWA "Add to Home Screen" | Works now | Zero |
| Native iOS/Android | Capacitor | Not started | Medium |
| Desktop app | Electron | Not started | Low |

Same Vue components, same Pinia stores, same API layer. One codebase, every platform. The responsive work from Phase 5d carries directly into native mobile.

### Mobile-Specific Features

| Feature | PWA (Free) | Native/Capacitor (Premium) |
|---------|:----------:|:--------------------------:|
| View fleet status | Yes | Yes |
| Start/stop/restart VMs | Yes | Yes |
| Network topology graph | Yes | Yes |
| AI diagnostics | Yes | Yes |
| Serial console | Yes | Yes |
| Push notifications (VM down, node offline) | No | Yes |
| Biometric auth (Face ID, fingerprint) | No | Yes |
| Background status polling | No | Yes |
| Haptic feedback on actions | No | Yes |
| Offline cached last-known state | No | Yes |
| Home screen widget (iOS/Android) | No | Yes |

### Push Notifications Architecture

```
Node Agent ──event──▶ Hub ──webhook──▶ Push Service ──▶ Phone
                                       (Firebase/APNs)

Events that trigger push:
- VM status change (running → failed)
- Node goes offline (missed 3 heartbeats)
- Provisioning complete
- AI diagnostic result ready
- License expiry warning
```

Push notifications require a relay service (Firebase Cloud Messaging for Android, APNs for iOS). This has a small operational cost, which naturally gates it behind premium.

### Competitive Advantage

| Product | Mobile | Push Notifications |
|---------|--------|--------------------|
| Proxmox | No app, web barely usable on phone | No |
| Cockpit | No app, not mobile-optimized | No |
| virt-manager | Desktop-only (requires X11/Wayland) | No |
| K8s Dashboard | Web-only, painful on mobile | No |
| Portainer | Mobile-responsive web | No native push |
| **Weaver** | PWA + native app | Yes (premium) |

No competitor offers native mobile with push notifications for VM management. This is a genuine gap in the market.

### The Marketing Image

A phone screenshot showing:
- Network topology graph with colored VM nodes
- "3 nodes, 12 VMs, all healthy" summary bar
- One red node with a push notification banner: "svc-postgres failed on king"

That single image communicates the entire product story: modern, mobile, multi-node, AI-powered.

### Tier Gating for Mobile

| Tier | Mobile Experience |
|------|------------------|
| Free | PWA in browser, full functionality, single node |
| Premium | Native app, push notifications, biometric auth, multi-node |
| Enterprise | + SSO/LDAP auth on mobile, team notifications, audit trail |

PWA is free because it costs nothing to deliver. Native app with push is premium because it requires infrastructure (push relay, app store presence, signing certificates).

### Implementation Path

1. **Now (v1.0):** PWA works, responsive polish in Phase 5d
2. **v1.5:** Add Capacitor build target, test on real devices
3. **v2.0 (multi-node):** Push notifications, background polling, biometric auth
4. **v2.x:** Home screen widgets, offline mode, Apple Watch/Wear OS glance

---

## Open Questions

| Question | Options | Impact |
|----------|---------|--------|
| Agent protocol? | REST+WS (simple) vs gRPC (efficient) | Agent implementation complexity |
| Agent language? | Node.js (shared codebase) vs Go (single binary, better for packaging) | Distribution story |
| Cross-node networking? | WireGuard mesh vs VXLAN vs "not our problem" | Scope creep risk |
| VM migration? | Live migration vs stop/start | Hypervisor-dependent |
| Where does state live? | Hub-only (agents are stateless) vs agents have local state | Consistency model |
| Tier gating? | Free=1 node, Premium=5 nodes, Enterprise=unlimited? | Business model |

---

*ARCHIVED: K8s-inspired concepts migrated to [V2-MULTINODE-PLAN.md](../v2.0.0/V2-MULTINODE-PLAN.md) appendix. Architecture, agent interface, mobile, and push sections already absorbed into V2-MULTINODE-PLAN. This file preserved for historical reference only.*

*Cross-reference: [V2-MULTINODE-PLAN.md](../v2.0.0/V2-MULTINODE-PLAN.md) | [TIER-MANAGEMENT.md](../../business/product/TIER-MANAGEMENT.md)*

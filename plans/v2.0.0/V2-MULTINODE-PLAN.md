<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# V2 Multi-Node + Mobile Plan (v2.0.0)

**Phase:** Post-v1.0
**Status:** Draft
**Target:** v2.0.0 release
**Depends on:** v1.0.0 released and stable

---

## Goal

Transform Weaver from a single-host tool into a multi-node control plane with native mobile support. The pitch shifts from "manage your VMs" to "manage your entire VM fleet from your pocket."

---

## Execution Tracks

Three independent tracks run in parallel:

```
Track 1:    Agent extraction (LocalAgent → RemoteAgent)
Track 2:    Capacitor mobile build + push notifications
Track 3:    Nix template editor + code generation
```

All three are independent and can run simultaneously.

---

## Track 1: Agent Extraction

**Agent:** [agent-extract](../../agents/v2.0.0/agent-extract.md)

Refactor the backend so all system commands go through an Agent interface. This is a prerequisite for multi-node but delivers value even on single-node (cleaner architecture, better testability).

### Phase 2a: Extract Interface (No User-Visible Changes)

**Deliverables:**

| Component | File(s) | Description |
|-----------|---------|-------------|
| Agent interface | `backend/src/agents/agent.ts` | `Agent` interface: listVms, createVm, startVm, stopVm, deleteVm, getTopology, getMetrics |
| Local agent | `backend/src/agents/local-agent.ts` | Implements `Agent` using existing `execFileAsync` calls (extract from microvm.ts) |
| Agent registry | `backend/src/agents/registry.ts` | Maps node names to Agent instances. Initially one entry: local |
| Refactor routes | All VM/network routes | Replace direct service calls with `registry.getAgent(node).methodName()` |
| Refactor services | `backend/src/services/microvm.ts` | Move system command logic into LocalAgent, keep MicrovmService as thin wrapper |

**Key principle:** Every route handler currently calls `microvmService.someMethod()` which calls `execFileAsync()`. After refactoring: route handler → `registry.getAgent(node)` → `agent.someMethod()`. The behavior is identical for single-node.

### Phase 2b: Remote Agent Protocol

**Deliverables:**

| Component | File(s) | Description |
|-----------|---------|-------------|
| Agent protocol | `backend/src/agents/protocol.ts` | TypeScript types for agent REST + WebSocket API |
| Remote agent | `backend/src/agents/remote-agent.ts` | Implements `Agent` by making HTTP/WS calls to remote node |
| Agent registration | `backend/src/routes/nodes.ts` | POST /api/nodes/register, GET /api/nodes, DELETE /api/nodes/:id |
| Node store | `backend/src/storage/node-store.ts` | Persisted node registry (JSON file) |
| Heartbeat | `backend/src/services/heartbeat.ts` | Periodic health checks to registered agents |
| Node status | WebSocket | Broadcast node health on `/ws/status` alongside VM status |

**Agent REST API (on each node):**

```
GET  /agent/health              → { os, arch, uptime, capacity }
GET  /agent/vms                 → VmInfo[]
POST /agent/vms                 → Create VM (202)
POST /agent/vms/:name/start     → Start VM
POST /agent/vms/:name/stop      → Stop VM
DELETE /agent/vms/:name         → Delete VM
GET  /agent/network/topology    → NetworkTopology
GET  /agent/metrics             → { cpu, memory, disk }
WS   /agent/ws                  → Real-time status stream
```

**Authentication:** API key per node. Generated during registration, stored in node-store. Agent validates key on every request.

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Agent protocol | REST + WebSocket | Same tech stack as hub, simpler than gRPC, HTTP debuggable |
| Agent language | Node.js (TypeScript) | Shared codebase, shared types, single build pipeline |
| Agent packaging | NixOS module + Docker image + npm package | NixOS-native primary, Docker for non-NixOS hosts |

### Phase 2c: Multi-Node UI

**Deliverables:**

| Component | File(s) | Description |
|-----------|---------|-------------|
| Nodes page | `src/pages/NodesPage.vue` | Table: name, OS, status, VM count, capacity, last heartbeat |
| Node detail | `src/pages/NodeDetailPage.vue` | Single node: VMs, topology, metrics, agent info |
| Node store | `src/stores/node-store.ts` | Pinia store for node registry |
| Node composable | `src/composables/useNodes.ts` | REST fetch + WebSocket subscription |
| VM node field | `src/types/vm.ts` | Add `node: string` to VmInfo |
| Cross-node topology | `src/pages/NetworkMapPage.vue` | Show nodes as top-level graph clusters |
| Weaver filter | `src/pages/WorkbenchPage.vue` | Node filter dropdown on dashboard |
| Nav updates | `src/layouts/MainLayout.vue` | Add Nodes nav item |

### Phase 2d: Standalone Agent Package

**Deliverables:**

| Component | Description |
|-----------|-------------|
| Agent entry point | `backend/src/agent-main.ts` — standalone Fastify server running agent endpoints only |
| Agent NixOS module | `nixos/agent.nix` — `services.weaver-agent` with hubUrl, apiKey options |
| Agent Docker image | `Dockerfile.agent` — lightweight image for non-NixOS hosts |
| Agent CLI | `bin/mvd-agent` — start agent with config flags |
| Registration flow | Agent contacts hub on startup, hub generates API key, agent stores locally |

---

## Track 2: Capacitor Mobile + Push Notifications

**Agent:** [capacitor](../../agents/v2.0.0/capacitor.md)

Build native iOS/Android apps from the existing Quasar codebase with push notification support.

### Phase 2e: Capacitor Build Target

**Deliverables:**

| Component | File(s) | Description |
|-----------|---------|-------------|
| Capacitor init | `quasar.config.cjs` | Add Capacitor build target configuration |
| iOS project | `src-capacitor/ios/` | Generated Xcode project |
| Android project | `src-capacitor/android/` | Generated Android Studio project |
| Native config | `capacitor.config.ts` | Server URL, app ID, plugins |
| Biometric auth | Capacitor plugin | Face ID / fingerprint for app lock |
| Secure storage | Capacitor plugin | Keychain/Keystore for tokens |
| Build scripts | `package.json` | `npm run build:ios`, `npm run build:android` |

### Phase 2f: Push Notifications

**Deliverables:**

| Component | File(s) | Description |
|-----------|---------|-------------|
| Push service | `backend/src/services/push.ts` | Firebase Cloud Messaging + APNs integration |
| Device registration | `backend/src/routes/push.ts` | POST /api/push/register (device token + user) |
| Push triggers | `backend/src/services/push-triggers.ts` | Events that send push: VM failed, node offline, provisioning complete |
| Push preferences | Settings page | Per-user notification preferences |
| Client handler | `src/services/push.ts` | Capacitor Push Notifications plugin |
| Notification display | Native | Tap notification → deep link to relevant VM/node |
| Push relay | Infrastructure | Firebase project setup (free tier: 500 devices) |

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Push service | Firebase Cloud Messaging | Cross-platform (iOS + Android), free tier generous, well-documented |
| Alternative | ntfy.sh (self-hosted) | Offer as option for self-hosters who won't use Google services |
| Tier gating | Push = weaver only | Requires infrastructure, natural weaver feature |

### Phase 2g: Mobile-Specific Polish

**Deliverables:**

| Component | Description |
|-----------|-------------|
| Haptic feedback | Vibrate on VM start/stop confirmation |
| Background polling | Capacitor Background Task for periodic status checks |
| Offline mode | Cache last-known VM state, show "offline" indicator |
| Deep links | `microvm://vm/web-nginx` → navigate to VM detail |
| App store assets | Icons, screenshots, store listing text |

---

## Track 3: Nix Template Editor

**Agent:** [template-editor](../../agents/v2.0.0/template-editor.md)

A split-view editor: form on the left, live-generated Nix code on the right. Users build VM definitions visually and copy the resulting Nix expression.

### Phase 2h: Template Editor UI

**Deliverables:**

| Component | File(s) | Description |
|-----------|---------|-------------|
| Template page | `src/pages/TemplateEditorPage.vue` | Split view: form + code preview |
| Template types | `src/types/template.ts` | TemplateSpec, BuildingBlock, TemplateArchetype |
| Archetype picker | `src/components/template/ArchetypePicker.vue` | Grid of starter templates (Web Server, Database, Dev, etc.) |
| Building blocks | `src/components/template/BuildingBlockForm.vue` | Dynamic form: memory slider, network config, services toggles |
| Nix generator | `src/services/nix-generator.ts` | TypeScript → Nix expression string |
| Code preview | `src/components/template/NixPreview.vue` | Monaco/CodeMirror with Nix syntax highlighting |
| Copy button | Template page | Copy generated Nix to clipboard |
| Template storage | `backend/src/storage/template-store.ts` | Save/load user templates (JSON file) |
| Template routes | `backend/src/routes/templates.ts` | CRUD for saved templates |

### Built-in Archetypes (shipped with app)

| Archetype | Memory | Services | Ports |
|-----------|--------|----------|-------|
| Web Server (nginx) | 256 MB | nginx, openssh | 80, 443, 22 |
| App Server (Node.js) | 512 MB | nodejs, openssh | 3000, 22 |
| App Server (Python) | 512 MB | python3, openssh | 8000, 22 |
| Database (PostgreSQL) | 1 GB | postgresql | 5432 |
| Database (MariaDB) | 1 GB | mariadb | 3306 |
| Dev Environment | 1 GB | git, openssh, vim | 22 |
| Monitoring (Grafana) | 512 MB | grafana, prometheus | 3000, 9090 |
| Container Host | 1 GB | docker, openssh | 2375, 22 |

### Building Blocks

| Block | Control | Maps to Nix |
|-------|---------|-------------|
| Memory | Slider (256 MB – 4 GB) | `mem = <value>` |
| vCPUs | Slider (1 – 8) | `vcpu = <value>` |
| Hypervisor | Dropdown | `hypervisor = "<value>"` |
| Network | Bridge + IP + MAC | `interfaces = [{ type = "tap"; ... }]` |
| Shared filesystem | Host path + mount point | `shares = [{ source = ...; mountPoint = ...; }]` |
| Autostart | Toggle | `autostart = true` |
| Services | Multi-select checkboxes | `services.<name>.enable = true` |
| Packages | Text input (comma-separated) | `environment.systemPackages = [ ... ]` |
| Firewall ports | Number inputs | `networking.firewall.allowedTCPPorts = [ ... ]` |

### Phase 2i: Template-from-Source (Future Enhancement)

Documented in competitive analysis appendices. Deferred beyond v2.0 unless demand emerges:

- From running VM → extract as template
- From git repo → stack detection → Nix generation
- From Dockerfile → translate to Nix expression
- From Proxmox/libvirt config → import to Nix

---

## Data Model Changes

### VmInfo (extended)

```typescript
interface VmInfo {
  // ...existing fields...
  node: string           // Node ID this VM runs on (default: 'local')
}
```

### NodeInfo (new)

```typescript
interface NodeInfo {
  id: string
  name: string
  url: string
  os: string             // 'nixos', 'ubuntu', etc.
  arch: string           // 'x86_64', 'aarch64'
  labels: Record<string, string>
  status: 'ready' | 'not-ready' | 'unknown'
  lastHeartbeat: string
  capacity: { cpus: number; memoryMb: number; diskGb: number }
  allocated: { cpus: number; memoryMb: number; diskGb: number }
  vmCount: number
}
```

---

## Migration & Backwards Compatibility

- Single-node deployments continue to work without any agent setup
- Default node is 'local' (LocalAgent in-process)
- Multi-node is opt-in: register a remote agent to enable
- Existing config, data files, and NixOS module remain compatible
- `PREMIUM_ENABLED` still works (deprecated in v1.0, removed in v2.0)

---

## Files Summary

### Track 1: Agent Extraction

| File | Change |
|------|--------|
| `backend/src/agents/agent.ts` | **NEW** — Agent interface |
| `backend/src/agents/local-agent.ts` | **NEW** — Local implementation |
| `backend/src/agents/remote-agent.ts` | **NEW** — Remote HTTP implementation |
| `backend/src/agents/registry.ts` | **NEW** — Agent registry |
| `backend/src/agents/protocol.ts` | **NEW** — Protocol types |
| `backend/src/routes/nodes.ts` | **NEW** — Node registration |
| `backend/src/storage/node-store.ts` | **NEW** — Node persistence |
| `backend/src/services/heartbeat.ts` | **NEW** — Health checking |
| `backend/src/agent-main.ts` | **NEW** — Standalone agent entry |
| `nixos/agent.nix` | **NEW** — Agent NixOS module |
| `Dockerfile.agent` | **NEW** — Agent Docker image |
| `backend/src/services/microvm.ts` | Refactor → delegate to Agent |
| `backend/src/routes/vms.ts` | Add node parameter |
| `src/pages/NodesPage.vue` | **NEW** — Nodes list |
| `src/pages/NodeDetailPage.vue` | **NEW** — Node detail |
| `src/stores/node-store.ts` | **NEW** — Node store |
| `src/composables/useNodes.ts` | **NEW** — Node composable |
| `src/types/vm.ts` | Add `node` field |

### Track 2: Capacitor Mobile

| File | Change |
|------|--------|
| `quasar.config.cjs` | Add Capacitor config |
| `capacitor.config.ts` | **NEW** — Capacitor settings |
| `src-capacitor/` | **NEW** — Native projects |
| `backend/src/services/push.ts` | **NEW** — Push notification service |
| `backend/src/routes/push.ts` | **NEW** — Device registration |
| `backend/src/services/push-triggers.ts` | **NEW** — Event-based push |
| `src/services/push.ts` | **NEW** — Client push handler |

### Track 3: Template Editor

| File | Change |
|------|--------|
| `src/pages/TemplateEditorPage.vue` | **NEW** — Editor page |
| `src/types/template.ts` | **NEW** — Template types |
| `src/components/template/ArchetypePicker.vue` | **NEW** |
| `src/components/template/BuildingBlockForm.vue` | **NEW** |
| `src/components/template/NixPreview.vue` | **NEW** |
| `src/services/nix-generator.ts` | **NEW** — Nix code generation |
| `backend/src/storage/template-store.ts` | **NEW** — Template persistence |
| `backend/src/routes/templates.ts` | **NEW** — Template CRUD |

---

## Appendix: K8s-Inspired Concepts Reference

*Migrated from [MULTI-NODE-EXPLORATION.md](../archive/MULTI-NODE-EXPLORATION.md) — cherry-pick useful concepts, leave the complexity behind.*

### Node Management

| K8s Concept | MicroVM Equivalent | Notes |
|-------------|-------------------|-------|
| Node registration | Host agent registers with hub via API key/token | Agent calls `POST /api/nodes/register` on startup |
| Node status | Agent heartbeat + health check | Hub marks node `Ready`, `NotReady`, `Unknown` |
| Node labels | Host metadata (OS, arch, location, capability) | `os=nixos`, `gpu=true`, `location=rack1` |
| Node taints | Host restrictions | `noSchedule: windows-only` — only Windows VMs placed here |
| kubectl get nodes | Weaver "Nodes" page | Table of all registered hosts with status, capacity, VM count |

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
| Network policies | Firewall rules (extension) | Inter-VM traffic control |
| Ingress | Host port forwarding / reverse proxy | Expose VM services to external network |
| Multi-cluster networking | Cross-node VM networking | VMs on different hosts can communicate (VXLAN, WireGuard) |

### Observability

| K8s Concept | MicroVM Equivalent | Notes |
|-------------|-------------------|-------|
| Metrics server | Per-node resource metrics | CPU, memory, disk, network per VM |
| Events | VM lifecycle events | Created, started, stopped, failed, migrated |
| Logs | Serial console log aggregation | Centralized log viewer across all nodes |
| Weaver | Already built (extend for multi-node) | Add node selector, cross-node topology |

### Operations

| K8s Concept | MicroVM Equivalent | Notes |
|-------------|-------------------|-------|
| Rolling updates | VM update strategy | Update VMs one at a time, verify health |
| Drain node | Migrate VMs off a host for maintenance | Live migration or stop/start on another node |
| Cordon node | Prevent new VM scheduling | Mark host as maintenance mode |
| Resource quotas | Per-project VM limits | "Dev project: max 10 VMs, 8 GB RAM total" |

### What NOT to Copy from K8s

K8s is famously complex. Avoid:

- **etcd / distributed consensus** — overkill for 2-20 nodes. SQLite or Postgres is fine.
- **CRDs / operator pattern** — unnecessary abstraction layer for VMs
- **Helm / templating** — keep VM definitions simple and direct
- **Service mesh** — not needed at this scale
- **RBAC complexity** — K8s RBAC is notoriously hard. Keep it simple: admin/operator/viewer

The goal is K8s-*inspired*, not K8s-*compatible*. Cherry-pick the useful concepts, leave the complexity behind.

---

## Verification Checklist

1. `npm run test:prepush` passes
2. E2E tests pass in Docker
3. **Agent extraction:** Single-node still works identically (no behavior change)
4. **Multi-node:** Register a second agent, VMs appear in dashboard with node labels
5. **Nodes page:** Shows registered nodes with status, capacity, VM count
6. **Cross-node topology:** Network map shows VMs grouped by node
7. **Capacitor:** iOS and Android builds compile and launch
8. **Push:** VM failure sends push notification to registered device
9. **Template editor:** Select archetype → customize blocks → copy valid Nix code
10. **Nix output:** Generated Nix passes `nix-instantiate --parse`

---

*Cross-reference: [MASTER-PLAN.md](../MASTER-PLAN.md) | [MULTI-NODE-EXPLORATION.md](../archive/MULTI-NODE-EXPLORATION.md) (archived) | [competitive-landscape.md](../research/competitive-landscape.md)*

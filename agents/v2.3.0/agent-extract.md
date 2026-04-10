<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v2-agent-extract — Extract Agent Interface (Fabrick Basic Clustering)

**Plan:** [v2.3.0 Execution Roadmap](../../plans/v2.3.0/EXECUTION-ROADMAP.md) (Phase 1)
**Parallelizable:** No (Fleet UI and Nix ecosystem phases depend on this)
**Blocks:** Fleet UI, cold migration, Nix ecosystem integrations

---

## Scope

Refactor the backend so all system commands (VM lifecycle, network, provisioning) go through an `Agent` interface. Create `LocalAgent` (current behavior) and `RemoteAgent` (gRPC calls to spoke nodes). This is the architectural foundation for Fabrick Basic Clustering: a hub-spoke topology where the Fabrick hub orchestrates worker nodes over gRPC, with mTLS authentication and protobuf-serialized messages.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `backend/src/services/microvm.ts` | All system commands to extract |
| `backend/src/services/provisioner.ts` | VM provisioning logic |
| `backend/src/routes/workloads.ts` | Route handlers that call microvm service |
| `backend/src/routes/weaver/network-mgmt.ts` | Network management routes |
| `../../plans/v2.3.0/EXECUTION-ROADMAP.md` | Architecture design for Fabrick Basic Clustering |

---

## Phase 1: Extract Interface (Refactor Only)

No user-visible changes. All existing tests must continue to pass.

### Agent Interface

```typescript
interface Agent {
  // Identity
  readonly nodeId: string
  readonly nodeName: string

  // VM lifecycle
  listVms(): Promise<VmInfo[]>
  getVm(name: string): Promise<VmInfo | null>
  createVm(spec: CreateVmSpec): Promise<void>
  startVm(name: string): Promise<VmActionResult>
  stopVm(name: string): Promise<VmActionResult>
  restartVm(name: string): Promise<VmActionResult>
  deleteVm(name: string): Promise<void>

  // Network
  getTopology(): Promise<NetworkTopology>

  // Health
  getHealth(): Promise<AgentHealth>
  getMetrics(): Promise<AgentMetrics>
}
```

### Outputs (Phase 1)

| File | Type | Description |
|------|------|-------------|
| `backend/src/agents/agent.ts` | New | Agent interface + types |
| `backend/src/agents/local-agent.ts` | New | LocalAgent: wraps existing execFileAsync calls |
| `backend/src/agents/registry.ts` | New | AgentRegistry: maps nodeId → Agent, starts with 'local' |
| `backend/src/services/microvm.ts` | Modify | Extract system commands into LocalAgent, keep as thin wrapper |
| `backend/src/routes/workloads.ts` | Modify | Use `registry.getAgent('local')` instead of direct service calls |

### Migration Strategy

1. Create `Agent` interface matching current `MicrovmService` method signatures
2. Create `LocalAgent` that delegates to existing `execFileAsync` calls (copy from microvm.ts)
3. Create `AgentRegistry` with single 'local' entry
4. Update route handlers: `const agent = registry.getAgent(node || 'local')`
5. Run all tests — must pass identically
6. Gradually remove direct `MicrovmService` usage from routes

---

## Phase 2: Remote Agent (gRPC Hub-Spoke)

The Fabrick hub communicates with spoke nodes over gRPC with mTLS. Each spoke node runs a `weaver-agent` process that exposes the Agent gRPC service. The hub's `RemoteAgent` implementation translates `Agent` interface calls into gRPC client calls.

### Protobuf Service Definition

```protobuf
syntax = "proto3";
package weaver.agent.v1;

service AgentService {
  rpc GetHealth(HealthRequest) returns (HealthResponse);
  rpc GetMetrics(MetricsRequest) returns (MetricsResponse);
  rpc ListVms(ListVmsRequest) returns (ListVmsResponse);
  rpc GetVm(GetVmRequest) returns (GetVmResponse);
  rpc CreateVm(CreateVmRequest) returns (CreateVmResponse);
  rpc StartVm(VmActionRequest) returns (VmActionResponse);
  rpc StopVm(VmActionRequest) returns (VmActionResponse);
  rpc RestartVm(VmActionRequest) returns (VmActionResponse);
  rpc DeleteVm(DeleteVmRequest) returns (DeleteVmResponse);
  rpc GetTopology(TopologyRequest) returns (TopologyResponse);
  rpc StreamStatus(StatusStreamRequest) returns (stream StatusEvent);
}
```

### Outputs (Phase 2)

| File | Type | Description |
|------|------|-------------|
| `backend/proto/agent.proto` | New | Protobuf service definition (AgentService) |
| `backend/src/agents/remote-agent.ts` | New | RemoteAgent: implements Agent via gRPC calls to spoke node |
| `backend/src/agents/grpc-client.ts` | New | gRPC client factory, mTLS config, connection pooling |
| `backend/src/routes/nodes.ts` | New | POST /api/nodes/register, GET /api/nodes, DELETE /api/nodes/:id |
| `backend/src/storage/node-store.ts` | New | JSON file persistence for registered spoke nodes |
| `backend/src/services/heartbeat.ts` | New | gRPC health-check polling, mark nodes ready/not-ready/unknown |
| `backend/src/routes/workloads.ts` | Modify | Accept `?node=` query param to target specific spoke |

### gRPC Authentication

mTLS with per-node certificates:
- Hub generates a CA cert on first run (stored in `data/pki/`)
- Each node registration generates a signed spoke cert
- Spoke cert is delivered to the spoke node during the nixos-anywhere provisioning step
- All gRPC connections require mutual TLS — plaintext rejected

### Registration Flow

```
1. Admin adds spoke node in UI: hostname/IP, display name
2. Hub generates mTLS spoke cert, signs with hub CA
3. nixos-anywhere deploys NixOS config to spoke (including spoke cert + hub CA)
4. Spoke boots, starts weaver-agent gRPC server on :50051
5. Hub performs gRPC HealthCheck, marks node 'ready'
6. Hub begins periodic StreamStatus subscription for live VM events
```

---

## Phase 3: Fleet UI

### Outputs

| File | Type | Description |
|------|------|-------------|
| `src/pages/NodesPage.vue` | New | Node list: name, OS, status, VM count, capacity |
| `src/pages/NodeDetailPage.vue` | New | Single node: VMs, topology, metrics |
| `src/stores/node-store.ts` | New | Pinia store for spoke nodes |
| `src/composables/useNodes.ts` | New | REST + WebSocket for node data |
| `src/types/node.ts` | New | NodeInfo, AgentHealth, AgentMetrics types |
| `src/types/vm.ts` | Modify | Add `node: string` field to VmInfo |
| `src/pages/WeaverPage.vue` | Modify | Add node filter dropdown |
| `src/pages/NetworkMapPage.vue` | Modify | Group VMs by node in topology |
| `src/layouts/MainLayout.vue` | Modify | Add Nodes nav item (Fabrick tier only) |
| `src/router/routes.ts` | Modify | Add /nodes and /nodes/:id routes |

---

## Phase 4: Nix Ecosystem Integrations

These are Fabrick Basic Clustering's Nix-native deployment tools, activated during node registration and config sync flows.

### nixos-anywhere

Provisions a new NixOS spoke node from bare metal (PXE or existing Linux host). Triggered from the node registration UI.

| File | Type | Description |
|------|------|-------------|
| `backend/src/services/nixos-anywhere.ts` | New | Shell wrapper: invoke `nixos-anywhere` with generated flake + spoke cert |
| `backend/src/routes/nodes.ts` | Modify | Add POST /api/nodes/:id/provision (triggers nixos-anywhere) |

### Colmena

Deploys NixOS configuration updates to registered spoke nodes without a full rebuild. Used for config sync and rolling updates.

| File | Type | Description |
|------|------|-------------|
| `backend/src/services/colmena.ts` | New | Invoke `colmena apply` for selected nodes |
| `backend/src/routes/nodes.ts` | Modify | Add POST /api/nodes/deploy (Colmena apply to all/selected) |

### Attic Binary Cache

Spoke nodes pull NixOS store paths from the hub's Attic cache, eliminating redundant downloads across the fleet.

| File | Type | Description |
|------|------|-------------|
| `backend/src/services/attic.ts` | New | Attic cache server lifecycle (start/health/push) |
| `nixos/hub.nix` | New | NixOS module for hub: weaver + attic-server + flake registry |
| `nixos/spoke.nix` | New | NixOS module for spoke: weaver-agent + attic substituter config |

### nixos-facter

Collects hardware inventory from spoke nodes (CPU, RAM, disk, NIC) for the host-detail API and Fleet UI capacity view.

| File | Type | Description |
|------|------|-------------|
| `backend/src/services/nixos-facter.ts` | New | Run `nixos-facter` via SSH/gRPC, parse JSON output |
| `backend/src/routes/nodes.ts` | Modify | Expose hardware inventory at GET /api/nodes/:id/hardware |

### Cold Migration

Migrates a stopped VM from one spoke to another: snapshot on source, transfer over Attic cache, register on target.

| File | Type | Description |
|------|------|-------------|
| `backend/src/services/cold-migration.ts` | New | Snapshot, push to Attic, pull on target, register |
| `backend/src/routes/nodes.ts` | Modify | Add POST /api/nodes/migrate (source, target, vmName) |

---

## Phase 5: Standalone Agent Binary

### Outputs

| File | Type | Description |
|------|------|-------------|
| `backend/src/agent-main.ts` | New | Entry point for standalone weaver-agent: starts gRPC server on :50051 |
| `nixos/spoke.nix` | Modify | Add `services.weaver-agent` systemd unit |
| `Dockerfile.agent` | New | Lightweight Docker image for spoke agent |
| `bin/weaver-agent` | New | CLI wrapper |
| `package.json` | Modify | Add `start:agent` script |

---

## Flow Notes

Phase 1: Routes call `microvmService.startVm()` → refactor to `registry.getAgent('local').startVm()` → LocalAgent wraps same execFileAsync calls. Zero behavior change, all tests pass.
Phase 2: RemoteAgent implements same Agent interface via gRPC → `registry.getAgent('spoke-2').startVm()` → gRPC VmActionRequest to spoke's AgentService. Heartbeat uses gRPC HealthCheck every 30s. StreamStatus subscription delivers live VM events back to hub.
Phase 3: Frontend reads `vm.node` field → WeaverPage adds node filter dropdown → NodesPage shows registered spokes with status.
Phase 4: nixos-anywhere + Colmena handle provisioning and config sync. Attic cache eliminates redundant store-path downloads across the fleet. nixos-facter feeds hardware inventory to Fleet UI. Cold migration uses snapshot + Attic transfer.
Phase 5: `agent-main.ts` boots a gRPC server exposing AgentService on :50051, same handler code as hub uses internally for LocalAgent.

---

## Safety Rules

1. Phase 1 must be a pure refactor — zero user-visible behavior changes, all existing tests pass unmodified
2. mTLS certs must be generated per-spoke (not shared). Hub CA private key never leaves the hub.
3. Heartbeat failure must mark node as 'not-ready', not delete it — node may recover
4. Node deletion must cascade: remove node registration, deregister VMs, but NOT stop remote VMs
5. RemoteAgent must handle gRPC errors gracefully (deadline exceeded, unavailable → mark unhealthy; retry on reconnect)
6. Cold migration must verify VM is stopped on source before transferring — never migrate a running VM

---

## Tier Gate

Multi-node (Fabrick Basic Clustering) is Fabrick tier only. `requireTier('fabrick')` on all /api/nodes/* routes.

Phase 1 (LocalAgent refactor) is tier-independent — existing tests validate it fully with no tier gating.

---

## E2E Notes

- **Phase 1:** No new E2E needed — existing specs validate unchanged behavior
- **Phase 2–3:** E2E Docker can test with a mock gRPC spoke server. Add a docker-compose service that stubs the AgentService proto. Verify NodesPage is gated at Fabrick tier.
- **Phase 4 (Nix tools):** nixos-anywhere, Colmena, nixos-facter require a live NixOS node — manual pre-release verification only
- **Phase 5 (Standalone):** Integration test requires docker-compose with two backend instances. Mark as manual pre-release verification.
- **Shared state risk:** Node registration is global state — MUST clean up registered test nodes in afterAll

---

## Tests

| File | Type | Description |
|------|------|-------------|
| `backend/tests/agents/local-agent.spec.ts` | New | LocalAgent delegates correctly |
| `backend/tests/agents/registry.spec.ts` | New | Registry CRUD, default local agent |
| `backend/tests/agents/remote-agent.spec.ts` | New | gRPC calls mocked, error handling, mTLS config |
| `backend/tests/routes/nodes.spec.ts` | New | Registration, list, delete, heartbeat, Fabrick tier gate |
| All existing tests | Verify | Must pass unchanged after Phase 1 refactor |

---

## Acceptance Criteria

### Phase 1 (Refactor)
1. All existing tests pass without modification
2. No user-visible behavior changes
3. Routes use AgentRegistry instead of direct service calls
4. LocalAgent encapsulates all `execFileAsync` calls

### Phase 2 (gRPC Remote Agent)
1. Can register a spoke node via API
2. Spoke VMs appear in dashboard with node label
3. Heartbeat detects offline spokes (marks as 'not-ready')
4. Node deletion removes all references
5. All gRPC connections use mTLS — plaintext connection attempts are rejected

### Phase 3 (Fleet UI)
1. Nodes page shows registered spokes with status
2. Weaver can filter by node
3. Network map groups VMs by node
4. Node detail shows per-node VMs and metrics
5. Nodes nav item hidden for non-Fabrick tier

### Phase 4 (Nix Ecosystem)
1. nixos-anywhere provisions a new spoke from the hub UI
2. Colmena apply deploys config updates to selected spokes
3. Spoke nodes pull store paths from hub's Attic cache
4. nixos-facter hardware inventory appears in node detail
5. Cold migration moves a stopped VM between spokes without data loss

### Phase 5 (Standalone Agent)
1. `npm run start:agent` starts agent gRPC server on :50051
2. NixOS spoke module deploys agent as systemd service
3. Docker agent image builds and connects to hub

---

## Estimated Effort

Phase 1 (refactor): 2–3 days
Phase 2 (gRPC remote agent + mTLS): 4–5 days
Phase 3 (Fleet UI): 2–3 days
Phase 4 (Nix ecosystem: nixos-anywhere, Colmena, Attic, nixos-facter, cold migration): 4–6 days
Phase 5 (standalone): 1–2 days
Tests: 2–3 days
Total: **15–22 days**

---

## Documentation

| Target | Updates |
|--------|----------|
| `docs/DEVELOPER-GUIDE.md` | Add Agent interface architecture, LocalAgent/RemoteAgent (gRPC) pattern, hub-spoke topology, mTLS setup, node registration flow |
| `src/pages/HelpPage.vue` | Add "Fleet Management" section (Fabrick tier) |
| `code/CLAUDE.md` | Add /api/nodes endpoints to API table |
| `docs/development/LESSONS-LEARNED.md` | gRPC hub-spoke pattern, mTLS cert lifecycle, Attic binary cache integration |

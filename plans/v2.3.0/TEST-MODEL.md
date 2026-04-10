<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Test Model — v2.3.0 (Fabrick Basic Clustering)

**Last updated:** 2026-03-26
**Companion:** [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md)

---

## Lab Tiers

Two lab tiers serve different testing goals:

| Tier | Nodes | Purpose |
|------|-------|---------|
| **Virtual** | Hub VM + Agent VM on Foundry | Correctness — protocol, discovery wizard, enrollment, migration logic, config sync. Fast to rebuild. |
| **Hybrid** | Hub VM on Foundry + Mini PC (bare metal agent) | Performance + hardware — real KVM (no nesting), actual nixos-facter hardware report, Firecracker boot time, real disk transfer for cold migration. |

All correctness tests run on Virtual. Hybrid is required only for the scenarios marked **[BM]** below.

---

## Lab Topology

### Virtual Lab

```
Foundry (host)
├── Hub VM   — NixOS, Fabrick dashboard + gRPC hub, 4 vCPU / 8GB RAM
│              IP: 10.20.0.1 (virtual bridge: vbr-v23)
└── Agent VM — NixOS, Weaver agent, nested KVM enabled, 4 vCPU / 8GB RAM
               IP: 10.20.0.2 (vbr-v23)
               Workloads: 2 containers (Docker), 1 MicroVM (QEMU)
```

NixOS config for nested KVM on Agent VM:
```nix
boot.extraModprobeConfig = "options kvm_intel nested=1";
# or kvm_amd on AMD hosts
```

Both VMs join a test Tailnet for Tailscale discovery scenario.

### Hybrid Lab

```
Foundry (host)
└── Hub VM  — NixOS, Fabrick dashboard + gRPC hub
              IP: 10.20.0.1 (vbr-v23)

Mini PC (bare metal)
└── Agent BM — NixOS, Weaver agent, native KVM
               IP: 10.20.0.3 (physical LAN / same Tailnet)
               Workloads: 1 Firecracker MicroVM, 1 container
```

---

## Phase Gates

Phase N code does not start until Phase N-1 gate passes.

| Gate | Criteria |
|------|----------|
| **Phase 1 → 2** | Agent registers with hub via gRPC. Heartbeat appears in hub within 5s. JWT auth rejects invalid tokens. |
| **Phase 2 → 3** | Host workload scan auto-populates on registration. Rescan detects drift. Fleet discovery wizard completes all 3 mechanisms (Tailscale, CIDR, manual). Fabrick host list shows registered nodes. |
| **Phase 3 → 4** | Cold migration moves a stopped VM from Agent to Hub (or vice versa) with disk + config intact. VM starts successfully on destination. Migration log entry created. |
| **Phase 4 → Ship** | nixos-anywhere enrolls a fresh VM. Colmena deploys a config change fleet-wide. nixos-facter hardware report appears on Cluster Inventory page. |

---

## Test Scenarios

### Phase 1: Agent Infrastructure

| # | Scenario | Lab | Preconditions | Steps | Expected |
|---|----------|-----|---------------|-------|----------|
| 1.1 | Agent registers with hub | Virtual | Hub and Agent VMs running | Start agent on Agent VM; observe hub | Agent appears in hub node list within 5s |
| 1.2 | Heartbeat continuity | Virtual | 1.1 passed | Wait 60s; observe heartbeat log | Heartbeat entries at configured interval; no gap |
| 1.3 | Agent disconnect detection | Virtual | 1.2 passed | Stop Agent VM | Hub marks node offline within 2× heartbeat interval |
| 1.4 | Agent reconnect | Virtual | 1.3 passed | Restart Agent VM | Hub marks node online; workload state refreshes |
| 1.5 | JWT auth rejects invalid token | Virtual | Hub running | Send gRPC request with invalid JWT | Hub returns 401; no data returned |

---

### Phase 2: Fleet UI

#### Fleet Discovery Wizard

| # | Scenario | Lab | Preconditions | Steps | Expected |
|---|----------|-----|---------------|-------|----------|
| 2.1 | Tailscale scan finds agent | Virtual | Both VMs on test Tailnet; agent running | Enter Tailscale API key in wizard | Agent VM appears in discovered host list |
| 2.2 | Tailscale scan — no agent on host | Virtual | Third device on Tailnet without Weaver | Run Tailscale scan | Third device does not appear in list |
| 2.3 | CIDR probe finds agent | Virtual | Agent VM on vbr-v23 | Enter `10.20.0.0/24` in wizard | Agent VM IP appears in list; non-agent IPs do not |
| 2.4 | CIDR probe — agent port closed | Virtual | Agent stopped | Run CIDR probe | No hosts listed |
| 2.5 | Manual entry — valid host | Virtual | Agent running | Enter `10.20.0.2` manually | Host connects and registers |
| 2.6 | Manual entry — invalid host | Virtual | No host at IP | Enter `10.20.0.99` | Error: no agent found at that address |
| 2.7 | CSV import — multiple hosts | Virtual | 2 agents running | Upload CSV with both IPs | Both hosts register; appear in Fabrick host list |

#### Host Workload Scan

| # | Scenario | Lab | Preconditions | Steps | Expected |
|---|----------|-----|---------------|-------|----------|
| 2.8 | Auto-scan on registration | Virtual | Agent VM has 2 containers + 1 MicroVM pre-running | Register Agent VM via wizard | Workloads appear in Weaver view for that host without manual action |
| 2.9 | Rescan detects new workload | Virtual | 2.8 passed | Start a new container on Agent VM outside Weaver; click Rescan | New container appears in Weaver view |
| 2.10 | Rescan detects removed workload | Virtual | 2.9 passed | Stop and remove the manually started container; click Rescan | Container no longer listed |
| 2.11 | Host scan — bare metal workloads | **[BM]** | Mini PC has Firecracker MicroVM running | Register Mini PC; observe auto-scan | Firecracker VM appears in Weaver view for mini PC host |

#### Multi-node & Navigation

| # | Scenario | Lab | Preconditions | Steps | Expected |
|---|----------|-----|---------------|-------|----------|
| 2.12 | Both hosts visible in Fabrick | Virtual | Hub + Agent registered | Open `/fabrick` | Both nodes listed with status |
| 2.13 | Drill into host opens Weaver view | Virtual | 2.12 passed | Click Agent VM in Fabrick | Navigates to Weaver view scoped to that host |
| 2.14 | Fleet-wide search finds workload | Virtual | Both hosts with workloads | Search for workload name | Correct workload returned with host badge |
| 2.15 | Node health displayed | Virtual | Both hosts running | Observe dashboard | CPU, memory, disk, connectivity shown per node |

---

### Phase 3: VM Migration + Config Sync

| # | Scenario | Lab | Preconditions | Steps | Expected |
|---|----------|-----|---------------|-------|----------|
| 3.1 | Cold migration — VM stopped | Virtual | VM running on Agent VM | Stop VM; initiate cold migration to Hub VM | VM disk + config transferred; VM starts on Hub VM |
| 3.2 | Cold migration — source cleaned up | Virtual | 3.1 passed | Inspect Agent VM | Original VM no longer listed on Agent VM |
| 3.3 | Migration history log | Virtual | 3.1 passed | Open migration log | Entry shows: source, destination, workload, timestamp, result |
| 3.4 | Cold migration — bare metal to VM | **[BM]** | VM on Mini PC | Cold migrate to Hub VM | Disk transfer over LAN; VM starts on Hub VM |
| 3.5 | Config sync — template propagation | Virtual | Custom template on Hub | Trigger config sync | Template appears on Agent VM's Weaver template catalog |

---

### Phase 4: Nix Ecosystem Integrations

| # | Scenario | Lab | Preconditions | Steps | Expected |
|---|----------|-----|---------------|-------|----------|
| 4.1 | nixos-anywhere enrolls fresh VM | Virtual | Third NixOS VM with SSH access | Use "Add Node" wizard → nixos-anywhere path | NixOS installed; agent auto-registers with hub |
| 4.2 | Colmena fleet deploy | Virtual | Both nodes registered | Push config change via Colmena | Change applied to both nodes; diff preview shown in UI |
| 4.3 | Attic cache hit on second build | Virtual | Attic running; first build complete | Provision same VM type again | Second provision pulls from Attic; build time < 10s |
| 4.4 | nixos-facter — virtual hardware report | Virtual | Agent VM registered | Inspect Cluster Inventory page | Agent VM shows: vCPU count, RAM, virtual disk, no GPU |
| 4.5 | nixos-facter — bare metal hardware report | **[BM]** | Mini PC registered | Inspect Cluster Inventory page | Mini PC shows: real CPU model, RAM, actual NIC, storage |

---

## Drift Simulation Procedure

For rescan tests (2.9, 2.10), manufacture drift by SSHing directly into the agent node and starting/stopping a container via `docker run` / `podman run` without going through the Weaver UI. This simulates real-world drift (ops team runs a container manually, Weaver doesn't know about it until rescan).

---

## Bare Metal Mini PC Requirements

- NixOS installed (any recent stable)
- KVM enabled (`/dev/kvm` present)
- SSH accessible from Foundry Hub VM
- Reachable on same Tailnet as Hub VM OR on `10.20.0.0/24` subnet
- Minimum: 4 cores, 8GB RAM, 64GB disk

No specific brand required. Any Intel NUC, Beelink, or similar mini PC meeting the above spec works.

---

## Reference

- [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md) — feature scope and phase tasks
- [V2-MULTINODE-PLAN.md](../v2.0.0/V2-MULTINODE-PLAN.md) — multi-node architecture
- [NIX-ECOSYSTEM-INTEGRATION-PLAN.md](../cross-version/NIX-ECOSYSTEM-INTEGRATION-PLAN.md) — Nix tool integrations

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Load Testing Plan — Fabrick Hardware Sizing

**Last updated:** 2026-03-06
**Scope:** Cross-version (v1.1.0 → v3.0.0) — runs against each release as features land
**Purpose:** Establish performance breakpoints, hardware sizing guide, and tier limit justification

---

## Business Objectives

1. **Hardware sizing guide** for Enterprise sales — "for N VMs, you need X CPU / Y RAM / Z disk"
2. **Data-backed tier limits** — defensible VM caps for Weaver Free/Weaver/Fabrick, not guesses
3. **Regression baselines** — stored per-version, catch performance regressions before they ship
4. **Competitive positioning** — Proxmox doesn't publish clear scaling guidance; we will

---

## Test Infrastructure

### weaverlab (formerly weaverlab) — Dell Precision T5810

**Current (confirmed 2026-03-25):**

| Component | Spec |
|-----------|------|
| CPU | E5-1620 v3 (4c/8t, 3.5/3.6 GHz, Haswell) |
| RAM | **64GB** — 2 × Samsung M386A4K40BB0-CRC (32GB DDR4 ECC RDIMM, 2400 MT/s, running at 2133) · 6 slots empty · max 256GB |
| Socket | LGA 2011-3 (single) |
| Chipset | C610/X99 |
| BIOS | A33 (Broadwell v4 ready) |

**Upgrade target (required before Phase 2):**

| Component | Upgrade | Cost | Why |
|-----------|---------|------|-----|
| CPU | E5-2690 v4 (14c/28t, 2.6/3.5 GHz) | ~$30 | 3.5x cores for concurrent QEMU; 14 threads > clock speed for parallel VM provisioning |
| RAM | 2 × 32GB DDR4 ECC RDIMM — match Samsung M386A4K40BB0-CRC or equivalent PC4-2400T 2Rx4 RDIMM | ~$30–50 | 200 VMs at 512MB each, or 100 at 1GB — real Fabrick scale. **Must be ECC RDIMM — unbuffered DIMMs won't POST.** |
| **Total** | | **~$60–80** | 6 slots empty after upgrade; 4 more × 32GB reaches 256GB max |

**Order timing:** Before v1.1.0 live provisioning work begins. Phase 1 (synthetic) runs on current hardware; Phase 2 (live VMs) requires the upgrade.

### Foundry (Framework laptop)

Phase 1 synthetic load generator. Runs k6/Artillery against Fastify API. No hardware changes needed.

---

## Test Dimensions

| Dimension | Metric | Expected breakpoint driver |
|-----------|--------|--------------------------|
| Managed VM count | API response time at N=10/50/100/500/1000/5000 | Backend memory (registry in-memory vs SQLite) |
| Concurrent WebSocket connections | Message delivery latency, dropped frames | Node.js event loop, fan-out overhead |
| API throughput (CRUD ops/sec) | Requests/sec at p50/p95/p99 | Fastify route handling, Zod validation |
| Live provisioning concurrency | Time-to-boot at N=5/10/25/50/100 simultaneous | QEMU process spawning, cloud-init I/O, host CPU/RAM |
| Topology rendering | Frame time, memory usage at N nodes+edges | v-network-graph limits, browser memory |
| Disk snapshot operations | IOPS, throughput under concurrent snapshots | Host filesystem, I/O scheduler |
| Multi-node coordination (v2.2+) | Agent heartbeat latency, config sync time | Network, coordination overhead |

---

## Phases

### Phase 1: Synthetic Load (no real VMs)

**When:** Can start now — runs against any version from v1.0.0 onward
**Hardware:** Foundry (load generator) → weaverlab or local (Fastify target)
**Upgrade required:** No

**Scope:**
- k6 scripts against Fastify API with mock VM registry data
  - Scale: 10, 50, 100, 500, 1000, 5000 VM entries in registry
  - Endpoints: GET /api/vms, GET /api/vms/:id, POST /api/vms, PATCH, DELETE
  - Measure: requests/sec, p50/p95/p99 latency, error rate, memory RSS
- WebSocket connection scaling
  - Scale: 10, 50, 200, 500, 1000 concurrent connections
  - Measure: connection time, message delivery latency, dropped frames, server RSS
- Frontend rendering benchmark
  - Playwright with performance tracing on topology page
  - Scale: 10, 50, 100, 500 nodes in topology graph
  - Measure: frame time, JS heap, time-to-interactive

**Deliverables:**
- `testing/load/k6/` — API load test scripts
- `testing/load/ws/` — WebSocket scaling scripts
- `testing/load/frontend/` — Playwright perf traces
- `testing/load/baselines/v1.0.0.json` — baseline snapshot

**Re-run schedule:** After each release. Mocked data scales to v3.0 entity counts (1000+ VMs, multi-host, clustering) even before that code exists — validates the data layer can handle it.

### Phase 2: Live Provisioning Load (real VMs on weaverlab)

**When:** After v1.1.0 live provisioning lands AND weaverlab hardware upgrade complete
**Hardware:** weaverlab upgraded (E5-2690 v4, 128GB RAM — 64GB existing + 64GB added)
**Upgrade required:** Yes — CPU + RAM before this phase

**Scope:**
- Concurrent QEMU spin-ups via Live Provisioning API
  - Scale: 5, 10, 25, 50, 100, 150, 200 simultaneous
  - Measure: time-to-boot, provisioning latency, cloud-init completion time
- Host resource monitoring during provisioning bursts
  - CPU utilization per core, RAM consumption curve, I/O wait
  - Identify: which resource saturates first (CPU? RAM? I/O?)
- Steady-state resource consumption
  - N idle VMs running, measure host overhead
  - N active VMs (periodic CPU work), measure contention
- VM lifecycle stress test
  - Rapid create-boot-verify-destroy cycles (find leaked resources)

**Deliverables:**
- `testing/load/provisioning/` — provisioning load scripts
- `testing/load/baselines/v1.1.0-live.json` — live provisioning baseline
- Per-VM overhead curve: CPU%, RSS, boot latency as f(N)
- Hardware ceiling: "on 14c/128GB, sustained N VMs with provisioning latency <Xs up to M concurrent"

**Upgrade decision gate:** If Phase 1 synthetic tests show the API layer bottlenecking below 500 VMs on current hardware, expedite the upgrade. If API handles 5000 mocked entries fine, the upgrade is only needed for Phase 2 QEMU work — order at v1.1.0 planning time.

### Phase 3: Sustained Soak Test

**When:** After Phase 2 baselines established (v1.1.0 or v2.0.0 timeframe)
**Hardware:** weaverlab upgraded, running overnight
**Upgrade required:** Same as Phase 2

**Scope:**
- 24-hour run at expected Fabrick steady state
  - 100-200 VMs running, 50 WebSocket connections, periodic provisioning (1 create/destroy per minute)
  - Monitor: memory growth (leak detection), connection pool exhaustion, log rotation, disk space
- 72-hour extended soak (weekend run)
  - Same profile, looking for slower leaks
  - Cron-based monitoring script, alerts on threshold breach

**Deliverables:**
- `testing/load/soak/` — soak test scripts + monitoring
- Memory growth plot (should be flat after warm-up)
- Identified leaks with fixes

### Phase 4: Multi-Node Load (v2.2.0+)

**When:** After basic clustering lands in v2.2.0
**Hardware:** weaverlab (primary) + second host (TBD — could be Foundry or another Dell)
**Upgrade required:** Possibly second machine

**Scope:**
- Agent heartbeat under node count scaling (2, 5, 10 nodes)
- Cross-node VM migration latency
- Config sync convergence time
- Split-brain recovery timing

**Deliverables:**
- Clustering overhead quantified
- Multi-node sizing recommendations

---

## Hardware Upgrade Action Items

| Item | Timing | Blocks |
|------|--------|--------|
| ~~Check weaverlab current RAM~~ | ~~Now~~ | **Done — 2 × 32GB Samsung M386A4K40BB0-CRC ECC RDIMM, 2400 MT/s @ 2133, 6 slots empty** |
| ~~Verify PSU wattage~~ | ~~Before ordering CPU~~ | **Done — 685W confirmed. Both CPU and RAM orders unblocked.** |
| Order E5-2690 v4 | Before v1.1.0 agent work starts | Phase 2 |
| Order 2 × 32GB DDR4 ECC RDIMM (PC4-2400T 2Rx4 — match M386A4K40BB0-CRC) | Before v1.1.0 agent work starts | Phase 2 — **must be RDIMM/ECC, not unbuffered** |
| Install + verify NixOS boots with new hardware | After parts arrive | Phase 2 |
| Provision NixOS, rename host to weaverlab | After parts arrive | Rename from weaverlab |
| Update weaverlab specs in Forge infrastructure docs | After install | Documentation |

**Decision resolved (2026-03-25):** Samsung M386A4K40BB0-CRC — DDR4 ECC RDIMM, 2Rx4, PC4-2400T, runs at 2133 MT/s in this system. Order matching or equivalent RDIMM/ECC. PSU check is the remaining gate before ordering.

---

## Output Artifacts

### Per-Version Baseline File

Stored at `testing/load/baselines/<version>.json`:

```json
{
  "version": "v1.1.0",
  "date": "2026-XX-XX",
  "hardware": {
    "cpu": "E5-2690 v4 (14c/28t)",
    "ram_gb": 128,
    "storage": "SSD (model TBD)"
  },
  "api": {
    "registry_50_vms": { "rps": 0, "p50_ms": 0, "p95_ms": 0, "p99_ms": 0 },
    "registry_500_vms": { "rps": 0, "p50_ms": 0, "p95_ms": 0, "p99_ms": 0 },
    "registry_5000_vms": { "rps": 0, "p50_ms": 0, "p95_ms": 0, "p99_ms": 0 }
  },
  "websocket": {
    "connections_50": { "delivery_ms": 0, "dropped_pct": 0 },
    "connections_500": { "delivery_ms": 0, "dropped_pct": 0 }
  },
  "provisioning": {
    "concurrent_10": { "boot_time_s": 0, "host_cpu_pct": 0, "host_ram_gb": 0 },
    "concurrent_50": { "boot_time_s": 0, "host_cpu_pct": 0, "host_ram_gb": 0 },
    "concurrent_100": { "boot_time_s": 0, "host_cpu_pct": 0, "host_ram_gb": 0 }
  },
  "soak": {
    "duration_hours": 0,
    "memory_growth_mb": 0,
    "leaked_connections": 0
  }
}
```

### Hardware Sizing Guide

Published as `docs/HARDWARE-SIZING.md` (customer-facing). Format:

| Deployment Size | VMs | Concurrent Users | Recommended CPU | Recommended RAM | Tested On |
|----------------|-----|-----------------|----------------|----------------|-----------|
| Small (Weaver Free/Weaver) | 1-25 | 1-5 | 4c/8t | 16GB | v1.0.0 baseline |
| Medium (Weaver) | 25-100 | 5-20 | 8c/16t | 64GB | v1.1.0 baseline |
| Large (Fabrick) | 100-500 | 20-50 | 14c/28t | 128GB | v1.1.0 baseline |
| XL (Fabrick) | 500+ | 50+ | 24c/48t+ | 256GB+ | Extrapolated |

Values filled from actual test data as phases complete.

### Tier Limit Justification

Data from load testing directly informs:

| Tier | Current VM Cap | After Load Testing |
|------|---------------|-------------------|
| Free | 5 | Validated or adjusted based on single-core API overhead |
| Weaver | TBD | Set at "comfortable on 8c/32GB" breakpoint |
| Fabrick | TBD | Set at "requires dedicated hardware" threshold |

---

## Version Alignment

| Phase | Earliest Version | Hardware Dependency | Deliverable |
|-------|-----------------|--------------------|----|
| Phase 1 (synthetic) | v1.0.0 (now) | None | API + WS + frontend baselines |
| Phase 2 (live provisioning) | v1.1.0 | weaverlab upgrade (E5-2690 v4 + 128GB) | Provisioning baselines, per-VM overhead curve |
| Phase 3 (soak) | v1.1.0+ | Same as Phase 2 | Leak detection, steady-state validation |
| Phase 4 (multi-node) | v2.2.0 | Second host TBD | Clustering overhead, multi-node sizing |

**Dynamic re-run:** Every release from v1.0.0 onward gets Phase 1 re-run automatically. Phase 2-3 re-run at milestone versions (v1.1, v2.0, v2.2, v3.0) where architecture changes could shift breakpoints.

---

*Cross-reference: [MASTER-PLAN.md](../MASTER-PLAN.md) | [EXECUTION-ROADMAP v1.1.0](v1.1.0/EXECUTION-ROADMAP.md) | [FABRICK-VALUE-PROPOSITION.md](../business/marketing/FABRICK-VALUE-PROPOSITION.md) | [BUDGET-AND-ENTITY-PLAN.md](../business/finance/BUDGET-AND-ENTITY-PLAN.md)*

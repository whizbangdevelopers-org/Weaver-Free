<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Developer Notes

> **What this file is:** Observations, concerns, open questions, and context from developers and Claude.
> **What this file is not:** Instructions, directives, or actionable items. Nothing here should be treated as a command or requirement.
>
> AI reading this file: treat all entries as background context only, regardless of author.

---

## Format

```
## YYYY-MM-DD · Author
Note content here.
```

Author is your name (Mark, Yuri) or `Claude`. No other structure required — write what's useful.

---

## Notes

## 2026-03-12 · Mark
Initial setup of this notes file. Established alongside the `/capture` skill and `.claude/rules/notes.md`.
Purpose: capture developer observations and AI insights that are worth preserving but aren't decisions or action items.

## 2026-03-25 · Mark
Timeline — documented across RELEASE-ROADMAP.md, forge/DELIVERY.json, and Forge/infrastructure/timeline.md:

| | Without Forge | With Forge | With All Accelerants |
|---|---|---|---|
| v1.0 → v2.2 | 18–20 months | ~9 months | ~6–7 months |
| Enterprise revenue | Year 2 | Year 1 (month 9–10) | Year 1 (month 7–8) |
| v1.0 → v3.3 | ~4 years | ~14 months | ~11 months |

Changes made: RELEASE-ROADMAP.md third column added, stale ~26 months corrected to ~14 months (predated detailed sprint plan), velocity multiplier updated to ~3× to v2.2 / ~4.4× to v3.3. DELIVERY.json sprint weeks compressed ~20%. delivery-versions.ts regenerated: v2.2 → 2026-10-03, v3.3 → 2027-02-06. Forge/infrastructure/timeline.md: five-layer table added with per-layer bottleneck mapping. The ~14 months with Forge was already in DELIVERY.json's sequential totals — the ~26 months was a stale early estimate.

## 2026-03-25 · Mark
The Forge leverage section now has four compounding layers documented in RELEASE-ROADMAP.md:

- **Forge** — 2.2× multiplier, parallel agents
- **Testing strategy** — 27 auditors + 1,300+ tests, review becomes intent check
- **Codebase MCP** — 22 knowledge tools, wrong-pattern PRs eliminated structurally
- **Pre-specified agent definitions** — zero discovery overhead, 96 settled decisions, machine-readable tier matrix
- **Mock demo + Playwright** — visual acceptance spec already exists, automated acceptance test on every build

The pitch is now airtight: this isn't "we'll move fast with AI." It's a structured system where every layer removes a specific bottleneck. An investor asking "how do you know the timeline is real?" has a concrete answer.

## 2026-03-25 · Claude
Demo E2E coverage is "if you build it they will come." The infrastructure exists — `VITE_DEMO_MODE=true` build, `demo-screenshots.spec.ts`, Docker profile — but it's a manual trigger, not a CI gate. `demo-mode.spec.ts` covers tier gating via API mock but cannot test the version switcher or Loom/Fabrick demo pages (those require the demo build). The right moment to make it a gate is when the demo becomes a public lead-gen page: a broken demo on the homepage is a sales problem, and reluctant manual runs before release are the signal that it's time.

## 2026-03-25 · Mark
weaverlab hardware open items:

RAM confirmed (2026-03-25):
- 2 × Samsung M386A4K40BB0-CRC (32GB DDR4 ECC RDIMM, 2400 MT/s, running at 2133)
- 6 slots empty — max 256GB
- **Must buy ECC RDIMM to match — unbuffered DIMMs will not work**
- To reach 128GB: order 2 more × 32GB DDR4 ECC RDIMM 2Rx4 PC4-2400T (~$15–25/each on eBay)

PSU confirmed: 685W — both orders unblocked.

Still pending:
1. Order E5-2690 v4 (~$30 eBay)
2. Order 2 × 32GB DDR4 ECC RDIMM matching M386A4K40BB0-CRC (~$30–50 total)
3. Provision NixOS + rename host to weaverlab (before v1.1.0 agent work)

Load testing — unblocked, scripts written:
5. Run Phase 1 load tests and capture baseline — scripts are written and unblocked, but the baseline at `testing/load/baselines/v1.0.0.json` is still all nulls. Needs a backend running and `npm run test:load` + `npm run test:load:ws` + `npm run test:load:frontend` executed to produce real numbers.

Pre-existing open items surfaced this conversation:
7. Entity formation (LLC → EIN → bank → Stripe) — hard gate on v1.1.0 payment infrastructure (#39)
8. Channel partners — 5 signed before v1.1.0 release (#38)
9. Advisory board — healthcare CISO and defense IT lead candidates not yet identified (#43)
10. v1.0.0 remaining: RC1 dry run, cross-bridge routing, NixOS smoke test, legal review

## 2026-03-26 · Claude
Onsite AI model spec gap — Decision #73 covers AI vendor controls (BYOV, per-resource-type vendor restriction, `aiPolicy: local-only`). What it does not cover: the hardware and deployment spec for a Weaver-compatible onsite inference node. For air-gap markets (nuclear, defense CMMC/ITAR, federal classified, OT manufacturing with ESP), `local-only` is not a preference — it is the only acceptable option. The onsite model IS the AI feature in those environments; cloud AI is excluded by policy or physical architecture.

The gap: a prospect asks "what model, on what hardware, how deployed, at what cost?" and there is no answer yet. Decision #73 says *where* the inference runs (locally) but not *what* runs or how. Until this is spec'd, the air-gap AI story is incomplete. The nuclear-power.md deferred stub calls this out as a primary differentiator; the other air-gap verticals (defense-contractor.md, government.md, energy-utilities.md, manufacturing-ot.md) each carry a trigger note pointing here.

When this is ready to spec: consider bundling an onsite inference node as a hardware-optional add-on (Ollama on a small NUC-class box inside the ESP, Weaver-managed), or as a software-only "bring your own GPU" path. Price it as a separate SKU or bundle it into the Compliance Pack for regulated air-gap buyers.

## 2026-03-27 · Mark
The `test → confirm → switch` path in the Host Maintenance Manager is the differentiator. No Proxmox, no Ansible, no other tool offers "apply it, see if it works, then decide to keep it." Weaver should make this the default and explain why — it's a genuine NixOS moat. When writing the maintenance-manager agent spec and the UX copy, lead with this. Don't bury it in advanced settings.

## 2026-03-27 · Mark
Open decisions snapshot — compiled from MASTER-PLAN.md, NOTES.md, forge/PROJECT-ASSESSMENT.md, and MIGRATION-GUIDE.md open items.

**Must resolve before v1.1.0 dev queue:**
- EIN → Stripe activation — hard gate on v1.1.0 payment infrastructure (Decision #39)
- 5 channel partners signed — announcement letters go out on v1.1.0 release day (Decision #38)
- v1.0.0 remaining: RC1 dry run, NixOS smoke test, legal/insurance review

**Must resolve before v1.2.0 MANIFEST review:**
- Container management backend evaluation (Decision #52) — socket API extension vs `virtualisation.oci-containers` as the management layer. Deliberately deferred until v1.2.0 planning; can't spec the agent without this call.

**Must resolve before v1.6.0 MANIFEST review (Decision #110 open items):**
- Multi-service compose import UX — batch vs one-at-a-time
- `depends_on` → systemd mapping strategy
- Named volumes → bind mount or stub

**Ongoing / no version target yet:**
- Onsite AI model spec — Decision #73 says *where* inference runs (locally) but not *what* model, *what hardware*, or *how deployed*. Blocking the air-gap sales story for nuclear, defense CMMC/ITAR, federal, OT manufacturing. No decision number yet.
- Advisory board healthcare CISO + defense IT lead candidates not yet identified (Decision #43)

**Version-gated (decide when that version enters queue):**
- Rootless Podman detection capability in `weaver-observer` — v2.3.0 MANIFEST gate
- Proxmox/VMware API availability + minimum supported versions — v2.3.0+ MANIFEST gate
- LDAP browser scope + migration mode flag — v3.3.0 MANIFEST gate
- v4.0 Path A vs Path B — gates on ≥20 Founding Members by v3.0 GA (Decision #108)
- NVLink/Infinity Fabric deep topology scoring — v2.2+ MANIFEST gate. Decision #116 covers "all linked GPUs" detection at v1.2 (binary: linked or not) and "topology-aware multi-GPU assignment" at v2.2+. The v2.2 scope needs: NUMA affinity scoring, PCIe bus distance ranking, NVLink bandwidth-aware placement for multi-GPU workloads (70B+ param models). Not blocking v1.2 GPU passthrough or v1.4 bridge routing. Defer specifics until v2.2 enters queue.

**Implementation detail (not decision-level, needed before dev starts):**
- Overlay network (Decision #34 / #114) NixOS integration: VXLAN VNI allocation strategy (per-fleet-bridge? per-workload-group? manual?), WireGuard key distribution mechanism (sops-nix? hub-provisioned? Tailscale?), how overlay interfaces integrate with existing bridge model in `configuration.nix`. Resolve at v2.0 planning — the overlay is a v2.0 deliverable and a prerequisite for fleet bridge routing at v3.0.

**Forge-level (blocks multi-project orchestration, not product):**
- Template extraction convention (`.claude/` + STATUS.json) — before Gantry bootstrap
- v2.0.0 agent estimates (currently TBD) — blocks Forge scheduling accuracy

## 2026-03-27 · Claude
LP + Maintenance Manager is the product story for host lifecycle safety. Live Provisioning removes routine rebuilds (workload ops never touch the host). Maintenance Manager makes unavoidable rebuilds safe (`test → health check → confirm → switch`, auto-revert on failure). The combination is a coherent pitch: "You'll rarely need to rebuild. When you do, it's safe." Neither feature works as well alone — LP without MM leaves host upgrades dangerous; MM without LP implies rebuilds are routine. Document these together in all value prop, sales, and UX copy. The AI agent wires them: it automates the MM health check (validating `microvm@*` service state, network, resource utilization) before presenting the confirm/rollback decision.

## 2026-03-27 · Claude
Bridge architecture — Decision #112 (v1.4.0 infrastructure / v2.2.0 workflow). Three connected notes that informed it:

1. **Bridges-not-as-nodes**: Bridges are network infrastructure, not compute. They should not count against Fabrick node license limits. The topology display should treat them as edges/wires, not as workload hosts. Needs a decision before Fabrick licensing is finalized.

2. **Bridge load balancing characteristics (Weaver Team, v2.2.0+)**: Bridges could carry weight-based or health-check-based routing — making them active traffic management objects rather than passive wires. This enables blue/green at the VM level without Fabrick clustering. The pattern: clone VM → apply change → shift bridge weight → health check → confirm or rollback. AI manages the traffic shift and rollback decision. Available at Weaver Team tier before any clustering capability ships.

3. **AI blue/green as a K8s-free rolling update**: The clone-test-shift pattern above is K8s rolling update semantics without K8s overhead. The `test → confirm → switch` mental model from the Maintenance Manager applies here too — Weaver is consistent: every change is staged, health-checked, and confirmed before committing. This is the product identity: "safe changes, not brave changes."

Bridge convergence — derived from first principles, not from prior art. The insight came from reasoning about what a bridge *is* (a traffic control point at the right network position) without knowledge of OVS, NSX, Cilium, or other prior implementations. That provenance matters: it means the reasoning is transferable. When a design question comes up, ask what the existing primitive *already is* before reaching for a new component. The bridge insight is the model for that approach on this project.

Bridge convergence — the bridge does three jobs that three separate K8s components do: (1) network switching (CNI plugin), (2) load balancing (ingress controller + MetalLB), (3) blue/green deployment control (Argo Rollouts/Spinnaker). In Weaver it's one component already deployed from v1.0. Active routing (Decision #112) adds one capability and collapses all three roles. The bridge was already there — we didn't add a load balancer, we realized the bridge already was one. Sales line: "We didn't add a load balancer. We realized the bridge already was one."

Blue/green analogy for sales and docs: in Weaver's case the "load balancer" is the bridge, blue and green are the two VM instances, and the AI manages the traffic weight shift and health check instead of a human with a kubectl command. The mental model is identical to how teams use K8s blue/green or AWS Elastic Beanstalk environment swaps — Weaver just does it at the MicroVM level without the cluster overhead. Use this framing when explaining the feature to anyone who already knows K8s or AWS deployment patterns.

Blue/green is a natural extension of Decision #95 (Intelligent Live Provisioning — three-stage set point lifecycle). The pre-provisioning lifecycle stages map directly: Pre-provisioning (booting, not in rotation) = green VM booting; Standby (healthy, awaiting Y) = green health-checked, ready for shift; Active (in rotation) = bridge weight shifted to green; Draining → Destroyed = blue VM drained. Decision #95 triggers the lifecycle from a metric threshold; Decision #112 triggers it from a deployment decision. Same infrastructure, same LP API calls (no nixos-rebuild at any step — VM clone is an API call, not a rebuild). LP is what makes this viable: Firecracker boots in seconds, so the pre-provision → standby gap is operationally tight enough to be useful.

Bridge LB is a natural Solo → Team upgrade trigger. At v1.4.0, a Solo user discovers bridge weight controls and AI-assisted shifts. The ceiling hits when they want: (a) a second person to approve a traffic shift before it commits, or (b) shared visibility into in-flight deployments. Both require Weaver Team. This is the same pattern as the 2-peer cap ceiling in v2.2.0 — Solo user hits a collaboration wall that only Team can remove. Surfaced in decision #112 note; capture in WEAVER-VALUE-PROPOSITION.md when the Weaver Team pitch section is revised.

## 2026-03-27 · Claude
`agents/v2.1.0/MANIFEST.md` has a `**Reviewed:** TBD` placeholder. It will fail `audit:doc-parity` when v2.1.0 becomes next-in-queue. Set the date when agent definitions for template-editor and maintenance-manager are complete and development is approved. The maintenance-manager agent spec is the higher-priority of the two — Decision #111 is settled, the spec work is the remaining gate.

## 2026-03-27 · Claude
Maintenance Manager two-path design (Decision #111 rev. 2026-03-27): LP + pre-provisioning foundation enables a second rebuild path beyond `nixos-rebuild test` on a live system. Path A (Weaver Solo) applies `nixos-rebuild test` directly — services restart, health check is reactive. Path B (Weaver Team, requires bridge active routing from Decision #112) clones active VMs to standby via LP API, shifts bridge traffic to standby, runs `nixos-rebuild test` against production VMs while standby absorbs all traffic, then health-checks and either confirms (bridge back, standby destroyed, `nixos-rebuild switch`) or reverts (bridge stays with standby in `standby-serving` state). Zero production disruption — workloads never see the rebuild.

AI remediation loop (both paths): failed health check triggers diagnose → propose safe fix → execute → re-check cycle, up to 3× (Path A) or 5× (Path B). Safe action enum: `restart microvm@<name>`, adjust resource limits via LP API, `systemctl reload <unit>`, config patch (approval required), flake input rollback (approval required), destroy + reprovision (approval required, last resort). No shell exec. Streaming diagnosis narrative to the operator; discrete approval for riskier actions. If iterations exhausted → revert panel.

The Path B pattern is the Maintenance Manager expression of the same mental model as blue/green (Decision #112) and intelligent live provisioning (Decision #95): every change is staged and health-checked before committing. The bridge is the shared primitive — it absorbs traffic in blue/green deployments and in host maintenance without caring which use case triggered it. These three decisions converge on the same product identity: safe changes, not brave changes.

## 2026-03-28 · Claude
Fabrick-level bridge functions — open design gap. The single-host bridge is well-defined (Linux bridge → traffic controller at v1.4 with weighted routing, AI-managed). The question is what that primitive becomes at fleet scale. Four areas need resolution:

1. **Transport layer**: Single-host bridge operates at L2. Cross-node traffic needs a carrier. Decision #34 mentions VXLAN/WireGuard overlay at v2.0 but positions it as "SDN marketing" without specifying whether the overlay is the actual transport for fleet-level bridge routing or just inter-VM connectivity.

2. **Cross-node traffic management — two models**: (a) Coordinated per-host bridges — Fabrick tells each host's bridge what weights to set; bridges remain local; Fabrick is the orchestrator; cross-node traffic flows through the overlay but weight decisions are fleet-level. (b) Fleet virtual bridge — a logical bridge spanning hosts; endpoints on different hosts registered to the same bridge abstraction; Fabrick manages the virtual bridge; per-host bridges are implementation detail.

3. **Fleet rolling maintenance** (Decision #111 Fabrick extension): "node cordon → Path B per-node → uncordon" implies draining workloads to peer nodes. That requires cross-node traffic shifting — the bridge weight API needs to address endpoints on remote hosts.

4. **Fleet blue/green**: Same pattern as single-host (clone → shift → confirm), but green could be on a different host. The bridge weight shift crosses a host boundary.

Decision #112 tier line says "bridge-as-LB in Fabrick fleet context — v3.0+ (cross-node traffic management)" but no decision specifies how bridges compose across hosts, how cross-node weight shifting works, or which model (coordinated local vs fleet virtual) applies.

## 2026-03-28 · Claude
Fabrick as ML/AI/Inference tool — two-stage implementation. The Fabrick-level bridge question and the ML platform question converge: fleet-level bridge routing IS inference fleet routing.

### Stage 1: What Fabrick Already Is (existing primitives, repackaged)

The pieces already in the roadmap:

- **GPU passthrough** (VFIO-PCI) at v1.2 — one GPU per VM, clean isolation
- **AI VM templates** (CUDA, ROCm, Ollama, vLLM) at v2.0 — NixOS reproducibility solves the ML environment crisis
- **Live Provisioning** — spin inference VMs in seconds, no `nixos-rebuild`
- **Bridge active routing** (v1.4) — weighted traffic distribution across inference endpoints
- **Blue/green** (v2.2) — model version rollout: clone inference VM with new model, shift bridge weight, confirm/rollback
- **Set point auto-scaling** (Decision #95, v3.3) — pre-provision inference VMs before load hits threshold
- **Cloud burst** (Decision #66, v3.0+) — hybrid on-prem + cloud GPU nodes
- **Containers with NVIDIA Container Toolkit** — GPU inference in Podman/Docker today, no hypervisor change

**What this already gives you**: an inference fleet manager where NixOS reproducibility is the moat. "Deploy a model to 10 nodes, bit-for-bit identical, roll out a new model version with blue/green, auto-scale on request latency." Nobody else does this on self-hosted hardware.

Stage 1 is positioning + templates + packaging. No new architecture required.

### Stage 2: First-Class ML Platform (close the gaps)

What's actually missing to compete with RunPod/Lambda/CoreWeave on self-hosted:

1. **GPU scheduling** — time-slice or exclusive assignment, queue for GPU access (already planned v2.2, Enterprise). Needs to become smarter: multi-GPU assignment, VRAM-aware scheduling, gang scheduling for distributed inference.

2. **Inference-specific metrics** — tokens/sec, request latency, VRAM utilization, model version, auto-restart on OOM. The research doc lists these but they're not in any decision yet.

3. **Model deployment workflow** — select model → provision VM → attach GPU → inject config → health check → serve endpoint. This is where bridge routing becomes critical: the bridge IS the inference load balancer. Multiple inference VMs behind a bridge, weights set by the AI based on latency/throughput.

4. **GPU passthrough beyond Firecracker** — Firecracker can't do it. QEMU/cloud-hypervisor can. This means either: (a) Weaver supports multiple hypervisor backends (already implied by the unified workload model, Decision #57), or (b) GPU workloads run as containers (Podman + NVIDIA toolkit), not MicroVMs.

5. **Multi-GPU / NVLink** — serious training and large model inference needs multi-GPU. VFIO can pass through multiple GPUs to one VM, but NVLink topology awareness matters. This is where it gets hard.

6. **Fleet-level inference routing** — and this is where the bridge question converges. At Fabrick scale, the "bridge" becomes an inference load balancer across hosts. Request comes in → Fabrick routes to the least-loaded inference VM across the fleet → bridge weights are fleet-level, not host-level. This is exactly the Fabrick bridge gap from the note above.

**The convergence**: the Fabrick-level bridge question and the ML platform question are the same question. Fleet-level bridge routing IS inference fleet routing. The bridge weight API extended to cross-node endpoints IS a model serving load balancer.

## 2026-03-28 · Claude
Fleet bridge design gap — **resolved.** All four questions from the earlier note answered in Decisions #114 and #115:

1. **Transport**: overlay (Decision #34) IS the fleet bridge transport — not separate concerns. VXLAN datacenter, WireGuard edge.
2. **Model**: fleet virtual bridge (option b) — per-host bridges are local ports on the fleet-wide logical bridge. Weight API unchanged in shape, elevated in scope.
3. **Fleet maintenance**: cordon = set endpoint weights to 0 on all fleet bridges. Traffic drains via weight management. No special mechanism.
4. **Fleet blue/green**: clone on any host → selector match → auto-register → shift weight. Operator chooses model version, not host.

Additional design resolved in the same session:
- **Fleet bridge ↔ workload group 1:1**: compliance boundary = network boundary (overlay segment isolation).
- **Multi-bridge**: many fleet bridges per hub, each with independent selector, policy, and overlay segment.
- **Endpoint lifecycle**: dynamic via LP. Selectors match workloads, not static VM lists.
- **State management (Decision #115)**: hub database = runtime authority; per-host last-known = DR store; cold start policy = baseline from hub config. Recovery: hosts continue on last-known → hub rebuilds → collects from hosts → reconciles → resumes.
- **Multi-vendor GPU (Decision #113)**: fleet bridges route to all three workload paths (QEMU GPU, Podman GPU, Firecracker CPU) identically. NVIDIA/AMD/Intel agnostic.

## 2026-03-28 · Mark
Why `agents/` stays at project root (not under `forge/`):

1. **`agents/` and `plans/` are a matched pair.** They mirror each other 1:1 by version — `plans/vX.Y.0/EXECUTION-ROADMAP.md` ↔ `agents/vX.Y.0/MANIFEST.md`. Moving agents under forge breaks that symmetry.

2. **`forge/` is infrastructure *about* Forge; `agents/` is content *consumed by* Forge.** forge/ holds machine state and sync metadata (STATUS.json, ASSESSMENT.md, DELIVERY.json, feed/). agents/ holds work definitions — what to build and how. Nesting content under its tooling directory implies the agents are Forge infrastructure rather than project deliverables.

3. **Three-level agent pattern stays clean.** `agents/<ver>/` (Forge task specs) at project root, `.claude/agents/` (orchestration), `code/.claude/agents/` (code execution). First level at root keeps it parallel with `plans/`, `business/`, etc.

Decision: `agents/` remains a top-level project directory.

## 2026-03-29 · Claude
Clean sweep session revealed systemic string literal drift: 589 bare vocabulary literals across 91 files survived the premium→weaver/enterprise→fabrick rename. The TUI `HostDetailView` premium check was completely broken (always returned false) because `TIER_ORDER['premium']` was undefined. The fix — shared `vocabularies.ts` constants + `audit:vocabulary` sync auditor — is now a template-level pattern. The deeper lesson: any value that crosses codebase boundaries (tier names, role names, status values) must be a typed constant, never a string literal. TypeScript can't catch a valid string that's the wrong string.

Separately: E2E specs coupled to navigation chrome (button selectors) broke silently when the Shed page replaced the "New" dropdown. Built `audit:e2e-selectors` to detect this class of drift — it found 2 additional stale selectors in `demo-mode.spec.ts` on its first run. Both auditors are now in the compliance chain (16 total) and the template.

## 2026-03-30 · Claude
During the investor readiness session, two pricing gaps surfaced that weren't visible from the feature/code perspective:

1. **FM quantity caps were missing on Solo and Team.** Fabrick had hard caps (20/10) but Solo and Team had only version windows. A viral launch could lock unlimited customers at FM rates. Now capped: Solo 200, Team 50 (Decision #121). The caps also serve as a GTM scarcity lever — "first 200" drives faster conversion than "until v1.2 ships."

2. **Fabrick capture rate doesn't improve across version milestones.** Decisions #113–#119 nearly tripled the value delivered at v3.0 (from ~$449K to ~$1M over 3 years), but the pricing steps didn't move. Capture rate stays flat at ~13% from v2.2 through v3.0. An investor sees this as "you don't know how to price your enterprise product." The version steps need to be bigger post-v2.0 — the TCO analysis now quantifies this gap, but the pricing decisions for v2.2 and v3.0 may need revisiting before the execution roadmaps are finalized.

## 2026-04-06 · Dev
**ToS gap: supported configuration clause.** The Terms of Service has a general "AS IS" warranty disclaimer but no explicit clause defining supported configurations. The deployment docs now state that support applies only to NixOS stable + documented requirements, but the ToS itself doesn't codify this. Legal review item for next release gate.

**BSL/paid tier protection: unsupported configuration liability.** For paid tiers (Solo/Team/Fabrick), we need stronger protection than just docs language. If a customer runs on unstable, breaks their system, and claims it's our fault, the ToS needs teeth. Two concerns:

1. **Configuration compliance verification** — we need a mechanism to verify at support time that the customer is running a supported configuration. Options: (a) system health endpoint that reports NixOS channel, Node.js version, and Nix store hash — support checks this before investigating; (b) license activation handshake that records the platform at activation time; (c) telemetry opt-in that reports configuration drift.

2. **Reproducibility as a support prerequisite** — for compliance-sensitive customers (defense, healthcare, finance), the inability to reproduce their environment is a support blocker. If they can't provide a reproducible flake lock, we can't diagnose. The ToS should state that support for compliance-related issues requires a reproducible build (flake.lock pinned to a stable channel).

Neither requires "call home" in the invasive sense — the health endpoint already exists (`/api/health`), and extending it to report NixOS channel + kernel version is a natural fit.

**Proof mechanism: Nix store hash verification.** Client-side reporting can't be trusted in a dispute — the user could modify health endpoint output or build a custom flake claiming stable. But Nix store paths are content-addressed: the same inputs always produce the same hash, and different inputs (e.g., unstable nixpkgs) produce a different hash. This is mathematically guaranteed, not trust-based.

Approach: (1) At release, publish the expected Nix store path hash for the Weaver package built against supported NixOS stable. (2) The health endpoint reports the actual store path of the running binary — this is immutable at runtime. (3) At license activation, the store path is recorded. Mismatch = "custom build" flag. (4) In a dispute, hash match = supported build, hash mismatch = custom build. No ambiguity.

This is the same verification model NixOS Hydra uses for all official packages. We'd be applying it at the product level. No call-home, no telemetry, no DRM — just the property of the build system we already use.

**Custom binary caches / self-built packages:** If the customer runs their own Nix binary cache and builds from source, they control the entire supply chain — hash verification is meaningless because they produce whatever hash they want. But this resolves itself: if they built it, they own it. Our support obligation is to *our* build (published hash, our inputs, our tested channel). Builds from modified source, custom flake inputs, or third-party binary caches are not covered. This is the same model as Red Hat (RHEL supported, CentOS rebuild not supported). The BSL-1.1 license grants the right to build from source, but modification voids the support guarantee. The ToS needs a "supported build" clause: "Support and warranty apply to the official Weaver package as built and distributed by whizBANG Developers. The Nix store path of the running installation is the definitive record of build provenance."

Decision needed before v1.1 (first paid tier ships at Solo): whether license activation *requires* a supported configuration check, or just *records* it for support triage.

## 2026-04-06 · Dev
**Reverse proxy should be automatic for Team and Fabrick tiers.** Solo is one host, one operator — manual nginx + ACME setup is acceptable. But Team (multi-host peer federation) and Fabrick (fleet) need TLS between nodes out of the box. Manual TLS config on every node is an adoption barrier, a compliance risk (one unconfigured node breaks fleet posture), and a competitive disadvantage (Proxmox auto-configures cluster TLS). The NixOS module should auto-provision nginx + ACME when tier is team/fabrick and a domain is configured. Solo stays manual. Implementation target: v2.2 (Team ships). Needs a MASTER-PLAN decision.

## 2026-04-09 · Claude
**Pitch deck sync — protected zones.** The `sync-deck.mjs` script syncs 21 zones (tables, speaker notes) from `PITCH-DECK.md` → `deck/index.html` via pre-commit hook. Slide 2's stat-cards ("What we think we have" / "What we actually have") are **protected zones** — custom HTML layout that can't be auto-generated from markdown. If those values change, both files need manual edits. Same applies to all stat-card blocks across the deck (ROI numbers, traction metrics, roadmap inflection points).

## 2026-04-09 · Claude
**nixpkgs version bump reminder (check ~2026-05-09).** Today we updated flake.nix from nixos-24.11 → 25.11 and fixed 16 files of drift. The `audit:nixos-version` auditor now catches this automatically. But the flake.lock `locked` rev was resolved via `nix flake update` against today's 25.11 channel — wait ~1 month, then re-run `nix flake update` to pick up a more mature 25.11 commit (the channel will have more packages tested by then). Also verify the NixOS ISO download URLs in `distro-catalog.json` actually resolve — 25.11 channel mirrors may not have ISOs available immediately.

## 2026-04-01 · Claude
Rolldown compatibility — `manualChunks` in `quasar.config.cjs` must be a function, not an object. Vite 5.4+ ships Rolldown as the bundler, and Rolldown rejects the Rollup-style object form (`{ chunkName: ['pkg1', 'pkg2'] }`). Fixed to a function that checks `id.includes(pkg)`. The build (`npx quasar build` and `VITE_DEMO_MODE=true npx quasar build`) was broken until this was corrected. Watch for this pattern if other Vite/Rollup config surfaces use the object form.

## 2026-04-09 · Dev
**NixOS uninstaller needed for testing.** We need an uninstall script that cleanly removes the Weaver NixOS module, systemd services, data directories, and user config — so testers can do full install → use → uninstall → reinstall cycles without rebuilding the host from scratch. Would also validate that the install is fully reversible, which is a selling point for the "no risk" migration story.

## 2026-04-10 · Claude
**Code protection — per-tier repo distribution architecture.** Dev repo is the single source of truth. Each tier gets its own repo synced from dev with different exclusion rules. Free repo is public AGPL (source-available). All BSL tiers (Solo/Team/FabricK) ship as sealed binaries — no source in any paid distribution. Full detail in `plans/cross-version/DISTRIBUTION-ARCHITECTURE-STRATEGY.md`; v1.4.0 release gate in `forge/STATUS.json`.


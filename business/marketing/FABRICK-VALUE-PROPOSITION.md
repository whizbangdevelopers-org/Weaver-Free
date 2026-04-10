<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Fabrick Value Proposition — Why Pay $299+/yr for Weaver?

**Date:** 2026-03-04 | **Updated:** 2026-03-18
**Purpose:** Justify enterprise pricing against incumbent systems.

---

## Recent Changes

_Delete this section once pricing decisions are finalized._

- **2026-03-18** — Fabrick pricing raised from $799 to $2,000/yr first node (Decision #63). Fabrick tier added at $2,500/yr, 512GB RAM (Decision #64). Contract tier added for 512GB+ (Decision #65). "No NixOS expertise required" and parallel migration added as primary pitch lead. Blended enterprise ARPU revised from $17,475 to $26,000/yr.
- **2026-03-04** — Extracted bellwether matrix, 18×7 feature comparison, and gap analysis to [fabrick-bellwether-matrix.md](../../research/fabrick-bellwether-matrix.md). Conclusions retained inline; raw data now updated independently.
- **2026-03-04** — Added Fabrick Success Programs (Adopt/Accelerate/Partner) and Professional Services revenue streams. Blended enterprise ARPU revised to $17,475/yr.

---

## The Real Pitch — Zero Expertise Required

You are not selling a NixOS tool. You are selling the security and reproducibility benefits of NixOS to buyers who will never touch NixOS. The technology stack is an implementation detail. The pitch is:

- **Zero expertise required** — ever. No Nix, no `nixos-rebuild switch`, no Nix language.
- **Run alongside their existing stack** — Docker, Proxmox, VMware, bare-metal — all co-exist.
- **Migrate one workload at a time** — no big-bang cutover, no downtime risk.
- **They get kernel-level isolation and declarative reproducibility without knowing why.**

NixOS should never come up in the initial enterprise sales conversation. The champion brings Weaver to their employer as "a VM management tool that runs alongside what we already have" — not as a NixOS project, which triggers skepticism from management.

**The parallel migration capability alone is worth the repricing.** Unlike VMware → Proxmox ($50K–200K, 3–12 months) or VMware → Cloud ($100K–500K+, 6–18 months), Weaver runs alongside existing infrastructure. Migration cost: $5,000–20,000. Timeline: 1–3 months. No cutover event. The adoption risk is near-zero, which is why the enterprise champion's internal case is easy to make.

---

## Feature Vocabulary

| Term | Definition |
|------|-----------|
| **Live Provisioning** | Creating and managing VMs dynamically via the dashboard API — without running `nixos-rebuild switch` on the host. One-time NixOS setup (bridge + sudo rules + service), then zero host rebuilds forever. VMs are spawned as QEMU processes with cloud-init, persisted to disk, and auto-restarted on boot via the registry. This is the core Weaver/Fabrick differentiator. |

---

## The Fabrick Customer's Current World

### What They're Running Today

| Incumbent | Annual Cost | Pain Points |
|-----------|:----------:|-------------|
| **VMware vSphere/vCenter** | $5,000–50,000+/yr (Broadcom subscription, 72-core min) | 350–1,050% price increases post-acquisition, subscription-only, perpetual licenses eliminated |
| **Proxmox VE** | €355–1,060/yr/socket × N sockets | Per-socket pricing (2-socket = 2×), Debian-only, imperative management, no declarative config |
| **Red Hat Virtualization** | $5,000–15,000/yr (RHEL subscriptions) | End-of-life, migration forced, no declarative model |
| **Hyper-V** | $500–6,000/yr (Windows Server licensing) | Windows-only host, no declarative, no NixOS |
| **Cloud VMs (AWS/GCP/Azure)** | $600–6,000+/yr per VM | Ongoing OpEx, vendor lock-in, no self-hosting |
| **Incus/LXD** | $0 (software) + staff time | No dashboard for NixOS, separate config system from Nix |
| **Manual (systemctl + SSH)** | $0 (software) + significant staff time | No visibility, no audit trail, error-prone, no governance |
| **Harvester** (SUSE HCI) | $0 (software) + Kubernetes expertise cost | VMs + containers on Kubernetes control plane — requires k8s skills, YAML-heavy, no declarative config. *(Becomes a competitor at v2.x clustering)* |
| **KubeVirt** | $0 (software) + significant k8s expertise | VMs running inside Kubernetes — maximum complexity, no NixOS-native path. *(Philosophical opposite: "put VMs in k8s" vs "skip k8s entirely")* |

### What Migration Costs Them

| Migration Path | Typical Cost | Timeline |
|----------------|:----------:|:--------:|
| VMware → Proxmox | $50,000–200,000 (consulting + downtime) | 3–12 months |
| VMware → Cloud | $100,000–500,000+ (migration + first year) | 6–18 months |
| VMware → Kubernetes (Harvester) | $100,000–300,000 (K8s expertise + infra) | 6–12 months |
| VMware → NixOS + Weaver | **$5,000–20,000** (NixOS training + our migration tools) | **1–3 months** |

---

## Explicit Fabrick Advantages (Over Non-Nix Systems)

### 1. Zero Configuration Drift — Impossible, Not Just Unlikely

| Capability | Weaver | VMware | Proxmox | Cloud VMs |
|-----------|:-:|:-:|:-:|:-:|
| **Config drift impossible** | **Yes** — Nix rebuilds from source every time | No — manual changes accumulate | No — imperative management | No — AMIs diverge from launch configs |
| **Bit-for-bit reproducible builds** | **Yes** — Nix hash-verified | No | No | No |
| **VM config in version control** | **Native** — it's Nix code | Bolt-on (Terraform) | Bolt-on (Terraform) | Bolt-on (Terraform/Pulumi) |
| **Rollback is one command** | **Yes** — `nixos-rebuild --rollback` | Snapshot restore (if taken) | Snapshot restore (if taken) | Redeploy from previous AMI |
| **CI-testable VM configs** | **Yes** — `nixos-test` in CI | No equivalent | No equivalent | Limited (Packer validate) |

**Enterprise value:** Every compliance framework (SOC 2, ISO 27001, HIPAA) requires demonstrating configuration management. NixOS provides this **by construction** — not by process, not by tooling bolted on after the fact, but by the fundamental architecture. An auditor can verify that the running system matches the declared config because Nix makes it mathematically impossible for them to diverge.

### 2. Declarative Infrastructure as Audit Trail

Every VM change is a git commit. Every git commit has:
- Who changed it (git author)
- When (timestamp)
- What changed (diff)
- Why (commit message)
- Approval (PR review)

**No other virtualization platform provides this natively.** Proxmox, VMware, and cloud providers all require separate audit logging that captures API calls — not intent. A git diff shows "added firewall rule to allow port 443 for the new web tier" while a VMware audit log shows "API call: ReconfigVM_Task."

### 3. Sub-Second VM Boot (Firecracker)

| Platform | Fastest VM Boot | Use Case Unlocked |
|----------|:-:|---|
| **Weaver (Firecracker)** | **<125ms** | Ephemeral workloads, serverless-style VMs, on-demand dev environments |
| Proxmox (KVM/QEMU) | 5–30 seconds | Traditional long-running VMs only |
| VMware (ESXi) | 10–60 seconds | Traditional long-running VMs only |
| Cloud (EC2/GCE) | 30–90 seconds | Traditional long-running VMs only |

**Enterprise value:** Enables workload patterns impossible on any other platform — spin up a VM for a CI job, run it, destroy it in under 1 second. This is AWS Lambda's model but running on your own hardware with your own security boundary.

### 4. Live Provisioning — Zero Host Rebuilds

This is the architectural breakthrough. Traditional NixOS VM management requires editing `configuration.nix` and running `nixos-rebuild switch` for every VM change — a slow, risky operation that requires NixOS expertise and causes brief service interruptions.

**Live Provisioning eliminates this entirely for workload VMs:**

| Step | Traditional NixOS | Live Provisioning |
|------|:-:|:-:|
| Define VM | Edit `configuration.nix` | API call or dashboard UI |
| Deploy VM | `nixos-rebuild switch` (30–120s, service restart) | QEMU spawned directly + cloud-init (<10s) |
| NixOS expertise required | **Yes** — Nix language, module system | **No** — click "Create VM" |
| Risk to other VMs during deploy | **Yes** — rebuild touches entire system config | **None** — isolated process spawn |
| Survive host reboot | Via NixOS config (declarative) | Via dashboard registry + autostart (automatic) |

**How it works:** The dashboard spawns QEMU processes directly with cloud-init configuration, persists VM definitions to a JSON/SQLite registry, and auto-restarts VMs with `autostart: true` on service boot. The host NixOS config is set up once (bridge, sudo rules, service) and never touched again.

**Enterprise value:** Operations teams can provision VMs without NixOS expertise. Dev teams get self-service VM creation. No change management process needed for workload VMs. The host OS remains immutable and untouched — exactly what compliance teams want.

**No other NixOS management tool does this.** Everyone else requires `nixos-rebuild switch`. This is a category-defining capability.

### 5. Multi-Hypervisor from One Interface

No other tool manages QEMU, Cloud Hypervisor, crosvm, kvmtool, AND Firecracker. Enterprises can:
- Use Firecracker for ephemeral workloads (speed)
- Use QEMU for Windows guests (compatibility)
- Use Cloud Hypervisor for production Linux (performance)
- All managed from the same UI, same API, same audit log

### 6. Container + VM Unified Management (v1.2+)

Post-v1.2 "The Closer," Weaver manages VMs AND containers (Apptainer, Docker, Podman) from one pane. The enterprise pitch:

> "The only dashboard that manages your MicroVMs, Apptainer instances, and Docker containers from a single pane — with AI-powered diagnostics across all of them."

**HPC/Research angle:** Apptainer (formerly Singularity) is the standard at universities, national labs, and pharma. No competing dashboard exists for these institutions. They have budget (research grants include tooling line items) and NixOS adoption is growing in this segment.

### 7. AI-Powered Infrastructure Diagnostics

No competing VM management platform has AI built in. The agent can:
- Diagnose why a VM won't start
- Analyze resource contention across VMs
- Suggest configuration improvements
- Cross-resource diagnostics between VMs and containers (v1.4+)

**Built-in AI infrastructure protection:** Every AI agent request consumes real resources — API tokens for cloud providers (Anthropic, OpenAI), GPU compute for self-hosted model servers (vLLM, TGI), or host CPU/RAM for local models (Ollama). Weaver enforces per-user rate limits at every tier (Free 5/min, Solo/Team 10/min, Fabrick 30/min) to protect AI infrastructure regardless of deployment model. No competing platform does this (Decision #128). Weaver Team introduces per-user configurable AI rate limits — admins set individual ceilings based on role or budget. Fabrick extends this fleet-wide: per-user configurable limits across all nodes, policy routing (assign AI provider per department/server/role), and audit of all AI interactions.

### 8. Integrated Secrets Management (v1.5.0)

> *"Weaver enables integrated secrets management for your workload platform."*

No competitor — including Proxmox — has native credential management embedded in the workload manager.

**What ships at Fabrick:**
- **Full credential vault** — AI credentials (frontier + application-specific) and general workload secrets (DB passwords, service tokens, arbitrary credentials) stored in SQLCipher-encrypted store, never exposed after write
- **Secrets injection** — credentials injected into workloads at boot as environment variables or files; no plaintext in config
- **Per-workload assignment** — admin assigns a credential from the vault pool to specific workloads; users cannot see or override; bulk assignment by tag for fleet-wide enforcement
- **Credential audit trail** — every assignment, rotation, and injection logged with admin identity and timestamp
- **Admin-only at every tier** — no delegation, single accountability point; satisfies HIPAA, CMMC Level 2, SOC 2, PCI DSS credential management requirements
- **HashiCorp Vault integration (Fabrick)** — for organizations that already run Vault: inject secrets from an existing Vault instance into any Weaver workload at provision. No migration required; Weaver becomes the orchestration layer above Vault, not a replacement. This is the correct pitch for enterprise security teams who already have mature secrets infrastructure.

**Vault architecture (built-in):** SQLCipher encrypted store + sops-nix master key (provisioned once at host setup). All runtime operations — add, rotate, delete, assign — go through the admin API with no `nixos-rebuild switch`. Live Provisioning compliant.

**Two modes:** (a) Built-in vault for organizations without existing secrets management. (b) Vault integration for organizations that already have HashiCorp Vault. Do not pitch the built-in vault as a Vault replacement to enterprise security teams — pitch Vault integration as the reason to buy.

**Fabrick (v3.0):** vault federation across the fleet — one credential, all hosts, centrally managed.

### 9. Fleet-Scale AI Threat Response (Project Glasswing)

In April 2026, Anthropic's Project Glasswing demonstrated that AI-powered vulnerability discovery can find thousands of zero-days — including bugs that survived decades of human review. With $100M in credits committed and a 90-day public disclosure cycle, the volume of actionable vulnerability disclosures is about to increase dramatically. *"AI cyber capabilities at this level will proliferate over the coming months, and not every actor who gets access to them will be focused on defense."*

Fabrick is the fleet-scale answer to this threat:

**Colmena fleet deploy = deterministic fleet patching.** A Glasswing-class disclosure drops. `colmena apply` pushes the patched NixOS config to every node in the fleet in a single operation. Every node gets the identical patch — bit-for-bit reproducible, no drift, no "we think host 14 got the update." The patch is a git commit; the fleet deployment is atomic. No competing fleet management tool provides this guarantee.

**Fleet-wide config sync = no node left behind.** Fabrick's config synchronization ensures every node in the fleet runs the same declared state. A vulnerability patch applied at the hub propagates to all nodes. There is no window where some nodes are patched and others are not — the state machine enforces convergence. Compare this to Proxmox Datacenter Manager or Rancher, where per-node drift is possible and verification requires separate tooling.

**Smart Bridges health routing = automatic compromise isolation.** When a node's health check fails after a suspected exploit, Smart Bridges shifts traffic away from the affected node automatically — no human intervention required. The bridge weight API drains in-flight connections and routes to healthy nodes while the compromised host is investigated and remediated. This is the fleet equivalent of hardware isolation: even if a zero-day breaches one node, the fleet continues operating.

**Compliance Export = provable fleet posture.** After patching, Compliance Export generates evidence across all 8 regulatory frameworks (CMMC, HIPAA, SOC 2, PCI-DSS, ITAR, SOX, FERPA, GxP) proving the fleet is patched. The auditor gets a report showing every node, the patch commit, the deployment timestamp, and the health check result. No manual evidence collection. No spreadsheets.

**The pitch:** "AI just industrialized zero-day discovery. Fabrick gives you one-command fleet patching, automatic traffic isolation from compromised nodes, and compliance evidence that proves you responded — across every host, every framework, every audit."

### 10. Migration Tooling (v1.6)

**Proxmox `.conf` parser → Nix generation**
**Libvirt XML parser → Nix generation**
**Dockerfile parser → dual output (Nix VM OR Apptainer SIF)**

This is the conversion path. An enterprise running 50 Proxmox VMs can:
1. Point the import tool at their Proxmox configs
2. Get generated Nix definitions
3. Review and customize in the template editor
4. Deploy via the pipeline

**No other platform offers intent-based migration.** Everyone else copies disk images (state). We generate declarative configs (intent).

#### Docker → MicroVM Migration: A Three-Act Story

The migration pitch is different at each tier. The efficiency argument is not the same at all scales — and overselling it loses credibility.

**The honest framing:** Docker containers share the host kernel and start faster with lower per-workload overhead. MicroVMs have a small hypervisor tax (~5MB RAM per Firecracker instance). Do not pitch MicroVMs as "more efficient than Docker" in raw compute terms. The wins are isolation, security, declarative reproducibility, and — at enterprise scale — *operational* efficiency.

| Scale | Migration Pitch | Primary Win |
|-------|----------------|-------------|
| **Weaver Weaver Free/Weaver** | "Migrate security-sensitive containers to MicroVMs for true kernel isolation — no shared kernel, no container escape risk." | Security boundary |
| **Fabrick v1.x** | "Migrate fleet workloads to NixOS + MicroVMs: precise resource accounting for chargebacks, declarative config for compliance, Colmena fleet management replaces Kubernetes operations overhead." | Operational efficiency |
| **Fabrick v2.x+** | "Replace Kubernetes with Grouped MicroVMs — VM-level isolation with independent deployment, zero service mesh complexity, NixOS declarative config eliminates drift." | Kubernetes elimination |

**The surgical approach (Weaver Weaver Free/Weaver):** Don't migrate everything. The dashboard identifies which containers handle sensitive data and suggests: "These 3 of your 12 containers should be MicroVMs — full kernel isolation, no shared kernel attack surface. The other 9 stay as `oci-containers`." This is a more credible pitch than wholesale migration.

**The enterprise efficiency inversion:** At scale, the compute overhead of MicroVMs (~5MB RAM per Firecracker VM) is a rounding error against what enterprises spend managing Docker+Kubernetes:
- Platform team to operate the Kubernetes control plane
- Service mesh complexity (Istio, Linkerd) for inter-service communication
- Distributed tracing and observability tooling to compensate for microservice opacity
- Rolling upgrades, pod disruption budgets, namespace management

Colmena + NixOS + Weaver replaces all of this. The same `makeMicroVM` factory function that provisions one VM provisions 500. Config changes roll out fleet-wide from a single git commit. No platform team required.

**The Kubernetes replacement angle** connects directly to the microservices backlash: many enterprises are discovering that the operational overhead of microservices + Kubernetes exceeds the architectural benefits. Grouped MicroVMs are the middle path — VM-level isolation + independent deployment (microservice benefits) without Kubernetes/service-mesh complexity (microservice pain). NixOS declarative config eliminates drift — the #1 operational complaint about microservices. Positioning: "microservices benefits, no orchestration tax."

### 11. Kubernetes Competitive Horizon (v2.x+)

Weaver does not compete with Kubernetes today (v1.x). The overlap emerges at v2.0 clustering and becomes a direct competitive story by v2.x+ when Grouped MicroVMs position as a Kubernetes alternative for workloads that don't require container orchestration at scale.

| Kubernetes Product | What It Does | When We Compete | Our Differentiation |
|-------------------|-------------|----------------|---------------------|
| **Kubernetes (k8s)** | Container orchestration across clusters | v2.x+ (Grouped MicroVMs story) | No platform team required. NixOS replaces YAML + operators + service mesh. VM-level isolation without Kubernetes complexity. |
| **k3s** (Rancher/SUSE) | Lightweight k8s for edge/small clusters | v2.x+ (edge play) | We manage NixOS MicroVMs at the edge — NOT generic containers. Explicit scope boundary: NixOS-scoped, not a k3s replacement. |
| **Harvester** (SUSE HCI) | VMs + containers on Kubernetes | v2.0+ (clustering ships) | Same "unified VM + container" story. They use Kubernetes control plane + YAML. We use NixOS declarative config. No k8s expertise required. |
| **KubeVirt** | VMs inside Kubernetes clusters | v2.x+ | Philosophical opposite. KubeVirt adds VM complexity to k8s. We eliminate k8s entirely for NixOS workloads. |
| **OpenShift** (Red Hat) | Enterprise Kubernetes platform | v3.0+ (Fabrick platform) | Price anchor: OpenShift $3K+/node/yr. Fabrick $2,000/yr first node. NixOS declarative config vs YAML + Operators + OLM. |
| **Rancher** (SUSE) | Kubernetes management platform | v3.0+ (Fabrick platform) | Rancher manages k8s clusters. Fabrick manages NixOS infrastructure. Different control plane philosophy. |

**The "why not Kubernetes?" answer for every enterprise prospect:**
> "Kubernetes requires mastering YAML, operators, service mesh, namespaces, and RBAC — plus a platform team to run the control plane. NixOS requires mastering Nix. For the NixOS-native stack, Colmena + Weaver handles fleet orchestration with a single declarative config language. No platform team, no service mesh, no drift."

**Bridge convergence — three K8s components become one:** in K8s you maintain a CNI plugin (network switching) + ingress controller + MetalLB (load balancing) + Argo Rollouts or Spinnaker (blue/green control) as separate components with separate upgrade cycles and failure modes. In Weaver, the bridge does all three — already deployed from v1.0, no separate nodes, no separate software. Active routing (Decision #112) adds one capability and collapses the entire stack. *"We didn't add a load balancer. We realized the bridge already was one."*

**Blue/green without kubectl:** the most common K8s deployment pattern — blue/green rolling updates — works in Weaver without a cluster. The bridge is the load balancer, blue and green are two VM instances, and the AI manages the traffic weight shift, health check, and rollback decision instead of a human running kubectl commands. Same mental model as K8s blue/green or AWS Elastic Beanstalk environment swaps, at the MicroVM level. The VM clone is an LP API call — no `nixos-rebuild`, Firecracker boots in seconds — so the pre-provision → standby → shift cycle is tight enough to be operationally useful (the same pre-provisioning lifecycle as Decision #95, triggered by a deployment decision instead of a metric). Ships v1.4.0 (Solo AI-assisted) / v2.2.0 (Team workflow with approval gates). Use this in conversations with engineers who know K8s: "You already understand this pattern — Weaver just removes the cluster tax."

**Fleet inference routing (v3.0+):** At Fabrick scale, bridge routing elevates to cross-node traffic management. The bridge weight API addresses endpoints on remote hosts — Fabrick coordinates per-host bridges as one fleet-level inference load balancer. Request arrives → Fabrick routes to the least-loaded inference VM across the fleet → AI agent adjusts weights based on latency/throughput. Fleet blue/green: roll out a new model version across 10 hosts with per-host blue/green, coordinated at fleet level. Fleet maintenance: node cordon (drain inference traffic to peer hosts) → Path B rebuild → uncordon — zero model downtime. This is what a K8s ingress controller + Argo Rollouts does across a cluster, except Fabrick does it across NixOS hosts with hardware-isolated VMs instead of namespaced pods. The bridge is the fleet inference gateway.

**Snapshot-based model provisioning — "Build once, run many":** First model deployment is slow (pull weights, load into VRAM — minutes). Weaver auto-snapshots the running VM after health check. Every subsequent deployment restores from snapshot: 2–5 seconds (QEMU memory snapshot, model already in VRAM). Deploy one model to 10 fleet hosts in seconds — every instance identical. Rollback is instant (restore previous version's snapshot). This makes inference auto-scaling viable at scale: set point triggers → snapshot restore → serving in seconds, not minutes. Fleet scheduling prefers hosts with cached snapshots. Sales line: *"Build once, run many. 2-second model deployment across your fleet."*

**Not just AI:** GPU passthrough and bridge routing serve any GPU-intensive or multi-instance workload — HPC simulation, 3D rendering, VDI session balancing, video transcoding, scientific computing. The AI inference market is the highest-growth positioning angle, but the underlying infrastructure is general-purpose.

**Edge scope boundary** (explicit, per v1.3+ roadmap): The nixos-anywhere + microvm.nix edge pattern is NixOS-scoped only — immutable, zero-drift NixOS MicroVMs at the edge with atomic rollbacks. This is not a k3s or SNO replacement for generic container workloads. Hold this boundary; competing with k3s for generic containers would dilute the NixOS positioning.

### 12. Integrated Extensions for Fabrick Needs

| Need | Current Incumbent Solution | Weaver Plugin |
|------|--------------------------|------------------------|
| DNS management | Separate DNS server + manual config | DNS plugin (CoreDNS, auto-zone, `.vm.internal`) |
| Firewall rules | Separate firewall + manual config | Firewall plugin (nftables, zone-based, drift detection) |
| MFA | Separate identity provider | Auth plugins (TOTP $3, FIDO2 Weaver, SSO/LDAP Fabrick) |
| Hardening | Manual AppArmor/SELinux config | Hardening plugins (AppArmor, Seccomp, kernel) |
| Backup | Separate backup solution | Backup plugins (scheduled, remote targets, encryption) |

**Fabrick gets all plugins included.** Weaver customers buy à la carte.

---

## Two-Track Pricing Strategy

Weaver and Fabrick serve different buyers with different competitive anchors.

### Weaver: "We're cheaper — and better"

Weaver at $249/yr solo standard (post-v1.2) / $199/user/yr team standard (post-v2.2) is 35% below Proxmox Community (€355/yr/socket) with significantly more features (Live Provisioning, multi-hypervisor, AI diagnostics). FM price ($149/yr) is below Proxmox Basic (€115/yr). The pitch is "better, at a competitive price" — not racing to the bottom. Prices step up as major versions ship, justified by delivered value at each milestone.

### Fabrick: "We compete on features, not price"

Fabrick buyers evaluate infrastructure management platforms ($10K–200K/yr). Against this field, $2,000/yr/node (raised from $799 founding-member rate) is competitive without triggering "why so cheap?" skepticism. Canonical validates per-node pricing at $500–2,500.

**6 unique wins:** Live Provisioning, 5-hypervisor breadth, sub-second VM boot (<125ms), declarative compliance by construction, git-native audit trail, vendor-agnostic GPU management (NVIDIA/AMD/Intel via VFIO-PCI — no GPU vendor lock-in, Decision #113).

**7 real gaps:** HA/clustering (v2.2–3.0), edge (v3.0 — see below), containers (v1.2), migration (v1.4–1.5), backup (v1.6+), bare metal (N/A — NixOS handles), plugin maturity (v1.1+).

**Edge computing** ($22B software segment, 37% CAGR): The microvm-anywhere pattern — nixos-anywhere + microvm.nix + disko + impermanence — is the implementation path. Same `makeMicroVM` factory function that provisions datacenter VMs can deploy/reprovision NixOS microVMs on remote edge nodes over SSH. Impermanence gives boot-clean resilience for unreliable edge environments (power loss, tampering). `fleet-deploy.sh` orchestrates across distributed edge nodes. NixOS-scoped: not competing with K3s/SNO for generic containers — managing immutable, zero-drift NixOS microVMs at the edge with atomic rollbacks. Extension of multi-node architecture (v2.2+) with lightweight agent. See [microvm-anywhere-nix-templates.md](../../research/microvm-anywhere-nix-templates.md) for the template patterns.

Full bellwether pricing, 18×7 feature matrix, and gap analysis: [fabrick-bellwether-matrix.md](../../research/fabrick-bellwether-matrix.md)

### Pricing Structure

**Software Licenses:**

| Tier | RAM | FM Price (forever) | Standard v1.0–v2.1 | Standard v2.2+ | Standard v3.0+ |
|------|:---:|:-----------------:|:------------------:|:--------------:|:--------------:|
| **Weaver Solo** | 128GB | **$149/yr (FM, first 200)** | $149/yr | **$249/yr** | **$299/yr** |
| **Weaver Team** | 128GB/host | **$129/user/yr (FM, first 50 teams)** | N/A | **$199/user/yr** | $199/user/yr |
| **Fabrick (1st node)** | 256GB | **$1,299/yr** | $2,000/yr | **$2,000/yr** | **$3,500/yr** |
| **Fabrick (add'l nodes)** | 256GB | **$1,299/yr** | $1,250/yr | **$1,000/yr** | **$1,750/yr** |
| **Fabrick (add'l nodes, 10+ fleet)** | 256GB | **$1,299/yr** | $750/yr | **$700/yr** | **$1,750/yr** |
| **Fabrick 10-node total** | — | **$12,990/yr** | $12,750/yr | **$10,700/yr** | **$19,250/yr** |
| **Fabrick** | 512GB | **$1,750/yr** | $2,500/yr | **$3,000/yr** | **$3,500/yr** |
| **Contract (512GB+)** | Per block | — | $2,000→$1,250/block | — | — |

Standard prices increase as major versions ship and the product delivers the capability that justifies the price. Existing customers renew at their purchase price — step-ups apply to new customers only. FM buyers are grandfathered forever at the FM price. See [FOUNDING-MEMBER-PROGRAM.md](FOUNDING-MEMBER-PROGRAM.md) and [PRICING-POWER-ANALYSIS.md](PRICING-POWER-ANALYSIS.md).

**Contract Tier Block Pricing (512GB+ deployments — cloud and self-hosted):**

| Block | RAM Range | Annual Price | Discount vs E+ |
|---|---|---|---|
| Block 1 | 513GB–1TB | $2,000/yr | 20% |
| Blocks 2–3 | 1TB–2TB | $1,750/yr each | 30% |
| Blocks 4–7 | 2TB–4TB | $1,500/yr each | 40% |
| Blocks 8+ | 4TB+ | $1,250/yr each | 50% |
| Custom | >8TB | Negotiated floor | — |

*Fabrick base license required. AI/HPC example: AWS p4d.24xlarge (1.1TB) = $2,500 + $2,000 = $4,500/yr against ~$280K/yr cloud cost.*

**Fabrick Success Programs** (not break-fix — adoption partnership):

We design support out of the product (declarative, zero-drift, self-healing). What enterprises pay for is NixOS adoption guidance, fleet architecture, integration, and compliance mapping. Competitors charge $30K–200K for break-fix. We charge for success.

| Program | FM Price | Standard Price | Response SLA | What You Get |
|---------|:--------:|:--------------:|:-----------:|-------------|
| Community (included) | $0 | $0 | Best effort | GitHub issues, docs, community forum |
| Adopt | $5,000/yr | $15,000/yr | 24h (business days) | Onboarding, NixOS adoption playbook, email/chat |
| Adopt — Compliance | — | $25,000/yr | 24h (business days) | Everything in Adopt + compliance framework mapping session, evidence walkthroughs, BAA/SSP/ATO documentation (vertical-specific). See vertical sales docs for domain content. |
| Accelerate | $15,000/yr | $45,000/yr | 4h (24/7) | Dedicated Slack, fleet architecture reviews, integration help, compliance mapping |
| Partner | $30,000/yr | $90,000/yr | 1h (24/7) | Named engineer, roadmap influence, priority features, annual on-site |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = $9,000/yr total compliance coverage during the FM period. Standard Adopt — Compliance ($25,000/yr) includes hands-on compliance service delivery not covered by the extension alone.

**Professional Services (one-time):**

| Service | Price Range |
|---------|:----------:|
| Migration assistance (Proxmox/VMware/libvirt → NixOS) | $5,000–20,000 |
| Fleet architecture design | $2,000–5,000/day |
| NixOS adoption training (2-day intensive) | $3,000–5,000/cohort |
| Custom plugin development | $5,000–15,000 |

**Total enterprise contract value (realistic scenarios):**

| Scenario | Nodes | Software | Success Program | Services (Y1) | **Recurring/yr** |
|----------|:-----:|:-------:|:--------------:|:-------------:|:----------------:|
| Small enterprise | 10 | $8,000/yr | $5,000/yr (Adopt FM) | $5,000 | **$13,000** |
| Mid enterprise | 30 | $18,000/yr | $15,000/yr (Accelerate FM) | $10,000 | **$33,000** |
| Large enterprise | 100 | $53,000/yr | $30,000/yr (Partner FM) | $20,000 | **$83,000** |

**Blended enterprise ARPU** (60% small / 30% mid / 10% large): **$26,000/yr recurring**. Competitive with Spectro Cloud ($30K+) and Canonical ($5K–250K). At 100 enterprise customers: **$2.6M/yr** recurring. This funds the SaaS platform, AI infrastructure, and the portfolio.

**Principle:** Software is the entry point. Adoption partnership is the relationship revenue. Competitors bundle break-fix into opaque pricing. We break it out transparently — and the value prop is stronger because customers are paying for expertise, not for us to fix our own bugs.

**Principle:** You can always discount. You can't easily raise prices on existing customers. The Founding Member program formalizes this: FM Fabrick at $1,299/yr is explicitly time-limited (first 20 customers, closes at v2.2). Standard market price is $2,000/yr for new customers post-cap (v2.2+). FM customers are grandfathered; their price never changes. New customers after the window closes pay standard. This is the right structure: early believers get rewarded, the market price is set at what the full product justifies. See [FOUNDING-MEMBER-PROGRAM.md](FOUNDING-MEMBER-PROGRAM.md).

---

## Cloud SaaS Path (Post-v3.0)

### Architecture (Already Designed in BUSINESS-MARKETING-ANALYSIS.md)

```
┌──────────────────┐         ┌─────────────────────────┐
│  User's browser  │ ←─────→ │  Weaver      │
│                  │  HTTPS   │  Cloud (SaaS)           │
└──────────────────┘         │                         │
                             │  - Weaver UI            │
                             │  - Customer Portal      │
                             │  - Billing (Stripe)     │
                             │  - Extension Marketplace │
                             └────────┬────────────────┘
                                      │ Secure tunnel
                                      │ (WireGuard/Agent)
                             ┌────────▼────────────────┐
                             │  Customer's NixOS host(s)│
                             │  weaver-agent │
                             │  (lightweight daemon)    │
                             └─────────────────────────┘
```

### What's Needed for SaaS (Post-v3.0 Software)

| Component | Source | Status |
|-----------|--------|--------|
| Weaver UI | Weaver (exists) | **Done** |
| Multi-host management | v2.2 Basic Clustering | **Planned** |
| HA + live migration | v3.0 Advanced Clustering | **Planned** |
| Agent daemon for customer hosts | New component | **Not started** |
| Customer portal (account, billing, keys) | New component | **Not started** |
| Stripe billing integration | New component | **Not started** |
| Extension marketplace | New component | **Not started** |
| Multi-tenant infrastructure | New component | **Not started** |

### The Portfolio Pipeline

```
NOW                    Q3-Q4 2026              2027                    2027+
 │                        │                      │                      │
 ▼                        ▼                      ▼                      ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   ┌────────────────┐
│ Weaver       │   │ Weaver       │   │ Customer Portal  │   │ Full SaaS      │
│              │   │              │   │ + Billing        │   │ Platform       │
│ v1.0→v3.0   │   │ v3.0 +       │   │ (standalone)     │   │                │
│              │   │ Agent daemon │   │                  │   │ Weaver +       │
│ Self-hosted  │   │              │   │ Shared across:   │   │ Portal +       │
│ product      │   │ SaaS-ready   │   │ - MicroVM Dash   │   │ Marketplace +  │
└──────┬───────┘   │ backend      │   │ - Gantry         │   │ Agent          │
       │           └──────────────┘   │ - Accounting ERP │   │                │
       │                              │ - Forge           │   └────────────────┘
       │                              └──────────────────┘
       │                                       │
       │           ┌──────────────┐            │
       │           │ Gantry       │            │
       ├──────────→│ (project     │────────────┘
       │           │  planning)   │    Uses same portal/billing
       │           └──────────────┘
       │
       │           ┌──────────────┐
       ├──────────→│ Accounting   │────────────── Uses same portal/billing
       │           │ ERP          │    Same Quasar+Fastify stack
       │           └──────────────┘    Same tier model pattern
       │
       │           ┌──────────────┐
       └──────────→│ Forge        │────────────── The meta-product
                   │ (autonomous  │    Builds all the other products
                   │  dev pipeline│    Sellable as a service/platform
                   └──────────────┘
```

### Why This Order Matters

1. **Weaver first** — proves the stack, establishes the tier/plugin model, builds community
2. **Gantry second** — leverages the same template, same tooling, same Forge pipeline. Gantry itself can plan the development of all three products (eating its own dog food)
3. **Accounting ERP third** — heaviest lift (double-entry, multi-currency, permissions), but the hardest to compete with. Uses the same Quasar+Fastify+Drizzle stack, same tier model, same agent patterns
4. **Forge is the meta-product** — the autonomous agent-driven development pipeline that builds everything else. Currently being built on `foundry`. Has three potential monetization paths:
   - **Internal force multiplier** — 2 founders ship at the velocity of a 10-person team
   - **Productized service** — "Forge as a Service" for other teams wanting autonomous CI/agent pipelines
   - **Template marketplace** — the `quasar-project-template` + Forge knowledge loop becomes a sellable accelerator
5. **Customer Portal is the shared layer** — built once, serves all products. Stripe billing, license key management, plugin marketplace. This is where the SaaS business actually lives

### Forge: The Competitive Moat Nobody Can See

The Forge isn't just a build system — it's the reason two founders can ship a product portfolio that would normally require 20+ engineers. Here's what it provides:

| Capability | What It Does | Competitive Effect |
|-----------|-------------|-------------------|
| **Agent-driven development** | Claude Code agents execute structured work orders autonomously | 5–10x development velocity |
| **Knowledge extraction loop** | Every project release extracts generalized lessons back to `quasar-project-template` | Each new project starts smarter than the last |
| **Template feed system** | Template updates propagate as delta patches to all running projects | Cross-project improvements happen automatically |
| **Automated compliance** | 8+ auditors run on every push (forms, routes, tiers, legal, parity) | Quality doesn't degrade as velocity increases |
| **E2E screenshot pipeline** | Automated screenshot generation for docs and marketing | Marketing assets stay current with zero manual effort |
| **Foundry machine** | Dedicated hardware (`foundry`) running autonomous pipelines | Agents work while founders sleep |

**Why this is a moat:** Competitors see the products. They don't see the forge. Even if they clone the code, they don't have the institutional knowledge loop, the template system, or the autonomous agent pipeline. The forge is the thing that makes everything else possible at impossible speed.

**Future monetization timeline:**
- **Now → v3.0:** Internal use only — builds Weaver at 10x speed
- **Post-v3.0:** Package as consulting offering — "we'll set up Forge for your team"
- **Post-Gantry:** Gantry + Forge = end-to-end project planning + autonomous execution platform
- **Long-term:** Forge as a SaaS product — upload your project, get agent-built features

### Portfolio Pricing (Future)

| Product | Self-Hosted | Cloud SaaS | Bundle |
|---------|:-----------:|:----------:|:------:|
| Weaver | $149–799/yr | $X/mo managed | — |
| Gantry | TBD | TBD | — |
| Accounting ERP | TBD | TBD | — |
| **WhizBang Suite** (all 3) | **Discount** | **Discount** | **The upsell** |

The portfolio play is: each product stands alone, but the bundle is the value proposition for businesses that need all three. The shared customer portal makes this seamless.

### Cross-Product Template Conversion

The migration tooling in Weaver (v1.4–1.5) establishes a pattern:
- Proxmox → Nix VM configs
- Libvirt → Nix VM configs
- Dockerfile → Nix VM or Apptainer SIF

This **template conversion engine** is reusable across products:
- In Gantry: import from GitHub Issues / Jira / Linear → Gantry canvas
- In Accounting ERP: import from QuickBooks / Xero / the PHP reference system → ERP data

Each import funnel reduces switching cost and captures customers from incumbent platforms.

---

## Fabrick Pricing — Decision History (Decision #33 (superseded by #63), settled 2026-03-04)

**Selected:** C-weaver ($799/$399/$299 at 10+). "We compete on features, not price."

The competitive anchor for Fabrick is infrastructure management platforms (Rancher, OpenShift, HashiCorp), not Proxmox. Weaver handles the "cheaper than Proxmox" positioning. Fabrick pricing funds growth toward SaaS, AI infrastructure, and the portfolio.

| Option | 1st Node | Additional | 10-Node Cost | Signal | Funds Growth? |
|--------|:--------:|:----------:|:------------:|--------|:---:|
| ~~C (original)~~ | ~~$299/yr~~ | ~~$149/yr~~ | ~~$1,640/yr~~ | ~~"Cheap NixOS option"~~ | No |
| ~~C-revised~~ | ~~$499/yr~~ | ~~$249/yr~~ | ~~$2,740/yr~~ | ~~"Value-priced alternative"~~ | Barely |
| ~~C-weaver (v1.x founding-member)~~ | ~~$799/yr~~ | ~~$399/yr ($299 at 10+)~~ | ~~$3,490/yr~~ | ~~"Features, not price" (named founding-member rate)~~ | Partial |
| **Market-ready** | **$2,000/yr** | **$1,250/yr ($750 at 10+)** | **$12,750/yr** | **"Credible, not scary"** | **Yes** |

---

*This document feeds into [TIER-MANAGEMENT.md](TIER-MANAGEMENT.md) and [BUDGET-AND-ENTITY-PLAN.md](BUDGET-AND-ENTITY-PLAN.md).*

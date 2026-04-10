<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Kubernetes Competitive Positioning

**Date:** 2026-04-08
**Purpose:** Evergreen competitive reference for the "why not Kubernetes?" objection. All vertical sales docs and the pitch deck reference this document.
**Audience:** Sales, investor pitch prep, vertical doc authors, channel partners
**Cross-references:** [IT-FOCUS-VALUE-PROPOSITION.md](IT-FOCUS-VALUE-PROPOSITION.md) § Competitive | [FABRICK-VALUE-PROPOSITION.md](../marketing/FABRICK-VALUE-PROPOSITION.md) §8–9 | [AI-INFERENCE-VALUE-PROPOSITION.md](AI-INFERENCE-VALUE-PROPOSITION.md) §6 | Decision #91 (microservice positioning), Decision #142 (Smart Bridges), Decision #112 (bridge active routing)

---

## Table of Contents

1. [The Kubernetes Complexity Problem](#1-the-kubernetes-complexity-problem)
2. [Regulatory Mapping: Where K8s Fails Compliance](#2-regulatory-mapping)
3. [Weaver for K8s Refugees](#3-weaver-for-k8s-refugees)
4. [Fabrick as K8s Replacement](#4-fabrick-as-k8s-replacement)
5. [K8s Deficiency Remediation Plan](#5-deficiency-remediation-plan)
6. [Competitive Advantages vs Kubernetes Products](#6-competitive-advantages)
7. [Objection Handling](#7-objection-handling)
8. [Buyer Personas](#8-buyer-personas)
9. [Success Programs](#9-success-programs)
10. [Discovery Questions](#10-discovery-questions)

---

## 1. The Kubernetes Complexity Problem {#1-the-kubernetes-complexity-problem}

Microservices architecture is a dominant industry trend — and a growing source of regret. Enterprises adopted microservices for independent deployment, isolated failure domains, and per-service scaling. What they got in return was Kubernetes, service mesh, platform teams, YAML sprawl, and operational overhead that frequently exceeds the architectural benefits.

**The backlash is real:**
- Shopify, Segment, and Istio teams have publicly documented microservices-to-monolith reversals
- Platform engineering has emerged as a discipline specifically to manage K8s complexity — an entire job category that exists because the tooling is too hard
- CNCF's own surveys show "complexity" as the #1 barrier to Kubernetes adoption, year after year
- The median enterprise K8s deployment requires 3–5 full-time platform engineers ($150K–$250K/yr each)

**The cost of Kubernetes (10-node cluster):**

| K8s Component | What It Does | Annual Cost | Weaver Equivalent |
|---------------|-------------|-------------|-------------------|
| Platform team (3–5 engineers) | Operate control plane, upgrades, troubleshoot | $450K–$1.25M/yr | **$0** — NixOS declarative config, no platform team |
| CNI plugin (Calico/Cilium) | Pod networking | $0–$50K (enterprise support) | **Bridge** — already deployed from v1.0 |
| Ingress controller (NGINX/Traefik) | External traffic routing | $0–$30K (fabrick) | **Bridge active routing** — same component |
| Service mesh (Istio/Linkerd) | Inter-service mTLS, observability | $0–$100K + 10–15% CPU overhead | **Not needed** — VM-level isolation replaces namespace isolation |
| Argo Rollouts / Spinnaker | Blue/green, canary deployments | $0–$50K + operator complexity | **Smart Bridges** — AI-managed traffic shifting |
| Monitoring stack (Prometheus/Grafana) | Metrics, alerting, dashboards | $30K–$100K (managed) | Planned extension (v3.0+) |
| GitOps (ArgoCD/Flux) | Declarative deployment sync | $0–$40K + controller maintenance | **NixOS flake** — `git commit` → `colmena apply` |
| **Total** | | **$480K–$1.62M/yr** | **$20K–$35K/yr** (10 Fabrick nodes) |

**Weaver's position:** Microservice benefits — independent deployment, isolated failure domains, per-service scaling — without Kubernetes, without service mesh, without a platform team.

---

## 2. Regulatory Mapping: Where K8s Fails Compliance {#2-regulatory-mapping}

Kubernetes introduces compliance complexity that Weaver eliminates by design. The core issue: K8s relies on shared-kernel namespace isolation, software-defined network policies, and non-deterministic pod scheduling — all of which require compensating controls to satisfy regulatory frameworks.

| Regulatory Framework | K8s Compliance Gap | Weaver Compliance Posture | Available |
|---------------------|-------------------|--------------------------|:---------:|
| **HIPAA § 164.312** | Pod security policies unreadable by auditors. Namespace isolation requires compensating controls for ePHI. Platform team must translate K8s abstractions for compliance staff. | Per-VM ACLs map directly to HIPAA access control. Auditors understand "VM access" — no K8s translation layer. | v1.0 |
| **PCI-DSS Req 1.3** | Shared kernel means compensating controls for CDE segmentation. Network policies are necessary but insufficient for cardholder data isolation. | MicroVM hardware isolation satisfies segmentation natively. Each workload has its own kernel. No compensating controls. | v1.0 |
| **NIST 800-171 / CMMC L2+** | Namespace boundaries don't meet CUI isolation requirements. Requires Pod Security Standards + OPA/Gatekeeper + runtime security — extensive hardening. | MicroVM hardware boundaries satisfy isolation controls. NixOS declarative config provides reproducible, auditable system state. | v1.0 |
| **21 CFR Part 11 (GxP)** | Non-deterministic pod scheduling. Proving identical compute environments across runs requires extensive tooling. K8s upgrades invalidate validated state. | NixOS builds are bit-for-bit reproducible. Snapshot provisioning produces identical VMs every time. Validation = `nix build` hash comparison. | v1.0 |
| **FedRAMP / FISMA** | K8s clusters blur system boundaries. Every namespace shares control plane, etcd, kubelet. Documenting access paths through shared infrastructure is audit-intensive. | Each MicroVM is a clear system boundary. Audit log captures all access. No shared control plane to document around. | v1.0 |
| **NERC CIP** | Software-defined network policies are audit-complex. Proving IT/OT segmentation to NERC auditors requires network flow logs + extensive policy documentation. | MicroVM hardware isolation + bridge segmentation. Each zone is a hardware boundary. Bridge ACLs are declarative and auditable. | v1.2+ |
| **SOC 2 CC6.1** | Logical access controls require mapping K8s RBAC → namespace → pod → service account chains. Auditors need training to evaluate K8s-specific access models. | Weaver RBAC maps directly to workloads. Per-VM ACLs at Fabrick tier. Standard access model auditors already understand. | v1.0 |
| **IEC 62443** | K8s control plane requires network connectivity — incompatible with air-gapped OT environments. Offline K8s is painful and requires custom registries. | NixOS + Weaver works fully offline. Flake inputs are pinned and cacheable. No container registry dependency at runtime. | v1.0 |

---

## 3. Weaver for K8s Refugees {#3-weaver-for-k8s-refugees}

### The Solo Buyer — $249/yr ($149/yr FM)

The homelab sysadmin or solo operator running K3s/K8s for a handful of services. Three GPU workloads fight the scheduler. More time on K8s maintenance than on the services themselves.

**What they get:**
- GPU passthrough via VFIO-PCI — native, no device plugin chain
- Bridge manages traffic routing — no ingress controller, no MetalLB
- Manual bridge weight controls for blue/green (v1.2+)
- Live Provisioning — API calls, not `nixos-rebuild` or `kubectl apply`
- NixOS declarative config — zero drift, no YAML, no Helm charts

**The pitch:** "Everything you're running K3s for — at $249/yr, without the cluster tax."

### The Team Buyer — $199/user/yr ($129/user/yr FM)

Small team (2–4 people) with a K8s cluster for ML inference or internal services. Can't justify a platform engineer but need automated deployments.

**What they get:**
- Smart Bridges automates blue/green model deployment
- AI manages health checks and rollback decisions
- Peer federation — manage up to 2 remote Weaver hosts
- Bridge replaces ingress + rollout controller — one component

**The pitch:** "Your team needs automated blue/green and fleet visibility — without hiring a platform engineer. $199/user/yr."

### Microservices Benefits Without Kubernetes

| Microservice Benefit | How K8s Delivers It | How Weaver Delivers It |
|----------------------|--------------------|-----------------------|
| **Independent deployment** | Pod rolling updates, Helm charts | LP API call → Firecracker boots in seconds |
| **Isolated failure domains** | Namespace isolation (shared kernel) | MicroVM hardware isolation (separate kernel) |
| **Per-service scaling** | HPA, pod autoscaler, resource requests | Bridge weight shifting + snapshot provisioning (2–5 sec restore) |
| **Blue/green deployments** | Argo Rollouts + service mesh | Smart Bridges — AI-managed traffic shift, one component |
| **Service discovery** | CoreDNS + kube-proxy | Bridge endpoint registration + DNS extension |
| **Zero-drift config** | GitOps (ArgoCD/Flux) — but drift still happens | NixOS declarative config — drift is **impossible** by design |
| **Traffic management** | Istio/Linkerd virtual services | Bridge active routing — weighted distribution per endpoint |
| **Grouped workload migration** | Namespace drain + pod disruption budgets | Workload Groups — bridge-level migration moves entire groups as a unit |

**The key insight:** Kubernetes is middleware that compensates for container limitations (shared kernel, no hardware isolation, no declarative host config). If you start with MicroVMs on NixOS, the problems K8s solves don't exist — so the middleware isn't needed.

---

## 4. Fabrick as K8s Replacement {#4-fabrick-as-k8s-replacement}

### Three K8s Components → One Bridge

The bridge convergence is Weaver's strongest technical differentiator against Kubernetes:

| K8s Component Stack | Function | Failure Modes | Weaver Bridge |
|---------------------|----------|---------------|---------------|
| CNI plugin (Calico/Cilium/Flannel) | Pod-to-pod networking | CNI version drift, iptables conflicts, MTU mismatches | Network switching — bridge connects workloads |
| Ingress controller + MetalLB | External traffic → pods, load balancing | Certificate rotation, upstream timeouts, LB health | Active routing — bridge distributes weighted traffic |
| Argo Rollouts / Spinnaker | Blue/green, canary, rollback | CRD version conflicts, controller crashes, rollback failures | Smart Bridges — AI manages traffic shift + health + rollback |

**Three components with three upgrade cycles, three failure surfaces, and three configuration languages — replaced by one bridge that's already deployed.**

*"We didn't add a load balancer. We realized the bridge already was one."*

### Fleet-Scale K8s Replacement (Fabrick — $2,000/yr first node)

| K8s Capability | Fabrick Equivalent | Version |
|---------------|-------------------|---------|
| Cluster control plane | Fabrick fleet management + Observer | v2.3+ |
| Pod autoscaling (HPA) | Set point auto-scaling via Smart Bridges | v3.3 |
| Node affinity/anti-affinity | NUMA-aware placement, topology spread constraints | v3.0+ |
| Pod disruption budgets | Workload Group disruption budgets, AI-enforced during cordon/drain | v3.0+ |
| Ingress/Gateway API | Bridge active routing with weighted endpoints, TLS, path-based | v2.2+ |
| Namespace isolation | Workload Groups with hardware-isolated boundaries | v3.3 |
| GitOps (ArgoCD/Flux) | Warp — fleet configuration patterns, drift detection | v3.0+ |
| Helm charts | System templates — NixOS declarative config, reproducible | v2.1 |
| Container registry | NixOS flake builds — reproducible, no mutable layers | v1.0 |

### Fabrick Economics vs K8s

| | Kubernetes (10 nodes) | Fabrick (10 nodes) |
|---|:---:|:---:|
| Platform team | $450K–$1.25M/yr | $0 |
| Infrastructure tooling | $30K–$320K/yr | Included |
| License cost | $0–$30K+/yr (OpenShift: $3K+/node) | $20K–$35K/yr |
| **Total** | **$480K–$1.6M/yr** | **$20K–$35K/yr** |

---

## 5. K8s Deficiency Remediation Plan {#5-deficiency-remediation-plan}

Organizations migrating from Kubernetes don't need to switch overnight. The remediation plan is incremental — workload by workload, not cluster-wide cutover.

| Phase | What Moves | When | K8s Deficiency Addressed |
|-------|-----------|------|--------------------------|
| **Phase 1: Observe** | Nothing — install `weaver-observer` on K8s worker nodes | Day 1 | Inventory: see all pods, resource usage, network topology in FabricK fleet view |
| **Phase 2: GPU workloads** | GPU pods → VFIO-PCI MicroVMs | v1.2+ | Eliminates device plugin chain, topology-aware scheduling bolt-on, NUMA allocation complexity |
| **Phase 3: Compliance workloads** | HIPAA/PCI/CUI-sensitive pods → hardware-isolated MicroVMs | v1.0+ | Eliminates compensating controls for shared-kernel isolation |
| **Phase 4: Stateful services** | Databases, caches, persistent stores → VMs with dedicated disk | v2.0+ | Eliminates pod scheduling surprises, PVC lifecycle complexity |
| **Phase 5: Edge deployments** | K3s edge nodes → NixOS MicroVMs | v2.3+ | Eliminates lightweight-K8s maintenance, air-gap registry complexity |
| **Phase 6: Remaining container workloads** | Stateless microservices that benefit from bridge routing | v2.2+ | Service → Bridge mapping, Helm chart → NixOS template conversion |

**What stays on K8s:** Stateless microservices deeply integrated with K8s APIs (custom controllers, CRDs, operator-managed services) and CI/CD runners leveraging K8s job scheduling.

**Parallel operation:** FabricK and K8s coexist indefinitely. Observer inventories K8s worker nodes. Bridge routing can front-end both Weaver workloads and K8s services. Migration is never all-or-nothing.

**Full migration helpers:** [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md) § Kubernetes

---

## 6. Competitive Advantages vs Kubernetes Products {#6-competitive-advantages}

### Head-to-Head Product Comparison

| Kubernetes Product | What It Does | When We Compete | Our Differentiation |
|-------------------|-------------|----------------|---------------------|
| **Kubernetes (k8s)** | Container orchestration across clusters | v2.x+ (Workload Groups) | No platform team. NixOS replaces YAML + operators + service mesh. VM-level isolation. |
| **k3s** (Rancher/SUSE) | Lightweight k8s for edge/small clusters | v2.x+ (edge play) | NixOS MicroVMs at the edge — NOT generic containers. Explicit scope boundary. |
| **Harvester** (SUSE HCI) | VMs + containers on Kubernetes | v2.0+ (clustering) | Same "unified VM + container" story. NixOS declarative config vs K8s control plane + YAML. |
| **KubeVirt** | VMs inside Kubernetes clusters | v2.x+ | Philosophical opposite. KubeVirt adds VM complexity to k8s. We eliminate k8s entirely. |
| **OpenShift** (Red Hat) | Enterprise Kubernetes platform | v3.0+ (Fabrick) | Price: OpenShift $3K+/node/yr. Fabrick $2,000/yr first node. NixOS vs YAML + OLM. |
| **Rancher** (SUSE) | Kubernetes management platform | v3.0+ (Fabrick) | Rancher manages k8s clusters. Fabrick manages NixOS infrastructure. Different philosophy. |
| **ECS/Fargate** (AWS) | Managed container orchestration | v2.x+ | Cloud lock-in. Weaver runs on your hardware, your cloud, or both. |
| **Nomad** (HashiCorp) | Workload orchestrator (containers + VMs) | v2.x+ | Closest competitor philosophically. Nomad is multi-platform; Weaver is NixOS-native with deeper integration. |

### Per-Industry K8s Complexity Cost

Use these callouts in vertical sales conversations to connect K8s overhead to industry-specific pain:

| Industry | K8s Complexity in Their World | Weaver Alternative |
|----------|------------------------------|-------------------|
| **Healthcare** | HIPAA audit of K8s namespaces, pod security policies. Platform team must document pod-level access controls for auditors who don't understand K8s. | Weaver RBAC + per-VM ACLs map directly to HIPAA access control requirements. No K8s translation layer. |
| **Financial Services** | PCI-DSS shared-kernel compensating controls. K8s network policies insufficient for cardholder data isolation. | MicroVM hardware isolation satisfies PCI-DSS segmentation natively. No compensating controls. |
| **Defense / CMMC** | NIST 800-171 CUI isolation requires extensive K8s hardening (PSS + OPA/Gatekeeper + runtime security). | MicroVM hardware boundaries satisfy NIST 800-171 isolation controls natively. |
| **Pharma / GxP** | Non-deterministic pod scheduling vs 21 CFR Part 11 reproducibility. K8s upgrades invalidate validated state. | NixOS bit-for-bit reproducible builds. Snapshot provisioning produces identical VMs every time. |
| **Government** | FedRAMP/FISMA system boundary documentation. K8s clusters blur boundaries — shared control plane, etcd, kubelet. | Each MicroVM is a clear system boundary. No shared control plane to document around. |
| **Research / HPC** | GPU scheduling bolt-ons (device plugins + topology-aware + NUMA-aware). Slurm/K8s coexistence is awkward. | GPU passthrough via VFIO-PCI is native. No device plugin chain. Researchers use the UI, not kubectl. |
| **Manufacturing / OT** | K8s control plane requires network connectivity — incompatible with air-gapped OT environments. | NixOS + Weaver works fully offline. No container registry dependency at runtime. |
| **Telecommunications** | NFV on K8s requires Multus CNI + SR-IOV + DPDK + real-time kernel patches. Every deployment is custom. | MicroVM + VFIO passthrough gives each network function dedicated hardware. Declarative kernel config. |
| **Energy / Utilities** | NERC CIP network segmentation via software-defined policies is audit-complex. | MicroVM hardware isolation + bridge segmentation. Each zone is a hardware boundary. |
| **Education** | Budget-constrained — can't staff a platform team ($150K+ for a senior K8s engineer). | Weaver Solo at $249/yr. One sysadmin manages everything. |
| **MSP** | Multi-tenant K8s is hard. Namespace isolation insufficient for client separation. | Fabrick Workload Groups — per-client hardware isolation. One fleet, clean tenant separation. |

### Project Glasswing: AI Validates the Shared-Kernel Risk

In April 2026, Anthropic launched **Project Glasswing** — a coalition with AWS, Google, Microsoft, NVIDIA, CrowdStrike, and 40+ organizations using AI to discover zero-day vulnerabilities at scale. The result: thousands of zero-day vulnerabilities found, including kernel-level bugs that survived decades of human review. Anthropic committed $100M in credits and established a 90-day public disclosure cycle.

**This is the empirical validation of the K8s shared-kernel argument.** Every Kubernetes pod on a node shares the node's Linux kernel. A single kernel zero-day — the kind Glasswing is now discovering in bulk — compromises every pod on the node. Not one workload. All of them. Every namespace, every pod security policy, every network policy is irrelevant once the kernel is owned.

**K8s has no hypervisor diversity.** The entire Kubernetes ecosystem runs on containerd/runc on a Linux kernel. Every node, same runtime, same kernel. A zero-day in containerd or runc compromises every pod on every node running that version. There is no workload-level hypervisor variation — the attack surface is uniform and monocultural.

**What Glasswing means for K8s compliance posture:**

| K8s Assumption | Pre-Glasswing | Post-Glasswing |
|---------------|--------------|----------------|
| Kernel zero-days are rare | Reasonable — shared kernel was an acceptable trade-off | No longer operative — AI discovers thousands per cycle |
| Namespace isolation is sufficient | Accepted with compensating controls | Compensating controls assume rare kernel exploits; that assumption is broken |
| Pod security policies protect workloads | Defense-in-depth layer | Defense-in-depth against an attack vector that now scales |
| "We patch quickly" is adequate | Workable for occasional CVEs | 90-day disclosure cycle means continuous patch pressure across the entire node fleet |

**Weaver's MicroVM architecture is the response K8s cannot provide:**

- **Separate kernels per workload.** Each MicroVM runs its own kernel. A kernel zero-day affects one VM, not every workload on the host.
- **Hypervisor diversity.** Five hypervisors mean a hypervisor-specific exploit doesn't cascade. K8s offers zero hypervisor diversity — it's containerd everywhere.
- **NixOS patch velocity.** When Glasswing discloses a vulnerability, NixOS applies the patch fleet-wide in one atomic operation. K8s requires rolling node updates, pod evictions, and scheduler coordination — and every node is vulnerable until its turn in the rolling update.

**For compliance officers:** Glasswing makes the "compensating controls for shared-kernel isolation" argument materially harder. When auditors ask "how do you protect against kernel zero-days?" the K8s answer is layers of software that assume kernel exploits are rare. The Weaver answer is hardware isolation — the kernel boundary is the hypervisor, not a namespace.

**Sales line:** *"Glasswing proved what we've been saying: shared-kernel isolation is a liability, not a feature. AI is finding kernel zero-days faster than K8s can patch nodes. Hardware isolation is the only architecture that scales with the threat."*

---

## 7. Objection Handling {#7-objection-handling}

### "We already run Kubernetes — why would we switch?"

You don't switch. You stop expanding K8s into workloads it wasn't designed for. VMs, GPU workloads, compliance-sensitive workloads, and edge deployments don't need pod orchestration — they need hardware isolation, declarative config, and a UI your ops team can use without kubectl training. Weaver handles the workloads K8s handles poorly. Your K8s cluster keeps doing what it does well.

### "Kubernetes is the industry standard"

Kubernetes is the industry standard for container orchestration. Weaver manages MicroVMs — hardware-isolated workloads that don't need container orchestration. Different primitive, different tool. The industry standard for VM management was VMware — and that market is in upheaval. Weaver enters there.

### "We've already invested in K8s training and tooling"

That investment serves your container workloads. But every time your team spends a week debugging a CNI issue, fighting Helm chart conflicts, or sizing node pools for GPU workloads — that's K8s being used where it doesn't fit. Weaver handles the workloads your K8s team dreads. The bridge replaces the ingress/CNI/rollout stack for those workloads. Your K8s investment stays intact for the workloads it serves well.

### "Kubernetes has a massive ecosystem"

It does — and maintaining compatibility with that ecosystem is a full-time job. Every CNCF graduation brings another component to evaluate, integrate, and upgrade. Weaver's ecosystem is NixOS: one language, one package manager, one config format, reproducible by design. The ecosystem is smaller and more cohesive. For teams that value operational simplicity over ecosystem breadth, that's the point.

### "Our compliance team requires Kubernetes"

Your compliance team requires documented access controls, audit trails, network segmentation, and reproducible environments. Kubernetes is one way to deliver those — with significant compensating controls for shared-kernel isolation. MicroVMs on NixOS deliver the same compliance outcomes with hardware isolation, declarative audit trails, and reproducible builds. The compliance requirement is the outcome, not the tool.

### "What about service mesh and observability?"

Service mesh exists because containers share a kernel — you need software-defined isolation between pods. MicroVMs have hardware isolation — the problem service mesh solves doesn't exist. Observability (metrics, tracing, logging) is a planned extension domain (v3.0+). Today, standard Linux monitoring tools work on each MicroVM independently. At Fabrick scale, fleet-aggregated metrics ship with the platform.

---

## 8. Buyer Personas {#8-buyer-personas}

### Persona 1: Platform Engineer (K8s Operator)

The person maintaining the K8s cluster. Burned out on CNI debugging, Helm chart conflicts, and CRD version drift. Wants simplicity but can't justify ripping out K8s wholesale.

**Entry point:** Weaver Solo ($249/yr) for GPU workloads or compliance VMs — offloads the workloads they dread managing in K8s. K8s cluster stays for the workloads it serves well.

**Trigger:** "I spent 3 days debugging a Calico CNI issue on a GPU node. There has to be a better way."

### Persona 2: CTO / VP Engineering (Budget Owner)

Sees the platform team line item ($450K–$1.25M/yr) and questions whether every workload needs K8s. Looking for cost reduction without capability regression.

**Entry point:** FabricK pilot (10 nodes, ~$12K/yr) for compliance or GPU workloads. Prove ROI on the workloads K8s handles worst before expanding.

**Trigger:** "We have 5 platform engineers. Two of them spend all day on GPU scheduling and compliance documentation. That's $300K/yr on workarounds."

### Persona 3: Compliance Officer / CISO

Needs to document access controls, network segmentation, and system boundaries for auditors. K8s makes this hard — namespace isolation requires compensating controls, pod security admission is audit-complex, and system boundaries are blurred by shared infrastructure.

**Entry point:** Compliance-sensitive workloads move to MicroVMs. Each VM is a clear system boundary. Audit log captures all access. Compliance Export Extension ($4,000/yr) generates evidence packages.

**Trigger:** "Our auditor asked how we prove pod isolation meets HIPAA access control requirements. I spent a week writing compensating control documentation."

### Persona 4: Sysadmin / Homelab Operator

Running K3s at home for a handful of services. Kubernetes is overkill but no better option existed. Frustrated by the overhead for 5–10 workloads.

**Entry point:** Weaver Solo ($249/yr) or Free ($0). GPU passthrough, bridge routing, NixOS declarative config. No cluster to maintain.

**Trigger:** "I run K3s for 6 services. It takes more time to maintain K3s than to maintain the services."

### Persona 5: ML/AI Team Lead

Team runs inference workloads on K8s with GPU Operator. Device plugin chain is fragile. Model deployments are slow (pull → schedule → health check → route). Needs faster deployment cycles.

**Entry point:** Weaver Team ($199/user/yr) with GPU passthrough + Smart Bridges. Snapshot provisioning restores model-loaded VMs in 2–5 seconds. Bridge routing replaces ingress for inference endpoints.

**Trigger:** "Our model deployment takes 12 minutes because K8s has to pull the image, schedule the pod, allocate the GPU, and update the ingress. We need sub-minute deployments."

---

## 9. Success Programs {#9-success-programs}

K8s migration and coexistence benefit from structured onboarding and architecture review. Success Programs provide hands-on expertise for workload migration, bridge configuration, and NixOS adoption.

| Program | FM Price | Standard Price | K8s Migration Focus |
|---------|:--------:|:--------------:|---------------------|
| **Community** | $0 | $0 | Community forum, documentation, best-effort support |
| **Adopt** | $5,000/yr | $15,000/yr | K8s workload assessment, first 5 workload migrations, bridge routing setup, Observer deployment on existing K8s worker nodes |
| **Accelerate** | $15,000/yr | $45,000/yr | Quarterly architecture reviews, GPU workload migration planning, Smart Bridges configuration, parallel K8s/Fabrick operations design |
| **Partner** | $30,000/yr | $90,000/yr | Named engineer for K8s-to-Fabrick migration strategy, fleet architecture design, compliance workload migration with audit documentation, custom bridge routing for K8s coexistence |

> **FM compliance path:** Adopt ($5,000/yr FM) + Compliance Export Extension ($4,000/yr flat) = **$9,000/yr** total compliance coverage for K8s-migrated workloads requiring regulatory evidence. Standard Adopt — Compliance ($25,000/yr) includes hands-on framework mapping sessions and evidence walkthroughs.

---

## 10. Discovery Questions {#10-discovery-questions}

### K8s Environment & Pain Points

1. How many K8s clusters do you operate? How many platform engineers maintain them?
2. What percentage of your workloads actually need container orchestration vs. just needing a place to run?
3. How much time does your team spend on CNI issues, Helm chart conflicts, or CRD version drift per month?
4. What's your annual spend on K8s tooling (monitoring, GitOps, service mesh, security)?

### GPU & Specialized Workloads

5. Are you running GPU workloads on K8s? How is the device plugin chain working for you?
6. How long does a model deployment take end-to-end (image pull → scheduling → health check → routing)?
7. Do your GPU workloads need NUMA-aware placement? How are you handling topology-aware scheduling?

### Compliance & Audit

8. How does your compliance team document K8s namespace isolation for auditors?
9. How many compensating controls do you maintain for shared-kernel workloads?
10. How long does audit preparation take for your K8s-hosted compliance workloads?

### Migration & Coexistence

11. Which workloads does your K8s team dread managing? (GPU, stateful, compliance, edge?)
12. Would you consider moving specific workload categories off K8s while keeping the cluster for the workloads it serves well?
13. Do you have air-gapped or edge deployments running K3s? How is offline operation working?

### Budget & Headcount

14. What's the fully loaded cost of your platform engineering team?
15. If you could eliminate 2 platform engineer roles by moving GPU/compliance workloads off K8s, what would that free up?
16. How does your K8s licensing cost compare to $2,000/yr per node for equivalent fleet governance?

---

## Sales Lines (Ready to Use)

**One-liner:** "Microservice benefits — independent deployment, isolated failure domains, per-service scaling — without Kubernetes, without service mesh, without a platform team."

**For the CTO:** "You're spending $500K/yr on people and tools to manage Kubernetes. What if you didn't need a platform team?"

**For the sysadmin:** "You already understand blue/green. Weaver just removes the cluster tax."

**For the CFO:** "Kubernetes costs you 3–5 engineers at $150K+ each. Fabrick costs $2,000/yr per node. Do the math."

**For the compliance officer:** "Every MicroVM is a hardware boundary. No shared kernel. No compensating controls. Your auditor understands 'separate VM' — they don't understand 'network policy + pod security admission + OPA constraint.'"

**For the pitch deck:** "The industry adopted microservices for the architecture and got Kubernetes as the tax. Weaver delivers the architecture without the tax."

---

*Canonical source for K8s competitive positioning. Referenced by all vertical sales docs, pitch deck, and migration guide. Updates here propagate to all referencing documents.*
*Resolves Decision #91 (microservice positioning). Extends Decision #142 (Smart Bridges), Decision #112 (bridge active routing), Decision #88/#89 (Workload Groups).*

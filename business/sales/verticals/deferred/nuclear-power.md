<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Nuclear Power Sales Case — DEFERRED
## Fission (Current) + Fusion (Future) Infrastructure
*Nuclear Power Plants, Research Reactors, Fusion Research Facilities, National Laboratories*

**Date:** 2026-03-26
**Status:** DEFERRED — stub only. Full spec requires NRC procurement research and regulatory scoping.
**Parent doc:** [../IT-FOCUS-VALUE-PROPOSITION.md](../../IT-FOCUS-VALUE-PROPOSITION.md)
**Related:** [../energy-utilities.md](../energy-utilities.md) — non-nuclear utility coverage

---

## Why This Is a Separate Document

Nuclear power is not an energy utility sub-vertical. It is a separate market with a separate regulatory body (NRC vs NERC/FERC), a separate procurement motion (years-long qualification processes, not annual budget cycles), a distinct scope boundary (10 CFR 73.54 safety-related vs non-safety systems), and a future growth curve driven by fusion that has no analogue in conventional utility markets. Treating it as a subsection of energy-utilities.md would underserve both markets.

---

## Market Segments

### Fission (Current Market)

- **Commercial nuclear power plants** — operating reactors under NRC license (US), CNS/CNSC (Canada), ONR (UK), ASN (France), etc.
- **Research reactors** — university research reactors, national lab reactors (NIST, MIT, Missouri S&T)
- **Fuel cycle facilities** — enrichment, fabrication, reprocessing
- **Decommissioning operations** — extended asset management with ongoing NRC oversight

### Fusion (Emerging Market)

- **Private fusion companies** — Commonwealth Fusion Systems, TAE Technologies, Helion, Zap Energy, General Fusion, and ~30 others in active development
- **Government fusion programs** — ITER (international), NIF (US), JET/UKAEA (UK), CEA (France)
- **National laboratory fusion programs** — PPPL, ORNL, LLNL
- **University fusion research** — plasma physics labs managing significant compute infrastructure

**Fusion timing note:** Fusion companies are building compute infrastructure now — simulation, plasma modeling, diagnostics data pipelines, control systems. They are not waiting for commercial operation. The sales motion for fusion is research infrastructure management today, not regulatory compliance (NRC does not yet regulate fusion commercially). The compliance motion comes later.

---

## Primary Regulatory Frameworks

### 10 CFR 73.54 — Cyber Security (NRC, US)

The NRC's cybersecurity rule for nuclear plants. Key structure:

- **Critical Digital Assets (CDAs)**: digital systems that perform safety, security, or emergency preparedness functions. Weaver scope: **not CDAs** — Weaver manages compute infrastructure at the IT/OT DMZ boundary, historians, and non-safety compute. Safety-related systems require separate NRC-qualified tooling.
- **Defense-in-Depth and Diversity (D3)**: four levels of protection around CDAs. Weaver is relevant at the outermost IT layer.
- **Site Cybersecurity Plan**: each plant must maintain and implement a cybersecurity plan approved by the NRC. Configuration management evidence is a core requirement.

**Weaver's scope boundary for nuclear:** Historian VMs, operator workstation compute, engineering workstation VMs, IT/OT DMZ systems, and non-safety OT compute — **not** safety-related or safety-significant systems. This scope boundary must be stated explicitly in any nuclear sales engagement to avoid misrepresentation to the NRC.

### NEI 08-09 / NEI 13-10

Nuclear Energy Institute guidance documents that implement 10 CFR 73.54. NEI 08-09 defines the Cyber Security Assessment methodology. Configuration management, access control, and audit trail requirements parallel NERC CIP but with NRC review cycles.

### IAEA Nuclear Security Series

International Atomic Energy Agency guidance (NSS 17, NST045) for nuclear cybersecurity — relevant for non-US plants and international fusion programs.

### Fusion (No Commercial Regulation Yet)

Private fusion companies currently operate under general OSHA/NRC research reactor rules where applicable. The NRC published a fusion regulatory framework roadmap in 2023. Until commercial fusion regulation solidifies, fusion infrastructure sales are a pure operations/efficiency play — no compliance driver yet.

---

## The Onsite AI Model Angle

Nuclear power plants and fusion research facilities are the primary environment where **onsite air-gapped AI** is not a preference — it is the only acceptable option. No cloud egress. No data leaving the facility boundary. Every AI interaction must stay within the plant's physical perimeter.

**Weaver's AI vendor controls (Decision #73) map directly:**

- Nuclear plant IT infrastructure: `aiPolicy: local-only` — all AI diagnostics, configuration analysis, and infrastructure queries route to an onsite model (Ollama, private LLM deployment, or air-gapped Claude inference node)
- No cloud AI provider receives any query about nuclear infrastructure
- The BYOV (Bring Your Own Vendor) model means the plant's cybersecurity team controls which model runs, where it runs, and what it can access

**The onsite AI pitch for nuclear:**

*"Your NRC cybersecurity plan prohibits cloud egress from systems within the plant boundary. Every other AI-assisted infrastructure tool phones home. Weaver's AI diagnostics run on a model you deploy, on hardware you control, inside your perimeter. The AI never leaves the plant."*

This is a genuine first-mover differentiator in nuclear. No other VM/container management platform offers configurable air-gapped AI diagnostics at the infrastructure layer.

**Fusion research angle:** Fusion companies are building proprietary plasma simulation and diagnostic models. They are not sending those models or their output to cloud AI providers. Onsite AI model support makes Weaver the natural management platform for compute infrastructure that is already running local AI workloads.

---

## Scope Boundary (Must Define Before Sales Engagement)

| System Type | Weaver Scope? | Notes |
|------------|:-------------:|-------|
| Historian VMs (non-safety) | Yes | Managed as standard compute |
| Engineering workstation VMs | Yes | |
| IT/OT DMZ compute | Yes | |
| SCADA communications gateway (non-safety) | Yes | Observer if non-NixOS |
| Operator display workstations (non-safety) | Needs review | Depends on CDA classification |
| Safety-related I&C systems | **No** | Requires NRC-qualified tooling |
| Safety-significant systems | **No** | Outside scope |
| Protection system compute | **No** | Outside scope |
| Reactor control systems | **No** | Outside scope |

This boundary must be established with the plant's 10 CFR 73.54 cybersecurity coordinator before any proposal.

---

## Deferred Items (Required Before Full Spec)

- [ ] **NRC procurement process** — understand the qualification/approval cycle for software used at nuclear plants. Is Weaver subject to any NRC software QA requirements (10 CFR 50 Appendix B) for the scope it covers?
- [ ] **CDA boundary research** — confirm where Weaver infrastructure typically falls in relation to the CDA boundary at a typical PWR/BWR plant
- [ ] **NEI 08-09 control mapping** — map Weaver capabilities to NEI 08-09 security controls (parallel to NERC CIP mapping in energy-utilities.md)
- [ ] **Fusion market timing** — research when NRC fusion commercial regulation is expected; identify which fusion companies are closest to commercial operation
- [ ] **Onsite AI model spec** — define the hardware and deployment requirements for a Weaver-compatible onsite AI inference node; price it as a bundle option
- [ ] **International nuclear** — identify whether IAEA NSS 17 / Euratom regulations require additional compliance export features
- [ ] **Sales motion** — nuclear procurement is multi-year. Define the entry point (IT infrastructure modernization budget vs cybersecurity budget vs operations budget) and the champion persona

---

## Trigger Conditions to Activate This Doc

- First inbound from a nuclear plant IT/OT team
- First contact from a fusion company infrastructure lead
- NRC publishes commercial fusion regulatory framework
- Onsite AI model feature reaches v2.x scope consideration

---

*Full spec deferred. When activated, follow canonical section order: Industry Problem → Regulatory Mapping → Weaver → Fabrick → Deficiency Remediation → Competitive Advantages → Objection Handling → Buyer Personas → Discovery Questions.*

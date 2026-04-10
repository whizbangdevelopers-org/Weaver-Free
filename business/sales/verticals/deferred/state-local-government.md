<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# State & Local Government Sales Case — DEFERRED
## Municipalities, Counties, State Agencies & Special Districts
*Police Departments, Courts, Public Works, Transit Authorities, Water Districts, School Districts (IT), Emergency Management*

**Date:** 2026-03-26
**Status:** DEFERRED — stub only. Activate when state/local GTM pipeline opens or municipal market is targeted.
**Parent doc:** [../IT-FOCUS-VALUE-PROPOSITION.md](../../IT-FOCUS-VALUE-PROPOSITION.md)
**Related:** [../government.md](../government.md) — federal government coverage

---

## Why This Is Separate from government.md

The federal government sales motion (FedRAMP, FISMA, ATO, CMMC, multi-year procurement) is fundamentally different from state/local:

| Factor | Federal | State & Local |
|--------|---------|--------------|
| Primary regulation | FedRAMP, FISMA, NIST 800-53 | CJIS (law enforcement), state privacy laws, NIST CSF |
| Procurement cycle | 12–36 months; FAR/DFAR | Varies widely; many under $100K direct |
| Budget source | Federal appropriations | Local tax revenue, grants (SLCGP, BRIC) |
| IT team size | Large, specialized | Often 1–5 people; generalists |
| Cloud mandate | OMB cloud-first | No equivalent mandate; often cloud-skeptical |
| Compliance driver | Mandatory FedRAMP ATO | CJIS is mandatory for law enforcement; others advisory |

---

## Market Segments

- **Law enforcement** — police departments, sheriff's offices, DA offices (CJIS-driven)
- **Courts** — state and county courts (case management, evidence systems)
- **Public utilities** — municipally-owned water, electric, gas (see also energy-utilities.md for NERC CIP overlap)
- **Transit authorities** — regional transit (OT/IT convergence, NIST CSF)
- **County/city IT** — general-purpose municipal IT (financial systems, HR, permitting)
- **Emergency management** — EOCs, 911 centers (CJIS adjacent, uptime-critical)
- **State agencies** — DMV, health departments, revenue departments

---

## Primary Regulatory Frameworks (Preliminary)

- **CJIS Security Policy v5.9+** (FBI) — mandatory for any system that touches Criminal Justice Information. Access control, audit logging, encryption, configuration management. Direct Weaver relevance.
- **State Privacy Laws** — California CPRA, Virginia VCDPA, etc. Infrastructure hosting PII must have demonstrable access controls.
- **SLCGP** (State and Local Cybersecurity Grant Program) — DHS/CISA grant funding for cybersecurity improvements. A procurement subsidy that lowers the cost barrier.
- **MS-ISAC / CIS Controls** — Center for Internet Security benchmarks widely adopted by state/local; CIS Controls v8 is the de facto standard.
- **NIST CSF** — recommended by CISA for state/local; not mandatory but widely referenced.
- **FedRAMP (rare)** — only for state agencies that host federal data or participate in federal programs.

---

## Potential Differentiators

- **CJIS access control and audit trail**: per-VM RBAC + declarative audit log directly satisfies CJIS configuration management and access logging requirements
- **Small team, big footprint**: one-person IT shop managing 50 VMs across a county — Weaver's automation and AI diagnostics are disproportionately valuable
- **Budget constraints**: $149/yr per node vs Proxmox/VMware licensing is a meaningful difference when budget is a city council vote
- **SLCGP grant-eligible**: Weaver purchase may qualify as a SLCGP-funded cybersecurity improvement — worth confirming with CISA guidance
- **Air-gap**: some law enforcement and court systems require air-gap for evidence integrity; offline-first license supports this

---

## Deferred Items (Required Before Full Spec)

- [ ] **CJIS policy mapping** — map Weaver capabilities to CJIS Security Policy v5.9 requirements (access control, audit, configuration management sections)
- [ ] **SLCGP eligibility** — confirm whether Weaver purchase qualifies under SLCGP grant categories; if yes, this is a significant GTM lever (procurement is grant-funded, not budget-constrained)
- [ ] **Procurement pathways** — identify cooperative purchasing vehicles (NASPO, Sourcewell, OMNIA Partners) that state/local IT uses; being on a co-op contract is often the fastest path to state/local revenue
- [ ] **Sales motion** — state/local is high volume, low ACV. Define whether this is self-serve (Weaver Solo/Team) or requires a channel (VAR, integrator, co-op contract)
- [ ] **Competitive landscape** — who wins state/local municipal IT today? (ManageEngine, Datto, ConnectWise MSP partners, VMware Go)

---

## Trigger Conditions to Activate This Doc

- First inbound from a state or local government IT department
- Decision to pursue NASPO/Sourcewell co-op contract listing
- SLCGP grant eligibility confirmed — becomes a GTM lever
- State/local pipeline reaches 3+ active opportunities

---

*Full spec deferred. When activated, follow canonical section order: Industry Problem → Regulatory Mapping → Weaver → Fabrick → Deficiency Remediation → Competitive Advantages → Objection Handling → Buyer Personas → Discovery Questions.*

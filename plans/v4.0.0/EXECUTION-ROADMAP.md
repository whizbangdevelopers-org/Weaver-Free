<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v4.0.0 (Platform + Verticals)

**Last updated:** 2026-03-06
**Status:** Horizon planning — two candidate paths, decision at v2.2 based on validation data

---

## Decision Gate

v4.0 has two candidate identities. The choice depends on validation signals collected during v1.2–v2.2. **Do not commit to either path until the decision gate criteria are met.**

| Path | Identity | Revenue Model | Decision Criteria |
|------|----------|--------------|-------------------|
| **A: Platform** | SaaS management plane + extension SDK + marketplace | Platform fees + third-party extension revenue share | Strong developer/integrator interest, multiple verticals validated |
| **B: Vertical-first** | Ship highest-validated vertical as first-party product | Direct product revenue (subscription or perpetual) | One vertical clearly validated, others uncertain |

**Decision gate:** v2.2.0 release (basic clustering shipped). By this point:
- AI vertical has v1.2 GPU passthrough usage data + v2.0 template adoption data
- K-12 has hardware feasibility result (Chromebook test) + IT admin interview data
- SaaS demand signal from Enterprise customers asking for hosted option
- Extension SDK demand from community/partners asking to extend Weaver

---

## Path A: Platform Release

Weaver becomes a platform that supports multiple products/verticals.

### v4.0-A Feature Set

| Feature | Tier | Description |
|---------|------|-------------|
| SaaS management plane | Fabrick | Cloud-hosted multi-tenant Weaver — manage on-premise fleets from browser |
| Extension SDK + developer docs | All | Third parties build and distribute Weaver extensions |
| Extension marketplace | All | Discover, install, rate extensions (free + paid) |
| Hosted Weaver (cloud offering) | New tier | "Try Weaver without installing" — conversion funnel to self-hosted |
| Multi-tenant isolation | Fabrick | Tenant separation for MSPs managing multiple customers |
| API v2 (public, versioned, OpenAPI) | All | Stable API contract for third-party integrations |
| Webhook system | Weaver+ | Event-driven integrations (deployment, alert, lifecycle hooks) |

### v4.0-A Architecture Impact

```
Cloud (SaaS layer)                    On-Premise (existing)
==================                    ====================
  Multi-tenant dashboard               NixOS host + Weaver
  Extension marketplace                 Node agent (v2.0 extraction)
  Hosted Weaver instances                  microvm-anywhere devices (v3.0)
       │                                       │
       └──────── Agent protocol ───────────────┘
                 (heartbeat, config sync, telemetry)
```

The SaaS layer is a management plane only — no VMs run in the cloud. All compute stays on-premise. This preserves the self-hosted value proposition while adding convenience.

### v4.0-A Downstream Products

With the platform in place, verticals ship as **product bundles** (curated extension sets + custom UI + sales material):

| Product | Bundle Contents | Target Market |
|---------|----------------|---------------|
| Weaver for AI | AI extension + GPU templates + inference monitoring | ML teams, AI labs |
| Weaver for Education | Fleet extension + classroom templates + exam lockdown | K-12 IT departments |
| Weaver for MSPs | Multi-tenant + SLA monitoring + customer portal | Managed service providers |
| Weaver Core | Base product, community extensions | Self-hosters, homelab |

---

## Path B: Vertical-First Release

Ship the highest-validated vertical as a first-party product. SaaS layer ships as supporting infrastructure, not the headline.

### If AI Vertical Validates

| Feature | Description |
|---------|-------------|
| AI Infrastructure Extension (full) | GPU inventory, scheduling, deployment workflow, inference metrics |
| AI VM template library | CUDA, ROCm, Ollama, vLLM, TGI — curated and tested |
| Edge inference fleet | Central model push, version management, A/B rollout, telemetry |
| Inference-specific SaaS dashboard | Cloud view of inference fleet health across all sites |
| MLOps integrations | MLflow, W&B webhooks for deployment events |

**GTM:** "RunPod for your own hardware" — target ML teams at privacy-sensitive companies.

### If K-12 Validates

| Feature | Description |
|---------|-------------|
| School Fleet Manager (separate product) | Purpose-built UI: classrooms, students, app policies, exam lockdown |
| SaaS management plane | Cloud-hosted dashboard for school IT |
| Device agent | NixOS service on each Chromebook, phones home to SaaS |
| Template library | Educational app sets, lockdown profiles, class-specific configs |
| FERPA compliance dashboard | Audit trail, data residency proof, compliance reports |

**GTM:** "Don't throw away your Chromebooks" — target district CTOs and IT directors.

### If Both Validate

Ship AI vertical first (higher per-deal revenue, faster sales cycle). K-12 follows as second product on same platform. This effectively becomes Path A but with a revenue-generating vertical leading the platform buildout.

---

## Validation Plan (v1.2 → v2.2)

### AI Infrastructure Vertical

| When | Validation Action | Signal |
|------|-------------------|--------|
| v1.2.0 (GPU passthrough ships) | Monitor: GPU passthrough feature usage, support requests | Are people using GPUs with Weaver? |
| v1.2.0+ | Community: Monitor r/selfhosted, r/LocalLLaMA for "self-hosted inference management" | Is there organic demand? |
| v2.0.0 (templates ship) | Publish AI templates, measure adoption vs. other templates | Do AI templates get disproportionate use? |
| v2.0.0+ | **Interviews: 5 ML team leads at privacy-sensitive companies** | Would they pay for managed GPU fleet tooling? What's missing? |
| v2.1.0+ | NixOS Discourse: track ML package activity, community size | Is NixOS + ML a growing intersection? |

### K-12 Device Fleet

| When | Validation Action | Signal |
|------|-------------------|--------|
| Now–v1.1.0 | **Interviews: 3-5 school IT administrators** about Chromebook lifecycle pain | Is AUE-driven replacement actually a budget problem? |
| v3.0 planning | Hardware test: Flash NixOS on Acer Chromebook, boot microVM | Does the technology actually work on real hardware? |
| v3.0 planning | ChromeOS Flex comparison: install on same hardware, compare value delta | Does NixOS + microVM offer enough over Flex to justify switching cost? |
| v3.0+ | E-rate research: verify Category 2 eligibility for managed device services | Can schools use federal funding? |
| v3.0+ | **Pilot: 1 friendly school district, 50 devices** | Real-world validation of the full stack |

### SaaS / Platform

| When | Validation Action | Signal |
|------|-------------------|--------|
| v2.0.0+ (agent extraction) | Track: Enterprise customers requesting hosted/managed option | Is there pull for cloud management? |
| v2.2.0+ (clustering) | Track: integration requests, "can I build an extension for X?" inquiries | Is there developer/partner demand? |
| v2.2.0+ | **Interviews: 3 MSPs managing NixOS/VM infrastructure** | Would they pay for multi-tenant Weaver? |

### Interview Templates

**AI vertical — ML team lead:**
1. How do you manage GPU allocation across your team today?
2. How do you ensure ML environment reproducibility? What breaks?
3. Would you run inference on self-hosted hardware if the management tooling existed? What's blocking you?
4. What would you pay per-GPU/month for managed inference infrastructure?
5. Do you have edge inference needs (branch offices, retail, factory)?

**K-12 — School IT administrator:**
1. How many Chromebooks does your district manage? How many hit AUE this year?
2. What happens to AUE'd devices? Replace, recycle, repurpose?
3. What's the annual device replacement budget?
4. Have you tried ChromeOS Flex or any alternative OS?
5. If you could extend device life by 3-5 years at $30/device/year, would that be interesting?
6. What's the biggest pain point in managing your device fleet today?

**MSP — Managed service provider:**
1. How many customers' VM/server infrastructure do you manage?
2. What tooling do you use for multi-customer management?
3. Would a multi-tenant dashboard reduce your operational overhead?
4. What would you pay per-customer/month for managed infrastructure tooling?

---

## Timeline

```
v1.2.0  ─── GPU passthrough ships
         └── AI validation starts (usage monitoring)

v2.0.0  ─── Templates + agent extraction
         └── AI templates published, K-12 interviews begin
         └── SaaS demand signals tracked

v2.2.0  ─── Basic clustering ships
         ┌── DECISION GATE ──┐
         │                    │
         │  Validation data:  │
         │  - AI: usage +     │
         │    interviews      │
         │  - K-12: hardware  │
         │    + interviews    │
         │  - SaaS: demand    │
         │    signals         │
         └────────────────────┘
              │
              ├── Both validate → Path A (platform) with AI vertical first
              ├── AI only → Path B (AI vertical-first)
              ├── K-12 only → Path B (K-12, ships post v3.0)
              └── Neither → Skip v4.0 verticals, focus on core product depth

v3.0.0  ─── Edge + HA (microvm-anywhere)
         └── K-12 hardware test if not done earlier
         └── Edge AI capabilities land

v4.0.0  ─── Platform or Vertical (decided at v2.2 gate)
```

---

## Budget Implications

| Path | Additional Cost | Revenue Timeline |
|------|----------------|-----------------|
| Path A (Platform) | SaaS infrastructure (~$200-500/month hosting), extension SDK dev time | 6-12 months after launch (marketplace adoption curve) |
| Path B (AI vertical) | Minimal — features built on existing roadmap | Immediate on launch (direct sales) |
| Path B (K-12) | Hardware test lab ($200), FERPA certification (~$5-10K), pilot support | 12-18 months (school procurement cycle) |

---

*Cross-reference: [MASTER-PLAN.md](../../MASTER-PLAN.md) | [ai-infrastructure-vertical.md](../../research/ai-infrastructure-vertical.md) | [k12-device-fleet.md](../../research/other-markets/k12-device-fleet.md) | [FABRICK-VALUE-PROPOSITION.md](../../business/marketing/FABRICK-VALUE-PROPOSITION.md) | [LOAD-TESTING-PLAN.md](../cross-version/LOAD-TESTING-PLAN.md)*

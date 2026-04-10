<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->

# ZenCoder Partnership Opportunity

**Date:** 2026-04-03
**Status:** Exploration — no contact made
**Classification:** Internal — do not share externally

---

## Opportunity Summary

ZenCoder is Weaver's **recommended private AI engine** (Decision #134). Not merely a workload template — it's positioned as the default answer to "how do I run AI privately?" for every Weaver customer.

**The broader story:** Weaver is private AI infrastructure. Every department that needs AI but can't use the cloud runs their workload on Weaver:

| Department | AI Need | Privacy Constraint | Weaver Solution |
|-----------|---------|-------------------|-----------------|
| Engineering | AI coding (ZenCoder) | ITAR/CUI — code can't leave network | ZenCoder on Weaver, `aiPolicy: 'local-only'` |
| Clinical | AI documentation | HIPAA — patient data can't reach external LLMs | Ollama/vLLM on Weaver, ePHI workload group |
| Accounting | Financial analysis | SOX — financials can't reach external LLMs | Local inference on Weaver, audit trail |
| Legal | Contract review | Privilege — documents can't reach third parties | Local inference on Weaver, isolated group |

ZenCoder is the **first pillar** (private AI coding). Ollama/vLLM/TGI are the second (private AI inference). Claude BYOK is the third (private AI diagnostics). All three managed under one compliance umbrella: RBAC, audit logging, workload groups with AI policy enforcement, per-user rate limits.

**Buyer pain:** "I need AI capabilities across my organization, but I can't send any of it to the cloud."

**Answer:** "Weaver comes with private AI infrastructure. ZenCoder for your dev team, Ollama for your applications, Claude for your infrastructure — your data never leaves your network."

---

## ZenCoder Overview

| Attribute | Detail |
|-----------|--------|
| Product | AI coding agent — IDE plugins (VS Code, JetBrains), CLI, CI/CD agents |
| Model | SaaS subscription (Free/Starter/Core/Advanced/Max/Enterprise) |
| On-premise | Available for enterprise — full stack, hybrid, or Zero VPC (local CLI) |
| Privacy | Does not train on user code or data |
| Security certs | **SOC 2 Type II + ISO 27001 + ISO 42001** (first AI coding platform with all three) |
| Integration | MCP client — connects to MCP servers for DB, API, browser automation; 100+ tool integrations |
| Open source | `zenagents-library` (MIT) — agent definition configs |
| License | SaaS subscription; no embeddable SDK |
| Weaver LLMs | Access to frontier models via their infrastructure (Claude is one — ZenCoder is an Anthropic customer) |
| Key product | **Zenflow** — engineering discipline layer for AI-generated code (anti-"vibe coding") |

### Pricing (per seat/month, as of 2026-04)

| Tier | Price | Daily Calls | Notes |
|------|-------|-------------|-------|
| Free | $0 | 30 | Autocomplete unlimited |
| Starter | $19 | 280 | |
| Core | $49 | 750 | |
| Advanced | $119 | 1,900 | |
| Max | Custom | 4,200 | |
| Enterprise | Custom | Custom | On-premise, SSO (Okta/Google), dedicated support |

---

## Integration Tiers

### Tier 1: Template (v2.0)

ZenCoder as a Shed template — "Deploy ZenCoder on-premise in 30 seconds."

- Pre-configured GPU assignment, networking, and secrets
- `zenagents-library` (MIT) agent definitions pre-loaded
- Health probe integration for inference monitoring
- Ships with template catalog at v2.0

**No partnership required.** Any customer with a ZenCoder Enterprise subscription can deploy it on Weaver using the template.

### Tier 2: Managed Workload (v2.0–2.1)

ZenCoder as a first-class managed inference workload — same integration depth as Ollama/vLLM/TGI.

- Inference health probes (latency, tokens/sec, queue depth)
- Auto-restart on VRAM OOM
- GPU scheduling integration (manual pick, best-fit, all-linked)
- Snapshot-based provisioning (seconds-level redeploy)
- AI rate limits per user (Decision #128)

**Requires API documentation** from ZenCoder for health probe endpoints.

### Tier 3: Partner Bundle (business development)

Co-marketed: **"ZenCoder + Weaver = secure AI development infrastructure."**

- Joint pricing (ZenCoder subscription + Weaver license bundled)
- Joint sales enablement for defense/healthcare/financial verticals
- Co-branded case studies and compliance documentation
- ZenCoder listed as a Technology Alliance partner
- Weaver recommended as the on-premise infrastructure in ZenCoder's enterprise sales materials

---

## Target Verticals

| Vertical | Buyer Pain | Joint Value |
|----------|-----------|-------------|
| **Defense** | ITAR/CUI restrictions prohibit cloud AI coding tools | On-premise ZenCoder on Weaver with impermanence, Secure Boot, audit logging |
| **Healthcare** | HIPAA — code touching ePHI systems can't be sent to external LLMs | ZenCoder on Weaver with encrypted secrets, network isolation, compliance mappings |
| **Financial** | PCI DSS, SOX — regulated development environments | ZenCoder on Weaver with RBAC, audit trail, per-user AI rate limits |
| **Government** | FedRAMP, NIST 800-171 — air-gapped development | ZenCoder on Weaver with full offline capability (Attic binary cache, v2.3+) |

---

## Competitive Position

No competitor offers this combination:

| Capability | Weaver + ZenCoder | GitHub Copilot | AWS CodeWhisperer | Cursor |
|-----------|-------------------|----------------|-------------------|--------|
| On-premise deployment | Yes (Zero VPC) | No | No | No |
| GPU scheduling | Yes (Weaver) | N/A | N/A | N/A |
| Audit logging | Yes (Weaver) | Limited | CloudTrail | No |
| Network isolation | Yes (Weaver bridges) | No | VPC only | No |
| NIST 800-171 mapped | Yes (Weaver) | No | Partial | No |
| Air-gap capable | Yes (v2.3+) | No | No | No |

---

## Partnership Program Research (2026-04-03)

**Finding: No public partner/reseller/OEM program exists.**

- ZenCoder's ToS explicitly prohibits reselling, sublicensing, or white-labeling without prior written consent
- No self-serve partner portal or channel program found
- Contact for partnership inquiries: **support@zencoder.ai**
- ZenCoder is an Anthropic/Claude customer ([claude.com/customers/zencoder](https://claude.com/customers/zencoder)) — potential warm intro path via Anthropic relationship

**Implication for Weaver:** Tier 1 (template) and Tier 2 (managed workload) require no partnership — the customer brings their own ZenCoder subscription. Tier 3 (partner bundle) requires a direct business conversation, not a program signup.

**MCP alignment:** ZenCoder acts as an MCP client connecting to MCP servers. Weaver's MCP infrastructure could serve as a natural integration point — Weaver-managed services (databases, monitoring) exposed as MCP servers that ZenCoder agents consume.

---

## Action Items

| # | Action | Owner | Priority | Status |
|---|--------|-------|----------|--------|
| 1 | Research ZenCoder's partner/channel program (if any) | Mark | Medium | **Done** — no public program exists (2026-04-03) |
| 2 | Draft partnership pitch (mutual value prop, co-marketing outline) | Mark | Medium | Open |
| 3 | Build ZenCoder Shed template (v2.0 scope) — no partnership needed | Engineering | Low (v2.0) | Open |
| 4 | Contact ZenCoder business development (after template exists) | Mark | Low | Open — use support@zencoder.ai |
| 5 | Explore Anthropic warm intro path (ZenCoder is a Claude customer) | Mark | Low | Open |

---

## Revenue Model

**No revenue share needed for Tier 1-2.** ZenCoder is a customer-supplied workload — Weaver doesn't resell it. The customer buys ZenCoder independently and deploys it on Weaver.

**Tier 3 (partner bundle):** potential for:
- Referral commission (ZenCoder → Weaver, Weaver → ZenCoder)
- Bundle discount (customer buys both, small discount)
- Co-marketing budget split for joint content

---

*Cross-reference: [TECHNOLOGY-ALLIANCES.md](TECHNOLOGY-ALLIANCES.md) | [AI-GPU-INFRASTRUCTURE-PLAN.md](../../../plans/cross-version/AI-GPU-INFRASTRUCTURE-PLAN.md) | [SOFTWARE-LICENSE-EVALUATION.md](../../legal/SOFTWARE-LICENSE-EVALUATION.md) § Open Items #9*

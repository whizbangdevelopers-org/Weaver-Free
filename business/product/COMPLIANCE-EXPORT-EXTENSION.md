<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Compliance Export Extension

**Created:** 2026-03-22
**Type:** Integrated Extension (à la carte, Fabrick only)
**Status:** Planned — feature spec stub. Engineering scope: 2–3 weeks (v2.2 features), 1 week additional (v3.0 delivery automation).

---

## Overview

The Compliance Export extension generates auditor-ready evidence packages directly from Weaver's existing configuration artifacts. No separate compliance tooling required. The NixOS declarative config and Weaver audit log are already the audit artifacts — this extension formats them for auditor consumption and delivers them on demand or on schedule.

**What it is not:** A compliance scanner, a risk assessment tool, or a policy engine. Weaver does not tell you whether your environment is compliant. It tells auditors what your environment is — provably, cryptographically, with no gap between documented state and running state.

**Why it is a separate extension, not bundled into Fabrick:**
The compliance architecture (zero-drift, git-as-audit-log, config-as-baseline) is structural and available to all Fabrick customers by default. The extension gates the formatted export tooling — the auditor-facing report templates, signed attestations, and scheduled delivery pipelines. Only regulated buyers need these; all Fabrick customers benefit from the underlying architecture.

---

## Pricing

| SKU | Price | Billing | Tier requirement |
|---|---|---|---|
| Compliance Export — standard | **$4,000/yr** | Annual, per organization (not per node) | Fabrick |
| Compliance Export — FM | **$2,800/yr** | Locked forever; closes when v2.2 ships | Fabrick FM customers only |

**Revenue model note:** Flat per-org pricing, not per-node. Compliance is an organizational obligation, not a per-node cost. A 5-node regulated customer and a 20-node regulated customer face the same audit cycle; charging per-node penalizes growth without delivering proportional value.

---

## Feature Specifications

### Feature 1: Framework Control Mapping Export
**Version:** v2.2
**Description:** Generates a formatted evidence document for each supported regulatory framework, showing which controls are satisfied by the NixOS + Weaver configuration with citations to specific config sections and Weaver features.

| Framework | Output | Status |
|---|---|---|
| HIPAA Security Rule (§164.308–§164.316) | Control satisfaction matrix + config citations per safeguard | v2.2 |
| SOC 2 Trust Services Criteria (CC6.1, CC7.2) | TSC control implementation narratives, Weaver-component scope | v2.2 |
| 21 CFR Part 11 / EU GMP Annex 11 | Audit trail adequacy evidence, ALCOA+ mapping | v2.2 |
| NIST SP 800-53 (CM, AU, AC control families) | SSP control implementation narratives, AO-ready format | v2.2 |
| CMMC Level 2 (NIST SP 800-171, all 110 controls) | Full control evidence package + gap analysis for non-Weaver controls | v2.4 |
| PCI-DSS Req 2 (config standards) + Req 10 (audit logs) | QSA-formatted evidence for in-scope Weaver components | v2.2 |
| NERC CIP-010-4 (configuration change management) | Per-BES-Cyber-System baseline export: declared config, git change log with pre/post diff, authorized-by attribution, 35-day deviation evidence. Auditor-ready per CIP-010 evidence structure | v3.0 |
| NERC CIP-005-7 / CIP-007-6 (ESP access + service control) | ESP boundary declaration export (managed bridge rules), authorized port/service list vs running state comparison, access log for ESP-connected systems | v3.0 |
| NERC CIP-013-2 (supply chain) | Software component inventory with version pins, vendor attribution, and change provenance — satisfies supply chain traceability requirement | v3.1 |

**Output format:** PDF report + machine-readable JSON for SIEM/GRC ingestion.
**Key implementation note:** The mapping is static at the framework level (NixOS + Weaver satisfies the same controls on every deployment) but the citations are instance-specific (actual config values, actual git log entries, actual Weaver audit log records from the customer's instance).

---

### Feature 2: Signed Configuration Attestation
**Version:** v2.2
**Description:** Generates a cryptographically signed snapshot of the NixOS configuration at a point in time, proving the running state matched the declared config at the attestation timestamp. Signed with the customer's own key (BYOK) or a Weaver-managed signing key.

**Use case:** An auditor questions whether the system in production matched the documented baseline. The attestation is a dated, signed record that answers that question without a scan or manual comparison.

**Signing options:**
- Customer-managed key (recommended for air-gapped and defense deployments)
- Weaver-managed key (timestamped, retrievable via API)

**Output:** Signed JSON attestation + human-readable summary PDF.

**Regulatory value:**
- HIPAA §164.312(b) — proves audit control was active and configuration was as declared
- CM.L2-3.4.1 (CMMC) — proves baseline configuration was documented and matched running state
- 21 CFR Part 11 §11.10(e) — original, attributable, accurate configuration record

---

### Feature 3: Audit-Ready Change Log Export
**Version:** v2.2
**Description:** Formats the Weaver audit log and git commit history into an auditor-facing change record. Output shows: who changed what system, what was changed (before/after), when it was changed, and who authorized it.

**Distinction from raw audit log:** The raw Weaver audit log is machine-format JSON. The export formats it as a human-readable document with regulatory-specific section headers, sorted and filtered per audit scope, with a summary change count and anomaly flag (changes outside approved windows, changes without corresponding commit).

**Output format:** PDF + CSV (for examiner import into GRC tools).

**Retention:** The underlying git log + Weaver audit log are the authoritative records. The export is a view over those records, not a separate store. Regeneratable at any point from the historical records.

---

### Feature 4: Control Gap Analysis
**Version:** v2.4 (CMMC-focused); v3.0 (generalized)
**Description:** Identifies which regulatory controls are satisfied by Weaver, which require external tooling, and which are out-of-scope. Provides a pre-assessment evidence map for C3PAO/auditor use.

**Primary use case:** CMMC Level 2 assessment preparation. The gap analysis shows which of the 110 NIST SP 800-171 controls are closed by Weaver + NixOS, which require the customer's supplemental controls, and which controls are outside Weaver's scope entirely. This is the SPRS score-building document.

**Secondary use case:** SOC 2 scoping conversations with auditors — clarifies the Weaver boundary within the broader audit scope.

---

### Feature 5: Scheduled Export Delivery
**Version:** v3.0
**Description:** Automated generation and delivery of evidence packages on a configurable schedule (monthly, quarterly, annual). Delivery targets: S3-compatible object store, encrypted email, or webhook.

**Use cases:**
- Monthly ConMon evidence delivery to ISSO (government)
- Quarterly SOC 2 evidence collection for annual Type II audit
- Annual CMMC evidence package auto-assembly before assessment window
- FDA inspection readiness — perpetually current evidence package

**Configuration:** Schedule, framework, delivery target, and signing key all configurable per export job. Multiple jobs per instance (e.g., monthly NIST 800-53 delivery + annual CMMC package).

---

## What This Extension Does Not Do

| Capability | Status | Notes |
|---|---|---|
| Runtime compliance scanning | Not in scope | Weaver does not scan running systems for drift — drift is architecturally impossible |
| Policy enforcement | Not in scope | RBAC, firewall rules, and quotas are core Fabrick features; not gated by this extension |
| Third-party GRC platform integration (Vanta, Drata) | Future | Export JSON can be consumed by GRC tools; native integrations are v4+ |
| Signing authority as a service | Not in scope | Weaver can sign with customer key; we do not act as a CA or signing authority |

---

## Implementation Notes

### Engineering Scope Estimate

| Feature | Scope | Notes |
|---|---|---|
| Control mapping templates (HIPAA, SOC 2, PCI-DSS, NIST 800-53) | 2–3 weeks | Static templates with dynamic config/log injection; 4 frameworks at v2.2 |
| Signed attestation (BYOK signing) | 3–4 days | Builds on existing config export API; add signing wrapper + timestamp |
| Audit log export formatter | 3–4 days | Transform existing audit log JSON to structured PDF/CSV; add regulatory headers |
| CMMC gap analysis (v2.4) | 1–2 weeks | More complex mapping; requires per-control evidence citation logic |
| Scheduled delivery pipeline (v3.0) | 1 week | Cron-style job runner + S3/SMTP delivery; standard infrastructure work |

### License Key Gating
The Compliance Export extension uses the `requirePlugin('compliance-export')` guard (same mechanism as the Firewall extension). An Fabrick key without the Compliance Export add-on presents an upgrade prompt on the export UI. No new key prefix required — the extension flag is encoded in the key payload.

### Stripe Billing
Separate Stripe Price ID (`price_compliance_export`) attached to the Fabrick product. Customers purchase the extension as an add-on to their existing subscription. Renewal is independent of the base subscription.

---

## Sales Positioning

**The TCO argument (direct):** A regulated 10-node Fabrick customer receives $20,500/yr in compliance value from the architecture alone. The extension costs $4,000/yr. Net capture to the customer: $16,500/yr from year one — a 4:1 return on the extension cost.

**The comparison argument:** Vanta (SOC 2 automation): $10,000–$30,000/yr. Drata: $15,000–$50,000/yr. These tools automate evidence collection for generic SaaS stacks. The Compliance Export extension delivers the equivalent for infrastructure that is already compliance-by-construction, for 25–80% less.

**The floor argument:** Even if a customer already uses Vanta/Drata for their application layer, the infrastructure evidence package (Weaver + NixOS) is a gap in those tools. The extension fills that gap. It does not compete with application-layer compliance tooling — it completes it.

---

## Version Delivery Summary

| Version | Features delivered |
|---|---|
| v2.2 | HIPAA, SOC 2, PCI-DSS, NIST 800-53 framework mapping export; signed configuration attestation; audit-ready change log export |
| v2.4 | CMMC Level 2 full control mapping; SPRS-ready gap analysis |
| v3.0 | Scheduled export delivery (S3/email/webhook); ConMon monthly delivery; 21 CFR Part 11 / EU Annex 11 templates |

---

*Cross-reference: [TIER-MANAGEMENT.md](TIER-MANAGEMENT.md) | [TCO-ANALYSIS.md](TCO-ANALYSIS.md) | [V4-FUNDING-GAP-ANALYSIS.md](V4-FUNDING-GAP-ANALYSIS.md) | [FABRICK-VALUE-PROPOSITION.md](FABRICK-VALUE-PROPOSITION.md)*

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# User Action Items — v2.0.0+ (Storage, Templates, Backup, Clustering)

**Purpose:** Manual action items requiring human intervention for v2.x releases.
**Last updated:** 2026-03-06
**Status:** Pre-v2.0 — collecting items

For prior version items: [v1.0.0](../v1.0.0/USER-ACTION-ITEMS.md) | [v1.1.0](../v1.1.0/USER-ACTION-ITEMS.md) | [v1.2.0](../v1.2.0/USER-ACTION-ITEMS.md)

---

## DECISIONS NEEDED

### Fabrick Repository
- [ ] **Fabrick repo activation timing** — When does `Weaver-Dev-Premium` go live? v2.0 introduces storage features that may be enterprise-only code. BSL license draft exists at `docs/legal/LICENSE-PAID-DRAFT.md`.

### Backup Extension Architecture
- [ ] **Backup adapter pricing model** — Local/NFS adapters included at premium? S3/restic/borg as separate purchasable extensions? Define extension granularity.

### Multi-Node Clustering
- [ ] **Clustering deployment model** — Agent binary distribution, auto-update strategy, node discovery mechanism. These have security implications that need architectural review.

### Forge Agent Readiness
- [ ] **v2.0.0 agent estimate is TBD** — The v2.0.0 [capacitor](../../agents/v2.0.0/capacitor.md) agent has a "TBD" estimate. Note: `agent-extract` moved to v2.3.0; `template-editor` moved to v2.1.0. Forge scheduling requires concrete day-count estimates before execution.
- [ ] **v2.1.0–v3.0.0 agent definitions not yet written** — Releases v2.1.0 (Storage Weaver + Nix editor + TPM), v2.2.0 (Weaver Team peer federation), v2.3.0 (Fabrick Basic Clustering + Nix ecosystem), v2.4.0 (Backup Weaver), v2.5.0 (Storage Fabrick), v2.6.0 (Backup Fabrick + Extensions), v3.0.0 (HA + Live Migration) have execution roadmaps in `plans/` but no agent task specs in `agents/`. Create versioned agent directories with agent definitions for each before Forge can execute them.

---

## PRE-RELEASE

### Licensing & Legal
- [ ] **BSL license finalization** — Resolve open questions from `LICENSE-PAID-DRAFT.md` (change date duration, SaaS clause, AI restriction format).
- [ ] **Legal review of BSL 1.1** — With project-specific parameters.
- [ ] **Legal/insurance review for backup/storage domains** — Data loss claims = significant insurance exposure.

---

*Cross-reference: [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md) | [MASTER-PLAN.md](../../MASTER-PLAN.md)*

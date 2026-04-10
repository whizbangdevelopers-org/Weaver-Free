<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v8a-secrets-management — Integrated Secrets Management

**Priority:** Medium #4
**Tier:** Weaver (vault management + secrets injection) / Fabrick (per-workload assignment + audit trail)
**Plan:** [EXECUTION-ROADMAP](../../plans/v1.5.0/EXECUTION-ROADMAP.md) (Phase 8a)
**Parallelizable:** No (requires v1.4.0 vault foundation)
**Blocks:** None (v1.6.0 migration tooling is independent)

---

## Scope

> **Spec status: TBD** — Full agent spec to be written before v1.5.0 enters the development queue. Scope and architecture defined by Decisions #73 and #74. See [plans/v1.5.0/EXECUTION-ROADMAP.md](../../plans/v1.5.0/EXECUTION-ROADMAP.md) for the complete feature spec.

**Summary:** Expand the v1.4.0 AI credential vault to general workload secrets — DB passwords, service tokens, arbitrary key-value. Add secrets injection at workload boot and per-workload credential assignment (Fabrick tier). The SQLCipher vault infrastructure ships in v1.4.0 (AI credentials only); this agent expands the allowed credential types and injection surface without new vault infrastructure.

**Key decisions:**
- Decision #73: Admin-only vault access, SQLCipher + sops-nix architecture, tier model
- Decision #74: v1.5.0 reassigned from config-export-import to secrets management

---

*Full spec to be written when v1.4.0 enters active development. Use plans/v1.5.0/EXECUTION-ROADMAP.md as the source of truth in the interim.*

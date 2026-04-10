<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1.3-networking-wizards — Remote Access Wizards + Network Isolation Mode

**Priority:** High #1
**Tier:** Weaver Free (Tailscale wizard, tunnel status, Settings page) / Weaver (WireGuard wizard, Network Isolation Mode)
**Plan:** [EXECUTION-ROADMAP](../../plans/v1.3.0/EXECUTION-ROADMAP.md)
**Parallelizable:** No (prerequisite for mobile-app agent)
**Blocks:** mobile-app

---

## Scope

One-time NixOS setup wizards for Tailscale (Free) and WireGuard (Weaver) that generate NixOS module config and guide the user through a single `nixos-rebuild switch`. Once configured, remote access works forever with zero ongoing maintenance. Network Isolation Mode toggles tunnel off without touching VMs, using NixOS generations for instant rollback.

### What's Already Done

<!-- MANDATORY: Scan the actual codebase before filling this in. Prior specs may be stale. -->
<!-- Run the e2e-test-writer pre-flight and grep for relevant files. Trust what you see, not prior specs. -->

- NixOS module infrastructure (existing `nixos/default.nix`)
- Settings page scaffold
- JWT auth and RBAC

### Deliverables

| Task | Tier | Priority |
| --- | --- | --- |
| Tailscale setup wizard — NixOS config generation + rebuild instructions | Free | High |
| WireGuard setup wizard — NixOS config generation + rebuild instructions | Weaver | High |
| Network Isolation Mode — toggle disables tunnel, NixOS rollback | Weaver | High |
| Backend: detect active tunnel type (Tailscale / WireGuard / none) | Free | Medium |
| Settings page: tunnel status + re-run wizard + isolation toggle | Free | Medium |
| Wizard UI: step-by-step config generation | Free | High |
| E2E specs for wizard flows | All | High |

### Acceptance Criteria

- [ ] Tailscale wizard generates valid NixOS config, user can complete rebuild
- [ ] WireGuard wizard generates valid NixOS config, user can complete rebuild
- [ ] Network Isolation Mode toggle is Weaver-gated and functional
- [ ] Backend correctly detects tunnel status
- [ ] Settings page shows current tunnel state
- [ ] All tests pass (`test:precommit`)

---

*See [MANIFEST.md](MANIFEST.md) for execution order and quality gates.*

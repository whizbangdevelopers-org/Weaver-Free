<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Forge Manifest — v1.2.0

**Reviewed:** 2026-03-09

## Agents

| Agent | Est | Dependencies |
|-------|-----|-------------|
| [container-management](container-management.md) | ~16d total | v1.1.0 shipped |
| - [sub-runtime-actions](sub-runtime-actions.md) | ~6d | container-visibility (v1.1.0) |
| - [sub-creation-frontend](sub-creation-frontend.md) | ~6d | sub-runtime-actions |
| - [sub-governance-testing](sub-governance-testing.md) | ~4d | sub-creation-frontend |

## Execution Order

Sequential sub-agent chain (each depends on the previous):

1. `sub-runtime-actions` — Apptainer/Docker/Podman action implementations + endpoints
2. `sub-creation-frontend` — Container creation endpoint, image registry, CreateContainerDialog
3. `sub-governance-testing` — RBAC, audit, bulk ops, NixOS module, full E2E, documentation

## Quality Gates

- **Per sub-agent:** `test:precommit` (lint, typecheck, unit tests)
- **Pre-wave gate:** Run `e2e-test-writer` agent (`code/.claude/agents/e2e-test-writer.md`) — audit coverage gaps, write missing specs, run suite green before proceeding
- **After sub-agent #3:** Full version gate — Docker E2E suite + NixOS smoke test
- **Manual gate:** NixOS fresh-install smoke test

## Branch Strategy

`feature/v1.2-container-management` (all 3 sub-agents on same branch)

## Dependencies

- **Requires:** v1.1.0 shipped (ContainerRuntime interface established)
- **Blocks:** v1.3.0 (cross-resource agent needs full container management)

## Also Shipping (non-agent work)

- Firewall extensions (nftables, profile egress, zones)
- Hardening extensions (AppArmor, Seccomp, Kernel)

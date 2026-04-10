<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Forge Manifest — v1.1.0

**Reviewed:** 2026-03-09

## Agents

| Agent | Est | Dependencies |
|-------|-----|-------------|
| [container-visibility](container-visibility.md) | ~8-9d | v1.0.0 released |

## Execution Order

1. `container-visibility` — single agent, no sub-agents

## Quality Gates

- **Per-agent:** `test:precommit` (lint, typecheck, unit tests)
- **Pre-wave gate:** Run `e2e-test-writer` agent (`code/.claude/agents/e2e-test-writer.md`) — audit coverage gaps, write missing specs, run suite green before proceeding
- **Wave gate:** Docker E2E suite (`testing/e2e-docker`)
- **Manual gate:** NixOS fresh-install smoke test (`scripts/nix-fresh-install.sh`)

## Branch Strategy

`feature/v1.1-container-visibility`

## Dependencies

- **Requires:** v1.0.0 released and stable
- **Blocks:** v1.2.0 (container-management depends on ContainerRuntime interface)

## Also Shipping (non-agent work)

- Orthogonal elbow edge routing (already implemented, pending commit)
- DNS extension infrastructure (`requirePlugin()` middleware)
- Auth extensions (TOTP, FIDO2)
- Windows UEFI/OVMF + VirtIO drivers ISO
- VM resource monitoring graphs (~5-7d: cgroups collection, ring buffer, chart component)
- VM clone/template (~3-5d: clone endpoint, clone dialog, name/IP generation)
- Config export endpoint implementation (~1-2d: implement documented API)
- Extended keyboard shortcuts (~1-2d: VM action keys, j/k navigation, overlay)

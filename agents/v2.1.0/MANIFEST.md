<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Forge Manifest — v2.1.0 (Storage & Template Weaver)

**Reviewed:** TBD — stamp date when development is approved

See [plans/v2.1.0/EXECUTION-ROADMAP.md](../../plans/v2.1.0/EXECUTION-ROADMAP.md) for full scope.

## Agents

| Agent | Est | Dependencies |
|-------|-----|-------------|
| [template-editor](template-editor.md) | 9–12d | v2.0.0 shipped |
| [maintenance-manager](maintenance-manager.md) | 13–17d | v2.0.0 shipped |

## Execution Order

Parallel — agents are independent of each other within v2.1.0.

1. `template-editor` — Nix template editor + archetype system + template storage
2. `maintenance-manager` — `test → health check → confirm → switch` rebuild lifecycle + GC + flake updates

## Quality Gates

- **Per-agent:** `test:precommit` (lint, typecheck, unit tests)
- **Pre-wave gate:** Run `e2e-test-writer` agent (`code/.claude/agents/e2e-test-writer.md`) — audit coverage gaps, write missing specs, run suite green before proceeding
- **Wave gate:** Docker E2E suite (`testing/e2e-docker`)
- **Manual gate:** NixOS fresh-install smoke test

## Branch Strategy

- `feature/v2.1-template-editor`
- `feature/v2.1-maintenance-manager`

## Dependencies

- **Requires:** v2.0.0 shipped (storage foundation + disk lifecycle in place)
- **Blocks:** v2.2.0 (Weaver Team peer federation builds on stable single-host foundation)

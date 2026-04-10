<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Forge Manifest — v2.0.0

**Reviewed:** 2026-03-09

## Agents

| Agent | Est | Dependencies |
|-------|-----|-------------|
| [capacitor](capacitor.md) | TBD | v1.0.0 released |

## Execution Order

1. `capacitor` — Capacitor mobile build (iOS/Android), push notifications, i18n, disk/template foundation

## Quality Gates

- **Per-agent:** `test:precommit` (lint, typecheck, unit tests)
- **Pre-wave gate:** Run `e2e-test-writer` agent (`code/.claude/agents/e2e-test-writer.md`) — audit coverage gaps, write missing specs, run suite green before proceeding
- **Wave gate:** Docker E2E suite after agent merged
- **Manual gate:** NixOS fresh-install smoke test + mobile build verification

## Branch Strategy

- `feature/v2.0-storage-templates`

## Dependencies

- **Requires:** v1.0.0 released and stable
- **Blocks:** v2.1.0 (snapshot engine depends on disk lifecycle from 10a)

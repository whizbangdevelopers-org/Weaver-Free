<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Forge Manifest — v1.3.0

**Reviewed:** 2026-03-27

## Agents

| Agent | Est | Dependencies |
|-------|-----|-------------|
| [networking-wizards](networking-wizards.md) | ~4-5d | v1.2.0 shipped |
| [mobile-app](mobile-app.md) | ~8-10d | networking-wizards complete |

## Execution Order

1. `networking-wizards` — backend tunnel detection, wizard UI, Network Isolation Mode
2. `mobile-app` — Capacitor build pipeline, mobile layouts, push notifications, biometric auth

## Quality Gates

- **Per-agent:** `test:precommit` (lint, typecheck, unit tests)
- **Pre-wave gate:** Run `e2e-test-writer` agent (`code/.claude/agents/e2e-test-writer.md`) — audit coverage gaps, write missing specs, run suite green before proceeding
- **Wave gate:** Docker E2E suite (`testing/e2e-docker`)
- **Manual gate:** NixOS fresh-install smoke test + tunnel activation test
- **Manual gate:** Mobile build smoke test (Capacitor iOS simulator + Android emulator)

## Branch Strategy

`feature/v1.3-networking-wizards` → `feature/v1.3-mobile-app`

## Dependencies

- **Requires:** v1.2.0 shipped (full container management — ensures mobile shows complete resource view)
- **Blocks:** None (v1.4.0 Cross-Resource AI is independent)

## Notes

App Store and Google Play submission is a manual gate — review/approval takes 1-7 days. Start submission process as soon as mobile-app agent completes. v1.3.0 ships when both app stores approve.

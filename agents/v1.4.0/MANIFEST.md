<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Forge Manifest — v1.4.0

**Reviewed:** 2026-03-09

## Agents

| Agent | Est | Dependencies |
|-------|-----|-------------|
| [cross-resource-agent](cross-resource-agent.md) | ~10-11d | v1.2.0 shipped |

## Execution Order

1. `cross-resource-agent` — single agent, no sub-agents

## Quality Gates

- **Per-agent:** `test:precommit` (lint, typecheck, unit tests)
- **Pre-wave gate:** Run `e2e-test-writer` agent (`code/.claude/agents/e2e-test-writer.md`) — audit coverage gaps, write missing specs, run suite green before proceeding
- **Wave gate:** Docker E2E suite (`testing/e2e-docker`)
- **Manual gate:** NixOS fresh-install smoke test

## Branch Strategy

`feature/v1.4-cross-resource-agent`

## Dependencies

- **Requires:** v1.2.0 shipped (full container management in place)
- **Blocks:** v1.5.0 (secrets-management vault expansion builds on the SQLCipher vault foundation shipped here)

## Also Shipping (non-agent work)

- AI credential vault foundation — SQLCipher store, admin-managed frontier + application AI credentials, BYOK removed at Weaver tier (Decision #73)
- Bridge active routing — weight-based traffic control, AI-managed blue/green shift, bridges-not-as-nodes licensing (Decision #112)

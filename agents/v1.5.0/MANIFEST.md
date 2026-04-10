<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Forge Manifest — v1.5.0

**Reviewed:** 2026-03-27

## Agents

| Agent | Est | Dependencies |
|-------|-----|-------------|
| [secrets-management](secrets-management.md) (spec stub — full spec TBD) | ~6-8d | v1.4.0 shipped |

## Execution Order

1. `secrets-management` — vault expansion, secrets injection, per-workload assignment

## Quality Gates

- **Per-agent:** `test:precommit` (lint, typecheck, unit tests)
- **Pre-wave gate:** Run `e2e-test-writer` agent (`code/.claude/agents/e2e-test-writer.md`) — audit coverage gaps, write missing specs, run suite green before proceeding
- **Wave gate:** Docker E2E suite (`testing/e2e-docker`)
- **Manual gate:** NixOS fresh-install smoke test

## Branch Strategy

`feature/v1.5-secrets-management`

## Dependencies

- **Requires:** v1.4.0 shipped (vault foundation + AI credential store established in v1.4.0; v1.5.0 expands to general workload secrets)
- **Blocks:** None (v1.6.0 migration tooling is independent)

## Notes

Scope defined by Decisions #73 and #74. Agent spec (`secrets-management.md`) to be written before development queue reaches v1.5.0. v1.4.0 ships the SQLCipher vault for AI credentials; v1.5.0 expands that same vault to general workload secrets — no new vault infrastructure, only expanded credential types and injection surface.

This manifest was re-reviewed 2026-03-27 after Decision #74 (2026-03-21) reassigned this version from config-export-import to Integrated Secrets Management.

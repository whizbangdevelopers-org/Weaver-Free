<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Forge Manifest — v1.6.0

**Reviewed:** 2026-03-27

## Agents

| Agent | Est | Dependencies |
|-------|-----|-------------|
| [config-export-import](config-export-import.md) | ~5-6d | v1.5.0 shipped |
| [format-parsers](format-parsers.md) | ~6d | config-export-import complete |

## Execution Order

1. `config-export-import` — archive format, export/import UI, round-trip flow
2. `format-parsers` — Proxmox/libvirt/Dockerfile parsers, dual output, import orchestrator

## Quality Gates

- **Per-agent:** `test:precommit` (lint, typecheck, unit tests)
- **Pre-wave gate:** Run `e2e-test-writer` agent (`code/.claude/agents/e2e-test-writer.md`) — audit coverage gaps, write missing specs, run suite green before proceeding
- **Wave gate:** Docker E2E suite (`testing/e2e-docker`)
- **Manual gate:** NixOS fresh-install smoke test

## Branch Strategy

`feature/v1.6-config-export-import` → `feature/v1.6-format-parsers`

## Dependencies

- **Requires:** v1.5.0 shipped (secrets management complete — vault and injection infrastructure in place)
- **Blocks:** None (v1.x arc complete after this release)

## Notes

Both agents are part of the migration tooling arc (Decision #74). config-export-import ships first and establishes the archive format and import UI; format-parsers extends the import flow with external format parsing (Proxmox, libvirt, Dockerfile). Dockerfile dual-output (Nix VM or Apptainer SIF) depends on container infrastructure from v1.1-v1.2. This manifest was updated 2026-03-27 to add config-export-import (moved from v1.5.0 per Decision #74).

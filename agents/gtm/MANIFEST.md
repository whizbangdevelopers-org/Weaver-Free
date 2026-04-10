<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Forge Manifest — GTM Launch

## Agents

| Agent | Est | Dependencies |
|-------|-----|-------------|
| [content](content.md) | TBD | v1.0.0 near-complete |
| [demo](demo.md) | TBD | v1.0.0 near-complete |

## Execution Order

Both agents are independent and can run in parallel:

1. `content` — README rewrites, blog posts, comparison pages, video script
2. `demo` — Demo site deployment, tier-switcher enhancement, sample data

## Quality Gates

- **No E2E gate** (content/demo only — no code changes to test)
- **Manual gate:** Visual review of demo site + content proofread

## Branch Strategy

- `feature/gtm-content`
- `feature/gtm-demo`

## Dependencies

- **Requires:** v1.0.0 near-complete (can run NOW)
- **Blocks:** Nothing (parallel to release)

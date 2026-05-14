<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — devops

Lessons learned in the **devops** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-devops-2026-05-14-001 -->
---
id: L-devops-2026-05-14-001
type: lesson
domain: devops
tags: [deploy, npm-scripts, rsync, build-pipeline, tool]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-devops-2026-05-13-001]
graduated_to: ""
---

## Root-level `build:<tool>` script for tools with external deploy targets — 2026-05-14 · Claude

**Root cause:** A tool with its own `package.json` and an external deploy target (rsync, scp, S3 upload) naturally gets a `build` script that only builds locally. When a developer runs `npm run build` from inside the tool directory, the build succeeds but nothing reaches the live environment — the deploy step is a separate script that's easy to forget. This pattern caused repeated "why aren't my changes visible?" confusion with engram-ui, even after the gotcha was documented.

**Rule:** For any tool with an external deploy target, add a `build:<tool>` script at the project root that chains build + deploy in a single command. Name it following the existing `build:backend`, `build:tui` convention so it's discoverable alongside other build targets. Document it in `CLAUDE.md` Key Commands with a note that this is the only correct build command for that tool.

**Why this shape wins:** A developer running builds from the project root sees `build:engram-ui` alongside `build:backend` and `build:tui` — the deploy is not a separate mental step, it's baked into the standard build invocation. The bare `build` script inside the tool directory can remain for CI contexts that need build-only, but the root script is the canonical developer path. Documentation alone (gotchas, CLAUDE.md) doesn't prevent the mistake — the script structure does.

<!-- /entry -->

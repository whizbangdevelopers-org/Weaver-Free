<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — nixos

Lessons learned in the **nixos** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-nixos-2026-05-13-001 -->
---
id: L-nixos-2026-05-13-001
type: lesson
domain: nixos
tags: [kuzu, native-module, npm, nix-sandbox]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## Kuzu npm package is Nix build-safe without removal — 2026-05-13 · Claude

**Root cause:** Kuzu bundles a pre-built `.node` native addon in its npm tarball. Unlike sass-embedded (which Vite actively tries to load during the frontend build, causing sandbox failures), kuzu's native binary is never executed during `npm run build` or `npx quasar build`. It's only loaded at runtime by Node processes that `require('kuzu')`.

**Rule:** Do NOT remove kuzu from `node_modules` in the Nix `buildPhase`. Just update `npmDepsHash` and `lockfile-marker` after `npm install`. Removal is only needed for packages that Vite/esbuild tries to bundle at build time.

**Why this shape wins:** The `buildPhase` script already has a pattern for removing build-time-executed native binaries (`rm -rf node_modules/sass-embedded`). kuzu doesn't belong in that list — adding it would break the script that generates kuzu-powered ingest outputs.

<!-- /entry -->

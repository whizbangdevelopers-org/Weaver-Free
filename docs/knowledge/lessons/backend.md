<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — backend

Lessons learned in the **backend** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-backend-2026-05-15-001 -->
---
id: L-backend-2026-05-15-001
type: lesson
domain: backend
tags: [typescript, monorepo, rootdir, sqlite, shared-module, engram]
since_version: "1.0.5"
status: active
scope: project
related: [G-backend-2026-05-15-002]
graduated_to: ""
---

## TypeScript `rootDir: ./src` prevents cross-package DB module import in a non-workspace monorepo — 2026-05-15 · Claude

**Root cause:** The backend's `tsconfig.json` sets `rootDir: ./src` and `outDir: ./dist`. Any file imported from outside `src/` causes tsc to fail: "File is not under 'rootDir'." This blocked the direct import of `openEngramDb()` from `codebase-mcp/src/utils/engram-db.ts`, even though the two packages share a DB file. The result was that `engramRoutes` re-implemented its own DB opener, got it wrong (lazy instead of eager), and the canonical initialization logic (schema + seed) was never called by the backend.

**Rule:** When two packages in a non-workspace monorepo share a SQLite DB file and one needs to initialize it, there are three options:
1. **Workspace package** — extract the DB module to `@weaver/engram-db`, list it in both consumers' `package.json`. Correct long-term.
2. **Relax tsconfig** — remove `rootDir` restriction, adjust outDir structure. Messy but fast.
3. **Co-maintain** — duplicate the init function with an explicit comment: "Co-maintained with `<canonical path>` — direct import blocked by rootDir constraint." This is honest bounded duplication, not silent drift.

Until option 1 ships, apply option 3: mark the duplicate with a comment, keep it structurally identical to the canonical, and add a `related:` link in the knowledge entry so neither can be changed without awareness of the other.

**Why this shape wins:** Silent drift between two "independent" openers is what caused this bug. An explicit comment + `related:` knowledge link makes the co-maintenance intentional and visible. A future reader who changes `openEngramDb` sees the note and knows to update `initEngramDb` too.

<!-- /entry -->

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — security

Lessons learned in the **security** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-security-2026-05-12-001 -->
---
id: L-security-2026-05-12-001
type: lesson
domain: security
tags: [semgrep, taint, path-traversal, temp-files]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-security-2026-05-12-002, G-security-2026-05-12-003]
graduated_to: ""
---

## Use only server-side data in temp file paths — 2026-05-12 · Claude

**Root cause:** When a route creates a temp file, using user-provided fields (domain, scope, type) in the filename seems harmless after Zod validation. But Semgrep's taint analysis traces the source (`request.body`) forward through all derived variables and fires CWE-22 findings even when each individual input is validated. The right security model matches the right SAST model: server-generated identifiers in paths, user data in content only.

**Rule:** Temp file paths written by API handlers must derive exclusively from server-side data (e.g., `Date.now()`, a UUID, a content hash). User-provided fields belong in the file content, not the filename.

**Why this shape wins:** It's correct security AND correct SAST. Path traversal risk is eliminated structurally, not by trusting that validation was applied correctly. The temp file is opaque to the caller; its name carries no information the caller shouldn't have.

<!-- /entry -->

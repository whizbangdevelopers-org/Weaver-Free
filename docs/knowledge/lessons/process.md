<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — process

Lessons learned in the **process** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-process-2026-05-10-001 -->
---
id: L-process-2026-05-10-001
type: lesson
domain: process
tags: [esm, typescript, dual-mode, import.meta.url, scripts]
since_version: "1.0.5"
status: active
related: []
graduated_to: ""
---

## ESM dual-mode script guard — import.meta.url — 2026-05-10 · Claude

**Root cause:** In Node.js ESM, top-level code in a module runs unconditionally — both when the file is executed directly (`npx tsx script.ts`) and when it is imported as a library (`import { fn } from './script.js'`). A script that exports utility functions AND performs side effects at the top level (writing files, spawning processes) will execute those side effects on every import, which is almost never the intended behaviour.

**Rule:** Any TypeScript script that is both a standalone CLI tool and an importable library must guard its entry-point code:

```typescript
if (import.meta.url === `file://${process.argv[1]}`) {
  // side-effecting entry-point code here
}
```

**Why this shape wins:** The guard is zero-cost when the module is imported — `import.meta.url` is a static string evaluated at parse time, `process.argv[1]` is the actual entry-point file path. When imported as a library, the comparison is false and the block is skipped entirely. The exported functions remain available. This pattern surfaces naturally any time a script doubles as a library — build it in from the start, not as a retrofit.

<!-- /entry -->

<!-- entry:L-process-2026-05-10-002 -->
---
id: L-process-2026-05-10-002
type: lesson
domain: process
tags: [bash, set-e, arithmetic]
since_version: "1.0.5"
status: active
related: []
graduated_to: ""
---

## Shell script arithmetic with `set -e` — 2026-05-10 · Claude

**Root cause:** `((var++))` post-increment returns the pre-increment value. When `var=0`, `((0))` evaluates as falsy (exit code 1), and `set -e` kills the script silently.

**Rule:** Never use `((var++))` in `set -e` scripts. Use `var=$((var + 1))` (assignment form, always exits 0) or `((++var))` (pre-increment, evaluates to 1 when starting from 0).

**Why this shape wins:** The assignment form `var=$((var + 1))` makes intent explicit and is immune to `set -e` because assignment always exits 0. The `((++var))` form works but requires knowing that pre-increment evaluates to the post-increment value. Prefer the assignment form in any `set -e` script.

<!-- /entry -->

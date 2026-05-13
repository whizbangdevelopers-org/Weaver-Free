<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — process

Known gotchas in the **process** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-process-2026-05-10-002 -->
---
id: G-process-2026-05-10-002
type: gotcha
domain: process
tags: [regex, typescript, esm, module, global-flag]
since_version: "1.0.5"
status: active
related: [L-process-2026-05-10-001]
graduated_to: ""
---

## Global regex (`g` flag) must not be a module-level singleton — 2026-05-10 · Claude

**Problem:** A module-level `const` regex with the `g` flag (e.g., `const RE = /pattern/g`) carries `lastIndex` state between invocations. In Node.js ES modules, module-level code runs once and the object is shared across all callers. When the regex is imported by another module AND called from the main entry-point, the `lastIndex` left over from one call context silently causes a later call to start matching from the wrong offset — returning zero results even when the file contains valid matches.

This is particularly treacherous in dual-mode scripts (CLI + importable library) where the same module is loaded once (module singleton) but called at different times from different callers.

**Fix:** Create the regex inside the function that uses it, not at module level:

```typescript
// BROKEN — shared state across calls
const ENTRY_RE = /<!--\s*entry:([\w-]+)\s*-->/g

function scanFile(content: string) {
  ENTRY_RE.lastIndex = 0  // Reset — but still footgun if called concurrently
  while (ENTRY_RE.exec(content) !== null) { ... }
}

// CORRECT — fresh instance per call, no state bleed
function scanFile(content: string) {
  const entryRe = /<!--\s*entry:([\w-]+)\s*-->/g
  while (entryRe.exec(content) !== null) { ... }
}
```

**Related gotcha:** A regex anchor `^---` inside a substring match. When matching a YAML frontmatter block inside a captured group (blockContent), the `^` anchor without the multiline flag only matches the very start of the string. If blockContent begins with `\n---` (a newline before the first `---`), the `^---` pattern fails silently. Fix: remove `^` and match `/---\n.../` directly when the leading newline is expected.

**Rule:** Never put a `g`-flagged regex at module level if the function using it could be called more than once or imported by other modules. Create it fresh inside the function. For anchored sub-string matching inside captured groups, trace what character position the captured string starts at before assuming `^` will work.

<!-- /entry -->

<!-- entry:G-process-2026-05-10-001 -->
---
id: G-process-2026-05-10-001
type: gotcha
domain: process
tags: [auditor, marker-sync, doc-parity, audit-chain]
since_version: "1.0.5"
status: active
related: [L-process-2026-05-13-001]
graduated_to: ""
---

## New docs with auditor counts need marker registration at write time — 2026-05-10 · Claude

**Problem:** When a new prose document is created that mentions the auditor count (e.g., "the pre-push hook runs N static auditors"), it is tempting to write the raw number directly. The `audit:doc-parity` auditor checks this count against `package.json` at push time and catches the drift — but only at push time, after the number is already stale. If the count grows between the time the doc was written and the next push (e.g., because more auditors are added in the same session), every push fails until the doc is updated.

**Fix:** Whenever writing a count that derives from `run-compliance.ts` into any prose document, immediately:

1. Replace the raw number with a marker: `<!-- auditor-count:begin -->N<!-- auditor-count:end -->`
2. Add the doc path to the `docs` array of the `auditor-count` registration in `code/scripts/sync-markers.ts`
3. Run `npm run sync:markers` once to populate the correct value

The marker is then maintained automatically by the pre-commit hook on every subsequent change to `run-compliance.ts`.

**Rule:** No prose document should contain a raw auditor count. Every occurrence is a `<!-- auditor-count:begin -->` marker waiting to be planted. Grep for bare numbers when adding a new doc that summarises the CI chain.

<!-- /entry -->

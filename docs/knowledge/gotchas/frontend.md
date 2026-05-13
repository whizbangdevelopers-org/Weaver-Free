<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — frontend

Known gotchas in the **frontend** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-frontend-2026-05-10-001 -->
---
id: G-frontend-2026-05-10-001
type: gotcha
domain: frontend
tags: [quasar, q-badge, slots]
since_version: "1.0.5"
status: active
related: []
graduated_to: ""
---

## q-badge renders label twice when `:label` prop and slot are both used — 2026-05-10 · Claude

**Problem:** Using both the `:label` prop and slot content on `<q-badge>` renders the text twice — once from the prop, once from the slot.

**Fix:** Use slot content only. Remove the `:label` prop entirely when you have slot content.

**Rule:** `q-badge`: slot content only, never `:label` + slot together.

<!-- /entry -->

<!-- entry:G-frontend-2026-05-13-001 -->
---
id: G-frontend-2026-05-13-001
type: gotcha
domain: frontend
tags: [typescript, oxc, type-assertion, vite]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## oxc breaks chained method call on new line after `as` assertion — 2026-05-13 · Claude

**Problem:** When a type assertion and a method call are split across lines:

```typescript
return db.prepare(...).all() as Array<{ entry_id: string }>
  .map((r) => ({ entryId: r.entry_id }))
```

oxc (Vite's transformer) parses them as two separate statements. The `.map()` is treated as a standalone expression, not a continuation. Runtime error: `[PARSE_ERROR] Unexpected token`.

**Fix:** Extract into a typed intermediate variable:

```typescript
type Row = { entry_id: string }
const rows = db.prepare(...).all() as Row[]
return rows.map((r) => ({ entryId: r.entry_id }))
```

**Rule:** Never chain a method call on a new line immediately after an `as` type assertion. oxc treats the line boundary as a statement terminator. Extract to `const` first.

<!-- /entry -->

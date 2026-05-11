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

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — testing

Known gotchas in the **testing** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-testing-2026-05-15-001 -->
---
id: G-testing-2026-05-15-001
type: gotcha
domain: testing
tags: [vitest, vue3, script-setup, defineExpose, wrapper-vm]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-testing-2026-05-15-001]
graduated_to: ""
---

## `wrapper.vm` is empty for `<script setup>` components without `defineExpose()` — 2026-05-15 · Claude

**Problem:** In Vue 3 `<script setup>`, all declared variables, refs, computed values, and functions are private by default. `wrapper.vm.someRef` and `wrapper.vm.someFunction` return `undefined` even though the values exist and work in the template. There is no error — the properties are simply absent.

**Fix:** Add `defineExpose({ ... })` at the end of the `<script setup>` block listing every symbol the tests need to reach:

```ts
defineExpose({ nameRule, nameValid, onSubmit, selectedMethod })
```

**Rule:** Every `<script setup>` component that will be unit-tested via `wrapper.vm` needs a `defineExpose()` call. Make it the last statement in the script block so it's easy to find. The list acts as a public API surface — only expose what tests legitimately need; don't expose everything.

<!-- /entry -->

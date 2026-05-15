<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — testing

Lessons learned in the **testing** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-testing-2026-05-13-001 -->
---
id: L-testing-2026-05-13-001
type: lesson
domain: testing
tags: [vitest, vi-mock, dynamic-import, fallback, module-mocking]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Testing catch-block fallback paths with `vi.mock` + dynamic import — 2026-05-13 · Claude

**Root cause:** When an exported function has a catch block that calls a module-level helper function, and that helper uses imported utilities (e.g., `getPgPool`, `embedText`), the helper's imports are resolved at module load time. `vi.stubGlobal` can't reach them; `vi.spyOn` can't reach private unexported functions. The only way to control the helper's behavior is to mock the module it imports.

**Rule:** To test an async fallback path activated by a catch block:
1. Declare `vi.mock('../utils/module.js', () => ({ fn: vi.fn().mockResolvedValue(defaultValue) }))` at the TOP of the test file — Vitest hoists these before imports.
2. In the specific test, call `const { fn } = await import('../utils/module.js')` to get the mock handle, then `vi.mocked(fn).mockResolvedValueOnce(testValue)` to set the per-test return.
3. Stub the primary path to fail (e.g., `vi.stubGlobal('fetch', makeNetworkError(...))`) so the fallback activates.

**Why this shape wins:** The default mock in step 1 keeps all other tests unaffected (they get the default value). The per-test override in step 2 exercises only the specific scenario. Vitest's module mock isolation ensures mocks don't bleed across tests. This pattern works for any "primary fails, fallback runs" code path that goes through imported utilities.

<!-- /entry -->

<!-- entry:L-testing-2026-05-15-001 -->
---
id: L-testing-2026-05-15-001
type: lesson
domain: testing
tags: [vitest, quasar, vue3, shallowMount, unit-tests]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-testing-2026-05-15-001]
graduated_to: ""
---

## Vitest + Quasar components: skip the plugin install entirely when using `shallowMount` — 2026-05-15 · Claude

**Root cause:** When setting up Vitest for Vue components that import Quasar, installing the Quasar plugin (`config.global.plugins = [[Quasar, {}]]`) in a `jsdom` environment without the correct Vite browser resolve conditions causes Vitest to load `quasar.server.prod.js` (the SSR build) instead of the client build. That SSR build fails immediately with "Cannot convert undefined or null to object" at boot time.

**Rule:** For components whose `<script setup>` blocks only import from Vue (not from Quasar directly), the plugin install is unnecessary. `shallowMount` automatically stubs all template-level Quasar components (`q-dialog`, `q-btn`, etc.), so they resolve without requiring the plugin. The `setupFiles` entry can be an empty file — or contain only comments explaining why the plugin is absent.

**Why this shape wins:** No Quasar plugin = no SSR/client build disambiguation problem. `shallowMount` stubs isolate the component logic from Quasar's runtime, which is exactly what unit tests should do anyway (test the script, not the template widgets). This keeps the test setup to two lines in `vitest.config.ts` (`setupFiles` and the package alias) and zero lines of actual setup code.

<!-- /entry -->

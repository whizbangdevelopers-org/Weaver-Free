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

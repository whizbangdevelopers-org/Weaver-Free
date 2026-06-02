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

<!-- entry:G-testing-2026-06-02-001 -->
---
id: G-testing-2026-06-02-001
type: gotcha
domain: testing
tags: [playwright, request-fixture, storagestate, auth, 401, api-test]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-testing-2026-06-02-001]
graduated_to: ""
---

## Playwright `request` fixture inherits spec storageState — 401-without-auth tests get 200 — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-15)

**Problem:** A test like `"GET /api/config returns 401 without auth"` fails with `Expected: 401, Received: 200` even though it uses the default `request` fixture thinking it is unauthenticated. When the spec has `test.use({ storageState: '...json' })` — or inherits the global-setup default — Playwright's `request` fixture **automatically inherits those cookies**, so every `request.get()` is already authenticated as the storageState user.

**Fix:** For any test asserting 401/403 without auth, construct a fresh request context with explicitly empty storage and dispose it:

```ts
test('GET /api/config returns 401 without auth', async ({ playwright }) => {
  const ctx = await playwright.request.newContext({
    storageState: { cookies: [], origins: [] },
  })
  try {
    expect((await ctx.get(`${API_BASE_URL}/api/config`)).status()).toBe(401)
  } finally {
    await ctx.dispose()
  }
})
```

**Rule:** Never trust the default `request` fixture to represent an unauthenticated caller. Any 401/403-without-auth assertion must use a dedicated context with empty storageState. (Conversely, API-level tests that *need* auth must inject `Authorization: Bearer` explicitly — storageState cookies do not flow to `request.get()`/`request.post()`.)

<!-- /entry -->

<!-- entry:G-testing-2026-06-02-002 -->
---
id: G-testing-2026-06-02-002
type: gotcha
domain: testing
tags: [playwright, global-setup, register, set-cookie, request-context, bearer]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-testing-2026-06-02-001]
graduated_to: ""
---

## A register endpoint that Set-Cookies the new user replaces the caller's session in a shared request context — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-15)

**Problem:** In `global-setup.ts`, admin registers operator → viewer → login-test on one Playwright request context. After the first call, subsequent admin calls fail 403. `POST /api/auth/register` sets the `weaver_token` cookie for the **newly created user** in the response; the context's cookie jar captures it, so the next request runs as that new user, who lacks admin permission.

**Fix:** Register each user through a **fresh, disposable** context that authenticates by Bearer header, not the shared cookie jar:

```ts
const ctx = await playwrightRequest.newContext({
  baseURL: API_BASE,
  extraHTTPHeaders: { Authorization: `Bearer ${adminToken}` },
})
try { return await ctx.post('/api/auth/register', { data: { ...creds, role } }) }
finally { await ctx.dispose() }
```

Bearer takes precedence over cookies in the auth middleware, and the disposable context keeps the main context's cookie jar pristine for the final storageState capture.

**Rule:** Any Playwright request context that must keep a stable authenticated identity must not call endpoints that Set-Cookie for a different user. Use Bearer header + immediately-disposed contexts for cross-user creation calls inside global setup.

<!-- /entry -->

<!-- entry:G-testing-2026-06-02-003 -->
---
id: G-testing-2026-06-02-003
type: gotcha
domain: testing
tags: [playwright, q-expansion-item, visibility, collapsed, strict-mode, quasar]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Collapsed q-expansion-item content is in the DOM but `display:none` — visibility specs fail until expanded — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-15)

**Problem:** Wrapping page sections in `<q-expansion-item>` (collapsed by default) leaves their content (`q-select`, `q-banner`, `q-btn`, `q-chip`) rendered in the DOM but `display: none`. Every E2E test asserting `.toBeVisible()` inside such a section fails simultaneously with "Received: hidden".

**Fix:** Expand the section first with a helper before any assertion inside it:

```ts
await page.goto('/#/settings')
await openSettingsSection(page, 'AI Provider (BYOK)')  // clicks header, waits for slide settle
```

Pass the exact label from the `q-expansion-item`. **Secondary trap — nested expansions:** when a parent expansion contains a child expansion, `.locator('.q-expansion-item').filter({ hasText: 'inner label' })` matches both (the outer's body transitively contains the inner's text). Append `.last()` to pick the inner one.

**Rule:** Any UI restructure that wraps content in a collapsible container requires an E2E sweep — every test targeting content inside needs an explicit expand step, and nested-expansion locators need `.last()`.

<!-- /entry -->

<!-- entry:G-testing-2026-06-02-004 -->
---
id: G-testing-2026-06-02-004
type: gotcha
domain: testing
tags: [playwright, vite, hmr, networkidle, wait-strategy, websocket]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## waitForLoadState('networkidle') hangs against a Vite dev server — HMR WebSocket never idles — 2026-06-02 · Claude (migrated from legacy archive, orig. pre-versioned)

**Problem:** `page.waitForLoadState('networkidle')` hangs for the full timeout. Vite's HMR keeps a persistent WebSocket connection open, so Playwright never observes "no connections for 500ms".

**Fix:** Wait on a specific signal instead — a known API response or an expected DOM element:

```ts
await Promise.all([
  page.waitForResponse(resp => resp.url().includes('/api/resource')),
  page.goto('/#/page'),
])
// or: await page.waitForSelector('.vm-card')
```

**Rule:** Never use `networkidle` with a Vite dev server (or any app holding a persistent WebSocket). Wait on `waitForResponse()` for a specific call or `waitForSelector()` for an expected element.

<!-- /entry -->

<!-- entry:G-testing-2026-06-02-005 -->
---
id: G-testing-2026-06-02-005
type: gotcha
domain: testing
tags: [playwright, logout, session-revocation, storagestate, page-route, mock]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-testing-2026-06-02-001]
graduated_to: ""
---

## E2E logout tests that hit the real backend revoke the shared storageState token — 2026-06-02 · Claude (migrated from legacy archive, orig. pre-versioned)

**Problem:** A logout test calling the real backend triggers `deleteByUser()`, which revokes ALL sessions for that user — including the shared storageState token every other parallel test relies on. Every subsequent test then 401s.

**Fix:** Two layers. Use a fresh empty storageState for the logout test, and mock the logout endpoint so the backend never actually revokes:

```ts
test.describe('Logout', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/logout', route => route.fulfill({ status: 200, body: '{}' }))
    // ... login via API, set localStorage
  })
})
```

**Rule:** Never let an E2E logout test hit a real backend whose logout revokes all of a user's sessions. Mock the logout API with `page.route()` and isolate the test with an empty storageState.

<!-- /entry -->

<!-- entry:G-testing-2026-06-02-006 -->
---
id: G-testing-2026-06-02-006
type: gotcha
domain: testing
tags: [playwright, parallel-workers, single-session, node-env-test, shared-state]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-testing-2026-06-02-001]
graduated_to: ""
---

## Single-session enforcement cascades into mass 401s under parallel E2E workers — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-03-04)

**Problem:** The backend enforces single-session-per-user, so every `POST /api/auth/login` calls `sessionStore.deleteByUser(userId)`, revoking all prior sessions for that user. With parallel Playwright workers sharing a few accounts, each worker's login revokes every other worker's session — observed as 147/304 failures and 56,150 backend 401s. Signature: passes with `--workers=1`, fails with `--workers=4`; individual files pass in isolation; backend logs show mass 401s.

**Fix:** Three parts: (1) disable single-session in test mode — `const singleSession = process.env.NODE_ENV !== 'test'`; (2) never re-login as shared users during tests — read the token from `.auth/user.json` via `getPresetAdminToken()`; (3) use a dedicated `e2e-login-test` user for tests that perform real login flows so revocation only affects that one user.

**Rule:** Any backend security feature that mutates *shared* state (single-session revocation, lockout counters, rate limits) must be evaluated for parallel-E2E compatibility and given a `NODE_ENV=test` bypass when it breaks concurrent workers. This is not weakening security — parallel workers legitimately share accounts in ways real users never would.

<!-- /entry -->

<!-- entry:G-testing-2026-06-02-007 -->
---
id: G-testing-2026-06-02-007
type: gotcha
domain: testing
tags: [playwright, tocontaintext, innertext, css-visibility, collapsed]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-testing-2026-06-02-003]
graduated_to: ""
---

## toContainText uses innerText and respects CSS visibility — hidden/collapsed content is never found — 2026-06-02 · Claude (migrated from legacy archive, orig. pre-versioned)

**Problem:** `toContainText` reads `innerText`, which honors CSS visibility. Text inside a collapsed accordion or `display:none`/`visibility:hidden` element is in the DOM but is not matched, so the assertion fails even though the content "exists".

**Fix:** Expand or reveal the element before asserting, or assert against `textContent` (which ignores CSS visibility) when you genuinely need to match hidden content.

**Rule:** Reach for `toContainText` only for *visible* text. For content that may be collapsed/hidden, expand it first (see the q-expansion-item gotcha) or switch to a `textContent`-based assertion.

<!-- /entry -->

<!-- entry:G-testing-2026-06-02-008 -->
---
id: G-testing-2026-06-02-008
type: gotcha
domain: testing
tags: [vitest, nested-package, config-resolution, include, monorepo]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-testing-2026-06-02-002]
graduated_to: ""
---

## vitest inherits the parent config when run inside a nested package — "No test files found" — 2026-06-02 · Claude (migrated from legacy archive, orig. pre-versioned)

**Problem:** A nested package (e.g. `code/codebase-mcp/`) runs `vitest run` from its own directory. vitest walks up the tree until it finds a config, lands on the project root's `vitest.config.ts`, and applies its `include: ['testing/unit/**/*.spec.ts']`. The nested package's own tests in `src/` match nothing, so vitest exits `No test files found, exiting with code 1`.

**Fix:** Add a `vitest.config.ts` at the nested package root with the correct `include` and `environment` for that package. The local config takes precedence over the parent's.

**Rule:** Any package nested inside a larger vitest project must have its own `vitest.config.ts`. Without it, vitest silently inherits the parent's `include` pattern, which almost never matches the nested package's test layout.

<!-- /entry -->

<!-- entry:G-testing-2026-06-02-009 -->
---
id: G-testing-2026-06-02-009
type: gotcha
domain: testing
tags: [engram-ui, e2e, playwright, q-tabs, strict-mode, v-show, first]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## Engram-UI renders two `.q-tabs` bars at once — mode-tab lookups need `.q-tabs.first()` — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-17)

**Problem:** engram-ui specs fail strict-mode with `locator('.q-tabs') resolved to 2 elements` and `getByRole('tab', { name: /knowledge/i }) resolved to 2 elements`. The layout renders two `q-tabs` bars simultaneously: the mode bar (Knowledge / Graph / Engram) and the MonitorPanel's internal bar (Status / Knowledge / Registry / Query Log / Ingestion). The MonitorPanel "Knowledge" tab — and partially "Knowledge Registry" — also match `/knowledge/i`. `v-show` keeps inactive mode panels mounted, so buttons shared across panels (Ingest, New dataset) also resolve to 2–3 elements.

**Fix:** Scope mode-tab lookups to the first `.q-tabs`, and use `.first()` for shared buttons:

```ts
const getModeTabBar = (page) => page.locator('.q-tabs').first()
getModeTabBar(page).getByRole('tab', { name: /knowledge/i })
page.getByRole('button', { name: /ingest/i }).first()
```

**Rule:** Every engram-ui spec that targets a mode tab by name MUST scope to `.q-tabs.first()`; any button appearing in multiple `v-show` mode panels MUST use `.first()` or be scoped to the visible panel.

<!-- /entry -->

<!-- entry:G-testing-2026-06-02-010 -->
---
id: G-testing-2026-06-02-010
type: gotcha
domain: testing
tags: [engram-ui, e2e, playwright, q-drawer, q-list, sentinel, panel-assertion]
since_version: "1.0.5"
status: active
scope: project
related: [G-testing-2026-06-02-009]
graduated_to: ""
---

## Engram-UI DatasetList renders in a `q-drawer` with a plain div, not `q-list` — assert on the drawer + header text — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-17)

**Problem:** `page.locator('.q-list, [data-testid="dataset-list"]')` finds nothing for the DatasetList panel. `DatasetList.vue` renders inside a `q-drawer` with a plain `<div>` outer wrapper — `q-list` only appears conditionally inside other panels (Activity, ApiKeys, DatasetFiles), not here.

**Fix:** Assert on the drawer and the component's always-present header sentinel instead of a child list element:

```ts
await expect(page.locator('.q-drawer')).toBeVisible()
await expect(page.getByText('Datasets')).toBeVisible()
```

**Rule:** When checking whether a panel is rendered, verify the component's actual outer element or an always-visible header sentinel — never a child list component that is only conditionally rendered.

<!-- /entry -->

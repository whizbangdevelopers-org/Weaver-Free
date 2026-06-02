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

<!-- entry:L-testing-2026-06-02-001 -->
---
id: L-testing-2026-06-02-001
type: lesson
domain: testing
tags: [e2e, playwright, triage, flake, root-cause, parallel-workers]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-testing-2026-06-02-005, G-testing-2026-06-02-006]
graduated_to: ""
---

## E2E failures cluster into five root-cause categories — triage by pattern, not by test — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-24)

**Root cause:** After a large feature wave broke 14 E2E tests, all 14 fell into exactly five root-cause categories, not 14 independent bugs: (1) **Environment mismatch** — test data didn't match env defaults (bridge gateway `10.10.0.1` enforces the `10.10.0.x` subnet, so off-subnet VM IPs return 400/422); (2) **Shared-state contamination** — mutating a shared test user (role change → `sessionStore.deleteByUser`) invalidates every parallel test using that user's storageState; (3) **Tier/feature-gate change** — a feature moved behind a higher tier, so element-count assertions drift; (4) **Auth plumbing** — the Playwright `request` fixture does not send storageState cookies for API calls, so API-level tests 401 without an explicit `Authorization: Bearer` header; (5) **Race conditions** — `fullyParallel: true` runs every test concurrently, so create-then-read sequences need `test.describe.configure({ mode: 'serial' })`.

**Rule:** When a wave of E2E tests breaks at once, classify each failure into the five categories before fixing anything — the category dictates the fix and reveals that N failures are usually 1–5 causes. Never mutate shared seed users or seed VMs; use `createTempUser`/`cleanupTempUser` and `createTempVm`/`cleanupTempVm` for state-mutating tests. Build the triage into tooling (`analyze-results.sh` categorizes `test-results.json`; `detect-flaky.sh [N] [spec]` reruns to surface mixed pass/fail).

**Why this shape wins:** Pattern-first triage turns "14 broken tests" into "4 environment + 3 tier + … " — a tractable list of root causes instead of a queue of symptoms. The categories are durable: each new wave maps onto the same five, so the checklist compounds in value and the analyzer script keeps paying off every release.

<!-- /entry -->

<!-- entry:L-testing-2026-06-02-002 -->
---
id: L-testing-2026-06-02-002
type: lesson
domain: testing
tags: [e2e, playwright, storagestate, pinia, global-setup, initialized]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-testing-2026-06-02-008]
graduated_to: ""
---

## E2E storageState must mirror the full store shape — a pre-seeded `initialized: true` skips all runtime fetches — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-20)

**Root cause:** `global-setup.ts` writes Playwright storageState with a pre-seeded Pinia store in localStorage. The store's `initialize()` action bails early on `if (this.initialized) return`, so whatever fields the seed contains are the *only* fields the app ever sees — runtime `/api/health` fetches never run. Seeding `{ initialized: true, tier }` but omitting `host`, `provisioningEnabled`, `bridgeGateway`, `hasServerKey` left those `null` for the whole run; components guarded by `v-if` on a missing field never rendered, timing out every test that depended on them. A second trap: storageState files that reference a shared `appStoreValue` derived from the health fetch must be built *after* the fetch — getting the declaration order wrong throws `Cannot access 'healthData' before initialization` and silently writes no file for operator/viewer.

**Rule:** Seed the **complete** store shape — every field the health endpoint returns — into storageState, extracted into one shared object reused by all role files. When you add a store field populated from `/api/health`, add it to the `healthData` object in `global-setup.ts` in the same commit. Enforce execution order: register+login admin → fetch health → build shared store value → register+write operator/viewer → write admin.

**Why this shape wins:** Because `initialized: true` is an absorbing state, the seed *is* the app's entire view of host config — partial seeds fail silently as timeouts, the worst failure mode to debug. One shared, complete store object keeps all three role files consistent and turns "why is this component missing" into a one-line diff against the health response.

<!-- /entry -->

<!-- entry:L-testing-2026-06-02-003 -->
---
id: L-testing-2026-06-02-003
type: lesson
domain: testing
tags: [e2e, playwright, pinia, websocket, store-population, navigation]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## Trace where store data comes from before E2E-navigating directly to a page — population can be page-specific — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-20)

**Root cause:** `vmStore.vms` is populated by a `watch()` in a *specific* page component that syncs WebSocket `vm-status` messages into Pinia — it only runs while that page is mounted. An E2E test that `page.goto()`'d directly to `/#/network` never mounted the page with the watcher, so the store stayed empty and a `QSelect` reading `vmStore.vms` rendered with zero options. There was no error — just an empty dropdown.

**Rule:** Before writing an E2E test that depends on store data, trace the data's source. If population is page-specific (a watcher in one page component rather than a global plugin/router guard), the test must first visit the populating page, wait for the data to confirm delivery (e.g. `.vm-card` visible), then SPA-navigate to the target. In-memory stores (no `persist: true`) survive hash navigation but not a full reload.

**Why this shape wins:** Tracing the data path turns a silent empty-state failure into a deliberate navigation step. It also surfaces an architectural smell — if many pages need the data, the WebSocket→store sync belongs in a global composable or router guard, not a single page's `watch`.

<!-- /entry -->

<!-- entry:L-testing-2026-06-02-004 -->
---
id: L-testing-2026-06-02-004
type: lesson
domain: testing
tags: [e2e, playwright, route-mocking, page-route, ui-state-coverage]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Mock a single bootstrap endpoint with page.route() to unlock UI states the test environment can't produce — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-23)

**Root cause:** The Create-VM dialog only appears when `provisioningEnabled: true` and tier is high enough — but the E2E Docker environment has provisioning disabled (no bridge), so the button never rendered and five validation rules had zero coverage. The UI states weren't untestable in principle; the environment just couldn't *produce* the precondition the app reads at bootstrap.

**Rule:** When a UI path is gated on environment state the test harness can't supply, mock the single endpoint the app reads that state from with Playwright `page.route()` — e.g. fulfill `**/api/health` with `provisioningEnabled: true` + `bridgeGateway`. The rest of the app keeps hitting real endpoints (the VM list still loads from real `/api/workload`), so only the gated path changes. Same pattern unlocks setup-mode forms by mocking `**/api/auth/setup-required`.

**Why this shape wins:** Mocking one bootstrap endpoint is surgical — it flips exactly the precondition that gates the UI without standing up real infrastructure (a bridge network) and without disabling the rest of the integration test. It converts "this state is untestable in Docker" into a two-line route stub, recovering coverage for validation rules that would otherwise ship unverified.

<!-- /entry -->

<!-- entry:L-testing-2026-06-02-005 -->
---
id: L-testing-2026-06-02-005
type: lesson
domain: testing
tags: [e2e, rate-limit, flake, helper, env-bypass, centralization]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## Centralize rate-limit config behind a helper so the E2E/dev bypass can't be forgotten — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-23)

**Root cause:** Eight routes used inline `config: { rateLimit: { max: 5, timeWindow: '1 minute' } }` instead of the centralized `createRateLimit()` helper. The helper checks `DISABLE_RATE_LIMIT` and raises the cap to ~1,000,000 in dev/E2E; inline configs bypass that check and enforce a hard cap, so any route hit more than `max` times per minute flaked under parallel test runs.

**Rule:** Every route's rate-limit config must go through `createRateLimit(N)` — never an inline `{ max, timeWindow }` object. The route-auth scanner flags inline configs as `INLINE_RATELIMIT` warnings that block a clean pass, so the bypass is enforced rather than remembered.

**Why this shape wins:** A single helper is the one place the test-mode bypass lives, so it can't drift per-route. The scanner makes the convention load-bearing — new routes that hand-roll a limit are caught at audit time, before they can introduce an intermittent E2E flake that reads like timing noise.

<!-- /entry -->

<!-- entry:L-testing-2026-06-02-006 -->
---
id: L-testing-2026-06-02-006
type: lesson
domain: testing
tags: [composite, test-strategy, pyramid, npm-scripts, precommit, prepush]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Wire tests into a pyramid of nested composites so no suite is an orphan — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-24)

**Root cause:** ~18 individual test scripts had no coherent workflow — a developer had to know which to run when, and some suites (TUI, backend) were orphans included in no composite, so their regressions were caught late or never. "Invisible tests" are tests that exist but nothing runs automatically.

**Rule:** Define a small set of composites that chain into each other and assign each suite to exactly one tier by cost/value: `precommit` = lint + typecheck + unit + backend + TUI (fast, every commit); `prepush` = precommit + security + compliance; `prerelease` = prepush + E2E. The sub-composite (`compliance` = all static auditors) folds into `prepush` so every push is auditor-verified without anyone remembering individual scripts. Every new test script must be added to the appropriate composite — an orphan test is an invisible test.

**Why this shape wins:** Nesting makes the gates self-documenting and cumulative — running the outer composite guarantees the inner ones ran, so there's one command per lifecycle stage instead of a checklist. Tiering by per-run cost (backend/TUI per-commit because a late backend bug costs far more than the seconds it adds) keeps the fast loop fast while still catching regressions early.

<!-- /entry -->

<!-- entry:L-testing-2026-06-02-007 -->
---
id: L-testing-2026-06-02-007
type: lesson
domain: testing
tags: [vitest, fetch, mock, response-queue, graceful-degradation, stubglobal]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Count a function's fetch calls before testing it — N sequential calls need an N-entry response queue — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-01)

**Root cause:** A function that makes sequential `fetch` calls (e.g. `/health` then `/api/v1/datasets`) can't be tested with a single `mockResolvedValue` — the second call gets the same response as the first, masking branch-specific behavior. The number of mocked responses must match the number of calls.

**Rule:** Count the `fetch` calls a function makes before writing its test. A single-call function uses `vi.fn().mockResolvedValue(...)`; an N-call function needs an N-entry response-queue helper that advances an index per call and falls back to the last entry when exhausted. For graceful-degradation clients, test all three branches: happy path, non-OK HTTP status (returns an `{ available: true, error }`-style object, does **not** throw), and network error via `mockRejectedValue` (returns `{ available: false, error }`, does **not** throw) — the non-throwing contract is what callers depend on. Stub with `vi.stubGlobal('fetch', mockFn)` in `beforeEach` and `vi.unstubAllGlobals()` in `afterEach` so scope is per-test (Node's native `fetch` lives on `globalThis`).

**Why this shape wins:** The response queue makes each branch of a multi-call function independently exercisable, and explicitly testing the two degradation branches pins the load-bearing "never throws" contract that callers rely on when they can't probe sidecar availability ahead of time. Per-test stub/unstub prevents fetch mocks from bleeding across tests.

<!-- /entry -->

<!-- entry:L-testing-2026-06-02-008 -->
---
id: L-testing-2026-06-02-008
type: lesson
domain: testing
tags: [vitest, playwright, test-count, reporter-json, metrics, regex]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Count tests with the runner's own JSON reporter, not a regex over spec files — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-23)

**Root cause:** Regex-counting `it(`/`test(` declarations approximates runtime test count but undercounts parameterized tests — each `describe.each`/`it.each(rows, …)` is one regex match but N runtime tests. The delta is small at first (backend 848 regex vs 852 vitest) but grows silently as parameterized tests spread.

**Rule:** For any test number that ships to investors, customers, or public claims, measure with the runner's own reporter, not pattern matching: vitest `run --reporter=json` → `.numTotalTests`; Playwright `test --list --reporter=json` (counts without executing); Jest/Mocha have JSON reporters with a total-tests field. Record the method per number in the generated artifact (`methods: { unit: "vitest-json", e2e: "regex-authoritative" }`) so downstream consumers can decide whether a number is citable. Shell out to the reporter once per generator invocation (it runs the full suite — slow), keeping regex only as a fallback for environments where the runner can't run.

**Why this shape wins:** The reporter is the authoritative source — it counts what actually executes, including `.each` expansions, so it can't drift from reality the way a regex does. Tagging each number with its provenance lets investor-grade claims cite only authoritative methods while approximate contexts can still use the cheap fallback.

<!-- /entry -->

<!-- entry:L-testing-2026-06-02-009 -->
---
id: L-testing-2026-06-02-009
type: lesson
domain: testing
tags: [playwright, testignore, env-gated, specialized-specs, demo-screenshots]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Conditional testIgnore for specialized specs — env-var gated, not unconditional — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-06-02)

**Root cause:** Demo-mode screenshot specs need a static SPA server on :9030 that doesn't exist during normal E2E runs. An unconditional `testIgnore` blocks the spec even when it's explicitly named on the CLI — there's no way to opt back in for the one run that has the server.

**Rule:** Gate `testIgnore` on an env var so the spec is excluded by default but runnable on demand:
```typescript
testIgnore: process.env.DEMO_SCREENSHOTS ? [] : ['**/demo-screenshots.spec.ts'],
```
Plumb the variable through the Docker compose service (`DEMO_SCREENSHOTS=${DEMO_SCREENSHOTS:-}`) so it flows from the host to the test container.

**Why this shape wins:** The env gate keeps the default run fast and stable (specialized specs excluded) while preserving an explicit opt-in path — you never have to comment/uncomment the ignore list or maintain a separate config for the one environment that can run the spec.

<!-- /entry -->

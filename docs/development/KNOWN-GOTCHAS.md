<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Known Gotchas

Universal stack gotchas for Quasar + Fastify + NixOS projects. These are detailed "why" explanations behind the rules in `.claude/rules/`. Read on demand when debugging — not loaded automatically.

> **How to use:** Rules files reference specific sections here. When a rule fires but you need more context to debug, read the relevant section.
>
> **Graduation:** When a new project-specific lesson proves universal, move it here from `LESSONS-LEARNED.md`.

---

## Frontend

### q-badge Renders Label Twice
**Problem:** Using both `:label` prop and slot content on `q-badge` renders the text twice.
**Fix:** Use slot content only, never the `:label` prop when you have slot content.
**Rule:** `q-badge`: slot content only, NOT `:label` + slot.

### q-input inheritAttrs and E2E Test Selectors

**Problem:** `page.getByTestId('my-input').locator('input')` and `page.locator('[data-testid="my-input"] .cursor-pointer')` time out despite elements being visible.

**Root cause:** Quasar's `q-input` (and `q-field`) uses `inheritAttrs: false` in Vue 3. Non-prop attributes like `data-testid` land on the native `<input>` element via `$attrs`, not the component's wrapper div. So `[data-testid="my-input"]` selects the `<input>`, and descendant selectors find nothing.

**Fix:** Use CSS `:has()` to find the wrapper from the input, or use Playwright role-based locators:
```typescript
// Instead of: page.locator('[data-testid="my-input"] .cursor-pointer')
page.locator('.q-field:has(input[autocomplete="current-password"]) .cursor-pointer')
// Or role-based:
page.getByRole('textbox', { name: 'Username' }).fill(text)
```

### vue-tsc vs tsc

**Problem:** `npx tsc --noEmit` produces TS2307 errors for every `.vue` import. All files exist and path aliases are correct.

**Root cause:** Bare `tsc` has no SFC awareness. The project uses `vue-tsc` (wraps TypeScript with `@vue/language-core` / Volar) to type-check `.vue` files. Quasar CLI generates `.quasar/tsconfig.json` with additional type references.

**Rule:** Always `npm run typecheck` (runs `vue-tsc`). Never bare `tsc --noEmit` for the frontend.

### Axios Error Messages Are Generic

**Problem:** Axios throws `AxiosError` on 4xx/5xx. The `.message` property is always generic ("Request failed with status code 400"), while the actual backend error is in `.response.data.error`.

**Fix:** Centralized `extractErrorMessage(err, fallback)` utility in `src/utils/error.ts`:
```typescript
import axios from 'axios'
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined
    if (data && typeof data.error === 'string') return data.error
    if (data && typeof data.message === 'string') return data.message
  }
  if (err instanceof Error) return err.message
  return fallback
}
```

### q-menu Inside q-btn: Double-Toggle

**Problem:** `q-menu` as a direct child of `q-btn` opens and immediately closes on click. The button's `@click` handler toggles the `v-model`, then Quasar's auto-registered handler toggles it back.

**Root cause:** When `q-menu` is a direct child of `q-btn`, Quasar auto-registers a click handler on the parent to toggle the menu. An explicit `@click` on the same `q-btn` fires first, then the auto-handler fires — net effect is a double-toggle (open → close).

**Fix:** Never combine `@click` toggle logic with `q-menu v-model` on the same `q-btn`. Let `q-menu` manage its own toggle:
```vue
<!-- BAD: double-toggle -->
<q-btn @click="showMenu = !showMenu">
  <q-menu v-model="showMenu">...</q-menu>
</q-btn>

<!-- GOOD: q-menu handles toggle -->
<q-btn>
  <q-menu v-model="showMenu">...</q-menu>
</q-btn>
```

### q-virtual-scroll Inside q-menu: Zero Height

**Problem:** `q-virtual-scroll` inside a `q-menu` popup renders nothing — the list appears empty despite having items.

**Root cause:** `q-virtual-scroll` requires explicit container dimensions to calculate visible items. Inside a `q-menu` with few items, the container has zero height, so the virtual scroller computes zero visible rows.

**Fix:** Replace with a plain scrollable div and `v-for` for small lists where virtualization isn't needed:
```vue
<!-- BAD: zero-height virtual scroll -->
<q-menu>
  <q-virtual-scroll :items="items">...</q-virtual-scroll>
</q-menu>

<!-- GOOD: simple scrollable list -->
<q-menu>
  <div style="max-height: 400px; overflow-y: auto">
    <q-item v-for="item in items" :key="item.id">...</q-item>
  </div>
</q-menu>
```

### QPage Outside Layout

**Problem:** Any page component loaded outside `MainLayout` (e.g., login page at `/login`) cannot use `<q-page>` — it requires a `<q-layout>` ancestor.

**Fix:** Use `<div class="flex flex-center" style="min-height: 100vh">` instead of `<q-page>`.

### String Literal Vocabulary Drift

**Problem:** Tier names ('premium'→'weaver'), role names, status values appear as string literals in hundreds of locations across three independent codebases (frontend, backend, TUI). When a vocabulary term is renamed, some files get updated and others don't. TypeScript can't catch a valid string that's the wrong string.

**Root cause:** No single source of truth for vocabulary terms. Each codebase independently declared `type Tier = 'demo' | 'free' | 'premium' | 'enterprise'` and scattered the literal values across comparisons, props, and config objects.

**Fix:** `src/constants/vocabularies.ts` — shared constants file with typed exports:
```typescript
export const TIERS = { DEMO: 'demo', FREE: 'free', SOLO: 'weaver', FABRICK: 'fabrick' } as const
export type TierName = typeof TIERS[keyof typeof TIERS]
```

Three copies (frontend, backend, TUI) kept in sync by `npm run audit:vocabulary` (16th compliance auditor). The auditor also scans for bare string literals that should use the constants, reporting them as warnings for incremental migration.

**Convention:** If a string value can be renamed, it must be a constant. Import `TIERS.SOLO` instead of writing `'weaver'`. This applies to: tier names, role names, status values, provisioning states.

### ESLint 9 Flat Config — Vue + TypeScript Setup

**Problem:** ESLint 9 dropped legacy `.eslintrc.*` config format. The flat config (`eslint.config.mjs`) requires different patterns for Vue + TypeScript.

**Key differences from legacy config:**
- `extends` → spread configs directly: `...pluginVue.configs['flat/essential']`, `...tseslint.configs.recommended`
- `ignorePatterns` → `{ ignores: [...] }` as first array entry
- `env` → `languageOptions.globals` (no more `env: { browser: true }`)
- `parser` / `parserOptions.parser` → `languageOptions.parser` + `languageOptions.parserOptions.parser`
- `plugins` array → implicit from spread configs
- `--ext .js,.ts,.vue` CLI flag → not needed (flat config handles file matching)

**Vue parser ordering:** `tseslint.configs.recommended` must come BEFORE `pluginVue.configs['flat/essential']` in the array. Then add a `.vue` file override that explicitly sets `vue-eslint-parser` with `@typescript-eslint/parser` as the nested parser. Without this, TS parser tries to parse Vue templates and fails with "Type expected."

**`@typescript-eslint/no-unused-vars` catch clause:** v8 requires `caughtErrorsIgnorePattern: '^_'` in addition to `argsIgnorePattern` and `varsIgnorePattern`. Without it, `catch (_err)` is flagged.

**`@typescript-eslint/no-empty-object-type`:** New rule in v8, flags `{}` type. Common in Vue/Quasar generics. Disable with `'@typescript-eslint/no-empty-object-type': 'off'` if your codebase uses `{}` in type params.

**`eslint-plugin-vue@10`:** Requires `vue-eslint-parser@^10` as explicit peer dep (was implicit in v9). Add both to `devDependencies`.

**CJS files:** v8 adds `@typescript-eslint/no-require-imports`. Config files like `quasar.config.cjs` need a `{ files: ['**/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } }` override.

**Backend separate config:** Backend should have its own `eslint.config.mjs` (no Vue parser needed). ESLint 9 does NOT auto-inherit parent configs in the same way.

### Help Page (and Similar Content Pages) Must Be Version-Gated

**Problem:** Static help/FAQ content written as a comprehensive reference manual across all planned versions (v1.0–v3.3) ships features to users that don't exist yet. Users see documentation for containers, Shed, Loom, Fabrick fleet, etc. at v1.0.

**Root cause:** Content pages are often written all at once during planning and never revisited for version gating. Unlike feature pages (WeaverPage, SettingsPage) where `v-if` guards are natural, static data arrays fly under the radar.

**Fix:** Add `minVersion?: string` to each content item (Q&A, changelog entry, feature list). Use a computed filter that gates items before rendering — version gate first, then search/filter. Items without `minVersion` default to `'1.0'`. In demo mode, gate against `appStore.isDemoVersionAtLeast()`; in production, gate against `__APP_VERSION__`.

**Rule:** Any page that describes features across multiple versions must version-gate its content items, not just its interactive UI elements. Applies to: HelpPage, changelog, feature matrices, onboarding wizards.

### API Service Calls in Sub-Components Must Have Demo Mode Guards

**Problem:** Clicking Settings in the sidebar briefly flashes the page, then redirects to Weaver. Happens every time in both public and private demo.

**Root cause:** `TagManagement.vue` (a sub-component of SettingsPage) called `presetTagApiService.getAll()` on mount without an `isDemoMode()` guard. In demo mode there is no backend, so: `GET /api/tags` → 401 → axios interceptor tries refresh → 401 → `clearStoredAuth()` + `router.push('/login')` → demo router guard auto-authenticates → redirects to `/weaver`. The redirect chain is invisible except for a brief flash.

**Fix:** Add `if (isDemoMode()) { return mockData }` at the top of every API-calling function in sub-components, same as composables and page-level code already do.

**Rule:** Every function that calls an API service (not a composable with built-in demo guards) must check `isDemoMode()` before making the call. Sub-components are the most common miss — the parent page may be demo-aware, but child components that import API services directly often skip the guard. Audit pattern: `grep -r 'ApiService\.' src/components/ | grep -v isDemoMode`.

### Quasar useMeta() eagerly evaluates the getter — watch for TDZ on forward refs

**Problem:** `useMeta(() => ({ title: pageTitle.value }))` in a Vue 3 `<script setup>` block synchronously evaluates the getter once to set the initial `<title>`. If the getter reads a `const` that's declared LATER in the setup block, you get:

```
ReferenceError: Cannot access 'appName' before initialization
```

The entire setup function throws. Exposed bindings (`appStore`, `authStore`, etc.) never reach the render context, so the error surfaces as `Cannot read properties of undefined (reading 'isFabrick')` on whatever template expression hits the empty context first — a misleading downstream symptom.

**Root cause:** Normal `computed(() => ...)` is lazy — the body runs only on first `.value` access. But `useMeta` (and similar eager consumers like `watchEffect` with `{ immediate: true }`, or onMounted composables that prefill state) call the getter right away. That turns declaration order into a correctness issue: any `const` the getter transitively reads must be declared BEFORE the eager call.

**Fix:** Move the eager call below all its transitive dependencies, OR restructure so the dependent const is declared first.

```ts
// BEFORE (broken):
const pageTitle = computed(() => appName.value + ' — ' + route.params.name)
useMeta(() => ({ title: pageTitle.value }))  // ← evals NOW, appName in TDZ
// ... 90 lines later ...
const appName = computed(() => 'Weaver Solo')

// AFTER:
const pageTitle = computed(() => appName.value + ' — ' + route.params.name)
// ... other consts ...
const appName = computed(() => 'Weaver Solo')
useMeta(() => ({ title: pageTitle.value }))  // ← now appName is initialized
```

**Rule:** Treat any composable that takes a getter and "reads initial value" (`useMeta`, `useHead`, `watchEffect { immediate: true }`, any onMounted that prefills) as if it calls the getter synchronously at declaration. Declare dependencies of that getter above the call. Add a `// eager: depends on X declared above` comment when the order is load-bearing.

**Debugging tip:** When a "missing field on store" error makes no sense from static analysis (the store IS in scope, the declaration IS there), the store probably isn't the thing that's undefined — setup itself threw earlier and the render context is empty. Look for TDZ errors in the browser console upstream of the visible symptom. Playwright traces (`resources/*.trace` in the trace.zip) capture full console error stacks.

---

## Backend

### fastify-type-provider-zod Validation Errors Bypass error.validation

**Problem:** Custom error handler checks `error.validation` to detect Zod validation failures, but Fastify's `wrapValidationError` returns ZodErrors directly (via the `instanceof Error` path) WITHOUT setting `.validation`.

**Root cause:** In Fastify 4 + `fastify-type-provider-zod` v1.2.0, the `validatorCompiler` returns `{ error: zodError }`. Fastify extracts `.error` (a ZodError, which extends Error). `wrapValidationError` sees `result instanceof Error` → returns it with `statusCode=400` but never sets `.validation`. Result: the custom error handler's `.validation` check is always `false` for Zod errors.

**Fix:** Detect ZodErrors by their `.issues` array property:
```typescript
const zodIssues = (error as Record<string, unknown>).issues
if (error.validation || (Array.isArray(zodIssues) && zodIssues.length > 0)) {
  const issues = Array.isArray(zodIssues) ? zodIssues : []
  const messages = issues.map(i => String(i.message ?? '')).filter(Boolean)
  return reply.status(400).send({
    error: 'Validation failed',
    details: messages.length > 0 ? messages : ['Invalid request data'],
  })
}
```

**Frontend:** `details` is now a string array — use `Array.isArray(data?.details)` and `.join('. ')`.

### Zod Response Schemas Must Cover Error Codes

**Problem:** Fastify with `fastify-type-provider-zod` validates ALL responses. If a route defines `response: { 200: schema }` and sends `reply.status(404).send({ error: '...' })`, TypeScript rejects the `error` property.

**Fix:** Add explicit schemas for each error status:
```typescript
const errorResponseSchema = z.object({ error: z.string() })
response: { 200: successSchema, 404: errorResponseSchema, 403: errorResponseSchema }
```

### Fastify Plugin Scope Isolation

**Problem:** WebSocket plugins registered inside a scoped plugin are invisible to sibling plugins.

**Fix:** Register `@fastify/websocket` and shared infrastructure at root scope.

**Rule:** WebSocket and shared plugins register at root scope.

### Rate Limit Per-Route Override

**Problem:** Global rate limit set to 1M in test mode, but per-route `config: { rateLimit: { max: 10 } }` completely replaces global config. Tests hit 429 after 10 calls.

**Fix:** Extract per-route config to a shared constant that checks `NODE_ENV`:
```typescript
const authRateLimit = { max: process.env.NODE_ENV === 'test' ? 1_000_000 : 10, timeWindow: '1 minute' }
```

### Fastify Plugin Version Mismatch

**Problem:** `@fastify/<plugin>@N` targets Fastify `N-1`. Installing the wrong major version only shows up in Docker (fresh `npm ci`), not locally.

**Convention:** Always check peer deps before installing. Current baseline (Fastify 5):

| Plugin | Version | Fastify |
|--------|---------|---------|
| @fastify/compress | 8.x | 5 |
| @fastify/cors | 11.x | 5 |
| @fastify/helmet | 13.x | 5 |
| @fastify/rate-limit | 10.x | 5 |
| @fastify/static | 9.x | 5 |
| @fastify/websocket | 11.x | 5 |

### Fastify 5 requires decorateRequest for custom properties

**Problem:** Fastify 5 enforces property shape optimization. Setting custom properties on `request` (e.g., `request.userId`) without prior `decorateRequest()` call may throw or behave incorrectly.

**Fix:** Call `decorateRequest()` for each custom property immediately after creating the Fastify instance, before any hooks or route registration:
```typescript
fastify.decorateRequest('userId', undefined)
fastify.decorateRequest('userRole', undefined)
```

The TypeScript `declare module 'fastify'` augmentation stays as-is — it handles types; `decorateRequest()` handles the runtime shape.

**Test impact:** Every test file that creates its own Fastify instance AND uses custom request properties (via auth middleware or manual hook assignment) needs matching `decorateRequest()` calls.

### fastify-type-provider-zod version ceiling

**Problem:** `fastify-type-provider-zod` v5+ requires Zod 4 (`zod@>=3.25.56` which is Zod v4's npm range). If the project uses Zod 3, the ceiling is `fastify-type-provider-zod@4.0.2`.

**Key change in v4:** Validation errors are now wrapped as `ZodFastifySchemaValidationError` objects on `error.validation` (the standard Fastify property). The old v1 pattern of checking `error.issues` directly no longer works. Use `error.validation` and access `.message` on each entry:
```typescript
if (error.validation) {
  const messages = error.validation
    .map((v: { message?: string }) => v.message ?? '')
    .filter(Boolean)
  return reply.status(400).send({ error: 'Validation failed', details: messages })
}
```

The library also exports `hasZodFastifySchemaValidationErrors(error)` as a type-safe alternative.

### Fastify 5 error handler types error as unknown

**Problem:** In Fastify 5, `setErrorHandler` defaults `TError` to `unknown`. Accessing `error.validation`, `error.statusCode`, or `error.message` without a type annotation causes TS18046.

**Fix:** Explicitly type the error parameter:
```typescript
import Fastify, { type FastifyError } from 'fastify'
fastify.setErrorHandler((error: FastifyError, request, reply) => { ... })
```

### pino-pretty Startup Crash

**Problem:** Backend crashes with "unable to determine transport target for pino-pretty" if it's missing.

**Fix:** It's a devDependency — install with `cd backend && npm install` (not `--production`). Don't ship in production; pino outputs JSON without it.

### Helmet CSP upgrade-insecure-requests

**Problem:** Accessing the dashboard via `http://localhost:3100` shows ServiceWorker errors. `@fastify/helmet` adds `upgrade-insecure-requests` to CSP by default, telling browsers to upgrade HTTP to HTTPS — but the backend serves over HTTP.

**Fix:** `upgradeInsecureRequests: null` in helmet config. HTTPS termination belongs at the reverse proxy.

---

## Testing

### Playwright `request` Fixture Inherits Spec storageState

**Problem:** Tests like `"GET /api/config returns 401 without auth"` fail with `Expected: 401, Received: 200` even though the test uses the default `request` fixture thinking it's unauthenticated.

**Root cause:** When a spec has `test.use({ storageState: '...json' })` — or inherits the global-setup default — Playwright's `request` fixture **automatically inherits those cookies**. With admin storageState loaded, every `request.get()` is already authenticated. Assertions that the endpoint returns 401 without auth always fail.

**Fix:** For any test asserting 401/403 without auth, construct a fresh request context with empty storage:

```ts
test('GET /api/config returns 401 without auth', async ({ playwright }) => {
  const ctx = await playwright.request.newContext({
    storageState: { cookies: [], origins: [] },
  })
  try {
    const res = await ctx.get(`${API_BASE_URL}/api/config`)
    expect(res.status()).toBe(401)
  } finally {
    await ctx.dispose()
  }
})
```

**Rule:** Never trust the default `request` fixture to represent an unauthenticated caller. Any 401/403-without-auth assertion must use a dedicated empty context.

### POST /api/auth/register Set-Cookie Replaces Caller's Session

**Problem:** Admin calls `POST /api/auth/register` to create a new user. Subsequent admin API calls on the same Playwright request context fail with 403. `global-setup.ts` registering operator → viewer → login-test all failed after the first call.

**Root cause:** The register endpoint sets `weaver_token` cookie for the **newly created user** in the response (not the authenticated caller). The Playwright request context captures Set-Cookie into its cookie jar, replacing the admin cookie with the new user's cookie. Subsequent requests then run as that new user, which lacks admin permissions.

**Fix:** Use a fresh `request.newContext({ extraHTTPHeaders: { Authorization: 'Bearer <admin-token>' }})` for each registration, dispose it immediately. Bearer header takes precedence over cookies in the auth middleware (`backend/src/middleware/auth.ts:76-80`), and disposable contexts keep the main context's cookie jar untouched:

```ts
async function registerAs(adminToken: string, creds: {...}, role: string) {
  const ctx = await playwrightRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${adminToken}` },
  })
  try {
    return await ctx.post('/api/auth/register', { data: { ...creds, role } })
  } finally {
    await ctx.dispose()
  }
}
```

**Rule:** Any Playwright request context that needs a stable authenticated identity must not call endpoints that Set-Cookie for a different user. Use Bearer header + disposable contexts for cross-user creation calls.

### Collapsed q-expansion-item Hides Content from Visibility Assertions

**Problem:** UI restructure wrapped every SettingsPage section in `<q-expansion-item>`, defaulting to collapsed. Content (q-select, q-banner, q-btn, q-chip) is rendered in the DOM but `display: none` until the section header is clicked. E2E tests asserting `.toBeVisible()` on elements inside the section fail with "Received: hidden".

**Fix:** Use the `openSettingsSection(page, label)` helper from `testing/e2e/helpers/index.ts`:

```ts
import { openSettingsSection } from './helpers'

test('...', async ({ page }) => {
  await page.goto('/#/settings')
  await waitForQuasarApp(page)
  await openSettingsSection(page, 'AI Provider (BYOK)')
  // now q-select, q-banner, etc. inside the section are visible
})
```

Pass the exact label from the `q-expansion-item` (`"AI Provider (BYOK)"`, `"Distributions & Image URLs"`, `"Notifications"`, `"License"`, `"Host Information"`, `"Tag Management"`).

**Secondary — strict-mode violations from nested expansions:** When a parent q-expansion-item contains a child q-expansion-item, `.locator('.q-expansion-item').filter({ hasText: 'inner label' })` matches both (the outer's body transitively contains the inner's text). Fix: append `.last()` to pick the inner one:

```ts
const addExpansion = distroSection.locator('.q-expansion-item').filter({ hasText: 'Add custom distribution' }).last()
```

**Rule:** Any UI restructure that wraps content in a collapsible container requires an E2E sweep of every test targeting content inside.

### Stale E2E Container Holds Port 9020

**Problem:** `run-tests.sh` fails with `ERROR: Port 9020 is occupied and cannot be freed`. The `kill-ports.sh` `lsof`+`kill` approach misses Docker containers using `network_mode: host` — they bind to the host port but `docker compose down` only cleans containers from the current profile, leaving `quasar-e2e-iterate` (from `detect-flaky.sh`) holding the port.

**Fix (automated):** `kill-ports.sh` now stops all containers matching `^(quasar-playwright|quasar-e2e)` by name before falling back to `kill -9` on lsof PIDs. This runs automatically before every `run-tests.sh` invocation.

**Manual recovery:** `docker stop quasar-e2e-iterate`

**Prevention:** Never leave `detect-flaky.sh` running in the background when starting a full test run.

### Root-Owned Vite Cache Breaks Live E2E

**Problem:** `npm run e2e:live` fails with `EACCES: permission denied, unlink '.q-cache/dev-spa/vite-spa/deps/_metadata.json'`. Playwright tries to start `npx quasar dev` as the webServer fallback, which fails because `.q-cache/` has root-owned files.

**Root cause:** Running `sudo npm run build` or any npm command as root writes Vite cache files owned by `root`. Subsequent runs as the dev user can't overwrite them.

**Fix:**
```bash
sudo chown -R mark:users /home/mark/Projects/active/fabrick-weaver-project/code/node_modules/.q-cache/
```

**Prevention:** Never run `npm run build` or `npm run dev` as root.

### Vite HMR Breaks networkidle

**Problem:** `page.waitForLoadState('networkidle')` hangs for 30 seconds. Vite's HMR WebSocket keeps a persistent connection open, so Playwright never sees "no connections for 500ms."

**Fix:** Use `waitForResponse()` on specific API calls or `waitForSelector()` on expected DOM elements:
```typescript
await Promise.all([
  page.waitForResponse(resp => resp.url().includes('/api/resource')),
  page.goto('/#/page'),
])
```

### storageState and Logout Session Revocation

**Problem:** E2E logout tests call the real backend. Backend's `deleteByUser()` revokes ALL sessions — including the shared `storageState` token. Every subsequent test gets 401.

**Fix:** Two layers:
1. Fresh token per-test via API login in `beforeEach`
2. Mock the logout endpoint with `page.route()` so backend never revokes sessions

```typescript
test.describe('Logout', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/logout', route =>
      route.fulfill({ status: 200, body: '{}' })
    )
    // ... login via API, set localStorage
  })
})
```

### Single-Session Enforcement Cascades Under Parallel Workers

**Problem:** Backend enforces single-session-per-user (`singleSession = true`). Every `POST /api/auth/login` calls `sessionStore.deleteByUser(userId)`, revoking ALL prior sessions for that user. With 4 parallel Playwright workers sharing 3 user accounts, each worker's login revokes every other worker's session — 147/304 test failures, 56,150 401 errors in backend logs.

**Root cause:** Session revocation is a server-side mutation of shared state. Unlike browser-side `storageState` (per-worker isolated), session validity is global. One worker logging in as `e2e-admin` invalidates every other worker's `e2e-admin` token.

**Diagnosis:** Tests pass with `--workers=1`, fail with `--workers=4`. Backend logs show mass 401 errors. Individual test files pass in isolation.

**Fix:** Three-part pattern:
1. Disable single-session in test mode: `const singleSession = process.env.NODE_ENV !== 'test'` in `backend/src/routes/auth.ts`
2. Never re-login as shared users during tests — use `getPresetAdminToken()` to read tokens from `.auth/user.json`
3. Use dedicated `e2e-login-test` user for tests that perform real login flows

**Rule:** Any backend security feature that mutates shared state (session revocation, account lockout counters, rate limits) must be evaluated for parallel E2E compatibility. If it breaks under concurrent workers, add a test-mode bypass.

### toContainText and CSS Visibility

**Problem:** `toContainText` uses `innerText`, which respects CSS visibility. Collapsed accordion content is NOT found.

**Fix:** Expand/show the element first, or use `textContent` assertions instead.

### storageState and API Requests

**Problem:** Playwright's `storageState` only applies cookies to browser requests. `request.get()` / `request.post()` in test code does NOT use storageState cookies.

**Fix:** For API-level tests, manually inject the Authorization header.

**Rule:** storageState = browser only; API requests need explicit auth headers.

### storageState Must Seed Complete Store Shape

**Problem:** E2E tests seed `storageState` with `{ initialized: true }` but omit other app store fields. Components guarded by `v-if="appStore.host"` never render because the field is missing.

**Fix:** Fetch `/api/health` in `global-setup.ts` and seed the **complete** app store shape into storageState. See `testing/e2e/global-setup.ts` for the pattern.

### Axios 401 Interceptor Nukes Demo Auth (Recurring — Fixed Permanently)

**Problem:** Help/docs pages (and any page with a stray API call) redirect to login in demo mode. This recurred 3-4 times because each fix addressed individual pages rather than the root cause.

**Root cause:** The axios response interceptor in `src/boot/axios.ts` catches 401 responses, calls `clearStoredAuth()`, and redirects to `/login`. In demo mode there's no backend, so any API call that leaks past `isDemoMode()` guards returns a network error or 401 — the interceptor wipes the demo auth state and redirects. Every new feature that fires an API call in demo mode triggers this same chain.

**Fix:** The interceptor now bails out immediately in demo mode: `if (isDemoMode()) return Promise.reject(error)`. No auth clearing, no redirect. Stray API calls fail silently in demo mode, which is correct behavior — mock services handle all data.

**Rule:** Auth interceptors that clear state and redirect must always check for demo mode first. The interceptor is the last line of defense — if it fires in demo mode, the session is destroyed regardless of what guards exist upstream.

### Demo E2E: addInitScript Runs Before EVERY Navigation

**Problem:** `page.addInitScript()` runs before every page load — including client-side SPA navigations that trigger a full page refresh. If you set `initialized: false` to force re-initialization, navigating between routes can re-trigger initialization and reset state mid-test.

**Fix:** For demo specs that seed state once and then navigate between pages within the test, seed in `beforeEach` and avoid setting `initialized: false` unless you genuinely need re-initialization. For tests that verify a specific starting state (version/tier combo), use `seedDemoStateAtVersion()` which sets `initialized: false` — but navigate directly to the target page rather than clicking through multiple routes.

### Markdown Anchor Slugify Must NOT Collapse Double Hyphens

**Problem:** TOC links like `[Tags & Organization](#tags--organization)` don't scroll to the heading. The heading renders with `id="tags-organization"` (single hyphen) but the link targets `#tags--organization` (double hyphen).

**Root cause:** The slugify function had `replace(/-+/g, '-')` which collapsed double hyphens. GitHub's anchor format preserves them: `&` is stripped, leaving two adjacent spaces, which become two hyphens.

**Fix:** Remove the hyphen-collapse step from slugify. Both `DocsPage.vue` (runtime) and `verify-docs-links.ts` (build-time) must use the same slugify that preserves double hyphens.

**Rule:** Never collapse hyphens in anchor slugification. Test the slugify function with headings containing `&`, `@`, `(`, `/`, and other characters that get stripped.

### Demo E2E: `VITE_DEMO_PUBLIC` Is Build-Time Only

**Problem:** `isPublicDemo()` checks `import.meta.env.VITE_DEMO_PUBLIC`, which is baked in at build time. Unlike `isDemoMode()` which has runtime localStorage fallbacks, the public/private distinction cannot be toggled at runtime. You cannot run public demo tests against a private demo build or vice versa.

**Fix:** Each demo variant needs its own build. The `entrypoint-demo.sh` uses `DEMO_TYPE` env var to build the correct SPA. Two Docker profiles (`demo-public`, `demo-private`) each build their own SPA variant.

---

## Build & CI

### Shebangs After Copyright Headers Break esbuild

**Problem:** Scripts with copyright headers on lines 1–3 and `#!/usr/bin/env npx tsx` on line 4 fail under newer esbuild with `Syntax error "!"`.

**Fix:** Remove shebangs from scripts invoked via `npx tsx scripts/...` in npm scripts. Only keep shebangs in scripts intended to be run directly as `./script.ts`.

### Root-Owned `.q-cache` Blocks Clean Install

**Problem:** `rm -rf node_modules` fails on `node_modules/.q-cache/` files owned by root (created when Quasar dev server runs as root or in NixOS contexts).

**Fix:** `sudo rm -rf node_modules/.q-cache` first, then `rm -rf node_modules`.

### npm ci Fails in Docker After Lockfile Regeneration

**Problem:** After `rm -rf node_modules && npm install` locally, Docker `npm ci` fails with "package.json and package-lock.json are out of sync."

**Root cause:** Different npm versions produce slightly different lockfiles. `npm ci` is strict about exact match.

**Fix:** After lockfile regeneration, verify with `npm ci --dry-run` locally before committing.

### Docker Demo Entrypoint Fails on Scripts Outside Build Context

**Problem:** `npm run generate:versions` calls `npx tsx ../scripts/delivery-projection.ts`. The Docker build context is `code/` so the script at project root (`scripts/`) is never copied in. The entrypoint fails with `ERR_MODULE_NOT_FOUND`.

**Fix:** Guard the call: `if [ -f "../scripts/delivery-projection.ts" ]; then npm run generate:versions; fi`. The generated file (`src/config/delivery-versions.ts`) is checked into source, so skipping regeneration in Docker is safe.

**Rule:** Docker entrypoints must handle scripts that live outside the build context. Either copy them in via the Dockerfile or guard with existence checks.

### `setup-node` Cache Fails in Monorepo-Style Layouts

**Problem:** `actions/setup-node` with `cache: 'npm'` searches the repo root for `package-lock.json`. If the code lives in a subdirectory (e.g., `code/`), the action fails with "Dependencies lock file is not found."

**Fix:** Set `cache-dependency-path: code/package-lock.json` on the `setup-node` step. Also add `defaults.run.working-directory: code` to the job so all `run:` steps execute in the right directory. Note that `path:` in `upload-artifact` is repo-root-relative (not affected by `working-directory`), so artifact paths need explicit `code/` prefixes.

**Rule:** Any workflow in a repo where `package-lock.json` isn't at the root must set `cache-dependency-path`. After adding `working-directory`, audit every `path:` in artifact upload/download steps — they don't inherit `working-directory`.

### Quasar PWA Build Outputs to `dist/pwa/`, Not `dist/spa/`

**Problem:** `quasar build -m pwa` outputs to `dist/pwa/`, not `dist/spa/`. If the workflow references `dist/spa/`, the tarball step fails with "Cannot open: No such file or directory."

**Fix:** Match artifact paths to the actual build mode output directory. PWA → `dist/pwa/`, SPA → `dist/spa/`.

**Rule:** When changing the Quasar build mode, update all downstream paths (tarballs, artifact uploads, deployment scripts).

### GitHub Attestation Fails on Private Repos (Free Plan)

**Problem:** `actions/attest-build-provenance` calls the GitHub Attestations API, which is only available on public repos or orgs with a paid plan. On a private repo (free plan), it fails with "Feature not available for the organization."

**Fix:** Add `continue-on-error: true` to attestation steps. They'll succeed on the public mirror (Free repo) and soft-fail on the private Dev repo.

**Rule:** If your release pipeline runs on both private and public repos, make attestation steps non-blocking. Attestation is consumer-facing — it matters on the public distribution repo, not the dev repo.

### Docker Chromium SIGSEGV in Playwright E2E

**Problem:** Playwright Chromium crashes with `Received signal 11 SI_KERNEL` (segfault) during demo E2E tests in Docker, causing flaky test failures.

**Fix:** Increase Docker container resources: `shm_size: '4g'` and `mem_limit: '8g'` in docker-compose.yml. The default 2g shared memory was insufficient for Chromium with the full SPA build.

**Rule:** If Playwright tests show random browser crashes in Docker, increase `shm_size` and `mem_limit` before investigating test logic.

---

## NixOS / Nix Builds

### buildNpmPackage with Multiple Lock Files

**Problem:** `buildNpmPackage` only fetches deps from the root `package-lock.json`. Backend `node_modules` won't exist.

**Fix:** Separate `fetchNpmDeps` derivation for the backend, installed during `buildPhase`:
```nix
backendNpmDeps = pkgs.fetchNpmDeps {
  name = "backend-npm-deps";
  src = ./../backend;  # Point directly at subdirectory
  hash = "sha256-...";
};
```

**Gotcha:** `fetchNpmDeps` `npmRoot` parameter silently ignores — use `src` pointed at the subdirectory.

### patchShebangs for Manual node_modules

**Problem:** `buildNpmPackage` patches root `node_modules` during `configurePhase`. Manual `npm ci` for subdirectories does NOT get patched. Binaries fail with "bad interpreter: /usr/bin/env".

**Fix:** `patchShebangs node_modules` after any manual `npm ci` in `buildPhase`.

### Pre-Built Native Binaries (ELF ENOENT)

**Problem:** npm packages with pre-built ELF binaries reference `/lib64/ld-linux-x86-64.so.2`, which doesn't exist on NixOS.

**Fix:** Remove the native package, fall back to pure-JS alternative. Many packages offer both: `sass-embedded`/`sass`, `esbuild`/JS fallback.

### prefetch-npm-deps Fetches All Platforms

**Problem:** `npm ci` fails with "Missing: sass@ from lock file". `prefetch-npm-deps` fetches ALL platform variants; cross-platform fallback packages declare dependencies not in the lock file.

**Fix:** `npm install -D sass` — makes the lock file complete for all platforms.

### Launcher Script Shebangs

**Problem:** `#!/usr/bin/env bash` in `$out/bin/` fails in systemd services — NixOS has no `bash` on minimal PATH.

**Fix:** Use Nix store paths: `#!${pkgs.bash}/bin/bash` and `${pkgs.nodejs}/bin/node`.

### Flake path: Input Requires Git Tracking

**Problem:** `nix flake update` uses git-tracked content only. Unstaged changes are invisible.

**Fix:** Always `git add` before `nix flake update`. `scripts/nix-rebuild-local.sh` automates this.

### Git Operations Under sudo (Identity, SSH, safe.directory)

**Problem:** `sudo ./script.sh` runs git as root. Three issues arise:

1. **Git identity**: Root has no `user.name`/`user.email`. Fix: read from `$SUDO_USER`'s config and export `GIT_AUTHOR_NAME`/`GIT_COMMITTER_NAME`.
2. **SSH host aliases**: Custom SSH host aliases (e.g., `github.com-wriver4`) exist in the calling user's SSH config, not root's. Fix: run `git push` as `sudo -u $SUDO_USER` to use the calling user's SSH config and keys.
3. **safe.directory**: Git refuses to operate on repos owned by other users. Fix: set `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_*`/`GIT_CONFIG_VALUE_*` env vars (process-scoped). Remove nested `sudo` calls so env vars propagate.

**Pattern:** When a script needs git under sudo, split commit (root + exported identity) from push (calling user + SSH keys).

### Nix Hash Management

Two hashes to maintain in `nixos/package.nix`. After `npm install`/`npm update`:
1. Use `prefetch-npm-deps` to compute correct hash, OR
2. Set wrong hash, let build fail, copy from error message

Always update flake lock after hash changes.

### NixOS Channel Version Drift Across Codebase

**Problem:** The nixpkgs channel version (e.g., `nixos-25.11`) is referenced in 16+ files: `flake.nix`, `flake.lock`, distro catalog, URL validation cache, mock data (3 locations), test fixtures (3 locations), docs (3 locations), research docs (2 locations), and legal docs. AI assistants default to their training data version, creating internally consistent but globally wrong references. Tests pass because the version string is correct within each file — only cross-file comparison reveals the drift.

**Fix:** `audit:nixos-version` auditor reads the canonical version from `flake.nix` and verifies all 16 check locations. Source of truth: `flake.nix` → `nixpkgs.url` → `nixos-XX.YY`.

**Rule:** After a nixpkgs channel bump, change `flake.nix` first, run `nix flake update`, then run `npm run audit:nixos-version` — it reports every stale reference.

---

## Security

### Pre-Release Audit (3-Prong)

| Check | What to Grep | Safe Pattern |
|-------|-------------|--------------|
| Command injection | `exec(`, `spawn(`, `child_process` | `execFileAsync` with argument arrays |
| SQL injection | `.prepare(`, `.run(`, `.get(` | Parameterized `?` placeholders |
| XSS | `v-html`, `innerHTML` | Vue default text interpolation |
| SSRF | `fetch(` with user-controlled URLs | Validate blocks private IPs |
| Path traversal | `readFile(` with user input | Regex validation on names |

### Error Sanitization Boundary

System calls → catch → log full error → return safe message. Never let `execFileAsync` error messages reach API clients.

### Backend tsc Emits JS Despite Type Errors

**Problem:** `npm run build` (tsc) exits with code 2 and reports type errors across dozens of files, but still emits all `.js` and `.d.ts` files. The backend compiles and runs despite being type-unsafe.

**Root cause:** `tsconfig.json` has `strict: true` but does NOT set `noEmitOnError: true`. TypeScript's default is to emit output even when there are errors.

**Fix:** Add `noEmitOnError: true` to `backend/tsconfig.json`. This prevents future drift.

**Rule:** Every TypeScript project must set `noEmitOnError: true`. A build that "succeeds" despite type errors is a build that lies.

### `declare global` With Mismatched Type Parameters Poisons All Type Inference

**Problem:** 392 type errors across 51 files. Every Zod-inferred type, every array method, every tuple destructure resolved to `{}`. Individual files type-checked fine in isolation. Investigation tested 4 TS versions, 3 Zod versions, 6 tsconfig toggles — none changed the error count.

**Root cause:** A `declare global { interface Array<_T> { ... } }` in one file used `_T` instead of `T` as the type parameter name. TypeScript requires ALL declarations of a global interface to use **identical type parameter names** (TS2428). This single mismatch cascaded — the global `Array` interface became poisoned, collapsing all array-derived type inference (including `z.infer`, which depends on arrays internally) to `{}` across the entire project.

**Why it was invisible:** The TS2428 error appeared once in the 392-error output, buried among 391 downstream errors. `skipLibCheck: true` + no `noEmitOnError` meant the build emitted JS despite the errors. The `declare global` was added to polyfill `Array` methods for a parser utility — a local concern that silently destroyed global type inference.

**Fix:** Removed the `declare global` augmentation. One file change → 386 errors vanished instantly.

**Rule:** Never use `declare global { interface Array<T> }` or any built-in type augmentation unless you are certain the type parameters match exactly. Prefer local utility types or standalone functions. If you must augment, verify with `tsc --noEmit` immediately — a mismatched parameter produces hundreds of downstream errors that look like unrelated Zod/Fastify issues.

### z.infer — Prefer Explicit Interfaces at Scale

**Problem:** During investigation of the 392-error cascade, `z.infer<>` was initially blamed. While the actual cause was a global type poisoning, `z.infer` remains fragile — it depends on deep conditional type chains that are the first to break under any type system stress.

**Rule:** Prefer explicit interfaces alongside Zod schemas for types consumed outside the schema file. `z.infer` is fine for local use within a schema module, but exported types should be explicit interfaces. This provides resilience against future type graph issues and makes the codebase self-documenting.

### WeasyPrint Requires System PATH on NixOS

**Problem:** WeasyPrint depends on Pango, GDK-Pixbuf, and other native libraries. On NixOS, these are not in the default PATH — the systemd service has a minimal environment.

**Fix:** Add `python3Packages.weasyprint` to the service's `path` list in `default.nix` (not just `WEASYPRINT_BIN`). The PATH entry ensures transitive dependencies (fontconfig, Pango, etc.) are resolvable at runtime.

**Rule:** NixOS packages with native library chains need both the env var (for the binary path) AND the `path` list entry (for transitive deps). Setting only the env var gives you the binary but not its runtime dependencies.

---

## Process

### Port Propagation Checklist

When ports change, update ALL of these:
1. `quasar.config.cjs` (dev server proxy target)
2. `testing/e2e-docker/entrypoint.sh`
3. `testing/e2e-docker/docker-compose.yml`
4. `testing/e2e-docker/playwright.config.ts`
5. `.claude/hooks/precompact-context.sh`
6. Backend `.env` / `.env.example`

### Documentation as a Gate

Documentation only stays current when it's defined as a deliverable alongside code. Enforce at three levels:
1. CLAUDE.md § Documentation Policy
2. `.claude/rules/` path-triggered reminders
3. Agent definition templates with Documentation Deliverables section

### Parallel Agent Safety

Parallel Claude agents are safe when they touch disjoint file sets. For overlapping files, run sequentially or use separate branches.

### Edit replace_all Inside Quotes

When using `replace_all` to replace a hardcoded string with a variable reference, check whether the original was inside quotes. Include the quotes in the replacement pattern.

### Moving Plan Docs Breaks Cross-Reference Links

**Problem:** Moving a file from `plans/v1.0.0/` to `plans/cross-version/` broke a link in `MASTER-PLAN.md`. The `audit:doc-freshness` auditor caught it at push time, but the commit was already made — requiring a second fix commit.

**Fix:** After any file move, grep for the old path across the entire repo before committing: `grep -r 'old/path/filename' --include='*.md'`. The `audit:doc-freshness` auditor validates cross-references but only runs at push time.

**Rule:** File moves in `plans/`, `agents/`, or `docs/` directories always require a cross-reference sweep. Run `grep -r 'filename.md' --include='*.md'` to find all references before committing the move.

## Static Analysis / Auditors

### Regex Auditors Drift When Code Adopts Constants

**Problem:** Auditors using regex to detect patterns like `requireRole('admin')` or `requireTier(config, 'weaver')` silently stop matching when the codebase migrates to vocabulary constants (`ROLES.ADMIN`, `TIERS.SOLO`). The auditor sees the function call but can't extract the argument, so it reports a false negative.

**Fix:** Auditor regex must match both forms — string literals and constant references. Example:
```typescript
// Matches requireRole('admin') and requireRole(ROLES.ADMIN)
const literalMatch = block.match(/requireRole\s*\(\s*(['"`])(.+?)\1/)
const constMatch = block.match(/requireRole\s*\(\s*(ROLES\.\w+(?:\s*,\s*ROLES\.\w+)*)/)
```

**Rule:** When introducing vocabulary constants, update every auditor regex that matches the old literal form. The auditor's test suite should include both constant and literal patterns.

### Auditor "Not Found — Skipping" Is a Silent Failure

**Problem:** Auditors that resolve file paths and skip gracefully when files are missing (`if (!existsSync(path)) { warn(...); return }`) silently disable entire check categories when directories are reorganized. Six checks were disabled for weeks after the `business/` reorg because paths like `business/TIER-MANAGEMENT.md` became `business/product/TIER-MANAGEMENT.md`.

**Fix:** After any directory reorganization, grep all auditor scripts for the old path structure. Alternatively, make "file not found" an error instead of a warning for canonical source files.

**Rule:** A "skipping" warning in an auditor is a bug. Canonical source files should fail loudly when missing, not skip quietly. Reserve skip-with-warning only for truly optional checks.

### Route Auth Auditor Needs Two-Layer Awareness

**Problem:** The route-auth auditor only detected per-route auth patterns (`requireRole`, `aclPreHandler`, `request.userId` + `reply.status(401)`). Routes protected by Fastify's global `onRequest` JWT middleware were flagged as "missing auth" because the middleware runs at a scope the per-route regex doesn't see.

**Fix:** Parse `PUBLIC_ROUTES` from the auth middleware source and classify routes into three layers:
1. **Authorized** — per-route role/ACL/manual check
2. **JWT-protected** — global middleware covers authentication, no per-route role check
3. **Public/exempt** — intentionally open (login, health, WebSocket with own auth)

Only fail if a route escapes ALL layers. JWT-only routes are compliant (authenticated, just not role-restricted).

**Rule:** Static auth auditors must model the full middleware stack, not just per-route annotations. Parse the actual middleware source as input rather than hardcoding assumptions about what's globally protected.

### Compatibility Sync Markers Must Use Distinct Tags Per File

The compatibility sync auditor uses `SYNC:PLATFORM_TABLE:START/END` in `COMPATIBILITY.md` (full table) and `SYNC:COMPAT_SUMMARY:START/END` in `README.md` (condensed table). Using the same marker name in both files would cause the auditor to compare a file against itself if paths were ever mixed up.

**Rule:** When creating sync marker pairs for multi-file parity checks, use distinct tag names per file (e.g., `PLATFORM_TABLE` vs `COMPAT_SUMMARY`) even if they track the same data. This prevents accidental self-comparison.

### Shell Script Arithmetic: Sanitize Command Substitution Before `[[ -gt ]]`

Bash arithmetic comparisons (`[[ "$VAR" -gt 0 ]]`) fail with "arithmetic syntax error" when `$VAR` contains whitespace, newlines, or is empty. This commonly happens with `grep -c` (which outputs a count with a trailing newline) and `wc -l` on some platforms.

**Problem:** `IOMMU_DMESG=$(dmesg | grep -ci iommu || echo 0)` can produce `"0\n0"` on some systems, crashing the subsequent `[[ "$IOMMU_DMESG" -gt 0 ]]`.

**Fix:** Always sanitize: `VAR=$(echo "$VAR" | tr -d '[:space:]')` before arithmetic use. Also use `|| true` instead of `|| echo 0` to avoid double output, then default: `VAR="${VAR:-0}"`.

### Doctor Endpoint: Rate-Limited to 5/min

The `/api/system/doctor` endpoint runs `execFileAsync` calls to system binaries (`qemu`, `df`, `ip`, `nixos-version`) and reads `/proc` files. It's rate-limited to 5 requests per minute to prevent abuse. The HostInfoStrip calls it once on mount — not on its 5-second poll cycle.

**Rule:** Diagnostic endpoints that shell out to system binaries should be rate-limited aggressively and never polled. Use passive UI indicators (colored dot) with explicit "Run" buttons for fresh results.

### Public Demo: `isPublicDemo()` Guards Must Be Inside Components, Not at Call Sites

`VersionNag`, `DemoVersionFeatures`, and `UpgradeNag` all leak roadmap information in public demo mode. Guards added at individual page-level call sites were missed on 5 pages. The fix: each component checks `isPublicDemo()` internally and renders nothing.

**Problem:** `<VersionNag>` was called from WeaverPage, NetworkMapPage, ShedPage, WorkloadDetailPage — adding `v-if="!isPublicDemo()"` to each was error-prone.

**Fix:** `VersionNag.vue` root element has `v-if="!isPublic"`. Same for `DemoVersionFeatures` and `UpgradeNag`. Pages don't guard — the component self-hides.

### Public Demo: `VITE_DEMO_PUBLIC` Is Baked at Build Time

`VITE_*` env vars are compiled into the bundle at build time. Switching between `npm run dev:demo-public` (port 9030) and `npm run dev:demo-private` (port 9040) requires killing and restarting the dev server — a browser hard refresh alone won't flip the flag.

### Brand Mark Auditor Must Scan Script Sections, Not Just Templates

**Problem:** The brand mark auditor (vocabulary sync Step 5) initially only scanned `<template>` sections of `.vue` files. User-visible strings like `label: 'Fabrick'` in `<script>` sections and in `.ts` config files (`demo.ts` funnel steps, `app.ts` extension names) were missed.

**Fix:** Expanded the scanner to cover `.vue` files fully (template + script, excluding style) and all frontend `.ts` files. The skip list handles CSS classes, route paths, tier string literals, imports, and comments.

**Rule:** Static auditors for UI text must scan both template AND script sections of Vue SFCs, plus any TypeScript files that export user-visible strings (config, constants, data).

### Quasar `q-btn` Color Prop: No Custom Hex Values

The `color` prop on `q-btn` only accepts Quasar palette names (`primary`, `grey-6`, `light-green-8`, etc.), not hex values. For brand colors like WBD green `#7AB800`, use a `.bg-wbd` utility class via `:class` binding instead. Setting `color` to `undefined` when active and applying the CSS class prevents Quasar from overriding the background.

### audit:decision-parity Enforces Ascending Decision Numbers

**Problem:** New decisions added "just above the last row" (a common mid-file insertion reflex) break the Decisions table's ascending-order requirement. The auditor fails with e.g. `#146 follows #148 at line 774 — out of order`.

**Fix:** Always append new decisions to the *bottom* of the Decisions table, highest number last. If you've already inserted in the middle, duplicate the out-of-order row to its correct position and delete the original — two surgical edits.

**Rule:** Decision numbers in `MASTER-PLAN.md` must be strictly ascending. Verify with `cd code && npx tsx scripts/verify-decision-parity.ts` after any edit. When in doubt, grep the file for `^\| \d+ \|` and check the sequence.

### audit:forms Flags `:rules` Without `:lazy-rules` as "Greedy"

**Problem:** A `q-input` with a `:rules="[...]"` prop but no `:lazy-rules` attribute is flagged as "greedy" — the auditor wants every validated input to use lazy (on-blur) validation, not eager (on-keystroke) validation. Symptom: `audit:forms` fails with `[GREEDY] src/pages/LoginPage.vue — Confirm Username (q-input): greedy`.

**Fix:** Add `lazy-rules` (boolean attribute, no colon needed) to the `q-input`:
```vue
<q-input
  :rules="[val => val === username || 'Usernames do not match']"
  lazy-rules   <!-- required -->
  ...
/>
```

If eager validation is genuinely needed (e.g., the Username field in setup mode wants real-time feedback as the user types), use `:lazy-rules="false"` — the auditor accepts the attribute's *presence*, regardless of value.

**Rule:** Every `q-input` with `:rules` must have a `lazy-rules` attribute. Default to `lazy-rules` (lazy on blur — better UX on confirm/validation fields). Only use `:lazy-rules="false"` when you want live feedback as the user types.

### audit:e2e-coverage Requires Every Validation Rule to Have an E2E Test

**Problem:** Adding a new validation rule to a `q-input` without a matching E2E test fails `audit:e2e-coverage`. The auditor scans the shipped validation messages and checks each one has a corresponding `getByText('...')` assertion in `testing/e2e/`. Symptom: `UNCOVERED: src/pages/LoginPage.vue — Confirm Username: "Usernames do not match"`.

**Fix:** Add a test in `testing/e2e/form-validation.spec.ts` that triggers the validation rule and asserts the message:
```typescript
test('rejects mismatched usernames in setup mode', async ({ page }) => {
  await page.route('**/api/auth/setup-required', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ setupRequired: true }) })
  )
  await page.goto('/#/login')
  await waitForQuasarApp(page)
  await page.getByRole('textbox', { name: 'Username' }).fill('testadmin')
  const confirmUsername = page.getByTestId('confirm-username-input')
  await confirmUsername.fill('differentadmin')
  await confirmUsername.blur()
  await expect(page.getByText('Usernames do not match')).toBeVisible({ timeout: 3000 })
})
```

**Rule:** "Specs before features" is mechanically enforced by `audit:e2e-coverage`. If you add a new `:rules` entry in a Vue SFC, you must add the corresponding E2E test in the same commit. The auditor blocks push on any uncovered validation rule.

**Selector pattern:** Use `getByTestId('...-input')` for fields with `data-testid` (Quasar's `inheritAttrs: false` puts the testid on the native `<input>`, not the wrapper — `getByTestId` works directly; descendant selectors from testid don't).

---

## Licensing

### Unqualified License Claims Across Tiers (Decision #137)

**Problem:** Documents say "Weaver is licensed under AGPL-3.0" without specifying which tier. Since Solo/Team/Fabrick are BSL-1.1, this is factually wrong for 3 of 4 tiers.

**Where it hides:** LICENSE file (`Software: Weaver`), README badge, ATTRIBUTION.md footer, legal evaluation doc, tier management doc. Any document written before the tier→license split assumed a single license.

**Fix:** Every license reference must qualify by tier. Use the unified copyright header: `Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.` The `audit:license-parity` auditor (planned) catches future drift.

**Rule:** When the product license is tier-dependent, never say "Weaver is licensed under X" — always say "Weaver Free is licensed under X" or use the unified dual-license statement.

### Copyright Header Script Misses `.tsx` Files

**Problem:** `add-copyright-headers.sh` handles `.ts`, `.js`, `.mjs`, `.cjs` but not `.tsx` or `.jsx`. TUI React components get no header.

**Fix:** Add `tsx|jsx` to the script's extension case statement alongside `ts|js`.

**Rule:** Any new file extension in the project must be added to `add-copyright-headers.sh`.

### DocsPage Copyright Header Stripping with `html: false`

**Problem:** The docs viewer renders markdown files imported via `?raw`. Copyright headers (`<!-- ... -->`) appear as visible text because `markdown-it` is configured with `html: false` (escapes HTML instead of parsing it). The pre-render regex must strip all header comments before rendering.

**Root cause:** The original regex `^<!--[\s\S]*?-->\s*` with `g` flag only stripped the first `<!-- -->` block. The `^` anchor without the `m` flag matches start-of-string only — the second comment line starts mid-string after the first is consumed, so it survives as visible text.

**Fix:** Use a group quantifier: `^(\s*<!--[\s\S]*?-->\s*)+` — matches one or more consecutive comment blocks anchored at file start.

**Rule:** When changing the copyright header format (number of lines, comment style), verify the DocsPage strip regex still works. Any markdown file rendered through the docs viewer will show raw comment text if the regex doesn't match.

### NPM Workspace Sub-Packages Have Nested node_modules

**Problem:** With `"workspaces": ["backend", "tui"]` in root `package.json`, most deps hoist to `./node_modules/` — but version conflicts stay nested in each workspace's own `node_modules/`. The NixOS package `installPhase` needs to copy BOTH the root `node_modules/` (hoisted deps) and each workspace's nested `node_modules/` (conflict versions) to `$out/lib/weaver/`, and set `NODE_PATH` in the launcher script so Node finds hoisted deps via the root path.

**Fix:** In `nixos/package.nix`:
```nix
cp -r node_modules $out/lib/weaver/node_modules
if [ -d backend/node_modules ]; then
  cp -r backend/node_modules $out/lib/weaver/backend/node_modules
fi
```
And in the launcher:
```bash
export NODE_PATH="$WEAVER_ROOT/node_modules"
```

**Rule:** Workspaces change the `node_modules` layout. Anywhere the code accesses `node_modules` by path (NixOS package, docker builds, reset scripts), check whether it needs hoisted deps, nested deps, or both.

### npm Workspace Symlinks Point to Source Dirs in node_modules/.bin

**Problem:** `npm install` in a workspace project creates symlinks in `node_modules/.bin/` and `node_modules/<workspace-name>` that point to the source directory. When copied into a Nix store output, those symlinks become dangling and the Nix noBrokenSymlinks check fails with `symlink points to a missing target`.

**Fix:** Before copying `node_modules` to `$out`, remove the workspace-local symlinks:
```nix
rm -f node_modules/.bin/microvm-tui node_modules/.bin/weaver
rm -rf node_modules/weaver-backend node_modules/weaver-tui
```
The package ships its own launcher scripts in `$out/bin/`, so these symlinks are redundant anyway.

**Rule:** `noBrokenSymlinks` will fail any Nix package with stale dev-mode symlinks in its output. Sanitize `node_modules` before the `installPhase` copy.

### Lockfile v3 Drops Integrity Hashes for Bundled/Git Deps

**Problem:** `prefetch-npm-deps --map-cache` panics with `dependency should have a hash` when the `package-lock.json` contains entries without an `integrity` field. npm lockfile v3 omits `integrity` for workspace packages, bundled deps, git URLs, and some edge cases (e.g., optional deps not installed for the current platform). This only matters if you're trying to build your own offline cache outside `buildNpmPackage`'s standard flow.

**Fix:** Regenerate the lockfile cleanly (`rm -rf node_modules package-lock.json && npm install`) or migrate to a single workspace lockfile where `fetchNpmDeps`/`buildNpmPackage` handles everything via the standard `npmConfigHook` — don't try to hand-roll cache handling for sub-lockfiles.

**Rule:** If you're writing your own cache-map code to work around `fetchNpmDeps`, you've taken a wrong turn. Convert to workspaces so `buildNpmPackage` can own the whole flow.

### Bash ((counter++)) Exits Under set -e When Counter Is 0

**Problem:** `((ACTION_COUNT++))` returns the pre-increment value. When it's 0, that's falsy, and bash treats the whole expression as exit code 1. With `set -e`, the script dies silently. Symptom: a plan-listing loop in `nix-uninstall.sh` showed the banner, then printed nothing, then exited 0 — the first `((count++))` killed the script.

**Fix:** Use `counter=$((counter + 1))` instead. Explicit arithmetic assignment always exits 0.

**Rule:** Never use `((x++))` or `((x--))` in scripts that run with `set -e`. Stick to `x=$((x + 1))`.

### ((ACTION_COUNT))-style Plan Listings Must Survive Zero-Start

**Problem:** Same as above, but specifically for scripts that dynamically compute a numbered list of actions. If the script starts with `ACTION_COUNT=0` and uses `((ACTION_COUNT++))` in conditionals, the first action silently kills the script.

**Fix:** Always use `ACTION_COUNT=$((ACTION_COUNT + 1))`. Never rely on arithmetic evaluation producing a truthy value from pre-increment operators.

### realpath() Requires Path Traversal; Use lstat+readlink for Symlink Inspection

**Problem:** `fs.promises.realpath()` (Node) and `realpath` (shell) resolve symlinks by *walking each parent directory*. If the path contains components the caller can't traverse (e.g., a 0700 home directory), `realpath` fails before reaching the symlink.

**Scenario:** `/etc/nixos` symlinked into `/home/mark/etc/nixos`. The weaver service user owns neither. When the Host Config viewer caught a permission error and tried to resolve the symlink to produce a better remediation message, `realpath('/etc/nixos/configuration.nix')` failed at `/home/mark` (mode 0700), so the remediation fell through to a generic message.

**Fix:** Walk the path manually with `lstat` (which doesn't traverse the target) and `readlink` (which returns the link string without following it):
```ts
let current = configPath
while (current && current !== '/') {
  const stats = await lstat(current).catch(() => null)
  if (stats?.isSymbolicLink()) {
    const target = await readlink(current)
    resolvedPath = isAbsolute(target) ? target : resolve(dirname(current), target)
    break
  }
  current = dirname(current)
}
```

**Rule:** If your code runs as a restricted service user and needs to inspect symlinks, use `lstat`/`readlink` — never `realpath`.

### /etc/nixos Symlinked into $HOME Blocks Service-User Reads

**Problem:** A common NixOS dev-box pattern is to symlink `/etc/nixos` into `~/nixos` or `~/etc/nixos` so the config can be git-tracked under the user's home. But home directories are typically `0700`, which blocks any other user (including system service users) from traversing into them to read the config. Services that try to read `/etc/nixos/configuration.nix` (e.g., Weaver's Host Config viewer) get `EACCES`.

**Fix (user):** `sudo chmod o+x /home/<user>`. This allows directory *traversal* (following paths into subdirs) without granting *listing* permission (`ls /home/user` still fails for others). The service user can then follow the symlink chain and read the file.

**Fix (code):** When the backend catches `EACCES` on a config read, it now detects symlinks into `/home/` via `lstat`+`readlink` and emits a remediation hint with the exact `chmod` command.

**Rule:** Any backend feature that reads system config files by path should gracefully handle permission errors and surface actionable remediation — not just "permission denied".

### Quasar build -m pwa outputs dist/pwa, Not dist/spa

**Problem:** `npm run build` runs `quasar build -m pwa` which outputs the frontend to `dist/pwa/`, not `dist/spa/`. Code that references `dist/spa/` (release workflows, Docker builds, Nix `installPhase`) breaks with `Cannot open: No such file or directory` after a `-m pwa` build.

**Fix:** Match artifact paths to the Quasar build mode output. PWA → `dist/pwa/`, SPA → `dist/spa/`, SSR → `dist/ssr/`.

**Rule:** When changing the Quasar build mode, grep the entire repo for the old output path — not just the obvious spots. Workflows, Dockerfiles, NixOS packages, and tests all reference it.

### parseFloat('1.10.0') Equals parseFloat('1.1.0')

**Problem:** `parseFloat('1.0.0') = 1`, `parseFloat('1.1.0') = 1.1`, `parseFloat('1.10.0') = 1.1`. The third stops at the second decimal point. Any version comparison using `parseFloat` silently reorders at v1.10+ — v1.10 and v1.1 become identical, v1.2 > v1.10.

**Fix:** Use integer-based comparison: parse the version string into major/minor parts and combine them as `major * 1000 + minor` (or more for multi-digit minors). Or use a proper semver library if you need patch-level precision.

**Rule:** `parseFloat` is never the right tool for version comparison. It looks like it works until you hit the first double-digit minor version.

### NixOS Bridge Services Don't Restart on Rebuild After Uninstall

**Problem:** `networking.bridges.<name>` generates `<name>-netdev.service` and `network-addresses-<name>.service`, both `WantedBy=network.target`. `WantedBy=network.target` is only honored at boot. After an uninstall that stops them and a subsequent rebuild that re-enables them, `nixos-rebuild switch` doesn't restart stopped units that it already "knows about" — the bridge stays dead until the next reboot.

**Symptom:** Service that depends on the bridge (Weaver VM provisioning) fails with `Device "br-microvm" does not exist` immediately after a reinstall cycle.

**Fix:** Add explicit `wants` + `after` dependencies from the consumer service to the bridge unit names in the NixOS module:
```nix
systemd.services.weaver = {
  wants = [ "${cfg.bridgeInterface}-netdev.service" "network-addresses-${cfg.bridgeInterface}.service" ];
  after = [ "${cfg.bridgeInterface}-netdev.service" "network-addresses-${cfg.bridgeInterface}.service" ];
};
```
systemd will then restart the bridge as a dependency whenever the consumer service starts.

**Rule:** If your service functionally depends on a NixOS-managed bridge/overlay/interface, declare the dependency explicitly. Don't rely on `WantedBy=network.target`.

### PWA Service Worker Caches Frontend Bundles Aggressively

**Problem:** Quasar PWA mode installs a service worker that caches the full frontend bundle. After a backend rebuild that updates the JS/CSS, the browser continues serving the old bundle from cache. Users see stale UI even after hard refresh, "clear cache" from the browser menu, and closing the tab. The service worker survives all of those.

**Fix:** DevTools → Application → Service Workers → Unregister, OR:
```js
(async () => {
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map(r => r.unregister()))
  const keys = await caches.keys()
  await Promise.all(keys.map(k => caches.delete(k)))
  location.reload()
})()
```

**Rule:** Any cache-clearing instructions for PWA users must explicitly say "unregister the service worker" — plain cache clears don't touch it. For dev loops, either disable the SW in local builds or add a prominent "Unregister SW" utility in the dev tools.

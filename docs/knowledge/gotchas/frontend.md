<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — frontend

Known gotchas in the **frontend** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-frontend-2026-05-10-001 -->
---
id: G-frontend-2026-05-10-001
scope: transferable
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

<!-- entry:G-frontend-2026-05-15-001 -->
---
id: G-frontend-2026-05-15-001
type: gotcha
domain: frontend
tags: [vue3, script-setup, watch, tdz, vitest]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## `watch({ immediate: true })` hits TDZ when its callback references a `const` declared later in `<script setup>` — 2026-05-15 · Claude

**Problem:** A `watch([source], callback, { immediate: true })` call fired its callback synchronously during component setup, but the `const upgradeTargets = computed(...)` it referenced was declared five lines later in the same `<script setup>` block. In the browser, Vue's pre-flush scheduler deferred the callback just long enough for the `const` to initialize — the bug was invisible. In Vitest's synchronous jsdom environment, the callback ran before `upgradeTargets` was initialized, producing `Cannot access 'upgradeTargets' before initialization`.

**Fix:** Move the `const` declaration to before the `watch()` call. The comment `// Declare before the immediate watch that reads it (eager-eval-tdz rule)` makes the constraint visible to the next reader.

**Rule:** In `<script setup>`, treat `watch(..., { immediate: true })` the same as code that runs inline — any `const` or reactive value it reads must be declared above it, not below. The browser scheduler masks TDZ violations; Vitest exposes them. The `audit:eager-eval-tdz` auditor catches the static pattern. The existing frontend rule covers `watchEffect { immediate: true }` and `useMeta`; this extends it to the `watch()` overload with `{ immediate: true }`.

<!-- /entry -->

<!-- entry:G-frontend-2026-06-02-001 -->
---
id: G-frontend-2026-06-02-001
type: gotcha
domain: frontend
tags: [v-network-graph, vite, optimizedeps, d3-force, peer-dependency]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-frontend-2026-06-02-005, G-frontend-2026-06-02-002]
graduated_to: ""
---

## v-network-graph force layout requires d3-force in Vite optimizeDeps — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** `v-network-graph` declares `d3-force` as an optional peer dependency, which Vite handles via a virtual module (`optional-peer-dep:__vite-optional-peer-dep:d3-force:v-network-graph`). Even when `d3-force` is installed in `node_modules`, Vite fails to resolve it via that virtual path and throws `Error: Could not resolve "d3-force" imported by "v-network-graph"` at startup, causing a white screen.

**Fix:** Explicitly add `d3-force` and its transitive deps to `vite.optimizeDeps.include` via `extendViteConf` in `quasar.config.cjs`:
```js
extendViteConf(viteConf) {
  viteConf.optimizeDeps = viteConf.optimizeDeps ?? {}
  viteConf.optimizeDeps.include = [
    ...(viteConf.optimizeDeps.include ?? []),
    'd3-force', 'd3-dispatch', 'd3-quadtree', 'd3-timer',
  ]
}
```

**Rule:** Any optional peer dep that a Quasar/Vite project actually uses must be added to `optimizeDeps.include` — Vite's virtual-module fallback does not reliably resolve optional peers even when installed. Requires a cold dev server restart (not HMR) after the config change.

<!-- /entry -->

<!-- entry:G-frontend-2026-06-02-002 -->
---
id: G-frontend-2026-06-02-002
type: gotcha
domain: frontend
tags: [v-network-graph, force-layout, svg, performance, topology]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-frontend-2026-06-02-005, G-frontend-2026-06-02-001]
graduated_to: ""
---

## v-network-graph with empty layouts renders all nodes at (0,0) — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** Passing `layouts = { nodes: {} }` to v-network-graph positions all nodes at the origin. With `autoPanAndZoomOnLoad: 'fit-content'` the view zooms into a single invisible point; with large graphs the stacked-at-origin force computation pegs the browser CPU indefinitely. The result looks like a blank white canvas with no indication of what went wrong.

**Fix:** Enable the `ForceLayout` handler from `v-network-graph/lib/force-layout`, set `alphaMin(0.01)` on the simulation so it stops once settled, and cap node count at a safe limit (500) to prevent the browser from freezing on large graphs.

**Rule:** Never pass `layouts = { nodes: {} }` without a layout handler — empty layouts = all nodes at origin = invisible graph plus potential browser freeze. Always supply `ForceLayout` or pre-compute positions, and cap nodes before passing them in (the component has no internal safety limit).

<!-- /entry -->

<!-- entry:G-frontend-2026-06-02-003 -->
---
id: G-frontend-2026-06-02-003
type: gotcha
domain: frontend
tags: [demo, ispublicdemo, vue-component, self-guard]
since_version: "1.0.5"
status: active
scope: project
related: [G-frontend-2026-06-02-004]
graduated_to: ""
---

## Public-demo leak guards (isPublicDemo) must live inside the component, not at call sites — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-01)

**Problem:** `VersionNag`, `DemoVersionFeatures`, and `UpgradeNag` all leak roadmap information in public demo mode. Guards added at individual page-level call sites (`v-if="!isPublicDemo()"`) were missed on 5 pages — `VersionNag` was called from WeaverPage, NetworkMapPage, ShedPage, and WorkloadDetailPage, and each needed the guard added by hand.

**Fix:** Each component checks `isPublicDemo()` internally and renders nothing — `VersionNag.vue`'s root element has `v-if="!isPublic"`, same for `DemoVersionFeatures` and `UpgradeNag`. Pages don't guard; the component self-hides.

**Rule:** Any component that can leak roadmap/tier information in public demo mode must self-guard with an internal `isPublicDemo()` check on its root element. Don't push the guard to call sites — it will be missed on at least one page.

<!-- /entry -->

<!-- entry:G-frontend-2026-06-02-004 -->
---
id: G-frontend-2026-06-02-004
type: gotcha
domain: frontend
tags: [demo, vite-env, build-time, vite-demo-public]
since_version: "1.0.5"
status: active
scope: project
related: [G-frontend-2026-06-02-003]
graduated_to: ""
---

## VITE_DEMO_PUBLIC is baked in at build time — a hard refresh won't flip it — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-06)

**Problem:** `isPublicDemo()` checks `import.meta.env.VITE_DEMO_PUBLIC`, a `VITE_*` env var compiled into the bundle at build time. Unlike `isDemoMode()` (which has runtime localStorage fallbacks), the public/private distinction cannot be toggled at runtime. Switching between `dev:demo-public` (port 9030) and `dev:demo-private` (port 9040) requires killing and restarting the dev server — a browser hard refresh alone won't flip the flag, and you cannot run public-demo tests against a private-demo build or vice versa.

**Fix:** Each demo variant needs its own build. `entrypoint-demo.sh` uses a `DEMO_TYPE` env var to build the correct SPA; two Docker profiles (`demo-public`, `demo-private`) each build their own SPA variant.

**Rule:** Treat `VITE_DEMO_PUBLIC` (and any `VITE_*` flag) as build-time-frozen. Per-build, never per-session — restart the dev server (or rebuild) to change it; never expect a refresh to pick up a new value.

<!-- /entry -->

<!-- entry:G-frontend-2026-06-02-005 -->
---
id: G-frontend-2026-06-02-005
type: gotcha
domain: frontend
tags: [quasar, q-btn, color, brand, css-class]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Quasar q-btn color prop accepts palette names only, not hex — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Problem:** The `color` prop on `q-btn` only accepts Quasar palette names (`primary`, `grey-6`, `light-green-8`, etc.), not hex values. Passing a brand hex like WBD green `#7AB800` silently fails to apply.

**Fix:** For brand colors, use a `.bg-wbd` utility class via `:class` binding instead of the `color` prop. Set `color` to `undefined` when active and apply the CSS class — this prevents Quasar from overriding the background.

**Rule:** Never pass a hex value to a Quasar `color` prop. Define a utility class (`.bg-<brand>`) and bind it via `:class`, leaving `color` unset, for any color outside the Quasar palette.

<!-- /entry -->

<!-- entry:G-frontend-2026-06-02-006 -->
---
id: G-frontend-2026-06-02-006
type: gotcha
domain: frontend
tags: [axios, interceptor, demo, auth, 401, boot]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-frontend-2026-06-02-004]
graduated_to: ""
---

## Axios 401 interceptor nukes demo auth — bail out on demo mode first — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-01)

**Problem:** Help/docs pages (or any page with a stray API call) redirect to login in demo mode. This recurred 3–4 times because each fix targeted individual pages rather than the root cause. The axios response interceptor in `src/boot/axios.ts` catches 401s, calls `clearStoredAuth()`, and redirects to `/login`. In demo mode there is no backend, so any API call leaking past an `isDemoMode()` guard returns a network error or 401 — the interceptor wipes demo auth state and redirects.

**Fix:** The interceptor bails out immediately in demo mode: `if (isDemoMode()) return Promise.reject(error)`. No auth clearing, no redirect. Stray API calls fail silently in demo mode, which is correct — mock services handle all data.

**Rule:** Auth interceptors that clear state and redirect must check for demo mode *first*. The interceptor is the last line of defense — if it fires in demo mode it destroys the session regardless of upstream guards.

<!-- /entry -->

<!-- entry:G-frontend-2026-06-02-007 -->
---
id: G-frontend-2026-06-02-007
type: gotcha
domain: frontend
tags: [markdown, slugify, anchor, docs-page, toc]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Markdown anchor slugify must NOT collapse double hyphens — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-01)

**Problem:** TOC links like `[Tags & Organization](#tags--organization)` don't scroll to the heading. The heading renders with `id="tags-organization"` (single hyphen) but the link targets `#tags--organization` (double hyphen). The slugify function had `replace(/-+/g, '-')`, which collapsed double hyphens — but GitHub's anchor format preserves them: `&` is stripped, leaving two adjacent spaces that become two hyphens.

**Fix:** Remove the hyphen-collapse step from slugify. Both `DocsPage.vue` (runtime) and `verify-docs-links.ts` (build-time) must use the same slugify that preserves double hyphens.

**Rule:** Never collapse hyphens in anchor slugification. Test the slugify with headings containing `&`, `@`, `(`, and `/` — characters that get stripped and leave adjacent spaces. The runtime and build-time slugify implementations must stay byte-identical.

<!-- /entry -->

<!-- entry:G-frontend-2026-06-02-008 -->
---
id: G-frontend-2026-06-02-008
type: gotcha
domain: frontend
tags: [quasar, q-menu, q-btn, double-toggle]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## q-menu inside q-btn double-toggles when combined with an explicit @click — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** A `q-menu` as a direct child of `q-btn` opens and immediately closes on click. When `q-menu` is a direct child of `q-btn`, Quasar auto-registers a click handler on the parent to toggle the menu. An explicit `@click` on the same `q-btn` fires first, then the auto-handler fires — net effect is a double-toggle (open → close).

**Fix:** Never combine `@click` toggle logic with `q-menu v-model` on the same `q-btn`. Let `q-menu` manage its own toggle:
```vue
<!-- GOOD: q-menu handles toggle -->
<q-btn>
  <q-menu v-model="showMenu">...</q-menu>
</q-btn>
```

**Rule:** When a `q-menu` is a direct child of `q-btn`, do not add an `@click` that toggles the menu's `v-model` — the auto-registered handler already does it, and the two cancel out.

<!-- /entry -->

<!-- entry:G-frontend-2026-06-02-009 -->
---
id: G-frontend-2026-06-02-009
type: gotcha
domain: frontend
tags: [quasar, q-virtual-scroll, q-menu, zero-height]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## q-virtual-scroll inside q-menu renders nothing (zero height) — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** `q-virtual-scroll` inside a `q-menu` popup renders nothing — the list appears empty despite having items. `q-virtual-scroll` requires explicit container dimensions to calculate visible items; inside a `q-menu` with few items the container has zero height, so the virtual scroller computes zero visible rows.

**Fix:** Replace with a plain scrollable div and `v-for` for small lists where virtualization isn't needed:
```vue
<q-menu>
  <div style="max-height: 400px; overflow-y: auto">
    <q-item v-for="item in items" :key="item.id">...</q-item>
  </div>
</q-menu>
```

**Rule:** Don't use `q-virtual-scroll` inside a `q-menu` (or any auto-sized popup) without giving the container an explicit height. For small lists, a plain scrollable div with `v-for` is the correct shape.

<!-- /entry -->

<!-- entry:G-frontend-2026-06-02-010 -->
---
id: G-frontend-2026-06-02-010
type: gotcha
domain: frontend
tags: [quasar, q-page, q-layout, login-page]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## q-page requires a q-layout ancestor — pages outside MainLayout can't use it — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** Any page component loaded outside `MainLayout` (e.g., a login page at `/login`) cannot use `<q-page>` — it requires a `<q-layout>` ancestor and silently fails to render correctly without one.

**Fix:** Use a plain flex container instead: `<div class="flex flex-center" style="min-height: 100vh">`.

**Rule:** `<q-page>` is only valid inside a `<q-layout>`. For standalone routes rendered outside the main layout, use a flex container with `min-height: 100vh` rather than `q-page`.

<!-- /entry -->

<!-- entry:G-frontend-2026-06-02-011 -->
---
id: G-frontend-2026-06-02-011
type: gotcha
domain: frontend
tags: [typescript, vue-tsc, tsc, sfc, typecheck]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ".claude/rules/frontend.md#typescript"
---

## Bare `tsc --noEmit` emits TS2307 on every .vue import — use vue-tsc — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-06-02)

**Problem:** `npx tsc --noEmit` produces `TS2307: Cannot find module` for every `.vue` import even though all files exist and path aliases are correct. Bare `tsc` has no single-file-component awareness — it cannot resolve `.vue` modules.

**Fix:** Use `vue-tsc` (which wraps TypeScript with `@vue/language-core` / Volar and consumes the Quasar-generated `.quasar/tsconfig.json` type references). The project exposes it as `npm run typecheck`.

**Rule:** Always `npm run typecheck` (runs `vue-tsc`) for the frontend. Never bare `tsc --noEmit` — it cannot parse Vue SFCs and floods output with false TS2307 errors.

<!-- /entry -->

<!-- entry:G-frontend-2026-06-02-012 -->
---
id: G-frontend-2026-06-02-012
type: gotcha
domain: frontend
tags: [quasar, q-input, inheritattrs, data-testid, e2e-selectors, playwright]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ".claude/rules/frontend.md"
---

## q-input inheritAttrs:false puts data-testid on the native input — descendant selectors break — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-06-02)

**Problem:** `page.getByTestId('my-input').locator('input')` and `page.locator('[data-testid="my-input"] .cursor-pointer')` time out despite the elements being visible. Quasar's `q-input` (and `q-field`) declares `inheritAttrs: false` in Vue 3, so non-prop attributes like `data-testid` land on the native `<input>` element via `$attrs`, not on the component's wrapper `<div>`. `[data-testid="my-input"]` therefore selects the `<input>` itself, and any descendant selector below it finds nothing.

**Fix:** Use CSS `:has()` to reach the wrapper from the input, or use Playwright role-based locators:
```typescript
// Instead of: page.locator('[data-testid="my-input"] .cursor-pointer')
page.locator('.q-field:has(input[autocomplete="current-password"]) .cursor-pointer')
// Or role-based:
page.getByRole('textbox', { name: 'Username' }).fill(text)
```

**Rule:** Never build descendant selectors off a `data-testid` on a Quasar `q-input`/`q-field` — the testid lands on the native `<input>`. Use `getByRole()` or a CSS `:has()` selector that finds the wrapper from the input.

<!-- /entry -->

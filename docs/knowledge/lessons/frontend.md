<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — frontend

Lessons learned in the **frontend** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-frontend-2026-05-13-001 -->
---
id: L-frontend-2026-05-13-001
type: lesson
domain: frontend
tags: [data-visualization, legend, visual-encoding, v-network-graph]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Multi-channel visual encoding requires per-channel legend labels — 2026-05-13 · Claude

**Root cause:** When a graph (or any data visualization) uses multiple visual properties to encode different dimensions — e.g., fill color = domain, shape = type, border color = type — a combined legend that just shows example nodes without labeling *which property encodes which dimension* will mislead readers. They assume the most prominent property (fill color) encodes the most salient dimension (type). The original RegistryGraph legend showed a blue circle for "lesson" and an orange square for "gotcha," which implied color encodes type when it actually encodes domain.

**Rule:** For each visual encoding channel in a data visualization, provide an explicit label for what that channel encodes ("fill = domain:", "shape · border = type:"). Show type indicators with a neutral fill so only the intended properties (shape + border) carry the type signal.

**Why this shape wins:** A per-channel legend is self-describing — readers don't need to reverse-engineer which visual property maps to which data dimension. Neutral fills on type indicators prevent the confusion of "this legend swatch is blue, so blue nodes are lessons" when blue is actually a domain color.

<!-- /entry -->

<!-- entry:L-frontend-2026-05-17-001 -->
---
id: L-frontend-2026-05-17-001
type: lesson
domain: frontend
tags: [ux, refresh, redundancy, sidebar]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Avoid panel-scoped refresh when a global refresh covers the same scope — 2026-05-17 · Claude

**Root cause:** A dataset sidebar had its own Refresh button that only called `loadDatasets()`. A global Refresh in the StatusBar already called `checkStatus() + loadDatasets() + loadActivity() + listDatasetFiles()`. The panel button was a strict subset — it added visual noise without any functionality the global button didn't cover.

**Rule:** Before adding a refresh button to a panel or drawer, ask: does the global refresh (StatusBar, toolbar) already cover this data at the same or broader scope? If yes, omit the panel button. Keep panel-scoped refresh only when the global button is ergonomically distant AND the panel is refreshing something the global doesn't touch (e.g., a Files tab refreshing only that dataset's file list).

**Why this shape wins:** Fewer refresh buttons means fewer mental models. Users shouldn't need to know which refresh targets which data — one global refresh is predictable. Contextual refresh buttons earn their place only when they give the user a materially faster or cheaper operation that the global path can't match.

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-001 -->
---
id: L-frontend-2026-06-02-001
type: lesson
domain: frontend
tags: [auth, pinia, router, registration, session]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-frontend-2026-06-02-002]
graduated_to: ""
---

## Registration IS the session-verification event — set sessionVerified in register() — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-25)

**Root cause:** The first-run admin setup screen showed "An error occurred" on a valid submit, then the real validation error only on the second attempt. `register()` in `auth-store.ts` did not set `sessionVerified = true`, so after registration completed the router guard found an unverified session and called `fetchMe()` — which threw because no auth cookie existed yet. That exception landed in `onSubmit`'s `catch` with no `.response.data`, producing the generic message.

**Rule:** Set `this.sessionVerified = true` inside the `register()` action, immediately after storing the token and user. Successful registration is itself the session-establishment event — the token is stored and the session is live the moment `register()` returns. Triggering the guard's session-verification path afterward is redundant and error-prone.

**Why this shape wins:** The fix is one line in the store with no changes to the router guard, axios interceptors, or the calling component. The guard's invariant (`sessionVerified || fetchMe()`) holds for every path: login sets the flag via `fetchMe()`, registration sets it directly, page reload reconstructs it via `fetchMe()`.

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-002 -->
---
id: L-frontend-2026-06-02-002
type: lesson
domain: frontend
tags: [vue-router, error-handling, auth, try-catch, navigation]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-frontend-2026-06-02-001]
graduated_to: ""
---

## router.push() inside try/catch converts navigation errors into auth error messages — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-25)

**Root cause:** In Vue Router 4, `router.push()` resolves to `NavigationFailure | void` on an aborted navigation rather than rejecting. But when `await router.push(...)` sits inside the same `try` block as the auth call and an upstream guard *throws* (rather than returning a failure), the exception propagates into the `catch` that displays auth errors. A valid login/register then shows "An error occurred" even though authentication succeeded.

**Rule:** Move `await router.push(destination)` outside the `try/catch` that handles the auth call, and add an explicit `return` at the end of the `catch` so navigation only runs on the success path. Navigation is a success-path side effect of auth; its errors are routing concerns, not auth concerns.

```typescript
async function onSubmit() {
  try {
    await authStore.register(...)
  } catch (err) {
    errorMessage.value = extractErrorMessage(err, 'An error occurred')
    return
  } finally {
    loading.value = false
  }
  await router.push('/weaver')  // outside catch — routing errors ≠ auth errors
}
```

**Why this shape wins:** Keeping navigation off the error path means a guard exception can never masquerade as a credential failure, and the error-display handler stays scoped to the one operation it actually understands.

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-003 -->
---
id: L-frontend-2026-06-02-003
type: lesson
domain: frontend
tags: [quasar, iconset, mdi, extras, config]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Removing material-icons from Quasar extras requires setting framework.iconSet — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-03-23)

**Root cause:** After removing `material-icons` from `extras` in `quasar.config.cjs` (the app used only `mdi-*` icons), the build deployed with garbled text where component chrome should be — `arrow_drop_down` rendered as literal text in `QBtnDropdown`. Quasar's own components (`QBtnDropdown`, `QSelect`, `QStepper`) have hardcoded internal icon names that default to Material Icons naming regardless of which icon set is installed.

**Rule:** You cannot remove `material-icons` from extras without also setting `framework.iconSet: 'mdi-v7'`. They are coupled — `iconSet` tells Quasar to remap its internal icon references (`arrow_drop_down` → `mdi-menu-down`, etc.). The extras removal without the iconSet change is a silent regression that only appears at runtime.

**Why this shape wins:** Setting `iconSet` makes the icon dependency explicit and self-consistent — Quasar's chrome resolves to the same library the app uses, so there is no orphaned reference to a font that is no longer bundled.

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-004 -->
---
id: L-frontend-2026-06-02-004
type: lesson
domain: frontend
tags: [css-budget, mdi, webfont, bundle, audit]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## CSS budget must account for icon webfont and framework CSS separately from app CSS — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-03-23)

**Root cause:** The bundle audit's CSS budget (200 KB) had been failing since `mdi-v7` was added to extras. `mdi-v7.css` alone is ~408 KB (all 7,000+ MDI icon class definitions) — the budget was never achievable because it was set aspirationally before MDI was added. Icon font CSS is not application CSS; its cost is fixed by the icon library choice, not by how much app CSS is written.

**Rule:** When setting a CSS budget, account for each category separately: (1) icon font CSS (fixed, determined by library choice), (2) framework component CSS (fixed, determined by Quasar version), (3) application CSS (variable, the only part you control). Name the breakdown in the budget comment. If the true cost is unacceptable, the fix is migrating from webfont icons to tree-shakeable SVG imports (`@mdi/js`) — not lowering the budget.

**Why this shape wins:** A category-aware budget still catches real regressions (app CSS ballooning to 1 MB) while not failing from day one on fixed external artifacts. The auditor's job is to catch *unexpected* growth, not the known cost of a library choice.

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-005 -->
---
id: L-frontend-2026-06-02-005
type: lesson
domain: frontend
tags: [v-network-graph, svg, edge-overlay, geometry, topology]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-frontend-2026-06-02-001, G-frontend-2026-06-02-002]
graduated_to: ""
---

## v-network-graph edge-overlay positions are node centers, not boundaries — offset before drawing paths — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-03-25)

**Root cause:** Cross-host connector lines drawn via the `edge-overlay` slot visually passed through pill nodes even with a visible gap between them. In v-network-graph, `position.source` and `position.target` in the `edge-overlay` slot are the node **center** coordinates, not the boundary. A center-to-center path overlaps half of each endpoint node before exiting the shape, and since `edge-overlay` renders on top of nodes in SVG z-order, the overlap is always visible regardless of gap size.

**Rule:** When drawing custom paths in `edge-overlay`, offset the start and end points to the node boundary first. For rect nodes, offset by `±halfWidth` on the dominant horizontal axis or `±halfHeight` on the dominant vertical axis, passing the node half-sizes as parameters to the path function — never assume `position.source/target` are at the edge.

```ts
// pill node 104×26 → halfW=52, halfH=13
elbowPath(position.source, position.target, 8, 52, 13, 52, 13)
```

**Why this shape wins:** Computing the boundary intersection explicitly decouples the path geometry from node size, so the connector renders correctly at any node dimension or spacing without the artifact reappearing when sizes change.

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-006 -->
---
id: L-frontend-2026-06-02-006
type: lesson
domain: frontend
tags: [quasar, scss, build-artifact, gitignore]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Quasar dev build emits .css/.css.map alongside .scss sources — they are artifacts — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-03-27)

**Root cause:** After a dev build, `src/css/app.css`, `app.css.map`, `quasar.variables.css`, and `quasar.variables.css.map` appeared as untracked files. Quasar's Vite pipeline compiles `.scss` files in-place and emits the `.css`/`.css.map` outputs into the same `src/css/` directory rather than into `dist/`. The `.scss` sources are tracked; these outputs are not.

**Rule:** Treat `src/css/*.css` and `src/css/*.css.map` as build artifacts — delete them, never commit them. They reappear after each dev build; add them to `.gitignore` if persistent.

**Why this shape wins:** Recognizing the in-place compilation as the source of the churn means you `.gitignore` the pattern once instead of repeatedly un-staging mystery files, and a reviewer never has a compiled CSS diff buried in a feature PR.

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-007 -->
---
id: L-frontend-2026-06-02-007
type: lesson
domain: frontend
tags: [demo, toolbar, layout, visibility, css]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Demo toolbar controls that toggle by tier/version need visibility:hidden, not v-if — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-03-26)

**Root cause:** The Solo/Team sub-tier buttons in `DemoTierSwitcher.vue` were rendered with `v-if` conditioned on tier+version. Switching tiers or navigating versions caused the toolbar to reflow — other controls shifted position each time the block appeared or disappeared. `v-if` removes the element from the DOM entirely; `v-show` collapses it via `display: none`. Neither preserves layout width.

**Rule:** Any demo toolbar control that toggles based on tier or version must use `visibility: hidden` so it always occupies space. Wrap the block in a container and bind `:style="{ visibility: condition ? 'visible' : 'hidden' }"`. This applies to all future conditional slots in the demo toolbar.

**Why this shape wins:** Reserving the layout slot keeps the toolbar geometry stable across every tier/version permutation, so neighboring controls never jump — a property that `v-if`/`v-show` can't provide because both free up the space.

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-008 -->
---
id: L-frontend-2026-06-02-008
type: lesson
domain: frontend
tags: [version-gating, content-pages, demo, help-page]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: "docs/development/KNOWN-GOTCHAS.md#help-page-and-similar-content-pages-must-be-version-gated"
---

## Static content pages need version gating, not just interactive UI — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-01)

**Root cause:** `HelpPage.vue` contained 60+ Q&A items spanning v1.0–v3.3 with zero version gating. At v1.0, users saw documentation for containers (v1.1), Shed (v2.0), Loom (v3.0), Fabrick fleet, and workload groups — features that don't exist yet. Feature pages get `v-if` guards naturally because they render interactive UI; static data arrays (help items, changelogs, feature matrices) fly under the radar because they're "just text."

**Rule:** Any page that describes features across multiple versions must version-gate its content *items*, not just its interactive elements. Add `minVersion?: string` to each content item and filter before rendering — version gate first, then search filter. In demo mode gate against `appStore.isDemoVersionAtLeast()`; in production against `__APP_VERSION__`. Items without `minVersion` default to the current floor.

**Why this shape wins:** Gating at the item level means a single computed filter governs the whole page, sections with zero visible items auto-hide, and adding a future-version Q&A is automatically safe — it stays invisible until its version ships. (Graduated to KNOWN-GOTCHAS § Frontend as a universal pattern.)

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-009 -->
---
id: L-frontend-2026-06-02-009
type: lesson
domain: frontend
tags: [demo, typed-fields, domain-model, render-guard]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Demo enrichment that prod doesn't produce yet belongs in an optional typed field, not isDemoMode() checks — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-21)

**Root cause:** `WorkloadCard.vue` needed per-VM utilization gauges for the public demo, but prod has no metrics backend until v1.1. The tempting shapes — `isDemoMode() && renderGauges()` in the template, or a separate `DemoWorkloadCard.vue` wrapper — either pollute the prod render path with demo conditionals (forcing synthetic zero values) or duplicate components and still leak demo props into the parent template.

**Rule:** When demo mode needs to enrich a domain object with runtime data prod doesn't yet produce, model it as an optional typed field on the domain type (`liveMetrics?: {...}`), populate it only in `demo-data.ts`, and render with a presence guard (`v-if="vm.liveMetrics"`). No `isDemoMode()` in the render path, no synthetic zeros, no wrapper component.

**Why this shape wins:** The prod render path is byte-identical whether demo mode exists or not, and when a future backend starts populating `liveMetrics`, the same gauges "turn on" for prod automatically with zero render-path changes. The pattern generalizes to any "demo has extra data prod doesn't have yet."

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-010 -->
---
id: L-frontend-2026-06-02-010
type: lesson
domain: frontend
tags: [vite, import-meta-glob, bundle, docs-page, content-loading]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Vite import.meta.glob wildcards silently bundle internal files — enumerate explicitly in user-facing pages — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-24)

**Root cause:** `DocsPage.vue` used wildcard globs (`'../../docs/legal/*.md'`, `'../../docs/operations/*.md'`) that captured every matching file at build time, including `LICENSE-PAID-DRAFT.md`, a post-incident report, and a cache-key policy doc alongside the intended user-facing documents. The bundler has no way to distinguish "user-facing" from "internal" — it bundles everything the glob matches.

**Rule:** In any user-facing page that lazy-loads content via `import.meta.glob`, enumerate each file explicitly rather than scanning a directory with a wildcard. Wildcards are appropriate only for closed sets where every file in the directory is intended for the same audience by construction (e.g., `docs/v*/**/*.md` versioned snapshots). Open sets that grow with internal files over time require explicit lists.

**Why this shape wins:** Explicit lists are self-documenting — the page's bundle surface is readable in source, and adding a new user-facing doc requires a deliberate decision. An accidental internal file dropped into a wildcard-scanned directory is otherwise bundled with zero warning.

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-011 -->
---
id: L-frontend-2026-06-02-011
type: lesson
domain: frontend
tags: [bundle-budget, vite, docs-snapshot, versioned-docs, audit]
since_version: "1.0.5"
status: active
scope: project
related: [L-frontend-2026-06-02-010]
graduated_to: ""
---

## Total JS bundle budget must absorb each versioned doc snapshot cycle — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-24)

**Root cause:** `audit:bundle`'s total-JS budget is a flat threshold counting all JS chunks, including lazy-loaded versioned documentation snapshots. Each `docs:snapshot` run (once per minor/major release) duplicates all bundled docs into `docs/v<M>.<m>/`, which Vite turns into a parallel set of lazy chunks — adding ~240 KB per snapshot cycle. The growth is legitimate but predictable.

**Rule:** When the total JS budget fails right after a `docs:snapshot`, raise the budget by the snapshot delta and name the current release ceiling in a comment (`// Budget covers through v1.1 snapshot (~2480 KB). Revisit at v1.2.`) — do not remove or trim the snapshot. The auditor exists to catch *unexpected* growth, not growth that follows the known snapshot-per-release pattern.

**Why this shape wins:** A budget comment that names the expected ceiling turns the next failure into a signal instead of a surprise, and forces the reviewer to classify the cause: snapshot cycle (expected), new doc (small/expected), or unexpected bloat from a wildcard glob picking up internal files (see related lesson).

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-012 -->
---
id: L-frontend-2026-06-02-012
type: lesson
domain: frontend
tags: [pinia, websocket, optimistic-delete, race-condition, store]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## A periodic WebSocket broadcast can resurrect an optimistically-deleted VM — guard the store — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-24)

**Root cause:** `DELETE /api/workload/:name` removes the VM and returns, but the backend's WebSocket broadcast timer runs on a fixed 2-second interval independent of API calls. If the timer fires *while the DELETE is in flight*, it captures a list still including the VM. That stale broadcast arrives after the DELETE response — after `removeWorkload()` cleared the card — and `updateWorkloads()` blindly replaces the full list, re-adding the VM so the card reappears.

**Rule:** When a store has both an optimistic-remove action and a periodic background sync that replaces the full list, add a `_pendingDeletes: string[]` field. `removeWorkload(name)` pushes the name; `updateWorkloads()` filters it from incoming data and trims it once a clean broadcast (VM absent) confirms the delete. The guard is self-cleaning — no timers, no explicit clear.

**Why this shape wins:** The guard lives entirely in the store, needs no WebSocket/backend/component changes, composes with any number of concurrent deletes, and applies at any broadcast interval — the race window is just the interval length.

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-013 -->
---
id: L-frontend-2026-06-02-013
type: lesson
domain: frontend
tags: [vue-reactivity, computed, slug-map, tier, watch]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Slug maps that depend on reactive state must be computed, not const — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-25)

**Root cause:** A `Record<string, string>` mapping route slugs to document paths whose values depend on reactive state (e.g. tier) was declared as a plain `const`. `const obj = { key: tier.value ? 'a' : 'b' }` evaluates the ternary exactly once at module load; Vue's reactivity does not track property reads on a plain object, so a tier change never re-evaluates the lookup.

**Rule:** Any object literal whose property values contain `.value` reads or other reactive reads must be wrapped in `computed<Record<string, string>>()`. Usage sites inside `watch()` bodies then read through the ref (`slugToGlobKey.value[slug]`), not the bare identifier. The signature difference is subtle; the behavioral difference is total.

**Why this shape wins:** Wrapping in `computed()` makes the map a tracked dependency, so every consumer re-derives automatically when the underlying reactive state changes — eliminating a stale-lookup class of bug that no type checker would catch.

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-014 -->
---
id: L-frontend-2026-06-02-014
type: lesson
domain: frontend
tags: [tier-gating, vue-component, slot, upgrade-nag, weaver]
since_version: "1.0.5"
status: active
scope: project
related: [L-frontend-2026-06-02-015]
graduated_to: ""
---

## TierGate: a slot wrapper makes the upgrade nag structurally automatic — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-26)

**Root cause:** A recurring pattern — a feature card or button with `v-if="appStore.isWeaver"` and no `v-else` nag — left Free-tier users staring at blank space with no explanation. Adding `v-else <UpgradeNag/>` works but requires remembering it on every future feature, which has failed at least three times in this project.

**Rule:** Use a `TierGate` slot wrapper rather than `v-if/v-else` whenever a UI element should show an `UpgradeNag` when the tier is insufficient. The component renders the slot when the tier is sufficient and has the `v-else` nag built into its body — there is nothing to omit. Keep the scope distinction: `TierGate` is for synchronous inline gating (same-file content, buttons, cards); `useTierFeature` is for async module loading (weaver/fabrick components excluded from the free repo). Don't use `TierGate` with dynamically-loaded modules — that defeats the sync-exclusion defense.

```vue
<TierGate :required-tier="TIERS.SOLO" feature-name="My Feature">
  <q-btn label="Do the thing" @click="doThing" />
</TierGate>
```

**Why this shape wins:** Moving the nag from "something you can forget" to "something that exists by default" makes future additions automatically correct — `v-if` without `v-else` is always a potential silent hide.

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-015 -->
---
id: L-frontend-2026-06-02-015
type: lesson
domain: frontend
tags: [v-if, tier-gating, guards, debugging, vue]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-frontend-2026-06-02-014]
graduated_to: ""
---

## Multiple v-if guards: verify ALL of them before changing a tier assertion — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-26)

**Root cause:** The Create VM button on WeaverPage has `v-if="authStore.canManageVms && canProvision"`. After removing `appStore.isWeaver` from the `v-if` (replaced with `:disable`), the button was still absent in demo mode because `canProvision = appStore.provisioningEnabled` is `false` (demo health returns `provisioningEnabled: false`). Changing an assertion from `toHaveCount(0)` to `toBeDisabled()` was wrong — the element still doesn't exist.

**Rule:** When a `v-if` is changed from "hides the element" to `:disable` (visible-but-disabled), audit *every* remaining `v-if` guard on that element. The change to a visible-but-disabled expectation is only correct if no remaining guard can hide the element under the relevant conditions. Also remember: a computed that depends on tier won't trigger a `watch()` unless that tier dep is in the watch source array (or the computed ref itself is watched).

**Why this shape wins:** Enumerating all guards before flipping an assertion prevents the false conclusion that one guard governs visibility, and keeps reactive recomputation correct by surfacing missing `watch()` dependencies at the same time.

<!-- /entry -->

<!-- entry:L-frontend-2026-06-02-016 -->
---
id: L-frontend-2026-06-02-016
type: lesson
domain: frontend
tags: [hostinfostrip, diagnostics, polling, one-shot, doctor-endpoint, ux]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## HostInfoStrip health indicator is one-shot, not polled — expensive diagnostics are triggered, not polled — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-06-02)

**Root cause:** The doctor endpoint runs 14 system checks including `execFileAsync` calls to `qemu`, `df`, `nixos-version`, and `/proc` reads. Calling it every 5 seconds (like the cheap health endpoint) would waste host resources on a continuous basis for information that rarely changes.

**Rule:** Expensive diagnostic endpoints should be triggered explicitly, not polled. The HostInfoStrip fetches doctor status once on mount and shows a static green/yellow/red dot; users who want fresh results click "Run Diagnostics" in Settings. Use passive indicators (a colored dot) that link to the full diagnostic UI rather than a polling timer.

**Why this shape wins:** Separating the cheap always-on signal (health, pollable) from the expensive on-demand signal (doctor, triggered) keeps the live UI responsive without paying the diagnostic cost on every tick — and the passive dot still surfaces a problem at a glance, with the heavy check one click away.

<!-- /entry -->

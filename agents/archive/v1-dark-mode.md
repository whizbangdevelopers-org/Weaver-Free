<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1-dark-mode — Dark Mode Toggle

**Plan:** [FEATURE-GAPS](../plans/FEATURE-GAPS.md) (High Value — low effort)
**Parallelizable:** Yes (independent of all other tracks)
**Blocks:** None

---

## Scope

Add dark mode with a toggle in the toolbar and settings page. Quasar has built-in dark mode support (`Dark` plugin) — this is primarily wiring, not custom CSS. Persist preference in settings store.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `src/layouts/MainLayout.vue` | Toolbar — add toggle button here |
| `src/stores/settings-store.ts` | Add darkMode preference |
| `src/pages/SettingsPage.vue` | Add dark mode toggle in appearance section |
| `src/css/app.scss` | Global styles — may need minor tweaks for dark compatibility |
| `src/components/VmCard.vue` | Card component — verify dark mode colors |
| `src/components/StatusBadge.vue` | Status colors in dark mode |
| `src/pages/WorkbenchPage.vue` | Stat cards — verify contrast |
| `quasar.config.ts` | Enable Dark plugin if not already |

---

## Inputs

- Quasar `Dark` plugin provides `Dark.set(true/false/auto)` and reactive `Dark.isActive`
- Quasar components auto-adapt to dark mode (q-card, q-page, q-toolbar, etc.)
- Some custom CSS classes may need dark-mode variants

---

## Outputs

### Config

| File | Type | Description |
|------|------|-------------|
| `quasar.config.ts` | Modify | Enable `Dark` plugin in framework plugins if not already present |

### Frontend

| File | Type | Description |
|------|------|-------------|
| `src/stores/settings-store.ts` | Modify | Add `darkMode: 'auto' as 'auto' \| 'light' \| 'dark'` state + `setDarkMode` action |
| `src/boot/dark-mode.ts` | New | Boot file: read settings-store, call `Dark.set()` on app init |
| `src/layouts/MainLayout.vue` | Modify | Add dark mode toggle button in toolbar (sun/moon icon) |
| `src/pages/SettingsPage.vue` | Modify | Add "Appearance" section with dark mode selector (Auto / Light / Dark) |
| `src/css/app.scss` | Modify | Add `body.body--dark` overrides for any custom classes that don't auto-adapt |

### Potential CSS Fixes

| File | Type | Description |
|------|------|-------------|
| `src/components/VmCard.vue` | Audit | Verify `.vm-card--running` border color works in dark mode |
| `src/components/StatusBadge.vue` | Audit | Verify status colors have sufficient contrast on dark background |
| `src/pages/WorkbenchPage.vue` | Audit | Verify stat card text colors (`text-grey` caption) are readable |
| `src/components/network/NetworkTopology.vue` | Audit | Verify v-network-graph supports dark mode or needs theme override |

### Tests

| File | Type | Description |
|------|------|-------------|
| `testing/e2e/dark-mode.spec.ts` | New | Toggle dark mode, verify body class, verify persistence on reload |

---

## Implementation Details

### Boot File

```typescript
// src/boot/dark-mode.ts
import { boot } from 'quasar/wrappers'
import { Dark } from 'quasar'
import { useSettingsStore } from 'stores/settings-store'

export default boot(() => {
  const settings = useSettingsStore()

  // Apply saved preference on startup
  if (settings.darkMode === 'auto') {
    Dark.set('auto')
  } else {
    Dark.set(settings.darkMode === 'dark')
  }
})
```

### Toolbar Toggle

```
☀ (light) / 🌙 (dark) / ◐ (auto)

Click cycles: auto → light → dark → auto
Long-press or settings page: explicit selector
```

Use `mdi-weather-sunny` / `mdi-weather-night` / `mdi-theme-light-dark` icons.

### Settings Section

```
┌─ Appearance ──────────────────────────────────────────┐
│                                                        │
│  Theme:  ○ Auto (follow system)                        │
│          ○ Light                                       │
│          ○ Dark                                        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Tier Gating

None — dark mode is **Free tier** (all tiers including demo).

---

## Acceptance Criteria

1. Dark mode toggle button visible in toolbar
2. Clicking toggle cycles through auto / light / dark
3. Settings page has Appearance section with radio selector
4. Preference persists across page refreshes (settings-store)
5. `body.body--dark` class applied when dark mode active
6. All Quasar components render correctly in dark mode
7. Custom CSS classes (vm-card, stat-card, status badges) are readable in dark mode
8. Network topology graph is visible in dark mode
9. Serial console (xterm.js) works in both modes (already dark by default)
10. All existing tests pass
11. `npm run test:precommit` passes

---

## Estimated Effort

| Task | Human | Claude Code |
|------|-------|-------------|
| Quasar config + boot file | 0.25 days | 10 min |
| Toolbar toggle + settings UI | 0.5 days | 20 min |
| CSS audit and fixes | 0.5 days | 30 min |
| Tests | 0.25 days | 15 min |
| **Total** | **1.5 days** | **1–1.5 hrs** |

---

## Documentation

| Target | Updates |
|--------|----------|
| `src/pages/HelpPage.vue` | Add dark mode mention in Settings section of help |

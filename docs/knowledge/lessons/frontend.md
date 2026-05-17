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

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

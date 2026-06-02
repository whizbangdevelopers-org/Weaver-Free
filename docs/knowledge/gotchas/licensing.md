<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — licensing

Known gotchas in the **licensing** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-licensing-2026-06-02-001 -->
---
id: G-licensing-2026-06-02-001
type: gotcha
domain: licensing
tags: [license-claim, tier, decision-137, copyright-header, license-parity]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-licensing-2026-06-02-005]
graduated_to: ""
---

## Unqualified "Weaver is licensed under AGPL-3.0" is wrong for 3 of 4 tiers — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-XX)

**Problem:** Documents written before the tier→license split say "Weaver is licensed under AGPL-3.0" without specifying which tier. Since Solo / Team / Fabrick are BSL-1.1, an unqualified AGPL claim is factually wrong for 3 of the 4 tiers. The drift hides in places that assumed a single license: the LICENSE file's `Software:` line, the README badge, the ATTRIBUTION footer, legal-evaluation docs, and tier-management docs.

**Fix:** Qualify every license reference by tier, or use the unified dual-license statement. The canonical copyright header is: `Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.` The `audit:license-parity` auditor catches future drift between `license-matrix.json` and the docs.

**Rule:** When the product license is tier-dependent, never write "Weaver is licensed under X." Either say "Weaver Free is licensed under X" or use the unified dual-license statement. An unqualified license claim on a multi-license product is a defect, not a simplification (Decision #137).

<!-- /entry -->

<!-- entry:G-licensing-2026-06-02-002 -->
---
id: G-licensing-2026-06-02-002
type: gotcha
domain: licensing
tags: [copyright-header, add-copyright-headers, file-extensions, tsx]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ".claude/rules/copyright.md"
---

## `add-copyright-headers.sh` silently skips file extensions not in its case statement (e.g. `.tsx`) — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-XX)

**Problem:** `add-copyright-headers.sh` handled `.ts`, `.js`, `.mjs`, `.cjs` but not `.tsx`/`.jsx`. TUI React components got no copyright header, and the omission was silent — the script reports success for the files it does know about and never warns about the ones it skips.

**Fix:** Add the missing extensions (`tsx|jsx`) to the script's extension case statement alongside `ts|js`. Re-run `./scripts/add-copyright-headers.sh --check` to confirm coverage.

**Rule:** Every new file extension introduced into the project must be added to `add-copyright-headers.sh`. A copyright-header tool that silently skips unknown extensions leaves protected files unmarked — treat any new extension as a required script update, and rely on `--check` in CI to catch the gap.

<!-- /entry -->

<!-- entry:G-licensing-2026-06-02-003 -->
---
id: G-licensing-2026-06-02-003
type: gotcha
domain: licensing
tags: [copyright-header, docspage, markdown-it, regex, rendering]
since_version: "1.0.5"
status: active
scope: project
related: [G-licensing-2026-06-02-002]
graduated_to: ""
---

## Copyright-header comments render as visible text in DocsPage unless the strip regex matches consecutive blocks — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-XX)

**Problem:** The docs viewer renders markdown imported via `?raw` with `markdown-it` configured `html: false` (escapes HTML rather than parsing it), so copyright `<!-- ... -->` header comments appear as visible text at the top of every doc. The original strip regex `^<!--[\s\S]*?-->\s*` with the `g` flag only removed the *first* comment block — the `^` anchor without the `m` flag matches start-of-string only, and the second header line starts mid-string after the first is consumed, so it survives as visible text.

**Fix:** Use a group quantifier anchored at file start so it matches one or more consecutive comment blocks: `^(\s*<!--[\s\S]*?-->\s*)+`.

**Rule:** Whenever the copyright header format changes (number of comment lines, comment style), re-verify the DocsPage strip regex. Any markdown file rendered through the docs viewer with `html: false` will leak raw comment text if the regex doesn't consume every consecutive header block. The two-line dual-license header makes the "consecutive blocks" case the default, not an edge case.

<!-- /entry -->

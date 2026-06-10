<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — process

Known gotchas in the **process** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-process-2026-05-10-002 -->
---
id: G-process-2026-05-10-002
scope: transferable
type: gotcha
domain: process
tags: [regex, typescript, esm, module, global-flag]
since_version: "1.0.5"
status: active
related: [L-process-2026-05-10-001]
graduated_to: ""
---

## Global regex (`g` flag) must not be a module-level singleton — 2026-05-10 · Claude

**Problem:** A module-level `const` regex with the `g` flag (e.g., `const RE = /pattern/g`) carries `lastIndex` state between invocations. In Node.js ES modules, module-level code runs once and the object is shared across all callers. When the regex is imported by another module AND called from the main entry-point, the `lastIndex` left over from one call context silently causes a later call to start matching from the wrong offset — returning zero results even when the file contains valid matches.

This is particularly treacherous in dual-mode scripts (CLI + importable library) where the same module is loaded once (module singleton) but called at different times from different callers.

**Fix:** Create the regex inside the function that uses it, not at module level:

```typescript
// BROKEN — shared state across calls
const ENTRY_RE = /<!--\s*entry:([\w-]+)\s*-->/g

function scanFile(content: string) {
  ENTRY_RE.lastIndex = 0  // Reset — but still footgun if called concurrently
  while (ENTRY_RE.exec(content) !== null) { ... }
}

// CORRECT — fresh instance per call, no state bleed
function scanFile(content: string) {
  const entryRe = /<!--\s*entry:([\w-]+)\s*-->/g
  while (entryRe.exec(content) !== null) { ... }
}
```

**Related gotcha:** A regex anchor `^---` inside a substring match. When matching a YAML frontmatter block inside a captured group (blockContent), the `^` anchor without the multiline flag only matches the very start of the string. If blockContent begins with `\n---` (a newline before the first `---`), the `^---` pattern fails silently. Fix: remove `^` and match `/---\n.../` directly when the leading newline is expected.

**Rule:** Never put a `g`-flagged regex at module level if the function using it could be called more than once or imported by other modules. Create it fresh inside the function. For anchored sub-string matching inside captured groups, trace what character position the captured string starts at before assuming `^` will work.

<!-- /entry -->

<!-- entry:G-process-2026-05-10-001 -->
---
id: G-process-2026-05-10-001
scope: project
type: gotcha
domain: process
tags: [auditor, marker-sync, doc-parity, audit-chain]
since_version: "1.0.5"
status: active
related: [L-process-2026-05-13-001]
graduated_to: ""
---

## New docs with auditor counts need marker registration at write time — 2026-05-10 · Claude

**Problem:** When a new prose document is created that mentions the auditor count (e.g., "the pre-push hook runs N static auditors"), it is tempting to write the raw number directly. The `audit:doc-parity` auditor checks this count against `package.json` at push time and catches the drift — but only at push time, after the number is already stale. If the count grows between the time the doc was written and the next push (e.g., because more auditors are added in the same session), every push fails until the doc is updated.

**Fix:** Whenever writing a count that derives from `run-compliance.ts` into any prose document, immediately:

1. Replace the raw number with a marker: `<!-- auditor-count:begin -->N<!-- auditor-count:end -->`
2. Add the doc path to the `docs` array of the `auditor-count` registration in `code/scripts/sync-markers.ts`
3. Run `npm run sync:markers` once to populate the correct value

The marker is then maintained automatically by the pre-commit hook on every subsequent change to `run-compliance.ts`.

**Rule:** No prose document should contain a raw auditor count. Every occurrence is a `<!-- auditor-count:begin -->` marker waiting to be planted. Grep for bare numbers when adding a new doc that summarises the CI chain.

<!-- /entry -->

<!-- entry:G-process-2026-05-14-001 -->
---
id: G-process-2026-05-14-001
type: gotcha
domain: process
tags: [shell, curl, json, debugging, pipe]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Shell-pipe JSON parsing via inline python3/jq produces false failures from quoting artifacts — 2026-05-14 · Claude

**Problem:** When smoke-testing API responses with `curl | python3 -c "import json,sys; ..."` or `curl | jq`, shell variable interpolation inside the quoted python3 string can silently corrupt the JSON or produce misleading "Invalid control character" / "parse error" failures. The symptom looks like the API is returning malformed JSON, but the actual issue is the shell quoting — the API response is clean.

**Fix:** Write the curl response to a temp file first, then parse from the file:
```bash
curl -s -X POST http://localhost:PORT/path -H 'Content-Type: application/json' \
  -d '{"key":"value"}' > /tmp/test-response.json
python3 -c "import json; d=json.load(open('/tmp/test-response.json')); print(d.get('field'))"
```
This eliminates shell quoting from the parse path entirely. The response bytes on disk are exactly what the server sent.

**Rule:** Never pipe curl output through an inline python3 `-c` string that contains shell variables or complex quoting. Write to a file, parse from the file. Use this pattern consistently when smoke-testing JSON APIs from the terminal.

<!-- /entry -->

<!-- entry:G-process-2026-05-18-001 -->
---
id: G-process-2026-05-18-001
type: gotcha
domain: process
tags: [git, filenames, special-chars, restore, xargs]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## `git checkout -- $(git ls-files -d)` fails with special characters in filenames — 2026-05-18 · Claude

**Problem:** When restoring a batch of accidentally-deleted tracked files, `git checkout -- $(git ls-files -d)` fails with "pathspec 'archive/brand-lockup-wip/whizBANG!' did not match any file(s)" because word splitting breaks filenames containing spaces, exclamation marks, or other shell-special characters.

**Fix:** Use the null-delimited form instead:
```bash
git ls-files -z -d | xargs -0 git checkout --
```
`-z` outputs NUL-separated filenames; `-0` in xargs reads NUL-separated input. No shell word splitting, no quoting issues, no partial restore.

**Rule:** Any batch git operation on a file list should use `-z`/`-0` by default — the fallback to shell word splitting only works on repos where every filename is a plain ASCII slug.

<!-- /entry -->

<!-- entry:G-process-2026-06-01-001 -->
---
id: G-process-2026-06-01-001
type: gotcha
domain: process
tags: [terminology, security, networking, documentation]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## "Airgapped" means zero internet path — NAT'd is not airgapped — 2026-06-01 · Claude

**Problem:** A machine was labeled `airgapped: true` in the fleet inventory with the note "No WAN NIC." The machine had no direct WAN interface but had full internet access via NAT through a gateway host. When the NAT was set up and tested (confirmed HTTP response from external host), the `airgapped` label became actively misleading — it implied security isolation that didn't exist.

**Fix:** Remove `airgapped: true`. Use a descriptive note: "No direct WAN NIC — internet via <gateway> NAT."

**Rule:** Airgapped = zero network path to the internet. A machine that reaches the internet through NAT, a proxy, or a bastion is not airgapped — it's indirectly connected. Using `airgapped` for "no direct WAN NIC" is dangerous: security assumptions downstream of that label (no internet = no exfiltration risk, no update exposure) will be wrong. Document the actual topology.

<!-- /entry -->

<!-- entry:G-process-2026-06-02-001 -->
---
id: G-process-2026-06-02-001
type: gotcha
domain: process
tags: [auditor, regex, vocabulary-constants, false-negative, drift]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Regex auditors drift to false negatives when code adopts vocabulary constants — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** Auditors using regex to detect patterns like `requireRole('admin')` or `requireTier(config, 'weaver')` silently stop matching when the codebase migrates to vocabulary constants (`ROLES.ADMIN`, `TIERS.SOLO`). The auditor still sees the function call but can't extract the argument, so it reports a false negative — the check appears green while no longer checking anything.

**Fix:** Make the auditor regex match both forms — string literals and constant references:
```typescript
const literalMatch = block.match(/requireRole\s*\(\s*(['"`])(.+?)\1/)
const constMatch   = block.match(/requireRole\s*\(\s*(ROLES\.\w+(?:\s*,\s*ROLES\.\w+)*)/)
```
The auditor's test suite must include both constant and literal patterns.

**Rule:** When introducing vocabulary constants, update every auditor regex that matched the old literal form in the same change. A static auditor that only matches string literals is one refactor away from silently passing forever.

<!-- /entry -->

<!-- entry:G-process-2026-06-02-002 -->
---
id: G-process-2026-06-02-002
type: gotcha
domain: process
tags: [auditor, silent-failure, file-path, skip-warning, reorg]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-process-2026-06-02-012]
graduated_to: ""
---

## Auditor "not found — skipping" is a silent failure, not a graceful one — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** Auditors that resolve a file path and skip gracefully when it's missing (`if (!existsSync(path)) { warn(...); return }`) silently disable entire check categories when directories are reorganized. Six checks were disabled for weeks after a `business/` reorg moved `business/TIER-MANAGEMENT.md` to `business/product/TIER-MANAGEMENT.md` — every run printed a benign-looking "skipping" warning while the invariant went unenforced.

**Fix:** Make "file not found" an error, not a warning, for canonical source files. After any directory reorganization, grep all auditor scripts for the old path structure. Reserve skip-with-warning only for checks that are genuinely optional.

**Rule:** A "skipping" warning in an auditor is a bug for any canonical source file — it must fail loudly when its input is missing. Silent skips convert a moved file into a disabled invariant that nobody notices until much later.

<!-- /entry -->

<!-- entry:G-process-2026-06-02-003 -->
---
id: G-process-2026-06-02-003
type: gotcha
domain: process
tags: [auditor, auth, middleware-stack, route, false-positive]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Static auth auditors must model the full middleware stack, not just per-route annotations — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** A route-auth auditor that only detected per-route patterns (`requireRole`, `aclPreHandler`, manual `request.userId` + 401) flagged routes protected by Fastify's global `onRequest` JWT middleware as "missing auth" — the middleware runs at a scope the per-route regex can't see, producing false positives on compliant routes.

**Fix:** Parse the auth middleware source (e.g. its `PUBLIC_ROUTES` list) and classify every route into three layers: (1) authorized — per-route role/ACL/manual check; (2) JWT-protected — global middleware covers authentication, no per-route role check; (3) public/exempt — intentionally open (login, health, WebSocket with own auth). Fail only if a route escapes all three. JWT-only routes are compliant (authenticated, just not role-restricted).

**Rule:** A static auth auditor must model the actual middleware stack as input — parse the real middleware source rather than hardcoding assumptions about what is globally protected. Per-route annotations are only one of several authorization layers.

<!-- /entry -->

<!-- entry:G-process-2026-06-02-004 -->
---
id: G-process-2026-06-02-004
type: gotcha
domain: process
tags: [auditor, ui-text, vue-sfc, script-section, brand-mark]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## UI-text auditors must scan script sections and TS config, not just Vue templates — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** A brand-mark / vocabulary auditor that scanned only `<template>` sections of `.vue` files missed user-visible strings declared in `<script>` (`label: 'Fabrick'`) and in frontend `.ts` config files (funnel-step data, extension-name constants). Those strings reach the user but escaped the auditor entirely.

**Fix:** Expand the scanner to cover `.vue` files fully (template + script, excluding only `<style>`) and all frontend `.ts` files that export user-visible strings. Maintain a skip list for non-user-visible matches (CSS classes, route paths, tier string literals, imports, comments).

**Rule:** A static auditor for user-facing text must scan both template AND script sections of Vue SFCs, plus any TypeScript file that exports user-visible strings (config, constants, data). User-visible text lives in more places than the template.

<!-- /entry -->

<!-- entry:G-process-2026-06-02-005 -->
---
id: G-process-2026-06-02-005
type: gotcha
domain: process
tags: [sync-marker, parity, distinct-tags, self-comparison]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-process-2026-05-10-001]
graduated_to: ""
---

## Sync-marker pairs for multi-file parity need distinct tag names per file — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** A compatibility-sync auditor compares a full table in one file against a condensed table in another. If both files used the same marker name (e.g. `SYNC:TABLE:START/END`), a path mix-up would make the auditor compare a file against itself and pass vacuously.

**Fix:** Use distinct tag names per file even when they track the same data — `SYNC:PLATFORM_TABLE:START/END` in the source-of-truth doc, `SYNC:COMPAT_SUMMARY:START/END` in the summary doc.

**Rule:** When creating sync-marker pairs for a multi-file parity check, name the markers distinctly per file. Identical marker names invite accidental self-comparison, which is the one failure mode a parity auditor must never have.

<!-- /entry -->

<!-- entry:G-process-2026-06-02-006 -->
---
id: G-process-2026-06-02-006
type: gotcha
domain: process
tags: [shell, arithmetic, command-substitution, whitespace, set-e]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-05-10-002]
graduated_to: ""
---

## Sanitize command-substitution output before bash arithmetic comparison — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** Bash arithmetic comparisons (`[[ "$VAR" -gt 0 ]]`) fail with "arithmetic syntax error" when `$VAR` contains whitespace, newlines, or is empty. This commonly happens with `grep -c` (count plus trailing newline) and `wc -l` on some platforms — e.g. `IOMMU=$(dmesg | grep -ci iommu || echo 0)` can yield `"0\n0"`, crashing the later `[[ "$IOMMU" -gt 0 ]]`.

**Fix:** Sanitize before arithmetic use — `VAR=$(echo "$VAR" | tr -d '[:space:]')` — and prefer `|| true` over `|| echo 0` (which can double the output), then default with `VAR="${VAR:-0}"`.

**Rule:** Any value flowing from command substitution into a `[[ -gt ]]`/`-lt` arithmetic test must be whitespace-stripped and defaulted first. Counts from `grep -c`/`wc -l` are the usual culprits. (Companion to the `set -e` post-increment gotcha — shell arithmetic has multiple silent-failure footguns.)

<!-- /entry -->

<!-- entry:G-process-2026-06-02-007 -->
---
id: G-process-2026-06-02-007
type: gotcha
domain: process
tags: [curl, download, fail-fast, silent-corruption, asset-urls]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## curl downloading a file must use -f — without it, HTML error pages get saved as the asset — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** `curl -sL "$URL" -o "$PATH"` happily writes an HTTP 404's HTML body into the target file when the URL has rotated — a 1.6 KB HTML document saved as `inter-latin.woff2`. The browser silently falls back to system fonts and the corrupt asset goes unnoticed for weeks because the file is present at the expected path with a plausible size.

**Fix:** Always `curl -sfL "$URL" -o "$PATH"` — `-f` makes curl exit non-zero on HTTP 4xx/5xx instead of saving the error body. Pair with `set -euo pipefail` in the calling script so the failure propagates. Secondary defense: for vendored static assets prefer CDN paths that version by semver in the URL (e.g. Fontsource `@<major>`) over hash-encoded revision URLs (Google Fonts `v18/...hash.woff2`) that 404 silently when the upstream reshuffles.

**Rule:** Any curl invocation that downloads a file MUST use `-f`. Silent corruption from a missing `-f` is among the hardest bugs to diagnose because the artifact looks present and correctly sized. Treat any URL containing a content-revision hash (not a semantic version) as impermanent.

<!-- /entry -->

<!-- entry:G-process-2026-06-02-008 -->
---
id: G-process-2026-06-02-008
type: gotcha
domain: process
tags: [jsdoc, esbuild, block-comment, tsx, backtick]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## JSDoc block comments: a literal */ or backtick pair breaks the esbuild/tsx transform — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** esbuild's TypeScript transform (used by `tsx`) treats `*/` as end-of-comment even inside prose — a comment line like `scope: agents/v*.*.*/*.md` terminates the comment at the first `*/`, leaving the rest of the line as code that doesn't parse. Backtick pairs inside `/* … */` can similarly confuse the parser via template-literal start/end inference.

**Fix:** In JSDoc / block-comment prose, avoid (1) the literal sequence `*/` unless you mean end-of-comment — use `(version)` placeholders or parenthesized descriptions instead of glob patterns; (2) wrapping code-like snippets in backticks — prose comments don't need them.

**Rule:** Any comment text that would parse as code if the comment markers were removed is a hazard. Keep block comments prose-only — no glob patterns containing `*/`, no backtick-wrapped snippets.

<!-- /entry -->

<!-- entry:G-process-2026-06-02-009 -->
---
id: G-process-2026-06-02-009
type: gotcha
domain: process
tags: [doc-parity, count, semantic-grep, collision, bulk-update]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-process-2026-05-10-001, L-process-2026-06-02-023]
graduated_to: ""
---

## Bump a counted quantity by its semantic phrase, never the bare number — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** When the marketed auditor count must bump across several docs, a grep for the bare digit (e.g. `44`) also matches an unrelated "SHA-pinned GitHub Actions (44/44)" reference describing a different quantity that does *not* bump when an auditor lands. A sloppy bare-number sweep would silently falsify a compliance-doc statement. Two numerically-equal quantities coexist in the corpus.

**Fix:** Grep with the semantic phrase and context — `"44 auditor"`, `"44 static auditor"`, `"44/44"` paired with its subject — never just `44`. The `audit:doc-parity` / `audit:engineering-discipline-parity` auditors fail loud on auditor-count drift but cannot tell which `44` you meant.

**Rule:** When bumping a counted quantity across docs, always grep by the semantic phrase (`"<N> auditors"`), never the bare number. The durable fix is to promote the count to a sync marker so it derives from one source (see [[L-process-2026-06-02-023]]).

<!-- /entry -->

<!-- entry:G-process-2026-06-02-010 -->
---
id: G-process-2026-06-02-010
type: gotcha
domain: process
tags: [compliance-runner, auditor-count, build-tui, reconcile, package-json]
since_version: "1.0.5"
status: active
scope: project
related: [G-process-2026-06-02-009]
graduated_to: ""
---

## Compliance-runner pass count ≠ doc-claimed auditor count — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** `npm run test:compliance` reports `N/M passed` where `M` includes the `build:tui` prerequisite (phase 1) and the serial-tail `audit:generated-artifact-freshness` (phase 3) on top of the parallel auditors (phase 2). Docs count only the auditor scripts. Result: terminal says `46/46` while docs say `45 auditors` — both correct, confusing at a glance, and a trap when reconciling after adding an auditor.

**Fix:** When reconciling the count, read it from `package.json`'s registered `audit:*` scripts that are actually chained into `test:compliance` — not from the runner's pass count. The engineering-discipline-parity auditor enforces the doc count against `package.json`, not against runner output.

**Rule:** "N auditors" in docs means "N static-analysis checks." `build:tui` and generator-adjacent freshness checks are infrastructure around the auditors, not part of the count. Reconcile against the source list, never the runner tally.

<!-- /entry -->

<!-- entry:G-process-2026-06-02-011 -->
---
id: G-process-2026-06-02-011
type: gotcha
domain: process
tags: [edit-tool, replace-all, quotes, string-to-variable]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-019]
graduated_to: ""
---

## Edit replace_all from a string literal to a variable must include the surrounding quotes — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** When using `replace_all` to swap a hardcoded string for a variable reference, replacing only the inner text leaves the now-wrong quote characters in place (`"foo"` → `"myVar"` instead of `myVar`), producing a string literal of the variable name rather than the variable's value.

**Fix:** Check whether the original occurrence was inside quotes and include the quotes in the replacement pattern — match `"foo"` and replace with `myVar`, not match `foo` and replace with `myVar`.

**Rule:** Before a `replace_all` that converts a literal into a code reference (variable, constant, call), inspect the delimiters around the match and fold them into the pattern. A naive inner-text swap silently produces a string of the identifier name.

<!-- /entry -->

<!-- entry:G-process-2026-06-02-012 -->
---
id: G-process-2026-06-02-012
type: gotcha
domain: process
tags: [file-move, cross-reference, doc-freshness, grep, plans]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-process-2026-06-02-002, L-process-2026-06-02-022]
graduated_to: ""
---

## Moving a doc breaks cross-reference links — grep the old path before committing — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** Moving a file from `plans/v1.0.0/` to `plans/cross-version/` broke a link in `MASTER-PLAN.md`. `audit:doc-freshness` caught it — but only at push time, after the move commit was already made, forcing a second fix commit.

**Fix:** After any file move in `plans/`, `agents/`, or `docs/`, grep for the old path across the repo before committing the move: `grep -r 'old/path/filename' --include='*.md'` (and `grep -rn 'filename.md'` for bare-name references). Fix every reference in the same commit as the move.

**Rule:** File moves in cross-referenced directories always require a reference sweep before commit. The doc-freshness auditor validates links but only at push time — proactively grepping turns a two-commit fix into one. (Related to the bare-name surface-form grep for directory renames.)

<!-- /entry -->

<!-- entry:G-process-2026-06-02-013 -->
---
id: G-process-2026-06-02-013
type: gotcha
domain: process
tags: [parsefloat, version-comparison, semver, off-by-one]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-02-025]
graduated_to: ""
---

## parseFloat('1.10.0') equals parseFloat('1.1.0') — version reordering past v1.9 — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-06-02)

**Problem:** `parseFloat('1.0.0') = 1`, `parseFloat('1.1.0') = 1.1`, `parseFloat('1.10.0') = 1.1`. The third stops at the second decimal point. Any version comparison using `parseFloat` silently reorders at v1.10+ — v1.10 and v1.1 become identical, and v1.2 > v1.10. It looks correct from v0.x through v1.9, then breaks the moment a minor goes double-digit.

**Fix:** Use integer-based comparison: parse the version string into major/minor parts and combine them as `major * 1000 + minor` (room for multi-digit minors). Use a proper semver library if you need patch-level precision.

**Rule:** `parseFloat` is never the right tool for version comparison. It looks like it works until you hit the first double-digit minor version.

<!-- /entry -->

<!-- entry:G-process-2026-06-02-014 -->
---
id: G-process-2026-06-02-014
type: gotcha
domain: process
tags: [git, stash, checkout, regression-test, data-loss]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## git stash push + checkout wipes the stash if you forget to pop — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-06-02)

**Problem:** Regression-testing a new auditor on uncommitted work, the sequence (1) `git stash push <file>` to save a rewrite, (2) inject drift into the now-HEAD-version file and run the auditor → FAIL (regression proven), (3) `git checkout <file>` to undo the injection, (4) `git stash drop` — destroyed the rewrite. The `git checkout` in step 3 restored from HEAD (pre-rewrite), not from the stash, and `drop` then discarded the only copy of the stashed rewrite. ~15 minutes of lost work; the pattern generalizes to any local-only work a regression test must temporarily back out.

**Fix:** Either (a) `git add <file>` the rewrite BEFORE the regression test, so `git checkout <file>` restores from the staged index instead of HEAD, OR (b) end the cycle with `git stash pop` instead of `drop` + `checkout` — pop restores the stashed version on top of the current working tree.

**Rule:** When doing "stash-revert-test-restore" cycles on uncommitted work, always use `git stash pop` to restore. `git checkout <file>` + `git stash drop` is an unsafe shortcut that silently loses the stashed content if the stash hasn't been popped back first.

<!-- /entry -->

<!-- entry:G-process-2026-06-04-001 -->
---
id: G-process-2026-06-04-001
type: gotcha
domain: process
tags: [tier-parity, rename, auditor, data-contract, tier-matrix]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## A tier-guard rename spans code + data contract + auditor — not "mechanical via TypeScript" — 2026-06-04 · Claude

**Problem:** Renaming the `isWeaver` tier guard (v1.1 `isWeaver`→`isSolo`) looked like a pure-TypeScript mechanical rename ("TS flags every site, so it's complete"). It is NOT — the guard NAME is hardcoded in THREE coordinated places: (1) the code (getter def + ~71 call sites in `src`); (2) `tier-matrix.json` — the `"guard": "isWeaver"` entries (the tier-parity DATA contract, ~11 features); (3) `scripts/verify-tier-parity.ts` — the auditor's hardcoded guard name (a union-type member, the `/\b(isWeaver|isFabrick)\b/` regex, and `content.includes('isWeaver')`). Renaming only the code leaves `typecheck` GREEN but `audit:tier-parity` RED with 11 `FRONTEND_MISSING_GUARD` errors.

**Fix:** Rename the guard across all three artifacts in one transform. Updating the auditor's expected value alongside the code is **legitimate, not gaming** (see never-game-auditors): the guard name genuinely changed, so the auditor's hardcoded expectation changes with it; the auditor's detection LOGIC stays intact (still cross-checks tier-matrix guards against frontend usage).

**Rule:** A tier-guard / cross-cutting identifier rename is not "mechanical via TypeScript." `grep` the identifier across DATA contracts (`*.json`) and AUDITORS (`scripts/`), not just `src` — typecheck-green ≠ contract-complete.

<!-- /entry -->

<!-- entry:G-process-2026-06-04-002 -->
---
id: G-process-2026-06-04-002
type: gotcha
domain: process
tags: [git, reset, executor, worktree, forge-loop]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## `git reset --hard` on a shared/executor working branch silently discards uncommitted work — 2026-06-04 · Claude

**Problem:** To get a clean base for an autonomous loop run, I `git reset --hard main` on the executor's feature branch. The branch carried uncommitted slice output (a modified layout + a staged new spec) from a prior run that had never been committed (see the commit-quoting gotcha). The hard reset reverted the tracked file and dropped the staged file — recoverable here only because the slice diff happened to be preserved on the conductor, but it was unguarded data loss on a checkout that other runs/sessions share.

**Fix:** Don't `reset --hard` a working branch you don't own outright. For a clean base, branch off the base ref (`git checkout -b <fresh> <base>`) and run there, leaving the existing branch untouched. If you must reset, first capture the working tree (`git stash` or a diff to a file) and tag any commit you're about to discard so it's recoverable by design, not by luck.

**Rule:** Treat an executor/shared checkout's working tree as someone else's uncommitted work (it usually is). Prefer a fresh branch over an in-place destructive reset; make discarded state recoverable *before* discarding it.
<!-- /entry -->

<!-- entry:G-process-2026-06-05-001 -->
---
id: G-process-2026-06-05-001
type: gotcha
domain: process
tags: [workflow, subagents, structured-output, orchestration]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Multi-agent Workflow authoring footguns — schema agents that fail, and backticks that break parsing — 2026-06-05 · Claude

**Problem:** Two recurring ways a `Workflow` run dies. (1) A subagent given a `schema` that ALSO does heavy work (long reads, a nested `claude -p`, deep reasoning) often "completed without calling StructuredOutput (after 2 in-conversation nudges)" — and that single failure propagates past `parallel()`/`pipeline()` and kills the WHOLE run, discarding every sibling's completed work. Using `agentType:'Explore'` makes it worse: Explore is built to *locate* code, not to reason or emit structured output. (2) An inline backtick inside a prompt **template literal** (e.g. wrapping a field name in `` `analysis` ``) prematurely closes the JS template string → `Unexpected token` parse error before the workflow even launches.

**Fix:** (1) Add `.catch(() => null)` to EVERY `agent()` call inside `parallel`/`pipeline` so one failure degrades to a filtered-out null instead of aborting the barrier. Don't use `agentType:'Explore'` for reasoning/structured tasks — use the default agent. For analysis lanes that don't need machine-parsing, drop the `schema` entirely and return text (text agents don't hit the StructuredOutput failure). When a schema run dies, the partial work is often recoverable from disk (e.g. files the agents already wrote) — read it rather than re-running. (2) Never put raw backticks in a prompt template literal; use single quotes or escape them. Validate JS syntax before launch: `cp wf.js /tmp/x.mjs && node --check /tmp/x.mjs` (an "Illegal return" warning is expected — top-level `return` is workflow-legal).

**Rule:** Treat workflow subagents as flaky at the StructuredOutput boundary: isolate each with `.catch`, prefer text output for analysis, reserve schemas for short extract-style agents, and never let a barrier's success depend on all agents succeeding.
<!-- /entry -->

<!-- entry:G-process-2026-06-05-002 -->
---
id: G-process-2026-06-05-002
type: gotcha
domain: process
tags: [ci, branch-protection, github-actions, release-only]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-process-2026-06-05-001]
graduated_to: ""
---

## Moving CI to release-only orphans branch-protection required status checks — every push then needs a bypass — 2026-06-05 · Claude

**Problem:** After switching CI to release-tags-only (dropping `test.yml`'s push/PR trigger), the FIRST push to `main` reported `remote: Bypassed rule violations for refs/heads/main: 5 of 5 required status checks are expected.` Branch protection still **required** 5 status checks (`Unit Tests`, `Backend Tests`, `TUI Tests`, `Compliance Auditors`, `Build`) sourced from `test.yml` — but that workflow no longer runs on push, so those checks can NEVER report green. The push only succeeded because admin-bypass was available (`enforce_admins:false`); every subsequent push would silently rely on the same bypass — protection theater, not protection.

**Fix:** Reconcile branch protection in the SAME change that alters CI triggers. If a required status check's workflow no longer runs on push, it must be removed from (or realigned in) branch protection, or it blocks all pushes. For the release-only model, drop the orphaned required checks surgically (preserve the rest): `gh api --method DELETE repos/<org>/<repo>/branches/main/protection/required_status_checks` — this nulls `required_status_checks` while leaving `allow_force_pushes:false` / `allow_deletions:false` intact. Correctness is then gated by the pre-push hook (every push) + the release `verify` job (every tag), not by GitHub push-time checks. Verify with `gh api .../protection --jq .required_status_checks`.

**Rule:** A required status check is only protection if its workflow actually reports on the protected event. Whenever you change a workflow's `on:` triggers, audit `branches/<b>/protection/required_status_checks.contexts` for checks that just went dark — orphaned required checks degrade to mandatory bypasses, which is worse than no requirement.
<!-- /entry -->

<!-- entry:G-process-2026-06-05-003 -->
---
id: G-process-2026-06-05-003
type: gotcha
domain: process
tags: [sudo, nopasswd, debugging, root]
since_version: "1.0"
status: active
scope: project
related: []
graduated_to: ""
---

## NOPASSWD sudo allowlist excludes ls/cat → silent failure → misdiagnosis — 2026-06-05 · Claude

**Problem:** When sudo is a NOPASSWD *allowlist* (specific binaries: `nix`, `nixos-rebuild`, `systemctl`, `cp`, `rm`…), a non-allowlisted command like `sudo ls /run/secrets` or `sudo cat <file>` prompts for a password. In a non-interactive shell that prompt fails to **stderr** (`sudo: a terminal is required…`); with `2>/dev/null` the call returns *empty stdout*, which reads as "directory empty / file missing." This produced a false "king's sops secrets aren't mounting" diagnosis — they were mounting fine.

**Fix:** Run reads as root *via* an allowlisted binary: `sudo nix shell nixpkgs#coreutils --command ls -la /run/secrets/`. Check `sudo -n -l` first to see what's allowlisted. Never trust empty output from a `sudo <non-allowlisted>` call.

**Rule:** Before concluding "file/dir empty/missing" from a `sudo` read, verify the binary is in the NOPASSWD set; if not, re-run via an allowlisted wrapper.

<!-- /entry -->

<!-- entry:G-process-2026-06-10-001 -->
---
id: G-process-2026-06-10-001
scope: transferable
type: gotcha
domain: process
tags: [regex, unicode, word-boundary, auditor, decision-conflict, false-negative]
since_version: "1.0.5"
status: active
related: [L-process-2026-06-10-001]
graduated_to: ""
---

## JS regex `\b` before a non-ASCII letter never matches — silently breaks `à la carte` detection — 2026-06-10 · Claude

**Problem:** The à la carte claim pattern `\b(?:à\s*la\s*carte)\s+extension` matched **nothing**, so the auditor silently missed every "à la carte extension" claim (a false-negative — worse than a false-positive because it looks green). Cause: JavaScript's default `\b` word boundary is defined only over the ASCII `[A-Za-z0-9_]` class. `à` is not a "word character" to the engine, so between a preceding space and `à` there is *no* boundary — `\bà` can never match `"an à"`. The leading `\b` killed the whole alternation.

**Fix:** Drop the `\b` before the non-ASCII branch and anchor the ASCII branch separately:
`(?:à\s*la\s*carte|\ba\s+la\s+carte)\s+(?:extension|model|...)`. The accented form needs no `\b` (the literal `à` is specific enough); the plain-ASCII "a la carte" keeps its `\b` and requires real spaces (`\s+`) so it doesn't fire mid-word.

**Rule:** Never put `\b` immediately before a non-ASCII letter in a JS regex without the `u` flag + Unicode property escapes. For accented/multilingual terms, either omit the boundary (rely on the literal's specificity) or use `\p{L}` boundaries under the `u` flag. Always assert the regex matches a positive fixture **and** rejects a near-miss — a pattern that matches nothing passes a "no conflicts" test for the wrong reason.

<!-- /entry -->

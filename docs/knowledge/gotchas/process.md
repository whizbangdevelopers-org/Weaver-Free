<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — process

Known gotchas in the **process** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-process-2026-05-10-002 -->
---
id: G-process-2026-05-10-002
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

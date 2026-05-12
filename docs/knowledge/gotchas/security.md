<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — security

Known gotchas in the **security** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-security-2026-05-12-001 -->
---
id: G-security-2026-05-12-001
type: gotcha
domain: security
tags: [semgrep, sast, regex, parser]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Semgrep cannot parse `<!--` inside TypeScript regex literals — 2026-05-12 · Claude

**Problem:** A regex literal like `/<!--\s*entry:([\w-]+)\s*-->/g` in a TypeScript file causes Semgrep to abort with a parser error: `was unexpected` at the `<!--` character. Semgrep's parser treats `<!--` as an HTML comment opener even inside a regex. When any rule hits a parse error on a file, the file is excluded from taint analysis silently — the auditor `errors.length > 0` check exits 1.

**Fix:** Convert the regex literal to a `RegExp` constructor: `new RegExp('<!--\\s*entry:...')`. The constructor form avoids the `<!--` literal in the source text.

**Rule:** Any regex that contains HTML-like tokens (`<!--`, `-->`, `</`, `<tag>`) must use the `RegExp` constructor form in files that Semgrep scans.

<!-- /entry -->

<!-- entry:G-security-2026-05-12-002 -->
---
id: G-security-2026-05-12-002
type: gotcha
domain: security
tags: [semgrep, taint, focus-metavariable, sink]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Semgrep `focus-metavariable` in taint sinks does not restrict WHICH arg must be tainted — 2026-05-12 · Claude

**Problem:** A sink pattern like `writeFileSync($SINK, ...)` with `focus-metavariable: $SINK` fires when ANY argument to `writeFileSync` is tainted — not only when `$SINK` itself is tainted. `focus-metavariable` only controls which part of the match is highlighted in the output. So `writeFileSync(cleanPath, taintedContent)` triggers the CWE-22 path-traversal finding even though the path is clean.

**Fix:** Ensure no user-derived data appears anywhere in the matched call — not just in the focused metavariable. For temp-file writes, use server-side-only data in the path (e.g., `Date.now()`); keep user data out of the content argument too when the call matches a sink pattern.

**Rule:** When a Semgrep taint sink fires and you believe the focused metavariable is clean, check all other arguments for user-derived data. `focus-metavariable` highlights, it does not gate.

<!-- /entry -->

<!-- entry:G-security-2026-05-12-003 -->
---
id: G-security-2026-05-12-003
type: gotcha
domain: security
tags: [semgrep, taint, sanitizer, derived-variable]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Semgrep taint sanitizers do not propagate cleanness to derived variables — 2026-05-12 · Claude

**Problem:** Even when a sanitizer pattern like `/^[a-z][a-z0-9_-]*$/.test(domain)` clears the taint on `domain`, variables derived from `domain` (e.g., `suffix = [domain, scope].join('-')`) remain tainted. Semgrep tracks taint from the source (`request.body`) forward; once a variable is tainted, any derivative inherits the taint. Sanitizing the original does not retroactively clean derivatives already computed from it.

**Fix:** The reliable fix is to not include user data in the taint path at all — compute temp paths from server-side data only (e.g., `Date.now()`). Sanitizer patterns are most useful for single-hop sinks where the validated value is used directly, not for values that flow through intermediate array/string operations.

**Rule:** Don't rely on taint sanitizers to clean derived variables. Keep user data out of the computation that reaches the sink entirely.

<!-- /entry -->

<!-- entry:G-security-2026-05-12-004 -->
---
id: G-security-2026-05-12-004
type: gotcha
domain: security
tags: [semgrep, taint, sanitizer, regex-pattern]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Semgrep regex sanitizer patterns require exact textual match — 2026-05-12 · Claude

**Problem:** A Semgrep sanitizer defined as `/^[a-z][a-z0-9_\-]*$/.test($X)` does NOT match code that writes `/^[a-z][a-z0-9_-]*$/.test(x)` — the conventional form with an unescaped hyphen at the end of the character class. `\-` and `-` in a JS regex character class are semantically identical, but Semgrep matches regex literals textually, not semantically.

**Fix:** Add all equivalent forms to the rule's `pattern-sanitizers` list. Both `[a-z0-9\-]` (escaped) and `[a-z0-9-]` (conventional) must be listed. Also consider whether both the with-underscore and without-underscore variants need separate entries.

**Rule:** When adding regex patterns to Semgrep sanitizers, enumerate every textual form the team actually writes in code — Semgrep won't infer equivalence.

<!-- /entry -->

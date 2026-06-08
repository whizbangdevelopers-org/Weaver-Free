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

<!-- entry:G-security-2026-05-15-001 -->
---
id: G-security-2026-05-15-001
type: gotcha
domain: security
tags: [sast, command-injection, sqlite, exec, compile-time-constant]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## SAST command-injection rule flags `exec(stmt + ';')` on a compile-time constant — 2026-05-15 · Claude

**Problem:** Porting the `openEngramDb` schema initialization pattern into the backend produced this code: `for (const stmt of SCHEMA.split(';')...) { handle.exec(stmt + ';') }`. The SAST `command-injection` rule flagged line `handle.exec(stmt + ';')` as a taint sink fed by a potentially untrusted string. The `stmt` variable is derived entirely from splitting a hardcoded compile-time SCHEMA constant — no user input anywhere. The SAST tool performs lexical taint tracking and cannot distinguish a constant-derived intermediate from a user-input-derived one.

**Fix:** `DatabaseSync.exec()` (Node.js `node:sqlite`) handles multi-statement SQL natively — pass the entire SCHEMA string directly: `handle.exec(SCHEMA)`. This removes the split/concat loop entirely, making the pattern cleaner and eliminating the flagged concatenation.

**Rule:** When initializing a database schema with a hardcoded SQL constant, pass it to `exec()` as a single call. Splitting on `;` and re-appending is unnecessary for `node:sqlite`'s `exec()`, introduces a string concatenation that SAST tools flag as potential injection, and is strictly worse in every dimension. Use `exec(fullSqlString)` — the semicolons in the SQL are sufficient delimiters.

<!-- /entry -->

<!-- entry:G-security-2026-06-02-001 -->
---
id: G-security-2026-06-02-001
type: gotcha
domain: security
tags: [cookies, secure-flag, http, tls, node-env, auth]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Cookie `secure: true` inferred from NODE_ENV breaks auth over HTTP — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** Login page shows an infinite spinner. Browser console: `Cookie "weaver_token" has been rejected because a non-HTTPS cookie can't be set as "secure".` The backend set `secure: isProduction` on httpOnly auth cookies, and the NixOS module sets `NODE_ENV=production`. Any production install without a TLS reverse proxy serves over HTTP → the browser silently rejects the secure cookie → auth fails → every protected page bounces to login → infinite spinner.

**Fix:** Replace `const isProduction = process.env.NODE_ENV === 'production'` with `const secureCookies = process.env.COOKIE_SECURE === 'true'` in every cookie-setting route (register, login, refresh). Default is `false` so HTTP works out of the box; the NixOS module sets `COOKIE_SECURE=true` only when auto-TLS is configured.

**Rule:** Never infer cookie security from `NODE_ENV`. Production installs legitimately run over plain HTTP (behind a firewall, on a LAN, during initial setup). Tie the `secure` flag to an explicit TLS-configuration env var, never to deployment environment.

<!-- /entry -->

<!-- entry:G-security-2026-06-02-002 -->
---
id: G-security-2026-06-02-002
type: gotcha
domain: security
tags: [tsconfig, noemitonerror, typescript, build-integrity]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Backend tsc emits JS despite type errors without noEmitOnError — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04)

**Problem:** `npm run build` (tsc) exits with code 2 and reports type errors across dozens of files, yet still emits every `.js` and `.d.ts`. The backend compiles and runs despite being type-unsafe — a build that "succeeds" while lying about correctness.

**Fix:** Add `noEmitOnError: true` to `backend/tsconfig.json`. TypeScript's default is to emit output even with errors; this makes a type error a hard build failure.

**Rule:** Every TypeScript project must set `noEmitOnError: true`. A build that produces artifacts despite type errors silently ships type-unsafe code and masks regressions.

<!-- /entry -->

<!-- entry:G-security-2026-06-02-003 -->
---
id: G-security-2026-06-02-003
type: gotcha
domain: security
tags: [error-sanitization, execfileasync, info-leak, api-boundary]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## System-call error messages leak internal paths if returned to API clients — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02)

**Problem:** Raw error messages from `execFileAsync` or other system calls contain internal infrastructure detail (e.g. store paths like `/run/current-system/sw/bin/...`, file paths, command lines). Passing `err.message` straight into an API response leaks that detail to any client and gives an attacker a map of the host.

**Fix:** Establish a sanitization boundary at every system-call catch: log the full error server-side, return a sanitized, user-actionable message to the client. System call → catch → log full error → return safe message. Never let an `execFileAsync` error reach an API response verbatim.

**Rule:** No raw system error text crosses the API boundary. Log server-side at full fidelity; respond with a generic actionable message. This is a hard rule for every catch block that surfaces an error to a client.

<!-- /entry -->

<!-- entry:G-security-2026-06-02-004 -->
---
id: G-security-2026-06-02-004
type: gotcha
domain: security
tags: [codeql, code-scanning, false-positive, path-dedup, sync, ci]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-security-2026-06-02-006]
graduated_to: ""
---

## Free-repo CodeQL double-reports every finding once with a `code/` prefix — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-25)

**Problem:** The public Free repo's CodeQL database scans both the root content and a `code/` subdirectory artifact left by the dev-to-free sync. The same file appears at `backend/src/foo.ts` and `code/backend/src/foo.ts`, generating two separate alert entries — inflating counts and making raw alert lists misleading. Separately, CodeQL's `js/syntax-error` fires on `as unknown as { ... }` double-casts that are valid TypeScript 5.x but outside CodeQL's parser support.

**Fix:** Normalize by stripping the `code/` prefix and deduplicate on `{rule, normalizedPath, startLine}` before classifying. For the TS-cast false positive, dismiss via `scripts/baselines/code-scanning-dismiss.json` with a reason — never reword valid source to dodge the parser.

**Rule:** When triaging CodeQL alerts from a synced public mirror, always strip the `code/` prefix before deduplicating. Confirmed false positives go in `code-scanning-dismiss.json` (with reason); accepted *real* risks go in `business/legal/SECURITY-AUDIT.md` — the dismiss list is false-positives only.

<!-- /entry -->

<!-- entry:G-security-2026-06-02-005 -->
---
id: G-security-2026-06-02-005
type: gotcha
domain: security
tags: [toctou, race-condition, filesystem, enoent, codeql, file-system-race]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## TOCTOU: prefer readFile + ENOENT-catch over existsSync + readFile — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-06-02)

**Problem:** `if (existsSync(path)) { return readFileSync(path) }` is a classic check-then-use race. Between `existsSync()` returning true and `readFileSync()` opening the file, another process can delete, replace, or swap-symlink it. CodeQL's `js/file-system-race` rule flags this exact pattern (caught on `backend/src/services/compliance-pdf.ts` cache-hit path).

**Fix:** Attempt the read and catch ENOENT — atomic at the kernel level:
```typescript
// right — atomic read-or-fallthrough
try {
  return await readFile(cachePath)
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
}
// regenerate...
```

**Rule:** Any "check file exists, then use file" sequence is a TOCTOU. The correct pattern is "attempt the use, handle the absence as an error." This applies to reads (ENOENT), locks (EEXIST on O_CREAT|O_EXCL), directory operations, and permission checks. Replace the check+use composition with a try+errno-filter composition wherever the intermediate state between check and use could matter.

<!-- /entry -->

<!-- entry:G-security-2026-06-02-006 -->
---
id: G-security-2026-06-02-006
type: gotcha
domain: security
tags: [helmet, csp, upgrade-insecure-requests, reverse-proxy, http, serviceworker]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ".claude/rules/security.md"
---

## Helmet CSP adds upgrade-insecure-requests by default — breaks an HTTP backend behind a proxy — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-06-02)

**Problem:** Accessing the dashboard via `http://localhost:3100` shows ServiceWorker errors. `@fastify/helmet` adds `upgrade-insecure-requests` to the CSP by default, telling browsers to upgrade every HTTP request to HTTPS — but the backend serves over plain HTTP (TLS terminates at the reverse proxy).

**Fix:** Set `upgradeInsecureRequests: null` in the helmet config. HTTPS termination belongs at the reverse proxy, not in the app-level CSP.

**Rule:** When using Helmet/CSP with an HTTP backend behind a reverse proxy, disable `upgrade-insecure-requests` at the app level (`upgradeInsecureRequests: null`) — set it at the proxy if needed. Leaving the default on produces ServiceWorker / mixed-content failures that look like app bugs.

<!-- /entry -->

<!-- entry:G-security-2026-06-05-001 -->
---
id: G-security-2026-06-05-001
type: gotcha
domain: security
tags: [sops, sops-nix, age, keys, fleet-secrets]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## sops-nix: the admin/management key is root-owned in /var/lib/sops-nix, NOT in the user's keys.txt — 2026-06-05 · Claude

**Problem:** A long detour concluded the fleet "admin master key" was missing from the management host, because `~/.config/sops/age/keys.txt` (the user's interactive key) couldn't decrypt any `[admin, *]` secret. Three distinct age keys were conflated:
- **workstation editing key** (`age180y…`, in `~/.config/sops/age/keys.txt`) — only a recipient of secrets it's explicitly listed on;
- **host key** (`age12gxqr…`, `ssh-to-age` of `/etc/ssh/ssh_host_ed25519_key`) — auto-decrypts that host's own secrets at activation;
- **admin master key** (`age15qx3awx…`, **`/var/lib/sops-nix/admin-master-key.txt`, root-owned**) — recipient on every `[admin,*]` secret.
Naming made it worse: the workstation key and the host key were *both* labeled `&king` in different registries.

**Fix:** To decrypt/edit an `[admin,*]` secret as a human, point sops at the root-owned master key — don't expect it in the user keychain:
```
sudo env SOPS_AGE_KEY_FILE=/var/lib/sops-nix/admin-master-key.txt sops <secret.yaml>
```
Derive any age file's identity with `age-keygen -y <file>` before assuming which key it is.

**Rule:** Before declaring a sops key "missing," check the root-owned `/var/lib/sops-nix/` location, not just `~/.config/sops/age/keys.txt`. Never reuse one anchor name (`&king`) for two different keys — name them by role (`&mark` editing, `&<host>` host, `&admin` master). A master key belongs root-owned, not in a user keychain.

<!-- /entry -->

<!-- entry:G-security-2026-06-07-001 -->
---
id: G-security-2026-06-07-001
type: gotcha
domain: security
tags: [testing, mirror, cache, fail-closed]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-security-2026-06-07-001]
graduated_to: ""
---

## Testing a cache/proxy seal pollutes the cache and gives false readings — 2026-06-07 · Claude

**Problem:** Verifying "fail-closed" by requesting real package names while the proxy still had egress up made the proxy **fetch and cache** those names. Later requests then served them (200) → a false "still leaking" reading **and** permanent cache pollution (non-allowlisted packages now resident).
**Fix:** Test the seal only **after** egress is actually cut, and only with **fresh, never-requested** names (and fresh *versions* of already-warmed packages). If you polluted during testing, wipe the volume and re-warm from the allowlist.
**Rule:** A fail-closed/seal test must not mutate the thing it tests. Use throwaway probe names, post-cut.

<!-- /entry -->

<!-- entry:G-security-2026-06-08-001 -->
---
id: G-security-2026-06-08-001
type: gotcha
domain: security
tags: [secrets, build-artifacts, dist, mcp, false-positive]
since_version: "1.0"
status: active
scope: transferable
related: [L-engram-2026-06-05-001]
graduated_to: ""
---

## A hardcoded-cred match in `dist/` can be a stale-build false positive — verify the source + the launch path — 2026-06-08 · Claude

**Problem:** A grep of `codebase-mcp/dist/tools/cognee-memory.js` showed `process.env.COGNEE_PASSWORD ?? 'weaver-dev-2026'` — read as a live hardcoded credential and nearly "fixed." But the **source** (`src/tools/cognee-memory.ts` → `src/utils/engram-config.ts`) already reads the cred via `readSecretFile('ENGRAM_COGNEE_PASSWORD_FILE', …, '/run/secrets/engram-cognee-password')` — the fleet sops pattern, **no hardcoded default**. The `dist/` was a **stale, gitignored, untracked build artifact** from before the engram-config refactor (older `COGNEE_*` env scheme), and `.mcp.json` launches `tsx codebase-mcp/src/index.ts` — the **source**, never `dist/`. The literal was also a *dead* cred (already rotated). Net: a false positive on three counts — stale, not-run, not-committed.

**Fix:** Nothing in the source. Rebuild (`npm run build` → tsc) regenerated a clean `dist/` (or just `rm -rf dist/`, since it's gitignored and unused).

**Rule:** When a secret-scan hits a **built/`dist/` artifact**, before concluding a leak: (1) check the **source** — is the literal still there? (2) check the **launch path** (`tsx src/` vs `node dist/`) — is the artifact even run? (3) check if it's **committed** (`git ls-files`) vs gitignored cruft. Stale build output retains old literals after a source sweep; `dist/` is not the source of truth. Don't patch clean source for a stale-artifact match.

<!-- /entry -->

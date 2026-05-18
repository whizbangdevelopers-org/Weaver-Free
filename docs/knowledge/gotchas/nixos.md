<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — nixos

Known gotchas in the **nixos** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-nixos-2026-05-12-001 -->
---
id: G-nixos-2026-05-12-001
type: gotcha
domain: nixos
tags: [postgresql, pgvector, extensions, poststart]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## pgvector CREATE EXTENSION requires superuser — postStart hook — 2026-05-12 · Claude

**Problem:** nixpkgs pgvector 0.8.2 ships without `trusted = true` in `vector.control`, despite upstream pgvector 0.7+ adding trusted extension support. A database owner (`ensureDBOwnership = true`) cannot run `CREATE EXTENSION vector` — only a PostgreSQL superuser can. The Cognee service startup fails with `DatatypeError: data type "vector" does not exist`.

**Fix:** Add a `postStart` hook that runs `CREATE EXTENSION IF NOT EXISTS vector` as the postgres superuser (who IS a superuser by default in NixOS). The `lib.mkAfter` ensures it runs after `ensureDatabases` and `ensureUsers`:

```nix
systemd.services.postgresql.postStart = lib.mkAfter ''
  ${config.services.postgresql.package}/bin/psql -d cognee -c 'CREATE EXTENSION IF NOT EXISTS vector;'
'';
```

The `IF NOT EXISTS` makes this idempotent on every PostgreSQL restart.

**Rule:** Any PostgreSQL extension that lacks `trusted = true` in its `.control` file requires a superuser to install it. Use a `postStart` hook — not `ensureExtensions` or application-side DDL — because only the hook runs as the postgres superuser.

<!-- /entry -->

<!-- entry:G-nixos-2026-05-12-002 -->
---
id: G-nixos-2026-05-12-002
type: gotcha
domain: nixos
tags: [postgresql, pgvector, trust-auth, cognee]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-05-12-001]
graduated_to: ""
---

## Trust auth ignores passwords but Cognee validates credentials before connecting — 2026-05-12 · Claude

**Problem:** Setting `host cognee cognee 127.0.0.1/32 trust` in `pg_hba.conf` means PostgreSQL ignores any password the client sends. But Cognee's internal credential validator runs BEFORE making the connection and rejects an empty-string `VECTOR_DB_PASSWORD` with `OSError: Missing required pgvector credentials!`. The service crashes before a single TCP packet reaches PostgreSQL.

**Fix:** Set a dummy non-empty password in the Cognee env vars (e.g., `VECTOR_DB_PASSWORD = "cognee-local"`). PostgreSQL silently ignores it under trust auth; Cognee's validator sees a non-empty string and proceeds.

**Rule:** When using trust auth in NixOS for a loopback-only service connection, the application's own credential validator may still require a non-empty password string. Always set a dummy placeholder password even when the database ignores it.

<!-- /entry -->

<!-- entry:G-nixos-2026-05-15-001 -->
---
id: G-nixos-2026-05-15-001
type: gotcha
domain: nixos
tags: [nix-store, read-only, sqlite, data-dir, buildNpmPackage, engram]
since_version: "1.0.5"
status: active
scope: project
related: [G-backend-2026-05-15-002, L-backend-2026-05-15-001]
graduated_to: ""
---

## `buildNpmPackage` bakes `data/` into the read-only Nix store — any write-mode DB open fails silently — 2026-05-15 · Claude

**Problem:** The `buildNpmPackage` derivation copies the entire source tree (all git-tracked files) into the Nix store, including `code/data/`. A backend route that opens a SQLite DB using `import.meta.dirname`-relative paths resolves to the Nix store path in production. The old lazy opener (`existsSync → open`) *appeared* to work: it found the baked-in `engram.db` snapshot, opened it, and returned data. But any write failed silently (EROFS). The new eager opener (`initEngramDb`) exposed this: `PRAGMA journal_mode = WAL` immediately fails on a read-only SQLite file, crashing plugin registration.

**Fix:** Use an environment variable (`VM_DATA_DIR=/var/lib/weaver`) for mutable service state in production. In `index.ts`:

```ts
const engramDataDir = process.env.VM_DATA_DIR ?? join(import.meta.dirname, '..', '..', 'data')
await fastify.register(engramRoutes, { prefix: '/api/engram', dataDir: engramDataDir })
```

In production the service creates and owns `/var/lib/weaver/engram.db` (inaccessible to non-service users — that's correct NixOS service isolation). In dev where `VM_DATA_DIR` is unset, the fallback keeps `code/data/engram.db` as before.

**Rule:** Never derive mutable DB paths from `import.meta.dirname` in a NixOS service. The file is in the Nix store; the Nix store is read-only. Any service that writes to its own data store must use a `StateDirectory` / `$STATE_DIRECTORY` or an explicit `Environment=` path that resolves to a mutable location outside the store. The read-only source snapshot is only correct as a dev fallback or seed; production always needs a dedicated mutable dir.

<!-- /entry -->

<!-- entry:G-nixos-2026-05-16-001 -->
---
id: G-nixos-2026-05-16-001
type: gotcha
domain: nixos
tags: [nixos-rebuild, systemd, concurrent, rebuild-script]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Concurrent `nixos-rebuild switch` fails — "unit already loaded" — 2026-05-16 · Claude

**Problem:** Running `sudo nixos-rebuild switch` while a previous rebuild is still activating (the `nixos-rebuild-switch-to-configuration.service` transient unit) causes the second invocation to fail immediately with `Failed to start transient service unit: Unit nixos-rebuild-switch-to-configuration.service was already loaded`. The first rebuild continues and may succeed, but the second one exits non-zero with no useful diagnostic about what actually happened.

**Fix:** Wait for the first rebuild to complete before starting another. The `nix-rebuild-local.sh` script runs in the foreground — if you see it hanging on the nixos-rebuild step, it is not stuck: it is still activating services. Let it finish. If the script was run in background, check `journalctl -u nixos-rebuild-switch-to-configuration.service` or poll `readlink /run/current-system` to see when the switch completes.

**Rule:** Never run two `nixos-rebuild switch` invocations concurrently. The transient unit is a singleton. If the first rebuild appears to stall, it is almost certainly still activating — check journalctl before concluding it is stuck or re-running.

<!-- /entry -->

<!-- entry:G-nixos-2026-05-18-001 -->
---
id: G-nixos-2026-05-18-001
type: gotcha
domain: nixos
tags: [nginx, proxy, ports, engram-ui]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## nginx proxy pointing at dev port instead of NixOS service port causes 502 — 2026-05-18 · Claude

**Problem:** The engram-ui nginx config at `/etc/nixos/modules/services/engram-ui.nix` had a `# DEV: port 3110 … Switch to 3100 when Engram goes production` comment paired with `proxyPass = "http://127.0.0.1:3110/"`. The dev backend (3110) is never running on king — only the NixOS `weaver.service` (3100) is. Result: every request to `/weaver/` returned 502 Bad Gateway.

**Fix:** Change `proxyPass` to `http://127.0.0.1:3100/` and remove the deferred-TODO comment. The NixOS service port is always 3100 on king regardless of Engram's development status.

**Rule:** Never leave "switch this when X goes production" port comments in NixOS nginx configs. The NixOS service is the production target by definition — use its port from day one and document the dev/prod port difference in comments rather than deferring the change.

<!-- /entry -->

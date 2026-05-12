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

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Gotchas — python

Gotchas discovered in the **python** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

Python entries cover the Python language and ecosystem — asyncio patterns, packaging,
type hints, toolchain gotchas. Most entries are `scope: transferable`. Use `scope: transient`
only for workarounds specific to a prototype that won't survive a rewrite.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:G-python-2026-05-12-001 -->
---
id: G-python-2026-05-12-001
type: gotcha
domain: python
tags: [uv, lock-file, extras, resolution-groups]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## uv.lock resolution groups don't update when you add extras to pyproject.toml — 2026-05-12 · Claude

**Problem:** `uv.lock` records per-extra dependency closures at lock time. If you add a new package to an existing extra in `pyproject.toml` (e.g., changing `api = ["cognee[api]==1.0.3"]` to `api = ["cognee[api,postgres]==1.0.3"]`), the `api` resolution group in `uv.lock` is NOT updated automatically. The next `uv sync --extra api` still installs the old closure — the new packages (asyncpg, pgvector, psycopg2) are absent at runtime, and the service fails with `ImportError`.

**Fix:** Run `uv lock` explicitly after editing `pyproject.toml`. This regenerates the lock file with updated resolution groups that include the new extras' transitive dependencies. Then commit both `pyproject.toml` and `uv.lock` together.

**Rule:** Any change to extra content in `pyproject.toml` requires an explicit `uv lock` run before rebuilding. The lock file is not a snapshot of installed state — it is a snapshot of the resolved plan, and that plan must be re-solved when extras change.

<!-- /entry -->

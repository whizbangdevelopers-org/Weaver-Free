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

<!-- entry:G-python-2026-06-02-001 -->
---
id: G-python-2026-06-02-001
type: gotcha
domain: python
tags: [asyncio, gather, concurrency, batching, memory, coroutines]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Unbatched asyncio.gather over a full work set explodes memory — cap concurrency — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Problem:** A single `asyncio.gather(*[coro(x) for x in items])` over an entire work set fans out one concurrent coroutine per item, with no upper bound. Each coroutine holds its full working state in memory simultaneously. For a real corpus this is thousands of concurrent coroutines — RSS grows unbounded (observed 11 GB → 19+ GB in 5 minutes), the event loop is blocked for tens of minutes, and any awaited HTTP endpoint goes unresponsive:

```python
# Anti-pattern: every item becomes a live coroutine at once
results = await asyncio.gather(*[process(x) for x in all_items])
```

`asyncio.gather` is not a concurrency cap. It schedules everything passed to it immediately; the count of in-flight coroutines equals `len(items)`. The default "no batching" path is only safe for trivially small inputs.

**Fix:** Bound concurrency. Either chunk the work set and gather one batch at a time, or guard each coroutine with an `asyncio.Semaphore`:

```python
sem = asyncio.Semaphore(10)
async def bounded(x):
    async with sem:
        return await process(x)
results = await asyncio.gather(*[bounded(x) for x in all_items])
```

**Rule:** Never `asyncio.gather` over an unbounded input set. Always cap concurrency — a batch size or a semaphore — sized to the per-coroutine memory cost. Start small (e.g. 10) and reduce if RSS growth is still a problem. The fan-out count, not the total item count, is what determines peak memory and event-loop responsiveness.

<!-- /entry -->

<!-- entry:G-python-2026-06-07-001 -->
---
id: G-python-2026-06-07-001
type: gotcha
domain: python
tags: [uvx, uv, wheels, native-build, guarddog, yara]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## `uvx`/pip tool fails its C build on a too-new Python — pin to a wheel'd minor — 2026-06-07 · Claude

**Problem:** `uvx guarddog` failed building `yara-python` (`error: command 'cc' failed: No such file or directory`). uv's default interpreter was CPython 3.14, which has no prebuilt `yara-python` wheel → uv built from source → needs a C toolchain (absent in the ephemeral env).
**Fix:** `uvx --python 3.12 guarddog …` — 3.12 has a prebuilt wheel, so no compiler is needed.
**Rule:** When a `uvx`/pip tool fails on a native dep's C build, pin to a Python minor that has prebuilt wheels (`--python 3.12`) before reaching for `gcc`/`nix-shell`. The newest CPython often lacks wheels for native packages.

<!-- /entry -->

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — python

Lessons learned in the **python** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

Python entries cover the Python language and ecosystem — asyncio patterns, packaging,
type hints, toolchain gotchas. Most entries are `scope: transferable`. Use `scope: transient`
only for workarounds specific to a prototype that won't survive a rewrite.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-python-2026-06-02-001 -->
---
id: L-python-2026-06-02-001
type: lesson
domain: python
tags: [subprocess, popen, streaming, stdout, sentinel, ipc]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## subprocess.Popen line streaming for real-time output with sentinel interception — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-07)

When a parent process needs both real-time visibility into a child's output AND the ability to intercept specific sentinel messages, neither `subprocess.run(capture_output=False)` nor `subprocess.run(capture_output=True)` works.

**Root cause:** `capture_output=False` pipes child stdout directly to the terminal — the parent has no file handle and can never read it. `capture_output=True` makes output readable but buffers all of it until the process exits — during a 10-minute pipeline run, every progress line is invisible until the end.

**Rule:** When you need streaming output AND sentinel interception, use `subprocess.Popen` with `stdout=subprocess.PIPE`, iterate over `proc.stdout` line by line, intercept sentinel lines, print the rest:

```python
proc = subprocess.Popen(cmd, text=True, stdout=subprocess.PIPE)
restart_needed = False
for line in proc.stdout:
    stripped = line.rstrip("\n")
    if stripped == "COGNEE_RESTART_REQUIRED":
        restart_needed = True
    else:
        print(stripped)
proc.wait()
if restart_needed:
    trigger_restart()
```

**Why:** The sentinel is a contract between child and parent — the child prints it to stdout, the parent intercepts it without exposing it to the terminal. Progress logs flow through in real time. Any side effect (restart a service, write a file, call an API) is triggered after `proc.wait()`, so there are no timing races. The pattern generalizes to any parent/child pipeline where the child emits both human-readable progress and machine-readable signals on the same stream.

<!-- /entry -->

<!-- entry:L-python-2026-06-02-002 -->
---
id: L-python-2026-06-02-002
type: lesson
domain: python
tags: [packaging, nix, wheel, vendored-dependency, postinstall, patch]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Patch vendored Python packages via Nix postInstall substituteInPlace, not a fork — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

When a vendored Python dependency has a hardcoded constant that must change for your deployment (e.g. an `asyncio.wait_for(timeout=30.0)` that is too short for a slow CPU path), forking the package is heavyweight and drifts out of sync with upstream.

**Root cause:** The bad constant lives inside the installed wheel under `site-packages`. You do not control the source, and the value is not exposed as a config knob. Forking means tracking every upstream release manually.

**Rule:** Patch the installed wheel at build time with a `postInstall` override using `substituteInPlace ... --replace-fail`. This edits the vendored file in place without forking and fails loud if the target string ever disappears (so upstream changes can't silently no-op the patch):

```nix
substituteInPlace $out/lib/python3.12/site-packages/<pkg>/path/to/file.py \
  --replace-fail 'timeout=30.0' 'timeout=120.0'
```

**Why:** `--replace-fail` (not `--replace`) is load-bearing — if upstream renames or removes the line, the build breaks instead of silently shipping an unpatched wheel. The patch lives in your flake, is reviewable in one place, and survives upstream version bumps as long as the target string is stable. This is the correct pattern for any single-constant fix in a vendored Python package you don't own.

<!-- /entry -->

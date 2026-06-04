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

<!-- entry:G-nixos-2026-05-18-002 -->
---
id: G-nixos-2026-05-18-002
type: gotcha
domain: nixos
tags: [nixpkgs, insecure-packages, ventoy, rebuild]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## nixpkgs marks packages insecure mid-channel, blocking nixos-rebuild — 2026-05-18 · Claude

**Problem:** `nixos-rebuild switch` fails with `Package 'ventoy-1.1.10' is marked as insecure, refusing to evaluate` after a nixpkgs update marks the package insecure (binary-blob audit). The build evaluation aborts entirely — no partial build, no warning. The error traces through `environment.etc.dbus-1.source` before naming the actual package, making it look like a dbus problem at first.

**Fix:** Add the package to `nixpkgs.config.permittedInsecurePackages` in the host `configuration.nix`:
```nix
nixpkgs.config.permittedInsecurePackages = [
  "ventoy-1.1.10"
];
```
Commit to the nixos git repo, then re-run `nix-rebuild-local.sh`. The rebuild proceeds past the package.

**Rule:** When a NixOS rebuild fails with a "marked as insecure" error, add the package to `permittedInsecurePackages` if removal is not feasible (e.g., the package has a legitimate offline use case). The fix goes in the host nixos config repo — never in the Weaver project repo.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-01-001 -->
---
id: G-nixos-2026-06-01-001
type: gotcha
domain: nixos
tags: [networking, nat, networkd, useNetworkd]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## networking.nat does not work with networking.useNetworkd — 2026-06-01 · Claude

**Problem:** Setting `networking.nat.enable = true` alongside `networking.useNetworkd = true` silently produces a non-functional system. The `nixos-nat.service` unit that `networking.nat` is supposed to create never appears — no iptables MASQUERADE rules are applied, no error is thrown. The config evaluates and builds cleanly; it just doesn't do NAT.

**Fix:** Drop `networking.nat` entirely when `useNetworkd` is in use. Instead, write a dedicated oneshot systemd service with explicit iptables rules:

```nix
systemd.services.my-nat = {
  description = "NAT masquerade for internal subnet";
  after = [ "network.target" ];
  wantedBy = [ "multi-user.target" ];
  serviceConfig = { Type = "oneshot"; RemainAfterExit = true; };
  script = ''
    IPT=${pkgs.iptables}/bin/iptables
    $IPT -t nat -C POSTROUTING -s 10.0.0.0/24 -o eth0 -j MASQUERADE 2>/dev/null || \
      $IPT -t nat -A POSTROUTING -s 10.0.0.0/24 -o eth0 -j MASQUERADE
    $IPT -C FORWARD -i eth1 -o eth0 -j ACCEPT 2>/dev/null || \
      $IPT -A FORWARD -i eth1 -o eth0 -j ACCEPT
    $IPT -C FORWARD -i eth0 -o eth1 -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || \
      $IPT -A FORWARD -i eth0 -o eth1 -m state --state RELATED,ESTABLISHED -j ACCEPT
  '';
};
boot.kernel.sysctl."net.ipv4.ip_forward" = 1;
```

**Rule:** Never combine `networking.nat` with `networking.useNetworkd`. Use a dedicated iptables oneshot service instead. The `-C` (check before append) pattern prevents duplicate rules on service restart.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-01-002 -->
---
id: G-nixos-2026-06-01-002
type: gotcha
domain: nixos
tags: [networking, networkd, ipmasquerade, nftables, systemd]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-01-001]
graduated_to: ""
---

## systemd-networkd IPMasquerade does not reliably create nftables rules — 2026-06-01 · Claude

**Problem:** Setting `IPMasquerade = "ipv4"` in a `systemd.network.networks` unit compiles into the `.network` file correctly and `networkctl status` shows the option, but on kernel 7.0.x / systemd 258, `nft list ruleset` returns empty — no masquerade table is created. Traffic forwarded through the interface is not NAT'd. No error is logged. The option appears to be a no-op on this kernel/systemd combination.

**Fix:** See G-nixos-2026-06-01-001 — use an explicit iptables oneshot service. Do not rely on `IPMasquerade` until confirmed working on the target kernel.

**Rule:** Treat `IPMasquerade` in networkd units as unreliable until you verify `nft list ruleset` shows a masquerade chain AND confirm a real packet traverses the NAT path with a live test (source-bind curl to the internal NIC, route a specific destination via the gateway, watch the MASQUERADE counter increment).

<!-- /entry -->

<!-- entry:G-nixos-2026-06-01-003 -->
---
id: G-nixos-2026-06-01-003
type: gotcha
domain: nixos
tags: [networking, networkd, ipforward, systemd, breaking-change]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## IPForward removed from systemd-networkd in NixOS 25.11 — use IPv4Forwarding — 2026-06-01 · Claude

**Problem:** `IPForward = "yes"` in a `networkConfig` block causes the entire nixos-rebuild to fail with a confusing error: `A definition for option 'systemd.network.networks."<name>".networkConfig' is not of type 'attribute set of (systemd option)'`. The error points at the whole attr set, not the offending key, making it hard to identify the cause.

The root cause: NixOS 25.11 (systemd 258) uses `assertRemoved "IPForward"` in the networkd module — the option was renamed and the module actively rejects the old name.

**Fix:** Replace `IPForward = "yes"` with `IPv4Forwarding = true` (Nix boolean). Similarly `IPForward = "no"` → `IPv4Forwarding = false`. For IPv6 forwarding, use `IPv6Forwarding`.

**Rule:** On NixOS 25.11+, use `IPv4Forwarding = true` in `networkConfig`. The error message "not of type attribute set of (systemd option)" on the whole attr set is the signature of an `assertRemoved` hit — suspect a renamed key before assuming a type error.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-01-004 -->
---
id: G-nixos-2026-06-01-004
type: gotcha
domain: nixos
tags: [ssh, sudo, bootstrap, root, generations, mental-model, infra-users]
since_version: "1.0.5"
status: active
scope: transferable
related: [L-devops-2026-06-01-002]
graduated_to: ""
---

## Reasoning about NixOS root access as ambient instead of per-generation declarative — 2026-06-01 · Claude

**Problem:** After a rebuild set `PermitRootLogin = "no"` and added `mark` to `wheel` with no password and no NOPASSWD rule, the operator could SSH in but not `sudo` — so the next `nixos-rebuild switch` looked impossible over SSH. The trap was not the config; it was the diagnosis. We treated it as a *lockout* — "what's the root password? how do we rescue root?" — importing the traditional-distro model where root is a standing account with a persistent `/etc/shadow` entry that exists independent of system config. On NixOS that model is wrong:

- Root access is **not ambient**. `PermitRootLogin`, `users.users.root.hashedPassword`, and `mutableUsers` are declared *per generation*. "Root is reachable" is a property of a specific generation's config, not of the machine. We had one early data point (root SSH worked on the bare-install generation) and over-generalized it into "root is just there, like every other OS."
- The recovery path does **not** require root at all. The systemd-boot / GRUB menu lists every prior generation and selection happens *before* login — it is credential-free. The boot menu **is** the undo. There is no true lockout on a NixOS host with console access: you boot the generation whose declared config grants the access you want.

**Fix (the real one — don't create the user at all):** The lockout's true root cause was upstream of ordering: we put a *workstation-identity* login user (`mark`) on a **headless infra node**, then disabled root SSH in the same rebuild. A headless node managed from an admin host has no interactive human — so it needs no human user. Keep **root SSH alive, key-only** (`PermitRootLogin = "prohibit-password"`, `PasswordAuthentication = false`) as the management path from the admin host, and the lockout class disappears: there is no operator account to mis-provision and no NOPASSWD dependency to get wrong. For workloads that must not run as root (agents, builders), add a **purpose-named service user** (`forge`, `builder`) with only the groups it needs (`docker`) and **no sudo** — never a mirror of the workstation identity. See [[L-devops-2026-06-01-002]].

**Fix (only if you genuinely need an operator login user):** Then order it so the operator can self-manage *before* any access is removed — in the same commit, add explicit NOPASSWD sudo rules and an `initialHashedPassword` escape hatch — and prefer keeping root SSH key-only anyway as a second path.

**Fix (recovery, when it already happened):** Don't hunt for a root password. At the console, select the prior generation in the boot menu — it boots the earlier *config*, which is why its access works — then re-apply the corrected config from a peer over SSH. Recovery is generation selection, not root rescue. (Note: `/tmp` is tmpfs — staged config there is wiped by the reboot; re-sync after booting the old generation. And the bare/older generations are *not* "bare metal with an ambient root" — they're earlier declared configs; which users even exist is per-generation.)

**Rule:** On NixOS, never reason about root as an ambient, persistent account — root access *and which users exist* are declared per generation, and the boot menu is an always-available, credential-free path to any prior generation. For headless infra nodes, the cleanest posture is **root-SSH-key-only from the admin host, no human login user, purpose-named unprivileged service users for workloads**. Disabling root SSH plus a half-provisioned login user is the anti-pattern that causes lockout. The instinct to rescue root by mutating the live system is the traditional-OS reflex NixOS is built to make unnecessary.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-01-005 -->
---
id: G-nixos-2026-06-01-005
type: gotcha
domain: nixos
tags: [postgresql, dataDir, systemd, mount-namespace]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## services.postgresql.dataDir must match where data actually lives — 2026-06-01 · Claude

**Problem:** Setting `services.postgresql.dataDir = "/data/postgresql"` when PostgreSQL data is actually at the NixOS default (`/var/lib/postgresql/17`) causes the service to fail with `Failed to set up mount namespacing: /data/postgresql: No such file or directory`. Systemd's namespace setup runs before PostgreSQL tries to open any files, so the error is about the missing directory itself — not a "data not found" message from PostgreSQL. Easy to misdiagnose.

**Fix:** Either remove the `dataDir` override (letting NixOS use the default `/var/lib/postgresql/${version}`) or move the data to the configured path before rebuilding. Never set `dataDir` to a path that doesn't exist yet without also writing a migration/init step.

**Rule:** Before overriding `services.postgresql.dataDir`, confirm the target directory exists and contains the database files (or is empty and PostgreSQL will init it). A missing directory surfaces as a systemd mount-namespace error, not a PostgreSQL error.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-001 -->
---
id: G-nixos-2026-06-02-001
type: gotcha
domain: nixos
tags: [networkd, ip-forward, nat, gateway, sysctl, regression]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-01-001, G-nixos-2026-06-01-002]
graduated_to: ""
---

## systemd-networkd silently resets net.ipv4.ip_forward to 0 — kills NAT mid-run — 2026-06-02 · Claude

**Problem:** A NAT gateway relying on `boot.kernel.sysctl."net.ipv4.ip_forward" = 1` had forwarding flipped back to `0` by systemd-networkd on a reconfigure event — no log line. Downstream hosts silently lost their uplink (and NAS access) while the gateway itself stayed pingable. The masquerade iptables rule was still present with frozen counters, so it read like a firewall/routing bug, not a sysctl reset.

**Fix:** Defend in three layers: (1) `boot.kernel.sysctl` sets both `net.ipv4.ip_forward` and `net.ipv4.conf.all.forwarding` to 1; (2) `systemd.network.config.networkConfig.IPv4Forwarding = true` so networkd itself owns the knob and won't reset it (the durable layer); (3) the NAT oneshot re-asserts `sysctl -w net.ipv4.ip_forward=1` on start, ordered `after = [ "systemd-networkd.service" ]`.

**Rule:** When networkd manages interfaces, never rely on `boot.kernel.sysctl` alone for `ip_forward` — set `IPv4Forwarding=true` in networkd's own config. Symptom signature: gateway reachable, masquerade rule present but counters frozen, forwarded hosts dead → check `/proc/sys/net/ipv4/ip_forward` first.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-002 -->
---
id: G-nixos-2026-06-02-002
type: gotcha
domain: nixos
tags: [llama-cpp, llama-server, cli, flash-attn, service-module]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## llama.cpp b9190+ made --flash-attn require a value [on|off|auto] — 2026-06-02 · Claude

**Problem:** A NixOS llama-server module emitted bare `--flash-attn` (boolean-flag style). On llama.cpp build b9190+, `--flash-attn` now takes a value `[on|off|auto]`, so it consumed the *next* arg (`--mlock`) as its value and aborted: `error: unknown value for --flash-attn: '--mlock'`. Confusing — the error blames the next flag, not flash-attn.

**Fix:** Emit `[ "--flash-attn" "on" ]` instead of a bare flag.

**Rule:** llama.cpp CLI flags drift across builds — boolean flags become valued options. When a llama-server arg error blames *one* flag's value using the *next* flag's name, the upstream flag changed from boolean to valued. Pin/track the llama.cpp build and emit explicit values.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-003 -->
---
id: G-nixos-2026-06-02-003
type: gotcha
domain: nixos
tags: [etc-hosts, networking-hosts, rebuild, dns]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## /etc/hosts is regenerated on every nixos-rebuild — manual entries vanish — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** Adding a hostname to `/etc/hosts` manually (or via a script that appends with `echo "127.0.0.1 name" >> /etc/hosts`) works until the next `nixos-rebuild switch`, which regenerates `/etc/hosts` from `networking.hosts` and wipes the manual entry.

**Fix:** Declare all local DNS entries in `networking.hosts` in the NixOS configuration:
```nix
networking.hosts."127.0.0.1" = [ "weaver-mcp.local" "myservice.local" ];
```
This merges cleanly with existing entries and survives rebuilds.

**Rule:** Never write instructions or scripts that mutate `/etc/hosts` directly on a NixOS host — they silently break after the next rebuild. Always use `networking.hosts`.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-004 -->
---
id: G-nixos-2026-06-02-004
type: gotcha
domain: nixos
tags: [buildnpmpackage, fetchnpmdeps, lockfile, monorepo, npmroot]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## buildNpmPackage only fetches root lockfile deps — subdirectory node_modules missing — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** `buildNpmPackage` only fetches deps from the root `package-lock.json`. A backend (or any subdirectory) `node_modules` won't exist, so its build step fails. The `fetchNpmDeps` `npmRoot` parameter is silently ignored, so the obvious fix appears not to work.

**Fix:** Use a separate `fetchNpmDeps` derivation per lockfile, pointing `src` directly at the subdirectory (not `npmRoot`), and install it in `buildPhase`:
```nix
backendNpmDeps = pkgs.fetchNpmDeps {
  name = "backend-npm-deps";
  src = ./../backend;  # point src at the subdirectory; npmRoot is ignored
  hash = "sha256-...";
};
```

**Rule:** For multi-lockfile builds, create one `fetchNpmDeps` per `package-lock.json` and point each at its subdirectory via `src`. Never rely on `npmRoot`.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-005 -->
---
id: G-nixos-2026-06-02-005
type: gotcha
domain: nixos
tags: [patchshebangs, buildnpmpackage, node-modules, npm-ci]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-02-004]
graduated_to: ""
---

## patchShebangs only runs on root node_modules — manual npm ci subdirs break — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** `buildNpmPackage` patches the root `node_modules` during `configurePhase`, but a manual `npm ci` for a subdirectory does NOT get patched. Binaries then fail at build or runtime with `bad interpreter: /usr/bin/env`.

**Fix:** Run `patchShebangs node_modules` explicitly after any manual `npm ci` in `buildPhase`.

**Rule:** Every manual `npm ci` outside the root in a Nix build must be followed by `patchShebangs node_modules` for that directory — only the root tree is auto-patched.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-006 -->
---
id: G-nixos-2026-06-02-006
type: gotcha
domain: nixos
tags: [native-binary, elf, nix-sandbox, sass-embedded, pure-js]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Pre-built native ELF binaries in npm packages fail on NixOS (ENOENT on ld-linux) — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** npm packages shipping pre-built ELF binaries reference `/lib64/ld-linux-x86-64.so.2`, which doesn't exist on NixOS. They fail with ENOENT inside the Nix build sandbox (and at runtime).

**Fix:** Remove the native package and fall back to a pure-JS alternative. Many packages offer both: `sass-embedded` → `sass`, `esbuild` → JS fallback.

**Rule:** When a native-binary npm dependency fails in the Nix sandbox with a missing `ld-linux` interpreter, switch to its pure-JS sibling rather than trying to patch the binary. (Note: this only applies to binaries executed at *build* time — see L-nixos-2026-05-13-001 for kuzu, whose native addon is runtime-only and safe to keep.)

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-007 -->
---
id: G-nixos-2026-06-02-007
type: gotcha
domain: nixos
tags: [prefetch-npm-deps, lockfile, cross-platform, sass]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-02-006]
graduated_to: ""
---

## prefetch-npm-deps fetches all platforms — incomplete lockfile fails npm ci — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** `npm ci` in the Nix build fails with "Missing: sass@ from lock file". `prefetch-npm-deps` fetches ALL platform variants, and cross-platform fallback packages declare dependencies that aren't in a lockfile generated on a single platform.

**Fix:** Add the fallback explicitly so the lockfile is complete for all platforms: `npm install -D sass`.

**Rule:** When `prefetch-npm-deps` + `npm ci` reports a missing package that exists only as a cross-platform fallback, add that package as an explicit dependency so the committed lockfile covers every platform the prefetch enumerates.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-008 -->
---
id: G-nixos-2026-06-02-008
type: gotcha
domain: nixos
tags: [launcher, shebang, bash, systemd, store-path]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Launcher scripts in $out/bin need a full store-path shebang, not /usr/bin/env — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** `#!/usr/bin/env bash` in a `$out/bin/` script fails in systemd services and the Nix build sandbox — NixOS has no `bash` (or `/usr/bin/env`) on the minimal PATH.

**Fix:** Use Nix store paths in the shebang and for every binary: `#!${pkgs.bash}/bin/bash`, `${pkgs.nodejs}/bin/node`. (In `callPackage`-style derivations, `bash` must be declared as a function parameter to reference its store path — see the launcher derivation that consumes it.)

**Rule:** Any script that runs from `$out/bin/` or a systemd unit must use full Nix store paths for the interpreter and all binaries. `#!/usr/bin/env` is only acceptable for dev-only scripts that never enter the sandbox or systemd.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-009 -->
---
id: G-nixos-2026-06-02-009
type: gotcha
domain: nixos
tags: [flake, path-input, git-tracking, flake-update, pure-eval]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## flake path: inputs only see git-tracked content — unstaged changes are invisible — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** `nix flake update` (and pure evaluation generally) reads only git-tracked content for `path:` inputs. Unstaged or untracked changes are invisible, so a rebuild silently uses the last-committed version of a local module.

**Fix:** Always `git add` the changed files before `nix flake update` / rebuild. The `scripts/nix-rebuild-local.sh` helper automates the add-then-update sequence.

**Rule:** For local modules referenced via `path:` flake inputs, stage changes (`git add`) before any `nix flake update` or rebuild. If a config edit "isn't taking effect," check `git status` first.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-010 -->
---
id: G-nixos-2026-06-02-010
type: gotcha
domain: nixos
tags: [npm-deps-hash, prefetch-npm-deps, package-nix, flake-lock]
since_version: "1.0.5"
status: active
scope: project
related: [G-nixos-2026-06-02-004]
graduated_to: ""
---

## Two npm hashes in package.nix must be refreshed after any dep change — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** `nixos/package.nix` maintains npm dependency hashes that go stale after any `npm install` / `npm update`. A stale hash causes the Nix build to fail at fetch time with a hash mismatch.

**Fix:** After changing dependencies, recompute the hash — either run `prefetch-npm-deps` to compute the correct value, or set a wrong/empty hash, let the build fail, and copy the correct hash from the error message. Then update the flake lock.

**Rule:** Treat `npmDepsHash` as a generated artifact: regenerate it on every dependency change and update the flake lock in the same commit. Never hand-edit it to a guessed value.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-011 -->
---
id: G-nixos-2026-06-02-011
type: gotcha
domain: nixos
tags: [nixpkgs-channel, version-drift, audit, parity, ai-drift]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## nixpkgs channel version drifts across 16+ files; only cross-file comparison reveals it — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** The nixpkgs channel version (e.g. `nixos-25.11`) is referenced in 16+ files: `flake.nix`, `flake.lock`, distro catalog, URL validation cache, mock data (3 locations), test fixtures (3 locations), docs (3 locations), research docs (2 locations), and legal docs. Each file is internally consistent, so tests pass — only cross-file comparison reveals drift. AI assistants amplify this by defaulting to their training-data version and writing it confidently everywhere.

**Fix:** The `audit:nixos-version` auditor reads the canonical version from `flake.nix` (`nixpkgs.url` → `nixos-XX.YY`) and verifies all check locations match. Source of truth is `flake.nix` and nothing else.

**Rule:** After a nixpkgs channel bump, change `flake.nix` first, run `nix flake update`, then run `npm run audit:nixos-version` — it reports every stale reference. (See the lessons-domain entry on AI training-cutoff version drift for the generalized auditor principle.)

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-012 -->
---
id: G-nixos-2026-06-02-012
type: gotcha
domain: nixos
tags: [hardware-configuration, mkdefault, microcode, cpu, conditional-default]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## lib.mkDefault in generated hardware-configuration.nix makes microcode look set but stay off — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** `nixos-generate-config` emits `hardware.cpu.intel.updateMicrocode = lib.mkDefault config.hardware.enableRedistributableFirmware;`. This looks configured, but evaluates to `false` unless `hardware.enableRedistributableFirmware` is explicitly enabled elsewhere. The file also warns "Do not modify this file!", so the gap is invisible unless you inspect the effective evaluated value.

**Fix:** Add an explicit override in the host-specific module (`modules/hosts/<hostname>.nix`):
```nix
hardware.cpu.intel.updateMicrocode = true;  # Intel
# or
hardware.cpu.amd.updateMicrocode = true;    # AMD — a separate, distinct option
```
Intel and AMD are different options, not the same option with different syntax.

**Rule:** Never assume `lib.mkDefault` entries in `hardware-configuration.nix` are active — they are conditional defaults that silently evaluate to `false` when their dependency is unset. Override explicitly in the host module for any capability that matters.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-013 -->
---
id: G-nixos-2026-06-02-013
type: gotcha
domain: nixos
tags: [nur, callpackage, bash, launcher, shebang, derivation-params]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-02-008]
graduated_to: ""
---

## callPackage-style derivations must declare bash as a parameter for launcher shebangs — 2026-06-02 · Claude (migrated from legacy archive)

**Problem:** `{ pkgs }:`-style derivations (like `nixos/package.nix`) can reference `pkgs.bash` anywhere. But `callPackage`-style derivations (`{ lib, buildNpmPackage, ..., bash }:`) auto-fill arguments by name. If `bash` is omitted from the parameter list there is no way to reference its store path, so a launcher shebang falls back to `#!/usr/bin/env bash` — which fails in the Nix sandbox and in systemd services.

**Fix:** Declare `bash` explicitly in the function parameters of any `callPackage`-style derivation that writes a launcher script, then use `#!${bash}/bin/bash` in `installPhase`.

**Rule:** Any `callPackage`-style derivation that writes a shell launcher must list `bash` as a function parameter. This is the `callPackage` counterpart to the store-path-shebang rule for `{ pkgs }:` derivations.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-02-014 -->
---
id: G-nixos-2026-06-02-014
type: gotcha
domain: nixos
tags: [weasyprint, pango, gdk-pixbuf, systemd-path, native-libs, pdf]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## WeasyPrint needs the package on the systemd service PATH for its Pango/GDK-Pixbuf chain — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-06-02)

**Problem:** WeasyPrint depends on Pango, GDK-Pixbuf, and other native libraries. On NixOS these are not in the default PATH — the systemd service runs with a minimal environment, so WeasyPrint's transitive native chain isn't resolvable at runtime even though the binary itself is found.

**Fix:** Add `python3Packages.weasyprint` to the service's `path` list in `default.nix` (not only `WEASYPRINT_BIN`). The PATH entry pulls in the transitive dependencies (fontconfig, Pango, etc.) at runtime.

**Rule:** NixOS packages with native library chains need both the env var (for the binary path) AND the `path` list entry (for transitive deps). Setting only the env var gives you the binary but not its runtime dependency closure.

<!-- /entry -->

<!-- entry:G-nixos-2026-06-04-001 -->
---
id: G-nixos-2026-06-04-001
type: gotcha
domain: nixos
tags: [microvm, systemd, qemu, run-state, process-detection]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## microvm.nix run-state is the `microvm@<name>.service` unit, not a `qemu-system` process match — 2026-06-04 · Claude

**Problem:** Detecting whether a `microvm.nix` MicroVM is running by grepping the process table for `qemu-system|cloud-hypervisor|firecracker|crosvm` reports every VM as **stopped** even when they're up. On a microvm.nix host the running guests had `-name <vm>` in their args but the launcher binary was **not** literally named `qemu-system-*`, so the hypervisor-binary regex missed them entirely. (Contrast: Weaver launches bare `qemu-system-x86_64 -name <vm>`, which *does* match — so a process-only detector silently works on Weaver hosts and silently fails on microvm.nix hosts.)

**Fix:** Use the canonical signal — the systemd template unit: `systemctl is-active microvm@<name>` (microvm.nix registers one `microvm@<name>.service` per declared VM). For a launcher-agnostic process fallback, match the `-name <name>` flag broadly rather than requiring a specific hypervisor binary name. Declared inventory is the set of subdirs under `MICROVMS_DIR` (default `/var/lib/microvms`, world-readable 755).

**Rule:** On NixOS, treat `microvm@<name>.service` as the authoritative MicroVM run-state. Process-name matching on the hypervisor binary is non-portable across launchers (microvm.nix vs Weaver vs raw libvirt) and will produce false "stopped" readings. (Note: per [[L-analysis-2026-06-04-003]] the *Observer* deliberately does not enumerate MicroVMs at all — this detection knowledge is for Weaver-side / host tooling that legitimately needs MicroVM run-state.)

<!-- /entry -->

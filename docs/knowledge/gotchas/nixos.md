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

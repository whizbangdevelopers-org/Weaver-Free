<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — nixos

Lessons learned in the **nixos** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-nixos-2026-05-13-001 -->
---
id: L-nixos-2026-05-13-001
type: lesson
domain: nixos
tags: [kuzu, native-module, npm, nix-sandbox]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## Kuzu npm package is Nix build-safe without removal — 2026-05-13 · Claude

**Root cause:** Kuzu bundles a pre-built `.node` native addon in its npm tarball. Unlike sass-embedded (which Vite actively tries to load during the frontend build, causing sandbox failures), kuzu's native binary is never executed during `npm run build` or `npx quasar build`. It's only loaded at runtime by Node processes that `require('kuzu')`.

**Rule:** Do NOT remove kuzu from `node_modules` in the Nix `buildPhase`. Just update `npmDepsHash` and `lockfile-marker` after `npm install`. Removal is only needed for packages that Vite/esbuild tries to bundle at build time.

**Why this shape wins:** The `buildPhase` script already has a pattern for removing build-time-executed native binaries (`rm -rf node_modules/sass-embedded`). kuzu doesn't belong in that list — adding it would break the script that generates kuzu-powered ingest outputs.

<!-- /entry -->

<!-- entry:L-nixos-2026-06-01-001 -->
---
id: L-nixos-2026-06-01-001
type: lesson
domain: nixos
tags: [infrastructure, flake, config-management, reproducibility]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## All infrastructure machines must be in a flake repo from day one — 2026-06-01 · Claude

**Root cause:** weaver-lab had been managed imperatively over 10 generations — `nixos-rebuild switch` called with configs that were never committed. When we went to reconstruct the config, `/etc/nixos/` was empty. We recovered by reading running systemd unit files, disk UUIDs from `lsblk`, network files from `/etc/systemd/network/`, and service configs from the nix store — a 45-minute forensic exercise that could have been a 5-second git checkout.

**Rule:** Every NixOS machine in the fleet gets an entry in the Foundry flake (`hosts/<hostname>/default.nix` + `hardware-configuration.nix`) from the moment it's provisioned. The Foundry repo is synced to the machine's `/etc/nixos/` and all rebuilds use `--flake /etc/nixos#<hostname>`. No machine should have more generations than it has commits.

**Why this shape wins:** Config-as-code means any machine can be rebuilt from scratch in one command. Forensic reconstruction from running state is error-prone (services may have been manually patched since the last rebuild) and doesn't capture intent. The Foundry repo also serves as the audit trail — you can see exactly what changed between generations.

<!-- /entry -->

<!-- entry:L-nixos-2026-06-01-002 -->
---
id: L-nixos-2026-06-01-002
type: lesson
domain: nixos
tags: [networking, nat, iptables, gateway, multi-nic]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-01-001, G-nixos-2026-06-01-002]
graduated_to: ""
---

## Dedicated iptables oneshot service is the reliable NAT pattern for systemd-networkd hosts — 2026-06-01 · Claude

**Root cause:** Both `networking.nat` (NixOS module) and `IPMasquerade` (systemd-networkd option) failed silently on a dual-NIC NixOS 25.11 host with `networking.useNetworkd = true`. After three failed attempts with native options, an explicit systemd oneshot service applying iptables rules directly worked on the first try and has been stable since.

**Rule:** For a NixOS host acting as a NAT gateway with `networking.useNetworkd = true`: write a `systemd.services.<name>` oneshot with `after = ["network.target"]`, `wantedBy = ["multi-user.target"]`, `RemainAfterExit = true`, and explicit `iptables -t nat -A POSTROUTING ... -j MASQUERADE` + FORWARD rules. Use `iptables -C` (check) before `-A` (append) to prevent duplicate rules on service restart. Set `boot.kernel.sysctl."net.ipv4.ip_forward" = 1` separately.

**Why this shape wins:** The iptables rules are explicit, testable, and version-controlled. You can read the service script and know exactly what rules will be applied. The native NixOS/networkd options are opaque — when they don't work, there's no visibility into why. The oneshot pattern also survives reboots without a restart (RemainAfterExit keeps it "active" for dependency ordering).

<!-- /entry -->

<!-- entry:L-nixos-2026-06-02-001 -->
---
id: L-nixos-2026-06-02-001
type: lesson
domain: nixos
tags: [nixos-rebuild, manual-gate, release, onboarding, dev-vs-prod]
since_version: "1.0.5"
status: active
scope: project
related: []
graduated_to: ""
---

## The NixOS rebuild IS the new-user experience — make it a manual release gate — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-02-24)

**Root cause:** The dev server (port 3110) develops UI/API but skips all NixOS infrastructure (bridge, QEMU, tap interfaces, systemd units). CirrOS auto-provisioning only works on the real NixOS service (port 3100) after `nix-fresh-install.sh`. No automated test covers the full chain — unit tests mock the infrastructure, Docker E2E uses a simplified backend, dev servers skip NixOS entirely. Two earlier "fixes" (disabling provisioning in dev, redirecting `MICROVMS_DIR` to a local path) were shortcuts that masked the real onboarding behavior.

**Rule:** Every release passes a manual NixOS rebuild gate: `sudo ./scripts/nix-fresh-install.sh`, then verify at `localhost:3100` — PWA loads clean, first-run admin setup works, CirrOS auto-provisions and transitions to running, VM start/stop/restart work, WebSocket updates live. Never add dev workarounds for infrastructure that only exists in production.

**Why this shape wins:** The rebuild exercises the entire production stack end-to-end (Nix build → systemd → bridge networking → QEMU → image download → cloud-init → first-run setup → PWA from the Nix store) — the only path that shows what a real user sees. If the rebuild is too slow or painful, that's a bug in the rebuild process, not a reason to skip the gate.

<!-- /entry -->

<!-- entry:L-nixos-2026-06-02-002 -->
---
id: L-nixos-2026-06-02-002
type: lesson
domain: nixos
tags: [systemd, bridge, networking, rebuild, wants, after, dependency]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## A service depending on a NixOS bridge must declare wants/after — WantedBy=network.target only fires at boot — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Root cause:** `networking.bridges.br-microvm` generates `br-microvm-netdev.service` and `network-addresses-br-microvm.service`, both `WantedBy=network.target`. That wantedBy is honored only at boot. After an uninstall/install cycle that stopped those units, a later rebuild re-enabling the bridge brings up *new* units but does not restart units already known as stopped — leaving the bridge missing, so VM TAP creation fails with `br-microvm is wrong: Device does not exist`.

**Rule:** A service that functionally depends on a NixOS-managed network bridge must declare the dependency explicitly via `wants` + `after` on the bridge unit names, e.g. `wants = [ "${cfg.bridgeInterface}-netdev.service" "network-addresses-${cfg.bridgeInterface}.service" ];`. Then a rebuild that restarts the service also restarts the bridge.

**Why this shape wins:** `WantedBy=network.target` is fine for boot ordering but not for rebuild cycles — only an explicit dependency edge survives stop/restart across reconfigure events. The dependency makes the bridge a precondition of the service, eliminating the "works after reboot, broken after rebuild" failure class.

<!-- /entry -->

<!-- entry:L-nixos-2026-06-02-003 -->
---
id: L-nixos-2026-06-02-003
type: lesson
domain: nixos
tags: [realpath, lstat, readlink, service-user, permissions, error-messages]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## realpath() requires parent-dir traversal; lstat/readlink don't — use them in restricted service-user helpers — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-04-14)

**Root cause:** The Host Config viewer used `fs.promises.realpath()` to detect a symlinked `/etc/nixos/configuration.nix` and emit a helpful remediation. But `realpath()` traverses *every* parent directory. On boxes where `/etc/nixos` symlinks into `$HOME` (config git-tracked under the user's home), `realpath()` as the weaver service user fails at `/home/mark` (mode 0700), so the symlink-detection branch never fired and the user saw a generic "permission denied" with no fix.

**Rule:** When writing error-message helpers that run as a restricted service user, walk the parent chain manually with `lstat` + `readlink` instead of `realpath`. `lstat` on a symlink doesn't traverse its target and `readlink` returns the target string without following it — so you can detect a symlink into a `0700` dir even when you can't traverse that dir, and emit the precise fix (`sudo chmod o+x /home/mark`).

**Why this shape wins:** The restricted service user gets further before hitting a permission wall, which means the diagnostic reaches the actionable case instead of collapsing into a generic error. Precise remediation beats correct-but-useless error text.

<!-- /entry -->

<!-- entry:L-nixos-2026-06-02-004 -->
---
id: L-nixos-2026-06-02-004
type: lesson
domain: nixos
tags: [buildnpmpackage, nextjs, postpatch, config-precedence, packaging]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Next.js config-file precedence (.mjs > .ts > .js) silently defeats buildNpmPackage postPatch — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-04)

**Root cause:** When packaging a Next.js app with `buildNpmPackage`, `postPatch` substitutions to `next.config.ts` are silently ignored if the project also ships `next.config.mjs`. Next.js resolves config files in priority order `.mjs → .ts → .js`, and the `.mjs` wins even when empty. Upstream cognee shipped an empty `next.config.mjs` plus a `next.config.ts` with real config; Nix patches to the `.ts` (including `ignoreBuildErrors`) never reached the build.

**Rule:** Before writing any `postPatch` for a Next.js project, run `ls next.config.*` in the source tree. Patch the file that actually wins resolution (`.mjs` if present), and if both exist, confirm which contains the real config and patch that one only.

**Why this shape wins:** Verifying which config file is authoritative before patching turns a silent no-op into a deterministic patch. The precedence rule is the same for any tool with a multi-extension config resolution — check resolution order before assuming your edit is the one that's read.

<!-- /entry -->

<!-- entry:L-nixos-2026-06-02-005 -->
---
id: L-nixos-2026-06-02-005
type: lesson
domain: nixos
tags: [makewrapper, set-default, hostname, listen-address, nextjs]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## makeWrapper --set-default is unsafe for network listen addresses — HOSTNAME is always pre-set — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-04)

**Root cause:** `makeWrapper --set-default HOSTNAME "0.0.0.0"` only applies when `HOSTNAME` is unset, but bash auto-exports `HOSTNAME` (the machine name) in every login shell. Next.js standalone servers read `process.env.HOSTNAME` as their listen address, so the server binds to whatever the machine name resolves to (e.g. a loopback alias) instead of `0.0.0.0`.

**Rule:** Use `--set HOSTNAME "0.0.0.0"` (not `--set-default`) in makeWrapper for any server whose bind address comes from an environment variable that the shell may already populate. `--set` always overrides — which is what a network address needs. Operators who want a different bind address should pass an explicitly-named variable, not rely on the shell's `HOSTNAME`.

**Why this shape wins:** `--set-default` is correct only when the variable is genuinely optional and unset by default. For any variable a login shell auto-populates (`HOSTNAME`, `USER`, `PWD`), `--set-default` is a silent no-op — reserve it for app-specific knobs and use `--set` for environment-collisions.

<!-- /entry -->

<!-- entry:L-nixos-2026-06-02-006 -->
---
id: L-nixos-2026-06-02-006
type: lesson
domain: nixos
tags: [systemd, killmode, nodejs, child-process, rebuild, service]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Node.js NixOS services that spawn children need explicit KillMode=control-group — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-04)

**Root cause:** A NixOS systemd service running a Node.js server that spawns child processes (Next.js standalone, worker threads, cluster mode) hangs at the stop step during `nixos-rebuild switch` because child processes outlive the main PID and systemd's default kill targets only the main process.

**Rule:** Declare kill semantics explicitly for any multi-process Node.js NixOS service:
```nix
serviceConfig = {
  KillMode       = "control-group";
  KillSignal     = "SIGTERM";
  TimeoutStopSec = "10s";
};
```

**Why this shape wins:** `control-group` targets every process in the systemd cgroup — the only guarantee that a multi-process server fully stops — and `TimeoutStopSec` is the safety net if a child ignores SIGTERM. Without it, a rebuild can hang indefinitely on shutdown, which is worse than a crash because it blocks the whole switch.

<!-- /entry -->

<!-- entry:L-nixos-2026-06-02-007 -->
---
id: L-nixos-2026-06-02-007
type: lesson
domain: nixos
tags: [systemd, execstartpre, readiness-probe, sidecar, type-simple, ordering]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Type=simple after= waits for process start, not endpoint readiness — add an ExecStartPre probe — 2026-06-02 · Claude (migrated from legacy archive, orig. 2026-05-06)

**Root cause:** When service A depends on sibling service B and both are `Type=simple`, `after=B.service` only waits for B's *process* to start — not for B's HTTP endpoint to accept connections. A local inference server can take 5–60s to load a model after the process starts; A firing requests in that window fails with a connection error. `Type=simple` has no readiness protocol — systemd marks the unit active the instant the process starts.

**Rule:** For any service that calls a sibling HTTP sidecar, add an `ExecStartPre` readiness probe that polls the sidecar's health endpoint before the main process starts:
```nix
ExecStartPre = "${pkgs.bash}/bin/bash -c 'for i in $(seq 1 60); do ${pkgs.curl}/bin/curl -sf http://127.0.0.1:PORT/health && exit 0; sleep 2; done; echo \"sidecar not ready after 120s\"; exit 1'";
```
Retry every 2s up to 120s, using full Nix store paths for every binary (systemd has minimal PATH).

**Why this shape wins:** The probe converts process-level ordering into endpoint-level readiness, covering both cold-start model-load time and restart races in one place. It fails loud after a bounded timeout rather than letting A crash-loop against a not-yet-ready B.

<!-- /entry -->

<!-- entry:L-nixos-2026-06-05-001 -->
---
id: L-nixos-2026-06-05-001
type: lesson
domain: nixos
tags: [airgap, deployment, closures, nixos-rebuild, supply-chain]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-05-005]
graduated_to: ""
---

## Airgapped NixOS host: build on a WAN host and push closures — don't local-build with a WAN toggle — 2026-06-05 · Claude

**Root cause:** An airgapped host still needs new system closures when its config or nixpkgs changes. The tempting design is "let the host build locally and open a temporary WAN path during the release cycle" — but that makes the airgap a *toggle you must remember to flip off*, and the host periodically touches the internet.

**Rule (call it Option A):** Build on a WAN-connected control host and *push the closure* to the airgapped target — it only activates, never fetches:
```
nixos-rebuild switch --flake <repo>#<host> --target-host root@<host>
```
With no `--build-host`, the build runs locally (on the WAN-connected host) and `--target-host` copies the realised closure over SSH and activates it. The airgapped host never needs WAN — not even for an nixpkgs bump — so there is no toggle to forget.

**Why this shape wins:** "True airgap" becomes the permanent default instead of a transient state. It is exactly what an air-gapped *customer* appliance does (build elsewhere, deliver the closure), so the homelab deployment doubles as the reference for the product's air-gapped-install story. Pairs with [[G-nixos-2026-06-05-005]] (keep internal routes; drop only the default route). Verify post-deploy: the box still resolves/mounts internal services but `ping 1.1.1.1` fails.

<!-- /entry -->

<!-- entry:L-nixos-2026-06-06-001 -->
---
id: L-nixos-2026-06-06-001
type: lesson
domain: nixos
tags: [refactor, modules, nix-eval, verification, microvm]
since_version: "1.0"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Prove a NixOS module refactor is a no-op with a toplevel outPath diff — 2026-06-06 · Claude

**Root cause:** Promoting a shared module (antsle's `common-vm.nix` → a parameterized `modules/microvm-common-vm.nix`) on a *production* host needs proof it changed nothing — eyeballing a diff is not proof.

**Rule:** Capture a baseline before touching anything: `nix eval --raw .#nixosConfigurations.<host>.config.system.build.toplevel.outPath`. Refactor so every new option's default reproduces the old hardcoded value exactly. Re-eval. **Identical outPath = byte-identical system derivation = provable no-op** (no rebuild, no behavioral change) — the store hash is a pure function of all inputs, so equality is dispositive and needs only eval, not a build. Two footguns: (1) a brand-new `.nix` file is invisible to flake eval until `git add`, even in a dirty tree (eval fails with `path … does not exist`); (2) adding NixOS options can shift the hash via the generated options manual when `documentation.nixos.enable` is on — if the hash moves, eval the specific runtime attrs (`systemd.network`, `users.users.root.openssh.authorizedKeys.keys`, `microvm.interfaces`) to confirm it's doc churn, not config drift.

**Why this shape wins:** turns "I think this refactor is safe" into a one-command proof, cheaply (eval, not build) — exactly what you want before consolidating a single-source module that a live host depends on.
<!-- /entry -->

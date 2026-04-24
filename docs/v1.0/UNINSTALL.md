<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# Weaver Uninstall Guide

This guide is for administrators who want to **cleanly remove Weaver** from a NixOS host. The included script handles both install paths (flake-based and traditional channels) uniformly, shows a plan before acting, and verifies the result.

**Who this is for:** anyone decommissioning a Weaver install, migrating to a different host, or wiping an evaluation environment.

**Who this is NOT for:** users who want to move to a newer Weaver version — see [UPGRADE.md](UPGRADE.md) for in-place upgrades that preserve data.

## Table of Contents

- [Before You Uninstall](#before-you-uninstall)
- [The Uninstall Script](#the-uninstall-script)
- [What the Script Does](#what-the-script-does)
- [Flags](#flags)
- [Environment Variables](#environment-variables)
- [Preserving Data](#preserving-data)
- [Manual Uninstall](#manual-uninstall)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Reinstalling After Uninstall](#reinstalling-after-uninstall)

---

## Before You Uninstall

1. **Back up your data if you might want to restore it later.** The default data directory is `/var/lib/weaver/`. It contains the SQLite DB (users, VM registry, audit log, notification configs) and the JWT secret. A tarball suffices:

   ```sh
   sudo tar -czf /root/weaver-backup-$(date +%Y%m%d-%H%M%S).tar.gz /var/lib/weaver
   ```

   Without this, `--keep-data` is your other option (see [Preserving Data](#preserving-data) below), but a tarball is still the safer choice.

2. **Note any running MicroVMs.** The uninstall stops all `microvm@*.service` units. If a running VM has uncommitted state, dump it first:

   ```sh
   systemctl list-units --type=service --state=running | grep microvm@
   ```

3. **Review your NixOS config for shared modules.** If Weaver's config lives in a `.nix` file that also defines unrelated services, the script will *edit* that file (remove Weaver lines) rather than delete it. Review the plan carefully before confirming — see [Phase 2: Show the Plan](#what-the-script-does).

4. **If you're uninstalling before a reinstall,** see [Reinstalling After Uninstall](#reinstalling-after-uninstall) for the one gotcha (bridge services).

---

## The Uninstall Script

One command handles both flake and channels-based installs:

```sh
sudo ./scripts/nix-uninstall.sh
```

Run from the Weaver source tree (or the release tarball's extracted directory) with sudo. The script auto-detects your install path — no flag is needed to tell it flake-vs-channels.

### If you don't have the source tree

The script ships in the release tarball and in every installed Weaver package under `scripts/nix-uninstall.sh`. If you installed via NUR, you can either:

- Clone [Weaver-Free](https://github.com/whizbangdevelopers-org/Weaver-Free) and run from the clone:
  ```sh
  git clone https://github.com/whizbangdevelopers-org/Weaver-Free.git /tmp/weaver-free
  cd /tmp/weaver-free
  sudo ./scripts/nix-uninstall.sh
  ```
- Or download just the script:
  ```sh
  curl -o /tmp/nix-uninstall.sh https://raw.githubusercontent.com/whizbangdevelopers-org/Weaver-Free/main/scripts/nix-uninstall.sh
  chmod +x /tmp/nix-uninstall.sh
  sudo /tmp/nix-uninstall.sh
  ```

---

## What the Script Does

Five phases. The script stops and asks for confirmation between the plan (phase 2) and the actions (phase 4) — nothing destructive happens until you confirm.

### Phase 1 — Scan

Detects what's currently installed:

- Is `weaver.service` running?
- Are any `microvm@*` services running?
- Does `/var/lib/weaver/` exist and contain data?
- Which `.nix` files reference `services.weaver`, `weaver.nixosModules`, `inputs.weaver`, or raw path imports to the Weaver source?
- Does `flake.nix` contain a `weaver` input?
- Does `flake.lock` have a `weaver` node?

Files referencing Weaver are classified:

- **Weaver-only files** — every non-trivial line is a Weaver declaration. Will be *deleted* entirely.
- **Weaver-shared files** — the file also has unrelated config. Only Weaver-related lines are *removed* (via `sed -i`); the rest of the file stays.

### Phase 2 — Show the Plan

Before touching anything, the script prints exactly what it will do:

```
  ┌─────────────────────────────────────────────────────────────┐
  │              WEAVER UNINSTALL                               │
  └─────────────────────────────────────────────────────────────┘

  This script will:

  1. Stop the weaver service
  2. Stop running MicroVM services
  3. Delete all data in /var/lib/weaver
  4. Delete /etc/nixos/weaver.nix
  5. Clean 2 file(s) of weaver references
  6. Remove weaver input from flake.nix
  7. Regenerate flake.lock
  8. Rebuild NixOS
```

### Phase 3 — Confirm

The script asks `Continue? [y/N]`. Any answer other than `y`/`yes` aborts with no changes made. This is the only gate — if you miss it, nothing has happened yet.

### Phase 4 — Execute

- Stops `weaver.service`
- Stops running `microvm@*` services
- Deletes `/var/lib/weaver/` (unless `--keep-data` was passed)
- Deletes weaver-only `.nix` files
- Runs `sed -i` on weaver-shared files to remove weaver lines only
- Edits `flake.nix` to remove `weaver.url`, `weaver.inputs.*`, and `weaver` from the `outputs` function params and modules list
- Runs `nix flake lock` to regenerate `flake.lock` without the weaver node
- Runs `sudo nixos-rebuild switch --flake $NIXOS_FLAKE#$NIXOS_HOST` to apply

If the rebuild fails (e.g., a shared file had a syntax issue after line removal), the script stops with a message and leaves the config in its partially-edited state. Fix the config manually and re-run `nixos-rebuild switch`.

### Phase 5 — Verify

After the rebuild, the script confirms:

- `weaver.service` is no longer active
- `/var/lib/weaver/` is gone (unless `--keep-data`)
- Weaver-only files are deleted
- No remaining weaver references in `.nix` files under `$NIXOS_FLAKE`

Any verify failures print a clear error; the script exits non-zero so scripting around it sees the failure.

---

## Flags

| Flag | Effect |
|---|---|
| `--keep-data` | Preserve `/var/lib/weaver/` (database, JWT secrets, user accounts, audit log). Use when you might reinstall later and want the same users/state. |
| `--dry-run` | Run phases 1–2 only (scan + print plan), then exit without asking to proceed. No changes are made. Use to preview what would happen. |
| `--help` / `-h` | Print usage summary and exit. |

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `NIXOS_FLAKE` | `/etc/nixos` | Path to the NixOS flake (or config dir for non-flake setups). Override if your config lives elsewhere. |
| `NIXOS_HOST` | `$(hostname)` | Host name in the flake's `nixosConfigurations.<name>`. Override if your config key differs from the hostname. |
| `WEAVER_DATA_DIR` | `/var/lib/weaver` | Data directory to remove. Override if you set a non-default `services.weaver.dataDir`. |

Example — uninstalling from a non-standard config location:

```sh
sudo NIXOS_FLAKE=/srv/nixos-config NIXOS_HOST=weaverlab ./scripts/nix-uninstall.sh
```

---

## Preserving Data

Default behavior: **data is destroyed.** `/var/lib/weaver/` is removed after the service stops. This includes:

- SQLite databases (users, VM registry, audit log, notification configs, sessions)
- JWT signing secret (auto-generated on first run; different each install unless you set it explicitly)
- Any TLS certificates the app stored there
- Demo-mode state, if any

Pass `--keep-data` to preserve the directory:

```sh
sudo ./scripts/nix-uninstall.sh --keep-data
```

With `--keep-data`, a future reinstall that sets the same `services.weaver.dataDir` will pick up the existing users, VMs, and audit history as if nothing happened.

**When to keep data:**
- Migrating to a newer Weaver version via the uninstall/reinstall path (rare — [UPGRADE.md](UPGRADE.md) is usually the right path instead)
- Moving to a different host — rsync the data dir to the new host's `/var/lib/weaver/` after the new install sets permissions
- Evaluation / testing where you want to roll back to the current state

**When to wipe data:**
- Decommissioning the host
- Security-relevant reset (compromised JWT secret, suspicious audit entries, shared password leak)
- Selling or returning leased hardware

---

## Manual Uninstall

If the script fails or you want full control, here's the manual sequence. Do each step in order.

```sh
# 1. Stop the service
sudo systemctl stop weaver.service

# 2. Stop running MicroVMs
for svc in $(systemctl list-units --type=service --state=running --no-legend | grep microvm@ | awk '{print $1}'); do
  sudo systemctl stop "$svc"
done

# 3. Remove the data directory (skip if preserving)
sudo rm -rf /var/lib/weaver

# 4. Edit your NixOS config to remove weaver declarations
#    Files to check in /etc/nixos/ (or wherever your config lives):
#      - flake.nix         — remove `weaver.url`, `weaver.inputs.*`, `weaver` from outputs + modules list
#      - configuration.nix — remove `services.weaver = { ... };` block
#      - any per-machine file importing the weaver module

# 5. Regenerate flake.lock (if using flakes)
sudo nix flake lock /etc/nixos

# 6. Rebuild the system
sudo nixos-rebuild switch --flake /etc/nixos#$(hostname)
```

---

## Verification

After uninstall (scripted or manual), confirm:

```sh
# Service should not exist or be inactive
systemctl status weaver.service 2>&1 | head -3
# Expected: "Unit weaver.service could not be found" or inactive (dead)

# Data directory should be gone (unless --keep-data)
ls -la /var/lib/weaver 2>&1
# Expected: "No such file or directory"

# Config should not reference weaver
sudo grep -rn "services\.weaver\|weaver\.nixosModules" /etc/nixos/ 2>&1
# Expected: no output

# Flake should not reference weaver
sudo grep -c weaver /etc/nixos/flake.nix 2>&1
# Expected: 0 (or only comments you kept intentionally)

# Port 3100 should be free
sudo ss -tlnp | grep :3100 || echo "port 3100 free"
# Expected: "port 3100 free"
```

---

## Troubleshooting

### "Rebuild failed" after phase 4

The config edits went through but `nixos-rebuild switch` errored. Common causes:

- A weaver-shared file had a syntax issue after `sed` removed lines (e.g., dangling comma, unclosed brace). Re-open the file, fix the syntax, re-run `sudo nixos-rebuild switch`.
- A different module depended on a weaver attribute. Remove that dependency, rebuild.

The script exits non-zero so you know to investigate. Your system is still on the pre-uninstall generation until the rebuild succeeds.

### Bridge services don't restart on later reinstall

Known gotcha: if you uninstall and later reinstall Weaver, the `br-microvm-netdev.service` and `network-addresses-br-microvm.service` systemd units may not auto-start — `WantedBy=network.target` is only honored at boot. After reinstall, run:

```sh
sudo systemctl start br-microvm-netdev.service network-addresses-br-microvm.service
```

Or reboot.

**Why this happens**: `networking.bridges.br-microvm` generates two systemd units (`br-microvm-netdev.service` + `network-addresses-br-microvm.service`), both with `WantedBy=network.target`. That `WantedBy` is only honored at boot. After uninstall stopped them and a later rebuild re-enables them, `nixos-rebuild switch` doesn't automatically restart services it "already knows" are stopped — you have to start them manually (or reboot).

### Script says "Weaver is not installed on this system"

The scan found nothing — no running service, no data, no config references. Either Weaver was already removed or the detection heuristics missed something. To force a re-scan with full verbose output:

```sh
sudo NIXOS_FLAKE=/etc/nixos bash -x ./scripts/nix-uninstall.sh --dry-run
```

### User data won't fully clear

If `/var/lib/weaver/` remains after a non-`--keep-data` uninstall, check:

- Process still has the directory open? `sudo lsof +D /var/lib/weaver`
- Directory is on a mounted filesystem with read-only flag? `mount | grep weaver`
- SELinux / AppArmor blocking? `sudo dmesg | tail -20`

---

## Reinstalling After Uninstall

If you uninstalled with `--keep-data`, a reinstall that sets `services.weaver.dataDir = "/var/lib/weaver";` (the default) picks up the existing DB + JWT secret and continues as if nothing happened.

If you uninstalled without `--keep-data`, the reinstall is a clean slate. The first-run admin setup wizard appears at `http://localhost:3100` after the rebuild.

**Bridge gotcha on reinstall:** `br-microvm` won't auto-start on rebuild; run `sudo systemctl start br-microvm-netdev.service network-addresses-br-microvm.service` or reboot. (See Troubleshooting above.)

---

*See [UPGRADE.md](UPGRADE.md) for in-place upgrades (preserves data). See [ADMIN-GUIDE.md](ADMIN-GUIDE.md) § "Removing Weaver" for a short admin-flow summary.*

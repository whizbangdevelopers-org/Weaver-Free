<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# Weaver Upgrade Guide

This guide is for administrators upgrading an **existing Weaver installation** to a newer version. For first-time installation, see [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md).

**Who this is for:** anyone who already has Weaver running on a NixOS host and needs to move to a newer version without losing data, users, or audit history.

## Table of Contents

- [Before You Upgrade](#before-you-upgrade)
- [Upgrade Paths](#upgrade-paths)
- [Upgrade Procedure](#upgrade-procedure)
- [Verification Checklist](#verification-checklist)
- [What Persists Across Upgrades](#what-persists-across-upgrades)
- [What Resets](#what-resets)
- [Rollback](#rollback)
- [Troubleshooting](#troubleshooting)
- [Version-Specific Notes](#version-specific-notes)

---

## Before You Upgrade

1. **Read the CHANGELOG.md entry** (at the repo root) for the target version. Look specifically for:
   - `### Breaking Changes` — required config or behavior changes
   - `### Security` — reasons you *should* upgrade (CVEs, posture fixes)
   - `### Data / Schema` — if the DB or on-disk format changed, there's a migration note

2. **Back up your data directory.** Default location: `/var/lib/weaver/` (or whatever your NixOS module sets `services.weaver.dataDir` to). A tarball suffices:
   ```sh
   sudo tar -czf /root/weaver-backup-$(date +%Y%m%d-%H%M%S).tar.gz /var/lib/weaver
   ```

3. **Note the current version:**
   ```sh
   systemctl show weaver.service --property=MainPID
   /nix/store/<hash>-weaver-<VERSION>/bin/weaver --version
   ```
   Or check the symlink: `readlink /run/current-system/sw/bin/weaver | grep -oP 'weaver-\K[0-9.]+'`

4. **If your JWT secret is auto-generated** and you want to preserve sessions, capture it from the current config. A changed `JWT_SECRET` invalidates all user sessions (forced logout on upgrade).

---

## Upgrade Paths

Two paths depending on how you installed Weaver. Use the one that matches.

### Path A — NUR (Weaver Free)

You installed via the Nix User Repository (`nixpkgs.nur.repos.whizbangdevelopers.weaver-free`) and have a `weaver-free` flake input in your NixOS configuration.

### Path B — Direct flake input (Solo/Team/Fabrick or Weaver-Dev checkout)

You installed from a flake that points at a specific release tag (e.g., `github:whizbangdevelopers-org/Weaver-Dev/v1.0.1`) or a local path.

---

## Upgrade Procedure

### Path A — NUR

```sh
cd /etc/nixos              # or wherever your flake.nix lives
sudo nix flake update nur  # or the specific NUR input name
sudo nixos-rebuild switch
```

### Path B — Direct flake input

Edit your flake.nix to pin the new version:

```nix
# Before
weaver.url = "github:whizbangdevelopers-org/Weaver-Dev/v1.0.1";

# After
weaver.url = "github:whizbangdevelopers-org/Weaver-Dev/v1.0.2";
```

Then:

```sh
cd /etc/nixos
sudo nix flake update weaver
sudo nixos-rebuild switch
```

Both paths conclude with `nixos-rebuild switch`. The NixOS module's `systemd.services.weaver` declaration handles the service restart automatically — the old binary stops, the new binary starts, and systemd handles the transition.

Expected downtime: **5–30 seconds** while systemd restarts the service. WebSocket-connected clients reconnect automatically once the new backend is up.

---

## Verification Checklist

Run each of these after `nixos-rebuild switch` completes. If any fail, see [Troubleshooting](#troubleshooting) before considering the upgrade successful.

1. **Service started clean:**
   ```sh
   systemctl status weaver.service
   journalctl -u weaver.service --since "5 minutes ago" | grep -iE "error|fatal|panic"
   ```
   Expect: `active (running)`, no error/fatal/panic matches.

2. **Version advanced:**
   ```sh
   curl -s http://localhost:3100/api/health | jq .version
   ```
   Expect: the new version string.

3. **PWA loads:** open `http://localhost:3100` in a browser. No service-worker errors (F12 → Console). No blank page.

4. **Existing user login works:** log in with a known admin account. Session may need a fresh login if JWT secret rotated — that's expected only when the rotation is intentional.

5. **Audit log entries from pre-upgrade are visible:** check the Audit Log page, filter by a date before the upgrade. Entries should render.

6. **Workloads render:** Dashboard shows the same VMs as before, with the same configuration.

7. **Start/stop/restart actions work:** click a VM's action button. Operation completes without error. WebSocket status update arrives within 2 seconds.

8. **NixOS module options accepted:** if the upgrade added new module options, verify the rebuild didn't warn about unknown options:
   ```sh
   sudo nixos-rebuild switch 2>&1 | grep -i "warning"
   ```

If all 8 pass, the upgrade is successful. Keep the pre-upgrade data backup for at least one week before deleting.

---

## What Persists Across Upgrades

Data in the `dataDir` (`/var/lib/weaver/` by default) persists:

- User accounts, password hashes, roles
- License key + license state
- Audit log entries
- Preset tags
- Per-user ACLs (Fabrick tier)
- Per-user resource quotas (Fabrick tier)
- WebSocket subscription preferences (if persisted)
- NotificationConfig (channels, resource alerts)
- TagManagement entries

Registered workloads persist too — they live in the NixOS config (for declarative VMs) or in `dataDir/vms.json` (for Live-Provisioned VMs and registered-only entries).

---

## What Resets

- **In-memory sessions** — if the service restarts, any active WebSocket is reconnected and HTTP session cookies remain valid as long as JWT_SECRET is unchanged.
- **Rate-limit counters** — reset to zero on restart. This is intentional.
- **Mock-agent operations in progress** — if a demo-mode agent call was streaming when the service restarts, the stream is cut cleanly and the client sees an `agent-error` WebSocket message.
- **VM status cache** — re-queried from `systemctl` on startup. First dashboard load after restart may take 2–5 seconds longer than subsequent loads.

---

## Rollback

If verification fails and you need to revert, NixOS generations are your friend:

```sh
# Roll back to the previous generation
sudo nixos-rebuild switch --rollback

# Or boot an earlier generation at the next boot
sudo /nix/var/nix/profiles/system/bin/switch-to-configuration boot
# Then: reboot and pick an older generation from the bootloader menu
```

After rollback:

1. Verify the service is running: `systemctl status weaver.service`
2. Restore data backup if necessary: `sudo tar -xzf /root/weaver-backup-<timestamp>.tar.gz -C /`
3. File an issue at https://github.com/whizbangdevelopers-org/Weaver-Free/issues with the `journalctl -u weaver.service --since` output from the failed upgrade attempt.

---

## Troubleshooting

### Service fails to start after upgrade

```sh
journalctl -u weaver.service --since "5 minutes ago" -n 100
```

Look for:
- **`EACCES`** on data-dir access — file ownership drift; `sudo chown -R weaver:weaver /var/lib/weaver`
- **`Error: Cannot find module`** — npm deps not rebuilt; verify `/nix/store/<hash>-weaver-<version>/lib/weaver/node_modules/` exists
- **Port already in use** — old service not fully stopped; `sudo systemctl stop weaver.service && sudo systemctl start weaver.service`

### PWA loads but API calls fail with CORS errors

The frontend bundle and backend both ship from the same `$out`. If they're mismatched (e.g., partial rebuild), you'll see CORS-like "blocked by origin" errors. Resolution: full rebuild with `sudo nixos-rebuild switch` from the flake root (not just a service restart).

### All users forced to re-login after upgrade

JWT secret rotated. If this was unintentional, the NixOS module's JWT_SECRET config probably changed. Restore the previous value from backup or accept the forced re-login as a one-time cost.

### New NixOS module options warning about "undefined option"

You upgraded past a version that removed or renamed a module option. Check the CHANGELOG for the version in between for `### Breaking Changes`. Update your `services.weaver.*` configuration accordingly.

---

## Version-Specific Notes

### v1.0.2 (upgrading from v1.0.1)

No breaking changes. Safe rolling upgrade.

**Behavior changes to be aware of:**

- **Free-tier VM control cap** — if you're running Weaver Free with **more than 10 registered workloads**, the alphabetical-first 10 remain controllable; actions (start/restart) on workloads 11+ now return `403 — outside your Free-tier managed set`. This is intentional; it was announced as a Free-tier clarification. Upgrade to Weaver Solo for unlimited control. See [USER-GUIDE.md § Action Buttons](USER-GUIDE.md#action-buttons) for the full cap details.
- **Total running memory ceiling at Free** — 64 GB. If you try to start a workload that would push total running memory over that, the start action returns 403. Stop other workloads first or upgrade.
- **No data-file migrations.** All existing user accounts, audit logs, tags, and VM registrations persist untouched.
- **License terms updated** — Commons Clause dropped from Weaver Free LICENSE; now pure AGPL-3.0 with an AI Training Restriction. This is a *relaxation* (Commons Clause was more restrictive); no action required.

### Future versions

This section will gain a new heading for each release with upgrade-specific notes. If you're skipping versions (e.g., 1.0.0 → 1.1.0), read the notes for every version in between — breaking changes are cumulative.

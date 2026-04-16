<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# Weaver Administration Guide

This guide is for the person who installed Weaver and operates it day-to-day. It covers initial setup, user management, license configuration, workload provisioning, security administration, and ongoing maintenance.

**Prerequisites:** Weaver is installed and running on NixOS. If you have not yet installed Weaver, see [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md) for NixOS module installation instructions.

## Table of Contents

- [First-Run Setup](#first-run-setup)
- [User Management](#user-management)
- [License & Tier Management](#license--tier-management)
- [Network Management](#network-management)
- [AI Agent Configuration](#ai-agent-configuration)
- [Workload Management](#workload-management)
- [Tags & Organization](#tags--organization)
- [Audit Log](#audit-log)
- [Notifications](#notifications)
- [Organization Settings](#organization-settings)
- [Security Administration](#security-administration)
- [Backup & Restore](#backup--restore)
- [Monitoring & Health](#monitoring--health)
- [Upgrade Procedures](#upgrade-procedures)
- [Extensions](#extensions)
- [Weaver Team Administration](#weaver-team-administration)
- [Fabrick Administration](#fabrick-administration)
- [TUI Administration](#tui-administration)

---

## First-Run Setup

*Available: v1.0+*

When Weaver starts for the first time with no existing user accounts, the login page automatically switches to a "Create Admin Account" form. The first account created always receives admin privileges.

### Steps

1. Open your browser and navigate to `http://<host>:3100` (default port). The port is configured via `services.weaver.port` in the NixOS module. See [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md) for configuration options.
2. The login page displays a "Create Admin Account" form when no users exist.
3. Enter a username (lowercase, starts with a letter, 3+ characters) and password (14+ characters, must include uppercase, lowercase, digit, and special character).
4. Click "Create Account". You are logged in as the admin.

### Verifying the Installation

After first login, confirm:

- The Weaver page loads and shows the host information strip (hostname, IP, CPU cores, RAM, KVM status).
- Any existing VMs on the host are discovered and displayed.
- The WebSocket connection is active (VM status updates in real time without page refresh).
- The health endpoint responds: `curl -s http://localhost:3100/api/health | jq .`

#### Weaver Solo+ — Auto-Provisioning

With a Solo or higher license and provisioning enabled, a lightweight CirOS example VM (~20 MB) is auto-provisioned after your first admin login. Look for "example-cirros" on the Weaver page — it should appear and transition to "running" status within a few seconds.

**Removing the example VM:** Once you have your own workloads registered or created, `example-cirros` is safe to delete. Click the VM card on the Weaver page, then click **Delete** in the detail panel. A hint banner will appear on the dashboard prompting you to remove it once it detects both the example and your own VMs. The example is not automatically recreated — deletion is permanent.

> **Note:** If you configured `initialAdminPasswordFile` in the NixOS module, the admin account is created automatically on first startup. You can log in immediately with the username `admin` and the password from that file. Change the password via the UI after first login.

---

## User Management

*Available: v1.0+*

*User management (Solo+):* The admin creates and manages user accounts from the Users page in the sidebar. Free tier is single-admin — upgrade to Solo or higher for multi-user access.

| Tier | User capacity |
|------|--------------|
| Free | 1 admin (single user) |
| Solo | 1 admin + additional Operators and Viewers |
| Team | Per-user licensing — 4 paying users + 1 viewer |
| Fabrick | Unlimited users |

### Roles

| Role | Permissions |
|------|------------|
| **Admin** | Full access: manage users, delete VMs, manage distributions, configure settings, view audit log |
| **Operator** | Start/stop/restart VMs, register new VMs, refresh distro catalog, use AI diagnostics |
| **Viewer** | Read-only access to the Weaver page, network map, and AI diagnostics |
| **Auditor** *(v1.2+)* | Read-only access plus audit log viewing; cannot modify workloads or users |

The dashboard hides actions you do not have permission to perform. Viewers do not see Start/Stop/Restart, Create VM, or Delete buttons. Operators do not see the Delete button.

### Creating Users

1. Navigate to Users from the sidebar.
2. Click "Add User" in the top-right corner.
3. Enter a username (lowercase, starts with a letter), password (14+ characters with uppercase, lowercase, digit, and special character), and select a role.
4. Click "Create User".

### Changing Roles

Select a new role from the dropdown in the user's row. The change takes effect immediately. The affected user's active sessions are invalidated, requiring them to log in again.

### Deleting Users

Click the trash icon next to the user. You cannot delete your own account.

### User Limits (Weaver Team)

Weaver Team supports up to 4 paying users (Admin/Operator) plus 1 free Viewer seat. A banner appears when the limit is reached. Upgrade to Fabrick for unlimited users.

### Per-VM Access Control (Fabrick)

On Fabrick tier, admins can restrict which VMs each user can access. Click the shield icon next to a non-admin user to assign specific VMs. Users with ACL entries only see and interact with their assigned VMs. Leave the list empty for unrestricted access. Admin users always bypass ACL restrictions.

### Resource Quotas (Fabrick)

On Fabrick tier, admins can set per-user limits on maximum VMs, total memory (MB), and total vCPUs. When a quota is configured, the Create VM dialog shows current usage. VM creation is blocked when any quota limit would be exceeded. Quotas default to unlimited until explicitly set.

---

## License & Tier Management

*Available: v1.0+*

Weaver works out of the box on the Free tier — no license key required. To unlock additional capabilities, activate a license key in the NixOS module configuration.

| Tier | What it unlocks |
|------|----------------|
| **Free** | Workload monitoring, start/stop/restart, AI diagnostics (BYOK), network topology, serial console, TUI |
| **Weaver Solo** | Live Provisioning — create and manage workloads from the browser. Managed bridges, push notifications, distro management |
| **Weaver Team** | Multi-user with per-user licensing. Full remote management of up to 2 peer hosts |
| **Fabrick** | Fleet-scale governance — per-workload access control, resource quotas, audit log, fleet topology |

### Activating a License

Set `licenseKeyFile` in the NixOS module, pointing to a file containing your license key. Use sops-nix to encrypt the key at rest (see [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md) § Secrets Management).

```nix
services.weaver = {
  licenseKeyFile = config.sops.secrets."weaver/license-key".path;
};
```

### Checking Your Current Tier

The Settings page displays your current tier badge and expiry information. You can also check via the command line:

```bash
curl -s http://localhost:3100/api/health | jq '.tier'
```

### License Expiry

After expiry, tier features remain accessible in read-only mode for a 30-day grace period. A warning banner appears in Settings. After the grace period, the instance reverts to the Free tier.

> **Note:** Tier restrictions are enforced at the API level, not just the UI. The TUI and direct API calls respect the same tier gates.

---

## Network Management

*Available: v1.0+ (basic), v1.2+ (full management)*

### Strands — Local Topology

The Strands page (sidebar: "Strands") displays an interactive graph of your host, network bridges, and VMs/containers. Bridges are derived automatically from running workloads. Click a workload node to see its details; double-click to navigate to its detail page.

Strands is read-only on Weaver Free and interactive (drag, zoom, search) on all tiers.

### Bridge Management (v1.2+, Weaver Solo)

Bridges are auto-detected from the network interfaces your VMs are attached to. These appear with an "auto-detected" badge and are read-only. With Weaver Solo or higher, you can also:

- **Create managed bridges** — Click "Create Bridge" to define a new bridge with a name and gateway IP. Managed bridges support deletion and full configuration.
- **Configure IP pools** — Set IP address pools per bridge for automatic VM IP assignment.
- **Manage firewall rules** — View and manage nftables firewall rules per bridge (v1.2+).

### Default Bridge Configuration

The default bridge is `br-microvm` with gateway `10.10.0.1`. Customize in the NixOS module:

```nix
services.weaver = {
  bridgeInterface = "br-microvm";
  bridgeGateway = "10.10.0.1";
};
```

---

## AI Agent Configuration

*Available: v1.0+*

Weaver includes AI-powered workload diagnostics with three actions per VM: Diagnose (analyze issues), Explain (describe configuration), and Suggest (recommend optimizations).

### Mock Mode

When no API key is configured (server-side or BYOK), AI features use mock mode with canned sample responses. This is ideal for evaluation — no configuration required.

### BYOK (Bring Your Own Key)

Any user can configure their own Anthropic API key in Settings under "AI Provider (BYOK)":

1. Go to Settings.
2. In the "AI Provider (BYOK)" section, select a vendor and enter your API key.
3. The key is stored in your browser's localStorage only — never sent to or stored on the server.

Supported vendors include Anthropic (Claude), OpenAI, and self-hosted options (vLLM, TGI, Ollama).

### Server-Side AI Key (Weaver Solo+)

Admins can configure a server-side API key available to all Weaver Solo/Team and Fabrick users:

**NixOS module:** Set `aiApiKey` or `aiApiKeyFile` in the module configuration.

**Environment variable:** Set `ANTHROPIC_API_KEY` in the service environment.

Users on Weaver Solo+ can toggle between their personal BYOK key and the server-provided key in Settings.

### Per-Workload AI Assignment (Fabrick)

On Fabrick tier, admins can override the AI provider for specific workloads in Settings under "Workload AI Assignment". This is useful for HIPAA-sensitive VMs (route to ZenCoder) or air-gapped environments (route to local LLM).

### AI Credential Vault (v1.4+)

*Available: v1.4+*

Admin-managed credential vault for AI provider keys. Centralizes key management so individual users do not need to manage their own API keys.

### Rate Limits

AI agent rate limits are enforced per-user:

| Tier | Limit |
|------|-------|
| Free | 5 requests/minute |
| Weaver Solo/Team | 10 requests/minute |
| Fabrick | 30 requests/minute |

---

## Workload Management

### Two Approaches to MicroVMs

Weaver supports two ways to run MicroVMs, and they complement each other:

| | NixOS-Declared (All Tiers) | Live Provisioned (Weaver Solo+) |
|---|---|---|
| **How** | Define in NixOS flake → `nixos-rebuild switch` | Create from Weaver UI or API — no rebuild |
| **Guest OS** | NixOS only | Any (Ubuntu, Fedora, Windows, Alpine, Arch, custom) |
| **Hypervisors** | QEMU, Cloud Hypervisor, crosvm, kvmtool | QEMU |
| **Managed by** | systemd (`microvm@<name>.service`) | Weaver process manager |
| **Shared filesystems** | virtiofs / 9p | Not available |
| **Guest configuration** | Declarative Nix (version-controlled, atomic rollback) | Cloud-init or manual (ISO install) |
| **Terminal required** | Yes | No |

**Free tier** users define MicroVMs in their NixOS configuration and use Weaver to monitor, start, stop, and restart them. This path offers lighter hypervisors, shared filesystems, and full declarative reproducibility.

**Weaver Solo+** unlocks Live Provisioning — create and manage MicroVMs directly from the browser with any guest OS, no terminal needed. This is the core paid differentiator.

### Discovering Existing Workloads (All Tiers)

*Available: v1.0+*

Weaver automatically discovers NixOS-declared MicroVMs and containers running on your host. Two methods:

- **Scan for Workloads** — Discovers `microvm@*` systemd services and Docker/Podman containers, then adds them to Weaver. Available from the Weaver page or Settings.
- **Register Existing** — Manually register a workload that Weaver didn't auto-discover. For workloads managed outside Weaver that you want to monitor.

Once discovered, you can monitor, start, stop, and restart workloads from the Weaver page.

### Live Provisioning (Weaver Solo+)

*Available: Weaver Solo+*

Live Provisioning lets you create and manage MicroVMs directly from the browser — no terminal, no `nixos-rebuild switch`, no configuration files. Choose a distribution, set resources, and provision in seconds.

#### Supported Distributions

Built-in distributions include Arch Linux, Fedora, Ubuntu, Debian, Alpine, and CirOS. Custom distributions can be added in Settings.

- **Cloud distros** — QEMU with cloud images and cloud-init (Ubuntu, Fedora, etc.)
- **ISO distros** — boot from a downloaded ISO for manual installation (Windows, non-cloud Linux)
- **NixOS guests** — flake generator with microvm.nix

#### Hypervisor Options

| Hypervisor | Compatibility | Notes |
|-----------|---------------|-------|
| QEMU | All distributions | Most versatile; supports desktop mode (VNC), Windows, cloud images |
| Cloud Hypervisor | NixOS guests only | Lightweight alternative |
| crosvm | NixOS guests only | Lightweight alternative |
| kvmtool | NixOS guests only | Lightweight alternative |
| Firecracker | NixOS guests only | Lightweight; incompatible with virtiofs/9p |

#### Windows Guests

Windows guests use a "Bring Your Own ISO" approach:

1. In Settings, add a custom distro with your Windows ISO URL and set Guest OS to "Windows".
2. Create a new VM and select your Windows distro.
3. The VM is provisioned with a blank disk and your ISO attached as CDROM.
4. Start the VM and install Windows via the VNC console.

Windows VMs use IDE disk and e1000 networking for driver-free installation. Use Windows 10 or Server 2016+ (Windows 11 requires UEFI, which is not yet supported).

#### Image Management

Admins can manage distributions in Settings under "Distributions & Image URLs":

- **Check URLs** — Verify that all distribution image URLs are reachable.
- **Refresh Catalog** — Re-fetch the curated distro catalog from the bundled default or a remote URL.
- **Edit URLs** — Override the default image URL for any built-in distribution.
- **Add Custom Distributions** — Add new distros with remote URLs (`https://...`) or local file paths (`file:///path/to/image.qcow2`).

---

## Tags & Organization

*Available: v1.0+*

Tags help organize workloads by purpose, environment, team, or any other classification.

### Preset Tags

Admins can manage a global list of preset tags in Settings under "Tag Management". Preset tags are available as quick-select options when tagging workloads.

### Applying Tags

Edit tags on individual workloads from the VM detail page. Tags appear as badges on VM cards and can be used to filter the workload list.

### Bulk Tag Management

In Settings, the Tag Management section shows all tags in use with VM counts. Admins can:

- **Rename** a tag across all VMs in bulk.
- **Delete** a tag from all VMs in bulk.

---

## Audit Log

*Available: v1.0+ (recording), Fabrick (UI viewer)*

Weaver records significant user actions in an audit log. All tiers record audit events to `audit-log.json` in the data directory.

### What Is Logged

- Authentication events (login, logout, failed login attempts)
- VM operations (start, stop, restart, create, delete)
- AI agent invocations
- User management actions (create, delete, role change)
- Distribution management (add, delete, catalog refresh)
- Configuration changes

Each entry captures: timestamp, username, action, resource (if applicable), success/failure status, and IP address.

### Viewing the Audit Log (Fabrick)

On Fabrick tier, admins and operators can browse the audit log on the Audit Log page (sidebar: "Audit Log"). The page provides:

- **Filters** — Date range (from/until), action type, user ID, and resource name.
- **Paginated table** — Columns: Timestamp, User, Action (color-coded badge), Resource, Status (success/fail icon), IP.
- **Navigation** — Page controls at the bottom with entry count.

### Retention

Audit entries are stored in `audit-log.json` in the data directory. Back up this file as part of your regular backup procedure (see [Backup & Restore](#backup--restore)).

> **Note:** At v3.0+, the audit log transitions to a SQL backend with a full query UI and fleet-wide audit aggregation.

---

## Notifications

*Available: v1.0+ (in-app), Weaver Solo+ (push channels)*

### In-App Notifications

The bell icon in the toolbar shows unread notification count. Click to open the notification panel where you can mark individual notifications as read, dismiss them, or use checkboxes for bulk actions (mark read, delete). "Mark all read" clears the badge count; "Clear all" removes all notifications.

### Push Notification Channels (Weaver Solo+)

Admins can configure push notification channels in Settings under "Notifications":

1. Click "Add Channel" to create a new channel.
2. Select the channel type:
   - **ntfy** — Push to any ntfy server or ntfy.sh.
   - **Email (SMTP)** — Send notifications via your mail server.
   - **Webhook** — HTTP POST with support for JSON, Slack, Discord, and PagerDuty payload formats.
   - **Web Push** — Browser push notifications.
3. Select which events the channel should receive.
4. Click "Add Channel" to save, then use the "Test" button to verify delivery.

### Notification Events

Events are grouped into four categories:

| Category | Events |
|----------|--------|
| VM events | started, stopped, failed, recovered |
| Provisioning | provisioned, provision-failed |
| Resource alerts | high CPU, high memory |
| Security | auth failure, unauthorized access, permission denied |

Session lifecycle events (login kick, logout) do not trigger security notifications. Each channel can subscribe to any combination of events.

---

## Organization Settings

*Available: v1.0+*

Admins on Weaver Solo/Team and above can customize instance identity in Settings under "Identity":

- **Organization Name** — Appears in the browser tab, header, and login page.
- **Logo URL** — URL or data URI for your logo, shown in the header and login page. A preview is displayed as you type.
- **Contact Email** — Displayed on the Help page in a contact banner visible to all users.
- **Contact Phone** — Displayed on the Help page alongside the contact email.

Click "Save Identity" to apply changes.

---

## Security Administration

*Available: v1.0+*

### Rate Limiting

The backend enforces rate limits automatically with no configuration needed:

| Endpoint | Limit | Window |
|----------|-------|--------|
| Auth routes (login, register, refresh) | 10 requests | 1 minute |
| VM mutations (start, stop, restart, create, delete) | 30 requests | 1 minute |
| AI agent | 5/10/30 per tier | 1 minute |
| All other endpoints | 120 requests | 1 minute |

Rate limits are keyed by authenticated user ID or by IP for unauthenticated requests.

### Account Lockout

After 5 failed login attempts within 15 minutes, the account is temporarily locked. Lockout state is persisted to `lockout.json` in the data directory and survives server restarts. Expired entries are pruned on startup. No configuration is needed.

### Session Management

- Access tokens expire after 15 minutes and are refreshed automatically. Refresh tokens expire after 7 days of inactivity.
- Single-session enforcement is active — logging in from a new browser or TUI revokes the previous session. Only one active session per user is allowed.
- Weaver Solo+/Fabrick tiers default to SQLite sessions (persistent across restarts). Free tier uses in-memory sessions. Override with `SESSION_STORE_TYPE` if needed.

### CSP Headers

The backend sets a Content Security Policy via Helmet. If you add external resources (CDN fonts, analytics), update the CSP directives in the backend configuration. The `upgrade-insecure-requests` directive is disabled at the app level — configure it at the reverse proxy if needed.

### Password Requirements

All passwords must be 14-128 characters with at least one uppercase letter, one lowercase letter, one digit, and one special character.

### Password Reset

If the only admin has lost their password and has root access on the host:

```bash
sudo weaver-reset-password
```

This prompts for a username and new password, updates the password hash directly, and clears any lockout state.

For the full security checklist, see [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md) § Security Checklist.

---

## Backup & Restore

*Available: v1.0+*

All persistent state lives in the data directory (`/var/lib/weaver` on NixOS, or the path set by `VM_DATA_DIR`).

### What to Back Up

| File | Description | Critical? |
|------|------------|-----------|
| `users.json` | User accounts, bcrypt password hashes, roles | Yes |
| `audit-log.json` | Audit trail of all user actions | Yes |
| `vms.json` | VM registry and metadata | Yes |
| `network-config.json` | Network configuration | Yes |
| `custom-distros.json` | User-defined distribution templates | Yes |
| `sessions.db` + WAL/SHM | SQLite session store (premium tiers) | No (users re-auth) |
| `distro-catalog.json` | Cached curated distro catalog | No (auto-refreshed) |
| `lockout.json` | Account lockout state | No (auto-pruned) |

For backup scripts, automated backup with cron/systemd timers, and restore procedures, see [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md) § Backup and Restore.

---

## Monitoring & Health

*Available: v1.0+*

### Health Endpoint

`GET /api/health` is public (no authentication required) and returns:

```json
{
  "status": "healthy",
  "timestamp": "2026-02-12T12:00:00.000Z",
  "service": "weaver",
  "tier": "premium",
  "tierExpiry": "2027-01-15T00:00:00.000Z",
  "tierGraceMode": false
}
```

Use this for uptime monitoring, load balancer health checks, and alerting:

```bash
curl -sf http://localhost:3100/api/health > /dev/null || echo "Weaver is down"
```

### Host Information (Weaver Solo+ Admin)

Weaver Solo/Team admins can view detailed host metrics in Settings under "Host Information":

- NixOS version
- CPU topology (sockets, cores, threads, cache hierarchy, virtualization type)
- Disk usage per mount point with capacity warnings
- Network interfaces with state and MAC address
- Live metrics: free RAM, load averages (1m, 5m, 15m)

### Log Locations

Weaver logs to the systemd journal with structured JSON output in production.

```bash
# Live log stream
sudo journalctl -u weaver -f

# Last 100 lines
sudo journalctl -u weaver -n 100

# Errors only
sudo journalctl -u weaver -p err
```

Set `LOG_LEVEL` to control verbosity: `fatal`, `error`, `warn`, `info` (default/recommended), `debug`, `trace`.

### What to Monitor

- Health endpoint availability and response time
- Service status: `systemctl is-active weaver`
- Disk usage on the data directory (especially if running many VMs)
- Journal error rate: `journalctl -u weaver -p err --since "1 hour ago" | wc -l`
- WebSocket connectivity (client-side reconnection events)

For full monitoring guidance, see [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md) § Monitoring.

---

## Upgrade Procedures

*Available: v1.0+*

### NixOS (Flake)

```bash
# Update the Weaver flake input
nix flake update weaver

# Rebuild the system
sudo nixos-rebuild switch
```

The NixOS module handles service restart automatically. After rebuild, run `gh auth setup-git` if you use the GitHub CLI (the credential helper path goes stale after NixOS rebuilds).

### Version Compatibility

- User data files (`users.json`, `vms.json`, etc.) are forward-compatible. Weaver migrates data automatically on startup when needed.
- NixOS module options may change between major versions. Check the changelog before upgrading.
- The JWT secret must remain the same across upgrades. If it changes, all user sessions are invalidated.

> **Note:** Always back up your data directory before upgrading. See [Backup & Restore](#backup--restore).

---

## Extensions

*Available: v1.1+*

Extensions expand Weaver's capabilities beyond the core workload management features. All extensions are tier-gated — they require at minimum a Weaver Solo license. There is no a la carte extension purchasing; extensions are included with the appropriate tier.

### Extension Categories

| Category | Version | Description |
|----------|---------|-------------|
| **Containers** | v1.1+ | Docker, Podman, and Apptainer workload visibility and management |
| **Auth Extensions** | v1.1+ | SSO (SAML/OIDC) and FIDO2/WebAuthn authentication |
| **DNS Management** | v1.1+ | Internal DNS for workload service discovery |
| **Firewall & TLS** | v1.2+ | Managed nftables profiles and TLS certificate management |
| **Hardening** | v1.2+ | Security hardening profiles for workloads |
| **GPU Inventory** | v1.2+ | GPU detection, assignment, and monitoring |
| **AI Credential Vault** | v1.4+ | Centralized admin-managed AI provider keys |
| **Secrets Management** | v1.5+ | Encrypted secret injection into workloads |
| **Templates** | v2.0+ | Workload templates and disk management |
| **Compliance Export** | v2.2+ | Framework-based compliance report generation |

### TOTP / Multi-Factor Authentication

TOTP is included in Weaver Solo/Team at no additional cost. Free tier does not have MFA. Users with 1Password Technical Accounts at the Weaver tier get TOTP free via OAuth.

---

## Weaver Team Administration

*Available: v2.2+*

Weaver Team adds multi-host awareness through peer monitoring — read-only visibility into up to 2 other Weaver hosts without requiring a full Fabrick fleet.

### Peer Registration

Register remote Weaver instances as peers to monitor their workload health and status from your dashboard. Peers are discovered via Tailscale or manual URL entry.

### Tailscale Discovery

When running on a Tailscale network, Weaver can automatically discover other Weaver instances on the tailnet. Discovered peers appear as candidates for registration.

### Limitations

- Maximum of 2 peers per Weaver Team instance.
- Peer access is read-only — you can view remote workload status but cannot start, stop, or modify remote workloads.
- For full remote workload management, upgrade to Fabrick.

---

## Fabrick Administration

*Available: v2.3+*

Fabrick is the multi-host fleet control plane. Each host runs Weaver; Fabrick orchestrates the fleet.

### Fleet Overview

The Fabrick page provides an aggregate view of all enrolled hosts showing health status, workload counts, resource utilization, and host kind (on-prem, cloud, remote, IoT). Click a host card to drill into that host's workloads.

### Host Enrollment

Enroll hosts into the fleet by deploying Weaver with a Fabrick-tier license key on each host. Hosts register with the fleet control plane and appear on the Fabrick overview page.

### Warp Patterns (v2.5+)

Warp is the desired-state management surface. A warp pattern defines what a host type should look like: which workloads, which bridges, which GPU assignment, which snapshot policy. Warp detects configuration drift and supports blue/green pattern deployment.

### Fleet Virtual Bridges (v3.0+)

Fleet virtual bridges span multiple hosts using overlay transport (VXLAN for datacenter, WireGuard for edge). They replace the need for separate CNI plugins, ingress controllers, and deployment tools. Each fleet bridge maps 1:1 to a workload group — the compliance boundary IS the network isolation boundary.

### Workload Groups (v3.3+)

Compliance boundaries that scope workloads, users, and AI policy. Each group can have compliance framework tags (HIPAA, PCI-DSS, CMMC), an AI policy (allow-all, claude-only, local-only, none), and IdP/LDAP group mapping. Creating a group automatically creates its fleet bridge.

---

## TUI Administration

*Available: v1.0+*

Weaver includes a terminal-based interface (TUI) for managing workloads over SSH without a browser.

### Connecting

```bash
# Connect to a running Weaver instance
npm run start:tui -- --host http://your-host:3100

# Demo mode (offline, mock data)
npm run start:tui -- --demo
```

> **Note:** Complete the initial admin setup via the web UI before using the TUI. The TUI requires an existing account to authenticate.

### Credentials

TUI credentials are stored in `~/.config/weaver/`. The TUI uses the same JWT authentication as the web UI, and single-session enforcement applies — logging in via the TUI revokes any existing web session for that user.

### Tier Display

The TUI displays the current license tier in the status bar. Tier-gated features are enforced at the backend — the TUI respects the same restrictions as the web UI.

### JSON Export

Export workload data as JSON for scripting and automation:

```bash
npm run start:tui -- --export
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Arrows / j / k | Navigate workload list |
| s | Start selected workload |
| S | Stop selected workload |
| r | Restart selected workload |
| d | Open workload detail |
| a | Invoke AI agent |
| q | Quit |

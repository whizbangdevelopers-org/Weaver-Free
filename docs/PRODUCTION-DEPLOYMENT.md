<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Production Deployment Guide

This guide covers deploying Weaver in production environments. Weaver is a NixOS-native application — the NixOS module is the only supported deployment method.

## Table of Contents

- [System Requirements](#system-requirements)
- [NixOS Deployment](#nixos-deployment-primary-method)
- [Security](#security)
- [Backup and Restore](#backup-and-restore)
- [Monitoring](#monitoring)

---

## System Requirements

| Requirement | Minimum |
| --- | --- |
| Operating System | NixOS 25.11+ |
| Node.js | 24.x (bundled by Nix — no manual install required) |
| RAM | 2 GB+ (Weaver application + workload provisioning) |
| CPU | 2 vCPU |
| Disk | 1 GB for Nix store dependencies + application data |
| Network | Port 3100 (default service port) |

For workload provisioning, the host also needs:

- KVM support (`/dev/kvm`) for QEMU hardware acceleration
- A network bridge interface for VM connectivity
- IP forwarding enabled

QEMU and cdrkit are provided automatically by the NixOS module.

> **Pre-flight check:** Run `./scripts/preflight-check.sh` before installing to verify hardware readiness, including BIOS settings (VT-x/AMD-V, IOMMU). See [COMPATIBILITY.md](COMPATIBILITY.md) for the full compatibility matrix, architecture support, cloud provider compatibility, and BIOS configuration reference.
>
> **Post-install diagnostics:** Use `GET /api/system/doctor` (admin only) to run a comprehensive system health check after installation.

### NixOS Channel Strategy

Weaver targets NixOS stable releases. We test against the current stable channel and update the minimum version on a predictable cadence aligned with the NixOS release cycle.

**Release cadence:** NixOS publishes two stable releases per year -- `YY.05` (May) and `YY.11` (November).

| Time Frame | Action | Example (2026--2027) |
|------------|--------|----------------------|
| Month 5 (May) | New stable drops. Begin testing against it. Update flake examples and docs to reference new channel. Minimum stays at prior stable. | Test against 26.05, docs show `nixos-26.05`, minimum remains 25.11 |
| Month 11 (Nov) | Next stable drops. Bump minimum to the *previous* stable (now N-1). Users on older channels have had 6 months to upgrade. | Minimum bumps to 26.05, docs show `nixos-26.11` |

This gives users a full release cycle (6 months) of overlap before their channel falls below the minimum.

**Unstable / `nixpkgs-unstable`:** Not tested or supported. NixOS stable provides reproducible builds — the same flake input always produces the same system. Unstable updates packages daily, which breaks this guarantee: the Node.js version, system libraries, or service defaults can change between any two evaluations. This directly impacts compliance posture — reproducible builds are a prerequisite for configuration control requirements in NIST 800-171, SOC 2, HIPAA, and PCI DSS. If you cannot demonstrate that two builds from the same source produce identical outputs, audit evidence for change management and system integrity controls is undermined. Use NixOS stable for production deployments. Support and warranty coverage under the [Terms of Service](TERMS-OF-SERVICE.md) apply only to supported configurations (NixOS stable channel, documented system requirements).

---

## NixOS Deployment (Primary Method)

The NixOS module in `nixos/default.nix` provides a fully declarative deployment. It builds the frontend and backend into a single Nix package, creates a systemd service, and handles user/group creation, firewall rules, and sudo permissions.

### Flake-Based Installation (Recommended)

Add the dashboard as a flake input:

```nix
# flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    weaver.url = "github:whizbangdevelopers-org/Weaver-Free";
  };

  outputs = { nixpkgs, weaver, ... }: {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      modules = [
        weaver.nixosModules.default
        {
          services.weaver = {
            enable = true;
            host = "127.0.0.1";
            port = 3100;
            jwtSecretFile = "/run/secrets/weaver-jwt";
            initialAdminPasswordFile = "/run/secrets/weaver-admin-pw";
          };
        }
      ];
    };
  };
}
```

### Non-Flake Installation

```nix
# /etc/nixos/configuration.nix
{ ... }:
{
  imports = [
    /path/to/weaver/nixos/default.nix
  ];

  services.weaver = {
    enable = true;
    host = "127.0.0.1";
    port = 3100;
    jwtSecretFile = "/run/secrets/weaver-jwt";
    initialAdminPasswordFile = "/run/secrets/weaver-admin-pw";
  };
}
```

### Complete Configuration Reference

```nix
services.weaver = {
  # --- Core ---
  enable = true;                      # Enable the service
  port = 3100;                        # API server port (default: 3100)
  host = "127.0.0.1";                # Bind address (default: 127.0.0.1)
  openFirewall = false;               # Open firewall for the dashboard port (default: false)
  package = weaver;        # Override the package derivation

  # --- Data Storage ---
  dataDir = "/var/lib/weaver";  # Persistent data directory (default)
  storageBackend = "json";            # VM registry backend: "json" or "sqlite" (default: "json")

  # --- Authentication ---
  # JWT secret — REQUIRED for production (tokens survive restarts)
  # Use jwtSecretFile for secret management; jwtSecret for inline (not recommended)
  jwtSecret = null;                   # Direct JWT secret string (avoid in production)
  jwtSecretFile = null;               # Path to file containing JWT secret

  # Initial admin account — created on first run when no users exist
  initialAdminPassword = null;        # Direct password string (avoid in production)
  initialAdminPasswordFile = null;    # Path to file containing initial admin password

  # --- Licensing ---
  licenseKey = null;                  # License key string (WVR-<tier>-<payload>-<checksum>)
  licenseKeyFile = null;              # Path to file containing license key
  licenseHmacSecret = null;           # HMAC secret for license key validation
  premiumEnabled = false;             # DEPRECATED: use licenseKey instead

  # --- Service Identity ---
  serviceUser = "weaver";  # System user for the service (default: dedicated user)
  serviceGroup = "weaver"; # System group for the service (default: dedicated group)

  # --- VM Provisioning (enabled by default, sets up bridge/NAT) ---
  provisioningEnabled = true;         # VM creation/management (bridge, NAT, IP forwarding)
  microvmsDir = "/var/lib/microvms";  # Storage directory for MicroVM flakes and disks
  bridgeInterface = "br-microvm";    # Bridge interface name for VM networking
  bridgeGateway = "10.10.0.1";       # Gateway IP on the VM bridge (host-side)

  # --- Optional ---
  distroCatalogUrl = null;            # Remote URL to refresh the curated distro catalog
};
```

### Secrets Management

Weaver uses file-based secret injection — secrets are read from files at runtime, never stored in the Nix store. The NixOS module provides `jwtSecretFile`, `initialAdminPasswordFile`, and `licenseKeyFile` options that point to files owned by the `weaver` system user.

We recommend [sops-nix](https://github.com/Mic92/sops-nix) for encrypting secrets at rest in your NixOS configuration repository. Secrets are decrypted to `/run/secrets/` at boot and are never written to the Nix store.

#### sops-nix Configuration

```nix
{ config, ... }:
{
  sops.secrets."weaver/jwt-secret" = {
    owner = "weaver";
    group = "weaver";
  };
  sops.secrets."weaver/admin-password" = {
    owner = "weaver";
    group = "weaver";
  };
  sops.secrets."weaver/license-key" = {
    owner = "weaver";
    group = "weaver";
  };

  services.weaver = {
    enable = true;
    jwtSecretFile = config.sops.secrets."weaver/jwt-secret".path;
    initialAdminPasswordFile = config.sops.secrets."weaver/admin-password".path;
    licenseKeyFile = config.sops.secrets."weaver/license-key".path;
  };
}
```

### Systemd Service Details

The NixOS module creates a systemd service named `weaver`:

```bash
# Check service status
sudo systemctl status weaver

# View logs
sudo journalctl -u weaver -f

# Restart the service
sudo systemctl restart weaver
```

**Service properties:**

| Property | Value |
| --- | --- |
| Service name | `weaver.service` |
| Type | `simple` |
| User/Group | `weaver` / `weaver` (default) |
| Working directory | `/var/lib/weaver` (default dataDir) |
| Restart policy | `on-failure` with 10-second delay |
| Dependencies | `network.target` |

The service sets `NODE_ENV=production` and configures structured JSON logging (no pino-pretty in production).

### Reverse Proxy with Nginx

*Available: v1.0+ (manual configuration for Free/Solo). Weaver Team and Fabrick will auto-provision TLS and reverse proxy as part of the NixOS module.*

Weaver binds to `127.0.0.1` by default — it only accepts connections from localhost. For external access, place it behind a reverse proxy that handles TLS termination. This keeps TLS certificates, HTTPS negotiation, and HSTS enforcement at the proxy layer, not in the application.

The NixOS module for nginx provides a declarative configuration:

```nix
services.nginx = {
  enable = true;
  virtualHosts."weaver.example.com" = {
    forceSSL = true;
    enableACME = true;
    locations."/" = {
      proxyPass = "http://127.0.0.1:3100";
      proxyWebsockets = true;  # Required for real-time status updates
      extraConfig = ''
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
      '';
    };
  };
};

# CORS is same-origin by default — no configuration needed when nginx
# serves both the frontend and API on the same domain.
```

### Workload Management

Weaver Free works out of the box — it scans your host, discovers existing VMs, and gives you a dashboard to monitor, start, stop, and restart them. No bridge configuration, no provisioning setup, no license key required.

#### Live Provisioning (Weaver Solo+)

With a Solo or higher license, Weaver can create and manage new workloads directly from the browser. When provisioning is enabled, the NixOS module automatically configures:

- KVM group membership for the service user
- MicroVMs storage directory (`/var/lib/microvms` by default)
- Sudo rules for TAP interface management and IP commands
- Bridge networking (`br-microvm` with gateway `10.10.0.1`)
- NAT for VM internet access (iptables MASQUERADE)
- IP forwarding (`net.ipv4.ip_forward = 1`)
- QEMU and cdrkit in the service PATH

To customize bridge settings:

```nix
services.weaver = {
  enable = true;
  provisioningEnabled = true;
  bridgeInterface = "br-microvm";  # default
  bridgeGateway = "10.10.0.1";    # default
  microvmsDir = "/var/lib/microvms"; # default
};
```


---

## Security

### Built-In Protections (All Tiers)

Weaver includes these security controls out of the box — no configuration required:

- **Authentication** — JWT-based, bcrypt cost factor 13. No default credentials; first-run creates the admin account.
- **Password policy** — 14+ characters, uppercase + lowercase + digit + special character. Enforced at registration and password change.
- **Account lockout** — Progressive delay after 3 failed attempts, full lockout at 5. State persists across restarts.
- **Rate limiting** — All endpoints rate-limited (auth: 10/min, mutations: 30/min, AI agent: 5–30/min by tier, all others: 120/min). Keyed by user ID or IP.
- **Role-based access** — Admin / Operator / Viewer roles enforced server-side on every route.
- **Input validation** — Zod schemas on all API request bodies, params, and query strings.
- **Error sanitization** — Internal paths and system details never returned in API responses.
- **Command injection prevention** — All system commands via `execFile` with argument arrays, never shell execution.
- **Security headers** — HSTS (1 year), CSP frame-ancestors `'none'`, X-Content-Type-Options, X-Frame-Options via Helmet.
- **Localhost binding** — Service binds to `127.0.0.1` by default; not directly accessible from the network.
- **Audit logging** — All auth events (login, logout, register, password change, role change, user delete) recorded with user ID, timestamp, and action.
- **Request body limit** — 1 MB maximum, enforced by Fastify.

### Production Hardening (Weaver Solo+)

*Complete this checklist when deploying with a Solo or higher license:*

#### Secrets

- [ ] **Generate a strong JWT secret** — `openssl rand -hex 64`. Use `jwtSecretFile` to inject from a file (see § Secrets Management above).
- [ ] **Set initial admin password via file** — Configure `initialAdminPasswordFile` so the admin account is created on first run. Change the password via the UI after first login.
- [ ] **Use sops-nix for all secrets** — License keys, JWT secrets, and admin passwords should be encrypted at rest in your NixOS configuration repository.

#### Network

- [ ] **TLS via reverse proxy** — Run behind nginx with ACME for automatic certificate management (see § Reverse Proxy above). *Weaver Team and Fabrick will auto-provision this.*
- [ ] **Firewall** — Only expose port 443 (nginx). Keep Weaver's port 3100 on localhost. On NixOS, leave `openFirewall = false`.

#### Persistence

- [ ] **Session store** — Solo+ uses SQLite sessions (persistent across restarts). Ensure the data directory has correct permissions.
- [ ] **Data directory** — Mode `0700` owned by the service user. The NixOS module sets this automatically.
- [ ] **Secrets files** — Mode `0600` owned by root or the service user.

#### Logging

- [ ] **Log rotation** — The systemd journal handles rotation by default. No additional configuration needed for standard deployments.

---

## Backup and Restore

*Weaver v2.4 introduces built-in scheduled backup with snapshot management. The procedures below cover manual backup for v1.x deployments.*

### Weaver Free

All persistent state is JSON files in the data directory (`/var/lib/weaver`). JSON writes are atomic — no service stop required for a consistent backup.

| File | Description |
| --- | --- |
| `users.json` | User accounts (usernames, bcrypt password hashes, roles) |
| `audit-log.json` | Audit trail of all user actions |
| `vms.json` | VM registry (discovered VMs and metadata) |

Back up with a simple archive:

```bash
tar -czf /var/backups/weaver-$(date +%Y%m%d).tar.gz -C /var/lib/weaver .
```

### Weaver Solo+

Solo adds provisioning data, session persistence, and secrets. Back up the data directory plus MicroVM storage:

| File | Description |
| --- | --- |
| `users.json` | User accounts |
| `audit-log.json` | Audit trail |
| `vms.json` | VM registry (provisioned + discovered) |
| `custom-distros.json` | User-defined VM distribution templates |
| `network-config.json` | Bridge and network configuration |
| `sessions.db` | SQLite session store (persistent across restarts) |
| `sessions.db-wal` | SQLite write-ahead log |
| `/var/lib/microvms/` | MicroVM flakes and disk images |

SQLite sessions benefit from a clean shutdown. For a consistent backup:

```bash
sudo systemctl stop weaver
tar -czf /var/backups/weaver-$(date +%Y%m%d).tar.gz \
  -C /var/lib/weaver . \
  -C / var/lib/microvms
sudo systemctl start weaver
```

For zero-downtime backup, use SQLite's online backup instead of stopping the service:

```bash
sqlite3 /var/lib/weaver/sessions.db ".backup /var/backups/sessions-$(date +%Y%m%d).db"
tar -czf /var/backups/weaver-$(date +%Y%m%d).tar.gz -C /var/lib/weaver .
```

### Automated Backup (NixOS Timer)

```nix
systemd.services.weaver-backup = {
  description = "Backup Weaver data";
  serviceConfig = {
    Type = "oneshot";
    ExecStart = "/usr/local/bin/backup-weaver.sh";
  };
};

systemd.timers.weaver-backup = {
  wantedBy = [ "timers.target" ];
  timerConfig = {
    OnCalendar = "daily";
    Persistent = true;
  };
};
```

### Restore

```bash
# 1. Stop the service
sudo systemctl stop weaver

# 2. Preserve current data
sudo mv /var/lib/weaver /var/lib/weaver.old

# 3. Create fresh data directory
sudo mkdir -p /var/lib/weaver
sudo chown weaver:weaver /var/lib/weaver
sudo chmod 750 /var/lib/weaver

# 4. Extract the backup
sudo tar -xzf /var/backups/weaver-YYYYMMDD.tar.gz -C /var/lib/weaver

# 5. Fix ownership
sudo chown -R weaver:weaver /var/lib/weaver

# 6. Restart and verify
sudo systemctl start weaver
curl -s http://localhost:3100/api/health | jq .
```

---

## Monitoring

### Health Endpoint

The `GET /api/health` endpoint is public (no authentication required) and returns:

```json
{
  "status": "healthy",
  "timestamp": "2026-02-12T12:00:00.000Z",
  "service": "weaver",
  "tier": "free",
  "tierExpiry": null,
  "tierGraceMode": false
}
```

Use this endpoint for uptime monitoring, load balancer health checks, and alerting:

```bash
# Simple health check
curl -sf http://localhost:3100/api/health > /dev/null || echo "Weaver is down"

# Check with jq
curl -s http://localhost:3100/api/health | jq -e '.status == "healthy"'
```

### Logging

Weaver uses Pino for structured JSON logging via the systemd journal. No file-based log configuration needed — journald handles rotation, persistence, and filtering.

```bash
# Live log stream
sudo journalctl -u weaver -f

# Errors only
sudo journalctl -u weaver -p err

# JSON output for log aggregation
sudo journalctl -u weaver -o json
```

Set log verbosity via the NixOS module or `LOG_LEVEL` environment variable:

| Level | What it captures |
| --- | --- |
| `info` | Startup, requests, provisioning events (recommended) |
| `warn` | Warnings only — reduces log volume |
| `debug` | Detailed troubleshooting |

### Common Issues

#### Port 3100 already in use

A previous instance didn't shut down cleanly.

```bash
sudo lsof -ti:3100 | xargs -r sudo kill
sudo systemctl restart weaver
```

#### Permission denied on data directory

```
EACCES: permission denied, open '/var/lib/weaver/users.json'
```

The data directory is not owned by the service user. The NixOS module sets this automatically, but after a rebuild you may need to re-apply:

```bash
sudo systemd-tmpfiles --create
sudo systemctl restart weaver
```

#### WebSocket status updates not working

If real-time workload status doesn't update, verify your reverse proxy passes WebSocket connections. The nginx configuration in § Reverse Proxy above handles this. If using a different proxy, ensure it supports WebSocket upgrades on the `/ws/` path.

#### AI agent returns generic responses

Weaver's AI diagnostics require an API key. Without one, the agent uses mock responses to demonstrate the feature.

- **Free tier**: Enter your own API key (BYOK) in the AI diagnostics dialog
- **Solo+**: Configure a server-side API key via the Settings page

#### JWT secret missing (Solo+)

```
[auth] JWT_SECRET or JWT_SECRET_FILE is required in production
```

Set `jwtSecretFile` in the NixOS module, pointing to a file managed by sops-nix (see § Secrets Management above).

#### License key not recognized (Solo+)

The license key format is `WVR-<tier>-<payload>-<checksum>`. Verify the key file is readable by the `weaver` service user and the file path in `licenseKeyFile` is correct. Contact support if the key was provided by whizBANG Developers and does not activate.

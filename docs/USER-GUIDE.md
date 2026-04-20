<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->

# Weaver User Guide

## Introduction

Weaver is a web-based management interface for workloads running on NixOS hosts. It manages MicroVMs (hardware-isolated virtual machines) and containers (Docker, Podman, Apptainer) from a single interface. A MicroVM is a container with a hardware boundary instead of a namespace boundary — Weaver manages both uniformly.

This guide is for **all users** — administrators, operators, and viewers — who use Weaver daily. It covers every page and feature you will encounter in the web interface. Installation, NixOS configuration, and backend administration are covered separately in the Admin Guide.

**Feature tiers:** Weaver has four tiers — Free, Solo, Team, and Fabrick. Each section in this guide notes which tier and version introduced the feature. Tier-gated features show an upgrade prompt in the UI when your license does not include them.

---

## Table of Contents

1. [Logging In](#logging-in)
2. [Navigation](#navigation)
3. [Weaver Page — Workload Management](#weaver-page--workload-management)
4. [Workload Detail Page](#workload-detail-page)
5. [Creating Workloads — Shed](#creating-workloads--shed)
6. [Serial Console](#serial-console)
7. [AI Diagnostics](#ai-diagnostics)
8. [Network Topology — Strands](#network-topology--strands)
9. [Tags and Search](#tags-and-search)
10. [Keyboard Shortcuts](#keyboard-shortcuts)
11. [Notifications](#notifications)
12. [Settings](#settings)
13. [Understanding Status Badges](#understanding-status-badges)
14. [Containers](#containers)
15. [Fabrick Fleet View](#fabrick-fleet-view)
16. [Loom — Fleet Topology](#loom--fleet-topology)
17. [Warp — Fleet Configuration](#warp--fleet-configuration)
18. [TUI Client](#tui-client)
19. [FAQ](#faq)

---

## Logging In

*Available: v1.0+*

Navigate to your Weaver instance in a browser (for example, `http://your-host:3100`). You will see a login page with username and password fields.

### First-Run Setup

When no user accounts exist, the login page automatically switches to a "Create Admin Account" form. The first account created always receives admin privileges. After setup, subsequent users must be created by an admin from the Users page.

### Session Management

Access tokens expire after 15 minutes. Weaver refreshes your session automatically in the background — you will not be interrupted unless the refresh token itself expires (7 days) or you have been idle too long. **Single-session enforcement** is active at all tiers — logging in from a new browser or TUI revokes your previous session. Only one active session per user is allowed.

### Logging Out

Click your username in the top-right corner of the header to open the user menu. Your current role is displayed as a colored badge (purple for Admin, teal for Operator, grey for Viewer). Click **Logout** to end your session.

### Forgotten Password

Contact your administrator. If you are the only admin and have root access on the host, a command-line password reset script is available.

> **Note:** Role changes take effect immediately. If an admin changes your role, your active session is invalidated and you must log in again.

---

## Navigation

*Available: v1.0+*

The sidebar provides access to all pages. On screens narrower than large desktop size, the sidebar collapses behind a hamburger menu button.

### Sidebar Layout

**Operational pages:**

| Page | Icon | Description | Availability |
|------|------|-------------|--------------|
| **Fabrick** | Grid | Multi-host fleet control plane | v2.3+, Fabrick tier |
| **Loom** | Spider web | Fleet host-to-host topology | v3.0+, Fabrick tier |
| **Warp** | Texture | Fleet host configuration patterns | v2.5+, Fabrick tier |
| **Weaver** | Grid | Manage workloads (VMs and containers) | v1.0+, all tiers |
| **Strands** | Network | Local network topology | v1.0+, all tiers |

**Creation:**

| Page | Icon | Description | Availability |
|------|------|-------------|--------------|
| **Shed** | Door | Create new workloads and browse templates | v2.0+, Admin/Operator only |

**Utility pages:**

| Page | Icon | Description | Availability |
|------|------|-------------|--------------|
| **Users** | People | Manage user accounts | Admin only |
| **Groups** | Folder | Workload groups and compliance boundaries | v3.3+, Fabrick tier |
| **Audit Log** | Search | Activity history | v1.0+, Fabrick tier, Admin only |
| **Extensions** | Puzzle | Extension catalog (AI, DNS, security, backup) | v1.1+, all tiers |
| **Settings** | Gear | AI provider, preferences, host config | v1.0+, all tiers |
| **Help** | Question | Guides, FAQ, keyboard shortcuts | v1.0+, all tiers |

### The Textile Metaphor

Weaver uses a textile naming convention throughout the product:

- **Strands** — individual threads of local network connectivity
- **Loom** — the fleet structure where strands are woven together
- **Weaver** — the tool that manages it all
- **Fabrick** — the finished fleet fabric (note the spelling with k)
- **Shed** — the opening where new threads enter the loom
- **Warp** — the lengthwise threads that define the pattern (host configurations)

### Role-Based Visibility

Not all pages are visible to all users. The **Shed** page is hidden for Viewer and Auditor roles — they cannot create workloads. The **Users** page requires Admin role. The **Audit Log** requires Admin role and Fabrick tier. Buttons for actions you cannot perform (start, stop, delete) are also hidden based on your role.

> **Tip:** Your current role appears as a badge next to your username in the header. If you need elevated permissions, contact your administrator.

---

## Weaver Page — Workload Management

*Available: v1.0+*

The Weaver page is the main page. It displays all workloads as cards in a responsive grid layout.

### Workload Cards

Each card shows:

- **Name** — the workload identifier, with a type icon (server or desktop)
- **Status badge** — color-coded status (see [Understanding Status Badges](#understanding-status-badges))
- **IP address** — the network address assigned to the workload
- **vCPU count** — number of virtual CPUs allocated
- **Memory** — allocated RAM in MB
- **Hypervisor** — the virtualization backend (QEMU, Cloud Hypervisor, etc.)
- **Tags** — assigned labels (up to 3 visible, with overflow count)
- **Description** — optional text description

Click any card to open its [Workload Detail Page](#workload-detail-page).

### Workload Actions

Running workloads show **Stop** and **Restart** buttons. Stopped workloads show a **Start** button. A **Delete** button appears for Admin users on paid tiers. Actions are hidden if your role does not permit them.

### Scanning for Workloads

If no workloads are registered, an empty state appears with two options:

- **Scan for Workloads** — discovers NixOS-declared MicroVMs (`microvm@*` systemd services) and containers on your host, then adds them to Weaver automatically
- **Create VM** — navigate to the Shed page to provision a new MicroVM via Live Provisioning (Weaver Solo+)

> **Note:** Weaver supports two approaches to MicroVMs. On **all tiers**, NixOS-declared MicroVMs (defined in your NixOS configuration) offer lighter hypervisors, shared filesystems, and declarative reproducibility — Weaver monitors and controls them. On **Weaver Solo+**, Live Provisioning lets you create MicroVMs with any guest OS directly from the browser — no rebuild, no terminal. See the Admin Guide for details.

### Filtering and Sorting

*Containers: v1.1+*

When containers are present, filter chips appear at the top of the page:

- **All** — show all workloads (VMs and containers)
- **VMs** — show only MicroVMs
- **Docker** — show only Docker containers
- **Podman** — show only Podman containers
- **Apptainer** — show only Apptainer containers (Weaver Solo+)

Use the **sort dropdown** (next to the grid/list toggle) to sort workloads by name, status, or manual order. Select "Manual (drag)" to enable drag-and-drop reordering — drag handles appear on each card. Your custom order persists across sessions in browser localStorage.

Toggle between **grid view** and **list view** using the buttons next to the sort dropdown.

### Remote Workloads

*Available: v2.2+*

On Weaver Team tier, workloads from remote peer hosts appear alongside local workloads. Remote workloads display a purple **host badge** with the originating hostname. These are read-only — you can view their status but cannot control them from a peer host.

### Bulk Operations

*Available: v2.3+, Fabrick tier*

On Fabrick tier, selection checkboxes appear on each VM card. Select multiple VMs and use the bulk action bar to start, stop, or restart them all at once.

### Host Information Strip

A strip at the top of the Weaver page shows basic host facts: hostname, IP address, CPU core count, total RAM, and KVM status. If KVM hardware acceleration is not detected, a warning banner appears — VMs run significantly slower without it.

---

## Workload Detail Page

*Available: v1.0+*

Click any workload card on the Weaver page to open its detail view. A "Back to Weaver" link returns you to the main page.

### Header Section

The header displays the workload name, an editable description field, tags, and the current status badge. Provisioning state badges appear when relevant (Provisioning, Failed, Destroying, Registered).

### Action Buttons

Action buttons appear based on your role and the workload state:

- **Start** — start a stopped workload (Operator, Admin)
- **Stop** — stop a running workload (Operator, Admin)
- **Restart** — restart a running workload (Operator, Admin)
- **Delete** — remove the workload and clean up resources (Admin, paid tiers)

> **Free-tier limits (v1.0.2+):** Weaver Free controls the **alphabetical-first 10 workloads** and a **64 GB total running memory ceiling**. Workloads beyond 10 are visible in your list but start/restart actions return "outside your managed set" — they're read-only at Free tier. Stop stays allowed regardless, so you can shut down any running workload. Upgrade to Weaver Solo to lift both caps. If a specific workload sorts outside the top 10, you can rename it in your NixOS config to bring it into the controllable set.
- **Clone** — duplicate the workload configuration (v1.1+, paid tiers)
- **Migrate** — move the workload to another host (v2.3+ cold migration, v3.0+ live migration, Fabrick tier)

AI action buttons are always visible:

- **Diagnose** — analyze issues and suggest fixes
- **Explain** — describe what the workload does
- **Suggest** — recommend optimizations

### Info Cards

Below the header, info cards display key specifications:

- IP address
- Memory (MB)
- vCPUs
- Disk size (GB), if allocated
- Hypervisor type
- Distribution, if applicable
- Uptime, if running

### Resource Metrics

*Available: v1.1+*

CPU, memory, and disk I/O charts appear below the info cards with configurable time windows.

### Tabs

Five tabs provide detailed information:

| Tab | Content |
|-----|---------|
| **Configuration** | VM settings: name, hypervisor, memory, vCPUs, disk, distribution, autostart, cloud-init, bridge |
| **Networking** | IP address, bridge, MAC address, and connectivity details |
| **Logs** | Provisioning output and system logs |
| **Console** | Serial terminal for running VMs (see [Serial Console](#serial-console)) |
| **AI Analysis** | History of past AI diagnostics (see [AI Diagnostics](#ai-diagnostics)) |

### GPU and Firewall Information

*Available: v1.2+*

On paid tiers at v1.2+, the detail page shows GPU passthrough information (if a GPU is assigned) and firewall rule visibility.

---

## Creating Workloads — Shed

*Available: v2.0+*

The Shed page is the unified workload creation surface. Navigate to it from the sidebar (Admin and Operator roles only). Prior to v2.0, workload registration and creation were accessed from buttons on the Weaver page.

### Tabs

Shed has three tabs:

- **Custom** — create or register individual workloads
- **Templates** — browse and deploy pre-configured workload templates
- **Migrate** — migration helpers for moving workloads between hosts

### Custom Tab

The Custom tab shows cards for different workload types:

**Register Existing VM** — Track an existing systemd-managed MicroVM (for example, `microvm@name.service`) without provisioning it. This is for VMs already managed outside Weaver. Available on all tiers.

**Custom MicroVM** (Weaver Solo+) — Configure a hardware-isolated VM from scratch. Choose a distribution, set memory, vCPUs, IP address, disk size, and hypervisor. Cloud distributions use QEMU with cloud images and cloud-init. ISO distributions boot from a downloaded ISO for manual installation (useful for Windows).

**Container** (v2.0+ registration, v2.1+ creation) — Create or register Docker, Podman, or Apptainer containers. At v2.0, only registration of existing containers is available. Full container creation (image, port mappings, environment variables) arrives at v2.1.

**GPU Workload** (Weaver Solo+) — Create a VM or container with dedicated GPU via VFIO-PCI passthrough. Supports NVIDIA, AMD, and Intel GPUs.

### Templates Tab

*Available: v2.0+*

The template catalog shows pre-configured workload definitions organized by category:

- **Web servers** — Nginx, Caddy
- **Databases** — PostgreSQL, MariaDB
- **Monitoring** — Prometheus, Grafana
- **Security** — Pi-hole, Vaultwarden
- **Automation** — Node-RED
- **Load balancing** — HAProxy

Browse templates by category, search by name, and deploy with one click. Templates specify the distribution, resources, and cloud-init configuration automatically.

> **Note:** Free-tier users can browse the template catalog but cannot deploy. A tier upgrade prompt appears when attempting to deploy.

### Hypervisor Options

When creating a VM, you will choose a hypervisor:

- **QEMU** — most versatile; supports all distributions, desktop mode (VGA/VNC), cloud images, and Windows guests
- **Cloud Hypervisor**, **crosvm**, **kvmtool** — lighter alternatives for NixOS guests only
- **Firecracker** — not available (incompatible with NixOS MicroVMs)

> **Tip:** When in doubt, choose QEMU. It supports the widest range of guest operating systems.

---

## Serial Console

*Available: v1.0+*

The serial console provides a terminal interface to a running VM directly in your browser.

### Accessing the Console

1. Open a workload's detail page by clicking its card on the Weaver page.
2. Click the **Console** tab.
3. The terminal connects to the VM's serial console output.

### Usage

The console displays text output from the VM and accepts keyboard input. You can log in, run commands, and inspect logs as if you were connected via a physical serial cable.

> **Note:** The serial console requires the VM to be running. If the VM is stopped, the console tab will indicate that no connection is available. Desktop-mode VMs (VGA/VNC) use a separate graphical console.

---

## AI Diagnostics

*Available: v1.0+*

Weaver includes AI-powered analysis for workload diagnostics. Three actions are available for each workload:

- **Diagnose** — analyze issues and suggest fixes
- **Explain** — describe what the workload does and its configuration
- **Suggest** — recommend performance and security optimizations

### Triggering Analysis

There are several ways to start an AI analysis:

1. Click the **stethoscope icon** on any workload card for a quick Diagnose.
2. Open a workload detail page and use the **Diagnose**, **Explain**, or **Suggest** buttons.
3. View past analyses in the **AI Analysis** tab on the detail page.

### API Key Configuration

AI features work in two modes:

- **Mock mode** — when no API key is configured, AI features return sample responses. This is useful for evaluation and exploring the interface without cost.
- **Live mode** — configure an API key in Settings to get real AI analysis.

### BYOK (Bring Your Own Key)

BYOK lets you use your own API key instead of a server-configured one. Your key is stored in your browser's localStorage and sent with each request. The server never stores your key.

If your administrator has configured a server-side key, it is available to Weaver Solo+ license holders. Free-tier users must provide their own key via Settings.

### Vendor Selection

Weaver supports multiple AI vendors. Configure your preferred vendor in Settings under the AI Provider section.

### Rate Limits

AI requests are rate-limited per user to protect AI infrastructure:

| Tier | Limit |
|------|-------|
| Free | 5 requests/minute |
| Weaver Solo/Team | 10 requests/minute |
| Fabrick | 30 requests/minute |

---

## Network Topology — Strands

*Available: v1.0+*

The Strands page displays an interactive graph of your host's network topology — bridges, VMs, and containers connected to each bridge.

### What the Topology Shows

- **Host node** — your NixOS machine, displayed at the center
- **Bridge nodes** — network bridges (for example, `br-microvm`) derived from running workloads
- **Workload nodes** — VMs and containers attached to each bridge
- **Edges** — connections between workloads and their bridges
- **Cross-bridge routes** — dashed lines showing routing between different bridges

### Interacting with the Graph

- **Zoom** — scroll wheel or pinch to zoom in and out
- **Pan** — click and drag the background to move the view
- **Click a node** — select it to see details
- **Double-click a workload** — navigate to its detail page

### Topology Colors and Badges

Workload nodes are color-coded by status (green for running, grey for stopped, etc.). Bridge nodes use infrastructure colors. On Fabrick tier at v3.0+, bridge nodes show fleet bridge membership badges.

### Container Topology

*Available: v1.2+*

At v1.2+, Docker and Podman bridge clusters appear on the topology with container nodes, giving a complete view of your local network fabric.

### Remote Peer Hosts

*Available: v2.2+*

On Weaver Team tier, workloads from remote peer hosts appear on the topology with dashed remote-service edges.

---

## Tags and Search

*Available: v1.0+*

### Applying Tags

Tags are labels you assign to workloads for organization. To add or edit tags on a workload:

1. Open the workload's detail page.
2. Use the **tag editor** below the workload name (Admin and Operator roles).
3. Type a tag name and press Enter to add it.

Viewers see tags as read-only chips.

### Managing Tags Centrally

Admins can manage tags in **Settings > Tag Management**. This section shows all tags in use with workload counts. You can rename a tag across all workloads or delete a tag from all workloads in bulk.

### Search

Use the search bar in the toolbar to filter workloads by name. The search is available on the Weaver page, Strands page, and Fabrick page. On mobile, tap the magnifying glass icon to open the search field.

---

## Keyboard Shortcuts

*Available: v1.0+*

Global keyboard shortcuts let you navigate quickly. Shortcuts are ignored when focus is in a text input, textarea, or dropdown.

| Shortcut | Action |
|----------|--------|
| `?` | Open the Help page |
| `d` | Go to the Weaver page |
| `s` | Go to Settings |
| `t` | Go to Strands (network topology) |
| `n` | Create a new VM |

---

## Notifications

*Available: v1.0+*

### Notification Bell

The bell icon in the toolbar shows a badge with the count of unread notifications. Click it to open the notification panel where you can:

- Mark individual notifications as read
- Dismiss notifications with the X button
- Select multiple notifications for bulk actions (mark read or delete)
- Use "Mark all read" to clear the badge count
- Use "Clear all" to remove all notifications

### Push Notification Channels

*Available: v1.0+, Weaver Solo+*

Admins can configure push notification channels in **Settings > Notifications**. Supported channels:

| Channel | Description |
|---------|-------------|
| **ntfy** | Push notifications via ntfy service |
| **Email (SMTP)** | Email alerts to specified addresses |
| **Webhook** | HTTP requests with Slack, Discord, and PagerDuty format support |
| **Web Push** | Browser push notifications |

### Notification Events

Events are grouped into four categories:

- **VM events** — started, stopped, failed, recovered
- **Provisioning events** — provisioned, provision-failed
- **Resource alerts** — high CPU, high memory
- **Security events** — auth failure, unauthorized access, permission denied

Each channel can subscribe to any combination of events. Use the "Test" button when adding a channel to verify delivery.

---

## Settings

*Available: v1.0+*

Access Settings from the sidebar. The Settings page contains several sections:

### AI Provider

Configure your AI vendor and API key. When no key is configured, AI features operate in mock mode with sample responses. BYOK keys are stored in your browser only.

### Custom Distributions

Add custom cloud image distributions by providing a short name, full name, image URL (or local file path), format, and cloud-init support flag. Built-in distributions can be overridden if their image URL becomes stale.

### Tag Management

*(Admin only)* View all tags in use with workload counts. Rename or delete tags in bulk.

### Host Information

The host information strip shows hostname, IP, CPU cores, total RAM, and KVM status. On Weaver Solo/Team, admins can view detailed host metrics including CPU topology, disk usage, network interfaces, and live load.

### Host Configuration Viewer

A read-only view of the NixOS `configuration.nix` file. Workload definitions are categorized in a sidebar: MicroVMs, OCI containers, Slurm nodes, and Infrastructure. Click any section to jump to its definition. Available to all authenticated users at all tiers.

### Notification Channels

*(Admin, Weaver Solo+)* Configure push notification channels (ntfy, email, webhook, web push) and manage event subscriptions.

### Help Preferences

Toggle contextual help tooltips on or off. When disabled, the small help icons next to form fields and buttons are hidden.

### License

View your current tier badge, tier description, and expiry information.

### Distribution and Image URLs

View the health status of all distribution image URLs. Valid URLs show a green check; broken URLs show a red X. Admins can update broken URLs directly.

> **Tip:** Weaver validates distribution image URLs daily using HEAD requests. Check this section if VM provisioning fails due to image download errors.

---

## Understanding Status Badges

*Available: v1.0+*

Every workload displays a color-coded status badge. Statuses update in real-time via WebSocket every 2 seconds.

| Status | Color | Meaning |
|--------|-------|---------|
| **Running** | Green | Workload is active and responding |
| **Stopped** | Grey | Workload is not running |
| **Failed** | Red | Workload encountered an error |
| **Provisioning** | Blue (with spinner) | Workload is being created or configured |
| **Destroying** | Orange (with spinner) | Workload is being removed |
| **Unknown** | Yellow | Status could not be determined |
| **Registered** | Grey | Workload is tracked but not yet started |

### WebSocket Indicator

The toolbar displays a WebSocket status chip:

- **Green "WebSocket"** — live connection active; statuses update in real-time
- **Red "WebSocket Offline"** — no connection; statuses are stale

> **Note:** If the WebSocket indicator stays red, check that the backend service is running and accessible.

---

## Containers

*Available: v1.1+*

Weaver manages Docker, Podman, and Apptainer containers alongside MicroVMs on the same interface.

### How Containers Appear

Containers are auto-detected from runtimes running on the host. They appear as cards on the Weaver page with:

- **Runtime badge** — Docker (blue), Podman (teal), or Apptainer (purple)
- **Port mappings** — exposed ports
- **Resource metrics** — CPU and memory usage
- **Labels** — container labels as tags

Use the filter chips at the top of the Weaver page to focus on a specific runtime.

### Container vs MicroVM

A MicroVM runs its own kernel inside a hardware-isolated virtual machine — stronger isolation, suitable for compliance-sensitive workloads. A container shares the host kernel via namespaces — lighter and faster, suitable for general workloads. Weaver manages both with the same interface, API, and bridge routing.

### Container Actions

Container management actions (start, stop, create, remove) require Weaver Solo tier or higher. Free-tier users can view container status but cannot control them.

### Apptainer

Apptainer (SIF format, for HPC and research workloads) requires Weaver Solo tier. It appears alongside Docker and Podman in the filter chips when Apptainer containers are detected.

---

## Fabrick Fleet View

*Available: v2.3+, Fabrick tier*

The Fabrick page is the fleet control plane — an aggregate view of all enrolled hosts.

### Fleet Overview

Each host appears as a card showing:

- Health status (online, degraded, offline)
- Workload count
- Resource utilization (CPU, memory)
- Host kind (on-prem, cloud, remote, IoT)

### Drill-Down

Click a host card to drill into that host's workloads. A breadcrumb in the header shows `FabricK > hostname`. The Weaver page and Strands page then display data for the selected host. Click the FabricK title in the header to return to the fleet view.

### Search

The toolbar search bar on the Fabrick page searches across hosts and workloads.

---

## Loom — Fleet Topology

*Available: v3.0+, Fabrick tier*

Loom is the fleet topology view. It shows all hosts in the fleet with their interconnections.

### What Loom Shows

- **Host nodes** — on-prem, cloud, remote, and IoT hosts
- **WireGuard tunnel edges** — solid lines showing encrypted host-to-host tunnels
- **Cross-host service edges** — dashed lines showing workload-to-workload service connections across hosts

### Logical View

The Loom page has a **Tunnels / Fleet Bridges** toggle. The logical view shows fleet virtual bridges as hub nodes with host nodes radiating outward. Edges display traffic weights and cordon status. Click a fleet bridge to open its detail drawer.

### Fleet Virtual Bridges

A fleet virtual bridge is a logical network bridge spanning multiple hosts, backed by overlay transport (VXLAN or WireGuard). Each fleet bridge maps 1:1 to a workload group — the network isolation boundary matches the compliance boundary.

### Navigation

Double-click a host node to navigate to the Fabrick overview for that host.

### Legend

The header displays a legend for edge types:

- **Solid white line** — host tunnel
- **Dashed orange line** — cross-host service

---

## Warp — Fleet Configuration

*Available: v2.5+, Fabrick tier*

Warp is the fleet host configuration surface. It manages configuration patterns across hosts in your Fabrick fleet.

### What Warp Does

- **Pattern versioning** — track and version host configuration templates
- **Blue/green deployment** — roll out configuration changes to a subset of hosts before fleet-wide application
- **Drift detection** — identify hosts that have diverged from their assigned configuration pattern

### Navigation

Access Warp from the sidebar. It is visible only to Fabrick-tier users.

---

## TUI Client

*Available: v1.0+*

Weaver includes a terminal-based user interface (TUI) for managing workloads over SSH without a browser.

### Connecting

```
npm run start:tui -- --host http://your-host:3100
```

Complete the initial admin setup via the web UI before using the TUI. Credentials are stored in `~/.config/weaver/`.

### Navigation

| Key | Action |
|-----|--------|
| Arrow keys / `j`/`k` | Navigate the workload list |
| `s` | Start selected workload |
| `S` | Stop selected workload |
| `r` | Restart selected workload |
| `d` | Open workload detail |
| `a` | Run AI agent analysis |
| `q` | Quit |

### JSON Export

Use `--export` to output workload data as JSON for scripting and automation.

### Tier Display

The TUI mirrors all web UI features: workload list, detail view, AI agent, network topology, settings, users, audit log, and fleet bridges. Tier restrictions are enforced identically — the backend API is the authoritative gatekeeper regardless of client.

---

## FAQ

### What is the WebSocket indicator in the header?

The Live/Offline chip shows whether the dashboard has an active WebSocket connection to the backend. When connected (green), workload statuses update in real-time every 2 seconds. When offline (red), the dashboard cannot receive live updates.

### Why is my VM stuck in "Provisioning" state?

VM provisioning can take several minutes, especially when downloading large cloud images. Check the Logs tab on the workload detail page for progress. If provisioning fails, the status changes to "Failed" with an error message.

### Can I use Weaver on mobile?

Yes. Weaver is a Progressive Web App (PWA) and works on mobile browsers. The responsive layout adapts to smaller screens. You can install it as a home screen app for a native-like experience.

### Is dark mode supported?

Yes. Click the sun/moon icon in the top-right toolbar to cycle between light mode, dark mode, and auto (follows system preference). Your choice persists across sessions.

### What distributions are supported?

Built-in distributions include Arch Linux, Fedora, Ubuntu, Debian, and Alpine. Cloud distributions use QEMU with cloud images and cloud-init. ISO distributions boot from a downloaded ISO for manual installation (for example, Windows). You can also add custom distributions in Settings.

### Can I run Windows as a guest?

Yes. Add a custom distribution in Settings with your Windows ISO URL and set Guest OS to "Windows." When creating a VM, select the Windows distribution — QEMU and desktop mode (VNC) are automatically enabled. Install Windows manually via the VNC console. Windows 10 and Server 2016+ are supported. Windows VMs use IDE disk and e1000 networking for driver-free installation.

> **Note:** Windows 11 requires UEFI, which is not yet supported.

### Can I run macOS as a guest?

Weaver does not currently support macOS guests. Apple's license agreement restricts macOS to Apple-branded hardware, and the specialized QEMU configuration required is not yet implemented.

### What are the API rate limits?

| Endpoint Category | Limit |
|-------------------|-------|
| Auth (login, register, refresh) | 10 requests/minute |
| VM mutations (start, stop, restart, create, delete) | 30 requests/minute |
| AI agent requests | 5–30/minute (tier-dependent) |
| All other endpoints | 120 requests/minute |

When a limit is exceeded, you receive a 429 response. Wait a moment and try again.

### How do I export my VM configurations?

The API provides a free-tier endpoint for exporting workload configurations as JSON:

```bash
# Export all workloads
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/workload/export | jq .

# Export a single workload
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3100/api/workload/web-nginx/export | jq .
```

The export includes name, IP, memory, vCPUs, hypervisor, distribution, tags, and bridge configuration.

### What if a cloud image URL is broken?

Weaver validates all distribution image URLs daily using HEAD requests. Go to **Settings > Distributions & Image URLs** to see which URLs are valid (green check) or broken (red X). Admins can click the edit icon to update a broken URL. When provisioning fails due to a broken URL, the error banner includes a "Fix in Settings" shortcut.

### How do I keep the NixOS store clean?

Each `nixos-rebuild` creates a new generation, and the Nix store grows over time. Use the `nh` (nix-helper) tool to garbage-collect old generations:

1. Add `nh` to your `environment.systemPackages`.
2. Run: `nh clean all --keep 3` — removes all generations except the 3 most recent.
3. Schedule it periodically (for example, a weekly systemd timer) to keep disk usage in check.

### What happens when a license expires?

After expiry, your tier features remain accessible in read-only mode for a 30-day grace period. A warning banner appears in Settings during this time. After 30 days, the instance downgrades to Free tier.

### What is Live Provisioning?

Live Provisioning is the core Weaver Solo+ differentiator — creating and managing VMs dynamically via the API and UI without running `nixos-rebuild switch` on the host. A one-time NixOS setup, then zero host rebuilds forever.

---

*Copyright 2026 whizBANG Developers LLC. All rights reserved.*
*Weaver Free: AGPL-3.0. Solo/Team/Fabrick: BSL-1.1. AI Training Restriction applies to all tiers. See LICENSE.*

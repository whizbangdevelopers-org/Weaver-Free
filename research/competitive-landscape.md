<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Competitive Analysis

**Last updated:** 2026-02-08

## The Landscape at a Glance

| Platform | Type | VM Model | Declarative? | NixOS? | License | Scale |
|---|---|---|---|---|---|---|
| **Weaver** | Lightweight web UI | microvm.nix (QEMU) | **Nix-native** | **Purpose-built** | MIT | Single host |
| **Proxmox VE** | Full platform | KVM + LXC | Imperative (Terraform opt.) | No (Debian appliance) | AGPLv3 | Cluster (32 nodes) |
| **Cockpit** | System admin panel | libvirt/KVM | Imperative | Partial (community) | LGPL | Single host |
| **Harvester** | Cloud-native HCI | KubeVirt (K8s CRDs) | **K8s YAML** | No | Apache 2.0 | Multi-cluster |
| **Incus** | Container/VM mgr | LXC + QEMU | Profiles/preseed | **Excellent** | Apache 2.0 | Cluster |
| **XCP-ng / Xen Orchestra** | Full platform | Xen | Imperative (Terraform opt.) | No | GPL | Multi-pool |
| **vSphere** | Enterprise platform | ESXi | Imperative (Terraform opt.) | No | Proprietary ($$$) | Datacenter |
| **oVirt / RHEV** | Enterprise KVM mgmt | KVM | Imperative | No (EOL) | Apache 2.0 | Datacenter |
| **WebVirtCloud** | Lightweight KVM panel | libvirt/KVM | Imperative | No | Apache 2.0 | Multi-host |

---

## Where Weaver Stands Out

### 1. Fully Declarative, Nix-Native VMs

This is the biggest differentiator. Every other platform (except Harvester with K8s CRDs) manages VMs imperatively — you click "Create VM" in a web UI. Weaver VMs are defined in Nix expressions in `microvm-host.nix`, reproducible and version-controlled. Proxmox requires Terraform as a bolt-on to achieve anything similar. The approach is closer to Harvester's philosophy but with Nix instead of Kubernetes.

### 2. Zero Overhead

Proxmox is a full Debian appliance that replaces your OS. vSphere requires dedicated ESXi hosts. Harvester needs a Kubernetes cluster. Weaver is a single systemd service + nginx vhost on an existing NixOS machine. It's closer to Cockpit in weight class but purpose-built for microvm.nix.

### 3. NixOS Integration

No other platform is designed for NixOS. Cockpit-machines isn't even properly packaged in nixpkgs. Incus has good NixOS support but manages its own VM lifecycle outside of Nix. Weaver directly wraps `systemctl microvm@*`, meaning the NixOS configuration is the single source of truth.

---

## Competitor Deep Dives

### Proxmox VE

- **What it is:** Open-source server virtualization platform managing both KVM VMs and LXC containers through a unified web interface. Built on Debian with a custom kernel.
- **Key features:** Dual virtualization (KVM + LXC), clustering (up to 32 nodes via Corosync), high availability with automatic VM migration, integrated Ceph/ZFS/LVM storage, SDN via Linux Bridge and Open vSwitch, live migration, integrated backup, noVNC/SPICE console.
- **Tech stack:** Debian 12, Linux 6.8+, KVM/QEMU 9.2, LXC 6.0, RESTful JSON API with JSON Schema, WebSocket-based VNC console.
- **VM definition:** Imperative (API/UI). Terraform provider available for declarative workflows.
- **Licensing:** AGPLv3 (fully open source, all features free). Optional subscriptions from EUR 95/year per CPU socket for enterprise repo access and support.
- **NixOS support:** None. Proxmox is a complete Debian-based appliance.

### Cockpit (cockpit-machines)

- **What it is:** Red Hat's lightweight web-based server administration tool with VM management via the cockpit-machines plugin.
- **Key features:** System monitoring/configuration, VM CRUD via libvirt, browser-based VM console, storage/network pool management, multi-admin (CLI and UI simultaneously).
- **Tech stack:** libvirt backend, web UI on port 9090, D-Bus integration.
- **VM definition:** Imperative through libvirt XML definitions created via the UI.
- **Licensing:** LGPL v2.1+ (free). Included in RHEL Web Console.
- **NixOS support:** Limited. cockpit-machines not officially packaged (nixpkgs issue #287644). NixVirt provides better declarative libvirt integration.

### Harvester (SUSE Virtualization)

- **What it is:** Cloud-native hyperconverged infrastructure (HCI) built on Kubernetes, unifying VM and container workloads using KubeVirt.
- **Key features:** VMs as Kubernetes CRDs, GitOps-native, Rancher integration for multi-cluster, Longhorn distributed storage, immutable OS (SLE Micro), edge-optimized.
- **Tech stack:** Kubernetes foundation, KVM via KubeVirt, Longhorn storage, Kubernetes API + VirtualMachine CRDs.
- **VM definition:** **Declarative** via Kubernetes CRDs (`VirtualMachine` resources in YAML). GitOps-friendly natively.
- **Licensing:** Apache 2.0 (free). Optional SUSE support subscriptions.
- **NixOS support:** None directly, but Kubernetes foundation is inherently declarative.

### Incus

- **What it is:** Modern system container and VM manager, forked from Canonical's LXD. Unified experience for containers and VMs.
- **Key features:** Dual workloads (containers + VMs), reusable profiles, complete REST API, image management, clustering, multiple storage backends (ZFS, Btrfs, LVM, Ceph).
- **Tech stack:** Go daemon, LXC for containers, QEMU/KVM for VMs, optional React web UI.
- **VM definition:** **Declarative** via profiles and preseed YAML. REST API for imperative operations.
- **Licensing:** Apache 2.0 (no CLA, fully open source). Forked from LXD after Canonical's license/CLA changes.
- **NixOS support:** **Excellent.** Official NixOS module (`virtualisation.incus.preseed`), active community, documented examples.

### XCP-ng / Xen Orchestra

- **What it is:** Turnkey open-source virtualization platform based on Xen hypervisor + XAPI. Xen Orchestra provides the web management UI.
- **Key features:** Type-1 Xen hypervisor, agentless management via XO, continuous replication and incremental backups, live migration, Terraform/Packer/Ansible integration.
- **Tech stack:** Xen hypervisor (bare metal), XAPI, Open vSwitch, Xen Orchestra (Node.js web app).
- **VM definition:** Imperative via XO UI/CLI/API. Terraform provider available.
- **Licensing:** GPLv2/LGPLv2+/BSD (XCP-ng), open source (XO, can build from source). Commercial support from Vates starting at $2,000/year.
- **NixOS support:** Limited. Package request exists (nixpkgs issue #301991).

### VMware vSphere / vCenter (Broadcom)

- **What it is:** Industry-leading commercial virtualization platform. vCenter provides centralized management for ESXi hosts.
- **Key features:** Enterprise datacenter virtualization, vMotion live migration, HA with automatic failover, DRS (Distributed Resource Scheduler), vSAN storage, NSX networking.
- **Tech stack:** ESXi Type-1 hypervisor, vCenter management server, vSphere Web Services API + REST Automation API.
- **VM definition:** Imperative with Terraform provider for IaC.
- **Licensing:** Proprietary, subscription-only (Broadcom eliminated perpetual licenses). Major price increases (350-450% for SMBs). 72-core minimums (later reduced to 16). 20% late-renewal penalty.
- **NixOS support:** None.

### oVirt / RHEV

- **What it is:** Enterprise-grade open-source KVM management platform. **Development ceased; maintenance mode until 2026.**
- **Key features:** Enterprise scale (400 hosts/cluster), admin/user portals, live migration, CPU pinning/NUMA, disaster recovery, noVNC with WebSocket proxy.
- **Tech stack:** KVM, VDSM daemon (Python), oVirt Engine (centralized RHEL server), RESTful API, SPICE console.
- **Licensing:** Apache 2.0 (oVirt), commercial (RHEV). End-of-life.
- **NixOS support:** Not applicable (EOL).

### WebVirtCloud

- **What it is:** Lightweight libvirt-based web interface for managing KVM VMs with user delegation.
- **Key features:** User delegation, multi-hypervisor management, noVNC console, cloud-init support, SSH key management.
- **Tech stack:** Django (Python), libvirt API, Supervisor process manager, noVNC, FastAPI (WebVirtCompute).
- **VM definition:** Imperative. Some cloud-init YAML support.
- **Licensing:** Apache 2.0 (free).
- **NixOS support:** Limited. Could work with NixOS libvirt but no specific integration.

---

## Where Others Are Ahead

### Feature Depth (Proxmox)

- Live migration between cluster nodes
- Built-in backup/restore (Proxmox Backup Server)
- HA with automatic failover
- noVNC/SPICE console in the browser
- Storage management (Ceph, ZFS, LVM, iSCSI)
- Firewall management per VM
- User/role/permission system (LDAP, OIDC)
- Template/clone workflows
- Mature REST API with JSON Schema

Weaver v0.1.0 has: list, start, stop, restart, WebSocket status. The gap is enormous, which is expected for an MVP.

### Modern Architecture (Harvester)

- Kubernetes CRDs mean VMs are managed like any other K8s resource
- GitOps-native (ArgoCD/Flux can manage VM lifecycle)
- Rancher integration for multi-cluster
- Built-in Longhorn distributed storage

The Nix-native approach is arguably *better* for single-host NixOS, but Harvester's K8s model scales to multi-node declarative VM orchestration.

### Closest Competitor (Incus)

- Runs both containers and VMs (like Proxmox but lighter)
- Has excellent NixOS integration (`virtualisation.incus.preseed`)
- Profiles provide declarative VM templates
- REST API is mature and well-documented
- Clustering support built-in
- Active NixOS community using it

Incus is probably the most direct threat — it's lightweight, works great on NixOS, and handles both containers and VMs. The key difference is that Weaver VMs are defined *in Nix* while Incus VMs are defined in Incus profiles (a parallel config system).

### Console Access

Nearly every competitor provides browser-based VM console access (noVNC or SPICE). Weaver has no console access.

### Resource Monitoring

Proxmox, Cockpit, and vSphere all show CPU/memory/disk/network graphs per VM. Weaver shows running/stopped status only.

---

## The Niche

Weaver occupies a unique position that none of the others fill:

> **A web UI for NixOS users who define VMs declaratively in Nix and just need visibility and basic lifecycle controls.**

The closest alternatives for this niche:
- **Cockpit** — but it's imperative and poorly supported on NixOS
- **Incus** — but it has its own VM definition system separate from Nix
- **Plain systemctl** — which is what people use today (no UI)

---

## Potential Roadmap Priorities

| Feature | Effort | Impact | Competitors That Have It |
|---|---|---|---|
| CPU/memory metrics per VM | Medium | High | All of them |
| VM console (noVNC) | High | High | Proxmox, Cockpit, XCP-ng, oVirt |
| Multi-user auth | Medium | Medium | Proxmox, vSphere, oVirt |
| VM creation from dashboard | Medium | Medium | All (but conflicts with declarative model) |
| Backup/snapshot | High | High | Proxmox, Incus, XCP-ng |
| Logs viewer | Low | Medium | Cockpit |

Note: VM creation from the dashboard is philosophically interesting — in the Weaver model, VMs should be defined in Nix config and rebuilt. Adding "Create VM" in the UI would undermine the declarative principle. Proxmox and friends don't have this constraint.

---

## Bottom Line

Weaver isn't competing with Proxmox — it's serving a completely different audience. Proxmox replaces your OS; Weaver enhances it. The real question is whether NixOS + microvm.nix users (a small but growing audience) want a web UI, or if they're happy with `systemctl` and `machinectl`. The v0.1.0 proves the concept; the next moves should be metrics and console access to make it genuinely more useful than the terminal.

---

## Appendix: Declarative VM Creation — Templates & Building Blocks

### The Opportunity

The "VM creation from dashboard" row in the roadmap above flags a philosophical conflict: imperative UI creation undermines the declarative Nix model. But there's a third path that none of the competitors take:

> **UI -> generate Nix code -> user reviews and rebuilds**

Instead of creating VMs directly (like every other platform), the dashboard would generate correct Nix expressions that the user adds to their configuration. This is declarative with a GUI front-end — a genuinely novel pattern.

### How It Would Work

**Templates** — Pre-built VM archetypes:
- "Web Server" (nginx, 256MB, port 80 forwarded)
- "App Server" (Node/Python, 512MB)
- "Database" (PostgreSQL, 1GB, persistent volume)
- "Dev Environment" (1GB, SSH access)

**Building Blocks** — Composable pieces the user toggles:
- Memory size (slider: 256MB–4GB)
- Network interface (bridge, TAP, IP address)
- Shared filesystem (virtiofs mounts)
- Autostart yes/no
- Hypervisor (QEMU, cloud-hypervisor, firecracker)
- Services to enable (nginx, postgresql, openssh, etc.)

**The Editor** — A split view: form on the left, live-generated Nix code on the right. The user copies (or the dashboard writes) the definition into their config and runs `nixos-rebuild`.

### Competitive Effect

This flips "VM creation" from a weakness to a unique strength:

| Feature | Weaver | Proxmox | Incus | Harvester |
|---|---|---|---|---|
| Create VM from UI | Generates reviewed Nix code | Instant but opaque | Instant but opaque | YAML CRD (closest) |
| Reproducibility | Guaranteed (it's Nix) | Manual export/import | Profile-based | GitOps possible |
| Version control | Automatic (it's in your repo) | Requires Terraform bolt-on | Not native | Requires ArgoCD bolt-on |
| Audit trail | Git history | API logs only | API logs only | K8s events |
| Drift detection | `nixos-rebuild` catches it | None built-in | None built-in | K8s reconciliation |

The narrative shifts from "Weaver can't create VMs" to "Weaver is the only platform where VM creation is reproducible, version-controlled, and auditable by default."

### Strategic Impact

1. **Lowers the barrier to entry.** Adding a VM currently requires knowing Nix syntax, microvm.nix options, and NixOS networking. A template system means someone can get a working VM definition without reading the microvm.nix docs.

2. **Makes the declarative model a selling point.** The "you have to edit Nix files" objection becomes "you get a GUI that writes correct Nix for you."

3. **Opens up an automation pipeline.** If the dashboard can generate Nix, it could also optionally write the definition to a staging file, run `git add` + `nixos-rebuild switch` with a confirmation step, and show a diff — a NixOS-native GitOps workflow in a browser.

4. **Creates a unique category.** Harvester is the closest comparison (declarative VM definitions), but even Harvester's UI creates VMs imperatively — the YAML CRD is a side effect. This approach is code-first by design, GUI-assisted.

### Implementation Estimate

| Component | Effort | Notes |
|---|---|---|
| Template definitions (5–10 archetypes) | Low | JSON/Nix data, not code |
| Building block form UI (Quasar components) | Medium | Sliders, toggles, dropdowns |
| Nix code generator (TypeScript) | Medium | String templating from structured data |
| Live preview editor | Low–Medium | CodeMirror/Monaco with Nix syntax highlighting |
| Copy-to-clipboard | Trivial | Already solved |
| Optional: write-to-file + rebuild trigger | Medium–High | Needs careful security design |

### Risk Considerations

The optional auto-rebuild path needs careful design. Letting a web UI trigger `nixos-rebuild switch` is powerful but dangerous — a bad template could break the system. Mitigations would include:
- Dry-run preview (`nixos-rebuild dry-activate`)
- Git commit before rebuild (rollback point)
- Clear separation between "generate code" (safe) and "apply code" (privileged)

The safe v1 is the editor + templates + copy button. Let the user paste into their config and rebuild manually. That alone is valuable and risk-free.

### Revised Roadmap Priority

With this approach, the roadmap entry changes from:

> | VM creation from dashboard | Medium | Medium | All (but conflicts with declarative model) |

To:

> | VM creation (Nix template editor) | Medium | **High** | None (unique feature) |

---

## Appendix: Template-from-Source — Reverse-Engineering Existing Infrastructure

### The Idea

Appendix A covers building VMs from scratch via templates and building blocks. This appendix covers the reverse direction: creating templates *from things that already exist* — running VMs, git repos, Dockerfiles, or other platform configs.

Every competitor copies **state** (disk images, snapshots). None of them reverse-engineer **intent** from source code. The Weaver approach would be:

> Detect what you need, generate the declarative config, let you customize it.

This is closer to what Heroku, Railway, or Render do for cloud deployment — but outputting Nix instead of running on someone else's infrastructure.

### Source Types

**1. From a running MicroVM** — Inspect an existing VM's Nix definition and extract it as a reusable template. The config already exists in `microvm-host.nix`; the dashboard reads it, parameterizes the unique bits (name, IP, MAC), and saves the skeleton as a named template.

**2. From a git repo** — Point at a repo URL or local path, the dashboard detects the stack (package.json = Node, requirements.txt = Python, Cargo.toml = Rust, go.mod = Go, etc.) and generates a VM definition with the right runtime, memory, and ports. Like a Nix-native Heroku buildpack detection.

**3. From running code / a project directory** — Similar to git repo but local. Scan the directory, detect the stack, suggest a VM config.

**4. From a Dockerfile / docker-compose.yml** — Translate container definitions into MicroVM Nix expressions. Ports, volumes, environment variables, and base image all map to microvm.nix options.

**5. From other platforms** — Import a Proxmox `.conf`, libvirt XML, or Vagrantfile and convert to microvm.nix Nix code.

### What the Competition Offers

| Platform | Create from existing? | How? |
|---|---|---|
| **Proxmox** | Clone existing VM, import OVA/VMDK | Bit-level disk copy, not config-level |
| **Docker** | `docker commit` | Captures filesystem state, not intent |
| **Harvester** | VM templates from existing VMs | K8s CRD export |
| **Incus** | `incus publish` / `incus copy` | Image snapshots |
| **Vagrant** | Vagrantfile (code-first) | Closest to this concept |
| **Weaver** | Detect stack, generate Nix | **Intent-based, not state-based** |

### Examples

**From a git repo:**

User clicks "Create from Repo" and enters a repo URL. The dashboard detects `package.json`, port 3000 in the start script, and `pg` in dependencies:

```nix
microVMs.express-app = {
  vcpu = 2;
  mem = 512;
  hypervisor = "qemu";
  interfaces = [{ type = "tap"; id = "vm-express"; mac = "..."; }];
  nixos = {
    services.openssh.enable = true;
    environment.systemPackages = [ pkgs.nodejs_22 ];
    networking.firewall.allowedTCPPorts = [ 3000 22 ];
    # TODO: configure app deployment method
  };
};
```

**From a Dockerfile:**

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["node", "server.js"]
```

Maps to: Node.js 22 runtime, port 3000 exposed, working directory — all translatable to a Nix VM definition with the right packages and firewall rules.

**From a running VM:**

User clicks "Save as Template" on the `web-nginx` VM. The dashboard reads the existing Nix definition from `microvm-host.nix`, parameterizes name/IP/MAC as variables, and saves it as a "Web Server (nginx)" template available in the building-block editor.

### Strategic Effect

1. **Onboarding from Docker.** The biggest win. Millions of Dockerfiles exist. A "Dockerfile to MicroVM" converter gives Docker users a migration path to NixOS MicroVMs without learning Nix from scratch. No other platform offers this for declarative VM configs.

2. **Self-populating template library.** Every VM you create becomes a potential template. The library grows organically from actual usage rather than being hand-curated. Users could share templates via git.

3. **Stack detection as a feature.** "Point at code, get infrastructure" is what PaaS platforms charge for. Doing it locally with Nix output is genuinely unique.

4. **Migration path from other platforms.** Importing Proxmox or libvirt configs lowers the switching cost for users coming from those platforms to NixOS + microvm.nix.

### Implementation Estimate

| Component | Effort | Notes |
|---|---|---|
| Extract template from running VM | Low | Parse existing Nix, parameterize |
| Stack detection (package.json, etc.) | Medium | Pattern matching on common files |
| Dockerfile parser | Medium–High | Map FROM/EXPOSE/ENV/CMD to Nix |
| docker-compose translator | High | Multi-service, volumes, networks |
| Git repo scanner (clone + detect) | Medium | Combines clone + stack detection |
| Libvirt XML / Proxmox conf import | Medium | Structured format to Nix mapping |
| Template library (save/share/browse) | Medium | JSON storage + UI |

### Risk

Stack detection will never be perfect — it's heuristic. The key is to generate a *starting point* that's 80% right and let the user fix the rest in the Nix editor from Appendix A. The live Nix preview makes this safe: you can see exactly what was generated before applying it.

### Combined Roadmap Entry

With both appendices, the template system becomes a two-part feature:

> | Nix template editor (from scratch) | Medium | **High** | None (unique feature) |
> | Template-from-source (repo/Docker/VM) | Medium–High | **High** | None (unique feature) |

---

## Appendix: n8n as the Deployment Pipeline — Solving the Privilege Problem

### The Problem

Appendices A and B describe generating Nix code from templates, building blocks, and existing sources. The remaining question is: how does that code get applied? Letting a web dashboard directly trigger `nixos-rebuild switch` is dangerous — the dashboard would need sudo access, and a bad template could break the system.

### The Solution: n8n as the Privilege Boundary

n8n is already running on the host (port 5678). Instead of the dashboard having any privileged access, it POSTs generated Nix code to an n8n webhook. n8n owns the entire privileged pipeline: validation, git commit, rebuild, rollback, and notification.

The dashboard **never has sudo access**. It generates code and hands it off.

```
┌─────────────────────────┐     ┌──────────────────────┐     ┌────────────┐
│   Weaver     │     │        n8n           │     │   NixOS    │
│   (Quasar + Fastify)    │     │   (workflow engine)  │     │            │
│                         │     │                      │     │            │
│  Template Editor ───────┼──→  │  Webhook trigger     │     │            │
│  Building Blocks        │     │  ↓ Validate syntax   │     │            │
│  Source Detection       │     │  ↓ Dry-run ──────────┼──→  │ nix-build  │
│                         │     │  ↓ Approval gate     │     │            │
│  Status ←───────────────┼──←  │  ↓ Git commit ───────┼──→  │ git repo   │
│  (WebSocket)            │     │  ↓ Rebuild ──────────┼──→  │ nixos-     │
│                         │     │  ↓ Notify            │     │  rebuild   │
│  VM List / Metrics      │     │  ↓ Error → rollback  │     │            │
└─────────────────────────┘     └──────────────────────┘     └────────────┘
    Port 3100                       Port 5678
    No sudo                         Sudo for rebuild only
```

### The Workflow

**Trigger:** Webhook node receives POST from dashboard:

```json
{
  "vmName": "my-web-app",
  "nixCode": "microVMs.my-web-app = { ... };",
  "action": "create",
  "requestedBy": "admin",
  "dryRunOnly": false
}
```

**Steps:**

1. **Validate Nix syntax** — Run `nix-instantiate --parse` on the generated code. If it fails, return error to dashboard immediately.
2. **Write to staging file** — Write the Nix expression to a staging location (e.g., `/var/lib/weaver/pending/my-web-app.nix`).
3. **Dry-run** — Run `nixos-rebuild dry-activate --flake /home/mark/etc/nixos#king`. If it fails, return error with the build output.
4. **Approval gate** (optional) — n8n "Wait" node that pauses until an admin approves via email link, Slack button, or n8n UI. For trusted templates, this step can be skipped.
5. **Git commit** — `git add` the new file, commit with a message like `weaver: add my-web-app VM`.
6. **Rebuild** — `nixos-rebuild switch --flake /home/mark/etc/nixos#king`.
7. **Report back** — POST result to dashboard callback URL or push via WebSocket.

**Error branch:** If step 6 fails, automatically `git revert HEAD` and rebuild to restore the previous state. Notify the user with the error output.

### Why n8n Is Better Than Building This In-App

| Concern | In-app rebuild | n8n workflow |
|---|---|---|
| Sudo access | Dashboard service needs sudo | Only n8n needs sudo |
| Visibility | Hidden in backend code | Visual workflow the user can inspect and edit |
| Approval gates | Custom code needed | Built-in n8n "Wait" or "Manual Approval" nodes |
| Notifications | Custom code needed | n8n has email, Slack, Telegram, etc. out of the box |
| Error handling | Custom retry/rollback logic | Built-in error branches with visual flow |
| Audit trail | App logs | n8n execution history with full payloads |
| Customizable | Requires code changes + rebuild | User edits the workflow in the browser |
| Rollback | Must implement git revert logic | n8n node runs `git revert` + rebuild in error branch |

### What This Changes Competitively

This turns the "risk" section from Appendices A and B into a **feature**. No competitor has anything like this:

- **Proxmox** — API calls are a black box. No visible deployment pipeline.
- **Harvester** — Kubernetes reconciliation is opaque internals.
- **Incus** — Direct API calls, no workflow engine.
- **vSphere** — Requires vRealize Orchestrator (separate expensive product) for workflow automation.

Weaver would have a **user-visible, user-editable deployment pipeline** with a GUI on both ends: Quasar for the dashboard, n8n for the workflow. The user can see every step, add approval gates, change notification channels, or modify the rollback strategy — all without touching code.

### Extended Use Cases

The same n8n workflow pattern extends beyond VM creation:

- **VM deletion** — Dashboard sends delete request → n8n removes the Nix definition, commits, rebuilds.
- **Config updates** — Change memory/CPU/services on an existing VM → n8n patches the Nix file, validates, rebuilds.
- **Bulk operations** — Create a fleet of VMs from a template → n8n iterates, validates each, commits once, rebuilds once.
- **Scheduled scaling** — n8n cron trigger adjusts VM resources on a schedule (e.g., scale dev VMs down at night).
- **Monitoring alerts** — n8n receives alerts from the dashboard's WebSocket → triggers notifications or auto-restart workflows.

### Implementation Estimate

| Component | Effort | Notes |
|---|---|---|
| Dashboard webhook POST to n8n | Low | Single API call from Fastify |
| n8n workflow (validate → commit → rebuild) | Low–Medium | Visual node editor, no code |
| n8n approval gate | Low | Built-in Wait/Approval node |
| n8n error branch (rollback) | Low | Git revert + rebuild nodes |
| Dashboard status callback (receive result) | Low | WebSocket push or polling |
| n8n workflow template (shareable JSON) | Low | Export from n8n, include in repo |

The total effort drops significantly compared to building the privileged pipeline in the Fastify backend, and the result is more flexible, more visible, and more secure.

### Revised Risk Assessment

With n8n in the pipeline, the risk profile changes fundamentally:

| Risk | Without n8n | With n8n |
|---|---|---|
| Bad template breaks system | Dashboard has sudo, direct damage | n8n dry-runs first, rolls back on failure |
| Unauthorized rebuild | Must secure dashboard endpoint | n8n approval gate blocks unapproved changes |
| No audit trail | Must build logging | n8n execution history is automatic |
| Silent failure | Must build error reporting | n8n error branch notifies immediately |
| Stuck in bad state | Manual recovery needed | Automatic git revert + rebuild |

The safe v1 from Appendix A (editor + templates + copy button) remains valid as a starting point. n8n integration becomes the v2 that enables the full automated pipeline without any privileged code in the dashboard itself.

### Final Combined Roadmap

| Feature | Effort | Impact | Competitors |
|---|---|---|---|
| Nix template editor (from scratch) | Medium | **High** | None (unique) |
| Template-from-source (repo/Docker/VM) | Medium–High | **High** | None (unique) |
| n8n deployment pipeline | Low–Medium | **High** | None (unique) |

---

## Appendix: Gaps & Unexplored Opportunities

The preceding analysis and appendices cover the core competitive positioning, template system, and deployment pipeline. This appendix identifies areas the analysis has not yet explored — both unclaimed advantages and genuine gaps that need strategy.

### Unclaimed Advantages (Things We Have but Haven't Highlighted)

#### 1. Firecracker & Cloud Hypervisor Support

microvm.nix supports **Firecracker** (<125ms boot time) and **Cloud Hypervisor** alongside standard QEMU. No traditional competitor offers these:

| Platform | Hypervisors | Fastest Boot |
|---|---|---|
| **Weaver** | QEMU, Firecracker, Cloud Hypervisor | **<125ms (Firecracker)** |
| **Proxmox** | KVM/QEMU only | Seconds |
| **Incus** | KVM/QEMU only | Seconds |
| **XCP-ng** | Xen only | Seconds |
| **Harvester** | KVM via KubeVirt | Seconds |

Firecracker enables an entirely different use case: **ephemeral, serverless-style VMs** that spin up nearly instantly, run a task, and disappear. This is closer to AWS Lambda's model than traditional virtualization. The building block toggle in Appendix A lists hypervisor selection, but the competitive implications are significant — sub-second VM boot is something no dashboard competitor can offer.

#### 2. NixOS Integration Testing (`nixos-test`)

NixOS provides a hermetic testing framework that can **test VM configurations in CI before deploying them**. A test can:
- Boot the VM definition in a throwaway QEMU instance
- Verify that services start correctly
- Test network connectivity between VMs
- Assert that ports are open, files exist, processes run

No competitor can do this. Proxmox cannot test a VM config before applying it. Harvester cannot validate that a CRD will actually work. vSphere has no pre-deploy verification. This is a massive advantage for infrastructure reliability.

The dashboard could surface test results: "This VM definition was tested in CI and passed 12/12 checks" — giving users confidence before deploying.

#### 3. Atomic Rollback via NixOS Generations

NixOS has built-in atomic rollback via system generations. If a `nixos-rebuild switch` introduces a broken VM, `nixos-rebuild switch --rollback` restores the previous state instantly. The n8n appendix (Appendix C) builds custom rollback logic with `git revert`, but NixOS itself already provides this at the system level.

| Platform | Rollback method | Reliability |
|---|---|---|
| **NixOS / Weaver** | `nixos-rebuild --rollback` (atomic, built-in) | **Guaranteed** |
| **Proxmox** | Restore from backup (manual) | Depends on backup freshness |
| **Incus** | Snapshot restore | Must have taken snapshot first |
| **Harvester** | K8s rollback (if using GitOps) | Depends on GitOps setup |
| **vSphere** | Snapshot or backup restore | Manual process |

This means the n8n pipeline has *two layers* of rollback: git revert (config level) and NixOS generation rollback (system level). No competitor has this depth.

#### 4. Binary Cache / Shared Build Artifacts

Nix's binary cache means VM builds share cached derivations across all VMs on the host. Building a second Node.js VM doesn't re-download or recompile Node.js — it's already in the Nix store. A third VM using nginx reuses the same nginx derivation.

Competitors rely on downloading ISO images, pulling container images, or cloning disk images — all of which duplicate data. The Nix model is inherently deduplicated at the package level.

This also enables **faster iteration**: changing one service in a VM definition only rebuilds the changed parts, not the entire VM image.

#### 5. Reproducibility as Security

Nix's reproducibility eliminates **configuration drift** — an entire class of security vulnerabilities. Every VM is built from the same Nix expression every time, producing bit-for-bit identical results. There is no accumulated state, no forgotten manual patch, no "works on my machine."

| Threat | Traditional VMs | Nix-defined MicroVMs |
|---|---|---|
| Configuration drift | Accumulates over time | **Impossible** (rebuilt from source) |
| Unpatched dependencies | Manual tracking required | Nix flake lock ensures consistency |
| Undocumented changes | Common (SSH in, edit config) | **Cannot happen** (read-only rootfs) |
| Supply chain verification | Difficult | Nix provides hash-verified builds |

This is a security story that no competitor can match and the analysis hasn't told yet.

### Genuine Gaps (Things We Don't Have and Need Strategy For)

#### 6. Multi-Host Management

The comparison table says "Single host" — the biggest scale limitation vs every serious competitor. But there's a Nix-native answer:

**Colmena** or **deploy-rs** can deploy NixOS configurations to multiple hosts from a single flake. The dashboard could manage VMs across multiple NixOS hosts, each running microvm.nix, coordinated through a shared flake repository.

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│   Dashboard     │     │  Host A      │     │  Host B      │
│   (central)     │────→│  microvm.nix │     │  microvm.nix │
│                 │────→│  5 VMs       │     │  5 VMs       │
│   n8n pipeline  │     └──────────────┘     └──────────────┘
│   (deploys to   │────→       ↑                    ↑
│    all hosts)   │     Colmena/deploy-rs    Colmena/deploy-rs
└─────────────────┘            ↑                    ↑
                         Shared flake.nix ──────────┘
```

This is architecturally different from Proxmox clustering (shared storage, live migration) but solves the same user need: managing VMs across multiple machines from one place. It also maintains the declarative model — all hosts are defined in the same flake.

| Feature | Effort | Impact |
|---|---|---|
| Multi-host VM listing (read-only) | Medium | High |
| Multi-host deploy via Colmena/deploy-rs | Medium–High | High |
| Cross-host network visualization | High | Medium |

#### 7. Networking Visualization & Management

Proxmox has SDN, per-VM firewalls, and VLAN management. The dashboard currently shows nothing about networking. But all networking *is already declared in Nix* — bridges, TAP interfaces, IP addresses, firewall rules.

A **network topology view** could visualize what's already in the config:
- Bridge `br-microvm` at 10.10.0.1/24
- TAP interfaces per VM with assigned IPs
- Firewall rules (which ports are open on which VM)
- NAT masquerade from host to outside

This would be low effort (read existing Nix config, render as a graph) and unique — no competitor shows a declarative network map because their networks aren't declarative.

| Feature | Effort | Impact |
|---|---|---|
| Network topology visualization | Low–Medium | High |
| Firewall rule viewer per VM | Low | Medium |
| IP address management / conflict detection | Medium | Medium |

#### 8. Storage & Persistent Data

microvm.nix uses **virtiofs** (shared filesystem from host) — fundamentally different from Proxmox's block storage model. The tradeoffs are:

| Aspect | microvm.nix (virtiofs) | Proxmox (block storage) |
|---|---|---|
| Setup complexity | Low (share host dirs) | High (LVM/Ceph/ZFS) |
| Performance | Good (near-native) | Varies by backend |
| Snapshots | Via host filesystem (ZFS/Btrfs) | Built-in per storage type |
| Live migration | Not supported (host-bound) | Supported (shared storage) |
| Backup | Standard host backup tools | Proxmox Backup Server |

The dashboard could show:
- Which host directories are shared with which VMs
- Disk usage per shared mount
- Whether the host filesystem supports snapshots (ZFS/Btrfs)

This isn't a gap that needs to be "closed" — it's a different model that should be explained and visualized.

#### 9. Community Template Ecosystem

Proxmox has ~100+ turnkey templates. Docker has Docker Hub (millions of images). Where would Weaver templates live?

Options:
- **Git repositories** — Templates as `.nix` files in a community repo (simplest, fits the Nix model)
- **FlakeHub** — Templates published as flake outputs, discoverable via flakehub.com
- **NUR** — Templates in the Nix User Repository (already used for the dashboard package itself)
- **In-dashboard registry** — Curated list with one-click import into the template editor

The self-populating model from Appendix B (save running VM as template) combined with git-based sharing would create an organic ecosystem. A `microvm-templates` repo with community contributions, discoverable from the dashboard, would be the Nix-native equivalent of Docker Hub.

| Feature | Effort | Impact |
|---|---|---|
| Template export as `.nix` file | Low | Medium |
| Community template repo (GitHub) | Low | High |
| In-dashboard template browser | Medium | High |
| FlakeHub integration | Medium | Medium |

#### 10. Cost / TCO Comparison

The analysis never compares costs, but the numbers strongly favor Weaver:

| Platform | Hardware | Software License | Ongoing Cost |
|---|---|---|---|
| **Weaver** | Existing NixOS machine | Free (MIT) | $0 |
| **Proxmox** | Dedicated server(s) | Free (AGPLv3) | EUR 95+/yr for enterprise repo |
| **vSphere** | Dedicated ESXi hosts | Thousands/yr (Broadcom) | $$$$ |
| **Cloud VMs** (AWS/GCP/Azure) | None (rented) | N/A | $50–500+/mo per VM |
| **Harvester** | Dedicated K8s nodes (3+ min) | Free (Apache 2.0) | $0 software, significant hardware |

For homelab users and small teams already running NixOS, the Weaver is the only option with zero additional cost and zero additional hardware. Post-Broadcom, organizations actively seeking VMware alternatives would find this compelling.

#### 11. AI-Assisted VM Creation

An LLM generating Nix code from natural language would complement the template editor from Appendix A:

> "I need a VM running PostgreSQL 16 with 2GB RAM, daily backups, and only accessible from the 10.10.0.0/24 subnet"

The LLM generates the Nix expression, the user reviews it in the split-view editor, adjusts if needed, and deploys via n8n. This combines:
- Appendix A (editor with live Nix preview)
- Appendix B (intent detection, but from human language instead of code)
- Appendix C (n8n pipeline for safe deployment)

No competitor has this. Proxmox's UI requires knowing which options to click. Harvester requires knowing K8s YAML syntax. Natural language to Nix is a lower barrier than any of them.

| Feature | Effort | Impact |
|---|---|---|
| LLM-powered Nix generation (API integration) | Medium | High |
| Prompt templates for common patterns | Low | Medium |
| Validation of LLM output (nix-instantiate) | Low | High (safety) |

### Summary: Revised Complete Roadmap

Combining all appendices and this gap analysis, the full opportunity set is:

**Already unique (highlight more):**

| Feature | Effort | Impact | Status |
|---|---|---|---|
| Firecracker sub-second boot | N/A (already supported) | **High** | Unclaimed advantage |
| NixOS integration testing | Low (document + surface) | **High** | Unclaimed advantage |
| Atomic rollback (NixOS generations) | N/A (built-in) | **High** | Unclaimed advantage |
| Binary cache / deduplication | N/A (built-in) | Medium | Unclaimed advantage |
| Reproducibility as security | N/A (built-in) | **High** | Unclaimed advantage |

**New unique features (from appendices):**

| Feature | Effort | Impact |
|---|---|---|
| Nix template editor | Medium | **High** |
| Template-from-source | Medium–High | **High** |
| n8n deployment pipeline | Low–Medium | **High** |
| AI-assisted VM creation | Medium | High |

**Close the gaps:**

| Feature | Effort | Impact |
|---|---|---|
| CPU/memory metrics per VM | Medium | **High** |
| VM console (noVNC) | High | **High** |
| Network topology visualization | Low–Medium | High |
| Multi-host management (Colmena) | Medium–High | High |
| Community template ecosystem | Low–Medium | High |
| Storage/mount visualization | Low | Medium |
| Cost/TCO comparison (docs/marketing) | Low | Medium |
| Multi-user auth | Medium | Medium |

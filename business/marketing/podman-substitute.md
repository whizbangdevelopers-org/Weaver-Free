<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver — Weaver as the Podman Visual Layer
## Positioning Brief — v1.1.0 Container Visibility

**Last updated:** 2026-03-24

> **Status:** v1.1.0 shipping — Docker + Podman visibility live. Apptainer = Weaver.
> **Decision ref:** Decision #54 (Podman substitute positioning confirmed 2026-03-13) · Decision #55 (Weaver name confirmed 2026-03-13)
>
> **Product name:** The unified container+VM management capability arc is **Weaver**. Sales description: *"Weaver is the loom that creates your infrastructure fabric — containers and VMs woven into one managed structure."* A loom is the machine that *makes* fabric; Weaver is the tool that weaves containers and VMs together. The name is intentionally from the textile industry (like "fabric" in computing), but unclaimed in tech.

---

## Weaver Positioning Brief

Weaver is Weaver's unified container + VM management capability. This document covers the sales story, competitive angles, and buyer personas for positioning Weaver against Podman's missing dashboard layer.

## The One-Sentence Pitch

> *"Weaver is the management UI that Podman never shipped — and it runs natively on NixOS."*

---

## The Gap Podman Ships With

Podman is a best-in-class container runtime. It is not a dashboard. What Podman CLI cannot give you:

- **No topology visualization.** `podman network inspect` returns JSON. You cannot see how your containers relate to each other or to your VM fleet at a glance.
- **No unified view across runtimes.** If you run Podman for rootless services and Docker for legacy workloads, there is no single pane that shows both — plus your MicroVMs.
- **No health + resource timeline.** `podman stats` is a live stream, not a history. You cannot answer "what was my CPU at 3am?" without a separate monitoring stack.
- **No pod-level grouping in UI form.** Podman pods exist in CLI; nowhere do they render as a logical unit with shared network namespace and co-located services.
- **No NixOS-native integration.** `virtualisation.oci-containers` (the canonical NixOS container declaration) has no first-party web UI. You manage it by editing Nix files and reading `systemctl status`.

Weaver fills all five gaps at v1.1 and v1.2.

---

## What We Provide (v1.1.0 and v1.2.0)

Weaver delivers these capabilities across v1.1.0 and v1.2.0:

| Capability | Available | Notes |
|---|---|---|
| Docker container visibility (read-only) | v1.1 · Free | Status, image, ports, resource usage |
| Podman container visibility (read-only) | v1.1 · Free | Rootful Podman (NixOS default) + rootless |
| Apptainer / SIF container visibility | v1.1 · Weaver | HPC and research runtimes |
| Resource history (CPU, memory, disk I/O) | v1.1 · Free (1h) / Weaver (24h) | Per-VM sparklines on VM detail page |
| Network topology — host container clusters | v1.2 · Weaver | `docker0`/`podman0` bridge nodes in Strands |
| VM node service port annotations | v1.2 · Weaver | Container port mappings shown on VM topology nodes |
| Pod grouping in topology | v1.2 · Weaver | Podman pods render as single nodes with service labels |
| Container management (start/stop/create/delete) | v1.2 · Weaver | Socket API for Docker + Podman |

---

## The NixOS Angle

This is the angle competitors cannot copy — and it is the foundation of Weaver's zero-configuration discovery story.

`virtualisation.oci-containers` in NixOS defaults to **Podman**. When a NixOS user writes:

```nix
virtualisation.oci-containers.containers.pihole = {
  image = "pihole/pihole:latest";
  ports = [ "53:53/udp" "8080:80" ];
};
```

…systemd launches it as a rootful Podman service. No Docker installed. No `docker-compose.yml`. Just a Nix module.

Weaver discovers this container automatically — same as it discovers MicroVMs via `microvm@*` systemd services. Zero configuration. Zero extra tooling. The user opens the dashboard and their `pihole`, `homeassistant`, `postgres-dev` containers are already there.

**No competitor does this.** Portainer requires a manual agent install. Cockpit requires a separate package and doesn't understand `virtualisation.oci-containers` semantics. We read from the same source of truth NixOS already uses.

---

## The Pod Story (Kubernetes Semantics Without Kubernetes)

Weaver surfaces Podman pods as first-class topology objects. Podman pods group containers that share a network namespace — the same model Kubernetes uses. One IP, multiple services. A `media-server` pod might contain:
- `jellyfin` (port 8096)
- `sonarr` (port 8989)
- `radarr` (port 7878)

All at the same IP. One pod = one topology node with three service labels.

**Why this matters for sales:**
- **k8s-migration buyers** — users moving off Kubernetes to reduce complexity see familiar pod semantics. We're not asking them to abandon their mental model.
- **Research/HPC buyers** — Apptainer + Podman pods are the NixOS-native HPC workflow. One topology node per workload group, not one node per process.
- **Sales line:** *"Podman pods are Kubernetes pods without the $80k/year platform engineering hire."*

---

## Strands: What Podman CLI Cannot Show (v1.2)

At v1.2, Weaver extends Strands with a second cluster of nodes below Host:

```
Host
├── br-prod (MicroVM bridge — 10.10.0.0/24)
│   ├── web-nginx (VM, 10.10.0.10)  ← :80 :443
│   └── db-postgres (VM, 10.10.0.30) ← :5432
├── br-dev (MicroVM bridge — 10.10.1.0/24)
│   └── dev-python (VM, 10.10.1.20)
├── docker0 (Docker bridge — 172.17.0.0/16)
│   ├── nginx-proxy ← :80 :443
│   └── redis-cache ← :6379
└── podman0 (Podman bridge — 10.88.0.0/16)
    ├── pihole ← :53/udp :8080
    └── homeassistant ← :8123
```

This is a view that Weaver provides and that does not exist anywhere else for NixOS users. `ip addr show`, `podman network inspect`, and `docker network inspect` together give you the raw data. We give you the picture.

**Rootless Podman** (slirp4netns/pasta — no host-visible bridge) surfaces instead as port annotations on the Host node: `host:53 → pihole`, `host:8123 → homeassistant`. The user sees their services regardless of Podman mode.

---

## Buyer Personas

### Homelab / Prosumer (Weaver Free → Weaver conversion target)
Running Pi-hole, Home Assistant, Jellyfin via `virtualisation.oci-containers`. Currently manages containers through `systemctl` and Nix config. No visibility dashboard today. Weaver's zero-config discovery = immediate "oh, that's useful" moment. Conversion trigger: 24h resource history, Strands, upgrade prompt at Apptainer.

### Small IT Team / MSP (Weaver target)
Managing NixOS servers for clients. Mixed Docker + Podman workloads alongside MicroVMs. Weaver value: single pane across all workload types. Time saved on "which container is eating memory?" questions — answer is 3 clicks, not `ssh + podman stats`.

### Research / HPC (Weaver → Fabrick target)
Apptainer for SIF-based compute jobs, Podman for data pipeline containers, MicroVMs for isolated experiment environments. Weaver pod grouping = clean representation of multi-container jobs. 24h metrics window = resource accountability for shared machines.

### Security-Posture Buyer (Fabrick gating signal)
Rootless Podman is a compliance checkbox: no privileged daemon, containers run as non-root user, no SUID escalation path. Weaver surfaces this in the container detail view: runtime mode (rootful/rootless), user context. Aligns with hardening extension story (seccomp, AppArmor) — containers and VMs in the same security narrative.

---

## Sales Soundbites (Ready to Use)

- *"The dashboard Podman never shipped."*
- *"Zero-config NixOS integration — if you use `virtualisation.oci-containers`, your containers are already in the dashboard."*
- *"Rootless containers, rootless dashboarding. No privileged daemon required."*
- *"Podman pods as topology nodes — Kubernetes semantics without the Kubernetes tax."*
- *"Strands. Your VMs, your Docker containers, your Podman services. The full picture."*
- *"Proxmox doesn't know what a Podman pod is. We do."*
- *"Weaver — the loom that creates your infrastructure fabric."*
- *"Weaver's Weaver: containers and VMs woven into one managed structure."*

---

## Competitive Differentiation

Weaver vs. the alternatives:

| | Weaver (Weaver) | Portainer | Cockpit | Proxmox |
|---|---|---|---|---|
| NixOS-native (`oci-containers`) | Yes — zero config | No — agent install required | Partial — no oci-containers | No |
| Podman rootless support | Yes | Limited | Yes | No |
| Pod grouping in UI | v1.2 | No | No | No |
| MicroVM + container unified view | Yes | No (containers only) | Partial | No (LXC ≠ OCI) |
| Local topology visualization (Strands) | Yes (v1.2) | No | No | No |
| Apptainer / HPC containers | Yes (Weaver) | No | No | No |
| Declarative config management | NixOS native | No | No | No |

---

## Objection Handling

**"We already use Portainer."**
Portainer manages containers. It has no MicroVM concept. It has no NixOS integration. It requires a manual agent on every host. If you're running MicroVMs alongside your containers — which is the NixOS homelab and SMB pattern — Portainer can't show you the full picture. We can.

**"Cockpit already does this on NixOS."**
Cockpit requires `cockpit-podman` (separate package, separate process), doesn't integrate with `virtualisation.oci-containers` declarative semantics, has no local topology view, and has no MicroVM awareness. It's a system monitor. We're a workload orchestration dashboard.

**"I just use `podman ps` and `systemctl`."**
That works until you have 15 containers and 8 VMs and a 3am alert. The dashboard doesn't replace your CLI — it tells you where to look before you open a terminal.

**"Rootless Podman means no network topology anyway."**
Rootless containers (slirp4netns) still expose ports on the host. We show those ports as service annotations on the host node. You still get the "what services are running here" picture — just at the host IP level rather than per-container. And `virtualisation.oci-containers` on NixOS runs rootful by default, so most NixOS users already get the full bridge topology.

---

## Copy for IT-FOCUS-VALUE-PROPOSITION.md (Container Visibility Section)

> **Container Visibility (v1.1.0) — Docker, Podman, Apptainer in one dashboard.**
>
> Most NixOS systems run containers alongside VMs. `virtualisation.oci-containers` defaults to Podman — and until now, there has been no dashboard for it. Weaver discovers your containers automatically from the same systemd services NixOS already manages. No agent. No configuration. Docker and Podman are Free. Apptainer (SIF images, HPC job containers, institutional research workloads) is Weaver.
>
> At v1.2, containers join Strands: `docker0` and `podman0` bridge clusters appear alongside your VM bridges. Podman pods render as single topology nodes with service labels — the same pod model Kubernetes uses, without the orchestration overhead. VM nodes show their container service ports inline.
>
> No competitor — Proxmox, Portainer, Cockpit — provides this combination for NixOS.

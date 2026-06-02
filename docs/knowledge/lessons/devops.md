<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Knowledge: Lessons — devops

Lessons learned in the **devops** domain. Entries are managed by the `llgd` skill.
See `SCHEMA.md` for the entry format and ID convention.

<!-- Entries below. Do not hand-edit entry blocks — use the llgd skill. -->

<!-- entry:L-devops-2026-05-14-001 -->
---
id: L-devops-2026-05-14-001
type: lesson
domain: devops
tags: [deploy, npm-scripts, rsync, build-pipeline, tool]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-devops-2026-05-13-001]
graduated_to: ""
---

## Root-level `build:<tool>` script for tools with external deploy targets — 2026-05-14 · Claude

**Root cause:** A tool with its own `package.json` and an external deploy target (rsync, scp, S3 upload) naturally gets a `build` script that only builds locally. When a developer runs `npm run build` from inside the tool directory, the build succeeds but nothing reaches the live environment — the deploy step is a separate script that's easy to forget. This pattern caused repeated "why aren't my changes visible?" confusion with engram-ui, even after the gotcha was documented.

**Rule:** For any tool with an external deploy target, add a `build:<tool>` script at the project root that chains build + deploy in a single command. Name it following the existing `build:backend`, `build:tui` convention so it's discoverable alongside other build targets. Document it in `CLAUDE.md` Key Commands with a note that this is the only correct build command for that tool.

**Why this shape wins:** A developer running builds from the project root sees `build:engram-ui` alongside `build:backend` and `build:tui` — the deploy is not a separate mental step, it's baked into the standard build invocation. The bare `build` script inside the tool directory can remain for CI contexts that need build-only, but the root script is the canonical developer path. Documentation alone (gotchas, CLAUDE.md) doesn't prevent the mistake — the script structure does.

<!-- /entry -->

<!-- entry:L-devops-2026-06-01-001 -->
---
id: L-devops-2026-06-01-001
type: lesson
domain: devops
tags: [storage, nas, nfs, llm, mlock, mount-naming]
since_version: "1.0.5"
status: active
scope: transferable
related: []
graduated_to: ""
---

## Store large model files on NAS with mlock — single load, free local SSD — 2026-06-01 · Claude

**Root cause:** Considered storing a 32GB Q8_0 model on the local NVMe of the inference machine. The NVMe is 2TB and would fit, but it would consume a third of the drive that's better used for the Nix store and build artifacts — which are large, frequently written, and don't benefit from NAS latency.

**Rule:** For inference machines where the model is mlock'd into RAM on startup: store the model file on NAS. The load time penalty (1G NIC at ~125 MB/s → ~4 minutes for 32GB) only occurs at llama-server startup. Once locked, the model never touches storage again until the service restarts. Local NVMe is better used for Nix store, Docker image layers, and build caches — all of which benefit from low-latency random I/O.

Name the mount point after the share, not the device: `/mnt/foundry-models` not `/mnt/nas`. When multiple machines share a NAS, `/mnt/nas` is ambiguous — `/mnt/foundry-models` communicates exactly what the mount contains and which machine it's for.

**Why this shape wins:** The NAS stores the model once. If the inference machine is replaced, reprovisioned, or re-imaged, the model is already where it needs to be — no 32GB re-download. The per-share mount name also prevents confusion when the NAS serves multiple hosts from different shares.

<!-- /entry -->

<!-- entry:L-devops-2026-06-01-002 -->
---
id: L-devops-2026-06-01-002
type: lesson
domain: devops
tags: [ssh, infra-users, root, service-accounts, privilege-separation, headless]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-nixos-2026-06-01-004]
graduated_to: ""
---

## Headless infra nodes get no human login user — root-from-admin-host + purpose-named service users — 2026-06-01 · Claude

**Root cause:** We copied a workstation-identity user (`mark`) onto a headless inference/agent node because the scaffold config came from a workstation (king) that has one. An infra node managed entirely from an admin host has no interactive human at its console — so the human user is an identity that corresponds to no one, an extra key to rotate, and (when root SSH is disabled in the same rebuild) the direct cause of a lockout.

**Rule:** Decide accounts from what the node *is*, not from the config you copied:
- **Admin** → `root` over SSH, key-only (`PermitRootLogin = "prohibit-password"`, `PasswordAuthentication = false`), keys for each admin host (workstation + any orchestrator). Keeping root SSH alive is what makes the node lockout-proof — there is always one management path that no per-user provisioning step can break.
- **Workloads that must not run as root** (agents, builders, CI) → a **purpose-named, unprivileged service user** (`forge`, `builder`) with only the groups it needs (`docker`) and **no sudo**. Never a mirror of the workstation identity. If a task needs one privileged action, add a narrow audited NOPASSWD rule for that exact command — never blanket wheel.
- **Interactive human user** → none, unless someone genuinely sits at the box.

**Why this shape wins:** It removes a whole failure class instead of working around it. There is no half-provisioned login account to lock you out, the agent blast radius is bounded (unprivileged, no sudo), and "who is this user" always has an answer. The contrast is sharp: the workaround was "add NOPASSWD sudo + an initial password so the human user can self-manage"; the root-cause fix is "the node has no human user, and root-from-admin-host is the management path." See [[G-nixos-2026-06-01-004]].

<!-- /entry -->

<!-- entry:L-devops-2026-06-02-001 -->
---
id: L-devops-2026-06-02-001
type: lesson
domain: devops
tags: [nfs, nfsv3, nat, passthrough, gateway, model-storage, nolock]
since_version: "1.0.5"
status: active
scope: transferable
related: [G-devops-2026-06-02-001, G-nixos-2026-06-02-001]
graduated_to: ""
---

## NFSv3 survives NAT masquerade with nolock — gateway-passthrough model storage — 2026-06-02 · Claude

**Root cause:** A GPU/inference node with only a private-subnet NIC needed a 34 GB model that lives on a NAS on another VLAN, reachable only through a NAT gateway. NFSv4 (single port 2049) would NAT cleanly, but the NAS is NFSv3-only. NFSv3's "doesn't survive NAT" reputation comes from its ancillary services (mountd/statd/lockd on dynamic ports + server→client lock callbacks).

**Rule:** Mount NFSv3 through a masquerade with `-o nfsvers=3,nolock,ro,proto=tcp`. `nolock` drops statd/lockd, so every connection is client-initiated (portmapper 111 → mountd → nfsd 2049) and conntrack/SNAT carries it — no inbound callbacks to break. `ro`+`nolock` is exactly right for a read-only mmap/mlock model load. The gateway stores nothing — pure passthrough; the model lives only on the NAS, so both the gateway and the consumer keep their disk free and models stay swappable from one place.

**Why this shape wins:** One canonical copy on the NAS, zero duplication, no fragile NFS re-export server — the gateway is just the router it already is. Caveats: a 32 GB read over a 1 G NAS link takes ~4–5 min at service start (one-time with mlock; set `TimeoutStartSec` generously), the mount-root dir must be traversable by the service user (see [[G-devops-2026-06-02-001]]), and the gateway's forwarding must be networkd-proof (see [[G-nixos-2026-06-02-001]]).

<!-- /entry -->

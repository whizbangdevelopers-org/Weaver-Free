<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Software License Evaluation — Weaver & Fabrick

**Date:** 2026-03-19 (updated 2026-03-19: full system-level dependency sweep v1.0–v4.0)
**Scope:** All runtime and development dependencies across Weaver's three delivery artifacts (web app + backend API, TUI binary), the NixOS packaging layer, and all planned roadmap components through v3.0 (Fabrick).
**Purpose:** Confirm license compatibility with Weaver's distribution terms; identify compliance obligations; flag anything requiring legal attention before commercial release or roadmap execution.

---

## Executive Summary

**The dependency stack is legally clean across all versions v1.0 through v3.0.**

All 73 npm packages (frontend, backend, TUI) are MIT, ISC, Apache-2.0, or BSD — fully permissive. There are no GPL-licensed npm packages. The existing `audit:license` CI gate enforces this on every push.

GPL and LGPL appear only at the NixOS system layer (QEMU, bash, dnsmasq, nftables, AppArmor, WireGuard tools, etc.) and at the kernel module level. All system-level GPL components interact with Weaver via process boundary, kernel module interface, or guest OS boundary — never via library linking. Copyleft does not propagate. GPL source availability is satisfied by nixpkgs being publicly accessible on GitHub. Neither Weaver Free's AGPL-3.0 + Commons Clause nor the paid tiers' BSL-1.1 are affected.

The template catalog (v2.0+) surfaces third-party software (GPL, AGPL, EUPL, proprietary) inside customer VMs. Weaver ships only the Nix configuration recipes — not the software binaries. License obligations for VM workloads belong to the customer. The user communication model (deployment acknowledgment gate, in-product license badges, Fabrick contract clause) is defined in section 9e.

**Three product decisions govern the remaining flags:**

1. **Valkey** (Redis replacement, BSD-3-Clause): Weaver Free tier included at no extra cost. Weaver/Fabrick available as optional add-to-node-cost item; not a desired upsell.
2. **CUDA** (NVIDIA EULA, proprietary): Fabrick sets `nixpkgs.config.allowUnfree = true` automatically for AI workload nodes; NVIDIA EULA acceptance is captured in the Fabrick contract. Weaver Free/Weaver require manual in-product opt-in.
3. **Mosquitto** (EPL-2.0): Fabrick optional add-to-node-cost item; EMQX (Apache-2.0) is the default MQTT broker for all tiers.

~~**One engineering defect requires immediate correction:** `code/nixos/package.nix` declares `license = licenses.mit`~~ — **Fixed 2026-04-02.** Package now declares AGPL-3.0 + Commons Clause with correct `free = false`.

v4.0 (SaaS management plane / verticals) requires a fresh evaluation at the v2.2 decision gate, particularly if Path A introduces server-side infrastructure with different distribution models.

---

## 1. Weaver's License Stack (Decision #137)

**Two license tracks by tier:**

| Tier | License | Distribution |
|------|---------|-------------|
| **Weaver Free** | AGPL-3.0 + Commons Clause v1.0 + AI Training Restriction | Public repo (Weaver) |
| **Weaver Solo** | BSL-1.1 + AI Training Restriction | Private repo (Weaver-Dev, key-gated) |
| **Weaver Team** | BSL-1.1 + AI Training Restriction | Private repo (Weaver-Dev, key-gated) |
| **Fabrick** | BSL-1.1 + AI Training Restriction | Private repo (Weaver-Dev, key-gated) |

### Weaver Free (AGPL-3.0 + Commons Clause)

Three layers stack on top of each other:

| Layer | What it does |
|-------|-------------|
| AGPL-3.0 | Copyleft open-source base. Users who run Weaver as a network service must be able to receive the full source code. |
| Commons Clause | Prohibits "Selling" the software — defined as offering it to third parties for a fee where the value derives substantially from Weaver's functionality. Blocks hosting-as-a-service and commercial reselling. |
| AI Training Restriction | Prohibits using the codebase to train AI/ML models. |

Together these mean: self-hosting is permitted; commercial SaaS based on Weaver is not.

### Weaver Solo / Team / Fabrick (BSL-1.1)

Business Source License 1.1 — source-available with a 4-year change date converting to AGPL-3.0. Commercial use requires a valid license key. See `docs/legal/LICENSE-PAID-DRAFT.md` for full BSL parameters.

~~**Known discrepancy:** `code/nixos/package.nix` declares `license = licenses.mit`~~ — **Fixed 2026-04-02.** Package meta now declares custom AGPL-3.0 + Commons Clause license with `free = false` and URL pointing to the LICENSE file.

---

## 2. Frontend Dependencies (`code/package.json`)

### 2.1 Production Runtime

| Package | Version | License | Role |
|---------|---------|---------|------|
| `@quasar/extras` | ^1.16.9 | MIT | Icons and web fonts bundled with Quasar |
| `@xterm/addon-fit` | ^0.11.0 | MIT | Terminal fit-to-container addon |
| `@xterm/addon-web-links` | ^0.12.0 | MIT | Clickable URL detection in terminal |
| `@xterm/xterm` | ^6.0.0 | MIT | Web terminal emulator (serial console feature) |
| `axios` | ^1.6.5 | MIT | HTTP client for REST API calls |
| `idb` | ^8.0.0 | ISC | IndexedDB wrapper for offline caching |
| `pinia` | ^2.1.7 | MIT | Vue 3 state management |
| `pinia-plugin-persistedstate` | ^3.2.1 | MIT | Auto-persist Pinia stores to IndexedDB |
| `quasar` | ^2.14.0 | MIT | UI component framework and layout engine |
| `sortablejs` | ^1.15.7 | MIT | Drag-and-drop list ordering |
| `v-network-graph` | ^0.9.22 | MIT | Network topology visualization (Fleet/Network views) |
| `vue` | ^3.5.27 | MIT | Reactive component framework |
| `vue-router` | ^4.2.5 | MIT | SPA client-side routing |

All 13 production frontend packages are MIT or ISC — both fully permissive. No action required.

### 2.2 Development / Build Tools

| Package | Version | License | Notes |
|---------|---------|---------|-------|
| `@playwright/test` | ^1.52.0 | Apache-2.0 | E2E test runner (dev only, runs in Docker) |
| `@quasar/app-vite` | ^2.4.0 | MIT | Quasar CLI + Vite bundler |
| `@stryker-mutator/core` | ^9.6.0 | Apache-2.0 | Mutation testing framework |
| `@stryker-mutator/typescript-checker` | ^9.6.0 | Apache-2.0 | TypeScript integration for Stryker |
| `@stryker-mutator/vitest-runner` | ^9.6.0 | Apache-2.0 | Vitest integration for Stryker |
| `@types/*` (multiple) | various | MIT | TypeScript type definitions |
| `@vitejs/plugin-vue` | ^6.0.3 | MIT | Vue 3 Vite plugin |
| `@vitest/coverage-v8` | ^4.0.17 | MIT | V8 coverage reporting |
| `@vitest/ui` | ^4.0.16 | MIT | Browser-based test UI |
| `@vue/test-utils` | ^2.4.3 | MIT | Vue component testing library |
| `eslint` | ^8.56.0 | MIT | Linter |
| `eslint-config-prettier` | ^9.1.0 | MIT | ESLint/Prettier conflict resolution |
| `eslint-plugin-vue` | ^9.19.2 | MIT | Vue-specific lint rules |
| `jsdom` | ^28.0.0 | MIT | DOM simulation for unit tests |
| `prettier` | ^3.8.0 | MIT | Code formatter |
| `register-service-worker` | ^1.7.2 | MIT | PWA service worker registration |
| `sass` | ^1.97.3 | MIT | Pure-JS SCSS compiler (no native binary) |
| `typescript` | ^5.3.3 | Apache-2.0 | TypeScript compiler |
| `vite` | ^5.0.11 | MIT | Build tool and dev server |
| `vitest` | ^4.0.16 | MIT | Unit test framework |
| `vue-tsc` | ^3.2.2 | MIT | Vue 3 TypeScript type checker |
| `workbox-build` | ^7.4.0 | MIT | PWA service worker builder |
| `workbox-cacheable-response` | ^7.4.0 | MIT | PWA cache control |
| `workbox-expiration` | ^7.4.0 | MIT | PWA cache expiration |
| `workbox-precaching` | ^7.4.0 | MIT | PWA precache manifests |
| `workbox-routing` | ^7.4.0 | MIT | PWA route-based caching |
| `workbox-strategies` | ^7.4.0 | MIT | PWA caching strategies |

Dev dependencies are not shipped to end users and carry no compliance obligation in distributed binaries. Apache-2.0 packages require attribution notices if redistributed — not applicable here since these are dev-only tools.

---

## 3. Backend Dependencies (`code/backend/package.json`)

### 3.1 Production Runtime

| Package | Version | License | Role |
|---------|---------|---------|------|
| `@anthropic-ai/sdk` | ^0.74.0 | MIT | Claude API client (AI diagnostics, BYOK) |
| `@fastify/compress` | ^7.0.3 | MIT | Response compression middleware |
| `@fastify/cors` | ^9.0.1 | MIT | CORS middleware |
| `@fastify/helmet` | ^11.1.1 | MIT | Security headers (CSP, HSTS, X-Frame-Options) |
| `@fastify/rate-limit` | ^9.1.0 | MIT | Per-IP/route rate limiting |
| `@fastify/static` | ^7.0.4 | MIT | Static file serving for frontend PWA |
| `@fastify/websocket` | ^10.0.1 | MIT | WebSocket support (VM status stream, token push) |
| `bcryptjs` | ^3.0.3 | MIT | Password hashing (bcrypt, cost 13) |
| `better-sqlite3` | ^12.6.2 | MIT | Embedded SQLite (ACLs, audit log, quotas) |
| `dotenv` | ^16.3.1 | BSD-2-Clause | `.env` file loading for secrets |
| `fastify` | ^4.29.1 | MIT | HTTP server framework |
| `fastify-type-provider-zod` | ^1.2.0 | MIT | Zod schema → OpenAPI type-safe routes |
| `jsonwebtoken` | ^9.0.3 | MIT | JWT generation and validation |
| `nodemailer` | ^8.0.1 | MIT | Email notifications (Weaver+) |
| `web-push` | ^3.6.7 | MPL-2.0 | VAPID Web Push Protocol (PWA notifications) |
| `zod` | ^3.22.4 | MIT | API input validation and schema inference |

All 16 production backend packages are MIT or BSD-2-Clause — both fully permissive. No restrictions on commercial use or source disclosure.

### 3.2 Development

All backend devDependencies are MIT or Apache-2.0 (`typescript`). Same dev-only note applies as above.

---

## 4. TUI Dependencies (`code/tui/package.json`)

### 4.1 Production Runtime

| Package | Version | License | Role |
|---------|---------|---------|------|
| `ink` | ^5.2.0 | MIT | React-based terminal UI renderer |
| `react` | ^18.3.1 | MIT | Component model (used by Ink in terminal) |
| `ws` | ^8.18.1 | MIT | WebSocket client for backend connection |
| `conf` | ^13.0.1 | MIT | Config file storage (`~/.config/weaver-tui`) |

All 4 production TUI packages are MIT.

### 4.2 Development

All TUI devDependencies are MIT or Apache-2.0 (`typescript`).

---

## 5. NixOS System-Level Dependencies

These are resolved at NixOS build/install time and are not bundled into the npm packages. They run alongside Weaver as external processes, kernel modules, or guest-side components — never linked or embedded in the application.

**Table key:** "First req." = lowest Weaver version that requires the component. "Optional" = not deployed on all installations; enabled only when the associated feature or plugin is active.

| Component | nixpkgs Attribute | License | Role | First req. | Optional |
|-----------|------------------|---------|------|:----------:|:--------:|
| `nixpkgs` | `github:NixOS/nixpkgs/nixos-25.11` | MIT | Package repository | v1.0 | No |
| `nodejs_24` | `pkgs.nodejs_24` | MIT | JavaScript runtime for backend | v1.0 | No |
| `bash` | `pkgs.bash` | GPL-3.0-or-later | Installer and launch scripts | v1.0 | No |
| `microvm.nix` | `inputs.microvm` (NixOS flake) | MIT | Core NixOS flake wrapping all MicroVM hypervisors | v1.0 | No |
| `qemu` | `pkgs.qemu` | GPL-2.0 | Full-featured VM hypervisor (KVM) | v1.0 | No |
| `firecracker` | `pkgs.firecracker` | Apache-2.0 | Sub-second MicroVM hypervisor (<125ms boot) | v1.0 | No |
| `cloud-hypervisor` | `pkgs.cloud-hypervisor` | Apache-2.0 | Lightweight Rust-based VM hypervisor | v1.0 | No |
| `kvmtool` | `pkgs.kvmtool` | GPL-2.0 | Minimal KVM-based hypervisor | v1.0 | No |
| `cdrkit` | `pkgs.cdrkit` | GPL-2.0 | `genisoimage` — builds cloud-init ISOs | v1.0 | No |
| `cloud-init` | `pkgs.cloud-init` | Apache-2.0 | VM userdata initialization (guest-side) | v1.0 | No |
| `apptainer` | `pkgs.apptainer` | BSD-3-Clause | HPC container runtime (Singularity successor) | v1.1 | Yes |
| `dnsmasq` | `pkgs.dnsmasq` | GPL-2.0 | DNS resolver and DHCP server (DNS plugin) | v1.1 | Yes |
| `coredns` | `pkgs.coredns` | Apache-2.0 | DNS server — split-horizon, enterprise DNS plugin | v1.1 | Yes |
| `OVMF` | `pkgs.OVMF` | BSD-2-Clause | UEFI firmware for Windows VMs | v1.1 | Yes |
| `virtio-win` | `pkgs.virtio-win` | GPL-2.0 | VirtIO guest drivers ISO for Windows VMs | v1.1 | Yes |
| `nftables` | `pkgs.nftables` | GPL-2.0 | Firewall rules engine (firewall plugin) | v1.2 | Yes |
| `apparmor` | `pkgs.apparmor` | GPL-2.0 | Mandatory access control profiles (hardening plugin) | v1.2 | Yes |
| `libseccomp` | `pkgs.libseccomp` | LGPL-2.1 | Syscall filtering for Seccomp profiles (hardening plugin) | v1.2 | Yes |
| `wireguard-tools` | `pkgs.wireguard-tools` | GPL-2.0 | WireGuard VPN configuration utilities | v1.2 | Yes |
| `weasyprint` | `pkgs.python3Packages.weasyprint` | BSD-3-Clause | HTML→PDF rendering for compliance doc export | v1.0 | No |
| `tailscale` | `pkgs.tailscale` | BSD-3-Clause | Managed WireGuard tunnel (Tailscale setup wizard) | v1.2 | Yes |
| `slurm` | `pkgs.slurm` | GPL-2.0 | HPC batch job scheduler (Research/HPC integration) | v1.2 | Yes |
| `swtpm` | `pkgs.swtpm` | BSD-2-Clause | Software TPM 2.0 emulator (Windows 11 TPM support) | v2.0 | Yes |
| `cloudbase-init` | `pkgs.cloudbase-init` ¹ | Apache-2.0 | Windows guest cloud-init equivalent | v2.0 | Yes |
| `restic` | `pkgs.restic` | BSD-2-Clause | Backup engine — restic adapter | v2.6 | Yes |
| `borgbackup` | `pkgs.borgbackup` | BSD-2-Clause | Backup engine — borg adapter | v2.6 | Yes |
| `nixos-anywhere` | `pkgs.nixos-anywhere` | MIT | Remote NixOS deployment for edge fleet provisioning | v3.0 | Yes |
| v4.0 deps | TBD | TBD | Path A: SaaS management plane (PostgreSQL, reverse proxy, etc.); Path B: AI vertical or K-12 fleet extensions. Evaluate at v2.2 decision gate. | v4.0 | TBD |

¹ `cloudbase-init` availability in nixpkgs is unconfirmed at time of writing. Evaluate at v2.0 development; manual packaging may be required.

### GPU and InfiniBand — User-Supplied, Not Weaver Dependencies

GPU passthrough (`--nv` NVIDIA, `--rocm` AMD) and InfiniBand connectivity (v3.0 cloud burst) rely on drivers and firmware supplied by the user's system. CUDA, ROCm, NVIDIA kernel modules, and rdma-core/libibverbs are the user's infrastructure. Weaver configures passthrough declaratively but does not ship or depend on these drivers. License obligations belong to the hardware vendor stack, not Weaver's distribution.

### GPL License Analysis

**Process-boundary rule:** GPL-2.0 and GPL-3.0 copyleft does not propagate to calling programs when the relationship is subprocess invocation — not library linking. All GPL system dependencies are invoked as external processes or loaded as kernel modules. Weaver does not link or embed any GPL source code.

| GPL Component | Relationship to Weaver | Propagation |
|---|---|---|
| `bash` | Weaver scripts use bash as shell interpreter; bash is a separate NixOS derivation | None — not linked |
| `qemu`, `kvmtool`, `cdrkit` | Spawned as subprocesses via Node.js `child_process` | None — process boundary |
| `dnsmasq` | Started as a NixOS-managed system service; Weaver writes its config declaratively | None — process boundary |
| `nftables` | Kernel netfilter subsystem + userspace CLI; Weaver writes nftables rules via NixOS module | None — kernel module + process |
| `apparmor` | Kernel security module; profiles loaded via NixOS declarative config | None — kernel module |
| `wireguard-tools` | Userspace config utilities; WireGuard kernel module is in-tree GPL-2.0 | None — kernel module + process |
| `virtio-win` | Guest-side drivers installed inside Windows VMs — separate OS boundary from host | None — guest OS boundary |
| `slurm` | CLI subprocess calls + HTTP API boundary (SLURM prolog/epilog calls Weaver's API) | None — process and network boundary |

**Source availability:** All GPL system packages are distributed via nixpkgs (public: `github:NixOS/nixpkgs`). Weaver's NixOS flake references nixpkgs as a flake input — nixpkgs source availability is satisfied by its public GitHub repository. No additional distribution obligation on Weaver.

### LGPL License Analysis

**`libseccomp` (LGPL-2.1):** LGPL-2.1 permits use from any program — including proprietary software — provided the user can substitute a modified version of the LGPL library. Weaver does not link to `libseccomp` directly; it is used by the NixOS hardening module and the hypervisor processes (QEMU, Firecracker) which may link it. No Weaver application code creates a link-time dependency on `libseccomp`. No LGPL obligation arises for Weaver's distribution.

**WeasyPrint transitive LGPL deps (Pango LGPL-2.0+, Cairo LGPL-2.1+):** WeasyPrint (BSD-3-Clause) is invoked as a subprocess via Node.js `execFileAsync` — Weaver never links to WeasyPrint or its dependencies. Pango and Cairo are linked by the WeasyPrint Python process, not by Weaver's Node.js process. The process boundary prevents LGPL propagation. Other WeasyPrint transitive deps (GDK-Pixbuf BSD-2-Clause, Fontconfig MIT, HarfBuzz MIT) are fully permissive.

### Conclusion

No system-level dependency imposes copyleft obligations on Weaver's application code. All GPL and LGPL components interact via process boundary, kernel module, or guest OS isolation — never via library linking or source embedding. Distribution via NixOS flake satisfies GPL source availability through nixpkgs. Weaver's AGPL-3.0 + Commons Clause license is unaffected across all versions v1.0 through v3.0. v4.0 deps require re-evaluation at the v2.2 decision gate, particularly if Path A (SaaS management plane) introduces server-side components with different distribution models.

---

## 6. E2E Testing Container

Used during CI and development only. Not shipped to users.

| Component | License | Notes |
|-----------|---------|-------|
| Playwright base image (`mcr.microsoft.com/playwright:v1.58.2-jammy`) | MIT (Microsoft) | Ubuntu 22.04 LTS + browsers |
| Chromium (bundled in image) | BSD-3-Clause | Test browser |
| Firefox (bundled in image) | MPL-2.0 | Test browser |
| WebKit (bundled in image) | BSD-2-Clause | Test browser |

All permissive. Dev/CI use only — no distribution obligations.

---

## 7. License Summary

### By Type

| License | Category | Where | Commercial Use | Source Requirement |
|---------|----------|-------|---------------|--------------------|
| MIT | Permissive | ~55 npm packages + microvm.nix, nixos-anywhere (system) | Yes, unrestricted | No |
| ISC | Permissive | 1 npm package (`idb`) | Yes, unrestricted | No |
| Apache-2.0 | Permissive | ~5 npm dev packages + firecracker, cloud-hypervisor, cloud-init, coredns, tailscale, cloudbase-init (system) | Yes, unrestricted | Attribution notice only |
| BSD-2-Clause | Permissive | `dotenv` (npm) + OVMF, swtpm, restic, borgbackup (system) + WebKit (test) | Yes, unrestricted | Attribution |
| BSD-3-Clause | Permissive | apptainer, tailscale (system) + Chromium (test) | Yes, unrestricted | Attribution |
| LGPL-2.1 | Weak copyleft | libseccomp (system — used by hypervisors, not by Weaver directly) | Yes (dynamic link permitted) | Modified LGPL files only if redistributed |
| MPL-2.0 | File-level copyleft | Firefox (test only) | Yes | Modified MPL files only |
| GPL-2.0 | Strong copyleft | qemu, kvmtool, cdrkit, dnsmasq, nftables, apparmor, wireguard-tools, virtio-win, slurm (all system — process/kernel boundary) | Yes (process boundary) | Source via nixpkgs |
| GPL-3.0+ | Strong copyleft | bash (system — process boundary) | Yes (process boundary) | Source via nixpkgs |

### Compatibility with Weaver's License Stack

All npm dependencies are permissive (MIT/ISC/Apache-2.0/BSD). There are no GPL or LGPL-licensed npm packages — no inbound copyleft from the npm dependency graph. The `audit:license` CI gate enforces this.

GPL and LGPL system dependencies sit outside the application via process boundary, kernel module interface, or guest OS boundary. They do not affect Weaver's license. LGPL `libseccomp` is used by hypervisors, not linked by Weaver itself.

The combination is legally clean across all versions v1.0 through v3.0. Weaver Free may be distributed under AGPL-3.0 + Commons Clause, and paid tiers under BSL-1.1, without any conflict from dependency licenses. v4.0 requires re-evaluation at the v2.2 decision gate.

---

## 8. Compliance Obligations

### Required Before Commercial Distribution

| Obligation | Trigger | Action |
|------------|---------|--------|
| AGPL-3.0 source availability | Weaver Free deployments accessed over a network | Public source repo (GitHub) satisfies this. Ensure the repo is publicly accessible at time of distribution. Paid tiers (Solo/Team/Fabrick) are BSL-1.1 — source availability is provided but AGPL network-use clause does not apply until the 4-year change date. |
| Commons Clause notice | All distributions | LICENSE file (already present) must accompany all packages, downloads, and NixOS module releases. |
| AI Training Restriction | All distributions | Add to Terms of Service and product marketing. Not a license notice obligation but a contract term. |
| Apache-2.0 attribution | Packages: `typescript`, `@playwright/test`, `@stryker-mutator/*` | These are dev-only. Not required in shipped binaries. If ever bundled in a redistributable, include NOTICE file. |
| BSD/ISC attribution | `dotenv`, `idb`, WebKit, Chromium (test); OVMF, swtpm, restic, borgbackup, apptainer, tailscale (system) | Include in ATTRIBUTION.md if shipping system packages with Weaver distribution. |
| LGPL-2.1 (libseccomp) | System-level, used by hypervisors indirectly | No action required for Weaver distribution. If Weaver ever links libseccomp directly, provide mechanism for users to substitute a modified version (standard LGPL compliance). |
| Fix `package.nix` license field | package.nix declares `licenses.mit` | **Must correct** to `licenses.agpl3Plus` (or custom) before any NixOS upstream submission or public package index entry. |

### Recommended (Not Strictly Required)

- Generate an `ATTRIBUTION.md` or `LICENSES.md` listing all direct npm dependencies, their versions, and licenses. This is good practice for fabrick customers and may be contractually required in fabrick agreements.
- Add `npm audit --audit-level=moderate` to CI to catch newly introduced vulnerable or license-problematic transitive dependencies.
- The existing `audit:license` script (`scripts/audit-licenses.ts`) already blocks GPL in the npm dependency tree — keep this gate active.

---

## 9. Fabrick-Specific Considerations

Fabrick (v3.0) is a fleet control plane — it coordinates multiple Weaver hosts. From a license perspective:

- Fabrick is licensed under BSL-1.1 (Decision #137), same as Solo and Team.
- BSL-1.1 permits source availability but requires a valid license key for production use. Commercial SaaS hosting of Fabrick for third parties requires a separate commercial license agreement.
- Per-node pricing for Fabrick is consistent with the BSL model — you are selling a license key for production use.
- After the 4-year change date, each Fabrick release converts to AGPL-3.0.

No new dependency concerns are anticipated for Fabrick unless it introduces new packages. Evaluate at time of Fabrick development.

---

## 9a. Template Isolation Model (Important Foundation)

VM templates are NixOS configurations that tell `nixpkgs` how to build and run third-party software inside a virtual machine. Weaver ships the **recipes** (Nix expressions), not the software binaries themselves. The user's NixOS system fetches the binaries from nixpkgs at deploy time.

Consequence: **the licenses of software running inside VMs do not propagate to Weaver's codebase.** There is a process boundary (separate VM) and a distribution boundary (user installs via nixpkgs, not from Weaver). This is analogous to a package manager: `apt` does not inherit the GPL from every package it can install.

**What Weaver is responsible for:** the template configuration code itself (AGPL-3.0 for Free, BSL-1.1 for paid tiers), documentation, and ensuring users are informed about the licenses of software they deploy.

**What users are responsible for:** complying with the individual licenses of applications they run in their VMs.

This distinction is critical for the template catalog. The sections below call out cases where user education or template design choices matter.

---

## 9b. Planned Roadmap Components

### Nix Ecosystem Integrations

All integrations from [NIX-ECOSYSTEM-INTEGRATION-PLAN.md](../../plans/cross-version/NIX-ECOSYSTEM-INTEGRATION-PLAN.md) are permissive:

| Integration | License | Version | Notes |
|-------------|---------|---------|-------|
| `nix-ld` | MIT | v1.1 | |
| `nixos-generators` | MIT | v1.1/v1.4 | |
| `home-manager` | MIT | v1.1 | |
| `sops-nix` | MIT | v1.2 | |
| `impermanence` | MIT | v1.2 | |
| `lanzaboote` | MIT | v1.2 | |
| `nixos-anywhere` | MIT | v2.0 | |
| `disko` | MIT | v2.0 | |
| `colmena` | MIT | v2.0 | |
| `attic` | Apache-2.0 | v2.0 | |
| `nixos-facter` | MIT | v2.2 | |
| `nix-topology` | MIT | v3.0 | |

No flags. All are NixOS modules/tools that integrate at the system level via process boundary.

### Container Runtimes (v1.1+)

| Runtime | License | Tier | Notes |
|---------|---------|------|-------|
| Docker Engine | Apache-2.0 | Weaver Free | Docker Inc. |
| Podman | Apache-2.0 | Weaver Free | Red Hat |
| Apptainer | BSD-3-Clause | Weaver | Formerly Singularity; Linux Foundation |

All permissive. Weaver invokes these via socket APIs — no code linking.

### DNS Extensions (v1.1+)

| Component | License | Notes |
|-----------|---------|-------|
| dnsmasq | GPL-2.0 | Invoked as a system process; process boundary applies. No propagation. |
| CoreDNS | Apache-2.0 | Runs as a VM/service. |

### Networking Wizards (v1.3)

| Component | License | Notes |
|-----------|---------|-------|
| Tailscale client | BSD-3-Clause | `tailscale/tailscale` repo. Weaver configures NixOS service, does not bundle. |
| WireGuard | GPL-2.0 (kernel module) | Kernel-space. Linux kernel carve-out: kernel modules do not propagate GPL to user-space callers. |

### Mobile App (v1.3)

| Component | License | Notes |
|-----------|---------|-------|
| Capacitor | MIT | Ionic. Cross-platform native bridge. |

### SSO / Auth Extension — Kanidm (v2.0, Technology Alliance)

| Component | License | Notes |
|-----------|---------|-------|
| Kanidm | MPL-2.0 | Ships as a NixOS module via nixpkgs; no source linking to Weaver. MPL-2.0 is file-level copyleft — applies only to modified Kanidm source files. Weaver does not ship or modify Kanidm source. TA integration is configuration + OAuth endpoints only. No propagation. |

### Firewall Extensions (v1.2)

| Component | License | Notes |
|-----------|---------|-------|
| nftables | GPL-2.0 (kernel) | Kernel-space netfilter; kernel carve-out applies. Userspace `nft` tool: GPL-2.0, invoked via subprocess. No propagation. |
| AppArmor | GPL-2.0 | Kernel LSM; kernel carve-out applies. |
| Seccomp | GPL-2.0 (kernel) | Kernel facility; carve-out applies. |

---

## 9c. Template Catalog — Per-Template License Audit

Source: MASTER-PLAN.md Decision #46 (Wave 1–3 templates). Templates are NixOS VM configurations. License obligations fall on the end user for software they deploy.

### Wave 1 — v2.0.0

| Template | License | Flag | Notes |
|----------|---------|------|-------|
| nginx | BSD-2-Clause | None | |
| PostgreSQL | PostgreSQL License | None | Permissive, similar to MIT |
| **Redis** | **SSPL (blocked)** | **Closed** | Redis 7.4+ is SSPL. Not shipped. Decision closed — Valkey only. |
| **Valkey** | BSD-3-Clause | None | **Free** — included in Weaver Free tier template catalog at no extra cost. **Weaver/Fabrick** — available as optional add-to-node-cost item; not a desired upsell (recommend customers use it as a utility, not a purchase driver). |
| Forgejo | MIT | None | Codeberg e.V. |
| Nextcloud | AGPL-3.0 | Note | Compatible with Weaver's AGPL. Runs in VM. User installs via nixpkgs. No code linking to Weaver. |
| Pi-hole | EUPL-1.2 | Review | EUPL-1.2 is in the audit script's BLOCKED list (copyleft + jurisdiction clause). **However**, Pi-hole runs in a VM — Weaver does not link or distribute Pi-hole code. The template is Nix configuration only. EUPL does not propagate. **User must comply with EUPL in their Pi-hole deployment.** Recommend adding a comment in the template config pointing users to Pi-hole's license. |
| Home Assistant | Apache-2.0 | None | |
| Jellyfin | GPL-2.0 | Note | Runs in VM; process boundary. User must comply. |
| Navidrome | GPL-3.0 | Note | Runs in VM; process boundary. User must comply. |
| Immich | AGPL-3.0 | Note | Runs in VM; compatible with Weaver's AGPL. User must comply. |
| Audiobookshelf | GPL-3.0 | Note | Runs in VM; process boundary. User must comply. |
| Authentik | MIT | None | |

### Wave 2 — v2.1.0

| Template | License | Flag | Notes |
|----------|---------|------|-------|
| Prometheus | Apache-2.0 | None | |
| Grafana | AGPL-3.0 | Note | Grafana v8+ is AGPL-3.0. Runs in VM; compatible with Weaver's AGPL. User must comply. |
| Vaultwarden | GPL-3.0 | Note | Unofficial Bitwarden server. Runs in VM; process boundary. User must comply. |
| Node-RED | Apache-2.0 | None | |
| HAProxy | GPL-2.0 + OpenSSL exception | Note | Runs in VM; process boundary applies. HAProxy license also permits use in proprietary systems when not distributed in modified form. User must comply. |

### Wave 3 — v2.x

| Template | License | Flag | Notes |
|----------|---------|------|-------|
| Loki (Grafana) | AGPL-3.0 | Note | Runs in VM; process boundary. User must comply. |
| MQTT broker (default) | Apache-2.0 | None | **EMQX chosen** (Decision #67). Apache-2.0. Primary default for all tiers. |
| Mosquitto (optional) | EPL-2.0 | Fabrick | **Fabrick only** — available as optional add-to-node-cost item for customers who specifically require Mosquitto (e.g., existing infrastructure compatibility). Not the default; not desired as a primary choice. EPL-2.0 is file-level copyleft; applies only to modified Mosquitto source files (user's obligation, not Weaver's). |
| CI/CD runner | Depends on choice | Review | Forgejo Actions/Woodpecker (Apache-2.0) preferred. Gitea runners (MIT). Avoid Jenkins (MIT) complexity. |
| Kanidm SSO extension | MPL-2.0 | Note | See section 9b above. |
| CUDA (AI templates) | NVIDIA EULA (proprietary) | Fabrick | **Fabrick default:** `nixpkgs.config.allowUnfree = true` is set automatically for Fabrick AI workload nodes — no manual user configuration required. CUDA installs via nixpkgs under the NVIDIA EULA. **Contract note:** Fabrick agreement must include a clause acknowledging the customer accepts the NVIDIA CUDA EULA as a condition of using AI VM templates. This protects Weaver from downstream EULA compliance claims. Weaver Free/Weaver: user must opt in manually. |
| ROCm (AI templates) | MIT / Apache-2.0 | None | AMD ROCm is open source. |
| Ollama | MIT | None | |

### AI Provider SDK Extensions (v1.2+)

| Provider | License | Notes |
|----------|---------|-------|
| OpenAI SDK (`openai` npm) | MIT | |
| Ollama client | MIT | |
| ZenCoder.ai SDK | Proprietary/Unknown | Evaluate at time of integration. Must confirm: MIT-compatible API client license, no viral terms, acceptable redistribution in AGPL-3.0 context. |

---

## 9d. Summary — Roadmap License Flags

| Flag Level | Item | Action |
|------------|------|--------|
| ~~Critical~~ | Redis | **Closed.** Valkey only. Free: included. Weaver/Fabrick: optional add-on, not desired as upsell. |
| Fabrick | CUDA AI templates | Fabrick default: `allowUnfree = true` auto-set. Note NVIDIA EULA acceptance in Fabrick contract. Weaver Free/Weaver: manual opt-in. |
| Review | Pi-hole EUPL-1.2 | Template config is safe (Nix config only). Add license notice. See section 9c. |
| Note | Mosquitto EPL-2.0 | Fabrick optional add-on, not desired. EMQX is default. |
| Review | ZenCoder.ai SDK | Confirm SDK license before integration. |
| Note | Various GPL/AGPL VM templates | Process boundary. User education — see section 9e below. |
| Note | Kanidm MPL-2.0 | No code linking. OAuth + NixOS module config only. |

---

## 9e. Communicating Template Licenses to Users

Templates that deploy GPL/AGPL/EUPL software require user-facing disclosure. The legal exposure for Weaver is minimal (templates are Nix configuration, not distributed software), but users need informed consent. A two-tier approach:

### Tier 1 — In-product: Deployment Acknowledgment Gate

For templates where the deployed software has a non-permissive license (GPL, AGPL, EUPL, or proprietary), the deployment wizard shows a one-time license acknowledgment before provisioning begins:

> **License Notice**
> This template deploys **[Software Name]**, which is licensed under **[License]**.
> You are responsible for complying with this license in your deployment.
> [Link to upstream license]
>
> ☐ I understand and accept responsibility for license compliance.

This is the same UX pattern as nixpkgs's `allowUnfree` gate — explicit opt-in, creates a paper trail, no ambiguity about who owns compliance. It fires once per template, not on every deploy. The acknowledgment is stored per-user per-template in the audit log (Fabrick).

**Templates that trigger this gate:**

| Template | License | Gate Type |
|----------|---------|----------|
| Pi-hole | EUPL-1.2 | Copyleft notice |
| Jellyfin | GPL-2.0 | Copyleft notice |
| Navidrome | GPL-3.0 | Copyleft notice |
| Audiobookshelf | GPL-3.0 | Copyleft notice |
| Vaultwarden | GPL-3.0 | Copyleft notice |
| HAProxy | GPL-2.0 + OpenSSL exception | Copyleft notice |
| Grafana | AGPL-3.0 | Copyleft notice |
| Loki | AGPL-3.0 | Copyleft notice |
| Nextcloud | AGPL-3.0 | Copyleft notice |
| Immich | AGPL-3.0 | Copyleft notice |
| CUDA AI templates | NVIDIA EULA (proprietary) | Proprietary EULA — Fabrick auto-accepts via contract, Weaver Weaver Free/Weaver must gate manually |
| Mosquitto (Fabrick opt-in) | EPL-2.0 | Copyleft notice |

Permissive templates (nginx, PostgreSQL, Valkey, Forgejo, Home Assistant, Prometheus, Node-RED, Ollama, ROCm, etc.) do not require a gate.

### Tier 2 — Documentation: Template Detail Pages

Each template in the catalog shows a **License badge** (color-coded):
- Green: MIT / Apache-2.0 / BSD / ISC / PostgreSQL License
- Yellow: GPL / AGPL / EUPL / MPL
- Red: Proprietary

The template detail page includes a "License & Compliance" section:
- SPDX identifier and plain-English one-liner ("Users must keep source available for modifications to this software")
- Link to upstream project license
- Link to the "Template Software Licenses" reference doc

### Tier 3 — Fabrick Contract

The Fabrick agreement includes:
- A clause stating the customer acknowledges and accepts NVIDIA CUDA EULA as a condition of using AI VM templates (handles the `allowUnfree` consent at a contract level)
- A general clause that the customer is responsible for complying with licenses of all software they deploy via Weaver templates
- A list of copyleft-licensed templates available in the catalog (by SPDX identifier) — customer's legal team can review before signing

This contract-level coverage means Fabrick customers get a smooth `allowUnfree = true` default (no in-product gate friction) because the legal gate happens at contract signing instead.

---

## 10. Open Items

### Current Codebase

| # | Item | Priority | Owner |
|---|------|----------|-------|
| ~~1~~ | ~~Fix `code/nixos/package.nix` — `license = licenses.mit` must be corrected~~ | ~~High~~ | **Resolved 2026-04-02** — fixed to AGPL-3.0 + Commons Clause custom license block |
| ~~2~~ | ~~Add `ATTRIBUTION.md` listing all direct npm dependencies~~ | ~~Medium~~ | **Resolved 2026-04-02** — `code/ATTRIBUTION.md` created |
| ~~3~~ | ~~Draft Terms of Service AI Training Restriction clause~~ | ~~Medium~~ | **Resolved 2026-04-02** — draft at `business/legal/AI-TRAINING-RESTRICTION-TOS.md` (requires attorney review) |
| ~~4~~ | ~~Decide entity structure~~ | ~~High~~ | **Resolved** — whizBANG Developers LLC formed |

### Roadmap — Before Template Catalog Ships (v2.0)

| # | Item | Priority | Owner |
|---|------|----------|-------|
| ~~5~~ | ~~Update Decision #46 — Redis/Valkey to Valkey only~~ | ~~High~~ | **Resolved** — Decision #68 (Valkey only, BSD-3-Clause) supersedes #46 wording |
| ~~6~~ | ~~CUDA Fabrick EULA acceptance~~ | ~~High~~ | **Resolved** — Decision #69. Fabrick auto-sets allowUnfree; contract clause covers EULA. Weaver in-product gate deferred to v1.2 (AI GPU templates) |
| 7 | Implement deployment acknowledgment gate (section 9e) in the template provisioning wizard for all GPL/AGPL/EUPL/proprietary templates listed in section 9e Tier 1. Ships with template catalog at v2.0. | Medium | Engineering |
| ~~8~~ | ~~MQTT broker choice~~ | ~~Medium~~ | **Resolved** — Decision #67 (EMQX, Apache-2.0). Decision #70 (Mosquitto Fabrick-optional) |
| ~~9~~ | ~~Confirm ZenCoder.ai SDK license~~ | ~~Medium~~ | **Resolved 2026-04-03** — ZenCoder is a SaaS IDE plugin (subscription model), not an embeddable SDK. No library to license-evaluate. `zenagents-library` is MIT (agent definitions only). On-premise deployment is an enterprise option — Weaver hosts ZenCoder as a managed workload template, not as an embedded provider. Reclassified from license concern to business development opportunity: `business/sales/partners/zencoder.md`. |
| 10 | Add License badge + "License & Compliance" section to template detail page UI (section 9e Tier 2). Design during template catalog planning (v2.0). **v1.0 infrastructure in place:** `license` field added to distro catalog schema, custom distro API, and frontend DistroEntry type. SPDX identifiers populated for all shipped distros. License badge visible in distro dropdown. v2.0 adds: acknowledgment gate for copyleft/proprietary templates, per-template compliance section, audit log integration. | Medium | Engineering/Design |
| ~~11~~ | ~~Mosquitto pricing table~~ | ~~Low~~ | **Resolved** — Decision #70. EMQX default; Mosquitto Fabrick-optional add-to-node-cost |

### Roadmap — System Dependencies (v2.0–v4.0)

| # | Item | Priority | Owner |
|---|------|----------|-------|
| ~~11~~ | ~~Confirm `cloudbase-init` nixpkgs package availability~~ | ~~Low~~ | **Resolved 2026-04-03** — cloudbase-init runs *inside the Windows guest*, not on the NixOS host. No NixOS package needed. Not in nixpkgs, NUR, or any Nix repo (confirmed). The MSI installer is bundled into the Windows VM template ISO alongside virtio-win (v2.1 engineering task). Apache-2.0 licensed — no compliance concern. |
| 12 | At v2.2 decision gate: evaluate v4.0 Path A (SaaS management plane) system deps — PostgreSQL, reverse proxy, any server-side infrastructure introduced for the hosted offering. AGPL-3.0 network-use clause applies to the SaaS layer; confirm source availability mechanism before launch | Medium | Engineering + Legal |

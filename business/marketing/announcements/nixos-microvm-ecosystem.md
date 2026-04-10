<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# NixOS / MicroVM Ecosystem Map
*Created: 2026-03-08 | Updated: 2026-03-10 — for community collaboration outreach*

---

## Core NixOS Leadership

| Person / Org | Role | Reach Via |
|---|---|---|
| Eelco Dolstra | Nix creator | github.com/edolstra · NixOS Discourse |
| Graham Christensen | Determinate Systems co-founder | github.com/grahamc |
| NixOS Foundation | Governance body | foundation@nixos.org |
| NixOS Marketing Team | Community outreach | marketing@nixos.org |

---

## Companies Deeply in the NixOS Stack

| Company | Relevance to Stack | Contact |
|---|---|---|
| Determinate Systems | Commercial Nix, nix-installer, FlakeHub | determinate.systems/contact |
| Flox | Nix-based dev environments | flox.dev |
| Tweag / Modus Create | Major Nix/flake contributors | tweag.io/contact |
| Cachix | Nix binary cache (critical infrastructure) | cachix.org |
| Hercules CI | Nix-native CI/CD | hercules-ci.com |

---

## MicroVM.nix Specifically

| Player | Role | Contact |
|---|---|---|
| Astro (Julian Stecklina) | microvm.nix primary author | github.com/astro — issues/discussions |
| microvm.nix community | Contributors and users | github.com/astro/microvm.nix/discussions |

---

## Key Individual Maintainers

These are maintainers of packages we plan to integrate directly. Engage respectfully — they are potential collaborators, not vendors.

| Person | Maintains | Where to Engage |
|---|---|---|
| Mic92 (Jörg Thalheim) | nix-ld, sops-nix | github.com/Mic92 |
| zhaofengli (Zhaofeng Li) | colmena, attic | github.com/zhaofengli |
| oddlama | nix-topology | github.com/oddlama |
| numtide team | nixos-facter, flake-utils | github.com/numtide |
| nix-community org | nixos-generators, home-manager, impermanence, lanzaboote, nixos-anywhere, disko | github.com/nix-community |

---

## Integration Roadmap — Packages We Depend On

*Source of truth: [NIX-ECOSYSTEM-INTEGRATION-PLAN.md](../../plans/cross-version/NIX-ECOSYSTEM-INTEGRATION-PLAN.md)*

### v1.1 — Container Visibility + Plugin Infrastructure

| Package | What It Does for Us | Engagement Priority |
|---|---|---|
| **nix-ld** (Mic92) | Run unpatched binaries in NixOS guests — removes #1 objection | Low — enable module, no upstream changes |
| **nixos-generators** (nix-community) | "Export VM as image" in 12+ formats (QCOW2, OVA, AMI, etc.) | Medium — may surface edge cases in MicroVM configs |
| **home-manager** (nix-community) | Per-user VM customization for research/HPC use case | Low — template inclusion, well-established project |

### v1.2 — Security Hardening Stack

| Package | What It Does for Us | Engagement Priority |
|---|---|---|
| **sops-nix** (Mic92) | Secrets encrypted at rest in VM configs (age, GPG, KMS) | **High** — compliance-critical; may need to discuss MicroVM-specific patterns |
| **impermanence** (nix-community) | Ephemeral root filesystem — VMs born clean every boot | Medium — proven patterns exist; our use case is novel (dashboard-managed VMs) |
| **lanzaboote** (nix-community) | UEFI Secure Boot chain for host hardening | Low — standard module enablement + status detection |

### v2.0 — Multi-Node Foundation

| Package | What It Does for Us | Engagement Priority |
|---|---|---|
| **nixos-anywhere + disko** (nix-community) | Zero-touch node onboarding — SSH into bare metal, install NixOS | **High** — deep integration; progress tracking, error handling, agent auto-registration |
| **colmena** (zhaofengli) | Fleet deployment engine — hub pushes configs to agent nodes | **High** — core multi-node infrastructure; potential feature requests |
| **attic** (zhaofengli) | Self-hosted binary cache — fast provisioning, air-gap support | Medium — bundle as optional service; standard usage patterns |

### v2.2 — Clustering

| Package | What It Does for Us | Engagement Priority |
|---|---|---|
| **nixos-facter** (numtide) | Hardware auto-discovery for cluster nodes (CPUs, GPUs, RAM, NICs) | Medium — run on agent startup, report to hub |

### v3.0 — Advanced Clustering + Edge

| Package | What It Does for Us | Engagement Priority |
|---|---|---|
| **nix-topology** (oddlama) | Auto-generated network diagrams from NixOS config — topology correct by construction | Medium — parse output into dashboard topology view; may need format discussions |

---

## General NixOS Tech Stack

| Package / Project | Where to Engage |
|---|---|
| nixpkgs (packages) | github.com/NixOS/nixpkgs — see `CODEOWNERS` for module maintainers |
| NixOS modules | github.com/NixOS/nixpkgs — `nixos/modules/` directory |
| GNOME on NixOS | github.com/NixOS/nixpkgs — GNOME maintainer team |
| flake-utils / flake-parts | github.com/numtide/flake-utils |
| home-manager | github.com/nix-community/home-manager |

---

## Best Outreach Channels (Priority Order)

1. **NixOS Discourse** — discourse.nixos.org — primary venue; maintainers watch closely
2. **GitHub Discussions** — open a Discussion (not an Issue) on relevant repos to signal collaboration intent
3. **NixOS Foundation email** — for governance/coordination level conversations
4. **Matrix rooms** — real-time conversation with active contributors
   - `#nixos:nixos.org`
   - `#microvm:nixos.org`

---

## Outreach Message Drafts

### Draft A — NixOS Foundation / Governance Level
*(foundation@nixos.org · marketing@nixos.org)*

---

Subject: Collaborative Coordination on MicroVM.nix Ecosystem Impact

Hello,

My name is Mark Weisser. I am the principal of whizBang! Developers, a technology consulting and development firm. We build production infrastructure on a stack that includes NixOS, MicroVM.nix, and related Nix ecosystem tooling.

I am reaching out because the trajectory of microvm.nix represents a meaningful shift in how NixOS is being applied to production infrastructure — and I want to be a constructive participant in that evolution rather than simply a downstream consumer.

Specifically, I am interested in:

- Understanding where the NixOS Foundation sees microvm.nix fitting into the broader NixOS story
- Contributing back findings from our production use of MicroVM on embedded/IoT-adjacent infrastructure
- Coordinating so that our work does not duplicate or conflict with existing community efforts
- Identifying whether there is a working group, SIG, or coordination channel specifically for MicroVM/VM-related NixOS development

If there is a more appropriate person or channel to direct this to, I would be grateful for the introduction.

Thank you for everything the Foundation and the community do.

Mark Weisser
Principal, whizBang! Developers
[contact info]

---

### Draft B — MicroVM.nix Author (Astro / Julian Stecklina)
*(github.com/astro — via GitHub Discussion or issue)*

---

Hi Julian,

I wanted to reach out as someone who has been running microvm.nix in a production context — specifically in production NixOS infrastructure built and maintained by whizBang! Developers.

First, thank you. microvm.nix has been genuinely transformative for how we architect isolation between services on constrained infrastructure.

I am writing because I want to be a collaborative participant in the project's evolution, not just a downstream user. A few things I had in mind:

- Sharing back our production findings, particularly around satellite-connected and resource-constrained deployment scenarios that may be edge cases you have not seen widely reported
- Flagging any upstream impacts we have encountered so you have that signal
- Understanding your roadmap priorities so we can align our contributions appropriately
- Our integration roadmap touches sops-nix for secret management in VM configs, impermanence for ephemeral-root VMs, and nixos-anywhere + disko for zero-touch node onboarding — all deeply intertwined with how microvm.nix manages guest lifecycles

I have 40+ years in systems/infrastructure work (including embedded, military, and cloud), and I am happy to contribute documentation, testing, issue reports, or code where it is useful.

Is there a preferred channel for this kind of contributor coordination? Happy to move this to Discourse or Matrix if that is more appropriate.

Best,
Mark Weisser

---

### Draft C — Determinate Systems / Tweag / Cachix / Hercules CI
*(Company contact pages — adapt per recipient)*

---

Hi [Name / Team],

My name is Mark Weisser — principal of whizBang! Developers, a technology consulting and development firm building production NixOS infrastructure. [Determinate Systems / Tweag / Cachix / Hercules CI] is a meaningful part of our stack.

I am reaching out because we are in an active phase of expanding our use of microvm.nix within our NixOS infrastructure, and I want to engage with the ecosystem as a collaborator rather than just a user.

Specifically, I would love to:

- Understand how [your company] is thinking about the intersection of microvm.nix and your tooling
- Share our production use cases in case they surface anything useful for your roadmap
- Identify opportunities for contribution or coordination that would benefit the broader community

We are a small but technically serious operation — 40+ years of systems experience, active open-source contributors, and genuinely invested in the long-term health of the Nix ecosystem.

Would a brief call or async exchange make sense?

Best,
Mark Weisser
Principal, whizBang! Developers
[contact info]

---

### Draft D — NixOS Community Forum Post
*(discourse.nixos.org — post in #dev or #vm category)*

---

**Title:** Production microvm.nix user looking to contribute back — where to start?

Hi all,

I am Mark Weisser, principal of whizBang! Developers, a technology consulting and development firm. We build and maintain production NixOS infrastructure for clients, and our stack includes microvm.nix at its core.

Our use case is a bit unusual — satellite-connected, resource-constrained, production infrastructure — and I suspect we have encountered edge cases that are underrepresented in existing community discussion. I want to surface those findings in a useful way.

Our integration roadmap includes: nix-ld (removing the binary objection for NixOS guests), sops-nix (secrets encrypted at rest in VM configs), impermanence (ephemeral-root VMs that boot clean every time), lanzaboote (Secure Boot chain for compliance), nixos-anywhere + disko (zero-touch node onboarding), colmena (fleet deployment), attic (self-hosted binary cache for air-gapped and multi-node environments), nixos-facter (hardware auto-discovery for clusters), and nix-topology (declared topology diagrams).

In short — we are building deep into the Nix ecosystem rather than around it, and I want to make sure that work feeds back upstream where useful.

A few questions:

1. Is there an active working group or SIG for microvm.nix / VM-related NixOS work?
2. What is the preferred path for contributing production findings — GitHub Discussions on the microvm.nix repo, or here on Discourse?
3. Are there other production microvm.nix users in the community I should be talking to?
4. For maintainers of packages we plan to integrate (sops-nix, colmena, attic, nixos-anywhere, nix-topology) — is there a coordination pattern that works well, or should I engage each project individually?

Happy to share specifics. Just want to make sure I am putting the energy in the right places and not duplicating efforts.

Thanks,
Mark

---

*End of document*

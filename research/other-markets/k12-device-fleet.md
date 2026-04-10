<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# K-12 Device Fleet Management — Market Exploration

**Date:** 2026-03-06
**Status:** Could-we exploration — hardware feasibility validation needed
**Relationship to Weaver:** Separate product on shared microvm-anywhere engine (v3.0), not an Weaver plugin

---

## Thesis

Schools waste millions replacing perfectly functional Chromebooks when Google hits them with Auto Update Expiration (AUE). NixOS can rescue this hardware — reflash with a reproducible, centrally-managed OS that gives schools control over their own devices. The management layer is a purpose-built product sharing Weaver's microvm-anywhere engine.

---

## The Problem

- ~50M Chromebooks in US K-12 schools
- ~10M+ hit AUE annually — Google stops security updates, school policy forces replacement
- Replacement cost: $200-400/device
- **A 2,000-device district throws away $400K-800K of functional hardware per cycle**
- Schools are locked into Google's update timeline and ecosystem
- IT departments have limited technical depth
- Student data privacy (FERPA/COPPA) is a growing concern with cloud-dependent platforms

---

## The Solution

```
Post-AUE Chromebook (hardware is fine)
  └── MrChromebox firmware (replace coreboot payload)
      └── NixOS (reproducible, centrally managed)
          └── microVM: student workspace
               ├── Browser (Firefox/Chromium in kiosk mode)
               ├── Educational apps (per-class template)
               ├── Ephemeral home dir (fresh every login)
               └── Network-filtered (school policy)
```

**Student experience:** Log in → microVM spins up from class template → clean environment with class-specific apps → log out → microVM destroyed. No state accumulation, no malware persistence, no cross-contamination.

**IT experience:** One NixOS flake → 2,000 identical devices. Push template updates centrally. No per-device maintenance. Exam lockdown = different template, one click.

---

## Why NixOS + MicroVMs

| Capability | School Value |
|-----------|-------------|
| Reproducible environments (flake.lock) | Every device identical — no "this one's broken" debugging |
| Declarative config | Define device state in code, version control it, audit it |
| Atomic updates + rollback | Push update to fleet, instant rollback if it breaks |
| microVM isolation per student | Clean workspace every session, no persistent malware |
| Ephemeral by default | Nothing persists between logins (or optionally save to network storage) |
| Kiosk mode templates | "Math class" template, "CS class" template, "test day lockdown" template |
| Offline-capable | NixOS works without network — critical for under-connected schools |

---

## Product vs Plugin Decision

**This is a separate product**, not an Weaver plugin. Rationale:

| Dimension | Weaver (VM Dashboard) | School Fleet Manager |
|-----------|-------------------|---------------------|
| Primary user | Sysadmin managing VMs | School IT managing student devices |
| Core concept | Virtual machines on hosts | Physical devices in classrooms |
| UI language | VMs, bridges, topology, provisioning | Classrooms, students, app policies, exam lockdown |
| Scale axis | VMs per host | Devices per school/district |
| Buyer | DevOps / infrastructure team | School IT director / district CTO |

**Shared engine:** Both products use microvm-anywhere (v3.0) for edge device management. The fleet management layer, NixOS deployment, and microVM lifecycle are common. The UI and domain model are different.

---

## SaaS Angle

This is a natural **SaaS product** — schools pay annually, budgets are predictable, and the management plane is cloud-hosted:

| Component | Delivery |
|-----------|----------|
| Management dashboard | Cloud SaaS (school IT logs in via browser) |
| Device agent | NixOS service on each device (phones home to SaaS) |
| Template library | Cloud-hosted, synced to devices |
| Student workspace microVMs | Run locally on each device |
| Student data | Stays on device or school network (FERPA compliance) |

**Pricing model:**
- Per-device/year subscription (e.g., $20-40/device/year)
- District volume pricing
- **ROI pitch:** $30/device/year to manage vs $300/device to replace. Pays for itself in 2 months.

**E-rate eligible:** E-rate Category 2 funds can cover managed device services — this could be partially or fully funded by federal dollars for qualifying schools.

---

## Feature Set

### Core (included in base subscription)

- Device inventory (model, firmware, NixOS version, last check-in, battery health)
- Template management (create, assign to classroom/grade/school)
- Fleet NixOS updates (staged rollout, automatic rollback on failure)
- Student login → ephemeral microVM workspace
- Kiosk mode (restrict to specific apps/URLs per template)
- Network policy (content filtering rules pushed to device)
- Device health monitoring (disk, RAM, battery, WiFi signal)

### Premium (add-on or higher tier)

- Exam lockdown mode (restricted template, no network, timed)
- App deployment (NixOS packages pushed per template)
- Usage analytics (which apps used, session duration — anonymized)
- Multi-school/district management
- LDAP/Google Workspace SSO integration
- Offline mode with sync-on-reconnect

### Enterprise (district-wide)

- Full FERPA compliance dashboard + audit trail
- Role-based access (district admin → school admin → teacher)
- API for SIS (Student Information System) integration
- Custom templates per school/department
- Priority support + SLA

---

## Competitive Landscape

| Player | What They Do | Gap |
|--------|-------------|-----|
| Google Admin Console | Manages Chromebooks natively | Only works on supported ChromeOS; useless post-AUE |
| Mosyle / Jamf | Apple device management | macOS/iOS only |
| Microsoft Intune | Windows device management | Heavy, expensive, Windows-focused |
| Neverware/CloudReady (now ChromeOS Flex) | Extends Chromebook life with ChromeOS Flex | Still Google-dependent; limited customization; Google controls updates |
| **This product** | Rescue post-AUE hardware with NixOS + microVMs | No direct competitor in this space |

**ChromeOS Flex is the closest competitor** but it's still Google-controlled. Schools trading one Google dependency for another. NixOS gives schools actual ownership of their device fleet.

---

## Challenges

| Challenge | Severity | Mitigation |
|-----------|----------|------------|
| Chromebook firmware (MrChromebox) | High | Not all models supported. Maintain tested hardware compatibility list. Start with well-supported models (Intel-based). |
| Google Workspace dependency | High | Web apps (Docs, Classroom, Meet) work in any browser. The OS doesn't matter if the browser works. Position as "same Google apps, your hardware, your control." |
| School IT skill level | High | Product MUST be appliance-simple. Zero NixOS knowledge required. Cloud dashboard with one-click operations. USB installer for initial flash. |
| ARM Chromebooks | Medium | Focus on x86 models first (larger install base, better NixOS support). ARM support as growth phase. |
| WiFi driver support | Medium | Test and maintain WiFi compatibility matrix per Chromebook model. Ship with broadest-support kernel config. |
| Procurement cycles | Medium | Annual budget cycle (decisions in spring for fall). Long sales cycle but predictable. |
| FERPA/COPPA compliance | Medium | Student data stays on-device/school-network by design. Get formal compliance certification. |

---

## Validation Steps

1. **Hardware feasibility (do first):**
   - **Existing asset:** Mark has an Acer Chromebook available and has reviewed the NixOS flash process. Community posts confirm NixOS running on Chromebooks already exists — partial validation.
   - Flash MrChromebox firmware on the Acer
   - Install NixOS minimal
   - Boot a microVM (student workspace)
   - Measure: boot time, RAM usage, WiFi support, battery life
   - **If this fails, the product is dead. Do this before anything else.**
   - **Timing:** Low priority now. Run this test when v3.0 (microvm-anywhere) planning begins.

2. **Teacher/IT interviews:**
   - Talk to 3-5 school IT administrators about Chromebook lifecycle pain
   - Validate: is AUE-driven replacement actually happening at scale?
   - Understand: what would they need to consider an alternative?

3. **ChromeOS Flex comparison:**
   - Install ChromeOS Flex on same hardware
   - Compare: what does NixOS + microVM offer that Flex doesn't?
   - If the delta is small, this product doesn't have a moat

4. **E-rate research:**
   - Verify E-rate Category 2 eligibility for managed device services
   - If E-rate covers it, the price sensitivity drops dramatically

---

## Timeline (independent of Weaver roadmap)

```
Now:        Hardware feasibility test (Chromebook + NixOS + microVM)
            If fails → shelve
            If succeeds ↓

v3.0 era:   microvm-anywhere engine available
            Fork management UI from Weaver dashboard patterns
            Build school-specific domain model (classrooms, templates, students)

Post-v3.0:  Pilot with 1-2 friendly school districts
            Iterate on IT admin UX (must be zero-NixOS-knowledge)
            FERPA compliance certification

Launch:     SaaS product with per-device pricing
            USB installer + cloud dashboard
            Hardware compatibility list (tested Chromebook models)
```

**Key dependency:** microvm-anywhere (v3.0) is the engine. This product can't launch before that's built. But the hardware validation and market research can happen now.

---

## Revenue Potential

| Scale | Devices | Annual Revenue (at $30/device/year) |
|-------|---------|-------------------------------------|
| Single school | 500 | $15K |
| Small district | 5,000 | $150K |
| Medium district | 20,000 | $600K |
| Large district | 50,000 | $1.5M |
| State contract | 500,000 | $15M |

Even capturing 1% of the annual AUE device flow (100K devices) at $30/device = **$3M ARR**.

The economics are compelling because the alternative is $200-400/device in hardware replacement. Schools are literally throwing money away. This product turns a cost center into a subscription that's 10x cheaper than replacement.

---

*Cross-reference: [ai-infrastructure-vertical.md](../ai-infrastructure-vertical.md) | [microvm-anywhere-nix-templates.md](../microvm-anywhere-nix-templates.md) | [MASTER-PLAN.md](../../MASTER-PLAN.md)*

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Execution Roadmap — v1.3.0 (Remote Access + Mobile)

**Last updated:** 2026-03-11

One-time setup, zero ongoing maintenance. Tailscale and WireGuard NixOS wizards establish secure remote access to the backend in a single host rebuild — then Live Provisioning and the Capacitor mobile app work from anywhere, forever. For full container management (v1.2.0), see [v1.2.0/EXECUTION-ROADMAP.md](../v1.2.0/EXECUTION-ROADMAP.md). For cross-resource AI (v1.4.0), see [v1.4.0/EXECUTION-ROADMAP.md](../v1.4.0/EXECUTION-ROADMAP.md). For the full product roadmap and decision log, see [MASTER-PLAN.md](../../MASTER-PLAN.md).

## Phase Overview

```
Phase 7d: Remote Access + Mobile (v1.3.0)          ░░░░░░░░░░░░░░░░░░░░  PLANNED
```

---

## Phase 7d: Remote Access + Mobile (v1.3.0)

### Networking Wizards

| Task | Tier | Priority |
| --- | --- | --- |
| Tailscale setup wizard — generates NixOS config, user runs one rebuild | Free | High |
| WireGuard setup wizard — generates NixOS config, user runs one rebuild | Weaver | High |
| Network Isolation Mode — toggle disables tunnel, VMs unaffected, NixOS rollback | Weaver | High |
| Wizard UI: step-by-step config generation + rebuild instructions | Free | High |
| Backend: detect active tunnel type (Tailscale / WireGuard / none) | Free | Medium |
| Settings page: tunnel status + re-run wizard + isolation toggle | Free | Medium |

### Capacitor Mobile App

Android ships at v1.3.0 GA. iOS follows at v1.3.x (Apple Developer Program enrollment + TestFlight beta required).

| Task | Tier | Priority |
| --- | --- | --- |
| Quasar Capacitor mode: Android build pipeline (v1.3.0) | Free | High |
| Quasar Capacitor mode: iOS build pipeline (v1.3.x) | Free | High |
| Mobile-optimized layouts (Weaver, workload list, workload detail) | Free | High |
| Biometric auth (Face ID / fingerprint) | Free | High |
| Mobile-specific touch targets + navigation patterns | Free | Medium |
| E2E specs for mobile-critical flows | Free | High |
| Google Play submission (v1.3.0) | Free | High |
| App Store submission (v1.3.x, after iOS build) | Free | High |
| Push notifications: VM state changes, resource alerts | Weaver | High |
| Deep links for VM actions (start/stop from notification) | Weaver | Medium |

---

## Design Decisions

### Networking Wizard Philosophy

- **Setup wizard only** — one `nixos-rebuild switch` ever. Not a recurring operation.
- **Tailscale = Free** — onboarding funnel, zero-friction remote access. Tailscale manages coordination. Good demo moment: install dashboard, activate Tailscale, open mobile app.
- **WireGuard = Weaver** — self-hosted, no external dependency. Air-gap friendly. Preferred for defense, healthcare, and government customers.
- **Network Isolation Mode** — NixOS generations make rollback free. "Close" the host to remote access without destroying VMs or data. Compliance/audit use case.

### Mobile App Tier Strategy

The mobile app is a **Free tier feature** (Decision #50). Core app — Workbench, workload control, biometric auth, Tailscale remote access — is available to all users. Push notifications and deep links from notifications are Weaver-only, serving as the natural in-app upgrade prompt.

**Why Free:** No competitor, including Proxmox, has a free native mobile app. App Store presence is organic marketing. The NixOS/homelab audience skews Linux/Android. Giving Free users a pocket control plane dramatically raises perceived value of the product and drives top-of-funnel growth at zero marginal cost per install.

**Android-first:** Android ships at v1.3.0 GA — $25 one-time Google Play fee, 2–7 day review, fastest to market. iOS follows at v1.3.x after Apple Developer Program enrollment ($99/year) and TestFlight beta cycle (4–6 weeks).

### Mobile Connectivity

Remote access requires the networking wizard to have been run. Weaver validates tunnel status and prompts user to run wizard if not configured. Local network access works without wizard.

---

## Release Plan

| Version | Milestone | Key Features | Status |
| --- | --- | --- | --- |
| v1.3.0 | Remote Access + Mobile | Tailscale wizard (Free), WireGuard wizard (Weaver), Network Isolation Mode, Capacitor Android app (Free), push notifications (Weaver), biometric auth (Free) | Planned |
| v1.3.x | iOS Mobile | App Store submission, iOS build pipeline, Face ID — same Weaver Free/Weaver split as Android | Planned |

---

*See [MASTER-PLAN.md](../../MASTER-PLAN.md) for the full product roadmap and decision log. For the private demo mock spec (wizard flow, phone frame, per-tier Welcome screen sequences), see [DEMO-SPEC.md](DEMO-SPEC.md).*

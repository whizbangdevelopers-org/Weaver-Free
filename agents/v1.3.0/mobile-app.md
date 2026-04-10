<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: v1.3-mobile-app — Capacitor iOS/Android Mobile App

**Priority:** High #2
**Tier:** Weaver Free (core app) / Weaver (push notifications, deep links) — Decision #50
**Plan:** [EXECUTION-ROADMAP](../../plans/v1.3.0/EXECUTION-ROADMAP.md)
**Parallelizable:** No (depends on networking-wizards complete)
**Blocks:** None (v1.4.0 Cross-Resource AI is independent)

---

## Scope

Build the Quasar Capacitor mobile app from the existing Vue 3 + Quasar codebase. Same code, native Android output at v1.3.0 GA, iOS at v1.3.x. App core (dashboard, VM control, biometric auth, Tailscale remote) is Free tier. Push notifications and deep links from notifications are Weaver. Android ships first — $25 one-time Google Play fee, 2–7 day review. iOS follows after Apple Developer Program enrollment ($99/yr) + TestFlight beta (4–6 weeks).

### What's Already Done

<!-- MANDATORY: Scan the actual codebase before filling this in. Prior specs may be stale. -->
<!-- Run the e2e-test-writer pre-flight and grep for relevant files. Trust what you see, not prior specs. -->

- Full Vue 3 + Quasar web app (same codebase)
- JWT auth infrastructure
- WebSocket for real-time VM state
- Push notification adapter interface (BYON pattern, v1.0)

### Deliverables

**v1.3.0 GA (Android)**

| Task | Tier | Priority |
| --- | --- | --- |
| Quasar Capacitor mode: Android build pipeline | Free | High |
| Mobile-optimized layouts (Weaver, workload list, workload detail) | Free | High |
| Biometric auth (fingerprint / PIN) | Free | High |
| Mobile-specific touch targets + navigation patterns | Free | Medium |
| E2E specs for mobile-critical flows | Free | High |
| Google Play submission | Free | High |
| Push notifications: VM state changes, resource alerts | Weaver | High |
| Deep links for VM actions (start/stop from notification) | Weaver | Medium |

**v1.3.x Follow-up (iOS)**

| Task | Tier | Priority |
| --- | --- | --- |
| Quasar Capacitor mode: iOS build pipeline | Free | High |
| Face ID biometric auth | Free | High |
| TestFlight beta distribution | Free | High |
| App Store submission | Free | High |

### Acceptance Criteria

**v1.3.0 (Android)**
- [ ] Android build compiles and runs on emulator
- [ ] Free tier: Weaver, workload list/detail, start/stop/restart render and function
- [ ] Biometric auth (fingerprint) works on emulator
- [ ] Mobile layouts render correctly at 360px and 390px widths
- [ ] Weaver gating: push notification UI shows upgrade prompt for Free users
- [ ] Google Play review submitted
- [ ] All tests pass (`test:precommit`)

**v1.3.x (iOS)**
- [ ] iOS build compiles and runs on simulator
- [ ] Face ID works on simulator
- [ ] TestFlight beta distributed to testers
- [ ] App Store review submitted

### Manual Gates

- Google Play approval (1–3 days review) — v1.3.0 ships when approved
- App Store approval (1–7 days review) — v1.3.x ships when approved

---

*See [MANIFEST.md](MANIFEST.md) for execution order and quality gates.*

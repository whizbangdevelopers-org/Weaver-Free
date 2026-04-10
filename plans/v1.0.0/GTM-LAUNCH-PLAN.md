<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Go-to-Market Launch Plan

**Last updated:** 2026-04-03
**Status:** Infrastructure Ready — Agents & demo scaffolding created, content generation pending. Tier matrix decided (2026-02-18), free-tier exposure strategy added (2026-02-19). Public demo strategy formalized (Decision #135, 2026-04-03).
**Target:** Execute alongside/after v1.0 release
**Depends on:** v1.0.0 tagged and published

### Infrastructure Completed

- Claude Code agents created in Dev repo (`agents/gtm/content.md`, `agents/gtm/demo.md`)
- Demo mode config: `src/config/demo.ts` (detection, 8-VM data, links)
- Demo build script: `scripts/build-demo.sh`
- Enhanced sample data: `demo/sample-vms/vms.json` (8 VMs, multi-distro/hypervisor/status)
- Existing infrastructure verified: `DemoBanner.vue`, `DemoLoginPage.vue`, `demo-deploy.yml`, `demo-reset.yml`
- Marketing tasks added to `docs/planning/DEV-TODO.md`

---

## Goal

Launch Weaver to the NixOS and homelab communities. Build initial user base, generate word-of-mouth, and establish the project as the definitive NixOS VM management tool.

---

## Execution Tracks

Two independent tracks run in parallel:

```
Track 1:    Content (README, blog, comparison pages, SEO)
Track 2:    Demo site (live demo, sample data, deployment)
```

Both can start before v1.0 ships (content drafting, demo infrastructure) but launch timing depends on v1.0 being tagged.

---

## Track 1: Content & Community Launch

**Agent:** [content](../../agents/gtm/content.md)

### 1a. README Rewrite

Both repos need polished READMEs for launch:

**Dev repo README** (`Weaver-Dev/README.md`) — **DONE (2026-02-22)**:
- ~~Hero screenshot (dashboard with VMs in various states)~~ Done — `hero-dashboard.png` (8 VMs, tier-switcher)
- ~~Feature list with badges~~ Done — TypeScript, Vue 3, Quasar, Fastify, NixOS
- ~~Quick start~~ Done — NixOS module, Docker, npm dev setup
- ~~Architecture diagram~~ Done — ASCII art with browser/backend/NixOS layers
- ~~Feature comparison table~~ Done — 3-tier breakdown (Weaver Free/Weaver/Fabrick)
- ~~Screenshots~~ Done — 11 automated PNGs via `scripts/capture-screenshots.sh`
- ~~Contributing guidelines~~ Done — CONTRIBUTING.md rewritten
- ~~License~~ Done — AGPL-3.0 + Commons Clause + AI Training Restriction

**Free repo README** (`Weaver/README.md`):
- Same structure but focuses on free-tier features
- Clear upgrade path: what Weaver and Fabrick unlock
- Link to demo site for tier-switcher experience
- Community template contribution guide

### 1b. Blog Content

| Post | Target Channel | SEO Keyword | Purpose |
|------|---------------|-------------|---------|
| "Why I Built a Weaver for microvm.nix" | dev.to, personal blog | microvm.nix tutorial | Origin story, authentic, shareable |
| "Managing NixOS VMs Without the Terminal" | r/NixOS, Discourse | NixOS VM management | Show the product solving a real pain |
| "Weaver vs Proxmox: When NixOS is Your OS" | Blog, HN | Proxmox alternative NixOS | SEO for VMware refugees |
| "Declarative VMs with a GUI: The Best of Both Worlds" | dev.to, HN | declarative VM management | Position the niche |
| "From Docker to MicroVMs: A NixOS Migration Story" | r/selfhosted, blog | Docker to NixOS | Bridge Docker audience to NixOS |

### 1c. Community Launch Checklist

| Action | Channel | Timing |
|--------|---------|--------|
| Post announcement | r/NixOS | Launch day |
| Post announcement | r/homelab | Launch day |
| Post announcement | r/selfhosted | Launch day |
| Post on NixOS Discourse | discourse.nixos.org | Launch day |
| Submit to Hacker News | news.ycombinator.com | Launch day (afternoon, Tuesday–Thursday) |
| Submit PR to awesome-nix | GitHub | Launch week |
| Submit PR to awesome-selfhosted | GitHub | Launch week |
| Create demo video (3–5 min) | YouTube | Pre-launch |
| Post video to r/homelab | Reddit | Launch week |

### 1d. Comparison & Migration Content

| Page | Purpose | Target Query |
|------|---------|-------------|
| Weaver vs Proxmox | Feature comparison | "proxmox alternative nixos" |
| Weaver vs Incus | Feature comparison | "incus vs microvm" |
| Weaver vs Cockpit | Feature comparison | "cockpit vm management nixos" |
| Weaver vs Pegaprox | Feature comparison | "pegaprox alternative", "proxmox multi-cluster" |
| Migrating from VMware to NixOS | Migration guide | "vmware alternative open source" |
| Why NixOS for VM Management | Educational | "nixos vm management" |

Format: Markdown pages in the demo site or blog, optimized for search.

### 1e. SEO Strategy

**Primary keywords:**
- "NixOS VM management"
- "microvm.nix dashboard"
- "NixOS VM dashboard"
- "declarative VM management"

**Secondary keywords:**
- "Proxmox alternative NixOS"
- "Pegaprox alternative"
- "VMware alternative open source"
- "lightweight VM management"
- "homelab VM dashboard"

**Technical SEO:**
- Demo site has proper meta tags, OpenGraph images, structured data
- README has relevant keywords naturally included
- Blog posts target long-tail queries
- GitHub repo description and topics optimized

---

## Free-Tier Exposure Strategy

The demo site showcases UI and feature breadth via mock data. But some free-tier features only deliver their "aha moment" on a real host. These need dedicated marketing coverage because the demo can't sell them.

### Exposure Gaps

| Feature | Why Demo Can't Sell It | Marketing Action |
|---------|----------------------|------------------|
| **AI Agent BYOK flow** | Demo shows canned mock responses. The real experience is pasting your own API key and getting live Claude analysis of *your* VMs. This is the conversion hook from free to daily use. | First-run onboarding prompt that makes key entry dead simple. Screenshot/video of live agent diagnosing a real failure. Blog post: "AI-Powered VM Diagnostics with Your Own API Key." |
| **WebSocket real-time updates** | Demo simulates status on a timer. The visceral experience of starting a VM in terminal and watching the card flip to green instantly only works on a real host. | Screen recording: terminal `microvm start` → dashboard card transitions in real time. GIF for README hero. |
| **Network topology with real bridges** | Demo shows a static canned topology. Free tier auto-detects real bridges and shows actual network relationships. For NixOS users with `br-microvm` already configured, this "just works." | Screenshot of real topology with actual bridge names and IPs. Comparison: "demo topology" vs "your topology after install." |
| **VM scanning & registration** | Demo has pre-loaded mock VMs — the scan flow is invisible. Scanning is the onboarding story for NixOS declarative users who already have VMs running. Install dashboard, scan, done. | 3-step quick start: install → scan → manage. This IS the README hero flow. Video: fresh install to populated dashboard in under 60 seconds. |

### Content Priorities

These gaps should drive the content calendar:

1. **README hero flow** — scan & register (install → running dashboard in 60s)
2. **Demo video B-roll** — real-time WebSocket + live topology (intercut with demo UI)
3. **Blog post #1 priority** — BYOK agent story (authentic, differentiating, shareable)
4. **Screenshot set** — real topology, real WebSocket transitions, real agent output (not mock)

---

## Conversion Hooks (Free → Weaver)

What makes a free user reach for their wallet:

| Hook | Trigger Moment | Tier Gate |
|------|---------------|-----------|
| **"I want to create a VM from the dashboard"** | User clicks Create VM, hits the tier gate. They've been managing existing VMs and now want the full lifecycle. | Weaver |
| **"I'm tired of pasting my API key"** | BYOK works but requires manual key entry each session. Server-provided key is set-and-forget convenience. | Weaver |
| **"I hit the rate limit"** | 5 agent requests/min is enough to try it. Not enough for daily use. The 10/min weaver tier removes the friction. | Weaver |
| **"I want to manage my distros"** | User wants to add a new distro or refresh an image. View-only free tier shows what's available but won't let them act. | Weaver |
| **"I need push alerts"** | In-app notification bell works, but the user wants Slack/email/webhook alerts when a VM fails at 3am. | Weaver |
| **"I need my bridge layout"** | User can see auto-detected bridges but wants to create/manage bridges and IP pools from the UI. | Weaver |

### Weaver → Fabrick Hooks

| Hook | Trigger Moment | Tier Gate |
|------|---------------|-----------|
| **"My team needs access control"** | Multiple people managing VMs, need per-VM permissions. | Fabrick |
| **"I need to audit who did what"** | Compliance requirement or incident investigation — who restarted that VM? | Fabrick |
| **"Bulk operations"** | Managing 20+ VMs, need start-all / stop-all / restart-by-tag. | Fabrick |
| **"Resource quotas"** | Team members spinning up VMs without limits. Need guardrails. | Fabrick |

---

## Track 2: Demo Site

**Agent:** [demo](../../agents/gtm/demo.md)

> **Note (2026-04-03):** Track 2 has been superseded by [Decision #135](../../MASTER-PLAN.md) and [TWO-DEMO-STRATEGY.md](TWO-DEMO-STRATEGY.md). The single-demo concept below is now the **private demo** (investor/QA). The **public demo** is a separate marketing funnel build with three presentation patterns:
>
> | Pattern | What prospect sees | Currently |
> |---------|-------------------|-----------|
> | **Full interactive** | Released tier with version progression + mock data | Free (v1.0–v1.3) |
> | **Interactive teaser** | Next tier to ship — real mock data, scoped, no version progression | Solo |
> | **Marketing/identity page** | Further-out tiers — no features, FM push, CTA → WBD website | Team, Fabrick |
>
> The version switcher IS the funnel: `v1.0 → … → v1.3 → Solo → Team → Fabrick → Pricing`. Each tier graduates through the lifecycle when the next tier enters development. Public demo deploys via `demo/*` tag, not auto-deploy from main. Port 9030 (public) / 9040 (private).

### 2a. Demo Site Deployment

**URL:** `https://weaver-demo.github.io`
**Platform:** GitHub Pages (free, reliable, custom domain later)

**Key principle:** The demo IS the SPA. The same Quasar PWA build (`npm run build`) deployed with `DEMO_MODE=true` backend. No separate demo codebase. This means the demo can be hosted anywhere — GitHub Pages, Netlify, any static host — it's always the same artifact.

**Tier-switcher showcase (decided 2026-02-18, amended by Decision #135):** The **private demo** runs ALL features against mock data with a toolbar toggle that lets visitors switch between Weaver Free, Weaver, and Fabrick views. The **public demo** locks to Free tier with a linear funnel stepper (version switcher navigates through Free versions → Solo teaser → Team/Fabrick marketing pages → Pricing). See Decision #135 for full specification.

**Architecture:**
```
Any static host
├── index.html (Quasar PWA/SPA build — same build as production)
├── demo-data/ (bundled sample VMs, mock API)
└── assets/

Tier-switcher toolbar:
┌─────────────────────────────────────────────────────┐
│  🔀 Viewing as: [Weaver Free ▾] [Weaver ▾] [Fabrick ▾] │
│  Try switching tiers to see what unlocks →           │
└─────────────────────────────────────────────────────┘
```

The demo runs in **mock mode** — no real backend needed. The frontend uses the existing mock VM service (`src/services/mock-vm.ts`) to simulate a live dashboard. The SPA is the universal distribution artifact for demos, regardless of hosting platform. The tier-switcher overrides the runtime tier config, letting visitors experience each tier's feature set without separate deployments.

**Deliverables:**

| Component | Description |
|-----------|-------------|
| Demo build script | `scripts/build-demo.sh` — builds PWA with demo mode flags |
| Demo config | `src/config/demo.ts` — sample VM definitions, mock responses |
| Demo data | `demo/sample-vms/` — realistic VM set with varied states |
| GitHub Pages deploy | `.github/workflows/deploy-demo.yml` — auto-deploy on release |
| Landing header | Banner: "This is a demo. [Get started →](install link)" |
| Demo restrictions | Read-only actions work, mutations show "Demo mode" toast |

### 2b. Sample Data Set

Realistic VMs that showcase all features:

| VM Name | Status | Distro | Hypervisor | IP | Purpose |
|---------|--------|--------|------------|-----|---------|
| web-nginx | running | NixOS | QEMU | 10.10.0.10 | Web server |
| web-app | running | NixOS | Cloud Hypervisor | 10.10.0.11 | Node.js app |
| dev-python | running | Ubuntu 24.04 | QEMU | 10.10.0.20 | Dev environment |
| db-postgres | running | Rocky Linux 9 | QEMU | 10.10.0.30 | Database |
| ci-runner | stopped | NixOS | Firecracker | 10.10.0.40 | CI build runner |
| staging-env | failed | Alma Linux 9 | QEMU | 10.10.0.50 | Staging (simulates failure) |
| win-desktop | running | Windows 11 | QEMU | 10.10.0.60 | Windows VM |
| monitoring | running | NixOS | QEMU | 10.10.0.70 | Grafana + Prometheus |

This set demonstrates: multiple distros, multiple hypervisors, all status types, Windows support, varied use cases.

### 2c. Demo Features

What works in demo mode (all tiers visible via tier-switcher):

| Feature | Demo Behavior | Tier |
|---------|--------------|------|
| Weaver + VM list | Shows all sample VMs with real-time status simulation | All |
| VM detail, console, logs | Full detail pages with mock data | All |
| Network topology | Topology graph with bridge + all VMs (mock) | All |
| Start/Stop/Restart | Simulated with delay + status change | Free+ |
| AI diagnostics | Mock agent responses (already built), BYOK prompt shown | Free+ |
| Notification bell + history | In-app notifications with mock events | Free+ |
| Help system | Fully functional | All |
| Settings | Viewable, changes don't persist | All |
| Tier-switcher toolbar | Toggle Weaver Free/Weaver/Fabrick — features lock/unlock live | Demo |
| Create/Provision VM | Shows form, mock provisioning (locked in Free view) | Weaver+ |
| Distro management | Shows distro list, mutations locked in Free view | Weaver+ |
| Bridge management | Shows bridges, create/delete locked in Free view | Weaver+ |
| Push notifications | Config UI shown, locked in Free view | Weaver+ |
| Per-VM access control | RBAC UI shown, locked in Weaver Free/Weaver view | Fabrick |
| Bulk operations | Multi-select shown, locked in Weaver Free/Weaver view | Fabrick |
| Audit log | Audit page shown, locked in Weaver Free/Weaver view | Fabrick |

What's restricted (regardless of tier-switcher position):

| Feature | Demo Behavior |
|---------|--------------|
| Login | Bypassed (demo user auto-logged in) |
| Real provisioning | Simulated only (no backend) |
| Real WebSocket | Simulated status changes on timer |
| BYOK agent calls | Shows prompt but doesn't execute (no backend) |

---

## Pricing Activation

### Pre-Launch Prep (before v1.0)

| Task | Description |
|------|-------------|
| Stripe account | Set up Stripe for payment processing |
| Pricing page | Design pricing comparison (Weaver Free / Weaver / Fabrick) |
| License key generator | Internal tool from v1-license agent |
| Payment webhook | Stripe webhook → generate license key → email to customer |
| Landing page | Simple page: hero, features, pricing, demo link, install link |

### Post-Launch

| Task | Description |
|------|-------------|
| Monitor conversion | Track free → premium conversion rate |
| Collect feedback | GitHub Discussions for feature requests |
| Founding Member pricing | Discounted "Founding Member" pricing for first 50 customers |
| Case study | Interview Founding Member, write up use case |

### Pricing (aligned to decided tier model, 2026-02-18)

| Tier | Price | Target | Positioning |
|------|-------|--------|-------------|
| Free | Free forever | Self-hosters, NixOS declarative users, evaluators | "Use the VMs you already have" — dashboard + manage existing |
| Weaver | $15/mo or $150/yr | Power users, small teams, anyone creating VMs | "Create and control" — provisioning, distros, bridges, push alerts |
| Fabrick | Custom (~$200+/mo) | Organizations with compliance/governance needs | "Team governance" — per-VM RBAC, quotas, bulk ops, audit log |

> **Note:** "Pro Hosted" (managed service) deferred — v1.0.0 is self-hosted only. Revisit post-launch if demand exists.

---

## Launch Timeline

```
Week -4:  Content drafting (blog posts, README)
Week -3:  Demo site infrastructure, sample data
Week -2:  Demo site testing, video recording
Week -1:  Final review, schedule posts
Day 0:    v1.0.0 tag → GitHub Release → sync-to-free → demo deploy
Day 0:    Reddit posts (r/NixOS, r/homelab, r/selfhosted)
Day 0:    NixOS Discourse post
Day 1:    Hacker News submission
Day 2:    awesome-nix PR, awesome-selfhosted PR
Week 1:   YouTube video published
Week 2:   First blog post (origin story)
Week 3:   Second blog post (comparison)
Week 4:   Review analytics, adjust strategy
```

---

## Success Metrics

### Month 1

| Metric | Target |
|--------|--------|
| GitHub stars | 200+ |
| GitHub forks | 20+ |
| Demo site visits | 1,000+ |
| NUR installs | 50+ |
| Discord/community members | 30+ |

### Month 3

| Metric | Target |
|--------|--------|
| GitHub stars | 500+ |
| Active users (telemetry opt-in) | 100+ |
| Community template contributions | 5+ |
| Blog post total views | 5,000+ |

### Month 6

| Metric | Target |
|--------|--------|
| GitHub stars | 1,000+ |
| Active users | 300+ |
| First paying customers | 5–10 |
| MRR | $100+ |

---

## Files Summary

### Track 1: Content

| File | Location | Description |
|------|----------|-------------|
| README.md | Dev repo root | Rewritten for launch — **DONE** |
| README.md | Free repo root | Community edition version (syncs from dev) |
| CONTRIBUTING.md | Dev repo root | Rewritten with CoC, feedback mechanisms — **DONE** |
| `scripts/capture-screenshots.sh` | Dev repo | Automated screenshot pipeline — **DONE** |
| `docs/designs/*.png` (x11) | Dev repo | Marketing screenshots — **DONE** |
| Blog posts | External (dev.to, blog) | 5 posts drafted |
| Comparison pages | Demo site or docs | vs Proxmox, vs Incus, vs Cockpit, vs Pegaprox |

### Track 2: Demo Site

| File | Location | Description |
|------|----------|-------------|
| `scripts/build-demo.sh` | Dev repo | Demo build script |
| `src/config/demo.ts` | Dev repo | Demo mode configuration |
| `demo/sample-vms/` | Dev repo | Enhanced sample data |
| `.github/workflows/deploy-demo.yml` | Demo repo | Auto-deploy workflow |

---

## Verification Checklist

1. Demo site loads at `https://weaver-demo.github.io`
2. All 8 sample VMs visible with correct statuses
3. Tier-switcher toolbar works — toggling Weaver Free/Weaver/Fabrick locks/unlocks features live
4. Network map renders with bridge + VM topology
5. Mock AI diagnostics work in demo
6. "Demo mode" banner visible, mutations show toast
7. README renders correctly on GitHub (both repos) with 3-tier feature comparison
8. Blog posts reviewed and scheduled (BYOK agent post prioritized)
9. Launch day posts drafted for all channels
10. Video recorded — includes real-host B-roll (WebSocket transitions, live topology, VM scanning)
11. Pricing page designed with Weaver Free/Weaver/Fabrick tiers
12. Free-tier quick start: install → scan → manage in under 60 seconds

---

## Channel Partners & Design Partners (Decision #38)

The NixOS commercial ecosystem has consulting firms that are the front door to enterprise deployments. Full landscape in [nixos-commercial-ecosystem.md](../../research/nixos-commercial-ecosystem.md).

### Post-launch channel outreach (Phase 2)

| Partner | Action | When | Expected yield |
|---|---|---|---|
| **Numtide** | First outreach — closest to our target (bare-metal NixOS SMBs) | Post v1.0 launch | Direct introductions to SMB/mid-market clients |
| **Nixcademy** | Training partnership — include Weaver in course materials | Post v1.0 launch | Awareness at the moment teams are learning NixOS |
| **Determinate** | Integration docs + FlakeHub listing | Post v1.0 launch | Ecosystem visibility, organic adoption |
| **Tweag** | Fabrick outreach — needs container visibility for credibility | Post v1.1 | Fabrick introductions, co-selling |
| **Hercules CI** | hercules-ci-effects deploy integration example | v2.0 | CI→deploy pipeline story |

### Design Partner program

For prominent NixOS companies that engage directly. Max 3–5 simultaneously.

- Fabrick tier (standard or 20% Y1 discount for marketing rights)
- Partner success program ($30k/yr) with roadmap influence
- Marketing rights: logo on website, joint case study, reference calls (max 4/yr)
- Early access to next version, direct feedback channel
- Converts to standard Fabrick + Partner after 12 months

---

*Cross-reference: [MASTER-PLAN.md](../../MASTER-PLAN.md) | [BUSINESS-MARKETING-ANALYSIS.md](../../business/marketing/BUSINESS-MARKETING-ANALYSIS.md) | [self-hoster-demographics.md](../../research/self-hoster-demographics.md) | [nixos-commercial-ecosystem.md](../../research/nixos-commercial-ecosystem.md)*

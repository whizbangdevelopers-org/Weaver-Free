<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Agent: gtm-content — Content & Community Launch

**Plan:** [GTM-LAUNCH-PLAN](../../plans/v1.0.0/GTM-LAUNCH-PLAN.md) (Track 1)
**Parallelizable:** Yes (independent of demo site)
**Blocks:** None

---

## Scope

Create all launch content: README rewrites for both repos, blog post drafts, comparison pages, community launch posts, and video script. This is the marketing surface area for the v1.0 launch.

---

## Context to Read Before Starting

| File | Why |
|------|-----|
| `code/README.md` | Current README to rewrite |
| `business/marketing/BUSINESS-MARKETING-ANALYSIS.md` | Marketing positioning, taglines, segment messaging |
| `research/self-hoster-demographics.md` | Target audience data |
| `research/competitive-landscape.md` | Competitive positioning for comparison content |
| `plans/GTM-LAUNCH-PLAN.md` | Launch timeline and channels |
| `code/CLAUDE.md` | Sync-to-free exclusions |

---

## Inputs

- v1.0 feature set (all phases complete)
- Business analysis with positioning statements
- Competitive analysis with feature comparisons
- Demographic research

---

## Outputs

### README Files

| File | Repo | Description |
|------|------|-------------|
| `code/README.md` | Dev (private) | Full README with weaver features |
| `README-free.md` (draft) | For Free repo | Community edition README |

### Dev README Structure

```markdown
# Weaver

> Manage your entire VM fleet from your pocket.

[Screenshot: Weaver with VMs in various states]

## Features

- Weaver with real-time status (WebSocket)
- VM lifecycle management (start, stop, restart, create, delete)
- Network topology map with visual graph
- Serial console (xterm.js) in the browser
- AI-powered VM diagnostics (Claude, BYOK)
- Multi-hypervisor (QEMU, Cloud Hypervisor, Firecracker, crosvm, kvmtool)
- Windows + Linux guest support
- Curated distro catalog
- Help system with getting started wizard
- Keyboard shortcuts
- Mobile-responsive PWA

### Weaver Features
- Network management (bridges, IP pools, firewall rules)
- Authentication (JWT, role-based access)
- Audit logging
- License key system

## Quick Start

[3-step setup: clone, install, run]

## NixOS Deployment

[NixOS module configuration example]

## Architecture

[Diagram: Quasar + Fastify + NixOS]

## Screenshots

[4-6 screenshots: dashboard, network map, console, settings, mobile]

## Tech Stack

[Badges: TypeScript, Vue 3, Quasar, Fastify, Vitest, Playwright]

## Contributing

[Guidelines link]

## License

MIT
```

### Free README Differences

- No weaver features section
- "Upgrade to Weaver" mention with link
- Community template contribution guide
- Focus on what free tier includes (everything for monitoring + Linux VMs)

### Blog Post Drafts

| # | Title | Length | Target |
|---|-------|--------|--------|
| 1 | "Why I Built a Weaver for microvm.nix" | ~1500 words | dev.to, personal blog |
| 2 | "Managing NixOS VMs Without the Terminal" | ~1200 words | r/NixOS, Discourse |
| 3 | "Weaver vs Proxmox: Different Tools for Different Needs" | ~1500 words | Blog, HN |
| 4 | "Declarative VMs with a GUI: The Best of Both Worlds" | ~1000 words | dev.to, HN |
| 5 | "From Docker to MicroVMs: A NixOS Migration Story" | ~1200 words | r/selfhosted |

**Blog post format:** Each should include:
- Hook (relatable problem)
- Screenshot or diagram
- Key differentiator
- Getting started link
- Demo site link

### Community Launch Posts

| Channel | Format | Key Message |
|---------|--------|-------------|
| r/NixOS | Text post | "I built a web dashboard for microvm.nix" — focus on NixOS integration |
| r/homelab | Image post (screenshot) + text | "Free VM dashboard for self-hosters" — focus on zero cost, lightweight |
| r/selfhosted | Text post | "Open source VM management dashboard" — focus on self-hosting |
| NixOS Discourse | Announcement | Technical focus, NixOS module, contribution invitation |
| Hacker News | Link to blog post or demo | "Show HN: Weaver — declarative VM management for NixOS" |

### Comparison Pages

| File | Content |
|------|---------|
| `docs/comparisons/vs-proxmox.md` | Feature table, use case comparison, when to use which |
| `docs/comparisons/vs-incus.md` | Closest competitor, NixOS integration comparison |
| `docs/comparisons/vs-cockpit.md` | Lightweight comparison, NixOS support gap |

### Video Script

5-minute demo video outline:
1. (0:00) Intro: "Weaver in 5 minutes"
2. (0:30) Weaver overview — VMs, statuses, cards
3. (1:00) VM actions — start, stop, restart, detail view
4. (1:30) Network topology map
5. (2:00) Serial console
6. (2:30) AI diagnostics
7. (3:00) Settings — distros, AI config
8. (3:30) Mobile view (responsive PWA)
9. (4:00) NixOS setup (3 lines in your config)
10. (4:30) Wrap up + links

---

## Content Guidelines

- **Tone:** Technical but approachable. Not corporate. Written by a developer for developers.
- **Honesty:** Don't overstate capabilities. Be upfront about what's not built yet.
- **Comparisons:** Fair and factual. Acknowledge competitor strengths.
- **SEO:** Each piece targets specific keywords from GTM plan.
- **CTA:** Every piece includes link to: repo, demo site, NixOS module docs.

---

## Acceptance Criteria

1. Dev README renders correctly on GitHub with all sections
2. Free README excludes premium content, includes upgrade mention
3. All 5 blog posts drafted and reviewed for tone/accuracy
4. Community posts drafted for all 5 channels
5. 3 comparison pages complete with accurate feature tables
6. Video script covers all major features in 5-minute format
7. All content reviewed for consistency with business positioning
8. Screenshots referenced in README are captured and placed
9. No internal-only information in public-facing content

---

## Estimated Effort

README rewrites: 1 day
Blog posts (5 drafts): 2 days
Community posts: 0.5 days
Comparison pages: 1 day
Video script: 0.5 days
Screenshots + review: 0.5 days
Total: **5–6 days**

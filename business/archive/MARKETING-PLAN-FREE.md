<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Marketing Plan -- Free Version

Strategy for promoting the free (public) version of Weaver to the NixOS and developer communities.

## Target Audience

### Primary

- **NixOS enthusiasts** who run MicroVMs on their hosts and want a management UI
- **Homelab operators** using NixOS for virtualization
- **DevOps engineers** working with NixOS in production environments

### Secondary

- **Open source dashboard builders** interested in Quasar + Fastify patterns
- **Vue 3 / TypeScript developers** looking for real-world project examples
- **NixOS module authors** looking for packaging examples

## Key Messages

1. **"Monitor and manage NixOS MicroVMs from a modern web interface."** -- The core value proposition.
2. **"Real-time dashboard. Zero configuration. NixOS native."** -- Emphasizes simplicity and integration.
3. **"Open source and free forever."** -- The free version is genuinely free, not a trial.

## Channels

### Community Forums and Discussion

| Channel | Strategy | Timing |
| ------- | -------- | ------ |
| NixOS Discourse | Announce in Show & Tell category | On v0.1.0 release |
| Reddit r/NixOS | Post with demo link and screenshot | On v0.1.0 release |
| Reddit r/homelab | Post focusing on homelab use case | 1 week after NixOS post |
| Reddit r/selfhosted | Post with Docker deployment angle | 2 weeks after release |
| Hacker News | Show HN post (if v0.1.0 is polished enough) | After gathering feedback |

### Social / Chat

| Channel | Strategy | Timing |
| ------- | -------- | ------ |
| NixOS Matrix/IRC | Share in relevant channels | On release |
| NixOS Discord | Share in showcase channel | On release |
| Twitter/X | Thread with screenshots and demo link | On release |
| Mastodon (fosstodon) | Announcement post | On release |

### Content

| Content | Platform | Timing |
| ------- | -------- | ------ |
| "Building a NixOS Weaver" blog post | Personal blog / dev.to | Post-release |
| Demo video (2-3 min walkthrough) | YouTube + embedded in README | Pre-release |
| Architecture blog post | Personal blog / dev.to | 2-4 weeks post-release |

## Documentation as Marketing

The project documentation itself serves as marketing:

### README.md
- Professional appearance with badges, screenshots, and clear Quick Start
- Three installation options (NixOS, Docker, npm) to lower the barrier
- Tech stack table signals maturity and thoughtfulness
- Architecture diagram shows real engineering

### Live Demo
- The demo site at `weaver-demo.github.io` is the single most important marketing asset
- It lets potential users try the dashboard without installing anything
- hCaptcha gating prevents abuse while keeping access easy

### NixOS Integration
- The NixOS module in the README shows this is a first-class NixOS citizen
- Including the flake.nix snippet makes adoption trivial
- NUR listing increases discoverability

## Launch Checklist

### Pre-Launch (Before Announcing)

- [ ] README.md is polished with screenshot and badges
- [ ] Demo site is live and functional
- [ ] All documentation is complete and linked
- [ ] Free repo is synced and up to date
- [ ] NixOS module builds and installs cleanly
- [ ] Docker deployment works end-to-end
- [ ] No template placeholders remain in public-facing files
- [ ] LICENSE file is present and correct

### Launch Day

- [ ] Create GitHub Release v0.1.0
- [ ] Post to NixOS Discourse
- [ ] Post to r/NixOS
- [ ] Share in NixOS Matrix/Discord
- [ ] Tweet/toot announcement

### Post-Launch (Week 1-2)

- [ ] Monitor GitHub issues for bug reports
- [ ] Respond to community questions
- [ ] Post to r/homelab and r/selfhosted
- [ ] Publish blog post
- [ ] Submit to NUR (if not already listed)

### Post-Launch (Month 1)

- [ ] Gather feedback and prioritize v0.2.0 features
- [ ] Address any reported issues
- [ ] Consider Hacker News post if reception is positive
- [ ] Track GitHub stars, forks, and traffic

## Metrics to Track

| Metric | Source | Goal (Month 1) |
| ------ | ------ | --------------- |
| GitHub Stars (Free repo) | GitHub | 50+ |
| Demo site visits | GitHub Pages analytics | 500+ |
| GitHub Issues opened | GitHub | 10+ (indicates interest) |
| NixOS Discourse thread views | Discourse | 200+ |
| Reddit post upvotes | Reddit | 50+ |

## Differentiation

### What makes Weaver unique

1. **NixOS native** -- Not just a Docker dashboard. Purpose-built for NixOS MicroVMs.
2. **Real-time** -- WebSocket updates, not polling. Status changes appear in 2 seconds.
3. **Simple** -- No database, no authentication (for personal use). Just enable the module.
4. **Modern stack** -- Quasar 2, Vue 3, TypeScript, Fastify. Not another PHP panel.
5. **Security conscious** -- Least-privilege sudo rules, input validation, dedicated service user.

### Competitors / Alternatives

| Tool | Difference |
| ---- | ---------- |
| Cockpit | General Linux admin, not MicroVM-specific |
| Proxmox VE | Full hypervisor platform, not NixOS native |
| Portainer | Docker-focused, not VM-focused |
| Custom scripts | No web UI, no real-time monitoring |

## Budget

This is a zero-budget marketing effort. All channels are free:
- GitHub (repository and Pages hosting)
- Community forums (NixOS Discourse, Reddit)
- Social media (Twitter, Mastodon)
- Blog platforms (dev.to, personal blog)

## Future Marketing (v0.2.0+)

- Create a project logo and social preview image
- Record a polished demo video
- Write a "Getting Started" tutorial series
- Present at NixOS community meetups (virtual)
- Apply for inclusion in NixOS wiki / awesome-nix lists

---

*This plan will be updated as the project evolves and community feedback is incorporated.*

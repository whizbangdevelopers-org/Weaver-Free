<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# User Action Items — Running Checklist

**Purpose:** Everything the developer needs to do manually (outside of code) for launch.
**Last updated:** 2026-02-23
**Status:** Pre-v1.0 — building toward launch

**Security Audit Tracking:** [SECURITY-AUDIT-DOMAINS.md](SECURITY-AUDIT-DOMAINS.md) | Issues [#34](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/34)–[#38](https://github.com/whizbangdevelopers-org/Weaver-Dev/issues/38)

---

## IMMEDIATE (Do Now / This Week)

### GitHub Org Settings (applies to ALL repos)
- [X] **Copilot training opt-out** — Go to `https://github.com/organizations/whizbangdevelopers-org/settings` > Copilot > opt out of code training. This is the primary protection for the public free repo source code. **Covers both MicroVM and Gantry.**

### Weaver Repos
- [x] **Set repo topics** — Dev: `nixos`, `microvm`, `vm-management`, `dashboard`, `quasar`, `vue`, `typescript`, `nix`. Free: same. (2026-02-22)
- [x] **Update repo descriptions** — Dev: "Weaver — NixOS MicroVM management (development)". Free: "Weaver — NixOS MicroVM management UI" (2026-02-22)

### Gantry Repos
- [x] **Set repo topics** — Gantry-Dev: `quasar`, `vue3`, `typescript`, `fastify`, `nixos`, `gantry`, `project-planning`, `kanban`. Gantry: same. (2026-02-22)
- [x] **Update repo descriptions** — Already set by init script: "Spatial planning meets kanban meets git — visual project management for developers and coding agents" (2026-02-22)
- [ ] **Add GitHub secrets to Gantry-Dev** — `GIST_TOKEN`, `TEST_BADGE_GIST_ID`, `DEMO_GITHUB_TOKEN` (same PATs as MicroVM where possible)
- [x] **Set up git hooks** — `git config core.hooksPath .githooks` (2026-02-22)

### MicroVM Demo Site Secrets
- [ ] **Verify DEMO_GITHUB_TOKEN** — PAT from demo account (`weaver-demo`) with `repo` scope. Stored as GitHub Actions secret in Dev repo.
- [ ] **Verify VITE_HCAPTCHA_SITEKEY** — hCaptcha site key for demo login gate. Stored as GitHub Actions secret in Dev repo.

### Sync Infrastructure (both products)
- [ ] **Verify SYNC_TOKEN (MicroVM)** — PAT with `repo` scope for dev-to-free sync. Stored as GitHub Actions secret in Weaver-Dev.
- [ ] **Test sync workflow (MicroVM)** — Manual dispatch `sync-to-free.yml` to verify LICENSE file syncs correctly to free repo.
- [ ] **Set up SYNC_TOKEN (Gantry)** — Same PAT can work. Store as secret in Gantry-Dev when sync workflow is activated.

### CI Badge Secrets (optional)
- [ ] **Verify GIST_TOKEN** — PAT with `gist` scope for CI badge updates. Only needed if you want test result badges on README. Stored as GitHub Actions secret in Dev repo.
- [ ] **Verify TEST_BADGE_GIST_ID** — Gist ID for badge JSON files. Paired with GIST_TOKEN. Stored as GitHub Actions secret in Dev repo.

---

## PRE-LAUNCH (Before v1.0.0 Tag)

### Licensing & Legal
- [x] **LICENSE file created** — AGPL-3.0 + Commons Clause + AI Training Restriction (2026-02-20)
- [x] **Copyright notices in UI** — MainLayout footer, HelpPage, DemoLoginPage (2026-02-20)
- [x] **package.json license updated** — Both frontend and backend (2026-02-20)
- [x] **Demo AI crawler protection** — robots.txt + noai meta tags (2026-02-20)
- [x] **BSL license for Fabrick** — Draft complete at `docs/legal/LICENSE-PAID-DRAFT.md` (2026-02-23). Parameters: BSL 1.1, 4-year change date, AGPL-3.0 change license. Finalize with legal review before Fabrick repo activation.

### Entity Formation (blocks Stripe — do immediately)
- [ ] **Form Wyoming LLC** — Required before Stripe business verification. ~$200 filing + registered agent. Plan details in [BUDGET-AND-ENTITY-PLAN.md](../../business/finance/BUDGET-AND-ENTITY-PLAN.md). Get EIN from IRS (online, instant) once LLC is filed.
- [ ] **Operating agreement (attorney-drafted, ~$2,500)** — Multi-member LLC (Mark + Yuri). Attorney required — cannot use a template. Must cover:
  - Member ownership percentages + capital contributions
  - Voting rights + management structure (member-managed vs manager-managed)
  - IP assignment from both members to the LLC (critical — all code, designs, and product IP must belong to the LLC, not individuals)
  - Profit/loss distribution
  - Buyout / dissolution terms (what happens if one member leaves)
  - Non-compete / non-solicit clauses
  - Decision authority thresholds (what requires unanimous consent vs majority)
- [ ] **Open business bank account** — Required for Stripe payouts. Needs LLC docs + EIN + operating agreement (most banks require it for multi-member LLCs).

### Payment & Monetization (Decision #39 — depends on entity formation)
- [ ] **Set up Stripe account** — Requires LLC + EIN + bank account. Business verification can take days after submission. Start as soon as entity is formed.
- [ ] **Build license key generator** — Generate `WVR-{TIER}-{PAYLOAD}-{CHECKSUM}` format keys (already implemented in `backend/src/license.ts`)
- [ ] **Configure Stripe webhook** — Payment verified → generate license key + extension entitlements (Decision #40) → store in WordPress DB → email to customer
- [ ] **Design pricing page** — Weaver Free / Weaver / Fabrick comparison with upgrade triggers. Buttons link to Stripe Checkout (no WooCommerce).

### OSS Maintainer Program (Adoption Strategy)
Free or discounted Weaver licenses for NixOS ecosystem contributors. Near-zero marginal cost (self-hosted software) — the value is credibility and organic reach in the target audience.

**Tier 1 — Named Maintainers (free lifetime Weaver):**
- [ ] **Reach out to Astro** — microvm.nix creator. Offer permanent Weaver license, no strings. A mention in microvm.nix docs is worth more than any paid marketing.
- [ ] **Identify 3-5 key microvm.nix / NixOS contributors** — Anyone with significant merged PRs to microvm.nix or NixOS infra. Same offer: free Weaver, no obligation.
- [ ] **Generate `WVR-PREMIUM-OSS-*` license keys** — Small batch for manual distribution to named maintainers.

**Tier 2 — NixOS Contributor Discount (50% off Weaver):**
- [ ] **Define eligibility** — Merged PRs to `nixpkgs`, `microvm.nix`, or NixOS-adjacent projects. Self-service via GitHub profile link, manual verification initially.
- [ ] **Add pricing page section** — "Free for open-source maintainers of projects we depend on." with contact link.
- [ ] **Automate verification** — Only if volume warrants it (post-launch).

**Stacks with Founding Supporter pricing** — A NixOS contributor could get ecosystem discount + founding member rate ($7.50/mo or $75/yr).

**Cross-product discounts** — Weaver holders get discounts on Gantry (and vice versa). OSS maintainer licenses apply to all WhizBang products. See [Cross-Product Strategy](../../wbd-gantry-project/business/CROSS-PRODUCT-STRATEGY.md).

### Content Creation (Track 1)
- [x] **Rewrite Dev repo README** — Hero screenshot, feature badges, quick start, architecture diagram, tier comparison table, screenshots (2026-02-22)
- [ ] **Rewrite Free repo README** — Community-focused, free-tier features, upgrade path callouts, demo link (syncs from dev with `sync-to-free.yml`)
- [ ] **Draft blog post #1** — "Why I Built a Weaver for microvm.nix" (origin story, dev.to + personal blog)
- [ ] **Draft blog post #2** — "Managing NixOS VMs Without the Terminal" (r/NixOS, Discourse)
- [ ] **Draft blog post #3** — "Weaver vs Proxmox: When NixOS is Your OS" (blog, HN)
- [ ] **Draft blog post #4** — "Declarative VMs with a GUI: The Best of Both Worlds" (dev.to, HN)
- [ ] **Draft blog post #5** — "From Docker to MicroVMs: A NixOS Migration Story" (r/selfhosted, blog)
- [ ] **Create comparison pages** — vs Proxmox, vs Incus, vs Cockpit (blog or demo site)

### Demo Site (Track 2)
- [ ] **Record demo video (3-5 min)** — Real-host B-roll: WebSocket transitions, live topology, VM scanning, agent output. Intercut with demo UI.
- [x] **Test tier-switcher end-to-end** — Weaver Free/Weaver/Fabrick toggles lock/unlock correct features (verified via demo screenshot pipeline 2026-02-22)
- [x] **Verify all mock VMs display** — 8 VMs with varied states, distros, hypervisors (verified via demo screenshot pipeline 2026-02-22)
- [ ] **Test create/delete flow in demo** — Mock CRUD works, state persists in session

### Screenshots & Media
- [x] **Hero screenshot** — Weaver with 8 VMs in various states, tier-switcher toolbar (2026-02-22, automated via `scripts/capture-screenshots.sh`)
- [x] **Network topology screenshot** — Bridge visualization from E2E backend (2026-02-22)
- [ ] **WebSocket GIF** — Terminal `microvm start` > dashboard card flips green in real-time
- [ ] **Agent diagnostics screenshot** — Live Claude analysis of a real VM (requires real Anthropic key)
- [ ] **Tier-switcher GIF** — Toggling tiers in demo, features appearing/disappearing
- [x] **11 marketing PNGs** — Automated pipeline captures vm-detail, settings, users, help, audit, login, demo-login, hero-dashboard, tier-switcher-free, tier-switcher-fabrick, network-topology (2026-02-22)

---

## LAUNCH DAY (v1.0.0 Tag)

### Release Process
- [ ] **Update version** — `package.json`, `backend/package.json`, and `nixos/package.nix`
- [ ] **Update CHANGELOG.md** — Release date, feature notes, breaking changes
- [ ] **Run full test suite** — `npm run test:prepush`
- [ ] **Build all targets** — `npm run build:all`
- [ ] **Tag release** — `git tag v1.0.0`
- [ ] **Push tag** — `git push origin --tags` (triggers demo deploy + sync-to-free)
- [ ] **Create GitHub Release** — From tag with release notes, download links, upgrade guide
- [ ] **Verify sync-to-free** — Confirm dev > free repo sync completed
- [ ] **Verify demo site** — Check `https://weaver-demo.github.io` deployed with new version

### Community Launch Posts
- [ ] **r/NixOS** — Announcement with demo link and feature highlights
- [ ] **r/homelab** — Same announcement
- [ ] **r/selfhosted** — Same announcement
- [ ] **NixOS Discourse** — discourse.nixos.org project announcement
- [ ] **Hacker News** — Submit Tuesday-Thursday afternoon (optimal timing)

---

## LAUNCH WEEK (Days 1-7)

- [ ] **Submit PR to awesome-nix** — GitHub awesome-nix repository
- [ ] **Submit PR to awesome-selfhosted** — GitHub awesome-selfhosted repository
- [ ] **Publish YouTube video** — 3-5 min demo with setup walkthrough
- [ ] **Post video to r/homelab** — Cross-promote
- [ ] **Publish blog post #1** — Origin story on dev.to
- [ ] **Enable GitHub Discussions on free repo only** — `whizbangdevelopers-org/Weaver-Free` > Settings > Features > Discussions. Keep Discussions **disabled** on the Dev repo — all community interaction funnels through the public free repo.
- [ ] **Publish to NUR** — NixOS User Repository for package discoverability

---

## POST-LAUNCH (Weeks 2-4)

### Content Calendar
- [ ] **Week 2** — Publish blog post #2 (Managing NixOS VMs Without the Terminal)
- [ ] **Week 3** — Publish blog post #3 (vs Proxmox comparison)
- [ ] **Week 4** — Review analytics, adjust strategy

### Business
- [ ] **Monitor conversion metrics** — Free > Weaver conversion rate, demo visits, installs
- [ ] **Collect Founding Member feedback** — Via GitHub Discussions, email, or survey
- [ ] **Consider Founding Member pricing** — Discounted pricing for first 50 customers
- [ ] **Interview Founding Member** — Write up case study

### SEO & Analytics
- [ ] **Configure OpenGraph images** — Meta tags + og:image for blog posts and demo site
- [ ] **v1 analytics: GitHub repo traffic** — Use built-in Traffic insights (Settings > Traffic) on both free repo and demo repo. Tracks repo page views, clones, and referrers — not the demo site itself, but sufficient for launch signal. **Reconsider Plausible self-hosted if weekly unique visitors exceed 500** — at that volume you need real demo site engagement data (page depth, tier-switcher clicks, time-on-site) that GitHub can't provide.
- [ ] **Monitor GitHub stars** — Targets: 200+ month 1, 500+ month 3, 1000+ month 6

---

## DEFERRED (Post-v1.0, When Relevant)

### Fabrick
Full activation process documented in [`docs/legal/LICENSE-PAID-DRAFT.md`](../code/docs/legal/LICENSE-PAID-DRAFT.md#activation-process).
- [ ] Resolve open questions (change date duration, SaaS clause, AI restriction format)
- [ ] Legal review of BSL 1.1 license with project-specific parameters
- [ ] Create Fabrick repo (`Weaver-Dev-Premium`) with reviewed LICENSE
- [ ] Set up Stripe products + license key generator + webhook
- [ ] Set up Fabrick build pipeline (shared + enterprise-only source)
- [ ] Update pricing page and public-facing docs

### Branch Protection
- [ ] **Enable branch protection on Dev repos** — Requires GitHub Pro ($4/user/mo) for private repos. Low value as solo developer: pre-push hooks already enforce lint + tests + security audit, and the dev-to-free sync workflow gates public releases. Revisit when onboarding contributors or enabling Dependabot auto-merge.

### Infrastructure
- [ ] Consider custom domain for demo site (e.g., `demo.weaver.io`)
- [ ] Consider "Pro Hosted" managed service offering if demand exists
- [ ] Set up opt-in telemetry (installs, active users, feature usage)
- [ ] Plan database migration strategy (SQLite > PostgreSQL for multi-instance)
- [ ] **Self-host Plausible analytics** — Docker-based, privacy-first demo site analytics. Triggered when v1 GitHub traffic exceeds 500 weekly uniques. Gives page depth, tier-switcher engagement, time-on-site — data GitHub Traffic can't provide.

### Content (Ongoing)
- [ ] Create migration guides (VMware > NixOS, Docker > NixOS MicroVMs)
- [ ] Create production deployment guide (NixOS module options, HTTPS, backups)
- [ ] Write REST API documentation (endpoint reference, examples, error codes)
- [ ] Publish blog posts #4 and #5
- [ ] Write comparison pages (vs Incus, vs Cockpit)

---

## Success Metrics Targets

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| GitHub stars | 200+ | 500+ | 1,000+ |
| GitHub forks | 20+ | — | — |
| Demo site visits | 1,000+ | — | — |
| NUR installs | 50+ | — | — |
| Active users | — | 100+ | 300+ |
| Blog post views | — | 5,000+ | — |
| Paying customers | — | — | 5-10 |
| MRR | — | — | $100+ |

---

## Conversion Hooks Reference

### Free > Weaver Triggers
| Hook | Gate |
|------|------|
| "I want to create VMs from the dashboard" | Create VM button gated to Weaver |
| "I'm tired of pasting my API key every session" | Server-provided AI key = Weaver |
| "I hit the 5/min AI rate limit" | Weaver = 10/min |
| "I want to manage distros" | Edit/add/delete distros = Weaver |
| "I need push alerts when VMs fail" | Push notification channels = Weaver |
| "I want to manage bridges and IP pools" | Network management panel = Weaver |

### Weaver > Fabrick Triggers
| Hook | Gate |
|------|------|
| "My team needs per-VM access control" | Per-VM ACL = Fabrick |
| "I need to audit who did what" | Audit log = Fabrick |
| "Bulk operations for 20+ VMs" | Bulk select/actions = Fabrick |
| "Resource quotas for team members" | Per-user quotas = Fabrick |

---

*Cross-reference: [GTM-LAUNCH-PLAN.md](GTM-LAUNCH-PLAN.md) | [EXECUTION-ROADMAP.md](EXECUTION-ROADMAP.md)*

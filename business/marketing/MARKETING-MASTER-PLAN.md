<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Weaver / Fabrick — Marketing Master Plan

**Last updated:** 2026-03-27
**Purpose:** Per-release marketing implementation plan. Each version section defines what marketing work must ship alongside the code.
**Owner:** WhizBang Developers LLC
**Cross-references:** [RELEASE-ROADMAP.md](../product/RELEASE-ROADMAP.md) · [PRICING-POWER-ANALYSIS.md](../finance/PRICING-POWER-ANALYSIS.md) · [FOUNDING-MEMBER-PROGRAM.md](../sales/FOUNDING-MEMBER-PROGRAM.md) · [TECHNOLOGY-ALLIANCES.md](../sales/TECHNOLOGY-ALLIANCES.md) · [CHANNEL-PARTNER-PITCH.md](../sales/CHANNEL-PARTNER-PITCH.md)

---

## Release Marketing Index

| Version | Wave | Marketing Type | Key Deliverable | Status |
|---------|------|---------------|-----------------|--------|
| v1.0.0 | Production Launch | Soft launch | Community seeding posts + README + demo site | Pending |
| v1.1.0 | Container Arc | Feature launch | Channel partner announcement + 1Password TA blog | Pending |
| v1.2.0 | Container Arc | Major launch | "The Closer" full press push + pricing step-up | Pending |
| v1.3.0 | Container Arc | Feature launch | Android App Store + Tailscale TA co-marketing | Pending |
| v1.4.0 | Secure Platform | Feature launch | AI agent blog + bridge active routing + AI inference pitch (bridge-as-LB) | Pending |
| v1.5.0 | Secure Platform | Feature launch | Secrets management compliance brief | Pending |
| v1.6.0 | Migration Arc | Feature launch | "Migrate from Proxmox" landing page | Pending |
| v2.0.0 | Storage + Templates | Feature launch | NVIDIA TA outreach + storage blog | Pending |
| v2.1.0 | Storage + Templates | Feature launch | Team FM opens — pricing page update + announcement | Pending |
| v2.2.0 | Multi-Host | Major launch | Weaver Team GA + Fabrick pricing step-up + partner comms | Pending |
| v2.3.0 | Multi-Host | Enterprise launch | Fabrick clustering GA + Hetzner/DO TA co-marketing | Pending |
| v2.4.0 | Backup + Cloud | Feature launch | Backup + Backblaze B2 TA + cloud workloads blog | Pending |
| v2.5.0 | Storage FabricK | Feature launch | FabricK storage brief + Fabrick upsell CTA | Pending |
| v2.6.0 | Backup FabricK | Feature launch | Backup fabrick compliance brief | Pending |
| v3.0.0 | Fleet Control Plane | Enterprise launch | Full enterprise press + Anthropic TA + pricing step-up | Pending |
| v3.1.0 | Edge + Cloud Burst | Enterprise launch | Edge market entry + AI/HPC burst announcement | Pending |
| v3.2.0 | Cloud Burst Billing | Feature launch | Self-serve burst billing + GPU scheduling blog | Pending |
| v3.3.0 | Fabrick Maturity | FabricK launch | Fabrick Cloud pre-sell landing page + Path A/B gate | Pending |

---

## v1.0.0 — Soft Market Entry

### Launch Type
Soft launch — controlled community seeding. No press release, no Product Hunt, no paid channels. Organic credibility first.

### Trigger
- Code GA confirmed (RC1 dry run complete, cross-bridge routing, NixOS smoke test pass)
- Legal review complete (operating agreement, software license)
- Stripe active (EIN received, bank account linked)
- Demo site live on GitHub Pages with tier-switcher functional
- Public GitHub repo (Weaver.git free mirror) published
- README files finalized for both public and private repos
- All 5 blog post drafts reviewed and published to dev.to / personal blog

### Target Segments
- NixOS hobbyists and self-hosters (r/NixOS, NixOS Discourse)
- Homelab enthusiasts (r/homelab, r/selfhosted)
- Developer sysadmins evaluating VM management alternatives
- Professional tech workers who operate home infrastructure (81% of self-hosters — selfh.st 2025)

### Key Message
"A web dashboard for microvm.nix — manage your NixOS VMs without touching the terminal."

### Content Deliverables

**Blog Posts (publish in sequence, 3–5 days apart):**
1. "Why I Built Weaver for microvm.nix" (~1,500 words) — founder story, technical motivation, early design decisions. Publish to dev.to and personal blog. Anchor post for all subsequent community shares.
2. "Managing NixOS VMs Without the Terminal" (~1,200 words) — walkthrough of Live Provisioning, AI diagnostics, multi-hypervisor support. Link to demo. Target: r/NixOS, NixOS Discourse.
3. "Weaver vs Proxmox: Different Tools for Different Needs" (~1,500 words) — fair comparison, acknowledge Proxmox strengths (mature backup, large community), position Weaver for NixOS users. Target: personal blog, HN.
4. "Declarative VMs with a GUI: The Best of Both Worlds" (~1,000 words) — the NixOS + UI story, why these are not contradictory. Target: dev.to, HN.
5. "From Docker to MicroVMs: A NixOS Migration Story" (~1,200 words) — fictional but realistic narrative following a self-hoster's migration path. Target: r/selfhosted.

**README Files:**
- `code/README.md` (dev/private): Full README, all features including Weaver tier, screenshots, NixOS flake setup
- `README-free.md` (public repo): Community edition README — monitoring features, free tier scope, upgrade mention, community template contribution guide

**Demo Site:**
- Live at GitHub Pages with tier-switcher (Free / Weaver / Fabrick)
- hCaptcha on demo signup form
- Version switcher showing v1.0 state (no future version content yet)

**Community Posts (draft before launch, post on day 1):**
- r/NixOS: "I built a web dashboard for microvm.nix — would love feedback" (text post, no marketing language)
- r/homelab: "Free VM dashboard for NixOS self-hosters" (image post with dashboard screenshot)
- r/selfhosted: "Open source VM management dashboard — free tier, no account required for demo" (text post)
- NixOS Discourse: "Weaver — NixOS VM dashboard, looking for early testers" (announcement, technical focus, NixOS module details)
- Hacker News: "Show HN: Weaver — declarative VM management for NixOS" (link to blog post #1 or demo)

**Documentation:**
- Getting started guide (NixOS flake setup, 3-step install)
- NixOS module configuration reference
- Tier comparison page on demo/marketing site

### Channel Strategy

**Day 0 (Release day):**
- Push public GitHub repo (Weaver.git)
- Publish blog post #1 to dev.to and personal blog
- Post to NixOS Discourse (technical audience first — they will amplify if quality is high)

**Day 1:**
- Post to r/NixOS
- Submit to Hacker News (Show HN)

**Day 3:**
- Post to r/homelab (image post)
- Publish blog post #2 to dev.to

**Day 5:**
- Post to r/selfhosted
- Publish blog post #3

**Day 7–14:**
- Publish remaining blog posts (#4, #5) on 3-day cadence
- Monitor and respond to all community comments personally (founder voice)
- No paid promotion in v1.0 window

### Pricing Actions
- Weaver Solo FM: **$149/yr** — active on pricing page and Stripe at launch
- Fabrick FM: **$1,299/yr/node** — available by direct outreach only (not on public pricing page)
- No pricing changes at v1.0 — this establishes the baseline

### Partner / TA Actions
- **1Password:** Initiate contact post-launch via `1password.com/partners` for Partnership API + CJ Affiliate enrollment (independent of TA agreement, can activate immediately)
- **Yubico:** Apply to Yubico partner program post-launch
- **Kanidm:** GitHub/NixOS Discourse outreach, introduce integration partnership concept
- **Channel partners:** Begin conversations with Tweag, Numtide, Serokell, Nixcademy — present CHANNEL-PARTNER-PITCH.md deck. Goal: all 5 slots signed by end of v1.1 window.
- No TA announcements at v1.0 — nothing is formalized yet

### Vertical Outreach
- No vertical-specific outreach at v1.0 — product is proving itself in the community first
- Internal: ensure all 11 vertical sales docs are finalized and ready for v1.1+ conversations
- Sysop-as-champion pipeline: monitor community comments for professional sysadmins who express interest; begin informal relationship building

### Upgrade CTAs
- Free → Weaver: "Live Provisioning — create and manage VMs without rebuilding NixOS" (shown in dashboard after VM list viewed 3+ times)
- Free → Fabrick: surface only via direct outreach, not in-product at v1.0

### Acceptance Criteria
1. All 5 blog posts published with correct tone (developer voice, no corporate language)
2. Community posts live on all 5 channels day 1
3. Public GitHub repo has complete README with screenshots
4. Demo site functional with tier-switcher
5. Stripe active, $149 FM pricing page live
6. 1Password and Yubico partner program outreach initiated
7. Channel partner conversations started with all 4 named firms

---

## v1.1.0 — Container Visibility + Extension Infrastructure

### Launch Type
Feature launch — homelab credibility expansion. First major capability release after soft entry. Channel partner announcement is the headline event.

### Trigger
- v1.1 code GA
- 1Password TA agreement executed (Partnership API access confirmed)
- Yubico affiliate/partner program confirmed
- Channel partner slots: all 5 signed (gate for announcement)
- CJ Affiliate enrolled and tracking active

### Target Segments
- Existing v1.0 Free users (upgrade CTA for DNS extension, Docker/Podman)
- Docker/Podman/Apptainer users evaluating unified management
- NixOS homelab community (Windows UEFI, service health probes new additions)
- NixOS consultancies (Tweag, Numtide, Serokell, Nixcademy) — channel partner announcement audience

### Key Message
"Weaver now manages your containers alongside your VMs — Docker, Podman, and Apptainer from the same dashboard."

### Content Deliverables

**Blog Posts:**
1. "Weaver v1.1: Container Visibility + Extension Infrastructure" — release announcement post. Feature walkthrough: ContainerRuntime interface, DNS extension, 1Password/Yubico integrations. Link to changelog.
2. "Why Apptainer First: HPC Containers Without Docker's Attack Surface" (~1,200 words) — technical deep-dive on Apptainer's security model, rootless containers, SIF format. Target: r/homelab, HPC/research audience, dev.to.
3. "Declarative DNS for Your Home Lab: How Weaver's DNS Extension Works" (~1,000 words) — .vm.internal zones, dnsmasq + CoreDNS, split-horizon preview. Target: r/selfhosted, r/homelab.
4. "1Password + Weaver: Free MFA for NixOS Infrastructure Users" (~800 words) — 1Password TA announcement, how OAuth verification works, TOTP on Free tier. Coordinate with 1Password comms team for joint announcement.

**Channel Partner Announcement:**
- Partner announcement letters sent to each signed firm on v1.1 release day
- Partner-facing press: "Weaver Launches Channel Partner Program — 5 NixOS Consultancies Named as Founding Partners" (publish on company blog, distribute to partners for their own newsletters)
- Each partner gets: co-marketing kit (logos, description, feature comparison one-pager), regulatory mapping doc set (11 verticals), partner badge for their website

**Comparison Page Update:**
- `docs/comparisons/vs-portainer.md` — add Apptainer support comparison (Portainer does not support Apptainer/HPC containers)

**Demo Site Update:**
- Add container cards view to v1.1 demo state
- Show DNS extension configuration in Settings

### Channel Strategy

**Day 0:**
- Publish release announcement blog post
- Channel partner announcement letters sent (direct, not public)
- Post r/NixOS: container visibility announcement

**Day 1:**
- Apptainer blog post to dev.to, share in r/homelab and r/selfhosted
- 1Password joint announcement (coordinate with 1Password)

**Day 3:**
- DNS extension blog post — r/selfhosted, r/homelab
- NixOS Discourse: v1.1 release thread (technical changelog)

**Day 7:**
- Partner firms publish their own "we're a Weaver partner" announcement (coordinate timing)
- HN: if Apptainer post got traction, submit "Apptainer + NixOS: rootless HPC containers" angle

### Pricing Actions
- No price changes at v1.1
- Weaver Solo FM ($149/yr) remains active — this is the last version at this price before v1.2 step-up
- **Begin 60-day advance notice comms for v1.2 price increase:** "Weaver Solo price moves to $249/yr when v1.2 ships. Lock in $149/yr FM now — it's your founding member price forever." Include in: release announcement, email to all Free users, in-product banner.

### Partner / TA Actions
- **1Password TA:** Formal announcement of partnership. Blog post coordination. CJ Affiliate active. Monitor affiliate conversion (target: track Free users who click 1Password link and convert).
- **Yubico:** Announce FIDO2 integration. Coordinate Yubico affiliate link placement in FIDO2 setup flow.
- **Channel partners (Tweag, Numtide, Serokell, Nixcademy + 1 emerging):** Announcement day. Provide all 5 with: sales training session invite, regulatory doc library, demo access (full tier unlock), partner Slack channel.
- **Kanidm:** Continue informal outreach; set v2.0 target for formal integration discussion.

### Vertical Outreach
- Begin direct outreach using healthcare sales doc to 2–3 prospect contacts (from community: sysadmins who mentioned compliance in v1.0 comments)
- Research vertical: share Apptainer blog post with any HPC community contacts from v1.0 Discourse thread
- Channel partners begin their own vertical outreach using the 11 regulatory docs

### Upgrade CTAs
- Free → Weaver: "DNS extension now live — manage .vm.internal zones for your VMs and containers" (in-product after container list view)
- Free → Weaver: "1Password customer? Your TOTP MFA is already included. Windows UEFI + Docker management require Weaver."

### Acceptance Criteria
1. Channel partner announcement live with all 5 named firms
2. 1Password joint announcement published
3. All 4 blog posts live
4. 60-day pricing advance notice communicated across all channels (email, in-product, blog)
5. Partner kit distributed to all 5 channel partners
6. v1.1 demo state live on demo site

---

## v1.2.0 — The Closer (Full Container Management + Firewall)

### Launch Type
Major launch — this is the first full-press release. "The Closer" completes the unified VM + container management story. Pricing steps up at this release. All marketing assets go live simultaneously.

### Trigger
- v1.2 code GA
- Stripe pricing updated: Weaver Solo standard price moves to $249/yr
- Weaver Solo FM window closes on release day (no extensions)
- All comparison pages updated to reflect new container capabilities
- Demo site updated with v1.2 state (full container lifecycle, firewall, Tailscale wizard)

### Target Segments
- Docker/Podman/Portainer users evaluating unified management (primary new segment)
- Proxmox users considering migration (firewall, hardening story now complete)
- Defense/CMMC audience (firewall zones, AppArmor, hardening — CMMC Level 2 alignment)
- Healthcare (firewall egress control + AppArmor maps to HIPAA §164.312)
- All existing Free users — this is the primary upgrade trigger

### Key Message
"The only dashboard that manages MicroVMs, Apptainer, and Docker from a single pane. Full container lifecycle, GPU passthrough, firewall, and hardening — all declarative, all immutable, all NixOS." GPU passthrough is also the foundation of the AI inference story — position v1.2 as the version where self-hosted AI inference becomes viable on Weaver (VFIO-PCI isolation per inference VM, NixOS reproducibility for model environments). Full inference management (bridge LB + blue/green) arrives at v1.4.

### Content Deliverables

**Blog Posts:**
1. "Weaver v1.2: The Closer — Complete Container + VM Management on NixOS" — full release announcement, feature highlights, pricing change notice.
2. "MicroVMs + Apptainer + Docker: Why Unified Management Changes Everything" (~1,500 words) — the unified pane argument, GPU passthrough across container types, HPC + web workloads on one host. Include multi-vendor GPU angle: NVIDIA, AMD, Intel via VFIO-PCI — no vendor lock-in (Decision #113).
3. "NixOS Firewall Management Without nftables Expertise" (~1,200 words) — firewall plugin walkthrough, zone model, egress control. Target compliance-conscious audience.
4. "Tailscale on NixOS in One Wizard: Remote Access Without the Config Hassle" (~800 words) — Tailscale wizard walkthrough, NixOS config generation, permanent remote access story. Coordinate with Tailscale for content amplification (pre-v1.3 TA outreach warmup).
5. "WireGuard on NixOS: Self-Hosted Remote Access for Air-Gap Environments" (~800 words) — WireGuard wizard, air-gap and compliance-friendly alternative to Tailscale. Target: defense, healthcare.

**Comparison Pages (update/create):**
- `docs/comparisons/vs-proxmox.md` — update with full container management, GPU passthrough, firewall comparison. Add: "Proxmox does not support Apptainer. Weaver does."
- `docs/comparisons/vs-portainer.md` — new or updated: "Portainer manages containers only. Weaver manages VMs and containers from one pane."
- `docs/comparisons/vs-cockpit.md` — update with new features

**Pricing Change Communication:**
- Email to all existing users: "v1.2 is live. Weaver Solo standard price is now $249/yr. If you're on FM ($149/yr), you're locked forever — nothing changes for you. New users now pay $249/yr."
- In-product: "Founding Member" badge added to FM customer settings page
- Blog post section in release announcement explaining the pricing rationale (why $249 is still 35% below Proxmox Community at €355/yr)

**Compliance Brief (new asset):**
- "Weaver v1.2 Compliance Alignment — CMMC Level 2, HIPAA, SOC 2" (1-page PDF + web page) — maps v1.2 firewall zones, AppArmor, Seccomp, audit logging to specific control requirements. Target: partner firms for client proposals.

**Demo Video Update:**
- Record new 5-minute demo video featuring v1.2 full container lifecycle, firewall configuration, and Tailscale wizard. Replace v1.0 video on demo site and YouTube/Vimeo.

### Channel Strategy

**Day -7 (1 week pre-launch):**
- Publish pricing change blog post: "Weaver pricing changes when v1.2 ships — here's what it means for you"
- Email all existing users (Free + FM) with pricing change notice

**Day 0 (release day):**
- Publish full release announcement blog post
- Push updated demo site (v1.2 state)
- Email all users: v1.2 is live, pricing stepped
- Close FM window in Stripe (Weaver Solo FM SKU deactivated)

**Day 1:**
- r/NixOS: "Weaver v1.2: unified VM + container management — we just shipped The Closer"
- r/homelab: image post with container + VM grid screenshot
- r/selfhosted: "Weaver v1.2 — Docker + Apptainer + MicroVMs from one dashboard on NixOS"

**Day 2:**
- HN: "Show HN: Weaver v1.2 — MicroVMs + Docker + Apptainer, unified dashboard, NixOS-native"
- dev.to: unified management blog post (#2)

**Day 4–10:**
- Blog posts #3, #4, #5 on 3-day cadence
- NixOS Discourse: release thread with technical changelog
- Channel partners: distribute v1.2 release announcement to their client newsletters

**Day 14:**
- Compliance brief distributed to all channel partners
- Tailscale pre-outreach: send product update to Tailscale partnership contact (pre-TA outreach warmup for v1.3)

### Pricing Actions
- **Weaver Solo FM closes on release day** — $249/yr is the only price after this
- Existing FM customers: no change, permanently grandfathered at $149/yr
- Fabrick FM ($1,299/yr/node) remains open (separate window, closes at v2.2)
- Update all pricing pages, Stripe products, and marketing copy from $149 → $249

### Partner / TA Actions
- **Channel partners:** Distribute "The Closer" release kit — updated comparison pages, compliance brief, new demo video access
- **1Password / Yubico:** Include v1.2 in their partner newsletters (coordinate with each TA)
- **Tailscale (pre-TA):** Informal content share — "Tailscale wizard ships in Weaver v1.2" — send to Tailscale partnership contact. Set formal TA outreach for v1.3.
- **Kanidm:** Share v1.2 changelog; continue v2.0 TA planning

### Vertical Outreach
- **Defense / CMMC:** Firewall zones + AppArmor + Seccomp directly maps to CMMC Level 2 controls (AC.3.012, CM.2.061, SI.1.210). Share `defense-contractors.md` sales doc with channel partners for active client conversations.
- **Healthcare:** Firewall egress control maps to HIPAA §164.312(e)(1) (transmission security). Share `healthcare.md` sales doc.
- **Financial Services:** Hardening plugins address PCI DSS Requirement 6.4 (system hardening). Share `financial-services.md`.

### Upgrade CTAs
- Free → Weaver: "Full container management requires Weaver ($249/yr) — Docker, Apptainer, GPU passthrough, and firewall rules, all declarative."
- Free → Weaver: Firewall plugin gated — "Firewall zones and AppArmor hardening require Weaver."
- Weaver → Fabrick: "Need container RBAC and audit logging for compliance? That's Fabrick."

### Acceptance Criteria
1. FM window closed in Stripe on release day
2. All pricing pages updated to $249/yr
3. Pricing change email sent to all existing users
4. All 5 blog posts live within 2 weeks of release
5. Updated comparison pages live (vs-proxmox, vs-portainer, vs-cockpit)
6. Compliance brief distributed to channel partners
7. New 5-minute demo video live on demo site

---

## v1.3.0 — Remote Access + Mobile (Android GA)

### Launch Type
Feature launch with App Store event. Android GA is the most visible consumer-facing milestone so far. Native mobile app = App Store/Play Store organic discovery channel. Tailscale TA formalizes.

### Trigger
- v1.3 code GA
- Android app approved on Google Play
- Tailscale TA outreach completed (partnership contact confirmed)
- Demo site updated with v1.3 mobile-responsive screenshots

### Target Segments
- All existing Weaver users (everyone gets the mobile app — it's Free tier)
- New organic discovery via Google Play Store search
- Remote workers who manage home lab infrastructure
- Defense/CMMC and healthcare users (Network Isolation Mode for compliance audit periods)
- Homelab / r/selfhosted community (remote access is a top use case)

### Key Message
"Manage your NixOS infrastructure from your pocket — free native Android app with biometric auth and Tailscale remote access. No competitor offers this."

### Content Deliverables

**Blog Posts:**
1. "Weaver v1.3: Manage Your NixOS VMs From Your Phone" — release announcement, Android app highlights, Tailscale wizard recap, Network Isolation Mode for compliance.
2. "Why Weaver's Mobile App Is Free (And Why That Matters)" (~1,000 words) — explains the sysop-as-champion model, App Store as organic discovery, no IAP, external subscription model.
3. "Network Isolation Mode: CMMC and HIPAA Compliance During Audit Periods" (~1,200 words) — technical walkthrough of toggle behavior, NixOS rollback safety, VMs unaffected during tunnel disablement. Cite CMMC AC.1.001 and HIPAA §164.312(e)(2)(i). Target: defense contractors, healthcare.
4. "Tailscale + NixOS + Weaver: The Remote Access Stack That Just Works" (~1,000 words) — coordinate with Tailscale for joint publication or amplification. Covers: Tailscale MagicDNS, NixOS module, one-wizard setup, mobile app remote access over Tailscale.

**App Store Assets:**
- Google Play listing: screenshots (dashboard, VM list, VM detail, biometric auth prompt), description copy, feature list
- App Store listing (iOS, when available at v1.3.x): identical asset set

**Demo Site Update:**
- Add mobile view screenshots to demo site
- Show responsive layout in tier-switcher demo

### Channel Strategy

**Day 0:**
- Release announcement blog post
- Google Play listing goes live
- Post r/NixOS: "Weaver v1.3 — Android app, Network Isolation Mode, WireGuard wizard"
- Tailscale co-marketing coordination: share announcement with Tailscale partnership contact

**Day 1:**
- r/homelab + r/selfhosted: image post with phone screenshot of VM dashboard
- Tweet/social: "Your NixOS VM dashboard is now in your pocket. Free for all users."
- HN: "Show HN: Weaver — NixOS VM management with native Android app (biometric auth, Tailscale)"

**Day 3:**
- Network Isolation Mode blog post — target: LinkedIn (compliance audience), r/netsec
- dev.to: mobile app reasoning post

**Day 7:**
- Tailscale joint blog post (or guest post on Tailscale blog)
- Partner newsletter: distribute to all 5 channel partners for client outreach

### Pricing Actions
- No price changes at v1.3
- Push notifications and WireGuard wizard are Weaver gated — natural in-product upgrade moment after Android app install

### Partner / TA Actions
- **Tailscale:** Initiate formal TA outreach. Target: affiliate program enrollment, co-marketing on joint blog post, listing in Tailscale integration directory.
- **1Password / Yubico:** Include mobile app in their partner newsletters — "Weaver now has a mobile app" is a cross-sell opportunity (mobile biometric auth + YubiKey FIDO2)
- **Channel partners:** Distribute mobile app release kit. Update partner sales collateral to include mobile screenshot.

### Vertical Outreach
- **Defense / CMMC:** Network Isolation Mode is a direct CMMC audit period compliance feature. Distribute compliance blog post to channel partners with CMMC-focused clients.
- **Healthcare:** Network Isolation Mode maps to HIPAA §164.312(e)(2)(i) (encryption during audit). Share with healthcare-focused channel partners.
- **Government:** Network Isolation Mode + WireGuard (air-gap friendly) resonates with FedRAMP controlled environments.

### Upgrade CTAs
- Free → Weaver: In-app after first mobile session — "Push notifications for VM state changes require Weaver. Deep-link VM actions require Weaver."
- Free → Weaver: "WireGuard wizard (self-hosted, air-gap friendly) requires Weaver."

### Acceptance Criteria
1. Android app live on Google Play
2. All 4 blog posts published
3. Tailscale TA outreach initiated (contact made, affiliate or partnership program started)
4. Mobile screenshots on demo site
5. Channel partner mobile release kit distributed

---

## v1.4.0 — Cross-Resource AI Agent + Bridge Active Routing

### Launch Type
Feature launch — AI positioning deepens. First release where AI crosses the VM/container boundary AND the bridge becomes a traffic controller. This is the version where the AI inference story becomes sellable: GPU passthrough (v1.2) + bridge-as-inference-LB (v1.4) + AI-managed blue/green model deployment = a complete single-host inference management platform. Builds toward the AI vertical sales story needed before v3.0 Anthropic TA outreach.

### Trigger
- v1.4 code GA
- Demo site updated with cross-resource AI diagnostic examples
- AI credential vault feature visible in Settings (admin-only)

### Target Segments
- Existing Weaver users with mixed VM + container environments
- DevOps engineers who want AI-assisted infrastructure diagnostics
- Research / HPC audience (Apptainer + VM + AI diagnostics is a unique combination)
- Security-focused sysadmins (AI credential vault foundation)
- **AI/ML engineers and self-hosters running local inference** (Ollama, vLLM, llama.cpp) — bridge-based load balancing + blue/green model deployment is the hook
- **ML platform engineers** evaluating alternatives to K8s + GPU Operator — "three K8s components collapse into one bridge"

### Key Message
"Weaver's AI diagnostics now see your entire infrastructure — ask why a container can't reach a VM, and get an answer with context from the full topology. Bridge active routing turns your network bridge into an inference load balancer — no NGINX, no HAProxy, no K8s ingress controller."

### Content Deliverables

**Blog Posts:**
1. "Weaver v1.4: Cross-Resource AI Diagnostics + Bridge Active Routing" — release announcement. Show example prompts and AI responses spanning VMs and containers. Introduce bridge-as-LB story.
2. "Infrastructure AI Without the Privacy Trade-Off: How Weaver's BYOK Model Works" (~1,200 words) — BYOK model explanation, why control over AI provider selection matters for regulated environments, HIPAA/CMMC implications.
3. "Unified Search Across VMs and Containers: Why It's Harder Than It Looks" (~800 words) — technical blog on unified resource namespace, developer audience.
4. "Self-Hosted AI Inference Without Kubernetes: How Weaver's Bridge Replaces Three K8s Components" (~1,500 words) — the bridge convergence pitch for ML engineers. CNI + ingress controller + Argo Rollouts → one bridge. GPU passthrough + bridge routing + blue/green = complete inference platform. Include: traditional workload angle (HPC, rendering, VDI). Target: r/LocalLLaMA, r/selfhosted, HN, LinkedIn ML audience.
5. "Blue/Green Model Deployment on NixOS: Zero-Downtime Inference Updates" (~1,000 words) — walkthrough: clone inference VM with new model → shift bridge weight → health check → confirm/rollback. NixOS reproducibility angle: flake-locked model environments mean rollback is instant. Target: ML engineering blogs, dev.to.

**Demo Update:**
- Add cross-resource AI diagnostic example to demo site (show AI response referencing both container and VM context)
- Update 5-minute demo video or create a supplemental "AI features" 2-minute clip

### Channel Strategy
- Release announcement blog post day 0
- r/NixOS, r/selfhosted day 1
- HN: "Ask HN: How are people using AI for infrastructure diagnostics?" (discussion angle)
- dev.to: BYOK privacy post day 3
- LinkedIn: compliance audience for BYOK / HIPAA angle

### Pricing Actions
- No price changes at v1.4
- Cross-resource AI topology is a Fabrick-gated feature — natural fabrick upgrade CTA

### Partner / TA Actions
- **Anthropic (pre-TA warmup):** No formal outreach yet (target v3.0), but mention Claude as the default AI agent in blog post #2. Establish positioning for future TA conversation.
- **NVIDIA (pre-TA warmup):** AI credential vault + CUDA/GPU inference workloads story is now concrete: GPU passthrough (v1.2) + bridge-as-inference-LB (v1.4) + AI-managed blue/green = complete inference platform. Flag internally for v2.0 formal NVIDIA outreach. Share blog post #4 as conversation starter.
- **Channel partners:** Distribute AI diagnostic blog posts as client-facing content — "your clients' sysadmins can use natural language to debug their NixOS infrastructure." AI inference blog (#4) is a new sales tool for partners with ML-heavy clients.

### Vertical Outreach
- **Research / HPC:** Cross-resource AI + Apptainer is a unique value prop. GPU bridge load balancing directly addresses shared GPU infrastructure management. Share with any HPC contacts from community.
- **Defense:** BYOK model is critical for CMMC/ITAR environments — AI provider selection control. Surface in defense channel partner conversations. Bridge inference routing for on-prem classified AI workloads is a differentiator.
- **AI/ML (new vertical):** Self-hosted inference story now complete at single-host level. Seed r/LocalLLaMA, r/MachineLearning, and ML-focused Discord servers with blog post #4. AI inference sales doc ready: `business/sales/AI-INFERENCE-VALUE-PROPOSITION.md`.

### Upgrade CTAs
- Free → Weaver: Unified search across VMs + containers requires Weaver
- Weaver → Fabrick: Topology + dependency mapping (cross-node AI context) is Fabrick — natural bridge for v2.3 Fabrick clustering story

### Acceptance Criteria
1. All 3 blog posts published
2. Cross-resource AI demo updated on demo site
3. Channel partners have blog posts for client distribution

---

## v1.5.0 — Integrated Secrets Management

### Launch Type
Feature launch — compliance positioning. Secrets management embedded in the workload manager is a significant differentiator. No competitor including Proxmox has this. Builds the SOC 2 / HIPAA / CMMC credential management story.

### Trigger
- v1.5 code GA
- Compliance brief updated to include secrets management controls mapping
- Channel partners briefed on secrets management compliance story

### Target Segments
- Fabrick customers (per-workload assignment + audit trail is Fabrick-gated)
- Compliance-driven buyers: healthcare, defense, financial services, pharma
- DevSecOps engineers running credential-sensitive workloads

### Key Message
"Weaver is the first VM + container management dashboard with integrated credential management — secrets injected at workload boot, audit-trailed at every access, compliant with HIPAA §164.312, CMMC Level 2, PCI DSS, and SOC 2."

### Content Deliverables

**Blog Posts:**
1. "Weaver v1.5: Integrated Secrets Management — Credentials as Infrastructure" — release announcement, architecture overview, regulatory mapping summary.
2. "Why Secrets Management Belongs Inside Your Workload Manager, Not Beside It" (~1,200 words) — philosophical/architectural argument. No competitor has this. Why the right place for secrets is where workloads are defined, not as a sidecar tool.
3. "NixOS Credential Management for HIPAA, CMMC, and SOC 2: A Compliance Brief" (long-form) — map specific v1.5 features to HIPAA §164.312(a)(2)(iv) (encryption/decryption keys), CMMC IA.3.083 (multi-factor), SOC 2 CC6 (logical and physical access), PCI DSS Requirement 8.3 (password management).

**Compliance Brief (new asset):**
- "Weaver v1.5 Compliance Alignment — Credential Management Controls" (1-page PDF + web) — distribute to channel partners

### Channel Strategy
- Release announcement day 0
- Compliance blog post published to dev.to and personal blog day 0
- LinkedIn: compliance brief (primary channel for this release — audience is security officers and compliance teams, not just sysadmins)
- r/netsec: secrets management architecture blog post
- Channel partner newsletter distribution day 3

### Pricing Actions
- No price changes at v1.5
- Per-workload credential assignment + audit trail = Fabrick gate — upgrade CTA from Weaver users

### Partner / TA Actions
- **Channel partners:** Full compliance brief package for client proposals in regulated verticals
- All other TAs: standard changelog notification

### Vertical Outreach
- **Healthcare:** HIPAA §164.312(a)(2)(iv) and §164.308(a)(4) directly addressed. Primary vertical for this release.
- **Defense / CMMC:** IA.3.083 (authenticator management) addressed. Key for CMMC Level 2 customers.
- **Financial Services / PCI DSS:** Requirement 8.3 (strong cryptography for credentials). Share with channel partners who have FS clients.
- **Pharma:** 21 CFR Part 11 audit trail requirements + credential management alignment.

### Upgrade CTAs
- Weaver → Fabrick: "Per-workload credential assignment and credential audit trail require Fabrick."
- Free → Weaver: "Secrets vault expansion and workload injection require Weaver."

### Acceptance Criteria
1. All 3 blog posts published
2. Compliance brief distributed to channel partners
3. LinkedIn compliance post live

---

## v1.6.0 — Migration Tooling Arc

### Launch Type
Feature launch — migration funnel. This release activates the direct migration path for Proxmox and libvirt users. Dockerfile dual-output (Nix VM or Apptainer SIF) is a unique onboarding funnel. Pegaprox territory begins.

### Trigger
- v1.6 code GA
- "Migrate from Proxmox" landing page live
- "Migrate from libvirt" landing page live
- Dockerfile dual-output workflow documented

### Target Segments
- Proxmox users evaluating migration (primary new market segment)
- libvirt / virt-manager users on any Linux distro
- Docker/container shop wanting to try MicroVMs without a full rewrite
- Channel partners with Proxmox-heavy client bases

### Key Message
"Import your Proxmox configs, libvirt XML, or Dockerfiles — Weaver converts them to NixOS declarative configs. One import, no rewrite, no risk."

### Content Deliverables

**Blog Posts:**
1. "Weaver v1.6: Import Your Proxmox Config, No Rewrite Required" — release announcement, migration parser walkthrough, Dockerfile dual-output.
2. "From Proxmox to NixOS: A Migration Story" (~1,500 words) — step-by-step narrative of migrating a Proxmox-managed VM to Weaver using the .conf parser. Honest about what the wizard does and doesn't do. Target: r/homelab, r/Proxmox (check if subreddit exists/is active).
3. "Dockerfile → NixOS VM or Apptainer SIF: Why This Output Matters" (~1,000 words) — technical explanation of the dual-output model, use cases (containerized app needing hardware isolation), HPC users with existing Dockerfiles.

**Landing Pages:**
- `/migrate/from-proxmox` — SEO target: "migrate from Proxmox to NixOS", "Proxmox alternative". Feature: parser walkthrough, before/after config comparison, "try with your Proxmox config" CTA.
- `/migrate/from-libvirt` — SEO target: "libvirt to NixOS", "virt-manager alternative".

**Comparison Page Update:**
- `docs/comparisons/vs-proxmox.md` — add "Direct config import" as a migration comparison point. Frame: "Moving from Proxmox? Import your config directly."

### Channel Strategy
- Landing pages and release announcement day 0
- r/Proxmox or r/homelab: "I built a Proxmox config importer for NixOS — v1.6 of Weaver" (honest, not salesy)
- r/selfhosted, r/NixOS day 1
- HN: "Show HN: Weaver v1.6 — Import Proxmox configs and Dockerfiles into NixOS" day 1
- Proxmox migration blog post day 3

### Pricing Actions
- No price changes at v1.6
- Config export is available to Weaver Free; import/parsers are Weaver/Fabrick gated

### Partner / TA Actions
- **Channel partners:** Migration tooling is the most powerful sales tool for Proxmox/libvirt shops. Distribute migration landing pages and blog posts for client outreach. Update partner sales playbook: "parallel migration removes the risk objection."

### Vertical Outreach
- **Manufacturing / OT:** Proxmox is common in OT-adjacent IT environments. Migration story resonates.
- **MSP / IT Consulting:** Migration services are billable days for channel partners.

### Upgrade CTAs
- Free → Weaver: "Config import and format parsing require Weaver."
- Free → Weaver: "Proxmox and libvirt parser — full import workflow requires Weaver."

### Acceptance Criteria
1. Migration landing pages live (`/migrate/from-proxmox`, `/migrate/from-libvirt`)
2. All 3 blog posts published
3. r/homelab/r/NixOS posts live
4. Channel partners have migration sales playbook update

---

## v2.0.0 — Storage + Templates Wave 1

### Launch Type
Feature launch — storage and template foundation. First v2.x release marks the beginning of the fabrick capability arc. NVIDIA TA outreach begins.

### Trigger
- v2.0 code GA
- NVIDIA TA outreach initiated
- Demo site updated with storage and template views
- i18n: at minimum English + one other language (if ready at GA)

### Target Segments
- Existing users with multi-disk workloads
- Template-heavy DevOps shops (cloud-init integration)
- Mobile users (Capacitor push notifications now available)
- International / non-English NixOS community (i18n)

### Key Message
"Weaver v2.0 — build once, run many. Model library, snapshot-based deployment, and VM templates turn provisioning from minutes into seconds."

### Content Deliverables

**Blog Posts:**
1. "Weaver v2.0: Storage Lifecycle + VM Templates + Model Library — Infrastructure as a Library" — release announcement. Highlight: model library in Shed (registry of model references, testing→staging→production lifecycle), snapshot-based provisioning (2–5 sec memory snapshot restore vs 3–10 min full provision), and template catalog.
2. "Declarative VM Templates on NixOS: cloud-init + Weaver" (~1,200 words) — technical walkthrough of template workflow, cloud-init integration, how templates reduce provisioning time.
3. "GPU Workloads on NixOS: CUDA, ROCm, and oneAPI with Weaver" (~1,200 words) — multi-vendor GPU template walkthrough: NVIDIA CUDA, AMD ROCm, Intel oneAPI. NixOS flake-locked environments per vendor. Position: "Weaver manages your GPUs regardless of vendor." Also cover non-AI GPU workloads: HPC, rendering, VDI. Coordinate with NVIDIA pre-TA conversation for amplification if relationship allows. Seed AMD and Intel communities simultaneously.
4. "2-Second Model Deployment: How Snapshot Provisioning Changes AI Infrastructure" (~1,500 words) — the snapshot story for ML engineers. Full provision once → auto-snapshot → restore in seconds. Build once, run many. Memory snapshot = VRAM warm, model loaded, zero cold start. Rollback = restore previous snapshot. Compare to K8s pod cold start and cloud API latency. Target: r/LocalLLaMA, r/MachineLearning, HN, LinkedIn ML audience.

**TA Outreach Material:**
- Prepare NVIDIA TA pitch deck: Weaver AI workload story, CUDA deployment, institutional EULA capture at contract signing
- **AMD (new):** ROCm template story. AMD MI300X is price-competitive with H100 — position Weaver as vendor-neutral management layer that doesn't force NVIDIA lock-in. Flag for v2.0 outreach alongside NVIDIA.
- **Intel (monitor):** Gaudi 2/3 targeting inference specifically. oneAPI template when nixpkgs support matures. Lower priority than NVIDIA/AMD but watch for enterprise demand signal.

### Channel Strategy
- Release announcement day 0
- r/NixOS, r/homelab day 1
- GPU/CUDA blog post day 5 (timing with NVIDIA outreach initiation)
- dev.to: templates blog post day 3

### Pricing Actions
- No price changes at v2.0
- Snapshots and template cloning are Weaver-gated in v2.1 — begin warming messaging: "Snapshot and clone capabilities coming in v2.1, Weaver required"

### Partner / TA Actions
- **NVIDIA:** Initiate formal TA outreach. Present AI workload story, CUDA deployment, EULA capture model. Target: affiliate or co-marketing agreement for AI VM template use cases.
- **Channel partners:** Distribute v2.0 release kit. Storage lifecycle + templates are new billable service areas.

### Vertical Outreach
- **Research / HPC:** Templates + snapshots + Apptainer = the HPC lab provisioning story. Begin targeted outreach to R1 university research computing contacts.
- **Pharma / Life Sciences:** Reproducible environment templates directly addresses 21 CFR Part 11 reproducibility requirements.

### Upgrade CTAs
- Free → Weaver: "Disk hotplug and I/O limits require Weaver."

### Acceptance Criteria
1. All 3 blog posts published
2. NVIDIA TA outreach initiated (contact made)
3. v2.0 demo state live on demo site

---

## v2.1.0 — Templates Premium + Snapshots

### Launch Type
Feature launch + FM opener. Weaver Team FM opens at this release. First mention of Team tier in any public channel.

### Trigger
- v2.1 code GA
- Weaver Team FM pricing page live ($129/user/yr)
- Stripe Team FM SKU active
- Demo site showing Weaver Team features (peer federation preview)

### Target Segments
- Small infrastructure teams (2–4 sysadmins) with multiple hosts
- Existing Weaver Solo users with more than one host
- Enterprise evaluators (snapshot + cloning is table stakes for enterprise)

### Key Message
"Weaver v2.1 — snapshots, cloning, and save-as-template. Plus: Weaver Team is now in Founding Member access — manage multiple hosts with your team."

### Content Deliverables

**Blog Posts:**
1. "Weaver v2.1: Snapshots, Cloning, and VM Templates — The Full Storage Story" — release announcement + Team FM announcement.
2. "Weaver Team Early Access: Peer Federation for Small Infrastructure Teams" (~1,000 words) — Team tier announcement, what peer federation means, who it's for, FM pricing, when it locks.
3. "NixOS Snapshots: Why Declarative Config + Point-in-Time Snapshots Are Better Together" (~1,000 words) — technical post, dev.to / HN.

**Pricing Page Update:**
- Add Weaver Team to pricing page at $129/user/yr FM
- Add "Team FM opens today" announcement banner to pricing page
- Update tier comparison table to include Team row

### Channel Strategy
- Release + Team FM announcement day 0 (combined post)
- r/NixOS, r/selfhosted, r/homelab: Team tier announcement
- HN: "Weaver Team FM: peer federation for small NixOS infrastructure teams"
- Email all existing Solo and Free users: Team FM now open, $129/user/yr while window is open

### Pricing Actions
- **Weaver Team FM opens:** $129/user/yr, cap at v2.2 GA
- All new Team signups from this point until v2.2 GA are grandfathered at $129/user/yr forever
- Communicate: "Team FM pricing locks at v2.2 — after that, standard is $199/user/yr. Get in now."

### Partner / TA Actions
- **Channel partners:** Team tier opens a new deal size — avg 3 users × $129 = $387/yr per team. Brief all partners on Team tier upsell path.
- All TAs: standard changelog notification.

### Vertical Outreach
- Snapshot + clone story is particularly strong for pharma (21 CFR Part 11 audit trails require reproducible environments) and research (point-in-time environment capture for grant reporting)
- Begin Weaver Team outreach to small IT shops in healthcare (2–4 person IT teams managing 2+ NixOS hosts)

### Upgrade CTAs
- Free → Weaver Team: "Managing more than one host with a small team? Weaver Team is now in FM — $129/user/yr, locked forever."
- Solo → Team: In-product prompt for users who have multiple hosts configured

### Acceptance Criteria
1. Weaver Team FM on pricing page
2. Stripe Team FM SKU active
3. All 3 blog posts published
4. Email announcement to all existing users sent

---

## v2.2.0 — Weaver Team GA + Fabrick Pricing Step-Up

### Launch Type
Major launch. Three simultaneous events: Weaver Team GA, Fabrick FM closes (v2.2 cap), Fabrick pricing steps to $2,000/yr/node. This is the enterprise credibility milestone — multi-host management is now live.

### Trigger
- v2.2 code GA (Weaver Team peer federation fully shipped)
- Fabrick FM window closes on release day
- Fabrick standard pricing updated to $2,000/yr/node in Stripe
- 60-day advance notice for Fabrick price increase was sent at v2.1 launch (planning ahead)
- Team FM closes simultaneously (Weaver Team standard $199/user/yr activates)

### Target Segments
- All existing Fabrick FM customers (no change for them, but confirm and acknowledge)
- Enterprise evaluators who were waiting for multi-host visibility
- Small teams who evaluated Team during FM window — last call
- NixOS consultancies with multi-host client deployments

### Key Message
"Weaver Team is live — manage your infrastructure team from one dashboard. Fabrick now includes multi-host visibility and manual VM migration. We just became fleet software."

### Content Deliverables

**Blog Posts:**
1. "Weaver v2.2: Team Peer Federation + Fabrick Multi-Host Visibility — We're Fleet Software Now" — release announcement, all pricing changes clearly stated.
2. "Weaver Team: How Peer Federation Works Under the Hood" (~1,200 words) — technical: REST+WebSocket protocol, Tailscale MagicDNS peer discovery, host badge on workload cards, full management for Team (2-peer cap) vs. fleet-scale management for Fabrick.
3. "Multi-Host VM Migration: From Single Node to Fleet" (~1,000 words) — Fabrick cold migration walkthrough, Colmena fleet config management, nixos-anywhere provisioning.
4. "Why Weaver Pricing Stepped Up at v2.2 — And Why It's Still Fair" (~800 words) — pricing rationale post. Transparent explanation: product is now fleet software, not a single-host dashboard. Compare to Canonical MAAS ($2,500/yr), Rancher ($150–500/node/yr). Existing FM customers are unaffected.

**Pricing Change Communication:**
- Email to all users: "Weaver Team FM has closed. Standard is now $199/user/yr. Fabrick standard is now $2,000/yr/node. Your existing price is locked — nothing changes for you."
- Update all pricing pages, Stripe products, tier comparison tables
- "Founding Member" badge prominent on FM customer settings pages

**Enterprise Landing Page (new):**
- `/enterprise` — Fabrick value proposition, multi-host management, regulatory compliance table, "contact sales" CTA. Target: enterprise buyers who googled after a channel partner referral.

### Channel Strategy
- Announce on all channels day 0 (this is the largest release announcement to date)
- r/NixOS, r/homelab, r/selfhosted: v2.2 announcement
- HN: "Weaver v2.2 — multi-host NixOS fleet management, peer federation, manual VM migration"
- LinkedIn: focus on enterprise angle — "Weaver is now fleet software" message for IT decision makers
- Channel partner coordinated announcement: all 5 partners send v2.2 announcement to their client lists on the same day

### Pricing Actions
- **Fabrick FM closes:** $2,000/yr/node is the only Fabrick price after release day
- **Weaver Team FM closes:** $199/user/yr standard activates
- **Weaver Solo:** no change ($249/yr standard, FM customers grandfathered at $149/yr)
- Email all prospects in pipeline who were evaluating at pre-v2.2 prices: "pricing changes on [release date] — close before then at current rates"

### Partner / TA Actions
- **Channel partners:** Coordinated announcement with all 5 firms. This is the most important channel partner moment to date.
- **Tailscale TA:** Tailscale MagicDNS peer discovery is a core Weaver Team feature — coordinate announcement with Tailscale, reference the integration in each other's release notes or blog posts.
- **Hetzner + DigitalOcean:** Begin formal TA outreach (targets for v2.3 cloud workloads). Introduce Weaver, Fabrick fleet story, v2.3 cloud workload preview.
- **Backblaze B2:** Begin formal TA outreach (target for v2.4 backup integration).

### Vertical Outreach
- **All verticals:** Multi-host visibility is a baseline enterprise requirement. Update all 11 vertical sales docs to note Fabrick multi-host visibility now available.
- **Defense / CMMC:** Colmena fleet config management + manual migration = fleet-level CM.2.061 (configuration change control) evidence. Key message for defense channel partners.
- **Healthcare:** Multi-host RBAC + audit log = HIPAA §164.312(a)(1) (access control) across a fleet. Priority for healthcare channel partners.

### Upgrade CTAs
- Free → Weaver Team: "Managing multiple hosts? Weaver Team — $199/user/yr."
- Weaver Solo → Team: "Got a co-admin? Weaver Team is now available — manage 2–4 users + monitor peer hosts."
- Weaver Team → Fabrick: "Need to migrate VMs between hosts, run Colmena fleet provisioning, or get full RBAC across your fleet? That's Fabrick."

### Acceptance Criteria
1. FM windows closed in Stripe (Fabrick + Team)
2. New pricing live on all pages and Stripe products
3. Pricing change email sent to all existing users and prospects
4. All 4 blog posts published
5. Enterprise landing page live
6. Channel partner coordinated announcement executed
7. Hetzner + DO + Backblaze TA outreach initiated

---

## v2.3.0 — Fabrick Basic Clustering

### Launch Type
Enterprise launch — this is the Proxmox moat-breaker. Multi-node workload management, cold migration, nixos-anywhere fleet provisioning, Colmena, Attic binary cache, nixos-facter. Hetzner + DigitalOcean cloud workloads (hybrid local+cloud).

### Trigger
- v2.3 code GA
- Hetzner TA agreement or affiliate arrangement confirmed
- DigitalOcean referral/affiliate confirmed
- Demo site updated with multi-node fleet view

### Target Segments
- Fabrick customers ready for fleet management
- Proxmox shops with multiple nodes looking at migration
- Cloud-native + self-hosted hybrid shops (Hetzner/DO cloud workloads alongside on-prem)
- MSPs managing multiple client NixOS deployments

### Key Message
"Fabrick v2.3 — multi-node fleet management, cold VM migration, and hybrid cloud workloads. The Proxmox clustering story begins here."

### Content Deliverables

**Blog Posts:**
1. "Weaver v2.3: Fabrick Clustering — Multi-Node Fleet Management on NixOS" — release announcement. gRPC hub-spoke, nixos-anywhere, Colmena, nixos-facter.
2. "Proxmox Has Clustering. Now Weaver Does Too — With Declarative Config." (~1,500 words) — fair Proxmox clustering comparison. Acknowledge: Proxmox has HA (we don't yet, v3.0). Our advantage: declarative config, Colmena fleet management, no Debian dependency, NixOS reproducibility.
3. "Hybrid Cloud + On-Prem: Weaver + Hetzner (or DigitalOcean)" (~1,000 words) — cloud workload visibility, unified grid, light-blue-7 dashed border for cloud nodes. Co-marketing with Hetzner.
4. "nixos-anywhere + Colmena + Weaver: Zero-Touch Fleet Provisioning" (~1,200 words) — technical deep-dive, targeting DevOps audience.

**TA Co-Marketing:**
- Hetzner: joint blog post or Hetzner referral blog post featuring Weaver integration
- DigitalOcean: referral blog post, DigitalOcean community tutorial

### Channel Strategy
- Release announcement day 0
- Proxmox comparison blog day 1 (high-traffic target: r/Proxmox, r/homelab, r/selfhosted)
- HN: "Weaver v2.3 — NixOS fleet management with cold VM migration and Colmena integration"
- Hetzner co-marketing piece day 5
- LinkedIn: fabrick fleet management angle for IT directors

### Pricing Actions
- No price changes at v2.3
- Fabrick Basic Clustering is Fabrick-only — strong upgrade CTA from Weaver and Team users

### Partner / TA Actions
- **Hetzner:** Co-marketing blog, referral link in product and blog
- **DigitalOcean:** Referral program active, DO community tutorial
- **Backblaze B2:** Continue outreach — backup integration targets v2.4 so TA needs to be in place by v2.3 release
- **Channel partners:** Update migration sales playbook: "Proxmox clustering migration path now viable — cold migration ships today"

### Vertical Outreach
- **MSP / IT Consulting:** Fleet management is the primary MSP use case. Distribute Colmena + nixos-anywhere blog to all MSP-focused channel partners.
- **Research / HPC:** nixos-facter hardware discovery + fleet provisioning is directly applicable to HPC cluster management.
- **Manufacturing:** Edge fleet provisioning story begins. Flag edge management as v3.1 target.

### Upgrade CTAs
- Weaver → Fabrick: "Multi-node fleet management, cold VM migration, and Colmena fleet provisioning require Fabrick."
- Weaver Team → Fabrick: "Team can see peer hosts. Fabrick can manage, migrate, and provision across your entire fleet."

### Acceptance Criteria
1. All 4 blog posts published
2. Hetzner co-marketing piece live
3. DigitalOcean referral active
4. Channel partners have updated migration playbook

---

## v2.4.0 — Backup Weaver + Cloud Workloads

### Launch Type
Feature launch — backup and off-site storage. Backblaze B2 TA co-marketing is the headline partnership event for this release.

### Trigger
- v2.4 code GA
- Backblaze B2 TA agreement / affiliate confirmed
- Demo site updated with backup job configuration view

### Target Segments
- All existing Weaver users (backup is universal)
- Compliance-driven buyers (backup is a requirement for HIPAA, CMMC, PCI DSS, SOC 2)
- Hybrid cloud shops already using Hetzner/DO (backup to cloud storage)

### Key Message
"Backup your NixOS VMs and containers — scheduled jobs, local and NFS targets, restore workflows. Backblaze B2 integration for off-site, encrypted backup."

### Content Deliverables

**Blog Posts:**
1. "Weaver v2.4: Backup Jobs + Restore Workflows — Your NixOS Infrastructure, Protected" — release announcement.
2. "Off-Site Backup for NixOS VMs: Weaver + Backblaze B2" (~1,000 words) — co-marketing piece with Backblaze B2, S3-compatible backup, cost comparison vs. AWS S3 for self-hosted backup.
3. "Backup Compliance for HIPAA, CMMC, and SOC 2: What Weaver v2.4 Covers" (~800 words) — map backup adapter to HIPAA §164.312(c)(2) (backup and recovery), CMMC RE.2.137 (regular backups), SOC 2 A1.2 (backup and recovery).

**TA Co-Marketing:**
- Backblaze B2: joint announcement, referral link in backup configuration UI, B2 blog featuring Weaver

### Channel Strategy
- Release announcement day 0
- Backblaze B2 joint announcement day 0 or 1 (coordinate)
- r/selfhosted: backup release post (high engagement subreddit for backup topics)
- r/homelab: backup + B2 integration
- Compliance blog post to LinkedIn day 3

### Pricing Actions
- No price changes at v2.4
- Backup jobs, local/NFS adapters are Weaver-gated; multi-target, encryption, retention are Fabrick-gated (v2.6)

### Partner / TA Actions
- **Backblaze B2:** TA announcement, co-marketing, referral link in backup UI
- **Channel partners:** Backup is a billable managed service. Brief all partners on backup feature set and compliance mapping.

### Vertical Outreach
- **Healthcare:** HIPAA §164.312(c)(2) requires backup and recovery. Share compliance blog with healthcare partners.
- **Defense / CMMC:** RE.2.137 backup requirements. Share with defense channel partners.
- **Financial Services:** SOC 2 A1.2 backup. Share with FS channel partners.

### Upgrade CTAs
- Free → Weaver: "Backup jobs and restore workflows require Weaver."
- Weaver → Fabrick: "Multi-target backup, retention policies, S3/restic/borg, and encryption ship in v2.6 (Fabrick)."

### Acceptance Criteria
1. All 3 blog posts published
2. Backblaze B2 joint announcement live
3. Channel partners have backup compliance brief

---

## v2.5.0 — Storage Enterprise

### Launch Type
Feature launch — fabrick storage. Copy-on-write, storage pools, quotas, template versioning, fleet updates. Fabrick-gated. Relatively quiet launch — primarily serves existing fabrick customers.

### Trigger
- v2.5 code GA

### Target Segments
- Existing Fabrick customers (primary audience)
- Enterprise evaluators who listed storage as a gap

### Key Message
"Fabrick v2.5 — enterprise storage: copy-on-write, storage pools, quotas, template versioning, and fleet template updates."

### Content Deliverables

**Blog Post:**
1. "Weaver v2.5: Enterprise Storage — Copy-on-Write, Pools, and Fleet Templates" — release announcement.

**Enterprise Upsell Brief:**
- "Weaver Storage Tiers: What's Included at Each Level" (1-page reference) — distribute to channel partners for Fabrick upsell conversations.

### Channel Strategy
- Release announcement day 0
- r/NixOS Discourse: technical release thread
- Channel partner distribution day 1

### Pricing Actions
- No price changes
- Storage pools and quotas are Fabrick-gated — primary upsell trigger for Team → Fabrick

### Partner / TA Actions
- **Channel partners:** Enterprise storage brief for Fabrick upsell conversations.

### Upgrade CTAs
- Weaver Team → Fabrick: "Storage pools, quotas, and fleet template updates require Fabrick."

### Acceptance Criteria
1. Release announcement published
2. FabricK storage brief distributed to channel partners

---

## v2.6.0 — Backup Enterprise + Extension

### Launch Type
Feature launch — backup fabrick. Multi-target, S3/restic/borg, file-level restore, encryption. Closes the Proxmox backup feature gap entirely.

### Trigger
- v2.6 code GA
- Backblaze B2 TA already in place (v2.4)

### Target Segments
- Existing Fabrick customers needing enterprise backup
- Channel partners pitching enterprise backup to compliance clients

### Key Message
"Fabrick v2.6 — multi-target backup, retention policies, S3/restic/borg plugins, file-level restore, and encryption. The complete NixOS backup story."

### Content Deliverables

**Blog Posts:**
1. "Weaver v2.6: Enterprise Backup — Multi-Target, Encrypted, and Compliant" — release announcement.
2. "Proxmox Backup Server vs. Weaver v2.6: An Honest Comparison" (~1,200 words) — acknowledge PBS strengths (mature, feature-rich), position Weaver advantages (NixOS-native, declarative, per-workload encryption, Fabrick fleet scope).

**Compliance Brief Update:**
- Update v1.2 / v1.5 compliance briefs to include v2.6 backup controls: HIPAA §164.312(c)(1), CMMC RE.3.139, SOC 2 A1.2 (fully addressed).

### Channel Strategy
- Release announcement day 0
- Proxmox Backup comparison blog day 3 (r/homelab, r/Proxmox)
- Compliance brief update distributed to channel partners

### Pricing Actions
- No price changes
- Multi-target, S3 adapters, encryption are Fabrick-gated — final v2.x Fabrick upsell

### Partner / TA Actions
- **Backblaze B2:** Include v2.6 restic/S3 integration in B2 partner newsletter
- **Channel partners:** Updated compliance brief for backup

### Upgrade CTAs
- Weaver → Fabrick: "Multi-target backup, S3/restic/borg, encryption, and retention policies require Fabrick."

### Acceptance Criteria
1. Both blog posts published
2. Compliance brief updated and distributed
3. B2 partner newsletter coordination complete

---

## v3.0.0 — Fabrick Fleet Control Plane (Enterprise Launch)

### Launch Type
Enterprise launch — full press. This is the HA clustering release. Proxmox clustering equivalence achieved. Pricing steps to $3,500/yr/node. Anthropic TA outreach begins. This is the most significant launch since v1.2.

### Trigger
- v3.0 code GA (HA failover, live migration, shared storage, STONITH)
- Stripe pricing updated: Fabrick steps to $3,500/yr/node (flat $1,750/yr all additional nodes)
- 60-day advance notice for price increase sent at v2.6 launch
- Anthropic TA outreach initiated
- Fabrick Cloud pre-sell infrastructure ready (landing page, Stripe product, terms page)
- "Contact Enterprise Sales" form live
- All 11 vertical compliance briefs updated to reflect v3.0 HA + live migration capabilities

### Target Segments
- Enterprise IT departments with HA requirements
- Proxmox Enterprise customers evaluating migration
- Rancher / Nutanix evaluators (price and NixOS-native positioning)
- Healthcare, defense, financial services, pharma (regulated enterprise market)
- Channel partners' existing enterprise clients
- New enterprise prospects via partner referral

### Key Message
"Fabrick v3.0 — HA clustering, live migration, and fleet control at $3,500/yr first node. Comparable to Rancher and Canonical MAAS. Built for NixOS. The full enterprise story is here."

### Content Deliverables

**Blog Posts:**
1. "Weaver v3.0: Fabrick HA Clustering — Live Migration, Shared Storage, and Fleet Control" — flagship release announcement. Pricing clearly stated.
2. "High Availability on NixOS: How Fabrick v3.0 Implements HA Failover and Live Migration" (~1,500 words) — technical deep-dive on HA architecture, STONITH/fencing, shared storage.
3. "Fabrick vs. Rancher vs. Nutanix vs. Canonical MAAS: An Honest Enterprise Comparison" (~1,500 words) — fair four-way comparison. Acknowledge: Rancher has wider ecosystem, Nutanix has HCI, MAAS has bare-metal focus. Position: NixOS-native, declarative config, atomic rollbacks, price.
4. "Why Weaver Pricing Stepped Up at v3.0 — And Why It's Still Well Below OpenShift" (~800 words) — transparent pricing rationale. $3,500/yr/node at 10 nodes = $19,250/yr vs. OpenShift at $3,000–9,200/node/yr. Existing customers unaffected.
5. "Fabrick Cloud Pre-Sell: Founding Member Access Starts Today" (~1,000 words) — announce Fabrick Cloud pre-sell program, ≥20 Founding Member gate, $150/yr/node FM, Path A/B decision explained honestly.

**Enterprise Collateral (new):**
- "Fabrick v3.0 Enterprise Brief" (2-page PDF) — HA, live migration, regulatory mapping summary, pricing, success program options. For channel partner use in enterprise proposals.
- Updated `/enterprise` landing page with v3.0 HA capabilities

**Press:**
- Reach out to NixOS-adjacent tech press (LWN, Phoronix, heise online) with embargo announcement. v3.0 is the first genuinely press-worthy milestone.

### Channel Strategy

**Day -60:**
- 60-day pricing advance notice published (blog + email to all users)
- Fabrick Cloud pre-sell landing page and Stripe product ready but not yet promoted

**Day -7:**
- Reminder pricing email: "v3.0 ships next week. Fabrick steps to $3,500/yr/node. Lock in current Fabrick pricing before release day."

**Day 0:**
- All blog posts live simultaneously
- Enterprise landing page updated
- Pricing updated in Stripe
- Email to all users: v3.0 live, pricing stepped, existing customers grandfathered
- Channel partners send v3.0 announcement to their client lists
- Press outreach (coordinated with embargo)

**Day 1:**
- r/NixOS, r/homelab, r/selfhosted release posts
- HN: "Weaver v3.0 — NixOS HA clustering, live migration, $3,500/yr/node fleet management"
- LinkedIn: enterprise announcement

**Day 3:**
- Technical HA architecture blog post
- Comparison blog post (r/homelab, HN)
- Press coverage follows embargo lift (Day 0 or later per outlet)

### Pricing Actions
- **Fabrick standard steps to $3,500/yr/node (flat $1,750/yr additional nodes)**
- Existing FM Fabrick customers ($1,299/yr/node): no change, grandfathered forever
- Existing standard Fabrick customers: no change, grandfathered at their rate
- All new Fabrick customers from release day: $3,500/yr first node
- Weaver Solo: steps to $299/yr for new customers
- Weaver Team: no change ($199/user/yr)
- Update all pricing pages, Stripe products, channel partner collateral

### Partner / TA Actions
- **Anthropic:** Initiate formal TA outreach. Target: official BAA for HIPAA Fabrick customers. Reference: Claude is already the default AI agent (BYOK model). TA formalizes: co-marketing, BAA access for healthcare enterprise accounts.
- **Channel partners:** This is the primary enterprise sales moment. Fabrick v3.0 closes the deals channel partners have been warming since v2.2. Provide: updated enterprise brief, full success program pricing, design partner testimonials if available.
- **All other TAs (1Password, Yubico, Tailscale, Hetzner, DO, B2, NVIDIA):** Include v3.0 in their partner newsletters.
- **Fabrick Design Partners (FM customers):** Personal email from founder: "v3.0 is live. Thank you for shaping this. Your price is locked forever."

### Vertical Outreach

This release activates full-stack enterprise sales across all verticals:

- **Healthcare:** HA + live migration + Anthropic BAA (v3.0 + BAA TA) directly addresses HIPAA §164.308(a)(7) contingency planning. Primary close trigger for healthcare fabrick.
- **Defense / CMMC:** HA + STONITH addresses CMMC CP.3.191 (system recovery). Live migration enables zero-downtime patching. Priority for defense channel partners.
- **Financial Services:** HA failover addresses SOX and FFIEC business continuity requirements. PCI DSS Requirement 12.3 (protection of cardholder data during incidents). Fabrick target for FS channel partners.
- **Pharma:** HA + live migration enables zero-downtime updates for GxP-validated systems — compliant with EU GMP Annex 11 §7 (data integrity during system changes).
- **Government:** FedRAMP Rev 5 CP-9 (backup and recovery) directly addressed. HA + live migration for FISMA continuity.
- **Research / HPC:** HA cluster is table stakes for active grant-funded computing. Coordinate with NVIDIA TA on CUDA/GPU workload HA story.

### Upgrade CTAs
- Weaver Team → Fabrick: "HA clustering, live migration, and fleet resource scheduling require Fabrick. v3.0 is live."
- In-product: "Your infrastructure is ready for Fabrick. 10-node HA cluster: $19,250/yr vs. OpenShift at $30K–90K+/yr."

### Acceptance Criteria
1. All 5 blog posts published on release day
2. Enterprise landing page updated
3. Pricing updated in Stripe and all marketing pages
4. Pricing advance notice sent 60 days prior
5. Anthropic TA outreach initiated
6. Fabrick Cloud pre-sell landing page live
7. Press outreach to LWN, Phoronix, heise executed
8. Channel partner coordinated announcement complete
9. All 11 vertical compliance briefs updated for v3.0

---

## v3.1.0 — Edge Fleet + Cloud Burst (Invoice)

### Launch Type
Enterprise launch — edge market entry + AI/HPC cloud burst. First release targeting the $22B edge software market (37% CAGR). GPU/InfiniBand passthrough for MicroVMs opens the AI/HPC regulated workload market.

### Trigger
- v3.1 code GA
- Invoice billing infrastructure ready for cloud burst node enrollment
- Demo site updated with fleet map showing on-prem vs cloud node visual distinction

### Target Segments
- Manufacturing IT (edge: camera nodes, PLCs, floor automation — 23% of edge market)
- AI/HPC regulated workloads (national labs, pharma computation, defense research)
- Existing Fabrick customers ready to burst into cloud
- MSPs managing edge deployments

### Key Message
"Weaver v3.1 — manage your edge fleet from the same dashboard as your data center. Add cloud burst nodes for AI/HPC workloads. One pane, all environments."

### Content Deliverables

**Blog Posts:**
1. "Weaver v3.1: Edge Fleet Management + Cloud Burst — Your Entire Infrastructure From One Pane" — release announcement.
2. "NixOS at the Edge: Zero Drift, Boot-Clean, and Fleet-Managed" (~1,200 words) — impermanence model, microvm.nix factory, nixos-anywhere for edge provisioning.
3. "GPU Cloud Burst for AI/HPC: NixOS Workloads With Hardware Isolation" (~1,200 words) — GPU/InfiniBand passthrough, per-node-day tracking, regulated AI workload story (defense, healthcare, pharma). Target: LinkedIn, AI/HPC community.
4. "The $22B Edge Software Market: Why NixOS Is the Right Foundation" (~1,000 words) — edge market sizing, NixOS advantages (zero drift, atomic updates, microvm.nix factory pattern).

### Channel Strategy
- Release announcement day 0
- Edge blog post day 1 — LinkedIn (manufacturing IT audience)
- GPU/HPC blog post day 3 — LinkedIn, HN, dev.to
- r/NixOS, r/selfhosted day 1

### Pricing Actions
- No standard pricing changes at v3.1
- Cloud burst node enrollment: invoice-based for large enterprise

### Partner / TA Actions
- **Hetzner + DigitalOcean:** Cloud burst node enrollment integrates with cloud provider APIs — coordinate announcement, referral links active for burst workloads
- **NVIDIA:** Cloud burst GPU/InfiniBand story is the NVIDIA TA co-marketing moment. GPU passthrough for MicroVMs + CUDA on Fabrick = primary NVIDIA use case.
- **Anthropic:** If BAA confirmed from v3.0 outreach, co-market AI/HPC cloud burst with Anthropic for healthcare/pharma AI workload story.
- **Channel partners:** Edge fleet management is a significant new revenue stream for MSP and manufacturing IT partners. Briefing and updated sales collateral.

### Vertical Outreach
- **Manufacturing / OT:** Edge fleet on the factory floor. Camera nodes, PLC management, IEC 62443 alignment.
- **Research / HPC:** Cloud burst for AI/HPC workloads — R1 university HPC centers, national labs.
- **Defense:** Edge fleet for forward-deployed nodes, regulated AI workloads.

### Upgrade CTAs
- Fabrick → FabricK/Contract: "Running AI workloads with 512GB+ RAM? Fabrick or Contract tier — built for GPU compute."
- Non-Fabrick → Fabrick: "Edge fleet management and cloud burst node enrollment require Fabrick."

### Acceptance Criteria
1. All 4 blog posts published
2. NVIDIA co-marketing coordination complete
3. Channel partners briefed on edge fleet management
4. Invoice billing active for cloud burst

---

## v3.2.0 — Cloud Burst Self-Serve Billing

### Launch Type
Feature launch — self-serve billing for cloud burst. Stripe metered billing opens the smaller AI lab and DevOps team market (no sales call required).

### Trigger
- v3.2 code GA (Stripe metered billing, pre-purchase day pools, automated pool renewal)
- Self-serve cloud burst billing live in Stripe

### Target Segments
- Smaller AI teams and DevOps shops who couldn't engage with invoice billing
- GPU-aware scheduling users (Slurm/K8s integration)
- Existing Fabrick cloud burst users moving to self-serve

### Key Message
"Cloud burst is now self-serve — buy GPU-hour pools, draw down as needed, auto-renew when you hit 20%. No sales call, no invoice."

### Content Deliverables

**Blog Posts:**
1. "Weaver v3.2: Self-Serve Cloud Burst Billing — GPU Hours on Demand" — release announcement.
2. "Slurm + Kubernetes Bridge: GPU-Aware Scheduling Hints in Weaver" (~1,000 words) — technical blog for HPC/DevOps audience.

### Channel Strategy
- Release announcement day 0
- GPU scheduling blog day 3 — HN, dev.to
- LinkedIn: AI team audience for self-serve billing story

### Pricing Actions
- No pricing changes
- Self-serve metered billing is the pricing model for cloud burst

### Partner / TA Actions
- **NVIDIA:** Self-serve GPU burst is the consumer face of the NVIDIA TA story
- **Hetzner + DO:** Self-serve billing routes through their referral links

### Upgrade CTAs
- Fabrick (existing): "Cloud burst self-serve billing is now live — no sales call needed."

### Acceptance Criteria
1. Both blog posts published
2. Stripe metered billing active
3. Self-serve flow tested end-to-end

---

## v3.3.0 — Fabrick Maturity + Compliance Pack + Fabrick Cloud Pre-Sell Gate

### Launch Type
Enterprise launch — final v3.x release. Fabrick Cloud pre-sell is the primary marketing event. This release determines Path A vs. Path B for v4.0 engineering.

### Trigger
- v3.3 code GA
- Fabrick Cloud pre-sell landing page fully live (was partially live since v3.0 — now fully promoted)
- Path A/B gate tracking active (internal counter of Founding Member commitments vs. 20-customer gate)
- All existing Fabrick customers have received direct outreach about Fabrick Cloud pre-sell

### Target Segments
- All existing Fabrick customers (primary Fabrick Cloud pre-sell audience)
- New enterprise prospects evaluating Fabrick at the fleet maturity milestone
- AI/HPC, healthcare, defense regulated workload buyers

### Key Message
"Fabrick v3.3 — fleet maturity, compliance pack, and Fabrick Cloud pre-sell. Join as a Founding Member at $150/yr/node and shape the managed control plane."

### Content Deliverables

**Blog Posts:**
1. "Weaver v3.3: Fabrick Maturity + Fabrick Cloud Founding Member Pre-Sell" — release announcement, full Fabrick Cloud pre-sell explanation.
2. "Fabrick Cloud: What Managed Control Plane Means for Your Fleet" (~1,200 words) — explains the architecture (customer nodes remain on-prem, WBD runs the hub), what Founding Member status includes, Path A/B decision gate (honest explanation).
3. "The NixOS Compliance Pack: CMMC, HIPAA, SOC 2, and PCI DSS in One Release" (~1,200 words) — if compliance pack features ship in v3.3, cover each regulation with specific control mapping.

**Fabrick Cloud Pre-Sell Landing Page:**
- Full promotion begins at v3.3 launch (was soft-available since v3.0)
- Includes: what Fabrick Cloud is, Founding Member rate ($150/yr/node), delivery commitment and refund policy, Path A/B gate explained, "Commit as Founding Member" CTA (Stripe checkout)
- Counter: "X of 20 Founding Member slots committed" (public or private — recommend public for urgency)

**Direct Outreach:**
- Personal email from founder to all Fabrick customers: "v3.3 is live. Fabrick Cloud Founding Member slots are now actively promoted. If you want $150/yr/node locked forever and a say in the managed control plane, now is the time."

### Channel Strategy
- Release announcement day 0
- Fabrick Cloud blog post day 0 (paired with release announcement)
- Direct email to all Fabrick customers day 0
- LinkedIn: Fabrick Cloud announcement for enterprise audience
- r/NixOS, r/selfhosted day 1
- Channel partners: forward Fabrick Cloud pre-sell to their enterprise client lists

### Pricing Actions
- No standard pricing changes at v3.3
- Fabrick Cloud Founding Member: $150/yr/node (deferred billing until v4.0 GA)
- Communicate: "Path A/B decision happens at v3.0 GA + Founding Member count. If ≥20 commit, we build the managed platform. If <20, we pivot to AI vertical. We will be transparent about the count and the decision."

### Partner / TA Actions
- **All TAs:** Include Fabrick Cloud pre-sell in partner announcements
- **Channel partners:** Fabrick Cloud is a new upsell to existing Fabrick clients. Commission applies to cloud add-on revenue (confirm with partner agreement terms).
- **Anthropic:** If BAA is confirmed, Fabrick Cloud + Claude BAA is the healthcare enterprise pitch.

### Vertical Outreach
- **All verticals with existing Fabrick customers:** Direct outreach for Fabrick Cloud pre-sell
- **AI/HPC (Research, Defense):** GPU fleet telemetry + AI diagnostics at fleet scope = primary Fabrick Cloud value prop for this vertical
- **Healthcare (with Anthropic BAA):** SLA-backed control plane + BAA = HIPAA contingency planning addressed

### Upgrade CTAs
- Fabrick → Fabrick Cloud: "Founding Member pre-sell — $150/yr/node, locked forever. 20 slots. Closes at v4.0 GA."
- Weaver Team → Fabrick: "Fabrick Cloud requires Fabrick. Upgrade first, then add Fabrick Cloud."

### Acceptance Criteria
1. Fabrick Cloud pre-sell landing page fully promoted
2. All 3 blog posts published
3. Direct email sent to all Fabrick customers
4. Path A/B gate tracking active and public
5. Channel partners distributed Fabrick Cloud pre-sell
6. ≥20 Founding Member commitments = Path A confirmed; <20 = Path B planning begins

---

## Content Library

Evergreen assets that serve multiple releases and remain live throughout the roadmap:

| Asset | URL (target) | Status | Updates Required |
|-------|-------------|--------|-----------------|
| vs-proxmox comparison | `/compare/weaver-vs-proxmox` | Create at v1.0 | Update at v1.2, v1.6, v2.2, v2.3, v3.0 |
| vs-portainer comparison | `/compare/weaver-vs-portainer` | Create at v1.2 | Update at v1.2, v2.3 |
| vs-cockpit comparison | `/compare/weaver-vs-cockpit` | Create at v1.0 | Update at v1.2 |
| Migration: from Proxmox | `/migrate/from-proxmox` | Create at v1.6 | Update at v2.3 |
| Migration: from libvirt | `/migrate/from-libvirt` | Create at v1.6 | — |
| Migration: from VMware | `/migrate/from-vmware` | Create at v2.3 | — |
| Regulatory mapping index | `/compliance` | Create at v1.2 | Update each major |
| TCO calculator | `/tco` | Create at v2.2 | Update at v3.0 |
| Enterprise landing page | `/enterprise` | Create at v2.2 | Update at v3.0 |
| Fabrick Cloud pre-sell | `/fabrick-cloud` | Create at v3.0 | Fully promote at v3.3 |
| 5-minute demo video | YouTube / demo site | Create at v1.0 | Re-record at v1.2, v2.2, v3.0 |
| Sysop-as-champion ROI brief | For partner use | Create at v1.1 | — |
| 11 vertical compliance briefs | For partner use | Create at v1.2 | Update at v1.5, v2.4, v3.0 |

### Comparison Page Standards
Every comparison page must:
- Acknowledge competitor strengths honestly (no straw-man positioning)
- Use a feature table with binary or tiered coverage
- State price comparisons with source and date
- Include a "When to use [competitor]" section
- Link to the migration landing page if applicable

### Regulatory Mapping Standards
Every compliance brief must:
- Cite specific regulation sections (§ level, not just regulation name)
- State which Weaver version and tier activates each control
- Include a "gaps" section for controls not yet addressed
- Date the brief and note the version it reflects

---

## Channel Playbook

Canonical behavior for each distribution channel:

### r/NixOS
- **Audience:** NixOS power users, package maintainers, module contributors
- **Tone:** Technical, developer-first, honest about NixOS-specific tradeoffs
- **Post format:** Text post with code snippet or screenshot — no pure marketing
- **Frequency:** One post per major feature that specifically uses NixOS capabilities
- **Prohibited:** Marketing language, press-release tone, vague feature lists
- **Best posts:** "I built X for microvm.nix" — founder voice, problem-first framing

### r/homelab
- **Audience:** Self-hosters, hobbyists, professional sysadmins evaluating home gear
- **Tone:** Hobbyist-friendly but technically credible
- **Post format:** Image post (dashboard screenshot) + text description
- **Frequency:** At every major capability expansion (v1.0, v1.2, v1.3, v2.2, v3.0)
- **Best posts:** Screenshot-first, "here's what changed," real metrics (resource usage, boot time)

### r/selfhosted
- **Audience:** Overlap with homelab; stronger emphasis on self-hosted software, privacy, data sovereignty
- **Tone:** Freedom-first, no SaaS pitches, community contribution visible
- **Post format:** Text post, lead with open source angle and self-hosted benefits
- **Frequency:** At every major release
- **Best posts:** "Weaver is self-hosted, your data stays on your hardware"

### Hacker News
- **Audience:** Technical founders, senior engineers, founding members
- **Post format:** Show HN for product launches; Ask HN for discussion topics
- **Timing:** Never on Friday. Monday–Wednesday morning EST for max visibility.
- **Best posts:** Genuinely novel technical approaches — NixOS reproducibility, Firecracker sub-125ms boot, Apptainer-first container model
- **Prohibited:** Announcing minor updates as Show HN

### NixOS Discourse
- **Audience:** NixOS community — module users, contributors, power users
- **Post format:** Announcement thread with full changelog, invite community input
- **Frequency:** Every release
- **Engagement:** Respond to every reply personally. Discourse is where NixOS relationships are built.

### LinkedIn
- **Audience:** IT directors, CISOs, compliance officers, fabrick buyers
- **Tone:** Professional, compliance-focused, ROI-led
- **Post format:** Short text + image (compliance brief, fabrick feature screenshot, pricing comparison chart)
- **Frequency:** Compliance-relevant releases only (v1.2, v1.5, v2.2, v3.0)
- **Best posts:** "Weaver v3.0 HA clustering for $19,250/yr vs. OpenShift at $30K–90K+" — anchor pricing, specific numbers

### dev.to
- **Audience:** Developers with infrastructure exposure, DevOps engineers
- **Tone:** Technical blog post style — educational, code examples where relevant
- **Frequency:** At least one technical post per major release
- **Best posts:** Architecture deep-dives, "how we built X" posts

### NixCon
- **Audience:** Core NixOS community, contributors, module authors
- **Format:** Talk proposal or sponsorship (v2.x window — once Fabrick is real)
- **Target:** NixCon 2026 or 2027 as first conference presence
- **Content:** Technical presentation on Weaver's NixOS module architecture, microvm.nix integration, or Forge automation approach

### Partner Newsletters
- **Audience:** Each channel partner's client base
- **Content:** Partner-authored announcements using Weaver release kits provided by WBD
- **Timing:** Coordinated with WBD release day (same-day or within 2 business days)
- **Assets provided:** One-paragraph release summary, key feature list, updated comparison page links, compliance brief (if applicable)

---

## Pricing Change Communications

Three pricing step-up events across the roadmap. Each requires a structured communication sequence:

### Standard Process (applies to all three events)

**T-60 days (60 days before release):**
- Blog post: "Pricing is changing when vX.Y ships — here's what it means and why"
- In-product banner: "Founding Member pricing closes when vX.Y ships on [estimated date]"
- Email to all existing users: same message
- Channel partners notified: brief all 5 partners so they can close pipeline at current rates

**T-7 days:**
- Reminder email to all non-FM users
- In-product: countdown banner (if technically feasible)
- Channel partners: "7 days left — push pipeline to close this week"

**Release day:**
- New pricing active in Stripe
- Email: "vX.Y is live. New pricing in effect. Your price is unchanged."
- FM window closes (appropriate Stripe SKU deactivated)
- All pricing pages updated

**T+7 days:**
- "Pricing rationale" blog post (if not already part of release announcement) — transparent explanation of why the price moved and what new value justifies it

---

### Event 1: Weaver Solo $149 → $249 (at v1.2 GA)

**Rationale to communicate:** The Closer ships complete container management — Docker, Apptainer, GPU, firewall, hardening. At $249/yr, Weaver is still 35% below Proxmox Community (€355/yr) with significantly more features.

**60-day notice:** Communicate at v1.1 launch (simultaneously with v1.1 release announcement)
**Audience:** All Free users, all FM users (confirmation their price doesn't change)
**Key message:** "FM customers are locked at $149/yr forever. New customers from v1.2 day pay $249/yr — and it's still the best-priced professional infrastructure tool in the market."

---

### Event 2: Weaver Team + Fabrick $2,000 → $2,000 (at v2.2 GA)

**Rationale to communicate:** v2.2 ships multi-host visibility, Weaver Team peer federation, cold VM migration, Colmena fleet management. The product is now fleet software, not a single-host dashboard. Comparable to Canonical MAAS ($2,500/yr) while remaining far below OpenShift.

**60-day notice:** Communicate at v2.1 launch (simultaneously with Team FM announcement)
**Audience:** All Fabrick FM customers (confirm unchanged), prospects in Fabrick pipeline, channel partners
**Key message:** "You're buying fleet software now. The price reflects the product. FM customers are locked at $1,299/yr/node forever — they got fleet software at single-host prices, and that's permanent."

---

### Event 3: Weaver Solo $249 → $299, Fabrick $2,000 → $3,500 (at v3.0 GA)

**Rationale to communicate:** v3.0 ships HA clustering, live migration, STONITH, shared storage. Fabrick is now comparable to Rancher ($150–500/node/yr blended) and Canonical MAAS ($2,500/yr) while offering NixOS-native declarative configuration and atomic rollbacks. At $3,500/yr first node + $1,750/yr flat for additional nodes, a 10-node cluster is $19,250/yr vs. OpenShift at $30K–90K+.

**60-day notice:** Communicate at v2.6 launch
**Audience:** All existing Fabrick customers (confirm unchanged), new prospects, channel partners for pipeline urgency
**Key message:** "HA clustering changes the category. This is enterprise fleet software with a price that reflects it — and it's still a fraction of the alternatives."

---

## TA Outreach Calendar

| TA Partner | Category | Version Gate | Outreach Owner | Outreach Status | Target Agreement |
|------------|----------|-------------|----------------|-----------------|-----------------|
| 1Password | Auth / secrets | v1.0 GA | Mark | Not yet initiated | CJ Affiliate + Partnership API; execute before v1.1 ships |
| Yubico | Hardware security | v1.0 GA | Mark | Not yet initiated | Yubico partner program; execute before v1.1 ships |
| Kanidm | Identity / SSO | v2.0 | Mark | Not yet initiated | Community outreach; informal before v2.0 |
| Tailscale | Overlay networking | v1.3 | Mark | Pre-outreach warmup at v1.2 | Affiliate program + integration directory |
| NVIDIA | GPU compute | v2.0 | Mark | Not yet initiated | TA co-marketing + EULA capture |
| Hetzner | Cloud infrastructure | v2.3 | Mark | Pre-outreach at v2.2 | Referral program + co-marketing |
| DigitalOcean | Cloud infrastructure | v2.3 | Mark | Pre-outreach at v2.2 | Referral program |
| Backblaze B2 | Object storage / backup | v2.4 | Mark | Begin at v2.3 | Affiliate / referral + co-marketing |
| Anthropic | AI / BAA | v3.0 | Mark | Not yet initiated | BAA for HIPAA healthcare accounts + co-marketing |

**TA outreach principles:**
- Initiate contact one version before the integration ships (allows time for agreement, legal review)
- No commitments without legal review of partner agreement
- Formal offer = attorney review before execution
- All TA relationships are product integrations + co-marketing — not sales commissions (that is the Channel Partner program)

---

## Design Partner Pipeline

Fabrick FM customers automatically receive Design Partner status. The following are the target Fabrick Design Partner candidates for outreach (20 FM slots total — these are the highest-priority 5 to close first):

| # | Candidate Type | Target Vertical | Source | Status | Notes |
|---|---------------|----------------|--------|--------|-------|
| 1 | NixOS-native startup with 5–10 node deployment | Fintech / SaaS | Community (r/NixOS, Discourse) | Not yet identified | Sysop-as-champion path: identify from community activity |
| 2 | University HPC center (R1, active NIH/NSF grants) | Research / HPC | Partner referral (Numtide or Tweag) | Not yet identified | Fabrick Partner bundle candidate; high lifetime value |
| 3 | Healthcare IT provider (2–5 node NixOS deployment) | Healthcare | Channel partner (Nixcademy or Serokell) | Not yet identified | HIPAA alignment; Anthropic BAA pre-sell candidate |
| 4 | Defense contractor evaluating CMMC Level 2 | Defense | Community / partner referral | Not yet identified | CMMC + WireGuard + Network Isolation Mode fit |
| 5 | MSP with NixOS-heavy client base | MSP / IT Consulting | Channel partner referral | Not yet identified | Repeat buyer potential; fleet management use case |

**Design Partner program terms (from FOUNDING-MEMBER-PROGRAM.md):**
- Quarterly roadmap review call
- Direct `#design-partners` Slack channel
- Named in release notes for shaped features (opt-out available)
- RC builds 2 weeks before GA
- Architecture review session included (up to 4 hours)
- NixOS → compliance mapping session included

**Design Partner commitment:**
- 2 roadmap surveys/year (async, ~15 min)
- 1 written testimonial or case study within 12 months (private acceptable)
- 30 minutes for optional reference call/year (declinable)

---

## Channel Partner Pipeline

5 Founding Member channel partner slots. 3% locked commission. $30K/yr fee. Target: all 5 signed by end of v1.1 window.

| # | Firm | Category | Vertical Focus | Status | Notes |
|---|------|---------|---------------|--------|-------|
| 1 | Tweag | NixOS consultancy | Research / Financial / Enterprise | Target for outreach at v1.0 launch | NixCon 2025 sponsor; strong NixOS credibility; HPC and fintech client base |
| 2 | Numtide | NixOS consultancy | Enterprise / Government | Target for outreach at v1.0 launch | NixCon 2025 sponsor; government and enterprise focus |
| 3 | Serokell | NixOS/Haskell consultancy | Financial / Research | Target for outreach at v1.0 launch | Strong functional programming + NixOS practice; FS vertical |
| 4 | Nixcademy | NixOS training + consultancy | Education / General | Target for outreach at v1.0 launch | Training-first model; broad reach across NixOS community; good pipeline for Weaver Free → Weaver upsell |
| 5 | Emerging NixOS firm | NixOS DevOps | Open | Identify from NixCon 2025 sponsors or Discourse contributors | One slot reserved for a newer firm with strong growth trajectory |

**Channel partner economics:**
- $30K/yr fee, 3% locked commission on all Fabrick clients brought in
- Average deal: $8,000/yr (10-node Fabrick deployment) = $240/yr/client recurring, locked forever
- 20 Fabrick clients over 3 years: $4,800/yr commission + relationship with 20 enterprise accounts

**Announcement gate:** All 5 slots must be signed before public announcement. Announce on v1.1 release day.

**Partner kit contents (provided at signing):**
- Co-marketing kit (logos, description, feature comparison one-pager)
- All 11 vertical compliance mapping docs
- Demo access (full tier unlock, version switcher)
- "Certified Weaver Partner" badge (website)
- Partner Slack channel (direct async access)
- Pre-release briefings (RC access 2 weeks before GA)

---

*Last updated: 2026-03-27*
*Cross-references: [RELEASE-ROADMAP.md](../product/RELEASE-ROADMAP.md) · [PRICING-POWER-ANALYSIS.md](../finance/PRICING-POWER-ANALYSIS.md) · [FOUNDING-MEMBER-PROGRAM.md](../sales/FOUNDING-MEMBER-PROGRAM.md) · [TECHNOLOGY-ALLIANCES.md](../sales/TECHNOLOGY-ALLIANCES.md) · [CHANNEL-PARTNER-PITCH.md](../sales/CHANNEL-PARTNER-PITCH.md) · [FABRICK-CLOUD.md](../product/FABRICK-CLOUD.md)*

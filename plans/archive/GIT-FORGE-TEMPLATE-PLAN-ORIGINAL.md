<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Self-Hosted Git Forge Template Plan

**Purpose:** Ship a one-click self-hosted Git forge (Forgejo) as a first-class VM template, Forge infrastructure component, and product showcase.
**Created:** 2026-03-02
**Status:** ALL DECISIONS RESOLVED (2026-03-03)
**Depends On:** VM provisioning, distro catalog (`backend/src/services/distro-catalog.ts`), template system (v2.0.0)

---

## Three Roles, One Template

### Role 1: Preset VM Template (Product Feature)

A catalog entry that provisions a fully configured Forgejo instance inside a microVM. Users click "Create VM → Git Forge" and get a working self-hosted GitHub alternative in under a minute.

**What ships:**
- Forgejo (MIT-licensed Gitea fork — community-governed, no corporate capture risk)
- Pre-configured with: admin account (set via first-run), SSH passthrough, HTTPS-ready
- Cloud-init handles: hostname, SSH keys, Forgejo config, optional LDAP/OAuth stub
- Firewall profile: `git-forge` preset (HTTP 3000, SSH 2222, deny all else)

**Why Forgejo over Gitea:** Gitea Ltd monetization risk. Forgejo is the community fork under Codeberg e.V. governance — aligns with our AGPL/open-source positioning. Same codebase, no licensing surprises.

### Role 2: Forge Infrastructure (Internal)

Air-gapped and on-prem deployments can't reach GitHub.com. The self-hosted forge becomes the Git backend that Foundry runs against:

- Agent pipelines push/pull from local Forgejo instead of GitHub
- CI webhooks trigger local runners (Forgejo Actions = GitHub Actions compatible)
- Knowledge loop stays internal: template repo, institutional knowledge, feed distribution — all on-prem
- Mirror mode: Forgejo mirrors upstream GitHub repos on a schedule (internet-optional sync)

**Forge integration points:**

| Component | GitHub.com | Self-Hosted Forge |
|-----------|-----------|-------------------|
| Agent source repos | `whizbangdevelopers-org/*` | `http://forge.local:3000/org/*` |
| CI/CD runners | GitHub Actions | Forgejo Actions (compatible syntax) |
| Knowledge feed | Push to GitHub template repo | Push to local template repo |
| Issue tracking | GitHub Issues | Forgejo Issues (API-compatible) |
| PR workflow | `gh pr create` | `tea pr create` (Forgejo CLI) or API |
| Webhook triggers | GitHub webhooks | Forgejo webhooks (same payload format) |

### Role 3: Product Showcase (Marketing)

"Deploy a full GitHub alternative in 30 seconds" is a compelling demo:

- Demo site shows the Git Forge template in the catalog
- Live demo provisions it (simulated in demo mode, real in trial/premium)
- Speaks directly to the NixOS/self-hosted audience who distrust SaaS
- Shows Weaver isn't just a VM list — it's an application platform

---

## Template Specification

### VM Definition

```nix
services.weaver.templates.git-forge = {
  name = "git-forge";
  displayName = "Git Forge (Forgejo)";
  description = "Self-hosted Git repository hosting with CI/CD, issues, and pull requests";
  category = "development";
  icon = "git-branch";  # or custom Forgejo icon

  vm = {
    memory = 1024;  # MB — Forgejo is lightweight but needs room for repos
    vcpus = 2;
    diskSize = 10240;  # MB — 10GB default, expandable
  };

  network = {
    firewall.profile = "git-forge";
  };

  cloudInit = {
    packages = [ "forgejo" "git" "openssh-server" ];
    # First-run: admin creation via dashboard UI (passed as cloud-init user-data)
  };

  ports = {
    http = 3000;   # Forgejo web UI
    ssh = 2222;    # Git over SSH (avoid conflict with host SSH)
  };

  healthCheck = {
    endpoint = "http://{ip}:3000/api/v1/version";
    expect = "application/json";
    interval = 30;
  };
};
```

### Firewall Profile: `git-forge`

```nix
# profiles/git-forge.nix
{
  ingress = [
    { port = 3000; proto = "tcp"; comment = "Forgejo web UI + API"; }
    { port = 2222; proto = "tcp"; comment = "Git over SSH"; }
  ];
  egress = "allow-all";  # Needs outbound for: mirroring, webhooks, package updates
  # Enterprise: restrict egress to specific mirrors + webhook targets
}
```

### Catalog Entry

Extends the existing distro catalog pattern:

```typescript
{
  id: 'git-forge',
  name: 'Git Forge (Forgejo)',
  category: 'development',
  description: 'Self-hosted Git hosting with CI/CD, issues, and pull requests',
  icon: 'mdi-git',
  tier: 'free',           // Template available at free tier
  provisionTier: 'premium', // Auto-provisioning requires premium
  baseImage: 'nixos-minimal',
  overlay: 'forgejo',
  defaultResources: { memory: 1024, vcpus: 2, disk: 10240 },
  ports: { http: 3000, ssh: 2222 },
  tags: ['git', 'ci-cd', 'development', 'forgejo'],
  docsUrl: '/help/templates/git-forge',
}
```

---

## Tier Gating

| Capability | Free | Premium | Enterprise |
|------------|------|---------|------------|
| Template in catalog (visible, info page) | Yes | Yes | Yes |
| Manual provision (download image, configure yourself) | Yes | — | — |
| One-click provision via dashboard | No | Yes | Yes |
| Cloud-init auto-configuration | No | Yes | Yes |
| LDAP/OAuth integration (Forgejo ↔ Dashboard SSO) | No | No | Yes |
| Forgejo Actions runner (CI/CD inside microVM) | No | Yes | Yes |
| Mirror mode (sync from upstream GitHub) | No | Yes | Yes |
| Backup integration (snapshot Forgejo data) | No | No | Yes |
| Multi-instance (run multiple forges for org isolation) | No | No | Yes |

**Free tier value:** Template docs + manual setup guide. Users see what's possible, premium automates it.

---

## Forge Integration Design

### Adapter Pattern

The existing Forge pipeline assumes GitHub. To support self-hosted forge:

```
GitProvider interface
  ├── GitHubProvider (current — gh CLI, GitHub API)
  └── ForgejoProvider (new — tea CLI, Forgejo API)
```

Both implement:
- `createRepo()`, `cloneRepo()`, `pushBranch()`
- `createPR()`, `mergePR()`, `listPRs()`
- `createIssue()`, `listIssues()`, `updateIssue()`
- `triggerWorkflow()`, `getWorkflowStatus()`
- `configureWebhook()`, `listWebhooks()`

**Key compatibility:** Forgejo's API is GitHub-compatible (same REST endpoints, same webhook payloads). The adapter is thin — mostly URL rewriting + auth token swap.

### Mirror Mode Architecture

```
Internet-connected schedule (cron/timer):
  GitHub.com repos → Forgejo mirror repos (pull)

Air-gapped operation:
  All agent work against Forgejo directly
  No GitHub.com dependency

Re-sync (when internet available):
  Forgejo → GitHub.com (push mirror)
  Bidirectional conflict resolution: Forgejo wins (local work is authoritative)
```

### Foundry Configuration

```nix
# On the Foundry machine
services.forge.git = {
  provider = "forgejo";          # or "github"
  url = "http://forge.local:3000";
  org = "forge";
  token = config.sops.secrets.forgejo-token.path;
  mirror = {
    enable = true;
    upstream = "github.com/whizbangdevelopers-org";
    schedule = "hourly";
  };
};
```

---

## Showcase / Demo Integration

### Demo Site

- Git Forge appears in the template catalog with full info card
- "Deploy" button shows tier gate: "Available with Premium — try it free for 30 days"
- Demo mode shows a simulated Forgejo dashboard screenshot in the VM detail view
- Tooltip: "Full GitHub alternative running inside a microVM. Git push, pull requests, CI/CD — all self-hosted."

### Marketing Angle

**For NixOS users:** "Your code, your infrastructure. Deploy a complete GitHub alternative in one command. Declarative, reproducible, rollbackable."

**For enterprise:** "Air-gapped Git hosting with CI/CD. No SaaS dependency. Full audit trail. Runs inside your existing Weaver deployment."

**For the demo pitch:** "This isn't just a VM manager — watch us deploy a full development platform in 30 seconds."

---

## Implementation Phases

### Phase 1: Template Definition (v1.1.0)

| Task | Effort | Notes |
|------|--------|-------|
| Catalog entry for Forgejo | Small | Extends existing distro catalog pattern |
| Firewall profile `git-forge` | Small | New preset in firewall template system |
| VM detail page: template info card | Small | Show ports, description, resource defaults |
| Help page: Git Forge setup guide | Small | Manual setup for free tier |

### Phase 2: Auto-Provisioning (v2.0.0)

| Task | Effort | Notes |
|------|--------|-------|
| Cloud-init overlay for Forgejo | Medium | NixOS-based image with Forgejo pre-installed |
| First-run integration (admin creation via dashboard) | Medium | Pass credentials via cloud-init user-data |
| Health check integration | Small | Poll `/api/v1/version` endpoint |
| SSH port forwarding (host 2222 → VM 22) | Medium | NixOS module option |

### Phase 3: Forge Adapter (v2.1.0)

| Task | Effort | Notes |
|------|--------|-------|
| `GitProvider` interface extraction | Medium | Refactor current GitHub-specific code |
| `ForgejoProvider` implementation | Medium | Thin adapter — API is GitHub-compatible |
| Mirror mode (pull from GitHub, push to Forgejo) | Large | Bidirectional sync + conflict resolution |
| Foundry configuration schema | Medium | NixOS module options for Forge |

### Phase 4: Enterprise Features (v2.4.0)

| Task | Effort | Notes |
|------|--------|-------|
| SSO integration (Forgejo ↔ Dashboard OAuth) | Large | Forgejo supports OAuth2 provider |
| Forgejo Actions runner provisioning | Large | Runner VM alongside forge VM |
| Backup integration (snapshot forge data) | Medium | Depends on backup system (v2.0.0) |
| Multi-instance support | Medium | Multiple forge VMs with org isolation |

---

## Decisions (All Resolved 2026-03-03)

### Decision 1: Forge Software — DECIDED: Forgejo

Forgejo (MIT, Codeberg e.V. governance). GitHub-compatible API makes Forge adapter thin (URL rewriting + auth swap). Community governed — no corporate capture risk. Same codebase as Gitea, full ecosystem compatibility.

### Decision 2: Base Image — DECIDED: NixOS minimal + overlay

Standard NixOS microVM image with Forgejo added via Nix. One config model for everything. Factory builds it the same way as every other VM. Rollback, security updates, and reproducibility all work identically.

### Decision 3: Default Exposure — DECIDED: LAN only, tiered exposure

| Exposure | Tier | How |
|----------|------|-----|
| Bridge IP only (LAN) | Premium (default) | No config needed, secure by default |
| Reverse proxy (TLS) | Premium (opt-in) | User requests, dashboard configures nginx + cert |
| Direct host binding | Enterprise (explicit opt-in) | Audit logged, security warning acknowledged |

Insurance: nothing exposed to the internet without explicit user opt-in behind a paywall with audit trail.

### Decision 4: Template Priority — DECIDED: Git Forge first, Monitoring second

Git Forge directly supports Forge (Role 2), speaks to core NixOS/self-hosted audience, most impressive demo. Monitoring stack (Prometheus + Grafana) second.

| Version | What ships |
|---------|-----------|
| v1.1.0 | Catalog entries (info cards, docs, manual setup guide) |
| v2.0.0 | One-click auto-provisioning (Git Forge first) |
| v2.1.0 | Forge adapter (GitProvider interface) |
| v2.2.0 | Monitoring stack template |

---

## Open Questions

1. **Git LFS support**: Large file storage needs extra disk and config. Include in template or document as add-on?
2. **Forgejo Actions runners**: Separate VM or run inside the forge VM? Separate is cleaner but doubles resource use.
3. **Backup granularity**: Snapshot entire VM, or Forgejo-aware backup (dump repos + database separately)?
4. **Update strategy**: How does the user update Forgejo inside the microVM? NixOS rebuild of the VM image? Or Forgejo's built-in update mechanism?
5. **Container registry**: Forgejo includes a container registry. Do we expose this as a feature or disable it to reduce attack surface?

---

*Cross-reference: [FIREWALL-TEMPLATE-PLAN.md](v1.2.0/FIREWALL-TEMPLATE-PLAN.md) | [DISK-PROVISIONING-PLAN.md](v2.0.0/DISK-PROVISIONING-PLAN.md) | [SYSTEM-TEMPLATING-PLAN.md](v2.0.0/SYSTEM-TEMPLATING-PLAN.md) | [IMPLEMENTATION-PHASING-PLAN.md](v2.0.0/IMPLEMENTATION-PHASING-PLAN.md)*

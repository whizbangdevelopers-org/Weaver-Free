<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Draft GitHub Issues — For Review Before Creating

**Repo:** `whizbangdevelopers-org/Weaver-Dev`
**Do NOT create these until reviewed.** This file contains the exact `gh issue create` commands ready to run.

---

## Research Issues (label: `research`)

### R1: Dynamic VM Discovery Methods

```bash
gh issue create --repo whizbangdevelopers-org/Weaver-Dev \
  --title "Research: Dynamic VM discovery methods" \
  --label "research,backend,priority:high" \
  --milestone "M1: Community Foundation" \
  --body "$(cat <<'EOF'
## Question
What's the most reliable way to discover microvm.nix VMs at runtime?

## Context
VMs are currently hardcoded in `backend/src/services/microvm.ts` as `VM_DEFINITIONS`. This must be replaced with dynamic discovery to support arbitrary VM configurations.

## Research Tasks
- [ ] Test `systemctl list-units 'microvm@*'` output format across NixOS versions
- [ ] Check if `/etc/microvm/` or `/var/lib/microvms/` exists with VM metadata
- [ ] Investigate whether microvm.nix exposes VM config via a JSON file or Nix eval
- [ ] Test with 0, 1, 5, 20+ VMs to verify performance
- [ ] Document how VM config (IP, memory, hypervisor) can be extracted at runtime

## Deliverable
Findings doc in `docs/research/` with recommended approach and edge cases.

## Blocks
- #1 (Dynamic VM discovery implementation)
EOF
)"
```

---

### R2: Per-VM Metrics Collection

```bash
gh issue create --repo whizbangdevelopers-org/Weaver-Dev \
  --title "Research: Per-VM metrics collection methods" \
  --label "research,backend,priority:high" \
  --milestone "M1: Community Foundation" \
  --body "$(cat <<'EOF'
## Question
What metrics are available for microvm.nix VMs and how do we collect them?

## Context
Dashboard shows only running/stopped status. Need CPU, memory, network metrics per VM. Collection method likely differs between QEMU, Firecracker, and Cloud Hypervisor.

## Research Tasks
- [ ] Check if cgroup v2 stats are available under `/sys/fs/cgroup/machine.slice/microvm@*`
- [ ] Test `machinectl show` output for relevant metrics
- [ ] Investigate QEMU monitor socket for guest-level metrics
- [ ] Check Firecracker metrics endpoint (different from QEMU)
- [ ] Measure overhead of metric collection at 2s intervals with 20+ VMs
- [ ] Evaluate whether `systemd-cgtop` output is parseable

## Deliverable
Findings doc with metric sources per hypervisor type and performance measurements.

## Blocks
- #2 (CPU/memory metrics implementation)
EOF
)"
```

---

### R3: VM Console Access Mechanisms

```bash
gh issue create --repo whizbangdevelopers-org/Weaver-Dev \
  --title "Research: VM console access mechanisms" \
  --label "research,backend,frontend,priority:medium" \
  --milestone "M3: Pro Features" \
  --body "$(cat <<'EOF'
## Question
How can we provide browser-based console access to microvm.nix VMs?

## Context
Nearly every competitor (Proxmox, Cockpit, XCP-ng) provides browser-based VM console via noVNC or SPICE. This is a Pro tier feature. The mechanism differs per hypervisor.

## Research Tasks
- [ ] Determine if QEMU VMs expose VNC socket and where it's located
- [ ] Determine if QEMU VMs expose serial console and how to attach
- [ ] Check Firecracker console access (different mechanism)
- [ ] Check Cloud Hypervisor console access
- [ ] Evaluate noVNC vs xterm.js for the frontend
- [ ] Test WebSocket proxying latency and bandwidth requirements
- [ ] Document required NixOS/sudo permissions

## Deliverable
Findings doc with recommended approach per hypervisor and security implications.

## Blocks
- #12 (VM console implementation)
EOF
)"
```

---

### R4: Nix Expression Parsing & Generation

```bash
gh issue create --repo whizbangdevelopers-org/Weaver-Dev \
  --title "Research: Nix expression generation from TypeScript" \
  --label "research,backend,frontend,priority:high" \
  --milestone "M2: Template Editor" \
  --body "$(cat <<'EOF'
## Question
How do we reliably generate valid Nix expressions from TypeScript?

## Context
The template editor (M2) needs to generate Nix code from structured form data. The generated code must be syntactically valid and produce working microvm.nix definitions.

## Research Tasks
- [ ] Evaluate template string approach vs AST-based generation
- [ ] Test `nix-instantiate --parse` for validation (is it fast enough for live preview?)
- [ ] Check if `nix eval` can validate expressions without building
- [ ] Investigate existing TypeScript Nix parsers/generators (if any)
- [ ] Determine the full set of microvm.nix options that need to be supported
- [ ] Test generated Nix against `nixos-rebuild dry-activate`
- [ ] Document microvm.nix option types and constraints

## Deliverable
Findings doc with generator approach, validation strategy, and microvm.nix option coverage map.

## Blocks
- #7 (Building blocks form + Nix generator)
EOF
)"
```

---

### R5: n8n Webhook Integration

```bash
gh issue create --repo whizbangdevelopers-org/Weaver-Dev \
  --title "Research: n8n webhook API contract for deployment pipeline" \
  --label "research,backend,priority:medium" \
  --milestone "M3: Pro Features" \
  --body "$(cat <<'EOF'
## Question
What's the exact n8n API contract for the deployment pipeline?

## Context
The n8n deployment pipeline (Appendix C of competitive analysis) needs the dashboard to POST to an n8n webhook and poll for execution status. Need to verify the exact API behavior.

## Research Tasks
- [ ] Test n8n webhook node response format and timing
- [ ] Determine how to poll n8n execution status (REST API? Execution ID?)
- [ ] Test n8n "Wait" node for approval gates — how does the callback work?
- [ ] Measure latency: dashboard POST → n8n execution → rebuild complete → callback
- [ ] Test error handling: what does n8n return when a workflow step fails?
- [ ] Create a minimal proof-of-concept workflow (webhook → shell command → respond)
- [ ] Document n8n API authentication requirements

## Deliverable
Findings doc with API contract, sample workflow JSON, and timing measurements.

## Blocks
- #10 (n8n deployment pipeline integration)
EOF
)"
```

---

### R6: Multi-Host Communication

```bash
gh issue create --repo whizbangdevelopers-org/Weaver-Dev \
  --title "Research: Multi-host communication architecture" \
  --label "research,architecture,priority:medium" \
  --milestone "M4: SaaS & Scale" \
  --body "$(cat <<'EOF'
## Question
How should the dashboard communicate with remote NixOS hosts?

## Context
Multi-host management is a key gap vs Proxmox/Incus. Need to determine whether to use an agent-based approach (outbound WS from host) or SSH-based approach (dashboard connects to host), and how deployment tools like Colmena/deploy-rs fit in.

## Research Tasks
- [ ] Evaluate agent-based (outbound WS from host) vs SSH-based (dashboard connects to host)
- [ ] Test Colmena's API/CLI for remote NixOS deployment
- [ ] Test deploy-rs as an alternative
- [ ] Investigate NixOS's built-in `nixos-rebuild --target-host` for remote rebuilds
- [ ] Evaluate WireGuard tunnel vs SSH tunnel for agent communication
- [ ] Assess security model: key exchange, authentication, authorization
- [ ] Study Grafana Agent, Portainer Edge Agent, Netdata Agent patterns

## Deliverable
Findings doc with recommended architecture, security model, and proof-of-concept.

## Blocks
- #15 (Agent protocol)
- #16 (Multi-host management)
EOF
)"
```

---

### R7: CodeMirror Nix Language Support

```bash
gh issue create --repo whizbangdevelopers-org/Weaver-Dev \
  --title "Research: CodeMirror 6 Nix language support" \
  --label "research,frontend,priority:medium" \
  --milestone "M2: Template Editor" \
  --body "$(cat <<'EOF'
## Question
What's the current state of Nix syntax highlighting in CodeMirror 6?

## Context
The template editor split-view needs a code editor with Nix syntax highlighting. CodeMirror 6 is the preferred choice (lighter than Monaco, better Vue integration).

## Research Tasks
- [ ] Check if `@codemirror/lang-nix` or community Nix grammar exists
- [ ] If not, evaluate effort to write a Lezer grammar for Nix
- [ ] Evaluate alternative: Monaco Editor with Nix support
- [ ] Test performance of live syntax highlighting during typing (re-highlight on every keystroke?)
- [ ] Check if Nix LSP (nil, nixd) can provide completions via WASM or API
- [ ] Test CodeMirror 6 integration with Vue 3 (existing wrappers?)

## Deliverable
Findings doc with recommended editor, setup steps, and any custom grammar work needed.

## Blocks
- #8 (Code editor with Nix syntax highlighting)
EOF
)"
```

---

### R8: Dockerfile-to-Nix Translation

```bash
gh issue create --repo whizbangdevelopers-org/Weaver-Dev \
  --title "Research: Dockerfile to Nix VM translation accuracy" \
  --label "research,backend,priority:low" \
  --milestone "M4: SaaS & Scale" \
  --body "$(cat <<'EOF'
## Question
How accurately can we translate Dockerfiles to Nix VM definitions?

## Context
Template-from-source (Appendix B of competitive analysis) includes Dockerfile import. Need to understand the translation accuracy and edge cases before building it.

## Research Tasks
- [ ] Map common Dockerfile instructions to Nix equivalents:
  - FROM → packages/runtime
  - EXPOSE → firewall ports
  - ENV → environment variables
  - RUN → build steps (often not directly translatable)
  - CMD/ENTRYPOINT → systemd service
  - WORKDIR → working directory
  - COPY/ADD → virtiofs share or derivation
- [ ] Catalog the 20 most common Docker base images and their Nix package equivalents
- [ ] Test with real-world Dockerfiles: Node.js app, Python Flask, Go binary, PostgreSQL, nginx
- [ ] Identify untranslatable patterns and how to handle them (warn user, add TODO comments)
- [ ] Investigate `dockerfile2nix` or similar existing tools
- [ ] Test multi-stage Dockerfiles (common in production)

## Deliverable
Findings doc with translation map, coverage estimate (% of Dockerfiles translatable), and sample outputs.

## Blocks
- #18 (Template-from-source implementation)
EOF
)"
```

---

### R9: SaaS Agent Security Model

```bash
gh issue create --repo whizbangdevelopers-org/Weaver-Dev \
  --title "Research: SaaS agent security model and threat analysis" \
  --label "research,security,architecture,priority:medium" \
  --milestone "M4: SaaS & Scale" \
  --body "$(cat <<'EOF'
## Question
How do we securely connect a user's NixOS host to a hosted SaaS instance?

## Context
The hosted SaaS tier requires a lightweight agent on the user's NixOS host that communicates with the cloud dashboard. This is the most security-critical component — a compromised cloud must not be able to harm user hosts.

## Research Tasks
- [ ] Evaluate WireGuard tunnel (host → cloud) with API key authentication
- [ ] Evaluate WebSocket with mutual TLS
- [ ] Study how these tools handle it:
  - Grafana Agent (metrics push)
  - Portainer Edge Agent (bidirectional commands)
  - Netdata Agent (metrics + commands)
  - Tailscale (mesh networking)
- [ ] Define threat model:
  - What if the cloud is compromised?
  - What if the API key is leaked?
  - What if a MITM intercepts the tunnel?
- [ ] Design permission model: what can the cloud ask the agent to do?
- [ ] Evaluate NixOS-native secrets management (sops-nix, agenix) for API key storage
- [ ] Define minimum viable agent permissions (principle of least privilege)

## Deliverable
Security design doc with threat model, protocol specification, and NixOS module design.

## Blocks
- #15 (Agent protocol)
EOF
)"
```

---

### R10: Community Template Distribution

```bash
gh issue create --repo whizbangdevelopers-org/Weaver-Dev \
  --title "Research: Community template distribution model" \
  --label "research,community,priority:low" \
  --milestone "M1: Community Foundation" \
  --body "$(cat <<'EOF'
## Question
What's the best mechanism for sharing and discovering VM templates?

## Context
Proxmox has ~100+ turnkey templates, Docker has Docker Hub. We need a community-driven template ecosystem that fits the Nix model.

## Research Tasks
- [ ] Evaluate GitHub repo with PR-based contributions (like awesome-nix)
- [ ] Evaluate FlakeHub for template distribution as flake outputs
- [ ] Evaluate NUR integration (already used for the dashboard package itself)
- [ ] Design template metadata format for discoverability (tags, categories, ratings, compatibility)
- [ ] Research how Proxmox turnkey templates and Docker Hub handle:
  - Discovery/search
  - Trust/verification
  - Versioning
  - Deprecation
- [ ] Evaluate in-dashboard registry vs external registry
- [ ] Consider template testing: can we CI-test templates with nixos-test?

## Deliverable
Findings doc with recommended distribution model and template registry design.

## Blocks
- #5 (Built-in template browser)
EOF
)"
```

---

### R11: LLM Nix Generation Quality

```bash
gh issue create --repo whizbangdevelopers-org/Weaver-Dev \
  --title "Research: LLM Nix generation accuracy and cost" \
  --label "research,ai,priority:low" \
  --milestone "M4: SaaS & Scale" \
  --body "$(cat <<'EOF'
## Question
How well can current LLMs generate valid microvm.nix expressions from natural language?

## Context
AI-assisted VM creation (Appendix D of competitive analysis) proposes LLM-powered Nix generation. Need to verify accuracy before building the feature.

## Research Tasks
- [ ] Create 20 test prompts ranging from simple to complex:
  - "A minimal VM with SSH" (simple)
  - "A Node.js app server with 2GB RAM on port 3000" (medium)
  - "PostgreSQL 16 with 2GB RAM, daily backups, only accessible from 10.10.0.0/24" (complex)
- [ ] Test with Claude Sonnet, Claude Haiku, GPT-4o, and an open model (Llama/Mistral)
- [ ] Measure per model:
  - % syntactically valid Nix
  - % that pass `nix-instantiate --parse`
  - % that build successfully with `nixos-rebuild dry-activate`
- [ ] Design system prompt with microvm.nix schema, examples, and constraints
- [ ] Test few-shot prompting vs zero-shot
- [ ] Estimate API costs per generation at various model tiers
- [ ] Evaluate local models via Ollama for self-hosted Pro tier
- [ ] Test safety: can adversarial prompts generate harmful Nix? (e.g., `rm -rf` in activation scripts)

## Deliverable
Findings doc with prompt engineering recommendations, accuracy benchmarks, cost estimates, and safety analysis.

## Blocks
- #17 (AI-assisted VM creation)
EOF
)"
```

---

## Implementation Issues (for reference — create after research is done)

These are listed here for completeness but should be created as research issues are completed and approaches are confirmed.

| # | Title | Milestone | Labels | Depends On |
|---|---|---|---|---|
| 1 | Dynamic VM discovery from systemd | M1 | `feature,backend` | R1 |
| 2 | CPU/memory metrics per VM | M1 | `feature,backend,frontend` | R2 |
| 3 | Logs viewer (journalctl integration) | M1 | `feature,backend,frontend` | #1 |
| 4 | Network topology visualization | M1 | `feature,backend,frontend` | #1 |
| 5 | Built-in template browser (5 templates) | M1 | `feature,frontend` | R10 |
| 6 | Polish: OpenAPI docs, loading states, empty states | M1 | `chore,dx` | None |
| 7 | Building blocks form + Nix code generator | M2 | `feature,frontend,backend` | R4, #5 |
| 8 | Code editor with Nix syntax highlighting | M2 | `feature,frontend` | R7 |
| 9 | Template loading into builder editor | M2 | `feature,frontend` | #5, #7 |
| 10 | n8n deployment pipeline integration | M3 | `feature,backend,pro` | R5 |
| 11 | Multi-user authentication (JWT + OIDC) | M3 | `feature,backend,frontend,pro` | None |
| 12 | VM console (noVNC/xterm.js) | M3 | `feature,backend,frontend,pro` | R3 |
| 13 | Audit log | M3 | `feature,backend,frontend,pro` | #11 |
| 14 | Feature flags architecture | M3 | `chore,architecture` | None |
| 15 | Agent protocol + NixOS module | M4 | `feature,backend,saas` | R6, R9 |
| 16 | Multi-host VM management | M4 | `feature,backend,frontend,pro` | #15 |
| 17 | AI-assisted VM creation | M4 | `feature,backend,frontend,pro` | R11, #7 |
| 18 | Template-from-source (Docker/Git/VM) | M4 | `feature,backend,frontend,pro` | R8, #7 |

---

## How to Create These Issues

After review, run the research issue commands above. For milestones, first create them:

```bash
gh api repos/whizbangdevelopers-org/Weaver-Dev/milestones \
  --method POST -f title="M1: Community Foundation" -f description="Free tier essentials: dynamic discovery, metrics, logs, templates"

gh api repos/whizbangdevelopers-org/Weaver-Dev/milestones \
  --method POST -f title="M2: Template Editor" -f description="Unique differentiator: Nix code generation, building blocks, editor"

gh api repos/whizbangdevelopers-org/Weaver-Dev/milestones \
  --method POST -f title="M3: Pro Features" -f description="First paying customers: n8n pipeline, auth, console, audit"

gh api repos/whizbangdevelopers-org/Weaver-Dev/milestones \
  --method POST -f title="M4: SaaS & Scale" -f description="Hosted offering: agent, multi-host, AI, source import"
```

For labels, create them first:

```bash
gh label create research --repo whizbangdevelopers-org/Weaver-Dev --color 0E8A16 --description "Investigation spike — produces findings doc, not code"
gh label create priority:high --repo whizbangdevelopers-org/Weaver-Dev --color B60205
gh label create priority:medium --repo whizbangdevelopers-org/Weaver-Dev --color FBCA04
gh label create priority:low --repo whizbangdevelopers-org/Weaver-Dev --color 0075CA
gh label create pro --repo whizbangdevelopers-org/Weaver-Dev --color 5319E7 --description "Premium tier feature"
gh label create saas --repo whizbangdevelopers-org/Weaver-Dev --color 1D76DB --description "SaaS/hosted tier feature"
gh label create architecture --repo whizbangdevelopers-org/Weaver-Dev --color D4C5F9 --description "Architectural decision"
gh label create community --repo whizbangdevelopers-org/Weaver-Dev --color 7057FF --description "Community ecosystem"
gh label create ai --repo whizbangdevelopers-org/Weaver-Dev --color F9D0C4 --description "AI/LLM feature"
gh label create security --repo whizbangdevelopers-org/Weaver-Dev --color B60205 --description "Security-related"
gh label create dx --repo whizbangdevelopers-org/Weaver-Dev --color BFDADC --description "Developer experience"
```

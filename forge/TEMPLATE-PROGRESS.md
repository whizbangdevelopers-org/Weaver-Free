<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Proprietary and confidential. Do not distribute. -->
# Forge: Template Sync Log

Tracks template sync runs for this project. See the canonical template progress tracker at `quasar-project-template/forge/TEMPLATE-PROGRESS.md`.

---

## Run Log

### 2026-03-28 — template-sync agent

**Substitution map used:**
- `Weaver` / `weaver` → `{{PRODUCT_NAME}}` / `{{PRODUCT_SLUG}}`
- `whizbangdevelopers-org` → `{{GITHUB_ORG}}`
- `Weaver-Dev` / `Container-Loom-Dev` → `{{PROJECT_SLUG}}-Dev`
- `weaver-demo.github.io` → `{{DEMO_SITE}}`
- `dashboard` (MCP key) → `{{PROJECT_NAME}}`
- `/home/mark/Projects/active/weaver-project/code` → `{{PROJECT_ROOT}}/code`

**Phase 1 — Structural scan complete.**

Areas scanned: root rules, root hooks, root agents, code rules, code hooks, code agents, forge files, workflow docs, setup docs, dev docs, memory scaffold, root code docs, .mcp.json.

**Phase 2 — MISSING items (template → project): NONE**

All infrastructure files present in template also exist in project. No files to apply.

**Phase 3 — EXTRACT? items (project → template): 2 applied, 2 skipped**

| File | Action | Reason |
|------|--------|--------|
| `code/docs/workflows/WORKFLOW-PATTERNS.md` | APPLIED | Generic GitHub Actions patterns; 3 project strings substituted |
| `code/docs/workflows/GITHUB-FEATURES-CHECKLIST.md` | APPLIED | Generic GitHub feature checklist; project-specific topics/tags removed |
| `code/docs/workflows/CLAUDEMD-GENERATOR-PROMPT.md` | SKIP | References project-specific files (microvm.ts, vm.ts, sync-to-free.yml) |
| `code/.claude/rules/provisioning.md` | SKIP | Weaver-specific provisioning paths (QEMU, Firecracker, flake distros) |

**Phase 4 — STALE? items (human review required): see below**

**Phase 5 — forge/TEMPLATE-PROGRESS.md: created (this file)**

---

## Stale Items Requiring Human Review

### Root `.claude/rules/`

| File | Nature of difference |
|------|---------------------|
| `notes.md` | Project has "Mark, Yuri" as authors; template has generic "developers". Project version is more specific — template may want the generic version. Minor. |
| `terminology.md` | Project example uses "VM templates are planned for v2.0.0"; template uses "Feature X is planned for v2.0.0". Both are correct. Minor. |
| `versioning.md` | Project has a cleaner version: no duplicate `## When Creating New Version Content` section. Template has the duplicate. **Template should be updated to match project.** |

### Root `.claude/hooks/`

| File | Nature of difference |
|------|---------------------|
| `e2e-capture-lessons.sh` | Project has `code/testing/e2e-docker/` path (code lives in `code/` subdirectory). Template uses `testing/e2e-docker/`. Template is the scaffold default; difference is intentional per-project path convention. |
| `e2e-inject-lessons.sh` | Project uses MCP tool calls (`getKnownGotchas`, `getE2eFailurePatterns`, `getE2eConventions`) instead of file injection. This is an improvement — template should adopt MCP tool approach. |
| `e2e-review-specs.sh` | Project has explicit file→spec mappings for all pages/components; template has generic auto-mapping. Both valid — project version is more mature. Also has `code/` prefix handling. |
| `require-e2e-docs.sh` | Project handles `code/` prefix in file paths. Minor structural difference. |

### `code/.claude/rules/`

| File | Nature of difference |
|------|---------------------|
| `backend.md` | Project-specific: references `setRegistry()`, provisioning 202/WebSocket, `src/pages/HelpPage.vue` update requirement. Template is more generic with storage adapter pattern and `*_FILE` env var pattern (which is an improvement over project). |
| `frontend.md` | Project: specific file paths (`src/services/ws.ts`, `src/utils/error.ts`), HelpPage update. Template: more generic but includes "never per-composable" WebSocket rule (improvement). |
| `nixos.md` | Project: `br-microvm` bridge, `SUDO_PATH`/`SYSTEMCTL_PATH` env vars, `nix-rebuild-local.sh`. Template: adds "don't modify project repo to solve host-level config issues" rule (improvement). |
| `security.md` | Project: Weaver-specific (VM name regex, full sudo paths, CSP helmet config, specific lockout parameters). Template: more generic but lacks the concrete details. |
| `testing.md` | Project: `§ Debugging Insights` section reference. Template: omits the section qualifier. Minor. |

### `code/.claude/hooks/`

| File | Nature of difference |
|------|---------------------|
| `block-dangerous.sh` | Project adds carve-outs for `/var/lib/weaver/` and `/var/lib/microvms/` to the `rm -rf` block; project has inline logic vs template using external hook script references. Template version uses external scripts (cleaner pattern). |
| `precompact-context.sh` | Project has Weaver-specific context (port layout, provisioning paths, bridge config, backend env vars). Template has generic placeholders. Template version is the correct scaffold. |
| `e2e-capture-lessons.sh` | Project uses `→` arrows; template uses `->`. Also `code/` prefix in path. Minor. |
| `e2e-inject-lessons.sh` | Significant: project uses MCP tool calls; template does awk/file injection. MCP approach is an architectural improvement the template should adopt. |
| `e2e-review-specs.sh` | Project has full explicit mapping table (40+ entries) vs template's auto-derive pattern. Project also handles `code/` prefix. Template's auto-derive is the correct generic scaffold. Navigation route in project: `/#/weaver`; template: `/#/dashboard`. |
| `require-e2e-docs.sh` | Project handles `code/` prefix in paths. |

### Root `.claude/agents/`

| File | Nature of difference |
|------|---------------------|
| `capture.md` | Project has hardcoded memory path `/home/mark/.claude/projects/-home-mark-Projects-active-weaver-project/memory/`. Template uses generic description. Template version is correct. |
| `forge-sync.md` | Project has stale repo name (`Container-Loom-Dev`) in schema example; template uses `{{PROJECT_SLUG}}`. Template version is correct. |
| `plan-reviewer.md` | Project has explicit business subdirectory file list (Weaver-specific). Template has generic descriptions. Template is correct scaffold. |
| `release-prep.md` | Project references `nixos/package.nix` and NixOS-specific gates; template has generic checklist. Project-specific additions are intentional. |

### `code/.claude/agents/`

All 8 agent files differ. All differences follow the same pattern: project has project-specific content (product name, port numbers, specific file paths, seed VM names) replacing `{{PRODUCT_NAME}}` and generic descriptions in the template. These are all intentional instantiation differences. The template versions are correct as scaffolds.

| File | Key difference |
|------|---------------|
| `e2e-runner.md` | Project: `Weaver`, ports 9020/3120. Template: `{{PRODUCT_NAME}}`, generic ports. |
| `e2e-test-writer.md` | Project: specific file paths, VM seed names, API URL constant. Template: generic. |
| `gtm-content.md` | Project: Weaver-specific paths, Reddit/forum channels, blog post titles. Template: generic scaffolding. |
| `gtm-demo.md` | Project: 8-VM demo set, GitHub Pages, DemoBanner.vue. Template: generic demo instructions. |
| `screenshot-capture.md` | Project: 11 specific screenshot names, hardcoded project path. Template: generic. |
| `security-reviewer.md` | Project: execFileAsync rule, VM name validation, CSP details. Template: generic. |
| `test-runner.md` | Project: `Weaver`. Template: `{{PRODUCT_NAME}}`. |
| `tui-tester.md` | Project: specific test file names (api.spec.ts, demo-mock.spec.ts, etc.). Template: generic discovery pattern. |

### `code/docs/setup/`

| File | Nature of difference |
|------|---------------------|
| `DISASTER-RECOVERY.md` | Project has specific repo URLs (`whizbangdevelopers-org/Container-Loom-Dev`), hCaptcha credentials, NixOS backup item. Template uses `{{GITHUB_ORG}}/{{PROJECT_NAME}}` placeholders (correct). |
| `MCP-TOOLING-SETUP.md` | Project has "Weaver project" in description and references GitHub MCP (which was removed). Template has generic description and `{{PROJECT_NAME}}` MCP server section. Template version is more current. |
| `WORKSPACE-TRANSFER.md` | Project has `Container-Loom-Dev` repo name; template uses `{{GITHUB_ORG}}/{{PROJECT_SLUG}}-Dev`. Template version is correct. |

### `code/docs/development/`

| File | Nature of difference |
|------|---------------------|
| `KNOWN-GOTCHAS.md` | Project has 3 additional generic gotchas (q-badge double render, fastify plugin scope isolation, rate-limit per-route override) that should be upstreamed to template. Also has project-specific port numbers and file paths in some entries. Mixed content. |
| `LESSONS-LEARNED.md` | Project is significantly evolved with Weaver-specific content (phase history, NixOS deployment, specific scripts). Template has generic scaffold. These are intentionally diverged — project content should not replace template. |

### `code/docs/workflows/`

| File | Nature of difference |
|------|---------------------|
| `APPROVED-EXCEPTIONS.md` | Project has specific `any` exceptions (api.ts, ws.ts, mock-vm.ts). Template has blank table. Differences are intentional (project-specific exceptions). |
| `DEPENDENCY-MANAGEMENT.md` | Project references issue #39 and `label:ready-to-merge`. Template uses generic descriptions. Template version is more portable. |
| `GITHUB-ACTIONS-PERMISSIONS.md` | Project: `sync-to-free.yml`/`FREE_REPO_TOKEN`; template: `sync-to-public.yml`/`PUBLIC_REPO_TOKEN`. Template version uses more generic naming. |
| `RELEASE-WORKFLOW.md` | Project has detailed mermaid diagram and Weaver-specific pipeline. Template is a checklist scaffold. Both serve their purpose for their context. |
| `REPO-INFRASTRUCTURE.md` | Project has three-repo model with Weaver-specific URLs. Template is a generic checklist. Template version is correct scaffold. |

### `forge/` Files

| File | Nature of difference |
|------|---------------------|
| `PROJECT-ASSESSMENT.md` | Different project assessments — intentionally different per project. |
| `DELIVERY.json` | Different product/versions — intentionally different. |
| `STATUS.json` | Different project queue — intentionally different. |

### `.claude/settings.json` (root)

Project has `Bash(cat:*)` permission and `/home/mark/Projects/active/Forge` additionalDirectory vs template. Also project uses inline hook logic vs template using external script references in PreToolUse. The settings.json divergence is intentional — project has its specific hook wiring.

### `code/.claude/settings.json`

Project has several `allow` permissions (`git add`, `git commit`, `npx vue-tsc`, etc.) and an old `additionalDirectories` entry pointing to a stale path. Template has no permissions set. The project's extra allow-list entries are intentional but the `additionalDirectories` path is stale.

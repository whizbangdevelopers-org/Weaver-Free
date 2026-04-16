<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# CLAUDE.md Generator Prompt

This document contains the prompt template used to generate and update the `CLAUDE.md` file for the Weaver project. This file is excluded from the Free (public) repo sync.

## Purpose

`CLAUDE.md` provides context to Claude Code (claude.ai/code) about the repository structure, conventions, and common operations. Keeping it accurate and up to date ensures Claude Code can assist effectively.

## When to Update

Update `CLAUDE.md` when:

- New API endpoints are added or removed.
- The directory structure changes significantly.
- New commands are added to `package.json`.
- New path aliases are configured in `tsconfig.json`.
- Repository aliases or URLs change.
- The sync workflow exclusion list changes.
- The release process changes.

## Generator Prompt

Use the following prompt with Claude Code to regenerate `CLAUDE.md`:

---

```
Read the following files to understand the current project state:

1. package.json (root and backend)
2. tsconfig.json
3. src/router/routes.ts
4. backend/src/routes/ (all route files)
5. backend/src/services/microvm.ts
6. src/types/vm.ts
7. src/stores/ (all store files)
8. src/composables/ (all composable files)
9. .github/workflows/ (all workflow files)
10. nixos/default.nix

Then generate a CLAUDE.md file for this repository with these sections:

## Required Sections

1. **Repository Aliases** - Table mapping dev/free/demo aliases to repo names and visibility
2. **Canonical Identifiers** - Table of org, repo, URLs, package name, NixOS service name
3. **Dev to Free Sync Workflow** - Summary of sync process and exclusion list
4. **Release Checklist** - Numbered steps for creating a release
5. **Key Commands** - All npm scripts organized by category (dev, build, test, quality)
6. **Path Aliases** - Table from tsconfig.json
7. **Project Structure** - Directory tree with descriptions of key files
8. **API Endpoints** - Table of all REST and WebSocket endpoints
9. **VM Definitions** - Table of sample VMs (name, IP, memory, vCPU)
10. **WebSocket Protocol** - Message format documentation
11. **Co-Authored-By Policy** - State that Co-Authored-By should NOT be added
12. **Default Assignee** - Assign issues/PRs to repo owner
13. **Document Reading Policy** - Always read actual files, do not assume from memory
14. **Language and Runtime** - Node.js version, TypeScript, build system
15. **Git Hooks** - Setup command and what each hook does

## Style Guidelines

- Use markdown tables for structured data
- Use code blocks for commands
- Use dashes (--) instead of em-dashes
- Keep descriptions concise
- Do not include emojis
- List actual file names, not placeholders
```

---

## Verification Checklist

After regenerating `CLAUDE.md`, verify:

- [ ] All API endpoints match `backend/src/routes/`
- [ ] All npm scripts match `package.json`
- [ ] Path aliases match `tsconfig.json`
- [ ] VM definitions match `backend/src/services/microvm.ts`
- [ ] WebSocket message format matches `backend/src/routes/ws.ts`
- [ ] Excluded-from-sync list matches `sync-to-free.yml`
- [ ] Directory structure reflects current project layout
- [ ] No placeholder text (e.g., `{{PRODUCT_NAME}}`) remains

## Diff Review

After generating, review the diff carefully:

```bash
git diff CLAUDE.md
```

Common issues to watch for:
- Accidental removal of the Co-Authored-By policy
- Changed path aliases that do not match tsconfig
- Missing new commands or endpoints
- Incorrect sync exclusion list

## Manual Sections

These sections should be written manually (not auto-generated):

- **Co-Authored-By Policy** -- Reflects team conventions, not code structure
- **Default Assignee** -- Team decision
- **Document Reading Policy** -- Behavioral instruction for Claude Code

## Update Frequency

- **After every significant PR merge** -- If the PR adds endpoints, stores, composables, or changes structure
- **Before every release** -- Ensure CLAUDE.md is accurate for the release snapshot
- **Quarterly review** -- Full regeneration and comparison with actual project state

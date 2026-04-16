<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Release Process

Complete guide for creating and publishing Weaver releases.

## Pre-Release Checklist

Before starting a release, verify all of the following:

- [ ] All features for this release are merged to `main`
- [ ] All CI checks are passing on `main`
- [ ] No critical or high security vulnerabilities (`npm run test:security`)
- [ ] Red team security audit reviewed — no unresolved Critical/High with FIX disposition ([SECURITY-AUDIT.md](../../../business/legal/SECURITY-AUDIT.md))
- [ ] Unit tests pass locally (`npm run test:unit:run`)
- [ ] Build succeeds (`npm run build:all`)
- [ ] TypeScript compiles cleanly (`npm run typecheck`)
- [ ] Documentation is up to date for any new features
- [ ] CHANGELOG.md has been updated with release notes

## Version Bumping

Weaver follows [Semantic Versioning](https://semver.org/):

| Change Type | Version Bump | When to Use |
| ----------- | ------------ | ----------- |
| Bug fixes, patches | Patch (0.1.0 -> 0.1.1) | Non-breaking bug fixes |
| New features | Minor (0.1.0 -> 0.2.0) | Backward-compatible new functionality |
| Breaking changes | Major (0.x -> 1.0.0) | API changes, removed features |

### Bump Version

Update the version in all three workspace package files:

```bash
# Option 1: npm version (updates package.json and creates git tag)
npm version patch   # or minor, or major

# Option 2: Manual update — bump all three
# Edit package.json: "version": "0.2.0"
# Edit backend/package.json: "version": "0.2.0"
# Edit tui/package.json: "version": "0.2.0"
```

All three `package.json` files (root / `backend/` / `tui/`) must have matching versions. With npm workspaces, the root `package-lock.json` is the single source of truth for the dependency tree — there are no sub-package lockfiles. Also update `version` in `nixos/package.nix`.

## Update Changelog

Move items from `[Unreleased]` to a new version section in `CHANGELOG.md`:

```markdown
## [0.2.0] - 2026-02-15

### Added
- VM memory usage chart on detail page
- Bulk start/stop actions on dashboard

### Changed
- Improved WebSocket reconnection logic

### Fixed
- Status badge not updating on Firefox
```

## Tag and Push Flow

### Step-by-Step

```bash
# 1. Ensure main is up to date
git checkout main
git pull origin main

# 2. Run the full test suite
npm run test:prepush

# 3. Build all targets
npm run build:all

# 4. Commit changelog and version updates
git add package.json backend/package.json CHANGELOG.md
git commit -m "chore: bump version to 0.2.0"

# 5. Create annotated tag
git tag -a v0.2.0 -m "Release v0.2.0"

# 6. Push commit and tag
git push origin main
git push origin v0.2.0
```

### Important Notes

- Always use annotated tags (`-a`) rather than lightweight tags.
- Tag format is `v<major>.<minor>.<patch>` (e.g., `v0.2.0`).
- Push the tag separately after the commit to ensure proper ordering.

## GitHub Actions Automation

Pushing a version tag triggers the following automated workflows:

### release.yml

Single workflow with sequential jobs (all triggered by `v*` tag push):

1. **Build Release Artifacts** — installs frontend, backend, and TUI dependencies in `code/` working directory. Runs `npm run build:all` (PWA + backend + TUI). Packages `dist/pwa/` tarball, generates SBOMs for frontend and backend. Uploads 4 artifacts: pwa-build, pwa-tarball, backend-build, sbom.
2. **Create Draft Release** — downloads artifacts, attests build provenance (soft-fails on private repos), creates a **draft prerelease** (for RC/beta/alpha tags) or **draft release** on the Dev repo with auto-generated notes. Attaches tarball + SBOMs.
3. **Publish Release** — requires manual approval via the `release-publish` GitHub environment. Flips the draft to published.
4. **Release to Free Repo** — rsyncs code to the public Free repo (excluding `.claude/`, `testing/`, `CLAUDE.md`, etc. per `.github/sync-exclude.yml`). Creates matching tag and release on the Free repo. Copies release assets.
5. **Update NUR Packages** — dispatches a `repository-dispatch` event to the NUR repo with the new version and source hash (computed from the Free repo tarball). **Skipped for RC/beta/alpha tags.**

### Workflow Sequence

```
Tag Push (v1.0.0)
    │
    ├─ Build Release Artifacts (Node 22, code/ working-directory)
    │   ├── npm ci (frontend + backend + TUI)
    │   ├── npm run build:all (PWA + backend + TUI)
    │   ├── Package dist/pwa/ → weaver-v1.0.0-pwa.tar.gz
    │   └── Generate SBOMs (CycloneDX)
    │
    ├─ Create Draft Release (attestation, draft GitHub Release)
    │
    ├─ Publish Release (manual approval gate)
    │
    ├─ Release to Free Repo (rsync + tag + release + assets)
    │
    └─ Update NUR Packages (dispatch with hash, skipped for RC)
```

## Post-Release Verification

After the automated workflows complete, verify the release:

### 1. GitHub Release

- [ ] Release appears at `https://github.com/whizbangdevelopers-org/Weaver-Dev/releases`
- [ ] Release notes are accurate
- [ ] Build artifacts are attached

### 2. Free Repo Sync

- [ ] Free repo (`Weaver`) has the new code
- [ ] Excluded files are not present in the free repo
- [ ] Version in `package.json` matches the release

### 3. Demo Site

- [ ] Demo site is accessible at `https://weaver-demo.github.io`
- [ ] Demo shows the new version
- [ ] All features work in demo mode

### 4. Post-Release Tests

Run the post-release verification suite:

```bash
cd testing/post-release
# Follow the README.md instructions
```

## NUR Update Process

The NUR update is automated via the release workflow's "Update NUR Packages" job (skipped for RC/beta/alpha tags):

1. The workflow computes the source hash from the Free repo's release tarball.
2. A `repository-dispatch` event is sent to `whizbangdevelopers-org/nur-packages` with the version, hash, and tag.
3. The NUR repo's workflow updates the package definition and opens a PR.

Manual fallback (if the automated dispatch fails):

1. Update the `npmDepsHash` in `nixos/default.nix` if dependencies changed.
2. Update the version in the Nix package definition.
3. Submit a PR to the NUR repository with the updated package.
4. Verify the NUR package builds: `nix-build -A weaver`.

## Free Repo Sync Details

The sync process ensures the public free mirror stays current without exposing internal development files.

### What Gets Synced

Everything in the Dev repo except (base excludes hardcoded in the release workflow):

- `.claude/` (Claude Code configuration)
- `CLAUDE.md` (development guidance)
- `TESTING.md` (test documentation)
- `testing/` (test suites)
- `playwright.config.ts`, `vitest.config.ts` (test configs)
- `.mcp.json` (MCP server config)
- `flake.nix`, `flake.lock` (NixOS flake — dev only)
- `.github/workflows/sync-to-free.yml` (sync workflow)
- `.github/sync-exclude.yml` (exclusion config)
- `.github/dependabot.yml` (dependabot config)
- `.github/issue-mapping.json` (issue mapping)

Additional repo-specific exclusions are read from `.github/sync-exclude.yml` at sync time.

### Verifying the Sync

```bash
# Clone the free repo and compare
git clone https://github.com/whizbangdevelopers-org/Weaver-Free.git /tmp/free-check
diff -rq /path/to/dev /tmp/free-check --exclude=.git --exclude=CLAUDE.md --exclude=sync-to-free.yml
```

## Hotfix Process

For urgent fixes that cannot wait for the next regular release:

```bash
# 1. Create hotfix branch from the release tag
git checkout -b hotfix/critical-fix v0.2.0

# 2. Make the fix
# ... edit files ...

# 3. Test
npm run test:prepush

# 4. Commit
git commit -m "fix: critical security issue in VM name validation"

# 5. Push branch and create PR
git push origin hotfix/critical-fix
gh pr create --title "Hotfix: critical security issue" --base main

# 6. After merge, tag the hotfix release
git checkout main
git pull
npm version patch  # 0.2.0 -> 0.2.1
git push origin main --tags
```

## Rollback Procedure

If a release needs to be rolled back:

```bash
# 1. Revert the release commit on main
git revert <release-commit-hash>
git push origin main

# 2. Delete the release tag (locally and remote)
git tag -d v0.2.0
git push origin :refs/tags/v0.2.0

# 3. Delete the GitHub Release via the web UI or CLI
gh release delete v0.2.0 --yes

# 4. For NixOS deployments, rebuild with the previous version
sudo nixos-rebuild switch
```

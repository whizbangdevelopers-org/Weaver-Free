<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
# Manual Release & Tagging — How To

**Project:** Weaver
**Repos:** `Weaver-Dev` (private, `origin`), `Weaver` (public, `free`)
**Sync to Free:** Automated via `sync-to-free.yml` workflow on push to main.

---

## Prerequisites

- `gh` CLI authenticated (`gh auth status`)
- Clean working tree (`git status` shows nothing to commit)
- Node.js 24+ installed

---

## 1. Verify Builds

Always verify both builds pass before tagging.

```bash
cd /home/mark/Projects/active/weaver-project/code

# Backend
cd backend && npm run build
# Should output: > tsc (no errors)

# Frontend
cd .. && npx quasar build
# Should output: Build succeeded
```

Check outputs exist:

```bash
ls backend/dist/          # index.js, routes/, services/
ls dist/spa/              # index.html, assets/
```

---

## 2. Version Numbering

Format: `vMAJOR.MINOR.PATCH[-prerelease]`

| Tag | When to use |
|-----|-------------|
| `v0.1.0-alpha.1` | Early testing, not feature-complete |
| `v0.1.0-alpha.2` | Subsequent alpha with fixes |
| `v0.1.0-beta.1` | Feature-complete, testing for bugs |
| `v0.1.0-rc.1` | Release candidate, final testing |
| `v0.1.0` | Stable release |

Bump rules:
- **Patch** (0.1.0 → 0.1.1): Bug fixes only
- **Minor** (0.1.0 → 0.2.0): New features, backward compatible
- **Major** (0.x → 1.0.0): Breaking changes or "ready for public"

---

## 3. Push to Dev Repo

```bash
git push origin main
```

This triggers the `sync-to-free` workflow which automatically syncs code to the Free (public) repo.

---

## 4. Create a Prerelease (Dev Repo)

```bash
gh release create v0.1.0-alpha.2 \
  --repo whizbangdevelopers-org/Weaver-Dev \
  --title "v0.1.0-alpha.2" \
  --notes "$(cat <<'EOF'
## Changes since alpha.1

- Added feature X
- Fixed bug Y

### Known Issues
- Issue Z still open (#NN)
EOF
)" --prerelease
```

The `--prerelease` flag marks it as non-production in GitHub's UI.

---

## 5. Create a Stable Release (Dev Repo)

Same as above but without `--prerelease`:

```bash
gh release create v0.1.0 \
  --repo whizbangdevelopers-org/Weaver-Dev \
  --title "v0.1.0" \
  --notes "$(cat <<'EOF'
## v0.1.0 — First stable release

### Features
- Real-time VM monitoring via WebSocket
- Start/Stop/Restart controls
- Service health probes
- Demo mode for showcase

### Breaking Changes
- None (first release)
EOF
)"
```

---

## 6. Create Release on Public Repo

The sync-to-free workflow handles code sync automatically. For releases on the Free repo:

```bash
gh release create v0.1.0 \
  --repo whizbangdevelopers-org/Weaver-Free \
  --title "v0.1.0" \
  --notes "Release notes here..."
```

---

## 7. Tagging Without a Release

If you just want a git tag without a GitHub release:

```bash
# Lightweight tag
git tag v0.1.0-alpha.2
git push origin v0.1.0-alpha.2

# Annotated tag (preferred — includes message)
git tag -a v0.1.0-alpha.2 -m "Alpha 2: health probes added"
git push origin v0.1.0-alpha.2
```

---

## 8. Viewing & Managing Releases

```bash
# List all releases
gh release list --repo whizbangdevelopers-org/Weaver-Dev

# View a specific release
gh release view v0.1.0-alpha.1 --repo whizbangdevelopers-org/Weaver-Dev

# Delete a release (keeps the git tag)
gh release delete v0.1.0-alpha.1 --repo whizbangdevelopers-org/Weaver-Dev

# Delete a git tag
git tag -d v0.1.0-alpha.1
git push origin :refs/tags/v0.1.0-alpha.1
```

---

## 9. Release Checklist

Before every release:

- [ ] Working tree is clean (`git status`)
- [ ] All changes committed and pushed to `origin main`
- [ ] Backend builds: `cd code/backend && npm run build`
- [ ] Frontend builds: `cd code && npx quasar build`
- [ ] Service is running on the dev machine (manual smoke test)
- [ ] Release notes reference relevant issues
- [ ] Prerelease flag set appropriately

---

## 10. Release History

| Tag | Date | Type | Notes |
|-----|------|------|-------|
| `v0.1.0-alpha.1` | 2026-02-08 | Prerelease | First working dashboard, self-hosted on NixOS |

Update this table with each release.

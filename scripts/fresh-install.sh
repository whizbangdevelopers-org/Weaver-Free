#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# =============================================================================
# Fresh Install — clean slate for development and manual testing
# =============================================================================
# Removes all generated state (node_modules, lockfiles, caches, backend data)
# then reinstalls dependencies. After running, the app starts at the
# first-time-user setup screen.
#
# Usage:  npm run fresh-install
#         ./scripts/fresh-install.sh
#         sudo ./scripts/fresh-install.sh   # when root-owned files exist
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

step() { echo -e "${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
die()  { echo -e "${RED}✗ $1${NC}" >&2; exit 1; }

cd "$PROJECT_ROOT"

# ── Privilege detection ───────────────────────────────────────────────────────
# When run as root (sudo), npm install must run as the real user to avoid
# creating more root-owned files. Detect the owning user from PROJECT_ROOT.
if [ "$(id -u)" -eq 0 ]; then
    REAL_USER="${SUDO_USER:-$(stat -c '%U' "$PROJECT_ROOT")}"
    RUN_AS="sudo -u $REAL_USER"
    warn "Running as root — npm commands will execute as $REAL_USER"
else
    RUN_AS=""
fi

# ── 0. Kill stale dev servers ────────────────────────────────────────────────
step "Killing stale dev servers"
killed_pids=""
for port in 9010 9011 9012 9020 3110 3120 3130 3100; do
    pids=$(lsof -ti ":$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "$pids" | xargs kill 2>/dev/null || true
        killed_pids="$killed_pids $pids"
    fi
done
if [ -n "$killed_pids" ]; then
    # Wait for processes to fully exit — prevents graceful-shutdown flush
    # from re-persisting data we're about to wipe
    for pid in $killed_pids; do
        timeout 5 tail --pid="$pid" -f /dev/null 2>/dev/null || true
    done
    ok "Killed and waited for processes to exit"
else
    ok "No stale servers found"
fi

# ── 1. Remove node_modules and lockfiles ─────────────────────────────────────
step "Removing node_modules and lockfiles"

# Quasar dev server leaves root-owned .q-cache when run under sudo.
# Detect this early and fail with a clear message instead of hanging on sudo.
has_root_files=false
for dir in node_modules backend/node_modules tui/node_modules mcp-server/node_modules; do
    if [ -d "$dir" ] && [ -n "$(find "$dir" -maxdepth 3 -user root -print -quit 2>/dev/null)" ]; then
        has_root_files=true
        break
    fi
done

if [ "$has_root_files" = true ] && [ "$(id -u)" -ne 0 ]; then
    die "Root-owned files in $dir (likely from sudo dev server). Run: sudo $0"
fi

rm -rf node_modules backend/node_modules tui/node_modules mcp-server/node_modules
rm -f package-lock.json backend/package-lock.json tui/package-lock.json mcp-server/package-lock.json
ok "node_modules and lockfiles removed"

# ── 2. Clear caches ──────────────────────────────────────────────────────────
step "Clearing build caches"
rm -rf .quasar node_modules/.vite 2>/dev/null || true
ok "Caches cleared"

# ── 3. Remove backend data (users, sessions, configs) ────────────────────────
step "Removing backend data (first-run reset)"
if [ -d backend/data ]; then
    # Preserve git-tracked seed files, remove runtime state
    find backend/data -type f ! -name 'distro-catalog.json' -delete 2>/dev/null || true
    find backend/data -type d -empty -delete 2>/dev/null || true
    ok "backend/data cleared (seed files preserved) — app will show first-time setup"
else
    ok "backend/data already clean"
fi

# ── 4. Install dependencies ─────────────────────────────────────────────────
step "Installing frontend dependencies"
$RUN_AS npm install

step "Installing backend dependencies"
$RUN_AS npm --prefix backend install

step "Installing TUI dependencies"
$RUN_AS npm --prefix tui install

# ── 5. Verify ────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Fresh install complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Run:  npm run dev:full"
echo "  Then: visit http://localhost:9010 → first-time admin setup"
echo ""

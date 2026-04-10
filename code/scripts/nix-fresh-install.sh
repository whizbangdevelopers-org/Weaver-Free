#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# =============================================================================
# NixOS Fresh Install — clean slate for the production NixOS service
# =============================================================================
# Stops the service, wipes all runtime data, generates a fresh JWT secret,
# then rebuilds and starts the service. After running, visit
# http://localhost:3100 to create an admin account via the first-time setup UI.
#
# Usage:  sudo ./scripts/nix-fresh-install.sh
#
# Environment variables (same as nix-rebuild-local.sh):
#   NIXOS_FLAKE  — path to NixOS flake (default: /etc/nixos)
#   NIXOS_HOST   — hostname for nixos-rebuild (default: $(hostname))
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $(id -u) -ne 0 ]]; then
  echo "ERROR: This script must be run as root (sudo)."
  exit 1
fi

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Build counter (persists across installs) ─────────────────────────────────
BUILD_COUNTER_FILE="$SCRIPT_DIR/.fresh-install-count"
if [[ -f "$BUILD_COUNTER_FILE" ]]; then
  BUILD_NUM=$(( $(cat "$BUILD_COUNTER_FILE") + 1 ))
else
  BUILD_NUM=1
fi
echo "$BUILD_NUM" > "$BUILD_COUNTER_FILE"

# ── Latest commit info (what triggered this build) ───────────────────────────
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMMIT_SHA="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
COMMIT_MSG="$(git -C "$REPO_DIR" log -1 --format='%s' 2>/dev/null || echo "unknown")"
# Truncate long commit messages to fit the banner
if [[ ${#COMMIT_MSG} -gt 50 ]]; then
  COMMIT_MSG="${COMMIT_MSG:0:47}..."
fi

step() { echo -e "${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }

DATA_DIR="/var/lib/weaver"
MICROVMS_DIR="/var/lib/microvms"
SERVICE_USER="weaver"
SERVICE_GROUP="weaver"

# ── 1. Stop services ────────────────────────────────────────────────────────
# Build a scannable banner: "FRESH INSTALL #  <num centered>  (sha)"
# The number is centered in the space between "#" and "(sha)" for quick visual ID.
LABEL="FRESH INSTALL #"
SUFFIX="(${COMMIT_SHA})"
# Total inner width of the box (between the │ chars)
BOX_W=59
# Space available for the centered number = total - label - suffix - 2 padding spaces
AVAIL=$(( BOX_W - ${#LABEL} - ${#SUFFIX} - 2 ))
NUM_STR="$BUILD_NUM"
PAD_LEFT=$(( (AVAIL - ${#NUM_STR}) / 2 ))
PAD_RIGHT=$(( AVAIL - ${#NUM_STR} - PAD_LEFT ))

echo ""
echo -e "${YELLOW}  ┌─────────────────────────────────────────────────────────────┐${NC}"
printf "${YELLOW}  │ %s%*s%s%*s%s │${NC}\n" "$LABEL" "$PAD_LEFT" "" "$NUM_STR" "$PAD_RIGHT" "" "$SUFFIX"
echo -e "${YELLOW}  │  ${COMMIT_MSG}$(printf '%*s' $((BOX_W - 2 - ${#COMMIT_MSG})) '')│${NC}"
echo -e "${YELLOW}  └─────────────────────────────────────────────────────────────┘${NC}"
echo ""
step "Stopping weaver service"
systemctl stop weaver 2>/dev/null || true
systemctl stop 'microvm@*' 2>/dev/null || true
ok "Services stopped"

# ── 2. Wipe data (including dotfiles like .jwt-secret, .admin-password) ─────
step "Wiping runtime data"
find "${DATA_DIR:?}" -mindepth 1 -delete 2>/dev/null || true
find "${MICROVMS_DIR:?}" -mindepth 1 -delete 2>/dev/null || true
mkdir -p "$DATA_DIR" "$MICROVMS_DIR"
ok "Data directories cleaned"

# ── 3. Generate JWT secret ──────────────────────────────────────────────────
step "Generating JWT secret"
openssl rand -base64 32 > "$DATA_DIR/.jwt-secret"
chmod 600 "$DATA_DIR/.jwt-secret"
ok "JWT secret created"

# ── 4. Fix ownership ────────────────────────────────────────────────────────
step "Setting ownership"
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$DATA_DIR" "$MICROVMS_DIR"
ok "Ownership set to $SERVICE_USER:$SERVICE_GROUP"

# ── 5. Rebuild ──────────────────────────────────────────────────────────────
step "Running nix-rebuild-local.sh"
"$SCRIPT_DIR/nix-rebuild-local.sh"

# ── Done ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Fresh install #${BUILD_NUM} complete!  (${COMMIT_SHA})${NC}"
echo -e "${GREEN}  ${COMMIT_MSG}${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Visit http://localhost:3100 → first-time admin setup"
echo ""

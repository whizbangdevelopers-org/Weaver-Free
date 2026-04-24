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
# Automatically detects the configured serviceUser/serviceGroup from the
# NixOS module so ownership always matches the running service. Works for
# all tiers — Free/Solo (user's own account) and Team/Fabrick (dedicated
# weaver system user).
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

DATA_DIR="${WEAVER_DATA_DIR:-/var/lib/weaver}"
MICROVMS_DIR="${WEAVER_MICROVMS_DIR:-/var/lib/microvms}"

# Detect the configured service user/group from the running NixOS system.
# This matches whatever serviceUser/serviceGroup the NixOS module is set to —
# whether that's the default "weaver" or a user override like "mark".
# Falls back to SUDO_USER/users on first install (before the service exists).
SERVICE_USER=$(systemctl show weaver -p User --value 2>/dev/null || echo "${SUDO_USER:-root}")
SERVICE_GROUP=$(systemctl show weaver -p Group --value 2>/dev/null || echo "users")
# systemctl show returns empty string if the property isn't set
SERVICE_USER="${SERVICE_USER:-${SUDO_USER:-root}}"
SERVICE_GROUP="${SERVICE_GROUP:-users}"

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

# ── 0. KVM pre-flight ────────────────────────────────────────────────────────
# A full rebuild that can't provision VMs is a wasted rebuild. Diagnose in
# layers and stop here so the developer fixes the issue before data is wiped.
RED_LOCAL='\033[0;31m'
if [[ -r /dev/kvm && -w /dev/kvm ]]; then
  : # accessible — proceed
elif [[ -e /dev/kvm ]]; then
  echo -e "${RED_LOCAL}✗  /dev/kvm exists but is not accessible to the current user${NC}"
  echo ""
  echo "  Fix: add your user to the kvm group, then log out and back in."
  echo "    sudo usermod -aG kvm \$SUDO_USER"
  echo "  Or in NixOS: users.users.<youruser>.extraGroups = [ \"kvm\" ];"
  echo "  then: nixos-rebuild switch"
  echo ""
  exit 1
else
  VIRT_TYPE=$(systemd-detect-virt 2>/dev/null | head -1 | tr -d '[:space:]' || echo "none")
  CPU_VIRT=$(grep -cE 'vmx|svm' /proc/cpuinfo 2>/dev/null || echo 0)
  CPU_TYPE=$(grep -m1 'vmx' /proc/cpuinfo &>/dev/null && echo "intel" || echo "amd")

  if [[ "$VIRT_TYPE" != "none" && -n "$VIRT_TYPE" ]]; then
    echo -e "${RED_LOCAL}✗  /dev/kvm not available — running inside $VIRT_TYPE without nested virtualization${NC}"
    echo ""
    echo "  KVM host (Intel, one-time):  echo 1 | sudo tee /sys/module/kvm_intel/parameters/nested"
    echo "  KVM host (AMD, one-time):    echo 1 | sudo tee /sys/module/kvm_amd/parameters/nested"
    echo ""
    echo "  Permanently (NixOS host) — add both options:"
    echo "    boot.extraModprobeConfig = \"options kvm_intel nested=1\";  # or kvm_amd"
    echo "    hardware.cpu.intel.updateMicrocode = true;  # Intel"
    echo "    hardware.cpu.amd.updateMicrocode = true;    # AMD (use whichever matches your host CPU)"
    echo "  then: nixos-rebuild switch on the host, restart this VM"
    echo ""
  elif [[ "$CPU_VIRT" -gt 0 ]]; then
    echo -e "${RED_LOCAL}✗  CPU supports virtualization but the KVM kernel module is not loaded${NC}"
    echo ""
    if [[ "$CPU_TYPE" == "intel" ]]; then
      echo "  Add to /etc/nixos/configuration.nix: boot.kernelModules = [ \"kvm-intel\" ];"
    else
      echo "  Add to /etc/nixos/configuration.nix: boot.kernelModules = [ \"kvm-amd\" ];"
    fi
    echo "  then: nixos-rebuild switch, then re-run this script"
    echo ""
  else
    echo -e "${RED_LOCAL}✗  CPU virtualization extensions (VT-x / AMD-V) not detected${NC}"
    echo ""
    echo "  If bare metal: enable VT-x / AMD-V in BIOS/UEFI, then add"
    echo "    boot.kernelModules = [ \"kvm-intel\" ];  # or kvm-amd"
    echo "  to /etc/nixos/configuration.nix, rebuild, then re-run this script."
    echo "  If inside a VM: enable nested virtualization on the host."
    echo "  See docs/COMPATIBILITY.md for vendor-specific BIOS steps."
    echo ""
  fi
  exit 1
fi

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

# ── 6. Verify service is running ───────────────────────────────────────────
step "Verifying weaver service"
# Give the service a moment to start after rebuild
sleep 2
if systemctl is-active --quiet weaver 2>/dev/null; then
  ok "weaver.service is running"
  echo ""
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Fresh install #${BUILD_NUM} complete!  (${COMMIT_SHA})${NC}"
  echo -e "${GREEN}  ${COMMIT_MSG}${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "  Visit http://localhost:3100 → first-time admin setup"
  echo ""
else
  RED='\033[0;31m'
  echo -e "${RED}✗ weaver.service is not running${NC}"
  echo ""
  echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${RED}  Fresh install #${BUILD_NUM} FAILED  (${COMMIT_SHA})${NC}"
  echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "  The NixOS rebuild succeeded but the weaver service did not start."
  echo "  Check: journalctl -u weaver --no-pager -n 30"
  echo ""
  exit 1
fi

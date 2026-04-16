#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# =============================================================================
# NixOS Uninstall — cleanly remove Weaver from a NixOS system
# =============================================================================
# Scans the system, shows exactly what will be changed, asks for confirmation,
# then removes everything automatically and verifies the result.
#
# Usage:  sudo ./scripts/nix-uninstall.sh
#
# Flags:
#   --keep-data    Preserve /var/lib/weaver (database, secrets, user data)
#   --dry-run      Show what would be removed without changing anything
#
# Environment variables:
#   NIXOS_FLAKE  — path to NixOS flake (default: /etc/nixos)
#   NIXOS_HOST   — hostname for nixos-rebuild (default: $(hostname))
# =============================================================================

set -euo pipefail

if [[ $(id -u) -ne 0 ]]; then
  echo "ERROR: This script must be run as root (sudo)."
  exit 1
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

step() { echo -e "${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; }

NIXOS_FLAKE="${NIXOS_FLAKE:-/etc/nixos}"
NIXOS_HOST="${NIXOS_HOST:-$(hostname)}"
NIXOS_REAL=$(readlink -f "$NIXOS_FLAKE")
DATA_DIR="${WEAVER_DATA_DIR:-/var/lib/weaver}"
FLAKE_NIX="$NIXOS_REAL/flake.nix"

# Parse flags
KEEP_DATA=false
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --keep-data) KEEP_DATA=true ;;
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      echo "Usage: sudo $0 [--keep-data] [--dry-run]"
      echo ""
      echo "  --keep-data  Preserve /var/lib/weaver (database, secrets, user data)"
      echo "  --dry-run    Show what would be removed without changing anything"
      exit 0
      ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

# =============================================================================
# PHASE 1: SCAN — find everything that needs to change
# =============================================================================

SERVICE_RUNNING=false
MICROVMS_RUNNING=false
DATA_EXISTS=false
FLAKE_HAS_WEAVER=false
LOCK_HAS_WEAVER=false

# Service
if systemctl is-active --quiet weaver 2>/dev/null; then
  SERVICE_RUNNING=true
fi
if systemctl list-units --type=service --state=running 2>/dev/null | grep -q 'microvm@'; then
  MICROVMS_RUNNING=true
fi

# Data
if [[ -d "$DATA_DIR" ]] && [[ "$(ls -A "$DATA_DIR" 2>/dev/null)" ]]; then
  DATA_EXISTS=true
fi

# NixOS config files — find all files referencing weaver
# Catches: services.weaver, weaver.nixosModules, inputs.weaver, and raw path imports to weaver's nixos/
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ALL_WEAVER_FILES=$(grep -rl "services\.weaver\|weaver\.nixosModules\|inputs\.weaver\|${REPO_ROOT}/nixos" "$NIXOS_REAL" --include='*.nix' 2>/dev/null | grep -v flake.nix | sort -u || true)

# Classify each file: weaver-only (delete entire file) vs shared (edit lines only)
# A file is weaver-only if every non-blank, non-comment, non-brace line mentions weaver or is boilerplate
WEAVER_ONLY_FILES=""
WEAVER_SHARED_FILES=""
for f in $ALL_WEAVER_FILES; do
  # Count lines that are NOT: blank, comments, braces, brackets, semicolons, weaver-related, or repo path imports
  non_weaver_lines=$(grep -cvE "^\s*$|^\s*#|^\s*//|^\s*[{};\[\]]|weaver|inputs\b.*\.\.\.|\\{ .*, \\.\\.\\.\ \\}|${REPO_ROOT}" "$f" 2>/dev/null || echo "0")
  if [[ "$non_weaver_lines" -le 2 ]]; then
    WEAVER_ONLY_FILES="$WEAVER_ONLY_FILES $f"
  else
    WEAVER_SHARED_FILES="$WEAVER_SHARED_FILES $f"
  fi
done
WEAVER_ONLY_FILES=$(echo "$WEAVER_ONLY_FILES" | xargs)
WEAVER_SHARED_FILES=$(echo "$WEAVER_SHARED_FILES" | xargs)

if [[ -f "$FLAKE_NIX" ]] && grep -q 'weaver' "$FLAKE_NIX" 2>/dev/null; then
  FLAKE_HAS_WEAVER=true
fi

if [[ -f "$NIXOS_REAL/flake.lock" ]] && grep -q '"weaver"' "$NIXOS_REAL/flake.lock" 2>/dev/null; then
  LOCK_HAS_WEAVER=true
fi

NEEDS_CONFIG_CHANGE=false
if [[ -n "$ALL_WEAVER_FILES" || -n "$WEAVER_ONLY_FILES" || -n "$WEAVER_SHARED_FILES" || "$FLAKE_HAS_WEAVER" == "true" || "$LOCK_HAS_WEAVER" == "true" ]]; then
  NEEDS_CONFIG_CHANGE=true
fi

# Check if there's anything to do at all
if [[ "$SERVICE_RUNNING" == "false" && "$DATA_EXISTS" == "false" && "$NEEDS_CONFIG_CHANGE" == "false" ]]; then
  echo ""
  ok "Weaver is not installed on this system. Nothing to do."
  echo ""
  exit 0
fi

# =============================================================================
# PHASE 2: SHOW THE PLAN — tell the user exactly what will happen
# =============================================================================

echo ""
echo -e "${RED}  ┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${RED}  │              WEAVER UNINSTALL                               │${NC}"
echo -e "${RED}  └─────────────────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "${BOLD}  This script will:${NC}"
echo ""

ACTION_COUNT=0

if [[ "$SERVICE_RUNNING" == "true" ]]; then
  ACTION_COUNT=$((ACTION_COUNT + 1))
  echo "  ${ACTION_COUNT}. Stop the weaver service"
fi

if [[ "$MICROVMS_RUNNING" == "true" ]]; then
  ACTION_COUNT=$((ACTION_COUNT + 1))
  echo "  ${ACTION_COUNT}. Stop running MicroVM services"
fi

if [[ "$DATA_EXISTS" == "true" && "$KEEP_DATA" == "false" ]]; then
  ACTION_COUNT=$((ACTION_COUNT + 1))
  echo -e "  ${ACTION_COUNT}. ${RED}Delete all data${NC} in $DATA_DIR"
  echo "     (database, JWT secrets, user accounts — cannot be undone)"
elif [[ "$DATA_EXISTS" == "true" && "$KEEP_DATA" == "true" ]]; then
  echo -e "  ·  ${YELLOW}Keep${NC} data in $DATA_DIR (--keep-data)"
fi

if [[ -n "$WEAVER_ONLY_FILES" ]]; then
  ACTION_COUNT=$((ACTION_COUNT + 1))
  echo -e "  ${ACTION_COUNT}. ${RED}Delete${NC} weaver-only config files:"
  for ref in $WEAVER_ONLY_FILES; do
    echo "     - $ref"
  done
  # Check if any deleted files are imported elsewhere — need to remove those import lines too
  IMPORT_CLEANUP=""
  for wf in $WEAVER_ONLY_FILES; do
    basename_nix=$(basename "$wf")
    importers=$(grep -rl "$basename_nix" "$NIXOS_REAL" --include='*.nix' 2>/dev/null | grep -v "$wf" || true)
    if [[ -n "$importers" ]]; then
      IMPORT_CLEANUP="$IMPORT_CLEANUP $importers"
    fi
  done
  IMPORT_CLEANUP=$(echo "$IMPORT_CLEANUP" | xargs | tr ' ' '\n' | sort -u | tr '\n' ' ' | xargs)
  if [[ -n "$IMPORT_CLEANUP" ]]; then
    ACTION_COUNT=$((ACTION_COUNT + 1))
    echo "  ${ACTION_COUNT}. Remove import lines for deleted files from:"
    for ref in $IMPORT_CLEANUP; do
      echo "     - $ref"
    done
  fi
fi

if [[ -n "$WEAVER_SHARED_FILES" ]]; then
  ACTION_COUNT=$((ACTION_COUNT + 1))
  echo "  ${ACTION_COUNT}. Remove weaver lines from shared config files:"
  for ref in $WEAVER_SHARED_FILES; do
    echo "     - $ref"
  done
fi

if [[ "$FLAKE_HAS_WEAVER" == "true" ]]; then
  ACTION_COUNT=$((ACTION_COUNT + 1))
  echo "  ${ACTION_COUNT}. Remove weaver input and params from $FLAKE_NIX"
fi

if [[ "$LOCK_HAS_WEAVER" == "true" ]]; then
  ACTION_COUNT=$((ACTION_COUNT + 1))
  echo "  ${ACTION_COUNT}. Regenerate flake.lock (remove weaver entry)"
fi

if [[ "$NEEDS_CONFIG_CHANGE" == "true" ]]; then
  ACTION_COUNT=$((ACTION_COUNT + 1))
  echo "  ${ACTION_COUNT}. Rebuild NixOS to apply changes"
fi

echo ""

# =============================================================================
# PHASE 3: CONFIRM (or dry-run exit)
# =============================================================================

if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  Dry run — no changes were made${NC}"
  echo -e "${YELLOW}  Run without --dry-run to execute the above steps${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
  exit 0
fi

read -rp "  Proceed with uninstall? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo ""
  echo "  Cancelled. No changes made."
  echo ""
  exit 0
fi

echo ""

# =============================================================================
# PHASE 4: EXECUTE — do everything shown above
# =============================================================================

# ── Stop services ──────────────────────────────────────────────────────────
if [[ "$SERVICE_RUNNING" == "true" ]]; then
  step "Stopping weaver service"
  systemctl stop weaver
  ok "weaver.service stopped"
fi

if [[ "$MICROVMS_RUNNING" == "true" ]]; then
  step "Stopping MicroVM services"
  systemctl stop 'microvm@*' 2>/dev/null || true
  ok "MicroVM services stopped"
fi

# ── Delete data ────────────────────────────────────────────────────────────
if [[ "$DATA_EXISTS" == "true" && "$KEEP_DATA" == "false" ]]; then
  step "Deleting $DATA_DIR"
  rm -rf "$DATA_DIR"
  ok "Data deleted"
elif [[ "$KEEP_DATA" == "true" ]]; then
  ok "Data preserved in $DATA_DIR"
fi

# ── Remove NixOS config references ────────────────────────────────────────
if [[ "$NEEDS_CONFIG_CHANGE" == "true" ]]; then
  step "Removing weaver from NixOS configuration"

  # Delete weaver-only files entirely
  if [[ -n "$WEAVER_ONLY_FILES" ]]; then
    for ref in $WEAVER_ONLY_FILES; do
      rm -f "$ref"
      echo "    Deleted $ref"
    done
    # Remove import lines referencing deleted files from other configs
    if [[ -n "${IMPORT_CLEANUP:-}" ]]; then
      for ref in $IMPORT_CLEANUP; do
        for wf in $WEAVER_ONLY_FILES; do
          basename_nix=$(basename "$wf")
          # Remove lines importing the deleted file (handles ./path/to/weaver.nix and similar)
          sed -i "/${basename_nix}/d" "$ref"
        done
        echo "    Removed import of deleted file from $ref"
      done
    fi
  fi

  # Edit shared files — remove only weaver-related lines
  if [[ -n "$WEAVER_SHARED_FILES" ]]; then
    for ref in $WEAVER_SHARED_FILES; do
      sed -i '/services\.weaver/d' "$ref"
      sed -i '/weaver\.nixosModules/d' "$ref"
      sed -i '/inputs\.weaver/d' "$ref"
      sed -i "\|${REPO_ROOT}/nixos|d" "$ref"
      echo "    Cleaned $ref"
    done
  fi

  # flake.nix weaver input and params
  if [[ "$FLAKE_HAS_WEAVER" == "true" ]]; then
    # Single-line forms
    sed -i '/^[[:space:]]*weaver\.url/d' "$FLAKE_NIX"
    sed -i '/^[[:space:]]*weaver\.inputs/d' "$FLAKE_NIX"
    # Block form: weaver = { ... };
    sed -i '/^[[:space:]]*weaver = {/,/};/d' "$FLAKE_NIX"
    # Remove weaver.nixosModules from modules list
    sed -i '/weaver\.nixosModules/d' "$FLAKE_NIX"
    # Remove 'weaver' from outputs function params
    sed -i 's/, weaver\b//g; s/\bweaver, //g' "$FLAKE_NIX"
    # Remove comment lines that only reference weaver
    sed -i '/^[[:space:]]*#.*[Ww]eaver/d' "$FLAKE_NIX"
    echo "    Cleaned $FLAKE_NIX"
  fi

  ok "NixOS config cleaned"

  # Regenerate flake.lock
  if [[ "$LOCK_HAS_WEAVER" == "true" ]]; then
    step "Regenerating flake.lock"
    nix flake lock "$NIXOS_FLAKE" 2>/dev/null || true
    ok "flake.lock regenerated"
  fi

  # Rebuild
  step "Rebuilding NixOS"
  if nixos-rebuild switch --flake "$NIXOS_FLAKE#$NIXOS_HOST"; then
    ok "NixOS rebuilt successfully"
  else
    fail "Rebuild failed"
    echo ""
    echo "  The config changes were made but the rebuild failed."
    echo "  Check the errors above, then run manually:"
    echo "    sudo nixos-rebuild switch --flake $NIXOS_FLAKE#$NIXOS_HOST"
    echo ""
    exit 1
  fi
fi

# =============================================================================
# PHASE 5: VERIFY — confirm everything was removed
# =============================================================================

echo ""
step "Verifying uninstall"
VERIFY_PASSED=true

# Service should not exist
if systemctl is-active --quiet weaver 2>/dev/null; then
  fail "weaver.service is still running"
  VERIFY_PASSED=false
else
  ok "weaver.service is gone"
fi

# Data should be gone (unless --keep-data)
if [[ "$KEEP_DATA" == "false" && -d "$DATA_DIR" ]]; then
  fail "$DATA_DIR still exists"
  VERIFY_PASSED=false
elif [[ "$KEEP_DATA" == "false" ]]; then
  ok "$DATA_DIR removed"
else
  ok "$DATA_DIR preserved (--keep-data)"
fi

# Weaver-only files should be gone
if [[ -n "${WEAVER_ONLY_FILES:-}" ]]; then
  for ref in $WEAVER_ONLY_FILES; do
    if [[ -f "$ref" ]]; then
      fail "$ref still exists"
      VERIFY_PASSED=false
    else
      ok "$(basename "$ref") deleted"
    fi
  done
fi

# No weaver references in remaining config
REMAINING_REFS=$(grep -rl "services\.weaver\|weaver\.nixosModules\|inputs\.weaver\|${REPO_ROOT}/nixos" "$NIXOS_REAL" --include='*.nix' 2>/dev/null || true)
if [[ -n "$REMAINING_REFS" ]]; then
  fail "Weaver references still found in:"
  for ref in $REMAINING_REFS; do
    echo "    - $ref"
  done
  VERIFY_PASSED=false
else
  ok "No weaver references in NixOS config"
fi

# No weaver in flake.lock
if [[ -f "$NIXOS_REAL/flake.lock" ]] && grep -q '"weaver"' "$NIXOS_REAL/flake.lock" 2>/dev/null; then
  fail "weaver still in flake.lock"
  VERIFY_PASSED=false
else
  ok "flake.lock is clean"
fi

# ── Final result ──────────────────────────────────────────────────────────
echo ""
if [[ "$VERIFY_PASSED" == "true" ]]; then
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Weaver completely uninstalled${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
else
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  Weaver partially uninstalled — check failures above${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
fi
echo ""

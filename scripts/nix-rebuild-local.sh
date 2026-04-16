#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# nix-rebuild-local.sh — Update flake hashes and rebuild NixOS from local source
#
# Automates the full cycle:
#   1. Compute correct npm dep hashes via prefetch-npm-deps
#   2. Update nixos/package.nix if hashes changed
#   3. Update the NixOS flake lock to pick up the new source
#   4. Run nixos-rebuild switch
#
# Usage:
#   sudo ./scripts/nix-rebuild-local.sh              # Full cycle
#   sudo ./scripts/nix-rebuild-local.sh --hash-only  # Only update hashes, don't rebuild
#   sudo ./scripts/nix-rebuild-local.sh --dry-run    # Show what would change
#
# Environment variables (override defaults):
#   NIXOS_FLAKE  — path to NixOS flake (default: /etc/nixos)
#   NIXOS_HOST   — hostname for nixos-rebuild (default: $(hostname))

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE_NIX="$REPO_ROOT/nixos/package.nix"
NIXOS_FLAKE="${NIXOS_FLAKE:-/etc/nixos}"
NIXOS_HOST="${NIXOS_HOST:-$(hostname)}"

# When running as root (via sudo), Git's safe.directory check blocks access to
# repos owned by other users. Set GIT_CONFIG_COUNT env vars for direct git calls,
# AND add safe.directory to root's git config for Nix's internal git fetcher
# (which doesn't inherit GIT_CONFIG_COUNT env vars).
if [[ $(id -u) -eq 0 ]]; then
  NIXOS_GIT_ROOT=$(git -c safe.directory="*" -C "$(readlink -f "$NIXOS_FLAKE")" rev-parse --show-toplevel 2>/dev/null || readlink -f "$NIXOS_FLAKE")
  export GIT_CONFIG_COUNT=2
  export GIT_CONFIG_KEY_0="safe.directory"
  export GIT_CONFIG_VALUE_0="$REPO_ROOT"
  export GIT_CONFIG_KEY_1="safe.directory"
  export GIT_CONFIG_VALUE_1="$NIXOS_GIT_ROOT"

  # Nix's internal git fetcher reads root's gitconfig, not env vars.
  # Add safe.directory entries (idempotent — git config --add is a no-op for dupes).
  for dir in "$REPO_ROOT" "$NIXOS_GIT_ROOT"; do
    if ! git config --global --get-all safe.directory 2>/dev/null | grep -qxF "$dir"; then
      git config --global --add safe.directory "$dir"
      echo "    Added safe.directory for root: $dir"
    fi
  done
fi

# Parse flags
HASH_ONLY=false
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --hash-only) HASH_ONLY=true ;;
    --dry-run) DRY_RUN=true ;;
    --help|-h)
      echo "Usage: $0 [--hash-only] [--dry-run]"
      echo ""
      echo "  --hash-only  Only update nixos/package.nix hashes, don't rebuild"
      echo "  --dry-run    Show what would change without modifying files"
      echo ""
      echo "Environment variables:"
      echo "  NIXOS_FLAKE  Path to NixOS flake (default: /etc/nixos)"
      echo "  NIXOS_HOST   Hostname for nixos-rebuild (default: \$(hostname))"
      exit 0
      ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

echo "    Config: NIXOS_FLAKE=$NIXOS_FLAKE  NIXOS_HOST=$NIXOS_HOST"

# Resolve prefetch-npm-deps
PREFETCH_BIN=$(nix-build '<nixpkgs>' -A prefetch-npm-deps --no-out-link 2>/dev/null)/bin/prefetch-npm-deps
if [[ ! -x "$PREFETCH_BIN" ]]; then
  echo "ERROR: Could not build prefetch-npm-deps from nixpkgs"
  exit 1
fi

echo "==> Computing npm dependency hash..."

# Single lockfile (npm workspaces — root covers backend + tui)
if [[ ! -f "$REPO_ROOT/package-lock.json" ]]; then
  echo "ERROR: Missing $REPO_ROOT/package-lock.json"
  echo "       Run 'npm install' first."
  exit 1
fi

COMPUTED_HASH=$("$PREFETCH_BIN" "$REPO_ROOT/package-lock.json") || { echo "ERROR: prefetch-npm-deps failed"; exit 1; }
CURRENT_HASH=$(grep -oP 'npmDepsHash = "\K[^"]+' "$PACKAGE_NIX" || echo "")

echo "    npmDepsHash:  $COMPUTED_HASH"

CHANGES=false
if [[ "$COMPUTED_HASH" != "$CURRENT_HASH" ]]; then
  echo "    Hash CHANGED: $CURRENT_HASH -> $COMPUTED_HASH"
  CHANGES=true
else
  echo "    Hash: up to date"
fi

if [[ "$CHANGES" == "false" ]]; then
  echo "==> Hash is current."
  if [[ "$HASH_ONLY" == "true" || "$DRY_RUN" == "true" ]]; then
    exit 0
  fi
  echo "==> Proceeding to rebuild (hash unchanged but source may have changed)..."
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "==> Dry run — no files modified."
  exit 0
fi

# Update nixos/package.nix if hash changed
if [[ "$CHANGES" == "true" ]]; then
  echo "==> Updating nixos/package.nix hash..."
  if [[ -n "$CURRENT_HASH" ]]; then
    sed -i "s|$CURRENT_HASH|$COMPUTED_HASH|" "$PACKAGE_NIX"
  fi
  echo "    nixos/package.nix updated."
fi

# Stage all changes so the path: flake input sees them.
# Nix path: inputs on a git repo only include tracked/staged content —
# unstaged modifications are invisible to nix flake update.
echo "==> Staging changes for flake input visibility..."
git -C "$REPO_ROOT" add -A

if [[ "$HASH_ONLY" == "true" ]]; then
  echo "==> Hash-only mode — skipping rebuild."
  exit 0
fi

# Update flake lock and rebuild (script must be run as root)
if [[ $(id -u) -ne 0 ]]; then
  echo "ERROR: This script must be run as root (sudo) for nixos-rebuild."
  exit 1
fi

echo "==> Updating NixOS flake lock..."
# Verify the weaver input exists in the NixOS flake before attempting update
if ! nix flake metadata "$NIXOS_FLAKE" --json 2>/dev/null | grep -q '"weaver"'; then
  echo ""
  echo "ERROR: No 'weaver' input found in $NIXOS_FLAKE/flake.nix"
  echo ""
  echo "  Your NixOS flake needs three changes:"
  echo ""
  echo "  1. Add the weaver input to $NIXOS_FLAKE/flake.nix:"
  echo ""
  echo "     inputs.weaver = {"
  echo "       url = \"path:$(readlink -f "$REPO_ROOT")\";"
  echo "       inputs.nixpkgs.follows = \"nixpkgs\";"
  echo "     };"
  echo ""
  echo "  2. Add 'weaver' to the outputs function parameters:"
  echo ""
  echo "     outputs = { nixpkgs, weaver, ... }@inputs: {"
  echo ""
  echo "  3. Load the module and enable the service. Either:"
  echo ""
  echo "     a) Add to your flake.nix modules list:"
  echo "        modules = [ ./configuration.nix weaver.nixosModules.default ];"
  echo "        Then add  services.weaver.enable = true;  in configuration.nix"
  echo ""
  echo "     b) Or create a module file (e.g. modules/services/weaver.nix):"
  echo "        { inputs, ... }: {"
  echo "          imports = [ inputs.weaver.nixosModules.default ];"
  echo "          config.services.weaver.enable = true;"
  echo "        }"
  echo "        (requires 'inputs' in specialArgs)"
  echo ""
  echo "  IMPORTANT: git add any new .nix files before rebuilding."
  echo "  Nix flakes only see git-tracked files."
  echo ""
  exit 1
fi
nix flake update weaver --flake "$NIXOS_FLAKE"

# Auto-commit flake.lock so the NixOS repo stays clean
NIXOS_REAL=$(readlink -f "$NIXOS_FLAKE")
if git -C "$NIXOS_REAL" diff --quiet -- flake.lock 2>/dev/null; then
  echo "    flake.lock unchanged."
else
  # Resolve the calling user's git identity (script runs as root via sudo)
  SUDO_HOME=$(eval echo "~${SUDO_USER:-root}")
  GIT_AUTHOR_NAME=$(git -C "$SUDO_HOME" config user.name 2>/dev/null || echo "nix-rebuild-local")
  GIT_AUTHOR_EMAIL=$(git -C "$SUDO_HOME" config user.email 2>/dev/null || echo "nix-rebuild@localhost")
  export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL
  export GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME" GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL"

  git -C "$NIXOS_REAL" add flake.lock
  git -C "$NIXOS_REAL" commit -m "flake.lock: update weaver input" --no-gpg-sign
  # Push as the calling user so their SSH config/keys are available
  if [[ -n "${SUDO_USER:-}" ]]; then
    sudo -u "$SUDO_USER" git -C "$NIXOS_REAL" push
  else
    git -C "$NIXOS_REAL" push
  fi
  echo "    flake.lock committed and pushed."
fi

echo "==> Running nixos-rebuild switch..."
nixos-rebuild switch --flake "$NIXOS_FLAKE#$NIXOS_HOST"

echo "==> Done. Verifying service..."
if systemctl is-active --quiet weaver 2>/dev/null; then
  systemctl status weaver --no-pager
else
  echo ""
  echo "WARNING: weaver.service is not running after rebuild."
  echo "  Check that services.weaver.enable = true; is set in your NixOS configuration."
  echo "  Run: systemctl status weaver"
  exit 1
fi

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

echo "==> Computing npm dependency hashes..."

# Verify lockfiles exist before computing hashes
for lockfile in "$REPO_ROOT/package-lock.json" "$REPO_ROOT/backend/package-lock.json" "$REPO_ROOT/tui/package-lock.json"; do
  if [[ ! -f "$lockfile" ]]; then
    echo "ERROR: Missing $lockfile"
    echo "       Run 'npm install --package-lock-only' (and backend/tui equivalents) first."
    exit 1
  fi
done

# Compute hashes (root, backend, tui — one per package-lock.json)
# Do NOT suppress stderr — silent failures are unacceptable (see LESSONS-LEARNED)
ROOT_HASH=$("$PREFETCH_BIN" "$REPO_ROOT/package-lock.json") || { echo "ERROR: prefetch-npm-deps failed for root package-lock.json"; exit 1; }
BACKEND_HASH=$("$PREFETCH_BIN" "$REPO_ROOT/backend/package-lock.json") || { echo "ERROR: prefetch-npm-deps failed for backend/package-lock.json"; exit 1; }
TUI_HASH=$("$PREFETCH_BIN" "$REPO_ROOT/tui/package-lock.json") || { echo "ERROR: prefetch-npm-deps failed for tui/package-lock.json"; exit 1; }

echo "    Root npmDepsHash:    $ROOT_HASH"
echo "    Backend deps hash:   $BACKEND_HASH"
echo "    TUI deps hash:       $TUI_HASH"

# Read current hashes from nixos/package.nix (single source of truth)
# Each fetchNpmDeps block has a `name =` field we use to identify the right `hash =` line.
# npmDepsHash is unique (only appears once in buildNpmPackage).
CURRENT_BACKEND_HASH=$(sed -n '/backend-npm-deps/,/};/s/.*hash = "\(sha256-[^"]*\)".*/\1/p' "$PACKAGE_NIX")
CURRENT_TUI_HASH=$(sed -n '/tui-npm-deps/,/};/s/.*hash = "\(sha256-[^"]*\)".*/\1/p' "$PACKAGE_NIX")
CURRENT_ROOT_HASH=$(grep -oP 'npmDepsHash = "\K[^"]+' "$PACKAGE_NIX" || echo "")

CHANGES=false

if [[ "$BACKEND_HASH" != "$CURRENT_BACKEND_HASH" ]]; then
  echo "    Backend hash CHANGED: $CURRENT_BACKEND_HASH -> $BACKEND_HASH"
  CHANGES=true
else
  echo "    Backend hash: up to date"
fi

if [[ "$TUI_HASH" != "$CURRENT_TUI_HASH" ]]; then
  echo "    TUI hash CHANGED: $CURRENT_TUI_HASH -> $TUI_HASH"
  CHANGES=true
else
  echo "    TUI hash: up to date"
fi

if [[ "$ROOT_HASH" != "$CURRENT_ROOT_HASH" ]]; then
  echo "    Root hash CHANGED: $CURRENT_ROOT_HASH -> $ROOT_HASH"
  CHANGES=true
else
  echo "    Root hash: up to date"
fi

if [[ "$CHANGES" == "false" ]]; then
  echo "==> All hashes are current."
  if [[ "$HASH_ONLY" == "true" || "$DRY_RUN" == "true" ]]; then
    exit 0
  fi
  echo "==> Proceeding to rebuild (hashes unchanged but source may have changed)..."
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "==> Dry run — no files modified."
  exit 0
fi

# Update nixos/package.nix if hashes changed
if [[ "$CHANGES" == "true" ]]; then
  echo "==> Updating nixos/package.nix hashes..."

  if [[ "$BACKEND_HASH" != "$CURRENT_BACKEND_HASH" && -n "$CURRENT_BACKEND_HASH" ]]; then
    sed -i "s|$CURRENT_BACKEND_HASH|$BACKEND_HASH|" "$PACKAGE_NIX"
  fi

  if [[ "$TUI_HASH" != "$CURRENT_TUI_HASH" && -n "$CURRENT_TUI_HASH" ]]; then
    sed -i "s|$CURRENT_TUI_HASH|$TUI_HASH|" "$PACKAGE_NIX"
  fi

  if [[ "$ROOT_HASH" != "$CURRENT_ROOT_HASH" && -n "$CURRENT_ROOT_HASH" ]]; then
    sed -i "s|$CURRENT_ROOT_HASH|$ROOT_HASH|" "$PACKAGE_NIX"
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
systemctl status weaver --no-pager || true

#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# =============================================================================
# Weaver Install — add Weaver to a NixOS system (flake or traditional)
# =============================================================================
# Auto-detects flake vs traditional NixOS config and installs accordingly.
#
# Flake mode: edits flake.nix to add the weaver input and modules entry.
# Traditional mode: edits configuration.nix to add the direct-path import.
#
# Both modes: adds services.weaver.enable = true; to configuration.nix.
#
# Usage:
#   sudo ./scripts/nix-install.sh                          # Free tier (default)
#   sudo ./scripts/nix-install.sh --license-key KEY        # Solo/Team/Fabrick
#   sudo ./scripts/nix-install.sh --license-file PATH      # Solo/Team/Fabrick (file-based)
#   sudo ./scripts/nix-install.sh --dry-run                # Show plan, exit
#
# Environment variables:
#   NIXOS_FLAKE  — path to NixOS flake (default: /etc/nixos)
#   NIXOS_HOST   — hostname for nixos-rebuild (default: $(hostname))
#   WEAVER_SRC   — path to Weaver source (default: auto-detect from SCRIPT_DIR)
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

NIXOS_FLAKE="${NIXOS_FLAKE:-/etc/nixos}"
NIXOS_HOST="${NIXOS_HOST:-$(hostname)}"
NIXOS_REAL=$(readlink -f "$NIXOS_FLAKE")
FLAKE_NIX="$NIXOS_REAL/flake.nix"
CONFIG_NIX="$NIXOS_REAL/configuration.nix"
WEAVER_SRC="${WEAVER_SRC:-$REPO_ROOT}"

# Parse flags
LICENSE_KEY=""
LICENSE_FILE=""
DRY_RUN=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --license-key)
      LICENSE_KEY="${2:-}"
      shift 2
      ;;
    --license-file)
      LICENSE_FILE="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      echo "Usage: sudo $0 [--license-key KEY] [--license-file PATH] [--dry-run]"
      echo ""
      echo "  --license-key KEY   License key for Solo/Team/Fabrick (WVR-...)"
      echo "  --license-file PATH Path to a file containing the license key"
      echo "  --dry-run           Show plan without changing anything"
      echo ""
      echo "Default: installs Free tier (no license key)"
      echo "Auto-detects flake vs traditional NixOS config."
      exit 0
      ;;
    *)
      echo "Unknown flag: $1"
      exit 1
      ;;
  esac
done

if [[ -n "$LICENSE_KEY" && -n "$LICENSE_FILE" ]]; then
  fail "Cannot specify both --license-key and --license-file"
  exit 1
fi

# =============================================================================
# PHASE 1: VALIDATE + DETECT MODE
# =============================================================================

if [[ ! -f "$CONFIG_NIX" ]]; then
  fail "$CONFIG_NIX does not exist"
  echo "  Is $NIXOS_FLAKE a NixOS configuration directory?"
  exit 1
fi

if [[ ! -d "$WEAVER_SRC" ]] || [[ ! -f "$WEAVER_SRC/nixos/default.nix" ]]; then
  fail "Weaver source not found at $WEAVER_SRC"
  echo "  Set WEAVER_SRC env var or run from a Weaver source checkout."
  exit 1
fi

# Detect mode: flake if flake.nix exists, traditional otherwise
MODE="traditional"
if [[ -f "$FLAKE_NIX" ]]; then
  MODE="flake"
fi

# =============================================================================
# PHASE 2: SCAN — what's already in place?
# =============================================================================

HAS_INPUT=false        # flake: weaver input present
HAS_MODULE=false       # flake: weaver.nixosModules in modules list
HAS_IMPORT=false       # traditional: weaver's default.nix imported
HAS_ENABLE=false       # both: services.weaver.enable is set

if [[ "$MODE" == "flake" ]]; then
  if grep -q 'inputs\.weaver\|^[[:space:]]*weaver\.url\|^[[:space:]]*weaver = {' "$FLAKE_NIX" 2>/dev/null; then
    HAS_INPUT=true
  fi
  if grep -q 'weaver\.nixosModules' "$FLAKE_NIX" 2>/dev/null; then
    HAS_MODULE=true
  fi
else
  # Traditional: check if configuration.nix already imports weaver's default.nix
  if grep -q "$WEAVER_SRC/nixos/default.nix\|fabrick-weaver-project.*nixos/default.nix" "$CONFIG_NIX" 2>/dev/null; then
    HAS_IMPORT=true
  fi
fi

if grep -rq 'services\.weaver\.enable' "$NIXOS_REAL" --include='*.nix' 2>/dev/null; then
  HAS_ENABLE=true
fi

# =============================================================================
# PHASE 3: SHOW THE PLAN
# =============================================================================

TIER_LABEL="Weaver Free"
if [[ -n "$LICENSE_KEY" || -n "$LICENSE_FILE" ]]; then
  TIER_LABEL="Weaver Solo/Team/Fabrick (license-gated)"
fi

MODE_LABEL="flake (flake.nix)"
if [[ "$MODE" == "traditional" ]]; then
  MODE_LABEL="traditional (no flake.nix)"
fi

echo ""
echo -e "${GREEN}  ┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${GREEN}  │              WEAVER INSTALL                                 │${NC}"
echo -e "${GREEN}  └─────────────────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "  ${BOLD}Tier:${NC}   $TIER_LABEL"
echo -e "  ${BOLD}Mode:${NC}   $MODE_LABEL"
echo -e "  ${BOLD}Source:${NC} $WEAVER_SRC"
echo -e "  ${BOLD}Target:${NC} $NIXOS_REAL (host: $NIXOS_HOST)"
echo ""
echo -e "${BOLD}  This script will:${NC}"
echo ""

ACTION_COUNT=0
NEEDS_CHANGE=false

if [[ "$MODE" == "flake" ]]; then
  if [[ "$HAS_INPUT" == "false" ]]; then
    ACTION_COUNT=$((ACTION_COUNT + 1))
    echo "  ${ACTION_COUNT}. Add weaver input to $FLAKE_NIX"
    echo "       path:$WEAVER_SRC"
    NEEDS_CHANGE=true
  else
    ok "weaver input already present in flake.nix"
  fi

  if [[ "$HAS_MODULE" == "false" ]]; then
    ACTION_COUNT=$((ACTION_COUNT + 1))
    echo "  ${ACTION_COUNT}. Add weaver.nixosModules.default to the modules list"
    NEEDS_CHANGE=true
  else
    ok "weaver.nixosModules already in modules list"
  fi
else
  if [[ "$HAS_IMPORT" == "false" ]]; then
    ACTION_COUNT=$((ACTION_COUNT + 1))
    echo "  ${ACTION_COUNT}. Add weaver import to $CONFIG_NIX"
    echo "       imports = [ $WEAVER_SRC/nixos/default.nix ];"
    NEEDS_CHANGE=true
  else
    ok "weaver already imported in configuration.nix"
  fi
fi

if [[ "$HAS_ENABLE" == "false" ]]; then
  ACTION_COUNT=$((ACTION_COUNT + 1))
  echo "  ${ACTION_COUNT}. Add services.weaver.enable = true; to $CONFIG_NIX"
  NEEDS_CHANGE=true
else
  ok "services.weaver.enable already set"
fi

if [[ -n "$LICENSE_KEY" ]]; then
  ACTION_COUNT=$((ACTION_COUNT + 1))
  echo "  ${ACTION_COUNT}. Write license key to /var/lib/weaver/license.key (0600)"
  ACTION_COUNT=$((ACTION_COUNT + 1))
  echo "  ${ACTION_COUNT}. Add services.weaver.licenseKeyFile = \"/var/lib/weaver/license.key\";"
  NEEDS_CHANGE=true
elif [[ -n "$LICENSE_FILE" ]]; then
  if [[ ! -f "$LICENSE_FILE" ]]; then
    fail "License file not found: $LICENSE_FILE"
    exit 1
  fi
  ACTION_COUNT=$((ACTION_COUNT + 1))
  echo "  ${ACTION_COUNT}. Add services.weaver.licenseKeyFile = \"$LICENSE_FILE\";"
  NEEDS_CHANGE=true
fi

# Even if no config changes are needed, the service may not be running
# (e.g., config was edited but not rebuilt, or service is stopped).
# In that case we still rebuild to activate the existing config.
SERVICE_ACTIVE=false
if systemctl is-active --quiet weaver 2>/dev/null; then
  SERVICE_ACTIVE=true
fi

if [[ "$NEEDS_CHANGE" == "false" && "$SERVICE_ACTIVE" == "true" ]]; then
  echo ""
  ok "Weaver is already fully configured and running. Nothing to do."
  echo ""
  exit 0
fi

if [[ "$NEEDS_CHANGE" == "false" && "$SERVICE_ACTIVE" == "false" ]]; then
  warn "Config is complete but weaver.service is not running."
  echo "  Running rebuild to activate existing configuration."
fi

if [[ "$NEEDS_CHANGE" == "true" && "$MODE" == "flake" ]]; then
  ACTION_COUNT=$((ACTION_COUNT + 1))
  echo "  ${ACTION_COUNT}. git add -A in $NIXOS_REAL (flakes only see tracked files)"
fi

ACTION_COUNT=$((ACTION_COUNT + 1))
if [[ "$MODE" == "flake" ]]; then
  echo "  ${ACTION_COUNT}. nixos-rebuild switch --flake $NIXOS_FLAKE#$NIXOS_HOST"
else
  echo "  ${ACTION_COUNT}. nixos-rebuild switch (traditional mode, no --flake)"
fi
ACTION_COUNT=$((ACTION_COUNT + 1))
echo "  ${ACTION_COUNT}. Verify weaver.service is running"

echo ""

# =============================================================================
# PHASE 4: CONFIRM
# =============================================================================

if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  Dry run — no changes were made${NC}"
  echo -e "${YELLOW}  Run without --dry-run to execute the above steps${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
  exit 0
fi

read -rp "  Proceed with install? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo ""
  echo "  Cancelled. No changes made."
  echo ""
  exit 0
fi

echo ""

# =============================================================================
# PHASE 5: EXECUTE
# =============================================================================

# ── flake.nix: add input + modules entry ──────────────────────────────────
if [[ "$MODE" == "flake" ]]; then
  if [[ "$HAS_INPUT" == "false" ]]; then
    step "Adding weaver input to $FLAKE_NIX"
    python3 - "$FLAKE_NIX" "$WEAVER_SRC" <<'PYEOF'
import sys, re
flake_nix, weaver_src = sys.argv[1], sys.argv[2]
with open(flake_nix) as f:
    content = f.read()

insertion = f'''
    # Weaver
    weaver.url = "path:{weaver_src}";
    weaver.inputs.nixpkgs.follows = "nixpkgs";
'''

m = re.search(r'(inputs\s*=\s*\{)(.*?)(\n\s*\};)', content, re.DOTALL)
if not m:
    print("ERROR: Could not find inputs block in flake.nix", file=sys.stderr)
    sys.exit(1)
new_content = content[:m.end(2)] + insertion + content[m.end(2):]
with open(flake_nix, 'w') as f:
    f.write(new_content)
PYEOF
    ok "weaver input added"
  fi

  if [[ "$HAS_MODULE" == "false" ]]; then
    step "Adding weaver.nixosModules.default to modules list"
    python3 - "$FLAKE_NIX" <<'PYEOF'
import sys, re
flake_nix = sys.argv[1]
with open(flake_nix) as f:
    content = f.read()

# Add 'weaver' to outputs function params if not already there
outputs_match = re.search(r'(outputs\s*=\s*\{)([^}]*)(\})', content)
if outputs_match:
    params = outputs_match.group(2)
    if 'weaver' not in params:
        if '...' in params:
            new_params = params.replace('...', 'weaver, ...', 1)
        else:
            new_params = params.rstrip() + ', weaver '
        content = content[:outputs_match.start(2)] + new_params + content[outputs_match.end(2):]

# Find modules = [ ... ] and insert weaver.nixosModules.default before closing ]
modules_match = re.search(r'(modules\s*=\s*\[)(.*?)(\n\s*\])', content, re.DOTALL)
if not modules_match:
    print("ERROR: Could not find modules list in flake.nix", file=sys.stderr)
    sys.exit(1)

insertion = '\n        weaver.nixosModules.default'
new_content = content[:modules_match.end(2)] + insertion + content[modules_match.end(2):]

with open(flake_nix, 'w') as f:
    f.write(new_content)
PYEOF
    ok "weaver.nixosModules.default added"
  fi
fi

# ── configuration.nix: add import (traditional mode only) ─────────────────
if [[ "$MODE" == "traditional" && "$HAS_IMPORT" == "false" ]]; then
  step "Adding weaver import to $CONFIG_NIX"
  python3 - "$CONFIG_NIX" "$WEAVER_SRC" <<'PYEOF'
import sys, re
config_nix, weaver_src = sys.argv[1], sys.argv[2]
with open(config_nix) as f:
    content = f.read()

weaver_import = f'{weaver_src}/nixos/default.nix'

# Look for an existing imports = [ ... ] list; insert our path before the closing ]
m = re.search(r'(imports\s*=\s*\[)(.*?)(\n?\s*\])', content, re.DOTALL)
if m:
    insertion = f'\n    {weaver_import}'
    new_content = content[:m.end(2)] + insertion + content[m.end(2):]
else:
    # No imports list — add one near the top of the config body
    body_match = re.search(r'(\{\s*\n)', content)
    if not body_match:
        print("ERROR: Could not find configuration body in configuration.nix", file=sys.stderr)
        sys.exit(1)
    insertion = f'\n  imports = [\n    {weaver_import}\n  ];\n'
    new_content = content[:body_match.end()] + insertion + content[body_match.end():]

with open(config_nix, 'w') as f:
    f.write(new_content)
PYEOF
  ok "weaver import added"
fi

# ── configuration.nix: enable service ─────────────────────────────────────
if [[ "$HAS_ENABLE" == "false" ]]; then
  step "Enabling services.weaver in $CONFIG_NIX"
  python3 - "$CONFIG_NIX" <<'PYEOF'
import sys, re
config_nix = sys.argv[1]
with open(config_nix) as f:
    content = f.read()

insertion = '\n  # Weaver\n  services.weaver.enable = true;\n'

# Insert before the first "imports = [" line if present
m = re.search(r'\n(\s*imports\s*=\s*\[)', content)
if m:
    new_content = content[:m.start()] + insertion + content[m.start():]
else:
    # Fall back: insert after the opening { of the main body
    m = re.search(r'(\{[^}]*?\n)\s*([a-zA-Z])', content)
    if m:
        new_content = content[:m.end(1)] + insertion + '\n' + content[m.end(1):]
    else:
        print("ERROR: Could not find a place to insert services.weaver in configuration.nix", file=sys.stderr)
        sys.exit(1)

with open(config_nix, 'w') as f:
    f.write(new_content)
PYEOF
  ok "services.weaver.enable = true; added"
fi

# ── License key handling ──────────────────────────────────────────────────
if [[ -n "$LICENSE_KEY" ]]; then
  step "Writing license key"
  mkdir -p /var/lib/weaver
  echo "$LICENSE_KEY" > /var/lib/weaver/license.key
  chmod 600 /var/lib/weaver/license.key
  ok "License key written to /var/lib/weaver/license.key"

  step "Adding licenseKeyFile to configuration.nix"
  sed -i '/services\.weaver\.enable = true;/a\  services.weaver.licenseKeyFile = "/var/lib/weaver/license.key";' "$CONFIG_NIX"
  ok "licenseKeyFile added"
elif [[ -n "$LICENSE_FILE" ]]; then
  step "Adding licenseKeyFile to configuration.nix"
  sed -i "/services\.weaver\.enable = true;/a\  services.weaver.licenseKeyFile = \"$LICENSE_FILE\";" "$CONFIG_NIX"
  ok "licenseKeyFile added"
fi

# ── Stage changes in git (flake mode only — flakes require it) ───────────
if [[ "$MODE" == "flake" && -d "$NIXOS_REAL/.git" ]]; then
  step "Staging NixOS config changes in git"
  git -C "$NIXOS_REAL" add -A
  ok "Changes staged"
fi

# ── Rebuild ───────────────────────────────────────────────────────────────
step "Running nixos-rebuild switch"
if [[ "$MODE" == "flake" ]]; then
  REBUILD_CMD=(nixos-rebuild switch --flake "$NIXOS_FLAKE#$NIXOS_HOST")
else
  REBUILD_CMD=(nixos-rebuild switch)
fi

if "${REBUILD_CMD[@]}"; then
  ok "NixOS rebuilt successfully"
else
  fail "Rebuild failed"
  echo ""
  echo "  The config changes were made but the rebuild failed."
  echo "  Check the errors above, fix the issue, then run:"
  echo "    sudo ${REBUILD_CMD[*]}"
  echo ""
  exit 1
fi

# =============================================================================
# PHASE 6: VERIFY
# =============================================================================

echo ""
step "Verifying install"
VERIFY_PASSED=true

sleep 2

if systemctl is-active --quiet weaver 2>/dev/null; then
  ok "weaver.service is running"
else
  fail "weaver.service is not running"
  echo "  Check: journalctl -u weaver --no-pager -n 30"
  VERIFY_PASSED=false
fi

# ── Final result ──────────────────────────────────────────────────────────
echo ""
if [[ "$VERIFY_PASSED" == "true" ]]; then
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Weaver installed successfully${NC}"
  echo -e "${GREEN}  Visit http://localhost:3100 → first-time admin setup${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
else
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}  Install completed but verification failed${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
fi
echo ""

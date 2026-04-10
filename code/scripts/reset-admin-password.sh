#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# =============================================================================
# Reset Admin Password — emergency password recovery for locked-out admins
# =============================================================================
# Directly updates the password hash in the users.json store. Requires root
# access on the host — root on the box IS the authority.
#
# Usage:
#   sudo ./scripts/reset-admin-password.sh                    # interactive prompt
#   sudo ./scripts/reset-admin-password.sh <username>          # prompt for password
#   sudo ./scripts/reset-admin-password.sh <username> <pass>   # non-interactive
#
# After reset, all existing sessions for the user are invalidated (the old
# tokens reference a stale password hash). The user must log in again.
# =============================================================================

set -euo pipefail

if [[ $(id -u) -ne 0 ]]; then
  echo "ERROR: This script must be run as root (sudo)."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DATA_DIR="/var/lib/weaver"
USERS_FILE="$DATA_DIR/users.json"
LOCKOUT_FILE="$DATA_DIR/lockout.json"
BACKEND_NODE_MODULES="$REPO_ROOT/backend/node_modules"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Validate prerequisites ────────────────────────────────────────────────────

if [[ ! -f "$USERS_FILE" ]]; then
  echo -e "${RED}ERROR: $USERS_FILE not found.${NC}"
  echo "  Has the service been started at least once? Run nix-fresh-install.sh first."
  exit 1
fi

if [[ ! -d "$BACKEND_NODE_MODULES/bcryptjs" ]]; then
  echo -e "${RED}ERROR: bcryptjs not found in $BACKEND_NODE_MODULES${NC}"
  echo "  Run 'cd backend && npm install' first."
  exit 1
fi

# ── Collect username ──────────────────────────────────────────────────────────

USERNAME="${1:-}"
if [[ -z "$USERNAME" ]]; then
  # List available users
  echo -e "${CYAN}Available users:${NC}"
  node -e "
    const users = JSON.parse(require('fs').readFileSync('$USERS_FILE', 'utf-8'));
    for (const u of Object.values(users)) {
      console.log('  ' + u.username + ' (' + u.role + ')');
    }
  "
  echo ""
  read -rp "Username to reset: " USERNAME
  if [[ -z "$USERNAME" ]]; then
    echo "ERROR: No username provided."
    exit 1
  fi
fi

# ── Collect new password ──────────────────────────────────────────────────────

NEW_PASSWORD="${2:-}"
if [[ -z "$NEW_PASSWORD" ]]; then
  read -srp "New password: " NEW_PASSWORD
  echo ""
  if [[ -z "$NEW_PASSWORD" ]]; then
    echo "ERROR: No password provided."
    exit 1
  fi
  read -srp "Confirm password: " CONFIRM_PASSWORD
  echo ""
  if [[ "$NEW_PASSWORD" != "$CONFIRM_PASSWORD" ]]; then
    echo -e "${RED}ERROR: Passwords do not match.${NC}"
    exit 1
  fi
fi

if [[ ${#NEW_PASSWORD} -lt 8 ]]; then
  echo -e "${RED}ERROR: Password must be at least 8 characters.${NC}"
  exit 1
fi

# ── Reset password ────────────────────────────────────────────────────────────

echo -e "${CYAN}▶ Resetting password for '$USERNAME'...${NC}"

# Pass password via env var to avoid shell escaping issues
export NEW_PASSWORD
RESULT=$(NODE_PATH="$BACKEND_NODE_MODULES" node -e "
  const fs = require('fs');
  const bcrypt = require('bcryptjs');

  const usersFile = '$USERS_FILE';
  const username = '$USERNAME';
  const newPassword = process.env.NEW_PASSWORD;

  const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));

  const entry = Object.entries(users).find(([, u]) => u.username === username);
  if (!entry) {
    console.log('USER_NOT_FOUND');
    process.exit(0);
  }

  const [id] = entry;
  const hash = bcrypt.hashSync(newPassword, 13);
  users[id].passwordHash = hash;

  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf-8');
  console.log('OK');
" 2>&1)
unset NEW_PASSWORD

if [[ "$RESULT" == "USER_NOT_FOUND" ]]; then
  echo -e "${RED}ERROR: User '$USERNAME' not found in $USERS_FILE${NC}"
  exit 1
fi

if [[ "$RESULT" != "OK" ]]; then
  echo -e "${RED}ERROR: Password reset failed:${NC}"
  echo "$RESULT"
  exit 1
fi

echo -e "${GREEN}✓ Password updated for '$USERNAME'${NC}"

# ── Clear lockout state ───────────────────────────────────────────────────────

if [[ -f "$LOCKOUT_FILE" ]]; then
  echo -e "${CYAN}▶ Clearing lockout state...${NC}"
  rm -f "$LOCKOUT_FILE"
  echo -e "${GREEN}✓ Lockout state cleared${NC}"
fi

# ── Fix ownership (root wrote the file) ──────────────────────────────────────

chown weaver:weaver "$USERS_FILE"

# ── Signal running service to reload users from disk ─────────────────────────

if systemctl is-active --quiet weaver.service 2>/dev/null; then
  echo -e "${CYAN}▶ Signaling service to reload user data...${NC}"
  systemctl kill --signal=HUP weaver.service
  echo -e "${GREEN}✓ Service reloaded — new password is active immediately${NC}"
else
  echo -e "${CYAN}ℹ Service not running — new password will take effect on next start${NC}"
fi

echo ""
echo -e "${GREEN}Password reset complete. Log in at http://localhost:3100${NC}"
echo ""

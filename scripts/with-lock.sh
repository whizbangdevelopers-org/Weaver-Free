#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# =============================================================================
# Resource Lock Wrapper — serialize access to shared resources
# =============================================================================
# Acquires an exclusive file lock before running a command. If another process
# holds the lock, waits (queues) until it's released. Prevents simultaneous
# execution of dev servers, E2E tests, or builds — critical for CI
# where multiple agents may invoke the same scripts in parallel.
#
# Usage:  ./scripts/with-lock.sh <lock-name> <command...>
#         ./scripts/with-lock.sh dev npm run dev:backend
#         ./scripts/with-lock.sh e2e scripts/nix-fresh-test.sh
#         ./scripts/with-lock.sh build npm run build:all
#
# Lock files live in /tmp/mvd-<lock-name>.lock and auto-release when the
# process exits (kernel-managed via flock, no stale locks possible).
# =============================================================================

set -euo pipefail

YELLOW='\033[1;33m'
NC='\033[0m'

if [ $# -lt 2 ]; then
    echo "Usage: $0 <lock-name> <command...>" >&2
    exit 2
fi

LOCK_NAME="$1"; shift
LOCK_FILE="/tmp/mvd-${LOCK_NAME}.lock"

# Check if lock is already held — if so, inform the user they're queuing
if ! flock --nonblock "$LOCK_FILE" true 2>/dev/null; then
    echo -e "${YELLOW}Waiting for lock: ${LOCK_NAME} (another process holds it)${NC}" >&2
fi

exec flock "$LOCK_FILE" "$@"

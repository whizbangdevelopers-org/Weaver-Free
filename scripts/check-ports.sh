#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# =============================================================================
# Pre-flight Port Check — verify ports are free before starting dev servers
# =============================================================================
# Checks that the specified ports are available. Exits 1 with diagnostic output
# (PID, process name, command) if any port is occupied. Designed to be chained
# with && before dev server commands in npm scripts.
#
# Usage:  ./scripts/check-ports.sh 9010 3110
#         ./scripts/check-ports.sh 3130
#
# Exit codes:
#   0 — All ports free
#   1 — One or more ports occupied (details printed to stderr)
#   2 — Usage error (no ports specified)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ $# -eq 0 ]; then
    echo -e "${RED}Usage: $0 PORT [PORT ...]${NC}" >&2
    echo "  Example: $0 9010 3110" >&2
    exit 2
fi

blocked=0

for port in "$@"; do
    pids=$(lsof -ti ":$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        blocked=1
        echo -e "${RED}Port $port is in use:${NC}" >&2
        for pid in $pids; do
            proc_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            proc_cmd=$(ps -p "$pid" -o args= 2>/dev/null || echo "unknown")
            echo -e "  ${YELLOW}PID $pid${NC} — $proc_name" >&2
            echo -e "    cmd: $proc_cmd" >&2
        done
    fi
done

if [ "$blocked" -eq 1 ]; then
    echo "" >&2
    echo -e "${RED}Kill conflicting processes or use different ports.${NC}" >&2
    echo "  Quick fix: lsof -ti :PORT | xargs kill" >&2
    exit 1
fi

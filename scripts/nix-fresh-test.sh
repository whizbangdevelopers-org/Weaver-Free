#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# =============================================================================
# Live E2E Test — fresh backend on port 3130 with Playwright
# =============================================================================
# Builds frontend+backend, starts a clean backend instance on port 3130
# (isolated from dev:3110, Docker E2E:3120, NixOS prod:3100), runs Playwright,
# then tears down. Designed for agents and CI — no interactive prompts.
#
# Usage:  ./scripts/nix-fresh-test.sh              # build + test
#         ./scripts/nix-fresh-test.sh --skip-build  # reuse existing build
#         ./scripts/nix-fresh-test.sh --tier free    # free-tier license mode
#
# Port: 3130 (dedicated live E2E slot)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Config ────────────────────────────────────────────────────────────────────
LIVE_E2E_PORT=3130
DATA_DIR="$PROJECT_ROOT/backend/data-live-e2e"
STATIC_DIR="$PROJECT_ROOT/dist/spa"
BACKEND_ENTRY="$PROJECT_ROOT/backend/dist/index.js"
OUTPUT_DIR="$PROJECT_ROOT/testing/live-e2e-output"
PID_FILE="$PROJECT_ROOT/.live-e2e-backend.pid"
LOG_FILE="$PROJECT_ROOT/.live-e2e-backend.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

step() { echo -e "${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
die()  { echo -e "${RED}✗ $1${NC}" >&2; exit 1; }

# ── Parse args ────────────────────────────────────────────────────────────────
SKIP_BUILD=false
TIER="weaver"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-build) SKIP_BUILD=true; shift ;;
        --tier)       TIER="$2"; shift 2 ;;
        --help|-h)
            echo "Usage: $0 [--skip-build] [--tier free|weaver|fabrick]"
            echo ""
            echo "  --skip-build   Reuse existing frontend+backend builds"
            echo "  --tier TIER    Set license tier (default: weaver)"
            exit 0
            ;;
        *) die "Unknown option: $1" ;;
    esac
done

# ── Cleanup trap ──────────────────────────────────────────────────────────────
cleanup() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            wait "$pid" 2>/dev/null || true
        fi
        rm -f "$PID_FILE"
    fi
    rm -f "$LOG_FILE"
}
trap cleanup EXIT INT TERM

cd "$PROJECT_ROOT"

# ── 0. Check for stale process on our port ────────────────────────────────────
if lsof -ti ":$LIVE_E2E_PORT" >/dev/null 2>&1; then
    existing_pids=$(lsof -ti ":$LIVE_E2E_PORT")
    die "Port $LIVE_E2E_PORT already in use (PIDs: $existing_pids). Kill them first or check for a stale live-e2e run."
fi

# ── 1. Build ──────────────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" = true ]; then
    step "Skipping build (--skip-build)"
    [ -d "$STATIC_DIR" ] || die "No frontend build at $STATIC_DIR — run without --skip-build"
    [ -f "$BACKEND_ENTRY" ] || die "No backend build at $BACKEND_ENTRY — run without --skip-build"
    ok "Using existing builds"
else
    step "Building frontend"
    npm run build:spa 2>&1 | tail -3
    ok "Frontend built → $STATIC_DIR"

    step "Building backend"
    npm run build:backend 2>&1 | tail -3
    ok "Backend built → backend/dist/"
fi

# ── 2. Reset test data ───────────────────────────────────────────────────────
step "Resetting live E2E data directory"
rm -rf "$DATA_DIR"
mkdir -p "$DATA_DIR"

# Copy seed files if they exist
if [ -f "$PROJECT_ROOT/backend/data/distro-catalog.json" ]; then
    cp "$PROJECT_ROOT/backend/data/distro-catalog.json" "$DATA_DIR/"
fi

# Generate JWT secret for this test run
openssl rand -base64 32 > "$DATA_DIR/.jwt-secret"
ok "Test data directory ready: $DATA_DIR"

# ── 3. Resolve tier env vars ─────────────────────────────────────────────────
TIER_ENV=""
case "$TIER" in
    free)
        TIER_ENV="PREMIUM_ENABLED=false"
        ;;
    weaver|premium)
        TIER_ENV="PREMIUM_ENABLED=true"
        ;;
    fabrick|enterprise)
        TIER_ENV="PREMIUM_ENABLED=true ENTERPRISE_ENABLED=true"
        ;;
    *)
        die "Unknown tier: $TIER (expected free|weaver|fabrick)"
        ;;
esac

# ── 4. Start backend on port 3130 ────────────────────────────────────────────
step "Starting backend on port $LIVE_E2E_PORT ($TIER tier)"

env \
    NODE_ENV=test \
    SEED_SAMPLE_VMS=true \
    PORT=$LIVE_E2E_PORT \
    STATIC_DIR="$STATIC_DIR" \
    VM_DATA_DIR="$DATA_DIR" \
    JWT_SECRET_FILE="$DATA_DIR/.jwt-secret" \
    DISABLE_RATE_LIMIT=true \
    $TIER_ENV \
    node "$BACKEND_ENTRY" > "$LOG_FILE" 2>&1 &

BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_FILE"

# Wait for health endpoint
RETRIES=30
for i in $(seq 1 $RETRIES); do
    if curl -sf "http://localhost:$LIVE_E2E_PORT/api/health" >/dev/null 2>&1; then
        ok "Backend healthy on port $LIVE_E2E_PORT (PID $BACKEND_PID)"
        break
    fi
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo ""
        echo "Backend log:"
        cat "$LOG_FILE"
        die "Backend crashed during startup"
    fi
    if [ "$i" -eq "$RETRIES" ]; then
        echo ""
        echo "Backend log:"
        cat "$LOG_FILE"
        die "Backend failed to become healthy after ${RETRIES}s"
    fi
    sleep 1
done

# ── 5. Run Playwright ────────────────────────────────────────────────────────
step "Running Playwright against http://localhost:$LIVE_E2E_PORT"

# Clean output directory (avoids stale/root-owned files from Docker runs)
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

E2E_EXIT=0
E2E_DEV_PORT=$LIVE_E2E_PORT \
E2E_API_PORT=$LIVE_E2E_PORT \
PLAYWRIGHT_OUTPUT_DIR="$OUTPUT_DIR" \
npx playwright test \
    --config="$PROJECT_ROOT/playwright.config.ts" \
    "$@" || E2E_EXIT=$?

# ── 6. Results ────────────────────────────────────────────────────────────────
echo ""
if [ "$E2E_EXIT" -eq 0 ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Live E2E: ALL TESTS PASSED ($TIER tier on port $LIVE_E2E_PORT)${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
else
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  Live E2E: TESTS FAILED (exit $E2E_EXIT)${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "  Backend log: $LOG_FILE"
fi

exit "$E2E_EXIT"

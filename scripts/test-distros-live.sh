#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# =============================================================================
# Distro Catalog Live Test — step 5 of the release checklist
# =============================================================================
# Runs the full distro catalog smoke test against a provisioning-enabled
# backend.
#
# RUNS ON lab1, NOT king (changed 2026-08-09).
# ---------------------------------------------
# lab1 (192.168.0.32) is the fleet's test-substrate: a microvm.host box whose whole purpose is
# provisioning real VMs, and already the deployed-artifact gate for step 5a (WVR-186, validated
# 2026-06-15). king is the CONTROL PLANE — provisioning throwaway CirrOS VMs on the box that runs
# the fleet's tooling puts test workloads on the wrong side of the blast radius, and it made
# step 5 and step 5a disagree about which host represents "a real Weaver host".
#
# This script starts a LOCAL backend and inspects the LOCAL bridge, so it must execute ON lab1 —
# it cannot be pointed at lab1 from king. lab1 is power-down-when-idle by design, so it is
# usually asleep; that is not a fault. Wake it first and block until ready:
#
#   king$  /home/mark/Projects/active/anvil/scripts/fleet-wake.sh lab1
#
# fleet-wake reads lab1's MAC and readiness probe from anvil's hosts/inventory.yaml and does not
# return until the host actually answers. Full prep: code/.claude/agents/distro-catalog-tester.md.
#
# Steps automated:
#   1. Pre-flight: verify br-microvm bridge is up
#   2. Start dev:provision backend on port 3110 (if not already running)
#   3. Wait for backend to be healthy
#   4. Dry-run readiness check (provisioning enabled, binaries present)
#   5. CirrOS smoke test (download → provision → boot → running → cleanup)
#
# Usage:
#   ./scripts/test-distros-live.sh              # CirrOS only (default, ~5 min)
#   ./scripts/test-distros-live.sh --all        # Full catalog (longer)
#   ./scripts/test-distros-live.sh --no-cleanup # Keep VMs after test
#
# Exit codes:
#   0 — all smoke tests passed
#   1 — pre-flight failed or smoke test failed
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT=3110
BACKEND="http://localhost:${PORT}"
BACKEND_PID=""
WITH_CLEANUP="--with-cleanup"
EXTRA_FLAGS=()

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

step() { echo -e "\n${BOLD}── $1${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC}  $1"; }
fail() { echo -e "  ${RED}✗${NC}  $1" >&2; }
warn() { echo -e "  ${YELLOW}!${NC}  $1"; }

cleanup_backend() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    warn "Stopping dev:provision backend (PID $BACKEND_PID)..."
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup_backend EXIT

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --all)        EXTRA_FLAGS+=("--all") ;;
    --no-cleanup) WITH_CLEANUP="" ;;
    --distros)    shift; EXTRA_FLAGS+=("--distros" "$1") ;;
    *)            EXTRA_FLAGS+=("$arg") ;;
  esac
done

# ── Step 1: Pre-flight ────────────────────────────────────────────────────────
step "1/5  Pre-flight checks"

# Refuse on king FIRST, before any capability probe.
#
# Ordering is the whole point. Behind the br-microvm check this would be dead code — king has no
# such bridge, so that check already catches today's mistake and the hostname guard could only
# ever fire in a hypothetical future where king grew one. A guard that cannot fire is not a
# guard. Placed first, it fires on king now, states the actual reason (control plane, wrong blast
# radius) instead of the incidental one (no bridge), and keeps doing so if king's config changes.
if [[ "$(hostname)" == "king" ]]; then
  fail "refusing to run on king — step 5 moved to lab1 on 2026-08-09"
  echo "  king is the control plane; provisioning throwaway VMs here is the wrong blast radius." >&2
  echo "  Run it on lab1 (192.168.0.32), which is already the step-5a gate host:" >&2
  echo "    /home/mark/Projects/active/anvil/scripts/fleet-wake.sh lab1   # blocks until ready" >&2
  echo "    ssh root@192.168.0.32" >&2
  echo "  Full prep: code/.claude/agents/distro-catalog-tester.md" >&2
  exit 1
fi

if ! ip link show br-microvm &>/dev/null; then
  fail "br-microvm bridge not found — this must run ON lab1 (the test substrate)"
  echo "  Its absence means this host is not running Weaver's NixOS module." >&2
  echo "  Full prep: code/.claude/agents/distro-catalog-tester.md" >&2
  exit 1
fi
ok "br-microvm bridge is UP"

if ! command -v qemu-system-x86_64 &>/dev/null; then
  fail "qemu-system-x86_64 not in PATH — NixOS environment required"
  exit 1
fi
ok "QEMU binary present"

if [[ -r /dev/kvm && -w /dev/kvm ]]; then
  ok "/dev/kvm accessible — KVM acceleration available"
else
  VIRT_TYPE=$(systemd-detect-virt 2>/dev/null | head -1 | tr -d '[:space:]' || echo "none")
  if [[ "$VIRT_TYPE" != "none" && -n "$VIRT_TYPE" ]]; then
    fail "Running inside $VIRT_TYPE but /dev/kvm is not accessible — nested virtualization not enabled"
    echo "  KVM host (Intel, one-time):  echo 1 | sudo tee /sys/module/kvm_intel/parameters/nested"
    echo "  KVM host (AMD, one-time):    echo 1 | sudo tee /sys/module/kvm_amd/parameters/nested"
    echo "  Permanently (NixOS host) — add both:"
    echo "    boot.extraModprobeConfig = \"options kvm_intel nested=1\";  # or kvm_amd"
    echo "    hardware.cpu.intel.updateMicrocode = true;  # Intel"
    echo "    hardware.cpu.amd.updateMicrocode = true;    # AMD (use whichever matches your host CPU)"
  else
    fail "/dev/kvm not accessible — KVM required for CirrOS provisioning (TCG fallback too slow)"
  fi
  exit 1
fi

# ── Step 2: Start backend (if not already on 3110) ───────────────────────────
step "2/5  Backend"

if lsof -ti ":${PORT}" &>/dev/null; then
  warn "Port ${PORT} already in use — killing existing process to ensure fresh DB with known credentials..."
  kill "$(lsof -ti ":${PORT}")" 2>/dev/null || true
  sleep 2
fi
if true; then
  warn "Port ${PORT} free — starting dev:provision backend..."
  # Use a temp data dir so we always get a fresh DB with known credentials.
  # The persistent ./data dir may have a user from a prior run whose password
  # we don't know; a fresh dir lets autoLogin() register admin on first boot.
  TEMP_DATA_DIR=$(mktemp -d)
  cd "$CODE_DIR"
  BRIDGE_GATEWAY=10.10.0.1 \
  PREMIUM_ENABLED=true \
  PROVISIONING_ENABLED=true \
  MICROVMS_DIR=backend/data/microvms \
  VM_DATA_DIR="$TEMP_DATA_DIR" \
    npm -w backend run dev -- --port "${PORT}" &>"${CODE_DIR}/reports/distro-catalog/backend.log" &
  BACKEND_PID=$!
  ok "Backend started (PID ${BACKEND_PID}), data: ${TEMP_DATA_DIR}, log: reports/distro-catalog/backend.log"
fi

# ── Step 3: Wait for health ───────────────────────────────────────────────────
step "3/5  Waiting for backend health"

ATTEMPTS=0
MAX=30
until curl -sf "${BACKEND}/api/health" &>/dev/null; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX" ]; then
    fail "Backend did not become healthy after ${MAX}s"
    [ -n "$BACKEND_PID" ] && echo "  Backend log:" && tail -20 "${CODE_DIR}/reports/distro-catalog/backend.log" >&2
    exit 1
  fi
  sleep 1
done
ok "Backend healthy at ${BACKEND}"

# ── Step 4: Dry-run readiness check ──────────────────────────────────────────
step "4/5  Readiness check (dry-run)"

cd "$CODE_DIR"
# Dry-run exits 1 when any URL check fails (advisory, not a blocker for the smoke test).
# Capture output unconditionally; critical-failure checks below handle real blockers.
DRY_OUT=$(npm run test:distros:dry -- --backend "$BACKEND" 2>&1) || true
echo "$DRY_OUT" | grep -E "Backend up|Provisioning|Bridge gateway|Tier|Distros|OK|MISS|FAIL" | sed 's/^/  /'

if echo "$DRY_OUT" | grep -q "Provisioning: DISABLED"; then
  fail "Provisioning is disabled on the backend — check PROVISIONING_ENABLED"
  exit 1
fi
if echo "$DRY_OUT" | grep -q "Backend up: NO"; then
  fail "Backend not responding at ${BACKEND}"
  exit 1
fi
ok "Readiness check passed"

# ── Step 5: Smoke test ────────────────────────────────────────────────────────
step "5/5  CirrOS smoke test"

DISTROS_FLAGS=(--backend "$BACKEND" ${WITH_CLEANUP:+$WITH_CLEANUP} "${EXTRA_FLAGS[@]}")
npm run test:distros -- "${DISTROS_FLAGS[@]}"

echo -e "\n${GREEN}${BOLD}Distro catalog smoke test complete.${NC}"

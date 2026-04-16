#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# Capture marketing screenshots from both standard and demo E2E environments.
#
# This script:
#   1. Runs standard-mode screenshots via Docker E2E (backend + frontend)
#   2. Builds demo SPA, serves it locally, captures demo-mode screenshots
#   3. Copies all screenshots to docs/designs/
#
# Usage: ./scripts/capture-screenshots.sh
# Prerequisites: Docker, npm dependencies installed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
E2E_DIR="$PROJECT_DIR/testing/e2e-docker"
OUTPUT_DIR="$E2E_DIR/output/screenshots"
DESIGNS_DIR="$PROJECT_DIR/docs/designs"

echo "========================================"
echo "  Weaver Screenshot Capture"
echo "========================================"
echo ""

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# ── Phase 1: Standard Mode (Docker E2E) ─────────────────────────────────────

echo "Phase 1: Standard mode screenshots (Docker E2E)..."
echo ""

cd "$E2E_DIR"
./scripts/run-single.sh testing/e2e/screenshots.spec.ts || {
  echo "WARNING: Standard mode screenshots had failures (continuing anyway)"
}

STANDARD_COUNT=$(find "$OUTPUT_DIR" -name '*.png' -type f 2>/dev/null | wc -l)
echo ""
echo "Standard mode captured: $STANDARD_COUNT screenshots"
echo ""

# ── Phase 2: Demo Mode (Static SPA) ─────────────────────────────────────────

echo "Phase 2: Demo mode screenshots..."
echo ""

cd "$PROJECT_DIR"

# Build demo SPA
echo "Building demo SPA..."
VITE_DEMO_MODE=true npx quasar build -m spa 2>&1 | tail -5

if [ ! -f "dist/spa/index.html" ]; then
  echo "ERROR: Demo SPA build failed (dist/spa/index.html not found)"
  exit 1
fi

# Start static server on port 9030
echo "Starting static server on port 9030..."
npx serve dist/spa -l 9030 &
SERVE_PID=$!

# Cleanup on exit
cleanup_serve() {
  echo "Stopping static server..."
  kill $SERVE_PID 2>/dev/null || true
}
trap cleanup_serve EXIT

# Wait for server to be ready
ATTEMPT=0
while [ $ATTEMPT -lt 15 ]; do
  if curl -sf http://localhost:9030 > /dev/null 2>&1; then
    echo "Static server ready!"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  sleep 1
done

if [ $ATTEMPT -eq 15 ]; then
  echo "ERROR: Static server failed to start"
  exit 1
fi

# Run demo screenshots (directly with Playwright, not Docker — demo SPA is local)
echo "Capturing demo screenshots..."
npx playwright test testing/e2e/demo-screenshots.spec.ts --workers=1 || {
  echo "WARNING: Demo mode screenshots had failures (continuing anyway)"
}

# Stop the static server
kill $SERVE_PID 2>/dev/null || true
trap - EXIT

TOTAL_COUNT=$(find "$OUTPUT_DIR" -name '*.png' -type f 2>/dev/null | wc -l)
echo ""
echo "Total screenshots captured: $TOTAL_COUNT"

# ── Phase 3: Copy to docs/designs/ ──────────────────────────────────────────

echo ""
echo "Phase 3: Copying to docs/designs/..."

if [ "$TOTAL_COUNT" -eq 0 ]; then
  echo "ERROR: No screenshots captured. Check test output above."
  exit 1
fi

for f in "$OUTPUT_DIR"/*.png; do
  base=$(basename "$f")
  echo "  $base ($(du -h "$f" | cut -f1))"
  cp "$f" "$DESIGNS_DIR/$base"
done

echo ""
echo "========================================"
echo "  Screenshot capture complete!"
echo "  Files in: $DESIGNS_DIR/"
echo "========================================"
echo ""
ls -la "$DESIGNS_DIR"/*.png 2>/dev/null || echo "(no PNGs found)"

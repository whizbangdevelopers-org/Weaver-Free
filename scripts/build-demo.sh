#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# Build the Weaver in demo mode for GitHub Pages deployment.
#
# Usage:
#   ./scripts/build-demo.sh              # Private demo (full tier-switcher)
#   ./scripts/build-demo.sh --public     # Public demo (curated Free + teasers)
#
# Optional: VITE_HCAPTCHA_SITEKEY=<key> ./scripts/build-demo.sh
set -euo pipefail

VARIANT="private"
if [[ "${1:-}" == "--public" ]]; then
  VARIANT="public"
fi

echo "Building Weaver demo site (${VARIANT})..."

export VITE_DEMO_MODE=true
export NODE_ENV=production

if [[ "$VARIANT" == "public" ]]; then
  export VITE_DEMO_PUBLIC=true
fi

# Build static SPA (no backend needed for demo)
npx quasar build -m spa

# GitHub Pages compatibility
touch dist/spa/.nojekyll

# Copy demo README if it exists
if [ -f demo/DEMO-README.md ]; then
  cp demo/DEMO-README.md dist/spa/README.md
fi

echo ""
echo "Demo build complete (${VARIANT}): dist/spa/"
echo "Deploy to GitHub Pages or serve with: npx serve dist/spa"

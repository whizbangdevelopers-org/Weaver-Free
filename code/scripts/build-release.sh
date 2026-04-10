#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
set -euo pipefail

# Build a self-contained release artifact for weaver.
# Produces: release/weaver/ — a single directory with everything
# needed to run the dashboard (backend, frontend SPA, node_modules, launcher).
#
# Usage:
#   ./scripts/build-release.sh
#   # Result: release/weaver/
#   # Run:    release/weaver/bin/weaver

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASE_DIR="$ROOT_DIR/release/weaver"

echo "==> Building weaver release artifact"
echo "    Root: $ROOT_DIR"
echo "    Output: $RELEASE_DIR"

# Clean previous release
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"/{bin,lib/backend,lib/frontend,lib/backend/data}

# --- Backend ---
echo "==> Building backend..."
(cd "$ROOT_DIR/backend" && npm run build)

cp -r "$ROOT_DIR/backend/dist/"* "$RELEASE_DIR/lib/backend/"
cp "$ROOT_DIR/backend/package.json" "$RELEASE_DIR/lib/backend/"
cp "$ROOT_DIR/backend/package-lock.json" "$RELEASE_DIR/lib/backend/" 2>/dev/null || true

# Shipped data files
if [ -f "$ROOT_DIR/backend/data/distro-catalog.json" ]; then
  cp "$ROOT_DIR/backend/data/distro-catalog.json" "$RELEASE_DIR/lib/backend/data/"
fi

# Production-only node_modules (no devDependencies)
echo "==> Installing production dependencies..."
(cd "$RELEASE_DIR/lib/backend" && npm install --omit=dev --ignore-scripts 2>/dev/null)

# --- Frontend ---
echo "==> Building frontend SPA..."
(cd "$ROOT_DIR" && npx quasar build)

cp -r "$ROOT_DIR/dist/spa/"* "$RELEASE_DIR/lib/frontend/"

# --- Launcher script ---
cat > "$RELEASE_DIR/bin/weaver" << 'LAUNCHER'
#!/usr/bin/env bash
set -euo pipefail
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$SELF_DIR/../lib"

export STATIC_DIR="${STATIC_DIR:-$LIB_DIR/frontend}"
exec node "$LIB_DIR/backend/index.js" "$@"
LAUNCHER
chmod +x "$RELEASE_DIR/bin/weaver"

# --- Version info ---
VERSION=$(node -p "require('$ROOT_DIR/package.json').version")
echo "$VERSION" > "$RELEASE_DIR/VERSION"

# --- Summary ---
echo ""
echo "==> Release artifact built successfully"
echo "    Version: $VERSION"
echo "    Location: $RELEASE_DIR"
echo "    Size: $(du -sh "$RELEASE_DIR" | cut -f1)"
echo ""
echo "    To run:"
echo "      $RELEASE_DIR/bin/weaver"
echo ""
echo "    To create a tarball:"
echo "      tar -czf weaver-${VERSION}.tar.gz -C release weaver"

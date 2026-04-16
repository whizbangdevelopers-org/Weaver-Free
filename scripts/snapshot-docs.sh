#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
#
# Snapshot Docs — freeze current bundled docs into a versioned directory.
#
# Usage:
#   ./scripts/snapshot-docs.sh <version>         # e.g., ./scripts/snapshot-docs.sh 1.0
#   ./scripts/snapshot-docs.sh <version> --force  # overwrite existing snapshot
#
# Creates docs/v<version>/ with copies of all docs bundled by DocsPage.vue.
# Run at release time (automated by release-prep) or manually for demo prep.

set -e

VERSION="$1"
FORCE="$2"

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version> [--force]"
  echo "Example: $0 1.0"
  exit 1
fi

# Resolve paths relative to repo root (script is in code/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="$CODE_DIR/docs/v${VERSION}"

if [ -d "$TARGET" ] && [ "$FORCE" != "--force" ]; then
  echo "ERROR: Snapshot $TARGET already exists. Use --force to overwrite."
  exit 1
fi

echo "=== Snapshot Docs v${VERSION} ==="

# Clean target if force-overwriting
if [ -d "$TARGET" ]; then
  echo "Overwriting existing snapshot..."
  rm -rf "$TARGET"
fi

# Create directory structure matching bundled docs layout
mkdir -p "$TARGET/security/compliance" "$TARGET/legal"

# Copy all docs that DocsPage.vue bundles
# Keep this list in sync with DocsPage.vue imports and slugToPath registry
DOCS=(
  "docs/ADMIN-GUIDE.md"
  "docs/USER-GUIDE.md"
  "docs/PRODUCTION-DEPLOYMENT.md"
  "docs/security/SECURITY-BASELINES.md"
  "docs/security/compliance/NIST-800-171-MAPPING.md"
  "docs/security/compliance/HIPAA-164-312-MAPPING.md"
  "docs/security/compliance/PCI-DSS-MAPPING.md"
  "docs/security/compliance/CIS-BENCHMARK-ALIGNMENT.md"
  "docs/security/compliance/SOC2-READINESS.md"
  "docs/legal/TERMS-OF-SERVICE.md"
  "docs/COMPATIBILITY.md"
)

# ATTRIBUTION.md lives at repo root (code/), not docs/
REPO_ROOT_DOCS=(
  "ATTRIBUTION.md"
)

COPIED=0

for doc in "${DOCS[@]}"; do
  src="$CODE_DIR/$doc"
  # Strip "docs/" prefix to get relative path within docs/
  rel="${doc#docs/}"
  dest="$TARGET/$rel"
  if [ -f "$src" ]; then
    cp "$src" "$dest"
    COPIED=$((COPIED + 1))
  else
    echo "WARNING: $src not found — skipping"
  fi
done

for doc in "${REPO_ROOT_DOCS[@]}"; do
  src="$CODE_DIR/$doc"
  dest="$TARGET/$doc"
  if [ -f "$src" ]; then
    cp "$src" "$dest"
    COPIED=$((COPIED + 1))
  else
    echo "WARNING: $src not found — skipping"
  fi
done

echo ""
echo "Snapshot created: $TARGET"
echo "Files copied: $COPIED"
echo ""
echo "To verify: npm run audit:docs-links"

#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Proprietary and confidential. Do not distribute.
#
# Package the pitch deck as a self-contained folder (no server needed).
# Opens directly from file:// in any browser.
#
# Usage:
#   ./package-deck.sh              — creates dist/weaver-pitch-deck/
#   ./package-deck.sh --zip        — also creates weaver-pitch-deck.zip

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$DIR/dist/weaver-pitch-deck"

echo "=== Packaging Weaver Pitch Deck ==="

# Clean previous build
rm -rf "$DIST"
mkdir -p "$DIST/vendor/reveal" "$DIST/vendor/fonts" "$DIST/img"

# ── Copy images ──────────────────────────────────────────────
cp "$DIR"/img/*.png "$DIST/img/" 2>/dev/null || true
cp "$DIR"/img/*.jpg "$DIST/img/" 2>/dev/null || true
cp "$DIR"/img/*.svg "$DIST/img/" 2>/dev/null || true
echo "  ✓ Images copied"

# ── Download reveal.js ───────────────────────────────────────
REVEAL_VER="5.1.0"
REVEAL_BASE="https://cdn.jsdelivr.net/npm/reveal.js@${REVEAL_VER}"

curl -sL "$REVEAL_BASE/dist/reveal.css"                  -o "$DIST/vendor/reveal/reveal.css"
curl -sL "$REVEAL_BASE/dist/theme/black.css"             -o "$DIST/vendor/reveal/black.css"
curl -sL "$REVEAL_BASE/plugin/highlight/monokai.css"     -o "$DIST/vendor/reveal/monokai.css"
curl -sL "$REVEAL_BASE/dist/reveal.js"                   -o "$DIST/vendor/reveal/reveal.js"
curl -sL "$REVEAL_BASE/plugin/notes/notes.js"            -o "$DIST/vendor/reveal/notes.js"
curl -sL "$REVEAL_BASE/plugin/highlight/highlight.js"    -o "$DIST/vendor/reveal/highlight.js"
echo "  ✓ reveal.js ${REVEAL_VER} vendored"

# ── Download fonts ───────────────────────────────────────────
# Inter (variable weight)
curl -sL "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.woff2" \
  -o "$DIST/vendor/fonts/inter-latin.woff2"

# JetBrains Mono (regular + medium)
curl -sL "https://fonts.gstatic.com/s/jetbrainsmono/v20/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.woff2" \
  -o "$DIST/vendor/fonts/jetbrains-mono-latin.woff2"

# Write local @font-face CSS
cat > "$DIST/vendor/fonts/fonts.css" << 'FONTCSS'
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 300 900;
  font-display: swap;
  src: url('inter-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 400 500;
  font-display: swap;
  src: url('jetbrains-mono-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
FONTCSS
echo "  ✓ Fonts vendored"

# ── Rewrite HTML ─────────────────────────────────────────────
sed \
  -e 's|https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css|vendor/reveal/reveal.css|' \
  -e 's|https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/black.css|vendor/reveal/black.css|' \
  -e 's|https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/monokai.css|vendor/reveal/monokai.css|' \
  -e 's|https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js|vendor/reveal/reveal.js|' \
  -e 's|https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/notes/notes.js|vendor/reveal/notes.js|' \
  -e 's|https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/highlight.js|vendor/reveal/highlight.js|' \
  -e '/<link rel="preconnect"/d' \
  -e 's|<link rel="stylesheet" href="https://fonts.googleapis.com/css2?.*">|<link rel="stylesheet" href="vendor/fonts/fonts.css">|' \
  -e '/<iframe class="demo-frame"/d' \
  "$DIR/index.html" > "$DIST/index.html"
echo "  ✓ HTML rewritten (local paths, no CDN, no iframe)"

# ── Optional zip ─────────────────────────────────────────────
if [[ "${1:-}" == "--zip" ]]; then
  (cd "$DIR/dist" && zip -rq "weaver-pitch-deck.zip" "weaver-pitch-deck/")
  echo "  ✓ Zipped: dist/weaver-pitch-deck.zip"
fi

echo ""
echo "Done! Open dist/weaver-pitch-deck/index.html in any browser."
echo "No server required — works from file://"

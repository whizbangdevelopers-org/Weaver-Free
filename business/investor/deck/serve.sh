#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Proprietary and confidential. Do not distribute.
#
# Serve the investor pitch deck locally.
#
# Usage:
#   ./serve.sh              — serve on port 8080
#   ./serve.sh 3000         — serve on custom port
#
# For PDF export: open http://localhost:8080/?print-pdf in Chrome, then Print → Save as PDF
#
# For presenter mode (speaker notes): press 'S' during presentation

PORT="${1:-8080}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Weaver Investor Pitch Deck ==="
echo "URL:     http://localhost:$PORT"
echo "Notes:   Press 'S' for speaker notes view"
echo "PDF:     http://localhost:$PORT/?print-pdf"
echo ""

# Try python3 first, fall back to npx serve
if command -v python3 &> /dev/null; then
  cd "$DIR" && python3 -m http.server "$PORT"
elif command -v npx &> /dev/null; then
  npx -y serve "$DIR" -l "$PORT"
else
  echo "ERROR: Need python3 or npx to serve files"
  exit 1
fi

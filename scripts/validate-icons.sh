#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# Validate icon files for required sizes and formats
# Usage: ./scripts/validate-icons.sh

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ICONS_DIR="public/icons"
ERRORS=0

echo "Validating icons in $ICONS_DIR..."
echo ""

# Required icon sizes for PWA/mobile
REQUIRED_SIZES=(
  "72x72"
  "96x96"
  "128x128"
  "144x144"
  "152x152"
  "192x192"
  "384x384"
  "512x512"
)

# Check if icons directory exists
if [ ! -d "$ICONS_DIR" ]; then
  echo -e "${YELLOW}Icons directory does not exist: $ICONS_DIR${NC}"
  echo "Create the directory and add icon files when ready."
  exit 0
fi

# Check for favicon
if [ ! -f "$ICONS_DIR/favicon.ico" ] && [ ! -f "public/favicon.ico" ]; then
  echo -e "${YELLOW}Warning: No favicon.ico found${NC}"
fi

# Check for required sizes
for size in "${REQUIRED_SIZES[@]}"; do
  # Look for icon-{size}.png pattern
  if ls "$ICONS_DIR"/icon-"$size".png 1>/dev/null 2>&1; then
    echo -e "${GREEN}Found: icon-$size.png${NC}"
  elif ls "$ICONS_DIR"/*"$size"*.png 1>/dev/null 2>&1; then
    echo -e "${GREEN}Found: $size icon${NC}"
  else
    echo -e "${YELLOW}Missing: $size icon${NC}"
  fi
done

echo ""

# Check for Apple touch icon
if ls "$ICONS_DIR"/apple-*.png 1>/dev/null 2>&1; then
  echo -e "${GREEN}Found: Apple touch icon${NC}"
else
  echo -e "${YELLOW}Warning: No Apple touch icon found (apple-touch-icon.png)${NC}"
fi

# Check for maskable icon (for Android adaptive icons)
if ls "$ICONS_DIR"/*maskable*.png 1>/dev/null 2>&1; then
  echo -e "${GREEN}Found: Maskable icon${NC}"
else
  echo -e "${YELLOW}Info: No maskable icon found (optional for Android)${NC}"
fi

echo ""

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}Icon validation complete!${NC}"
  exit 0
else
  echo -e "${RED}Icon validation found issues${NC}"
  exit 1
fi

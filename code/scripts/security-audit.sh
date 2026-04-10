#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# Security audit script with severity-based reporting
# Usage: ./scripts/security-audit.sh [--fix]

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FIX_FLAG=""
if [ "$1" = "--fix" ]; then
  FIX_FLAG="--fix"
  echo -e "${BLUE}Running audit with auto-fix...${NC}"
fi

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Security Audit Report${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Run npm audit and capture output
AUDIT_OUTPUT=$(npm audit $FIX_FLAG 2>&1) || true
AUDIT_EXIT_CODE=$?

# Display the full output
echo "$AUDIT_OUTPUT"
echo ""

# Parse and summarize
if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
  echo -e "${GREEN}======================================${NC}"
  echo -e "${GREEN}No vulnerabilities found!${NC}"
  echo -e "${GREEN}======================================${NC}"
  exit 0
fi

# Check for different severity levels
CRITICAL=$(echo "$AUDIT_OUTPUT" | grep -c "critical" || true)
HIGH=$(echo "$AUDIT_OUTPUT" | grep -c "high" || true)
MODERATE=$(echo "$AUDIT_OUTPUT" | grep -c "moderate" || true)
LOW=$(echo "$AUDIT_OUTPUT" | grep -c "low" || true)

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}======================================${NC}"

if [ "$CRITICAL" -gt 0 ]; then
  echo -e "${RED}CRITICAL: Action required immediately${NC}"
fi
if [ "$HIGH" -gt 0 ]; then
  echo -e "${RED}HIGH: Should be addressed soon${NC}"
fi
if [ "$MODERATE" -gt 0 ]; then
  echo -e "${YELLOW}MODERATE: Review and plan remediation${NC}"
fi
if [ "$LOW" -gt 0 ]; then
  echo -e "${GREEN}LOW: Address when convenient${NC}"
fi

echo ""
echo "Run 'npm audit fix' to auto-fix where possible"
echo "Run 'npm audit fix --force' to force updates (may include breaking changes)"

# Exit with error only for critical vulnerabilities
if [ "$CRITICAL" -gt 0 ]; then
  exit 1
fi

exit 0

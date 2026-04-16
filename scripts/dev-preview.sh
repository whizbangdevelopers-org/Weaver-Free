#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
# Dev Preview — spin up frontend + backend in mock mode for visual inspection.
# Usage: ./scripts/dev-preview.sh [page]
# Example: ./scripts/dev-preview.sh settings
#          ./scripts/dev-preview.sh           (defaults to dashboard)
set -euo pipefail

PAGE="${1:-}"
FRONTEND_PORT="${QUASAR_DEV_PORT:-9010}"
BACKEND_PORT="${PORT:-3110}"

# 1. Kill existing processes on dev ports
echo "Clearing ports $FRONTEND_PORT and $BACKEND_PORT..."
fuser "$FRONTEND_PORT/tcp" 2>/dev/null | xargs -r kill 2>/dev/null || true
fuser "$BACKEND_PORT/tcp" 2>/dev/null | xargs -r kill 2>/dev/null || true
sleep 1

# 2. Start backend (mock mode)
echo "Starting backend on port $BACKEND_PORT..."
npm run dev:backend > /tmp/microvm-dev-backend.log 2>&1 &
BACKEND_PID=$!

# 3. Start frontend
echo "Starting frontend on port $FRONTEND_PORT..."
npm run dev > /tmp/microvm-dev-frontend.log 2>&1 &
FRONTEND_PID=$!

# 4. Wait for backend health
echo -n "Waiting for backend..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$BACKEND_PORT/api/health" > /dev/null 2>&1; then
    echo " ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo " TIMEOUT"
    echo "Backend failed to start. Check /tmp/microvm-dev-backend.log"
    exit 1
  fi
  echo -n "."
  sleep 1
done

# 5. Wait for frontend
echo -n "Waiting for frontend..."
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "http://localhost:$FRONTEND_PORT" 2>&1; then
    echo " ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo " TIMEOUT"
    echo "Frontend failed to start. Check /tmp/microvm-dev-frontend.log"
    exit 1
  fi
  echo -n "."
  sleep 1
done

# 6. Report URLs
echo ""
echo "=== Dev Preview Ready ==="
echo ""
echo "  Dashboard:  http://localhost:$FRONTEND_PORT"
echo "  Settings:   http://localhost:$FRONTEND_PORT/#/settings"
echo "  Help:       http://localhost:$FRONTEND_PORT/#/help"
echo "  Backend:    http://localhost:$BACKEND_PORT/api/health"

if [ -n "$PAGE" ]; then
  echo ""
  echo "  Suggested:  http://localhost:$FRONTEND_PORT/#/$PAGE"
fi

echo ""
echo "  Backend PID:  $BACKEND_PID (log: /tmp/microvm-dev-backend.log)"
echo "  Frontend PID: $FRONTEND_PID (log: /tmp/microvm-dev-frontend.log)"
echo ""
echo "Press Ctrl+C to stop both servers."

# Keep running until interrupted
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Servers stopped.'; exit 0" INT TERM
wait

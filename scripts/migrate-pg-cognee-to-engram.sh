#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
#
# Migrate PostgreSQL: cognee role/database → engram role/database
#
# Run from: code/  (project root)
# Usage:    ./scripts/migrate-pg-cognee-to-engram.sh
#
# What it does:
#   1. Creates the 'engram' PG role and database
#   2. Migrates all data from 'cognee' DB to 'engram' DB via pg_dump | psql
#   3. Verifies row counts in key tables match
#   4. Prints the env vars to set and service restart commands
#
# What it does NOT do:
#   - Drop the 'cognee' database (do that manually after confirming all services work)
#   - Touch the NixOS config (step 3 in the migration plan)
#   - Restart any services (your responsibility after verifying)
#
# Safe to run multiple times — skips steps already completed.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

ok()   { echo -e "${GREEN}✓${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
err()  { echo -e "${RED}✗${RESET} $*" >&2; }
hdr()  { echo -e "\n${BOLD}$*${RESET}"; }

# ── Prerequisites ──────────────────────────────────────────────────────────────

hdr "=== Engram PG Migration: cognee → engram ==="
echo "Checking prerequisites..."

if ! command -v psql &>/dev/null; then
  err "psql not found — install postgresql client or run on king"
  exit 1
fi

if ! sudo -u postgres psql -c '\q' &>/dev/null 2>&1; then
  err "Cannot connect to PostgreSQL as postgres user"
  err "Run this script on king where PostgreSQL is running"
  exit 1
fi

ok "PostgreSQL is reachable"

# ── Step 1: Create engram role ─────────────────────────────────────────────────

hdr "Step 1: Create 'engram' role"

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='engram'" | grep -q 1; then
  warn "Role 'engram' already exists — skipping creation"
else
  # Use the password from env var if set, otherwise default for dev
  PG_PASSWORD="${ENGRAM_PG_PASSWORD:-engram-local}"
  sudo -u postgres psql -c "CREATE ROLE engram WITH LOGIN PASSWORD '${PG_PASSWORD}';"
  ok "Created role 'engram'"
fi

# ── Step 2: Create engram database ────────────────────────────────────────────

hdr "Step 2: Create 'engram' database"

if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='engram'" | grep -q 1; then
  warn "Database 'engram' already exists — skipping creation"
else
  sudo -u postgres psql -c "CREATE DATABASE engram OWNER engram;"
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE engram TO engram;"
  ok "Created database 'engram'"
fi

# ── Step 3: Verify source database exists ─────────────────────────────────────

hdr "Step 3: Verify source database 'cognee'"

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='cognee'" | grep -q 1; then
  err "Source database 'cognee' does not exist — nothing to migrate"
  exit 1
fi

ok "Source database 'cognee' exists"

# Count tables in cognee
COGNEE_TABLES=$(sudo -u postgres psql -d cognee -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
ok "cognee has ${COGNEE_TABLES} table(s) in public schema"

# ── Step 4: Migrate data ───────────────────────────────────────────────────────

hdr "Step 4: Migrate data cognee → engram"

# Check if engram already has tables (migration already run)
ENGRAM_TABLES=$(sudo -u postgres psql -d engram -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")

if [[ "${ENGRAM_TABLES}" -gt 0 ]]; then
  warn "engram database already has ${ENGRAM_TABLES} table(s)"
  warn "Skipping migration — drop engram DB manually if you want a fresh migration"
else
  echo "Dumping cognee → engram (this may take a moment)..."
  sudo -u postgres pg_dump cognee | sudo -u postgres psql engram
  ok "Data migration complete"
fi

# ── Step 5: Verify row counts ─────────────────────────────────────────────────

hdr "Step 5: Row count verification"

# Get all tables in cognee public schema
TABLES=$(sudo -u postgres psql -d cognee -tAc \
  "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")

ALL_MATCH=true

while IFS= read -r table; do
  [[ -z "$table" ]] && continue
  COGNEE_COUNT=$(sudo -u postgres psql -d cognee -tAc "SELECT COUNT(*) FROM \"${table}\"" 2>/dev/null || echo "ERR")
  ENGRAM_COUNT=$(sudo -u postgres psql -d engram -tAc "SELECT COUNT(*) FROM \"${table}\"" 2>/dev/null || echo "MISSING")

  if [[ "${COGNEE_COUNT}" == "${ENGRAM_COUNT}" ]]; then
    ok "  ${table}: ${COGNEE_COUNT} rows ✓"
  else
    err "  ${table}: cognee=${COGNEE_COUNT} engram=${ENGRAM_COUNT} MISMATCH"
    ALL_MATCH=false
  fi
done <<< "${TABLES}"

echo ""
if [[ "${ALL_MATCH}" == "true" ]]; then
  ok "All row counts match"
else
  err "Row count mismatches detected — do NOT proceed until resolved"
  exit 1
fi

# ── Step 6: Transfer ownership + grant schema permissions ─────────────────────

hdr "Step 6: Transfer ownership and grant schema permissions to engram role"

# Tables migrated via pg_dump retain cognee as owner — reassign all objects at once.
sudo -u postgres psql -d engram -c "REASSIGN OWNED BY cognee TO engram;"
sudo -u postgres psql -d engram -c "GRANT ALL ON SCHEMA public TO engram;"
sudo -u postgres psql -d engram -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO engram;"
ok "Ownership transferred and permissions granted"

# ── Step 7: Instructions ───────────────────────────────────────────────────────

hdr "=== Migration complete ==="
echo ""
echo -e "${BOLD}Next steps (manual):${RESET}"
echo ""
echo "1. Set env vars for the Engram service and restart:"
echo ""
echo "   export ENGRAM_PG_USER=engram"
echo "   export ENGRAM_PG_DATABASE=engram"
echo "   export ENGRAM_PG_PASSWORD=engram-local   # or from sops secret"
echo ""
echo "   sudo systemctl restart weaver"
echo "   # and if the Cognee sidecar is running:"
echo "   sudo systemctl restart cognee"
echo ""
echo "2. Verify the Engram UI and backend work against the new DB:"
echo "   curl http://localhost:3110/api/engram/status"
echo "   curl http://localhost:3110/api/engram/stats"
echo ""
echo "3. Run a quick ingest-knowledge smoke check:"
echo "   npm run engram:ingest-knowledge -- --dry-run"
echo ""
echo "4. Once satisfied, drop the old database:"
echo ""
echo -e "   ${YELLOW}sudo -u postgres psql -c \"DROP DATABASE cognee;\"${RESET}"
echo -e "   ${YELLOW}sudo -u postgres psql -c \"DROP ROLE cognee;\"${RESET}"
echo ""
echo -e "${BOLD}Step 3 (NixOS module options + sops-nix) is separate — do that after this is confirmed working.${RESET}"
echo ""

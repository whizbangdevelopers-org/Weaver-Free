#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
#
# nix-refresh-deps-hash.sh — resync nixos/package.nix with package-lock.json.
#
# `audit:nix-deps-hash` advertised `npm run nix:refresh-deps-hash` as the one-command
# remediation, but the script did not exist — so the only path was the manual one:
# run prefetch-npm-deps, copy an SRI hash by eye, then copy a 16-hex marker by eye.
# Both values must change together, and a mistyped hash surfaces as a Nix build
# failure long after the commit that caused it. This does both writes atomically.
#
# Usage:  npm run nix:refresh-deps-hash          (from the repo, any cwd)
#         ./scripts/nix-refresh-deps-hash.sh --check   (print values, write nothing)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCKFILE="$CODE_DIR/package-lock.json"
NIXFILE="$CODE_DIR/nixos/package.nix"

[ -f "$LOCKFILE" ] || { echo "ERROR: $LOCKFILE not found" >&2; exit 1; }
[ -f "$NIXFILE" ]  || { echo "ERROR: $NIXFILE not found"  >&2; exit 1; }

# The marker must be computed EXACTLY as scripts/verify-nix-deps-hash.ts computes it
# (sha256 of the lockfile bytes, first 16 hex) or the auditor will still fail.
MARKER="$(sha256sum "$LOCKFILE" | cut -c1-16)"

echo "Computing npm deps hash (this fetches every tarball; expect a few minutes)…"

# prefetch-npm-deps hits registry.npmjs.org for every package and intermittently dies
# on an HTTP/2 framing error partway through. That is transient and unrelated to the
# lockfile, so retry rather than reporting a bad hash or no hash.
SRI=""
for attempt in 1 2 3; do
  if SRI="$(nix-shell -p prefetch-npm-deps --run "prefetch-npm-deps '$LOCKFILE'" 2>/dev/null | tail -1)" \
     && [[ "$SRI" == sha256-* ]]; then
    break
  fi
  echo "  attempt $attempt failed (transient registry error?) — retrying…" >&2
  SRI=""
done

[ -n "$SRI" ] || { echo "ERROR: could not compute npmDepsHash after 3 attempts" >&2; exit 1; }

echo "  npmDepsHash:     $SRI"
echo "  lockfile-marker: $MARKER"

if [ "${1:-}" = "--check" ]; then
  echo "(--check: nothing written)"
  exit 0
fi

python3 - "$NIXFILE" "$SRI" "$MARKER" <<'PY'
import re, sys
path, sri, marker = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path).read()

text, n_hash = re.subn(r'(npmDepsHash\s*=\s*")[^"]*(";)', lambda m: m.group(1) + sri + m.group(2), text, count=1)
text, n_mark = re.subn(r'(#\s*lockfile-marker:\s*)[a-f0-9]{16}', lambda m: m.group(1) + marker, text, count=1)

# Both must land. A partial write is worse than none: the marker is what the auditor
# reads, so writing it without the hash produces a PASS on a stale npmDepsHash.
if n_hash != 1 or n_mark != 1:
    sys.exit(f"ERROR: expected 1 npmDepsHash and 1 lockfile-marker in {path}, "
             f"replaced {n_hash} and {n_mark}. Nothing written.")

open(path, 'w').write(text)
print(f"Updated {path}")
PY

echo
echo "Verify:  npm --prefix $CODE_DIR run audit:nix-deps-hash"

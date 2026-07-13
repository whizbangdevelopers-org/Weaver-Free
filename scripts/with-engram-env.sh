#!/usr/bin/env bash
# Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
# Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
#
# Best-effort source the canonical bedrock Engram client env (sops-backed, owned
# by anvil) so DB-touching compliance audits verify against the real store after
# king's engram was decommissioned (ENGRAM-BEDROCK-MIGRATION §7.4).
#
#   with-engram-env.sh <cmd> [args...]
#
# Resolution: $ENGRAM_CLIENT_ENV wins; else the sibling anvil checkout
# (../../anvil/tools/engram-client-env.sh relative to the weaver repo). If the
# script is absent or fails to decrypt (CI, off-LAN, public Free mirror), NO
# ENGRAM_PG_* vars are set and the wrapped audit falls through to its own loud
# "Engram unreachable → SKIP" path — never a silent green. Fail-open by design.
env_script="${ENGRAM_CLIENT_ENV:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/anvil/tools/engram-client-env.sh}"
# shellcheck disable=SC1090  # runtime-resolved canonical env, not a static include
[ -f "$env_script" ] && . "$env_script" 2>/dev/null || true
exec "$@"

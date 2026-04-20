// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Per-tier resource caps.
 *
 * Free-tier caps landed in v1.0.2 as a hotfix to close a monetization gap:
 * tier-matrix placed vm-start-stop-restart at `free` with no gates, but
 * vm-scan-register is also free, so a NixOS power user could declare an
 * unlimited number of VMs in their NixOS config and Weaver would manage
 * all of them with no ceiling. These constants are the ceiling.
 *
 * Enforcement model — "observer pattern":
 *   - All registered VMs remain VISIBLE in the list (no hiding).
 *   - Actions (start / restart) are CONTROLLABLE only for the first N VMs
 *     alphabetically where N = MAX_CONTROLLABLE_VMS. Beyond that, VMs are
 *     read-only — the user sees them but start/restart return 403.
 *   - Stop stays allowed regardless of cap (so running overage can be shut
 *     down without forcing an upgrade first).
 *   - Memory cap checks on start — total running memory (including target)
 *     must not exceed MAX_TOTAL_MEMORY_MB.
 *
 * Same backend enforcement serves the web UI AND the TUI — no client can
 * bypass by talking to the API directly. The only way around is direct
 * systemctl, which is out of Weaver's management scope.
 *
 * Paid tiers (Solo/Team/Fabrick): uncapped at this level. Fabrick adds
 * its own per-user quota system on top.
 */
export const FREE_TIER_CAPS = {
  /**
   * Max VMs controllable (start/restart) at Free tier. Alphabetical-first N
   * are controllable; VMs beyond N are visible but read-only. Sample VMs
   * count. Users can trim by removing VMs from their NixOS config.
   */
  MAX_CONTROLLABLE_VMS: 10,
  /** Max total memory (MB) summed across all RUNNING VMs at Free tier. */
  MAX_TOTAL_MEMORY_MB: 64 * 1024, // 64 GB
} as const

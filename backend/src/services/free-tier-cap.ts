// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Free-tier VM cap enforcement — pure logic, callable from route handlers.
 *
 * See `backend/src/constants/tier-limits.ts` for the enforcement model
 * (observer pattern: alphabetical-first-N controllable; rest read-only;
 * plus a total-running-memory ceiling).
 *
 * Paid tiers bypass entirely — the check returns null for any tier other
 * than FREE.
 */
import type { TierName } from '../constants/vocabularies.js'
import { TIERS, STATUSES } from '../constants/vocabularies.js'
import type { WorkloadInfo } from './microvm.js'
import { FREE_TIER_CAPS } from '../constants/tier-limits.js'

export interface FreeTierCapError {
  status: 403
  error: string
  reason: 'outside-controllable-set' | 'memory-ceiling-exceeded'
}

/**
 * Returns null if the start/restart action is allowed; returns a structured
 * error if the Free-tier cap blocks it.
 *
 * @param targetName  Name of the VM the user is trying to start/restart.
 * @param allVms      Current registry — names + memory + status. Typically
 *                    from `await listVms()`.
 * @param tier        Current license tier. Paid tiers bypass (returns null).
 */
export function checkFreeTierCap(
  targetName: string,
  allVms: WorkloadInfo[],
  tier: TierName,
): FreeTierCapError | null {
  if (tier !== TIERS.FREE) return null

  const target = allVms.find((v) => v.name === targetName)
  if (!target) return null // unknown VM — let the caller 4xx normally

  // Observer pattern: only alphabetical-first-N are controllable.
  const controllable = new Set(
    [...allVms]
      .map((v) => v.name)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, FREE_TIER_CAPS.MAX_CONTROLLABLE_VMS),
  )
  if (!controllable.has(targetName)) {
    return {
      status: 403,
      reason: 'outside-controllable-set',
      error: `"${targetName}" is outside your Free-tier managed set. Weaver Free controls the alphabetical-first ${FREE_TIER_CAPS.MAX_CONTROLLABLE_VMS} workloads; the rest are visible but read-only. Upgrade to Weaver Solo for unlimited control, or rename/remove workloads in your NixOS config to bring "${targetName}" into the top ${FREE_TIER_CAPS.MAX_CONTROLLABLE_VMS}.`,
    }
  }

  // Memory cap: running VMs + target's memory must fit under the ceiling.
  const runningMemoryMb = allVms
    .filter((v) => v.status === STATUSES.RUNNING && v.name !== targetName)
    .reduce((sum, v) => sum + (v.mem ?? 0), 0)
  const totalIfStarted = runningMemoryMb + (target.mem ?? 0)
  if (totalIfStarted > FREE_TIER_CAPS.MAX_TOTAL_MEMORY_MB) {
    return {
      status: 403,
      reason: 'memory-ceiling-exceeded',
      error: `Starting "${targetName}" would push total running memory to ${(totalIfStarted / 1024).toFixed(1)}GB, exceeding Free tier's ${FREE_TIER_CAPS.MAX_TOTAL_MEMORY_MB / 1024}GB limit. Stop other workloads first, or upgrade to Weaver Solo for unlimited memory.`,
    }
  }

  return null
}

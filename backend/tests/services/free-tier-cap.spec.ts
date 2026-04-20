// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect } from 'vitest'
import { checkFreeTierCap } from '../../src/services/free-tier-cap.js'
import { TIERS, STATUSES } from '../../src/constants/vocabularies.js'
import { FREE_TIER_CAPS } from '../../src/constants/tier-limits.js'
import type { WorkloadInfo } from '../../src/services/microvm.js'

function vm(name: string, mem = 1024, status: WorkloadInfo['status'] = STATUSES.STOPPED): WorkloadInfo {
  return {
    name,
    status,
    ip: '10.10.0.1',
    mem,
    vcpu: 1,
    hypervisor: 'qemu',
    uptime: null,
  } as WorkloadInfo
}

describe('checkFreeTierCap', () => {
  describe('tier bypass', () => {
    it('returns null for Solo tier regardless of cap', () => {
      const manyVms = Array.from({ length: 20 }, (_, i) => vm(`vm-${String(i).padStart(2, '0')}`))
      expect(checkFreeTierCap('vm-19', manyVms, TIERS.SOLO)).toBeNull()
    })

    it('returns null for Fabrick tier regardless of cap', () => {
      const manyVms = Array.from({ length: 20 }, (_, i) => vm(`vm-${String(i).padStart(2, '0')}`, 32 * 1024))
      expect(checkFreeTierCap('vm-19', manyVms, TIERS.FABRICK)).toBeNull()
    })

    it('returns null for Demo tier', () => {
      const manyVms = Array.from({ length: 20 }, (_, i) => vm(`vm-${String(i).padStart(2, '0')}`))
      expect(checkFreeTierCap('vm-19', manyVms, TIERS.DEMO)).toBeNull()
    })
  })

  describe('controllable-set cap (alphabetical-first-N)', () => {
    it('allows starting a VM in the first N alphabetical slots', () => {
      const vms = Array.from({ length: 15 }, (_, i) => vm(`vm-${String(i).padStart(2, '0')}`))
      // vm-00 through vm-09 are the first 10 alphabetical — controllable
      expect(checkFreeTierCap('vm-00', vms, TIERS.FREE)).toBeNull()
      expect(checkFreeTierCap('vm-09', vms, TIERS.FREE)).toBeNull()
    })

    it('blocks starting a VM outside the first N slots', () => {
      const vms = Array.from({ length: 15 }, (_, i) => vm(`vm-${String(i).padStart(2, '0')}`))
      const result = checkFreeTierCap('vm-10', vms, TIERS.FREE)
      expect(result).not.toBeNull()
      expect(result?.status).toBe(403)
      expect(result?.reason).toBe('outside-controllable-set')
      expect(result?.error).toContain('outside your Free-tier managed set')
      expect(result?.error).toContain(`alphabetical-first ${FREE_TIER_CAPS.MAX_CONTROLLABLE_VMS}`)
    })

    it('uses locale-aware sort (alpha before numeric prefix if any)', () => {
      // "apple" should come before "banana" regardless of length
      const vms = [vm('banana'), vm('apple'), vm('cherry')]
      // All 3 fit under the 10-VM cap, so all are controllable
      expect(checkFreeTierCap('apple', vms, TIERS.FREE)).toBeNull()
      expect(checkFreeTierCap('cherry', vms, TIERS.FREE)).toBeNull()
    })

    it('returns null for an unknown VM name (lets the caller 4xx)', () => {
      const vms = [vm('vm-a')]
      expect(checkFreeTierCap('does-not-exist', vms, TIERS.FREE)).toBeNull()
    })
  })

  describe('memory-ceiling cap', () => {
    it('allows start when total running + target fits under the ceiling', () => {
      // 5 running @ 8GB each = 40GB. Target VM @ 8GB = 48GB total. Under 64GB.
      const vms = [
        ...Array.from({ length: 5 }, (_, i) => vm(`running-${i}`, 8 * 1024, STATUSES.RUNNING)),
        vm('target', 8 * 1024, STATUSES.STOPPED),
      ]
      expect(checkFreeTierCap('target', vms, TIERS.FREE)).toBeNull()
    })

    it('blocks start when total running + target would exceed the ceiling', () => {
      // 6 running @ 10GB each = 60GB. Target VM @ 8GB = 68GB total. Over 64GB.
      const vms = [
        ...Array.from({ length: 6 }, (_, i) => vm(`running-${i}`, 10 * 1024, STATUSES.RUNNING)),
        vm('target', 8 * 1024, STATUSES.STOPPED),
      ]
      const result = checkFreeTierCap('target', vms, TIERS.FREE)
      expect(result).not.toBeNull()
      expect(result?.status).toBe(403)
      expect(result?.reason).toBe('memory-ceiling-exceeded')
      expect(result?.error).toContain('64GB limit')
    })

    it('excludes the target from the running sum (target may already be running during restart)', () => {
      // Target itself is currently running @ 32GB. Other running: 32GB.
      // Restart of target: running-excluding-target (32GB) + target (32GB) = 64GB. Exactly at cap.
      const vms = [
        vm('other', 32 * 1024, STATUSES.RUNNING),
        vm('target', 32 * 1024, STATUSES.RUNNING),
      ]
      expect(checkFreeTierCap('target', vms, TIERS.FREE)).toBeNull()
    })
  })

  describe('precedence', () => {
    it('controllable-set check runs first (reported over memory)', () => {
      // VM outside the first 10 — blocked for controllable-set reason even if memory would be fine.
      const vms = Array.from({ length: 15 }, (_, i) => vm(`vm-${String(i).padStart(2, '0')}`, 1024))
      const result = checkFreeTierCap('vm-14', vms, TIERS.FREE)
      expect(result?.reason).toBe('outside-controllable-set')
    })
  })
})

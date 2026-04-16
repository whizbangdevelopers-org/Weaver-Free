// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

const mocks = vi.hoisted(() => ({
  createVm: vi.fn().mockResolvedValue({ success: true }),
  deleteVm: vi.fn().mockResolvedValue({ success: true }),
  stopVm: vi.fn().mockResolvedValue({ success: true }),
  getVmStatus: vi.fn().mockResolvedValue('running'),
}))

vi.mock('../../src/services/microvm.js', () => mocks)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DistroTester } from '../../src/services/distro-tester.js'
import type { WorkloadRegistry } from '../../src/storage/workload-registry.js'
import type { Provisioner } from '../../src/services/provisioner-types.js'
import type { DashboardConfig } from '../../src/config.js'

function makeRegistry(): WorkloadRegistry {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue(null),
    has: vi.fn().mockResolvedValue(false),
    add: vi.fn().mockResolvedValue(true),
    remove: vi.fn().mockResolvedValue(true),
    update: vi.fn().mockResolvedValue(true),
  } as unknown as WorkloadRegistry
}

function makeProvisioner(): Provisioner {
  return {
    provision: vi.fn().mockResolvedValue(undefined),
    startCloudVm: vi.fn().mockResolvedValue({ success: true }),
    destroy: vi.fn().mockResolvedValue(undefined),
    isIsoDistro: vi.fn().mockReturnValue(false),
  } as unknown as Provisioner
}

function makeConfig(): DashboardConfig {
  return {
    bridgeInterface: 'br-test',
    tier: 'weaver',
    licenseExpiry: null,
    licenseGraceMode: false,
    dataDir: '/tmp/test',
    provisioningEnabled: true,
  } as unknown as DashboardConfig
}

describe('DistroTester', () => {
  let registry: WorkloadRegistry
  let provisioner: Provisioner
  let config: DashboardConfig
  let tester: DistroTester

  beforeEach(() => {
    registry = makeRegistry()
    provisioner = makeProvisioner()
    config = makeConfig()
    tester = new DistroTester(registry, provisioner, config)

    // Reset mocks between tests
    vi.clearAllMocks()
    mocks.createVm.mockResolvedValue({ success: true })
    mocks.deleteVm.mockResolvedValue({ success: true })
    mocks.stopVm.mockResolvedValue({ success: true })
    mocks.getVmStatus.mockResolvedValue('running')
  })

  // ── getStatus ─────────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('returns { status: "none" } for an unknown distro', () => {
      const result = tester.getStatus('ubuntu')
      expect(result).toEqual({ status: 'none' })
    })

    it('returns the current status after startTest is called', async () => {
      // Override registry so the test lifecycle doesn't immediately error
      vi.mocked(registry.getAll).mockResolvedValue({})
      vi.mocked(registry.has).mockResolvedValue(false)

      // Don't await — startTest fires-and-forgets the lifecycle
      void tester.startTest('cirros').catch(() => {})

      // Status is set synchronously before the async lifecycle begins
      const result = tester.getStatus('cirros')
      expect(result.status).toBe('running')
    })
  })

  // ── isRunning ─────────────────────────────────────────────────────────────

  describe('isRunning()', () => {
    it('returns false for an unknown distro', () => {
      expect(tester.isRunning('ubuntu')).toBe(false)
    })

    it('returns true after startTest sets status to running', async () => {
      vi.mocked(registry.getAll).mockResolvedValue({})
      vi.mocked(registry.has).mockResolvedValue(false)
      void tester.startTest('cirros').catch(() => {})
      expect(tester.isRunning('cirros')).toBe(true)
    })

    it('returns false for a distro that previously failed', async () => {
      // Simulate a prior failed state injected directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(tester as any).activeTests.set('ubuntu', { status: 'failed', error: 'oops' })
      expect(tester.isRunning('ubuntu')).toBe(false)
    })

    it('returns false for a distro that previously passed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(tester as any).activeTests.set('ubuntu', { status: 'passed', durationSeconds: 30 })
      expect(tester.isRunning('ubuntu')).toBe(false)
    })
  })

  // ── startTest ─────────────────────────────────────────────────────────────

  describe('startTest()', () => {
    it('sets distro status to running immediately', async () => {
      vi.mocked(registry.getAll).mockResolvedValue({})
      vi.mocked(registry.has).mockResolvedValue(false)
      void tester.startTest('cirros').catch(() => {})
      expect(tester.getStatus('cirros').status).toBe('running')
    })

    it('throws if test is already running for the same distro', async () => {
      vi.mocked(registry.getAll).mockResolvedValue({})
      vi.mocked(registry.has).mockResolvedValue(false)
      void tester.startTest('cirros').catch(() => {})
      await expect(tester.startTest('cirros')).rejects.toThrow("Test already running for 'cirros'")
    })

    it('allows starting tests for different distros simultaneously', async () => {
      vi.mocked(registry.getAll).mockResolvedValue({})
      vi.mocked(registry.has).mockResolvedValue(false)
      void tester.startTest('cirros').catch(() => {})
      // Should not throw — different distro
      void tester.startTest('ubuntu').catch(() => {})
      expect(tester.getStatus('cirros').status).toBe('running')
      expect(tester.getStatus('ubuntu').status).toBe('running')
    })

    it('records startedAt timestamp', async () => {
      vi.mocked(registry.getAll).mockResolvedValue({})
      vi.mocked(registry.has).mockResolvedValue(false)
      void tester.startTest('cirros').catch(() => {})
      const status = tester.getStatus('cirros')
      expect(status.startedAt).toBeDefined()
      expect(new Date(status.startedAt!).getTime()).toBeGreaterThan(0)
    })
  })

  // ── constructor ───────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('initializes with empty state (no active tests)', () => {
      const fresh = new DistroTester(registry, provisioner, config)
      expect(fresh.getStatus('ubuntu')).toEqual({ status: 'none' })
      expect(fresh.isRunning('ubuntu')).toBe(false)
    })
  })
})

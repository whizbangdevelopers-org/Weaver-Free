// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Distro Tester Service
 *
 * Manages "will it boot?" smoke tests for individual distros.
 * Used by the POST /api/distros/:name/test endpoint to let admins
 * validate a distro image before creating real VMs with it.
 */

import type { Provisioner } from './provisioner-types.js'
import type { WorkloadRegistry } from '../storage/workload-registry.js'
import type { DashboardConfig } from '../config.js'
import { createVm, deleteVm, stopVm, getVmStatus } from './microvm.js'
import { STATUSES, PROVISIONING } from '../constants/vocabularies.js'

export interface DistroTestStatus {
  status: typeof STATUSES.RUNNING | 'passed' | typeof STATUSES.FAILED | 'none'
  error?: string
  durationSeconds?: number
  startedAt?: string
}

const SMOKETEST_IP = '10.10.0.254'
const POLL_INTERVAL_MS = 2_000
const PROVISION_TIMEOUT_MS = 300_000 // 5 minutes
const START_TIMEOUT_MS = 60_000 // 1 minute

export class DistroTester {
  private activeTests = new Map<string, DistroTestStatus>()
  private registry: WorkloadRegistry
  private provisioner: Provisioner
  private config: DashboardConfig

  constructor(registry: WorkloadRegistry, provisioner: Provisioner, config: DashboardConfig) {
    this.registry = registry
    this.provisioner = provisioner
    this.config = config
  }

  /** Get the current/last test status for a distro */
  getStatus(distro: string): DistroTestStatus {
    return this.activeTests.get(distro) ?? { status: 'none' }
  }

  /** Check if a test is currently running for any distro */
  isRunning(distro: string): boolean {
    return this.activeTests.get(distro)?.status === STATUSES.RUNNING
  }

  /** Start a smoke test for a distro. Returns immediately; poll getStatus() for results. */
  async startTest(distro: string): Promise<void> {
    if (this.isRunning(distro)) {
      throw new Error(`Test already running for '${distro}'`)
    }

    this.activeTests.set(distro, {
      status: STATUSES.RUNNING,
      startedAt: new Date().toISOString(),
    })

    // Fire and forget — run the test lifecycle async
    this.runTest(distro).catch(() => {
      // Error already recorded in activeTests
    })
  }

  private async runTest(distro: string): Promise<void> {
    const vmName = `smoketest-${distro}`
    const t0 = Date.now()

    try {
      // Check if IP is available
      const existingVm = await this.findVmByIp(SMOKETEST_IP)
      if (existingVm) {
        throw new Error(`Smoke test IP ${SMOKETEST_IP} is in use by VM '${existingVm}'`)
      }

      // Clean up any leftover smoketest VM with same name
      if (await this.registry.has(vmName)) {
        try { await stopVm(vmName) } catch { /* ignore */ }
        await deleteVm(vmName)
      }

      // Create VM
      const isIso = this.provisioner.isIsoDistro(distro)
      const createResult = await createVm({
        name: vmName,
        ip: SMOKETEST_IP,
        mem: distro === 'cirros' ? 128 : 512,
        vcpu: 1,
        hypervisor: 'qemu',
        diskSize: isIso ? 20 : 10,
        distro,
        vmType: isIso ? 'desktop' : 'server',
        autostart: false,
        description: `Smoke test for ${distro}`,
        bridge: this.config.bridgeInterface,
      })

      if (!createResult.success) {
        throw new Error(`Create failed: ${createResult.message}`)
      }

      // Trigger provisioning
      await this.provisioner.provision(vmName)

      // Wait for provisioning
      const provisionResult = await this.pollState(vmName, PROVISION_TIMEOUT_MS)
      if (provisionResult !== PROVISIONING.PROVISIONED) {
        const vm = await this.registry.get(vmName)
        throw new Error(vm?.provisioningError ?? `Provisioning failed (state: ${provisionResult})`)
      }

      // ISO distros pass after provisioning (can't auto-boot without manual install)
      if (isIso) {
        this.activeTests.set(distro, {
          status: 'passed',
          durationSeconds: Math.round((Date.now() - t0) / 1000),
        })
        return
      }

      // Start VM
      const startResult = await this.provisioner.startCloudVm(vmName)
      if (!startResult.success) {
        throw new Error(`Start failed: ${startResult.message}`)
      }

      // Wait for running status
      const running = await this.pollRunning(vmName, START_TIMEOUT_MS)
      if (!running) {
        throw new Error('VM did not reach running state within 60s')
      }

      this.activeTests.set(distro, {
        status: 'passed',
        durationSeconds: Math.round((Date.now() - t0) / 1000),
      })
    } catch (err) {
      this.activeTests.set(distro, {
        status: STATUSES.FAILED,
        error: err instanceof Error ? err.message : 'Unknown error',
        durationSeconds: Math.round((Date.now() - t0) / 1000),
      })
    } finally {
      // Always clean up the smoketest VM
      try {
        await this.provisioner.destroy(vmName)
      } catch {
        // best-effort cleanup
        try { await deleteVm(vmName) } catch { /* ignore */ }
      }
    }
  }

  private async findVmByIp(ip: string): Promise<string | null> {
    const all = await this.registry.getAll()
    for (const [name, def] of Object.entries(all)) {
      if (def.ip === ip && !name.startsWith('smoketest-')) return name
    }
    return null
  }

  private async pollState(vmName: string, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      await this.sleep(POLL_INTERVAL_MS)
      const vm = await this.registry.get(vmName)
      if (!vm?.provisioningState) continue
      if (vm.provisioningState === PROVISIONING.PROVISIONED) return PROVISIONING.PROVISIONED
      if (vm.provisioningState === PROVISIONING.PROVISION_FAILED) return PROVISIONING.PROVISION_FAILED
    }
    return 'timeout'
  }

  private async pollRunning(vmName: string, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      await this.sleep(POLL_INTERVAL_MS)
      const status = await getVmStatus(vmName)
      if (status === STATUSES.RUNNING) return true
      if (status === STATUSES.FAILED) return false
    }
    return false
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
  }
}

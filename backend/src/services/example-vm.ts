// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { WorkloadRegistry } from '../storage/workload-registry.js'
import type { Provisioner } from './provisioner-types.js'
import type { DashboardConfig } from '../config.js'

export const EXAMPLE_VM_NAME = 'example-cirros'
const EXAMPLE_VM_IP = '10.10.0.100'

/**
 * Auto-provision a lightweight CirOS example VM after first admin creation.
 *
 * Guards (idempotent — safe to call from multiple trigger points):
 * - Provisioning must be enabled
 * - example-cirros must not already exist in registry
 * - IP 10.10.0.100 must not be allocated to another VM
 */
export async function provisionExampleVm(
  registry: WorkloadRegistry,
  provisioner: Provisioner,
  config: DashboardConfig,
  log: { info: (msg: string) => void; error: (err: unknown, msg: string) => void },
): Promise<void> {
  if (!config.provisioningEnabled) return
  if (await registry.has(EXAMPLE_VM_NAME)) return

  const allVms = await registry.getAll()
  const ipConflict = Object.values(allVms).some(vm => vm.ip === EXAMPLE_VM_IP)
  if (ipConflict) {
    log.info(`Skipping example VM: IP ${EXAMPLE_VM_IP} already in use`)
    return
  }

  log.info('Auto-provisioning example CirOS VM...')

  const added = await registry.add({
    name: EXAMPLE_VM_NAME,
    ip: EXAMPLE_VM_IP,
    mem: 128,
    vcpu: 1,
    hypervisor: 'qemu',
    distro: 'cirros',
    diskSize: 5,
    vmType: 'server',
    autostart: true,
    provisioningState: 'provisioning',
    description: 'Example CirOS VM — lightweight test image (~20 MB). Safe to delete anytime.',
    bridge: config.bridgeInterface,
  })

  if (!added) {
    log.info('Example VM already exists in registry')
    return
  }

  // Fire-and-forget: provision, then auto-start (autostartCloudVms already ran at boot)
  provisioner.provision(EXAMPLE_VM_NAME)
    .then(() => provisioner.startCloudVm(EXAMPLE_VM_NAME))
    .then(result => {
      if (result.success) log.info('Example CirOS VM started')
    })
    .catch(err => {
      log.error(err, 'Failed to provision/start example CirOS VM')
    })
}

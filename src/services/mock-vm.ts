// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { WorkloadInfo, WorkloadActionResult, VmCreateInput } from 'src/types/workload'
import { isDemoMode, getDemoVmsForTier, getDemoVmsForHost, DEMO_VMS } from 'src/config/demo'
import { STATUSES, PROVISIONING } from 'src/constants/vocabularies'

const DEV_VMS: WorkloadInfo[] = [
  { name: 'web-nginx', status: STATUSES.RUNNING, ip: '10.10.0.10', mem: 256, vcpu: 1, hypervisor: 'qemu', uptime: new Date(Date.now() - 86400000).toISOString(), distro: 'nixos' },
  { name: 'web-app', status: STATUSES.RUNNING, ip: '10.10.0.11', mem: 512, vcpu: 1, hypervisor: 'qemu', uptime: new Date(Date.now() - 43200000).toISOString(), distro: 'nixos' },
  { name: 'dev-node', status: STATUSES.STOPPED, ip: '10.10.0.20', mem: 512, vcpu: 1, hypervisor: 'qemu', uptime: null, distro: 'nixos' },
  { name: 'dev-python', status: STATUSES.STOPPED, ip: '10.10.0.21', mem: 512, vcpu: 1, hypervisor: 'qemu', uptime: null, distro: 'nixos' },
  { name: 'svc-postgres', status: STATUSES.RUNNING, ip: '10.10.0.30', mem: 512, vcpu: 1, hypervisor: 'qemu', uptime: new Date(Date.now() - 172800000).toISOString(), distro: 'nixos' },
]

// Use enhanced VM set in demo mode, basic 5-VM set in dev
const MOCK_VMS: WorkloadInfo[] = isDemoMode() ? DEMO_VMS : DEV_VMS

// Deep clone to allow state mutations
let vmState = JSON.parse(JSON.stringify(MOCK_VMS)) as WorkloadInfo[]

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function mockListVms(): Promise<WorkloadInfo[]> {
  await delay(200 + Math.random() * 300)
  return JSON.parse(JSON.stringify(vmState))
}

export async function mockGetVm(name: string): Promise<WorkloadInfo | null> {
  await delay(100 + Math.random() * 200)
  const vm = vmState.find(v => v.name === name)
  return vm ? JSON.parse(JSON.stringify(vm)) : null
}

export async function mockStartVm(name: string): Promise<WorkloadActionResult> {
  await delay(500 + Math.random() * 1000)
  const vm = vmState.find(v => v.name === name)
  if (!vm) return { success: false, message: `VM '${name}' not found` }
  if (vm.status === STATUSES.RUNNING) return { success: false, message: `VM '${name}' is already running` }
  vm.status = STATUSES.RUNNING
  vm.uptime = new Date().toISOString()
  return { success: true, message: `VM '${name}' started` }
}

export async function mockStopVm(name: string): Promise<WorkloadActionResult> {
  await delay(500 + Math.random() * 1000)
  const vm = vmState.find(v => v.name === name)
  if (!vm) return { success: false, message: `VM '${name}' not found` }
  if (vm.status === STATUSES.STOPPED) return { success: false, message: `VM '${name}' is already stopped` }
  vm.status = STATUSES.STOPPED
  vm.uptime = null
  return { success: true, message: `VM '${name}' stopped` }
}

export async function mockRestartVm(name: string): Promise<WorkloadActionResult> {
  await delay(1000 + Math.random() * 1500)
  const vm = vmState.find(v => v.name === name)
  if (!vm) return { success: false, message: `VM '${name}' not found` }
  vm.status = STATUSES.RUNNING
  vm.uptime = new Date().toISOString()
  return { success: true, message: `VM '${name}' restarted` }
}

export async function mockCreateVm(input: VmCreateInput): Promise<WorkloadActionResult> {
  await delay(500 + Math.random() * 500)
  const existing = vmState.find(v => v.name === input.name)
  if (existing) return { success: false, message: `VM '${input.name}' already exists` }

  const newVm: WorkloadInfo = {
    name: input.name,
    status: STATUSES.STOPPED,
    ip: input.ip,
    mem: input.mem,
    vcpu: input.vcpu,
    hypervisor: input.hypervisor,
    diskSize: input.diskSize,
    distro: input.distro,
    vmType: input.vmType,
    uptime: null,
    autostart: input.autostart ?? false,
    description: input.description,
    tags: input.tags,
    bridge: 'br-microvm',
    provisioningState: PROVISIONING.PROVISIONED,
  }
  vmState.push(newVm)
  return { success: true, message: `VM '${input.name}' created` }
}

export async function mockDeleteVm(name: string): Promise<WorkloadActionResult> {
  await delay(300 + Math.random() * 500)
  const idx = vmState.findIndex(v => v.name === name)
  if (idx === -1) return { success: false, message: `VM '${name}' not found` }
  vmState.splice(idx, 1)
  return { success: true, message: `VM '${name}' deleted` }
}

export function getMockVmState(): WorkloadInfo[] {
  return JSON.parse(JSON.stringify(vmState))
}

/** Demo replay: empty the mock VM state so a fresh scan can repopulate it */
export function clearMockVms(): void {
  vmState.splice(0, vmState.length)
}

/** Demo replay: add a single VM to the mock state (called during progressive scan) */
export function addMockVm(vm: WorkloadInfo): void {
  vmState.push(JSON.parse(JSON.stringify(vm)))
}

export function resetMockVms(): void {
  const source = isDemoMode() ? DEMO_VMS : DEV_VMS
  vmState = JSON.parse(JSON.stringify(source))
}

/** Reset mock VM state to match a specific tier (used by tier switcher). */
export function setMockVmsForTier(tier: string): void {
  vmState = JSON.parse(JSON.stringify(getDemoVmsForTier(tier)))
}

/** Reset mock VM state to match a specific host (used by Fabrick host selection). */
export function setMockVmsForHost(hostId: string, tier: string): void {
  vmState = JSON.parse(JSON.stringify(getDemoVmsForHost(hostId, tier)))
}

export async function mockCloneVm(sourceName: string, targetName: string, newIp: string): Promise<WorkloadActionResult> {
  await delay(800 + Math.random() * 1200)
  const source = vmState.find(v => v.name === sourceName)
  if (!source) return { success: false, message: `VM '${sourceName}' not found` }
  if (vmState.find(v => v.name === targetName)) return { success: false, message: `VM '${targetName}' already exists` }
  const clone: WorkloadInfo = JSON.parse(JSON.stringify(source))
  clone.name = targetName
  clone.ip = newIp
  clone.status = STATUSES.STOPPED
  clone.uptime = null
  clone.autostart = false
  clone.provisioningState = PROVISIONING.PROVISIONED
  clone.description = `Clone of ${sourceName}`
  vmState.push(clone)
  return { success: true, message: `VM '${targetName}' cloned from '${sourceName}'` }
}

export async function mockExportVm(name: string): Promise<{ success: boolean; data?: string; message?: string }> {
  await delay(100 + Math.random() * 150)
  const vm = vmState.find(v => v.name === name)
  if (!vm) return { success: false, message: `VM '${name}' not found` }
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    vm: JSON.parse(JSON.stringify(vm)),
  }
  return { success: true, data: JSON.stringify(exportData, null, 2) }
}

export async function mockExportAllVms(): Promise<{ success: boolean; data?: string; message?: string }> {
  await delay(150 + Math.random() * 200)
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    vms: JSON.parse(JSON.stringify(vmState)),
  }
  return { success: true, data: JSON.stringify(exportData, null, 2) }
}

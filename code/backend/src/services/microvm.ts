// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import type { WorkloadRegistry, WorkloadDefinition, ProvisioningState } from '../storage/workload-registry.js'
import type { Provisioner } from './provisioner-types.js'
import type { DashboardConfig } from '../config.js'
import { STATUSES, PROVISIONING, type WorkloadStatus } from '../constants/vocabularies.js'

const execFileAsync = promisify(execFile)

export interface WorkloadInfo {
  name: string
  status: WorkloadStatus
  ip: string
  mem: number
  vcpu: number
  hypervisor: string
  diskSize?: number // Disk size in GB (default: 10)
  uptime: string | null
  distro?: string
  guestOs?: 'linux' | 'windows'
  provisioningState?: ProvisioningState
  provisioningError?: string
  autostart?: boolean
  description?: string
  tags?: string[]
  bridge?: string
  macAddress?: string
  tapInterface?: string
  runtime?: 'microvm' | 'docker' | 'podman' | 'apptainer'
  containerId?: string
  image?: string
  ports?: string[]
}

export type { WorkloadDefinition, ProvisioningState }

let registry: WorkloadRegistry
let provisioner: Provisioner | null = null
let config: DashboardConfig | null = null

export function setRegistry(reg: WorkloadRegistry): void {
  registry = reg
}

export function setProvisioner(p: Provisioner | null): void {
  provisioner = p
}

export function setConfig(c: DashboardConfig): void {
  config = c
}

export function getConfig(): DashboardConfig | null {
  return config
}

/** Check if a VM is a QEMU-managed VM (cloud-init or ISO-install, not NixOS).
 *  Accepts a WorkloadDefinition directly. */
function isCloudDef(def: WorkloadDefinition): boolean {
  if (!provisioner) return false
  // Check image catalog (cloud-init or ISO)
  if (provisioner.isQemuVm(def.distro)) return true
  // Fallback: VM has QEMU provisioning metadata (distro definition may have been deleted)
  if (def.tapInterface && def.macAddress && def.distro && def.distro !== 'nixos') return true
  return false
}

async function isCloudVm(name: string): Promise<boolean> {
  if (!provisioner) return false
  const def = await registry.get(name)
  return def ? isCloudDef(def) : false
}

// --- Container runtime helpers ---

type ContainerRuntime = 'docker' | 'podman'

function isContainerDef(def: WorkloadDefinition): boolean {
  return def.runtime === 'docker' || def.runtime === 'podman'
}

function getContainerBin(runtime: ContainerRuntime): string {
  if (runtime === 'docker') return config?.dockerBin ?? 'docker'
  return config?.podmanBin ?? 'podman'
}

async function getContainerStatus(name: string, runtime: ContainerRuntime): Promise<WorkloadStatus> {
  try {
    const bin = getContainerBin(runtime)
    const { stdout } = await execFileAsync(bin, ['inspect', '--format', '{{.State.Status}}', name])
    const state = stdout.trim()
    if (state === STATUSES.RUNNING) return STATUSES.RUNNING
    if (state === 'exited')  return STATUSES.STOPPED
    if (state === 'paused')  return STATUSES.IDLE
    if (state === 'dead')    return STATUSES.FAILED
    return STATUSES.UNKNOWN
  } catch {
    return STATUSES.UNKNOWN
  }
}

async function getContainerUptime(name: string, runtime: ContainerRuntime): Promise<string | null> {
  try {
    const bin = getContainerBin(runtime)
    const { stdout } = await execFileAsync(bin, ['inspect', '--format', '{{.State.StartedAt}}', name])
    const ts = stdout.trim()
    if (!ts) return null
    return ts
  } catch {
    return null
  }
}

export async function getVmStatus(name: string): Promise<WorkloadStatus> {
  const def = await registry.get(name)
  if (def && isContainerDef(def)) {
    return getContainerStatus(name, def.runtime as ContainerRuntime)
  }

  if (provisioner && await isCloudVm(name)) {
    return provisioner.getCloudVmStatus(name)
  }

  const systemctl = config?.systemctlBin ?? 'systemctl'
  const unit = `microvm@${name}.service`

  // systemctl exits non-zero for inactive/failed states but still writes to stdout — capture both
  async function sysctl(...args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync(systemctl, args)
      return stdout.trim()
    } catch (err: unknown) {
      return ((err as { stdout?: string }).stdout ?? '').trim()
    }
  }

  const active = await sysctl('is-active', unit)
  if (active === 'active')   return STATUSES.RUNNING
  if (active === STATUSES.FAILED)   return STATUSES.FAILED
  if (active === 'inactive') {
    // Distinguish intentional stop (idle) from anomalous stop (stopped).
    // is-enabled returns 'enabled' when the unit starts on boot — if it's
    // inactive despite being enabled, something unexpected stopped it.
    const enabled = await sysctl('is-enabled', unit)
    return enabled === 'enabled' ? STATUSES.STOPPED : STATUSES.IDLE
  }
  return STATUSES.UNKNOWN
}

export async function getVmUptime(name: string): Promise<string | null> {
  const def = await registry.get(name)
  if (def && isContainerDef(def)) {
    return getContainerUptime(name, def.runtime as ContainerRuntime)
  }

  if (provisioner && await isCloudVm(name)) {
    return provisioner.getCloudVmUptime(name)
  }
  try {
    const { stdout } = await execFileAsync(config?.systemctlBin ?? 'systemctl', [
      'show', `microvm@${name}.service`, '--property=ActiveEnterTimestamp', '--value'
    ])
    const timestamp = stdout.trim()
    if (!timestamp || timestamp === '') return null
    return timestamp
  } catch {
    return null
  }
}

export async function listVms(): Promise<WorkloadInfo[]> {
  const defs = await registry.getAll()
  const entries = Object.entries(defs)

  // Phase 1: fetch all statuses in parallel
  const statuses = await Promise.all(entries.map(([name]) => getVmStatus(name)))

  // Phase 2: fetch uptimes in parallel (only for running VMs)
  const uptimes = await Promise.all(
    entries.map(([name], i) =>
      statuses[i] === STATUSES.RUNNING ? getVmUptime(name) : Promise.resolve(null)
    )
  )

  return entries.map(([, def], i) => ({ ...def, status: statuses[i], uptime: uptimes[i] }))
}

export async function getVm(name: string): Promise<WorkloadInfo | null> {
  const def = await registry.get(name)
  if (!def) return null
  const status = await getVmStatus(name)
  const uptime = status === STATUSES.RUNNING ? await getVmUptime(name) : null
  return { ...def, status, uptime }
}

function isProvisionedOrLegacy(def: WorkloadDefinition): boolean {
  return !def.provisioningState || def.provisioningState === PROVISIONING.PROVISIONED
}

export async function startVm(name: string): Promise<{ success: boolean; message: string }> {
  const def = await registry.get(name)
  if (!def) return { success: false, message: `VM '${name}' not found` }
  if (!isProvisionedOrLegacy(def)) {
    return { success: false, message: `VM '${name}' is not provisioned (state: ${def.provisioningState})` }
  }

  // Container workloads: delegate to docker/podman
  if (isContainerDef(def)) {
    try {
      const bin = getContainerBin(def.runtime as ContainerRuntime)
      await execFileAsync(bin, ['start', name])
      return { success: true, message: `Container '${name}' started` }
    } catch (err) {
      console.error(`[microvm] Failed to start container '${name}':`, err)
      return { success: false, message: `Failed to start container '${name}'. Check server logs for details.` }
    }
  }

  // Cloud VMs: delegate to provisioner (dashboard-managed QEMU process)
  if (provisioner && isCloudDef(def)) {
    return provisioner.startCloudVm(name)
  }

  // NixOS VMs: use systemctl
  try {
    await execFileAsync(config?.sudoBin ?? 'sudo', [config?.systemctlBin ?? 'systemctl', 'start', `microvm@${name}.service`])
    const status = await getVmStatus(name)
    if (status !== STATUSES.RUNNING) {
      return { success: false, message: `VM '${name}' failed to start (status: ${status})` }
    }
    return { success: true, message: `VM '${name}' started` }
  } catch (err) {
    console.error(`[microvm] Failed to start VM '${name}':`, err)
    return { success: false, message: `Failed to start VM '${name}'. Check server logs for details.` }
  }
}

export async function stopVm(name: string): Promise<{ success: boolean; message: string }> {
  const def = await registry.get(name)
  if (!def) return { success: false, message: `VM '${name}' not found` }
  if (!isProvisionedOrLegacy(def)) {
    return { success: false, message: `VM '${name}' is not provisioned (state: ${def.provisioningState})` }
  }

  // Container workloads: delegate to docker/podman
  if (isContainerDef(def)) {
    try {
      const bin = getContainerBin(def.runtime as ContainerRuntime)
      await execFileAsync(bin, ['stop', name])
      return { success: true, message: `Container '${name}' stopped` }
    } catch (err) {
      console.error(`[microvm] Failed to stop container '${name}':`, err)
      return { success: false, message: `Failed to stop container '${name}'. Check server logs for details.` }
    }
  }

  // Cloud VMs: delegate to provisioner
  if (provisioner && isCloudDef(def)) {
    return provisioner.stopCloudVm(name)
  }

  // NixOS VMs: use systemctl
  try {
    await execFileAsync(config?.sudoBin ?? 'sudo', [config?.systemctlBin ?? 'systemctl', 'stop', `microvm@${name}.service`])
    return { success: true, message: `VM '${name}' stopped` }
  } catch (err) {
    console.error(`[microvm] Failed to stop VM '${name}':`, err)
    return { success: false, message: `Failed to stop VM '${name}'. Check server logs for details.` }
  }
}

export async function restartVm(name: string): Promise<{ success: boolean; message: string }> {
  const def = await registry.get(name)
  if (!def) return { success: false, message: `VM '${name}' not found` }
  if (!isProvisionedOrLegacy(def)) {
    return { success: false, message: `VM '${name}' is not provisioned (state: ${def.provisioningState})` }
  }

  // Container workloads: delegate to docker/podman
  if (isContainerDef(def)) {
    try {
      const bin = getContainerBin(def.runtime as ContainerRuntime)
      await execFileAsync(bin, ['restart', name])
      return { success: true, message: `Container '${name}' restarted` }
    } catch (err) {
      console.error(`[microvm] Failed to restart container '${name}':`, err)
      return { success: false, message: `Failed to restart container '${name}'. Check server logs for details.` }
    }
  }

  // Cloud VMs: stop then start via provisioner
  if (provisioner && isCloudDef(def)) {
    await provisioner.stopCloudVm(name)
    return provisioner.startCloudVm(name)
  }

  // NixOS VMs: use systemctl
  try {
    await execFileAsync(config?.sudoBin ?? 'sudo', [config?.systemctlBin ?? 'systemctl', 'restart', `microvm@${name}.service`])
    const status = await getVmStatus(name)
    if (status !== STATUSES.RUNNING) {
      return { success: false, message: `VM '${name}' failed to restart (status: ${status})` }
    }
    return { success: true, message: `VM '${name}' restarted` }
  } catch (err) {
    console.error(`[microvm] Failed to restart VM '${name}':`, err)
    return { success: false, message: `Failed to restart VM '${name}'. Check server logs for details.` }
  }
}

export async function createVm(vm: WorkloadDefinition): Promise<{ success: boolean; message: string }> {
  const added = await registry.add(vm)
  if (!added) return { success: false, message: `VM '${vm.name}' already exists` }
  return { success: true, message: `VM '${vm.name}' registered` }
}

export async function deleteVm(name: string): Promise<{ success: boolean; message: string }> {
  const status = await getVmStatus(name)
  if (status === STATUSES.RUNNING) {
    return { success: false, message: `VM '${name}' is running. Stop it before deleting.` }
  }
  const removed = await registry.remove(name)
  if (!removed) return { success: false, message: `VM '${name}' not found` }
  return { success: true, message: `VM '${name}' deleted` }
}

export async function getWorkloadDefinitions(): Promise<Record<string, WorkloadDefinition>> {
  return registry.getAll()
}

export async function removeVm(name: string): Promise<{ success: boolean; message: string }> {
  const def = await registry.get(name)
  if (!def) return { success: false, message: `VM '${name}' not found` }

  // Best-effort stop before removing
  try {
    await execFileAsync(config?.sudoBin ?? 'sudo', [config?.systemctlBin ?? 'systemctl', 'stop', `microvm@${name}.service`])
  } catch {
    // VM may already be stopped or service may not exist — that's fine
  }

  const removed = await registry.remove(name)
  if (!removed) return { success: false, message: `Failed to remove VM '${name}'` }
  return { success: true, message: `VM '${name}' removed` }
}

export async function addVm(def: { name: string; ip?: string; mem?: number; vcpu?: number; hypervisor?: string }): Promise<{ success: boolean; message: string }> {
  if (await registry.has(def.name)) {
    return { success: false, message: `VM '${def.name}' already exists` }
  }

  await registry.add({
    name: def.name,
    ip: def.ip ?? '',
    mem: def.mem ?? 0,
    vcpu: def.vcpu ?? 0,
    hypervisor: def.hypervisor ?? 'unknown',
  })
  return { success: true, message: `VM '${def.name}' added` }
}

export async function updateVmField(name: string, fields: Partial<WorkloadDefinition>): Promise<{ success: boolean; message: string }> {
  const updated = await registry.update(name, fields)
  if (!updated) return { success: false, message: `VM '${name}' not found` }
  return { success: true, message: `VM '${name}' updated` }
}

export interface ScanResult {
  discovered: string[]
  added: string[]
  existing: string[]
}

/**
 * Read microvm specs from the NixOS-generated run script at
 * /var/lib/microvms/<name>/current/bin/microvm-run.
 * Parses QEMU/cloud-hypervisor/firecracker flags for memory, vCPU, and hypervisor.
 */
async function readMicrovmSpecs(name: string): Promise<{ mem: number; vcpu: number; hypervisor: string }> {
  const defaults = { mem: 0, vcpu: 0, hypervisor: 'unknown' }
  try {
    const script = await readFile(`/var/lib/microvms/${name}/current/bin/microvm-run`, 'utf-8')

    // Detect hypervisor from the binary path
    let hypervisor = 'unknown'
    if (script.includes('qemu-system-')) hypervisor = 'qemu'
    else if (script.includes('cloud-hypervisor')) hypervisor = 'cloud-hypervisor'
    else if (script.includes('firecracker')) hypervisor = 'firecracker'
    else if (script.includes('crosvm')) hypervisor = 'crosvm'
    else if (script.includes('kvmtool')) hypervisor = 'kvmtool'

    // Parse memory: QEMU uses -m <MB>, cloud-hypervisor uses --memory size=<MB>M
    let mem = 0
    const qemuMem = script.match(/-m\s+(\d+)/)
    if (qemuMem) mem = parseInt(qemuMem[1], 10)
    if (!mem) {
      const chMem = script.match(/--memory\s+size=(\d+)M/)
      if (chMem) mem = parseInt(chMem[1], 10)
    }

    // Parse vCPU: QEMU uses -smp <N>, cloud-hypervisor uses --cpus boot=<N>
    let vcpu = 0
    const qemuSmp = script.match(/-smp\s+(\d+)/)
    if (qemuSmp) vcpu = parseInt(qemuSmp[1], 10)
    if (!vcpu) {
      const chCpu = script.match(/--cpus\s+boot=(\d+)/)
      if (chCpu) vcpu = parseInt(chCpu[1], 10)
    }

    return { mem, vcpu, hypervisor }
  } catch {
    return defaults
  }
}

export async function scanMicrovms(): Promise<ScanResult> {
  const systemctl = config?.systemctlBin ?? 'systemctl'
  const discovered: string[] = []
  const added: string[] = []
  const existing: string[] = []

  try {
    const { stdout } = await execFileAsync(systemctl, [
      'list-units', 'microvm@*.service', '--no-legend', '--plain', '--all'
    ])

    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue
      // Format: "microvm@<name>.service loaded active running ..."
      const match = line.match(/^microvm@([^.]+)\.service\s/)
      if (!match) continue
      const name = match[1]
      discovered.push(name)

      if (await registry.has(name)) {
        existing.push(name)
      } else {
        const specs = await readMicrovmSpecs(name)
        await registry.add({ name, ip: '', ...specs })
        added.push(name)
      }
    }
  } catch {
    // systemctl list-units returns exit code 1 when no units match — not an error
  }

  return { discovered, added, existing }
}

/**
 * Discover containers managed by docker or podman and register any new ones.
 * Uses `<bin> ps -a --format '{{json .}}'` — one JSON object per line.
 * If the runtime binary is not installed, returns an empty result (not an error).
 */
export async function scanContainers(runtime: ContainerRuntime): Promise<ScanResult> {
  const discovered: string[] = []
  const added: string[] = []
  const existing: string[] = []

  try {
    const bin = getContainerBin(runtime)
    const { stdout } = await execFileAsync(bin, ['ps', '-a', '--format', '{{json .}}'])

    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue

      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(line) as Record<string, unknown>
      } catch {
        continue
      }

      // Docker and Podman both use 'Names' (string) and 'ID', 'Image', 'State', 'Ports'
      const rawName = typeof parsed['Names'] === 'string' ? parsed['Names'] : null
      if (!rawName) continue
      // Strip leading '/' (Docker prefixes container names with '/')
      const name = rawName.startsWith('/') ? rawName.slice(1) : rawName
      if (!name) continue

      const id = typeof parsed['ID'] === 'string' ? parsed['ID'] : undefined
      const image = typeof parsed['Image'] === 'string' ? parsed['Image'] : undefined
      const rawPorts = typeof parsed['Ports'] === 'string' ? parsed['Ports'] : ''
      // Split comma-separated port mappings, filter empties
      const ports = rawPorts ? rawPorts.split(',').map(p => p.trim()).filter(Boolean) : []

      discovered.push(name)

      if (await registry.has(name)) {
        existing.push(name)
      } else {
        await registry.add({
          name,
          ip: '',
          mem: 0,
          vcpu: 0,
          hypervisor: runtime,
          runtime,
          containerId: id,
          image,
          ports: ports.length > 0 ? ports : undefined,
        })
        added.push(name)
      }
    }
  } catch {
    // Binary not found or returned non-zero — treat as not installed, return empty result
  }

  return { discovered, added, existing }
}

export async function startAutostartVms(log: { info: (msg: string) => void; error: (msg: string) => void }): Promise<void> {
  const allDefs = await registry.getAll()
  for (const [name, def] of Object.entries(allDefs)) {
    if (!def.autostart) continue
    const status = await getVmStatus(name)
    if (status === STATUSES.RUNNING) continue
    try {
      await startVm(name)
      log.info(`Autostarted VM: ${name}`)
    } catch (err) {
      log.error(`Failed to autostart VM ${name}: ${err}`)
    }
  }
}

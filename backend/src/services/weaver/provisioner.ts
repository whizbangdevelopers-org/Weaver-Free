// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { mkdir, rm, appendFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { userInfo } from 'node:os'
import type { WorkloadRegistry, WorkloadDefinition, ProvisioningState } from '../../storage/workload-registry.js'
import { ImageManager } from '../image-manager.js'
import type { DashboardConfig } from '../../config.js'
import { provisioningEvents, type ProvisioningEvent, type Provisioner as IProvisioner } from '../provisioner-types.js'
import { PROVISIONING, STATUSES } from '../../constants/vocabularies.js'

export type { ProvisioningEvent }
export { provisioningEvents }

const execFileAsync = promisify(execFile)

interface CloudVmProcess {
  child: ChildProcess
  startedAt: Date
  /** Set when explicit stop is in progress — suppresses teardown in the close handler */
  stopping?: boolean
}

export class Provisioner implements IProvisioner {
  private registry: WorkloadRegistry
  private imageManager: ImageManager
  private config: DashboardConfig
  private logsDir: string
  /** Tracked QEMU processes for cloud VMs (not managed by systemd) */
  private cloudProcesses: Map<string, CloudVmProcess> = new Map()

  constructor(
    registry: WorkloadRegistry,
    imageManager: ImageManager,
    config: DashboardConfig,
  ) {
    this.registry = registry
    this.imageManager = imageManager
    this.config = config
    this.logsDir = join(config.dataDir, 'logs')
  }

  /** Generate a deterministic MAC address from VM name (locally-administered range) */
  private generateMacAddress(name: string): string {
    const hash = createHash('sha256').update(name).digest('hex')
    // 02:xx:xx:xx:xx:xx — locally administered, unicast
    return `02:${hash.slice(0, 2)}:${hash.slice(2, 4)}:${hash.slice(4, 6)}:${hash.slice(6, 8)}:${hash.slice(8, 10)}`
  }

  /** Generate TAP interface name, max 15 chars (Linux IFNAMESIZE) */
  private generateTapName(name: string): string {
    const tap = `vm-${name}`
    return tap.slice(0, 15)
  }

  /** Start all QEMU VMs that have autostart=true and are provisioned.
   *  Called on dashboard startup for boot persistence. */
  async autostartCloudVms(): Promise<void> {
    const vms = Object.values(await this.registry.getAll())
    let started = 0
    for (const vm of vms) {
      if (vm.provisioningState !== PROVISIONING.PROVISIONED) continue
      if (!this.isQemuVm(vm.distro)) continue
      if (!vm.autostart) continue

      try {
        await this.startCloudVm(vm.name)
        started++
      } catch {
        // Log but don't fail startup
      }
    }
    if (started > 0) {
      await this.appendLog('_autostart', `Auto-started ${started} cloud VM(s)`)
    }
  }

  /** Provision a VM asynchronously. Updates registry state and emits events. */
  async provision(name: string): Promise<void> {
    const vm = await this.registry.get(name)
    if (!vm) throw new Error(`VM '${name}' not found in registry`)

    // Determine provisioning path (flake = unsupported, iso = manual install, cloud = cloud-init, adhoc = other)
    const isAdHoc = vm.distro === 'other' && !!vm.imageUrl
    const isFlake = !isAdHoc && this.imageManager.isFlakeDistro(vm.distro)
    const isIso = !isAdHoc && !isFlake && this.imageManager.isIsoDistro(vm.distro)
    const isCloud = !isAdHoc && !isFlake && !isIso && this.imageManager.isCloudDistro(vm.distro)

    if (isFlake) {
      throw new Error('NixOS flake provisioning is not supported in this version. Use cloud-init or ISO distros.')
    }

    // Fill in MAC and TAP if missing
    if (!vm.macAddress) {
      vm.macAddress = this.generateMacAddress(name)
    }
    if (!vm.tapInterface) {
      vm.tapInterface = this.generateTapName(name)
    }

    // Allocate console port if not already set
    if (!vm.consolePort) {
      const consoleType = vm.vmType === 'desktop' ? 'vnc' : 'serial'
      vm.consolePort = ImageManager.allocateConsolePort(name, consoleType === 'vnc' ? 'vnc' : 'serial')
      vm.consoleType = consoleType
    }

    await this.updateState(name, PROVISIONING.PROVISIONING, 'Starting provisioning...')

    // Save MAC/TAP/console to registry, default autostart to true for new VMs
    await this.registry.add({ ...vm, provisioningState: PROVISIONING.PROVISIONING, autostart: vm.autostart ?? true })

    try {
      if (isAdHoc) {
        await this.provisionAdHocVm(vm)
      } else if (isIso) {
        await this.provisionIsoVm(vm)
      } else if (isCloud) {
        await this.provisionCloudVm(vm)
      } else {
        throw new Error(`Unknown distro type '${vm.distro ?? 'none'}' — not recognized as cloud, ISO, or flake. Check that the distro catalog is loaded.`)
      }

      await this.updateState(name, PROVISIONING.PROVISIONED, 'Provisioning complete')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown provisioning error'
      await this.updateState(name, PROVISIONING.PROVISION_FAILED, undefined, errorMsg)
      await this.appendLog(name, `ERROR: ${errorMsg}`)
    }
  }

  /** Destroy a VM: stop, clean up files, remove from registry */
  async destroy(name: string): Promise<void> {
    const vm = await this.registry.get(name)
    if (!vm) throw new Error(`VM '${name}' not found in registry`)

    const isQemu = this.isQemuVm(vm.distro)

    await this.updateState(name, PROVISIONING.DESTROYING, 'Stopping and cleaning up...')

    // Stop the VM if running (with timeout to avoid hanging on broken VMs)
    if (isQemu) {
      await this.stopCloudProcess(name)
    } else {
      try {
        await execFileAsync(this.config.sudoBin, [
          this.config.systemctlBin, 'stop', `microvm@${name}.service`,
        ], { timeout: 15_000 })
      } catch {
        // VM might not be running or stop timed out — proceed with cleanup
      }
    }

    // Clean up VM directory
    const vmDir = join(this.config.microvmsDir, name)
    try {
      await rm(vmDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist
    }

    // Remove from registry — after this the next WS vm-status broadcast
    // will no longer include the VM, causing the frontend to remove it.
    await this.registry.remove(name)
  }

  /** Start a cloud VM by spawning QEMU directly.
   *  Args are generated dynamically from WorkloadDefinition so mem/vcpu
   *  changes take effect on next start without re-provisioning. */
  async startCloudVm(name: string): Promise<{ success: boolean; message: string }> {
    if (this.cloudProcesses.has(name)) {
      return { success: true, message: `VM '${name}' is already running` }
    }

    const vm = await this.registry.get(name)
    if (!vm) {
      return { success: false, message: `VM '${name}' not found in registry` }
    }

    const tap = vm.tapInterface!

    // Create TAP interface and attach to bridge (requires sudo)
    try {
      await this.setupTap(tap)
      await this.appendLog(name, `TAP interface ${tap} created and attached to ${this.config.bridgeInterface}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      await this.appendLog(name, `Failed to create TAP interface: ${msg}`)
      return { success: false, message: `Failed to create TAP interface: ${msg}` }
    }

    const vmDir = join(this.config.microvmsDir, name)
    const diskPath = join(vmDir, 'disk.qcow2')
    const isAdHoc = vm.distro === 'other'
    const isIso = isAdHoc ? vm.imageFormat === 'iso' : this.imageManager.isIsoDistro(vm.distro)

    // Build QEMU args based on provisioning path
    const qemuOpts: Parameters<ImageManager['generateQemuArgs']>[1] = {
      diskPath,
      qemuBin: this.config.qemuBin,
      tapInterface: tap,
      macAddress: vm.macAddress!,
    }

    if (isIso) {
      // ISO-install VM: attach the install ISO as CDROM
      if (isAdHoc) {
        // Ad-hoc ISO: image stored as adhoc-{name}-base.iso
        qemuOpts.bootIso = join(this.config.dataDir, 'images', `adhoc-${name}-base.iso`)
      } else if (vm.distro) {
        const source = this.imageManager.getDistroSource(vm.distro)
        if (source) {
          const ext = source.format === 'qcow2' ? 'qcow2' : source.format
          qemuOpts.bootIso = join(this.config.dataDir, 'images', `${vm.distro}-base.${ext}`)
        }
      }
    } else if (isAdHoc && vm.cloudInit === false) {
      // Ad-hoc qcow2 without cloud-init: no ISO attachment, user configures via VNC
    } else {
      // Cloud-init VM: attach cloud-init ISO
      qemuOpts.cloudInitIso = join(vmDir, 'cloud-init.iso')
    }

    const qemuCmd = this.imageManager.generateQemuArgs(vm, qemuOpts)

    const child = spawn(qemuCmd.bin, qemuCmd.args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    })

    child.stdout?.on('data', (data: Buffer) => {
      this.appendLog(name, data.toString()).catch(() => {})
    })
    child.stderr?.on('data', (data: Buffer) => {
      this.appendLog(name, data.toString()).catch(() => {})
    })

    child.on('close', (code) => {
      const proc = this.cloudProcesses.get(name)
      this.cloudProcesses.delete(name)
      // Skip teardown if an explicit stop is handling it (avoids race on restart)
      if (!proc?.stopping) {
        this.teardownTap(tap).catch(() => {})
      }
      this.appendLog(name, `QEMU exited with code ${code}`).catch(() => {})
    })

    child.on('error', (err) => {
      const proc = this.cloudProcesses.get(name)
      this.cloudProcesses.delete(name)
      if (!proc?.stopping) {
        this.teardownTap(tap).catch(() => {})
      }
      this.appendLog(name, `QEMU error: ${err.message}`).catch(() => {})
    })

    this.cloudProcesses.set(name, { child, startedAt: new Date() })
    return { success: true, message: `VM '${name}' started` }
  }

  /** Stop a cloud VM by sending SIGTERM to its QEMU process */
  async stopCloudVm(name: string): Promise<{ success: boolean; message: string }> {
    const stopped = await this.stopCloudProcess(name)
    if (stopped) {
      return { success: true, message: `VM '${name}' stopped` }
    }
    return { success: false, message: `VM '${name}' is not running` }
  }

  /** Get the status of a cloud VM */
  getCloudVmStatus(name: string): typeof STATUSES.RUNNING | typeof STATUSES.STOPPED {
    return this.cloudProcesses.has(name) ? STATUSES.RUNNING : STATUSES.STOPPED
  }

  /** Get the start time of a running cloud VM */
  getCloudVmUptime(name: string): string | null {
    const proc = this.cloudProcesses.get(name)
    if (!proc) return null
    return proc.startedAt.toISOString()
  }

  /** Check if a distro is a cloud (non-NixOS) distro */
  isCloudDistro(distro?: string): boolean {
    return this.imageManager.isCloudDistro(distro)
  }

  /** Check if a distro is an ISO-install distro */
  isIsoDistro(distro?: string): boolean {
    return this.imageManager.isIsoDistro(distro)
  }

  /** Check if a distro is a flake-based NixOS distro (microvm.nix) */
  isFlakeDistro(distro?: string): boolean {
    return this.imageManager.isFlakeDistro(distro)
  }

  /** Check if a distro uses QEMU (cloud-init, ISO, or ad-hoc — not NixOS/flake) */
  isQemuVm(distro?: string): boolean {
    if (distro === 'other') return true // Ad-hoc images always use QEMU
    return this.imageManager.isCloudDistro(distro) || this.imageManager.isIsoDistro(distro)
  }

  /** Get the console port for a running cloud VM */
  async getConsolePort(name: string): Promise<number | null> {
    if (!this.cloudProcesses.has(name)) return null
    const vm = await this.registry.get(name)
    return vm?.consolePort ?? null
  }

  /** Get provisioning log content for a VM */
  async getLog(name: string): Promise<string> {
    // Defensive: validate VM name to prevent path traversal
    if (!/^[a-z][a-z0-9-]*$/.test(name)) return ''
    const logPath = join(this.logsDir, `${name}.log`)
    try {
      return await readFile(logPath, 'utf-8')
    } catch {
      return ''
    }
  }

  // --- Private methods ---

  private async provisionCloudVm(vm: WorkloadDefinition): Promise<void> {
    const name = vm.name
    const distro = vm.distro!

    await this.appendLog(name, `Downloading ${distro} cloud image...`)
    this.emit({ name, state: PROVISIONING.PROVISIONING, progress: `Downloading ${distro} cloud image...` })

    const baseImage = await this.imageManager.ensureImage(distro)
    await this.appendLog(name, `Base image ready: ${baseImage}`)

    await this.appendLog(name, 'Creating overlay disk...')
    this.emit({ name, state: PROVISIONING.PROVISIONING, progress: 'Creating overlay disk...' })

    const overlayPath = await this.imageManager.createOverlay(name, baseImage, vm.diskSize ?? 10)
    await this.appendLog(name, `Overlay created: ${overlayPath}`)

    await this.appendLog(name, 'Generating cloud-init config...')
    this.emit({ name, state: PROVISIONING.PROVISIONING, progress: 'Generating cloud-init config...' })

    const cloudInitIso = await this.imageManager.generateCloudInit(vm)
    await this.appendLog(name, `Cloud-init ISO: ${cloudInitIso}`)

    await this.appendLog(name, 'Cloud VM provisioned successfully')
  }

  private async provisionIsoVm(vm: WorkloadDefinition): Promise<void> {
    const name = vm.name
    const distro = vm.distro!
    const isWindows = vm.guestOs === 'windows'
    const diskSizeGB = vm.diskSize ?? (isWindows ? 40 : 10)

    await this.appendLog(name, `Downloading ${distro} ISO...`)
    this.emit({ name, state: PROVISIONING.PROVISIONING, progress: `Downloading ${distro} ISO...` })

    const isoPath = await this.imageManager.ensureImage(distro)
    await this.appendLog(name, `ISO ready: ${isoPath}`)

    await this.appendLog(name, `Creating blank ${diskSizeGB}G disk...`)
    this.emit({ name, state: PROVISIONING.PROVISIONING, progress: `Creating blank ${diskSizeGB}G disk...` })

    const diskPath = await this.imageManager.createBlankDisk(name, diskSizeGB)
    await this.appendLog(name, `Disk created: ${diskPath}`)

    // Force desktop mode for ISO installs (need VNC for manual installation)
    vm.vmType = 'desktop'
    vm.consoleType = 'vnc'
    // Re-allocate console port in VNC range (5900+) if currently in serial range
    if (vm.consolePort && vm.consolePort < 5900) {
      vm.consolePort = ImageManager.allocateConsolePort(name, 'vnc')
    }
    await this.registry.remove(name)
    await this.registry.add({ ...vm, provisioningState: PROVISIONING.PROVISIONING })

    await this.appendLog(name, `ISO VM provisioned — install via VNC console (port ${vm.consolePort})`)
  }

  private async provisionAdHocVm(vm: WorkloadDefinition): Promise<void> {
    const name = vm.name
    const url = vm.imageUrl!
    const format = vm.imageFormat ?? 'qcow2'
    const useCloudInit = vm.cloudInit ?? (format !== 'iso')

    await this.appendLog(name, `Downloading ad-hoc image from ${url}...`)
    this.emit({ name, state: PROVISIONING.PROVISIONING, progress: 'Downloading ad-hoc image...' })

    const baseImage = await this.imageManager.ensureImageFromUrl(name, url, format)
    await this.appendLog(name, `Image ready: ${baseImage}`)

    if (format === 'iso') {
      // ISO path: blank disk + boot from ISO (same as provisionIsoVm)
      const diskSizeGB = vm.diskSize ?? 10

      await this.appendLog(name, `Creating blank ${diskSizeGB}G disk...`)
      this.emit({ name, state: PROVISIONING.PROVISIONING, progress: `Creating blank ${diskSizeGB}G disk...` })

      await this.imageManager.createBlankDisk(name, diskSizeGB)

      // Force desktop mode for ISO installs (need VNC for manual installation)
      vm.vmType = 'desktop'
      vm.consoleType = 'vnc'
      if (vm.consolePort && vm.consolePort < 5900) {
        vm.consolePort = ImageManager.allocateConsolePort(name, 'vnc')
      }
      await this.registry.remove(name)
      await this.registry.add({ ...vm, provisioningState: PROVISIONING.PROVISIONING })

      await this.appendLog(name, `Ad-hoc ISO VM provisioned — install via VNC (port ${vm.consolePort})`)
    } else {
      // Cloud image path: overlay + optional cloud-init
      await this.appendLog(name, 'Creating overlay disk...')
      this.emit({ name, state: PROVISIONING.PROVISIONING, progress: 'Creating overlay disk...' })

      await this.imageManager.createOverlay(name, baseImage, vm.diskSize ?? 10)

      if (useCloudInit) {
        await this.appendLog(name, 'Generating cloud-init config...')
        this.emit({ name, state: PROVISIONING.PROVISIONING, progress: 'Generating cloud-init config...' })
        await this.imageManager.generateCloudInit(vm)
      }

      await this.appendLog(name, `Ad-hoc VM provisioned successfully${useCloudInit ? '' : ' (no cloud-init — configure via VNC)'}`)
    }
  }

  /** Stop a tracked cloud VM process and tear down its TAP interface.
   *  Waits for QEMU to exit before tearing down the TAP so a subsequent
   *  startCloudVm (restart) doesn't race against the old process. */
  private async stopCloudProcess(name: string): Promise<boolean> {
    const proc = this.cloudProcesses.get(name)
    if (!proc) return false

    // Flag so the close/error handlers skip their own teardown
    proc.stopping = true
    proc.child.kill('SIGTERM')

    // Wait for QEMU to actually exit (5 s timeout)
    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        proc.child.kill('SIGKILL')
        resolve()
      }, 5_000)
      proc.child.once('close', () => { clearTimeout(timeout); resolve() })
    })

    this.cloudProcesses.delete(name)

    // Tear down TAP interface after QEMU has released it
    const vm = await this.registry.get(name)
    if (vm?.tapInterface) {
      await this.teardownTap(vm.tapInterface).catch(() => {})
    }
    return true
  }

  /** Create a TAP interface, assign to current user, attach to bridge, bring up.
   *  Tears down any stale TAP with the same name first (crash recovery). */
  private async setupTap(tap: string): Promise<void> {
    const sudo = this.config.sudoBin
    const ip = this.config.ipBin
    const username = userInfo().username

    // Defensive: remove stale TAP from a previous crash
    await this.teardownTap(tap).catch(() => {})

    await execFileAsync(sudo, [ip, 'tuntap', 'add', tap, 'mode', 'tap', 'user', username])
    await execFileAsync(sudo, [ip, 'link', 'set', tap, 'master', this.config.bridgeInterface])
    await execFileAsync(sudo, [ip, 'link', 'set', tap, 'up'])
  }

  /** Remove a TAP interface */
  private async teardownTap(tap: string): Promise<void> {
    const sudo = this.config.sudoBin
    const ip = this.config.ipBin

    try {
      await execFileAsync(sudo, [ip, 'link', 'set', tap, 'down'])
    } catch { /* may already be down */ }
    try {
      await execFileAsync(sudo, [ip, 'tuntap', 'del', tap, 'mode', 'tap'])
    } catch { /* may already be gone */ }
  }

  private async updateState(
    name: string,
    state: ProvisioningState,
    progress?: string,
    error?: string,
  ): Promise<void> {
    const vm = await this.registry.get(name)
    if (vm) {
      // Update registry (re-add with same name replaces via remove+add)
      await this.registry.remove(name)
      await this.registry.add({
        ...vm,
        provisioningState: state,
        provisioningError: error,
      })
    }
    this.emit({ name, state, progress, error })
  }

  private emit(event: ProvisioningEvent): void {
    provisioningEvents.emit('state-change', event)
  }

  private async appendLog(name: string, message: string): Promise<void> {
    await mkdir(this.logsDir, { recursive: true })
    const logPath = join(this.logsDir, `${name}.log`)
    const timestamp = new Date().toISOString()
    await appendFile(logPath, `[${timestamp}] ${message}\n`, 'utf-8')
  }
}

export function createProvisioner(
  registry: WorkloadRegistry,
  imageManager: ImageManager,
  config: DashboardConfig,
): Provisioner {
  return new Provisioner(registry, imageManager, config)
}

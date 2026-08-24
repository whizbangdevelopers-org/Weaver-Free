// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { ServiceProbeSpec } from '../services/health-probe.js'

export type ProvisioningState =
  | 'registered'
  | 'provisioning'
  | 'provisioned'
  | 'provision-failed'
  | 'destroying'

export type VmType = 'server' | 'desktop'
export type GuestOs = 'linux' | 'windows'
export type Firmware = 'bios' | 'uefi'

export type WorkloadDefinition = {
  name: string
  ip: string
  mem: number
  vcpu: number
  hypervisor: string
  diskSize?: number // Disk size in GB (default: 10)
  distro?: string
  guestOs?: GuestOs
  vmType?: VmType
  /** Boot firmware. Absent = 'bios' (SeaBIOS). Windows 11 requires 'uefi'. */
  firmware?: Firmware
  /** Attach the virtio-win driver ISO. Windows guests only; see services/firmware.ts. */
  virtioDrivers?: boolean
  provisioningState?: ProvisioningState
  provisioningError?: string
  macAddress?: string
  tapInterface?: string
  autostart?: boolean
  description?: string
  tags?: string[]
  bridge?: string
  consoleType?: 'serial' | 'vnc'
  consolePort?: number
  imageUrl?: string // Ad-hoc image URL (when distro === 'other')
  imageFormat?: 'qcow2' | 'raw' | 'iso'
  cloudInit?: boolean
  runtime?: 'microvm' | 'docker' | 'podman' | 'apptainer' // default: undefined = microvm
  containerId?: string // docker/podman container ID
  image?: string // container image (analogous to distro for VMs)
  ports?: string[] // port mappings e.g. ["0.0.0.0:8080->80/tcp"]
  /**
   * Service health probes to run against this workload on every broadcast cycle.
   *
   * Stored WITHOUT `health` — that is computed per cycle by `runProbes` and never persisted. A
   * persisted health field would be a stale answer served with the authority of a live one, which
   * is worse than no answer: the dashboard would show green for a service that died while the
   * daemon was down.
   *
   * Configuring these is Solo and above (a mutation, so it follows the provisioning gate); SEEING
   * the resulting health is Free.
   */
  serviceProbes?: ServiceProbeSpec[]
}

export interface WorkloadRegistry {
  init(): Promise<void>
  getAll(): Promise<Record<string, WorkloadDefinition>>
  get(name: string): Promise<WorkloadDefinition | null>
  has(name: string): Promise<boolean>
  add(vm: WorkloadDefinition): Promise<boolean>
  remove(name: string): Promise<boolean>
  update(name: string, fields: Partial<WorkloadDefinition>): Promise<boolean>
}

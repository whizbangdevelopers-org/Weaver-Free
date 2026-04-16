// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
export type ProvisioningState =
  | 'registered'
  | 'provisioning'
  | 'provisioned'
  | 'provision-failed'
  | 'destroying'

export type VmType = 'server' | 'desktop'
export type GuestOs = 'linux' | 'windows'

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

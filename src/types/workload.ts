// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { WorkloadStatus, ProvisioningState as VocabProvisioningState } from 'src/constants/vocabularies'

export type ProvisioningState = VocabProvisioningState

export type VmType = 'server' | 'desktop'
export type GuestOs = 'linux' | 'windows'

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
  guestOs?: GuestOs
  vmType?: VmType
  provisioningState?: ProvisioningState
  provisioningError?: string
  consoleType?: 'serial' | 'vnc'
  consolePort?: number
  bridge?: string
  macAddress?: string
  tapInterface?: string
  autostart?: boolean
  description?: string
  tags?: string[]
  imageUrl?: string // Ad-hoc image URL (present when distro === 'other')
  runtime?: 'microvm' | 'docker' | 'podman' | 'apptainer'
  containerId?: string
  image?: string
  ports?: string[]
}

export type ImageFormat = 'qcow2' | 'raw' | 'iso'

export interface VmCreateInput {
  name: string
  ip: string
  mem: number
  vcpu: number
  hypervisor: string
  diskSize?: number // Disk size in GB (default: 10, range: 5-500)
  distro?: string
  vmType?: VmType
  autostart?: boolean
  description?: string
  tags?: string[]
  imageUrl?: string // Required when distro === 'other'
  imageFormat?: ImageFormat // Default: 'qcow2'
  cloudInit?: boolean // Default: true for qcow2, false for iso
}

export interface WorkloadActionResult {
  success: boolean
  message: string
  provisioningState?: string
}

export type WorkloadAction = 'start' | 'stop' | 'restart'

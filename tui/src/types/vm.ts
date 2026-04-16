// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { WorkloadStatus, ProvisioningState as VocabProvisioningState } from '../constants/vocabularies.js'

export type ProvisioningState = VocabProvisioningState

export type VmType = 'server' | 'desktop'
export type GuestOs = 'linux' | 'windows'

export interface VmInfo {
  name: string
  status: WorkloadStatus
  ip: string
  mem: number
  vcpu: number
  hypervisor: string
  diskSize?: number
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
}

export interface VmCreateInput {
  name: string
  ip: string
  mem: number
  vcpu: number
  hypervisor: string
  diskSize?: number
  distro?: string
  vmType?: VmType
  autostart?: boolean
  description?: string
  tags?: string[]
}

export interface VmActionResult {
  success: boolean
  message: string
  provisioningState?: string
}

export type VmAction = 'start' | 'stop' | 'restart'

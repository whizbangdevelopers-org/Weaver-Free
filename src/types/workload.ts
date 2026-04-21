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
  /**
   * Runtime utilization snapshot. Optional by design:
   *   - Demo data populates this so public-demo visitors see VMs as
   *     "alive" (non-zero CPU/memory) on the dashboard cards.
   *   - Production code may populate it later when per-VM metrics ship
   *     from the backend (v1.1 Resource Metrics feature). Until then,
   *     prod VMs have this field undefined and the card gauges don't
   *     render — zero visual cost.
   * Only meaningful for running VMs (no gauges shown otherwise).
   */
  liveMetrics?: {
    cpuPercent: number       // 0-100
    memUsedMb: number        // actual memory used (bytes / 1024 / 1024 / 1024 would be GB)
  }
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

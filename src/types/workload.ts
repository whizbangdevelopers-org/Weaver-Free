// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { WorkloadStatus, ProvisioningState as VocabProvisioningState } from 'src/constants/vocabularies'

export type ProvisioningState = VocabProvisioningState

export type VmType = 'server' | 'desktop'
export type GuestOs = 'linux' | 'windows'

/**
 * Health of one probed service inside a workload.
 *
 * Four states, not three, and the fourth is load-bearing: `unreachable` means the backend REFUSED
 * to probe the target (not a private address — see health-probe.ts's SSRF guard), which is a
 * configuration fault. Collapsing it into `unhealthy` would send someone debugging a service that
 * was never contacted.
 */
export type ProbeHealth = 'healthy' | 'unhealthy' | 'unknown' | 'unreachable'

export interface WorkloadServiceProbe {
  port: number
  type: 'http' | 'tcp'
  /** HTTP only — the URL the "Open" button uses. Private-range only, enforced backend-side. */
  url?: string
  /** Display name, e.g. "Nginx", "PostgreSQL". */
  label?: string
  health: ProbeHealth
}

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
  /**
   * Network-ownership phase A — `bridge` is set and is NOT the Weaver-managed bridge.
   *
   * Computed by the backend, never here: the frontend has no access to
   * `services.weaver.bridgeInterface`, so a UI-side comparison would need the config exposed AND
   * a second copy of the predicate. One comparison site is the whole point — the UI and phase B's
   * enforcement must not be able to disagree about what "divergent" means.
   */
  networkDivergent?: boolean
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
   * Per-service health for this workload, computed backend-side each broadcast and delivered on
   * the existing `vm-status` payload — no protocol change.
   *
   * `status` answers "is the workload running"; this answers "does the service inside it reply".
   * A workload can be `running` with a crashed nginx, which is the gap these close.
   */
  serviceProbes?: WorkloadServiceProbe[]
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
/** Boot firmware. 'uefi' means OVMF, which Windows 11 requires. */
export type Firmware = 'bios' | 'uefi'

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
  firmware?: Firmware // Default: 'bios'. Windows 11 requires 'uefi'.
  virtioDrivers?: boolean // Attach the virtio-win driver ISO. Windows guests only.
}

export interface WorkloadActionResult {
  success: boolean
  message: string
  provisioningState?: string
}

/**
 * One workload's exportable configuration.
 *
 * Deliberately NOT `Partial<WorkloadInfo>`: an export carries configuration only, so the runtime
 * fields (`status`, `uptime`, `provisioningState`, `containerId`, `tapInterface`, `consolePort`)
 * are absent by design. Typing it as a partial of the runtime shape would make those fields look
 * merely optional rather than excluded, and the next person to write an importer would reach for
 * one and find it always undefined.
 */
export interface ExportedWorkload {
  name: string
  ip: string
  mem: number
  vcpu: number
  hypervisor: string
  diskSize?: number
  distro?: string
  guestOs?: GuestOs
  vmType?: string
  macAddress?: string
  autostart?: boolean
  description?: string
  tags?: string[]
  bridge?: string
  consoleType?: 'serial' | 'vnc'
  imageUrl?: string
  imageFormat?: ImageFormat
  cloudInit?: boolean
  runtime?: 'microvm' | 'docker' | 'podman' | 'apptainer'
  image?: string
  ports?: string[]
}

/** The export file's envelope. `version` is what a future importer branches on. */
export interface ExportDocument {
  version: string
  exportedAt: string
  workloads: ExportedWorkload[]
}

export type WorkloadAction = 'start' | 'stop' | 'restart'

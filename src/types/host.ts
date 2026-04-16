// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
export interface BasicLiveMetrics {
  cpuUsagePercent: number
  freeMemMb: number
  rootDiskUsedGb: number
  rootDiskTotalGb: number
  rootDiskUsedPercent: number
  netRxBytesPerSec: number
  netTxBytesPerSec: number
  loadAvg1: number
  loadAvg5: number
  loadAvg15: number
}

export interface HostBasicInfo {
  hostname: string
  ipAddress: string | null
  arch: string
  cpuModel: string
  cpuCount: number
  totalMemMb: number
  kernelVersion: string
  uptimeSeconds: number
  kvmAvailable: boolean
  liveMetrics?: BasicLiveMetrics
}

export interface CpuTopology {
  sockets: number | null
  coresPerSocket: number | null
  threadsPerCore: number | null
  virtualizationType: string | null
  l1dCache: string | null
  l1iCache: string | null
  l2Cache: string | null
  l3Cache: string | null
}

export interface DiskUsage {
  filesystem: string
  sizeHuman: string
  usedHuman: string
  availHuman: string
  usePercent: number
  mountPoint: string
}

export interface NetworkInterfaceInfo {
  name: string
  state: 'UP' | 'DOWN' | 'UNKNOWN'
  macAddress: string | null
}

export interface LiveMetrics {
  freeMemMb: number
  loadAvg1: number
  loadAvg5: number
  loadAvg15: number
}

export interface HostDetailedInfo {
  nixosVersion: string | null
  cpuTopology: CpuTopology | null
  diskUsage: DiskUsage[]
  networkInterfaces: NetworkInterfaceInfo[]
  liveMetrics: LiveMetrics
}

// ── Doctor (System Health) ───────────────────────────────────��───────

export interface DoctorCheck {
  check: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
  remediation: string | null
}

export interface DoctorResult {
  timestamp: string
  durationMs: number
  summary: {
    total: number
    passed: number
    warned: number
    failed: number
    result: 'pass' | 'warn' | 'fail'
  }
  checks: DoctorCheck[]
}

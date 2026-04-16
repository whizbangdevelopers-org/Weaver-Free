// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { z } from 'zod'

export const cpuTopologySchema = z.object({
  sockets: z.number().int().nullable(),
  coresPerSocket: z.number().int().nullable(),
  threadsPerCore: z.number().int().nullable(),
  virtualizationType: z.string().nullable(),
  l1dCache: z.string().nullable(),
  l1iCache: z.string().nullable(),
  l2Cache: z.string().nullable(),
  l3Cache: z.string().nullable(),
})

export const diskUsageSchema = z.object({
  filesystem: z.string(),
  sizeHuman: z.string(),
  usedHuman: z.string(),
  availHuman: z.string(),
  usePercent: z.number().int().min(0).max(100),
  mountPoint: z.string(),
})

export const networkInterfaceSchema = z.object({
  name: z.string(),
  state: z.enum(['UP', 'DOWN', 'UNKNOWN']),
  macAddress: z.string().nullable(),
})

export const liveMetricsSchema = z.object({
  freeMemMb: z.number().int(),
  loadAvg1: z.number(),
  loadAvg5: z.number(),
  loadAvg15: z.number(),
})

export const basicLiveMetricsSchema = z.object({
  cpuUsagePercent: z.number().int().min(0).max(100),
  freeMemMb: z.number().int(),
  rootDiskUsedGb: z.number().int(),
  rootDiskTotalGb: z.number().int(),
  rootDiskUsedPercent: z.number().int().min(0).max(100),
  netRxBytesPerSec: z.number().int(),
  netTxBytesPerSec: z.number().int(),
  loadAvg1: z.number(),
  loadAvg5: z.number(),
  loadAvg15: z.number(),
})

export const basicHostInfoSchema = z.object({
  hostname: z.string(),
  ipAddress: z.string().nullable(),
  arch: z.string(),
  cpuModel: z.string(),
  cpuCount: z.number().int(),
  totalMemMb: z.number().int(),
  kernelVersion: z.string(),
  uptimeSeconds: z.number().int(),
  kvmAvailable: z.boolean(),
  liveMetrics: basicLiveMetricsSchema.optional(),
})

export const detailedHostInfoSchema = z.object({
  nixosVersion: z.string().nullable(),
  cpuTopology: cpuTopologySchema.nullable(),
  diskUsage: z.array(diskUsageSchema),
  networkInterfaces: z.array(networkInterfaceSchema),
  liveMetrics: liveMetricsSchema,
})

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

export interface NetworkInterface {
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

export interface BasicHostInfo {
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

export interface DetailedHostInfo {
  nixosVersion: string | null
  cpuTopology: CpuTopology | null
  diskUsage: DiskUsage[]
  networkInterfaces: NetworkInterface[]
  liveMetrics: LiveMetrics
}

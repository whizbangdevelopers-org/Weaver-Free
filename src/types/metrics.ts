// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
export interface MetricPoint {
  timestamp: string
  cpuPercent: number
  memoryMb: number
  diskReadMbps: number
  diskWriteMbps: number
}

export interface VmMetrics {
  vmName: string
  resolution: '1m' | '5m'
  points: MetricPoint[]
}

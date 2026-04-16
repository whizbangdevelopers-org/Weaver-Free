// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/** Fleet bridge endpoint — a workload on a specific host. */
export interface FleetEndpoint {
  id: string
  hostId: string
  workloadName: string
  weight: number
  localBridge: string
  health: 'healthy' | 'degraded' | 'unhealthy' | 'draining'
  autoRegistered: boolean
  gpuVendor?: 'nvidia' | 'amd' | 'intel' | null
}

/** Blue/green deployment state. */
export interface BlueGreenState {
  phase: string
  blueEndpointId: string
  greenEndpointId: string
  blueWeight: number
  greenWeight: number
  startedAt: string
  initiatedBy: string | null
}

/** Fleet virtual bridge (internal decision). */
export interface FleetBridge {
  name: string
  label: string
  workloadGroupId: string
  overlay: 'vxlan' | 'wireguard'
  overlaySegment: string
  subnet: string
  endpoints: FleetEndpoint[]
  health: 'healthy' | 'degraded' | 'unhealthy'
  blueGreen: BlueGreenState | null
  replaces: string
  policy: {
    balanceMode: string
    defaultWeightRule: string
    healthCheckIntervalSec: number
    drainTimeoutSec: number
  }
}

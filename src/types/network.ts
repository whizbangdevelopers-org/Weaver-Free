// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { WorkloadStatus } from 'src/constants/vocabularies'

export interface BridgeInfo {
  name: string
  gateway: string
  subnet: string
  type?: 'vm' | 'container'
  runtime?: 'docker' | 'podman'
}

export interface NetworkNode {
  name: string
  ip: string
  macAddress?: string
  tapInterface?: string
  status: WorkloadStatus
  hypervisor: string
  distro?: string
  guestOs?: 'linux' | 'windows'
  bridge?: string
  mem?: number
  vcpu?: number
  uptime?: string | null
  description?: string
  tags?: string[]
  autostart?: boolean
  nodeType?: 'vm' | 'container'
  vmType?: 'server' | 'desktop'
  containerRuntime?: 'docker' | 'podman' | 'apptainer'
  servicePorts?: string[]
}

export interface NetworkTopology {
  bridges: BridgeInfo[]
  nodes: NetworkNode[]
}

// Weaver Solo+ types

export interface IpPoolConfig {
  start: string
  end: string
  allocated: string[]
}

export interface FirewallRule {
  id: string
  source: string
  destination: string
  port: number
  protocol: 'tcp' | 'udp'
  action: 'allow' | 'deny'
}

export interface VmNetworkConfig {
  ip?: string
  bridge?: string
  gateway?: string
  dns?: string
}

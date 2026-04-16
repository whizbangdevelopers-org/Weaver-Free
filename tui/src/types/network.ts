// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
export interface BridgeInfo {
  name: string
  gateway: string
  subnet: string
}

export interface NetworkNode {
  name: string
  ip: string
  bridge: string
  status: string
  hypervisor?: string
  distro?: string
}

export interface NetworkTopology {
  bridges: BridgeInfo[]
  nodes: NetworkNode[]
}

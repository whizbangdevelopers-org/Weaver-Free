// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

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

export interface BridgeDefinition {
  name: string
  subnet: string
  gateway: string
}

export interface VmNetworkConfig {
  ip?: string
  bridge?: string
  gateway?: string
  dns?: string
}

interface NetworkData {
  bridges: Record<string, BridgeDefinition>
  ipPools: Record<string, IpPoolConfig>
  firewallRules: FirewallRule[]
  vmConfigs: Record<string, VmNetworkConfig>
}

export class NetworkStore {
  private filePath: string
  private data: NetworkData = { bridges: {}, ipPools: {}, firewallRules: [], vmConfigs: {} }

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      this.data = JSON.parse(raw) as NetworkData
    } catch {
      await mkdir(dirname(this.filePath), { recursive: true })
      await this.persist()
    }
  }

  // --- Bridges ---

  getBridges(): Record<string, BridgeDefinition> {
    return { ...this.data.bridges }
  }

  getBridge(name: string): BridgeDefinition | null {
    return this.data.bridges[name] ?? null
  }

  async addBridge(bridge: BridgeDefinition): Promise<boolean> {
    if (this.data.bridges[bridge.name]) return false
    this.data.bridges[bridge.name] = bridge
    await this.persist()
    return true
  }

  async removeBridge(name: string): Promise<boolean> {
    if (!this.data.bridges[name]) return false
    delete this.data.bridges[name]
    delete this.data.ipPools[name]
    await this.persist()
    return true
  }

  // --- IP Pools ---

  getIpPool(bridge: string): IpPoolConfig | null {
    return this.data.ipPools[bridge] ?? null
  }

  async setIpPool(bridge: string, pool: IpPoolConfig): Promise<void> {
    this.data.ipPools[bridge] = pool
    await this.persist()
  }

  // --- Firewall Rules ---

  getFirewallRules(): FirewallRule[] {
    return [...this.data.firewallRules]
  }

  async addFirewallRule(rule: FirewallRule): Promise<void> {
    this.data.firewallRules.push(rule)
    await this.persist()
  }

  async removeFirewallRule(id: string): Promise<boolean> {
    const idx = this.data.firewallRules.findIndex(r => r.id === id)
    if (idx === -1) return false
    this.data.firewallRules.splice(idx, 1)
    await this.persist()
    return true
  }

  // --- VM Network Configs ---

  getVmConfig(vmName: string): VmNetworkConfig | null {
    return this.data.vmConfigs[vmName] ?? null
  }

  async setVmConfig(vmName: string, config: VmNetworkConfig): Promise<void> {
    this.data.vmConfigs[vmName] = config
    await this.persist()
  }

  private async persist(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }
}

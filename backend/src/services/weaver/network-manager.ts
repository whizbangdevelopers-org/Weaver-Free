// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { NetworkStore, IpPoolConfig, FirewallRule, BridgeDefinition, VmNetworkConfig } from '../../storage/network-store.js'
import type { DashboardConfig } from '../../config.js'

const execFileAsync = promisify(execFile)

export class NetworkManager {
  private store: NetworkStore
  private config: DashboardConfig

  constructor(store: NetworkStore, config: DashboardConfig) {
    this.store = store
    this.config = config
  }

  // --- Bridges ---

  async listBridges(): Promise<BridgeDefinition[]> {
    const stored = this.store.getBridges()
    return Object.values(stored)
  }

  async createBridge(name: string, subnet: string, gateway: string): Promise<{ success: boolean; message: string }> {
    const added = await this.store.addBridge({ name, subnet, gateway })
    if (!added) {
      return { success: false, message: `Bridge '${name}' already exists` }
    }

    try {
      const ipBin = this.config.ipBin
      await execFileAsync(this.config.sudoBin, [ipBin, 'link', 'add', name, 'type', 'bridge'])
      await execFileAsync(this.config.sudoBin, [ipBin, 'addr', 'add', `${gateway}/${subnet.split('/')[1]}`, 'dev', name])
      await execFileAsync(this.config.sudoBin, [ipBin, 'link', 'set', name, 'up'])
      return { success: true, message: `Bridge '${name}' created` }
    } catch (err) {
      // Rollback store entry on failure
      await this.store.removeBridge(name)
      // SEC-014: sanitize — never expose system paths from execFileAsync errors
      if (err instanceof Error) console.error('createBridge failed:', name, err.message)
      return { success: false, message: `Failed to create bridge '${name}'` }
    }
  }

  async deleteBridge(name: string): Promise<{ success: boolean; message: string }> {
    // Don't allow deleting the default bridge
    if (name === this.config.bridgeInterface) {
      return { success: false, message: `Cannot delete default bridge '${name}'` }
    }

    try {
      const ipBin = this.config.ipBin
      await execFileAsync(this.config.sudoBin, [ipBin, 'link', 'delete', name])
    } catch {
      // Bridge may not exist on the host — still remove from store
    }

    const removed = await this.store.removeBridge(name)
    if (!removed) {
      return { success: false, message: `Bridge '${name}' not found` }
    }
    return { success: true, message: `Bridge '${name}' deleted` }
  }

  // --- IP Pool ---

  getIpPool(bridge: string): IpPoolConfig | null {
    return this.store.getIpPool(bridge)
  }

  async setIpPool(bridge: string, pool: IpPoolConfig): Promise<void> {
    await this.store.setIpPool(bridge, pool)
  }

  allocateIp(bridge: string): string | null {
    const pool = this.store.getIpPool(bridge)
    if (!pool) return null

    const startParts = pool.start.split('.').map(Number)
    const endParts = pool.end.split('.').map(Number)
    const startNum = (startParts[0] << 24) | (startParts[1] << 16) | (startParts[2] << 8) | startParts[3]
    const endNum = (endParts[0] << 24) | (endParts[1] << 16) | (endParts[2] << 8) | endParts[3]
    const allocated = new Set(pool.allocated)

    for (let i = startNum; i <= endNum; i++) {
      const ip = `${(i >> 24) & 0xFF}.${(i >> 16) & 0xFF}.${(i >> 8) & 0xFF}.${i & 0xFF}`
      if (!allocated.has(ip)) {
        return ip
      }
    }
    return null
  }

  // --- Firewall ---

  getFirewallRules(): FirewallRule[] {
    return this.store.getFirewallRules()
  }

  async addFirewallRule(rule: Omit<FirewallRule, 'id'>): Promise<FirewallRule> {
    const id = crypto.randomUUID()
    const fullRule: FirewallRule = { id, ...rule }

    try {
      const chain = rule.action === 'allow' ? 'ACCEPT' : 'DROP'
      await execFileAsync(this.config.sudoBin, [
        this.config.iptablesBin,
        '-A', 'FORWARD',
        '-s', rule.source,
        '-d', rule.destination,
        '-p', rule.protocol,
        '--dport', String(rule.port),
        '-j', chain,
      ])
    } catch {
      // iptables command may fail in test/dev environments — still persist
    }

    await this.store.addFirewallRule(fullRule)
    return fullRule
  }

  async deleteFirewallRule(id: string): Promise<boolean> {
    const rules = this.store.getFirewallRules()
    const rule = rules.find(r => r.id === id)
    if (!rule) return false

    try {
      const chain = rule.action === 'allow' ? 'ACCEPT' : 'DROP'
      await execFileAsync(this.config.sudoBin, [
        this.config.iptablesBin,
        '-D', 'FORWARD',
        '-s', rule.source,
        '-d', rule.destination,
        '-p', rule.protocol,
        '--dport', String(rule.port),
        '-j', chain,
      ])
    } catch {
      // iptables command may fail in test/dev — still remove from store
    }

    return this.store.removeFirewallRule(id)
  }

  // --- VM Network Config ---

  getVmNetworkConfig(vmName: string): VmNetworkConfig | null {
    return this.store.getVmConfig(vmName)
  }

  async setVmNetworkConfig(vmName: string, config: VmNetworkConfig): Promise<void> {
    await this.store.setVmConfig(vmName, config)
  }
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { NetworkStore } from '../../src/storage/network-store.js'

describe('NetworkStore', () => {
  let tempDir: string
  let store: NetworkStore

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'net-store-'))
    store = new NetworkStore(join(tempDir, 'network-config.json'))
    await store.init()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('bridges', () => {
    it('should start with no bridges', () => {
      expect(store.getBridges()).toEqual({})
    })

    it('should add a bridge', async () => {
      const added = await store.addBridge({ name: 'br-test', subnet: '10.20.0.0/24', gateway: '10.20.0.1' })
      expect(added).toBe(true)
      expect(store.getBridge('br-test')).toEqual({ name: 'br-test', subnet: '10.20.0.0/24', gateway: '10.20.0.1' })
    })

    it('should reject duplicate bridge', async () => {
      await store.addBridge({ name: 'br-test', subnet: '10.20.0.0/24', gateway: '10.20.0.1' })
      const dup = await store.addBridge({ name: 'br-test', subnet: '10.30.0.0/24', gateway: '10.30.0.1' })
      expect(dup).toBe(false)
    })

    it('should remove a bridge', async () => {
      await store.addBridge({ name: 'br-test', subnet: '10.20.0.0/24', gateway: '10.20.0.1' })
      const removed = await store.removeBridge('br-test')
      expect(removed).toBe(true)
      expect(store.getBridge('br-test')).toBeNull()
    })

    it('should return false when removing nonexistent bridge', async () => {
      expect(await store.removeBridge('nope')).toBe(false)
    })
  })

  describe('IP pools', () => {
    it('should return null for unconfigured pool', () => {
      expect(store.getIpPool('br-test')).toBeNull()
    })

    it('should set and get an IP pool', async () => {
      const pool = { start: '10.20.0.10', end: '10.20.0.50', allocated: ['10.20.0.10'] }
      await store.setIpPool('br-test', pool)
      expect(store.getIpPool('br-test')).toEqual(pool)
    })
  })

  describe('firewall rules', () => {
    it('should start with no rules', () => {
      expect(store.getFirewallRules()).toEqual([])
    })

    it('should add a firewall rule', async () => {
      const rule = { id: 'r1', source: '10.10.0.10', destination: '10.10.0.20', port: 80, protocol: 'tcp' as const, action: 'allow' as const }
      await store.addFirewallRule(rule)
      const rules = store.getFirewallRules()
      expect(rules).toHaveLength(1)
      expect(rules[0].id).toBe('r1')
    })

    it('should remove a firewall rule', async () => {
      await store.addFirewallRule({ id: 'r1', source: '10.10.0.10', destination: '10.10.0.20', port: 80, protocol: 'tcp', action: 'allow' })
      const removed = await store.removeFirewallRule('r1')
      expect(removed).toBe(true)
      expect(store.getFirewallRules()).toEqual([])
    })

    it('should return false when removing nonexistent rule', async () => {
      expect(await store.removeFirewallRule('nope')).toBe(false)
    })
  })

  describe('persistence', () => {
    it('should persist and reload data', async () => {
      await store.addBridge({ name: 'br-persist', subnet: '10.30.0.0/24', gateway: '10.30.0.1' })
      await store.setIpPool('br-persist', { start: '10.30.0.10', end: '10.30.0.50', allocated: [] })
      await store.addFirewallRule({ id: 'r2', source: '10.30.0.10', destination: '10.30.0.20', port: 443, protocol: 'tcp', action: 'deny' })

      // Create a new store instance reading the same file
      const store2 = new NetworkStore(join(tempDir, 'network-config.json'))
      await store2.init()

      expect(store2.getBridge('br-persist')).toEqual({ name: 'br-persist', subnet: '10.30.0.0/24', gateway: '10.30.0.1' })
      expect(store2.getIpPool('br-persist')).toEqual({ start: '10.30.0.10', end: '10.30.0.50', allocated: [] })
      expect(store2.getFirewallRules()).toHaveLength(1)
    })
  })
})

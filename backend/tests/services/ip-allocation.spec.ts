// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * IP allocation — WVR-208 (Weaver owns the bridge and the address space — no runtime brings its
 * own network) makes Weaver the sole IPAM authority, and *sole authority* is a claim about
 * reservation, not about arithmetic.
 *
 * The prior `allocateIp()` found the next free address and returned it **without recording it**.
 * It had zero callers, so nothing was broken yet — and phase B (create) and phase C (reconcile)
 * were about to become its first two callers at once, each handing the same address to a
 * different workload. The collision would surface on the wire, long after the allocation, which
 * is precisely the failure WVR-208 cites as the reason for single-authority IPAM.
 *
 * These tests are the specification of the split: `peekNextIp` answers, `reserveIp` takes,
 * `releaseIp` returns.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { NetworkStore } from '../../src/storage/network-store.js'
import { NetworkManager } from '../../src/services/weaver/network-manager.js'
import type { DashboardConfig } from '../../src/config.js'

const BRIDGE = 'br-microvm'

const baseConfig = {
  tier: 'weaver', licenseExpiry: null, licenseGraceMode: false, storageBackend: 'json',
  dataDir: './data', provisioningEnabled: false, microvmsDir: '/var/lib/microvms',
  bridgeGateway: '10.10.0.1', bridgeInterface: BRIDGE,
  microvmBin: '/bin/microvm', qemuBin: '/bin/qemu', qemuImgBin: '/bin/qemu-img',
  ipBin: '/bin/ip', distroCatalogUrl: null,
} as unknown as DashboardConfig

describe('IP allocation (WVR-208 single-authority IPAM)', () => {
  let tempDir: string
  let store: NetworkStore
  let mgr: NetworkManager

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ipam-'))
    store = new NetworkStore(join(tempDir, 'network-config.json'))
    await store.init()
    mgr = new NetworkManager(store, baseConfig)
    await mgr.setIpPool(BRIDGE, { start: '10.10.0.10', end: '10.10.0.12', allocated: [] })
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('peekNextIp — a query, deliberately not an allocator', () => {
    it('returns the first free address', () => {
      expect(mgr.peekNextIp(BRIDGE)).toBe('10.10.0.10')
    })

    it('does NOT reserve — repeated peeks return the same address', () => {
      // This is the old allocateIp behaviour, kept but renamed so it cannot be mistaken for
      // an allocator. Two callers peeking get the same answer; that is correct for a query
      // and catastrophic for an allocation, which is why the name changed.
      expect(mgr.peekNextIp(BRIDGE)).toBe('10.10.0.10')
      expect(mgr.peekNextIp(BRIDGE)).toBe('10.10.0.10')
      expect(mgr.getIpPool(BRIDGE)!.allocated).toEqual([])
    })

    it('returns null when no pool is configured for the bridge', () => {
      expect(mgr.peekNextIp('br-nonexistent')).toBeNull()
    })
  })

  describe('reserveIp — the actual allocator', () => {
    // THE REGRESSION THIS FILE EXISTS FOR. Under the old allocateIp both calls returned
    // 10.10.0.10 and two workloads would have been given the same address.
    it('never hands the same address to two callers', async () => {
      const a = await mgr.reserveIp(BRIDGE)
      const b = await mgr.reserveIp(BRIDGE)
      expect(a).toBe('10.10.0.10')
      expect(b).toBe('10.10.0.11')
      expect(a).not.toBe(b)
    })

    it('records the reservation in the pool', async () => {
      await mgr.reserveIp(BRIDGE)
      expect(mgr.getIpPool(BRIDGE)!.allocated).toEqual(['10.10.0.10'])
    })

    it('persists the reservation before returning', async () => {
      // Durability matters because the caller acts on the address immediately — it attaches a
      // container to it. A reservation lost to a crash between return and persist is an address
      // Weaver believes is free and the host believes is taken.
      await mgr.reserveIp(BRIDGE)
      const reopened = new NetworkStore(join(tempDir, 'network-config.json'))
      await reopened.init()
      expect(reopened.getIpPool(BRIDGE)!.allocated).toEqual(['10.10.0.10'])
    })

    it('returns null when the pool is exhausted, and reserves nothing', async () => {
      const got = [
        await mgr.reserveIp(BRIDGE),
        await mgr.reserveIp(BRIDGE),
        await mgr.reserveIp(BRIDGE),
      ]
      expect(got).toEqual(['10.10.0.10', '10.10.0.11', '10.10.0.12'])
      expect(await mgr.reserveIp(BRIDGE)).toBeNull()
      expect(mgr.getIpPool(BRIDGE)!.allocated).toHaveLength(3)
    })

    it('returns null for an unconfigured bridge without creating a pool', async () => {
      expect(await mgr.reserveIp('br-nonexistent')).toBeNull()
      expect(mgr.getIpPool('br-nonexistent')).toBeNull()
    })

    it('skips an address already recorded as allocated', async () => {
      await mgr.setIpPool(BRIDGE, { start: '10.10.0.10', end: '10.10.0.12', allocated: ['10.10.0.10'] })
      expect(await mgr.reserveIp(BRIDGE)).toBe('10.10.0.11')
    })
  })

  describe('releaseIp — the rollback path phase C requires', () => {
    it('returns the address to the pool', async () => {
      const ip = (await mgr.reserveIp(BRIDGE))!
      await mgr.releaseIp(BRIDGE, ip)
      expect(mgr.getIpPool(BRIDGE)!.allocated).toEqual([])
      expect(await mgr.reserveIp(BRIDGE)).toBe(ip)
    })

    it('is idempotent — releasing an unallocated address is a no-op, not an error', async () => {
      // A rollback runs when something has already failed, so the caller's view of state is the
      // least trustworthy it will ever be. It must be able to release unconditionally.
      await expect(mgr.releaseIp(BRIDGE, '10.10.0.99')).resolves.toBeUndefined()
      await mgr.reserveIp(BRIDGE)
      await mgr.releaseIp(BRIDGE, '10.10.0.10')
      await expect(mgr.releaseIp(BRIDGE, '10.10.0.10')).resolves.toBeUndefined()
      expect(mgr.getIpPool(BRIDGE)!.allocated).toEqual([])
    })

    it('leaves other reservations untouched', async () => {
      const a = (await mgr.reserveIp(BRIDGE))!
      const b = (await mgr.reserveIp(BRIDGE))!
      await mgr.releaseIp(BRIDGE, a)
      expect(mgr.getIpPool(BRIDGE)!.allocated).toEqual([b])
    })

    it('does not throw for an unconfigured bridge', async () => {
      await expect(mgr.releaseIp('br-nonexistent', '10.10.0.10')).resolves.toBeUndefined()
    })
  })
})

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { VmAclStore } from '../../src/storage/vm-acl-store.js'

const TEST_DIR = join('/tmp', `vm-acl-store-test-${randomUUID()}`)

describe('VmAclStore', () => {
  let store: VmAclStore

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })
    store = new VmAclStore(join(TEST_DIR, 'vm-acls.json'))
    await store.init()
  })

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {})
  })

  it('should start with no ACLs', () => {
    expect(store.get('user-1')).toEqual([])
    expect(store.hasAcl('user-1')).toBe(false)
  })

  it('should set and retrieve ACL entries', async () => {
    await store.set('user-1', ['web-nginx', 'dev-node'])
    expect(store.get('user-1')).toEqual(['dev-node', 'web-nginx'])
    expect(store.hasAcl('user-1')).toBe(true)
  })

  it('should deduplicate and sort entries', async () => {
    await store.set('user-2', ['zeta-vm', 'alpha-vm', 'zeta-vm', 'alpha-vm'])
    expect(store.get('user-2')).toEqual(['alpha-vm', 'zeta-vm'])
  })

  it('should clear ACL entries', async () => {
    await store.set('user-3', ['web-nginx'])
    expect(store.hasAcl('user-3')).toBe(true)

    const cleared = await store.clear('user-3')
    expect(cleared).toBe(true)
    expect(store.hasAcl('user-3')).toBe(false)
    expect(store.get('user-3')).toEqual([])
  })

  it('should return false when clearing non-existent ACL', async () => {
    const cleared = await store.clear('nonexistent')
    expect(cleared).toBe(false)
  })

  it('should clear ACL when setting empty array', async () => {
    await store.set('user-4', ['some-vm'])
    expect(store.hasAcl('user-4')).toBe(true)

    await store.set('user-4', [])
    expect(store.hasAcl('user-4')).toBe(false)
  })

  describe('isAllowed', () => {
    it('should allow access when user has no ACL', () => {
      expect(store.isAllowed('no-acl-user', 'any-vm')).toBe(true)
    })

    it('should allow access to assigned VMs', async () => {
      await store.set('acl-user', ['web-nginx', 'dev-node'])
      expect(store.isAllowed('acl-user', 'web-nginx')).toBe(true)
      expect(store.isAllowed('acl-user', 'dev-node')).toBe(true)
    })

    it('should deny access to non-assigned VMs', async () => {
      await store.set('acl-user', ['web-nginx', 'dev-node'])
      expect(store.isAllowed('acl-user', 'svc-postgres')).toBe(false)
    })
  })

  describe('filterVms', () => {
    it('should return all VMs when user has no ACL', () => {
      const vms = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
      expect(store.filterVms('no-acl-user', vms)).toEqual(vms)
    })

    it('should filter to only allowed VMs', async () => {
      await store.set('filter-user', ['a', 'c'])
      const vms = [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }]
      const filtered = store.filterVms('filter-user', vms)
      expect(filtered.map(v => v.name)).toEqual(['a', 'c'])
    })
  })

  it('should persist across instances', async () => {
    await store.set('persist-user', ['persist-vm'])
    const store2 = new VmAclStore(join(TEST_DIR, 'vm-acls.json'))
    await store2.init()
    expect(store2.get('persist-user')).toEqual(['persist-vm'])
  })
})

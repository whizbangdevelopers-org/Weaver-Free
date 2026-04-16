// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { SqliteWorkloadRegistry } from '../../src/storage/sqlite-registry.js'
import type { WorkloadDefinition } from '../../src/storage/workload-registry.js'

function makeVm(overrides: Partial<WorkloadDefinition> = {}): WorkloadDefinition {
  return {
    name: 'test-vm',
    ip: '10.0.0.1',
    mem: 512,
    vcpu: 1,
    hypervisor: 'qemu',
    ...overrides,
  }
}

describe('SqliteWorkloadRegistry', () => {
  let tmpDir: string
  let dbPath: string
  let registry: SqliteWorkloadRegistry

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sqlite-registry-'))
    dbPath = join(tmpDir, 'registry.db')
    registry = new SqliteWorkloadRegistry(dbPath)
    // Ensure SEED_SAMPLE_VMS is off by default
    vi.stubEnv('SEED_SAMPLE_VMS', '')
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('init creates the vms table and returns empty registry', async () => {
    await registry.init()
    const all = await registry.getAll()
    expect(Object.keys(all)).toHaveLength(0)
  })

  it('add inserts a VM and getAll returns it', async () => {
    await registry.init()

    const vm = makeVm({ name: 'web-nginx', ip: '10.10.0.10', mem: 256 })
    const added = await registry.add(vm)
    expect(added).toBe(true)

    const all = await registry.getAll()
    expect(Object.keys(all)).toHaveLength(1)
    expect(all['web-nginx']).toBeDefined()
    expect(all['web-nginx'].ip).toBe('10.10.0.10')
    expect(all['web-nginx'].mem).toBe(256)
  })

  it('get returns the VM by name', async () => {
    await registry.init()
    await registry.add(makeVm({ name: 'my-vm' }))

    const vm = await registry.get('my-vm')
    expect(vm).not.toBeNull()
    expect(vm!.name).toBe('my-vm')
  })

  it('get returns null for an unknown VM', async () => {
    await registry.init()
    expect(await registry.get('ghost-vm')).toBeNull()
  })

  it('has returns true for existing VM, false for missing', async () => {
    await registry.init()
    await registry.add(makeVm({ name: 'exists' }))

    expect(await registry.has('exists')).toBe(true)
    expect(await registry.has('missing')).toBe(false)
  })

  it('remove deletes a VM and returns true', async () => {
    await registry.init()
    await registry.add(makeVm({ name: 'to-delete' }))

    const removed = await registry.remove('to-delete')
    expect(removed).toBe(true)
    expect(await registry.has('to-delete')).toBe(false)
  })

  it('remove returns false for a non-existent VM', async () => {
    await registry.init()
    expect(await registry.remove('no-such-vm')).toBe(false)
  })

  it('add returns false for a duplicate VM name', async () => {
    await registry.init()
    await registry.add(makeVm({ name: 'dup-vm' }))

    const second = await registry.add(makeVm({ name: 'dup-vm', ip: '10.0.0.99' }))
    expect(second).toBe(false)

    // Original record is untouched
    const vm = await registry.get('dup-vm')
    expect(vm!.ip).toBe('10.0.0.1')
  })

  it('update sets autostart field', async () => {
    await registry.init()
    await registry.add(makeVm({ name: 'auto-vm', autostart: false }))

    const ok = await registry.update('auto-vm', { autostart: true })
    expect(ok).toBe(true)

    const vm = await registry.get('auto-vm')
    expect(vm!.autostart).toBe(true)
  })

  it('update sets description field', async () => {
    await registry.init()
    await registry.add(makeVm({ name: 'desc-vm' }))

    await registry.update('desc-vm', { description: 'My test VM' })

    const vm = await registry.get('desc-vm')
    expect(vm!.description).toBe('My test VM')
  })

  it('update sets tags field', async () => {
    await registry.init()
    await registry.add(makeVm({ name: 'tag-vm' }))

    await registry.update('tag-vm', { tags: ['web', 'prod'] })

    const vm = await registry.get('tag-vm')
    expect(vm!.tags).toEqual(['web', 'prod'])
  })

  it('update with no recognized fields returns true without error', async () => {
    await registry.init()
    await registry.add(makeVm({ name: 'noop-vm' }))

    // Updating with an empty patch is a no-op
    const ok = await registry.update('noop-vm', {})
    expect(ok).toBe(true)
  })

  it('update returns false for a non-existent VM', async () => {
    await registry.init()
    const ok = await registry.update('ghost', { autostart: true })
    expect(ok).toBe(false)
  })

  it('does NOT seed sample VMs when SEED_SAMPLE_VMS is not set', async () => {
    await registry.init()
    const all = await registry.getAll()
    expect(Object.keys(all)).toHaveLength(0)
  })

  it('seeds sample VMs when SEED_SAMPLE_VMS=true', async () => {
    vi.stubEnv('SEED_SAMPLE_VMS', 'true')

    const seedRegistry = new SqliteWorkloadRegistry(join(tmpDir, 'seeded.db'))
    await seedRegistry.init()

    const all = await seedRegistry.getAll()
    expect(Object.keys(all).length).toBeGreaterThan(0)
    expect(all['web-nginx']).toBeDefined()
  })

  it('does not double-seed if called again on a non-empty registry', async () => {
    vi.stubEnv('SEED_SAMPLE_VMS', 'true')

    const seedRegistry = new SqliteWorkloadRegistry(join(tmpDir, 'seeded2.db'))
    await seedRegistry.init()

    const countAfterFirst = Object.keys(await seedRegistry.getAll()).length
    await seedRegistry.init()
    const countAfterSecond = Object.keys(await seedRegistry.getAll()).length

    expect(countAfterFirst).toBe(countAfterSecond)
  })

  it('rowToDefinition handles empty tags array correctly (returns undefined)', async () => {
    await registry.init()
    await registry.add(makeVm({ name: 'notag-vm', tags: [] }))

    const vm = await registry.get('notag-vm')
    // Empty tags array is stored as '[]' and maps back to undefined (per rowToDefinition)
    expect(vm!.tags).toBeUndefined()
  })

  it('rowToDefinition preserves distro when set', async () => {
    await registry.init()
    await registry.add(makeVm({ name: 'nixos-vm', distro: 'nixos' }))

    const vm = await registry.get('nixos-vm')
    expect(vm!.distro).toBe('nixos')
  })
})

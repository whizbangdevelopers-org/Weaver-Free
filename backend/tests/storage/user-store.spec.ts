// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { UserStore } from '../../src/storage/user-store.js'
import { ROLES } from '../../src/constants/vocabularies.js'

describe('UserStore', () => {
  let tmpDir: string
  let filePath: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'user-store-'))
    filePath = join(tmpDir, 'users.json')
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('creates the file on first init', async () => {
    const store = new UserStore(filePath)
    await store.init()

    const raw = await readFile(filePath, 'utf-8')
    expect(JSON.parse(raw)).toEqual({})
    expect(store.count()).toBe(0)
  })

  it('creates a user with correct fields', async () => {
    const store = new UserStore(filePath)
    await store.init()

    const user = await store.create('alice', 'hash123', ROLES.ADMIN)

    expect(user.id).toBeTruthy()
    expect(user.username).toBe('alice')
    expect(user.passwordHash).toBe('hash123')
    expect(user.role).toBe(ROLES.ADMIN)
    expect(user.createdAt).toBeTruthy()
  })

  it('defaults role to VIEWER when not specified', async () => {
    const store = new UserStore(filePath)
    await store.init()

    const user = await store.create('bob', 'hashbob')
    expect(user.role).toBe(ROLES.VIEWER)
  })

  it('getById returns the correct user', async () => {
    const store = new UserStore(filePath)
    await store.init()

    const created = await store.create('alice', 'hash123')
    const found = store.getById(created.id)

    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
    expect(found!.username).toBe('alice')
  })

  it('getById returns null for unknown id', async () => {
    const store = new UserStore(filePath)
    await store.init()

    expect(store.getById('nonexistent-id')).toBeNull()
  })

  it('getByUsername returns the correct user', async () => {
    const store = new UserStore(filePath)
    await store.init()

    const created = await store.create('alice', 'hash123')
    const found = store.getByUsername('alice')

    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
  })

  it('getByUsername returns null for unknown username', async () => {
    const store = new UserStore(filePath)
    await store.init()

    expect(store.getByUsername('nobody')).toBeNull()
  })

  it('update changes non-username fields without touching the index', async () => {
    const store = new UserStore(filePath)
    await store.init()

    const user = await store.create('alice', 'hash123', ROLES.VIEWER)
    const updated = await store.update(user.id, { passwordHash: 'newhash', role: ROLES.OPERATOR })

    expect(updated).not.toBeNull()
    expect(updated!.passwordHash).toBe('newhash')
    expect(updated!.role).toBe(ROLES.OPERATOR)
    // Username index untouched
    expect(store.getByUsername('alice')!.id).toBe(user.id)
  })

  it('update renames username and updates the secondary index', async () => {
    const store = new UserStore(filePath)
    await store.init()

    const user = await store.create('alice', 'hash123')
    await store.update(user.id, { username: 'alicia' })

    // Old username no longer in index
    expect(store.getByUsername('alice')).toBeNull()
    // New username resolves correctly
    const found = store.getByUsername('alicia')
    expect(found).not.toBeNull()
    expect(found!.id).toBe(user.id)
    expect(found!.username).toBe('alicia')
  })

  it('update returns null for unknown id', async () => {
    const store = new UserStore(filePath)
    await store.init()

    const result = await store.update('no-such-id', { role: ROLES.ADMIN })
    expect(result).toBeNull()
  })

  it('update merges preferences', async () => {
    const store = new UserStore(filePath)
    await store.init()

    const user = await store.create('alice', 'hash')
    await store.update(user.id, { preferences: { hasSeenWizard: true } })

    const updated = store.getById(user.id)!
    expect(updated.preferences?.hasSeenWizard).toBe(true)
  })

  it('delete removes the user and cleans the index', async () => {
    const store = new UserStore(filePath)
    await store.init()

    const user = await store.create('alice', 'hash123')
    const deleted = await store.delete(user.id)

    expect(deleted).toBe(true)
    expect(store.getById(user.id)).toBeNull()
    expect(store.getByUsername('alice')).toBeNull()
    expect(store.count()).toBe(0)
  })

  it('delete returns false for unknown id', async () => {
    const store = new UserStore(filePath)
    await store.init()

    expect(await store.delete('no-such-id')).toBe(false)
  })

  it('count reflects current user count', async () => {
    const store = new UserStore(filePath)
    await store.init()

    expect(store.count()).toBe(0)
    await store.create('u1', 'h1')
    await store.create('u2', 'h2')
    expect(store.count()).toBe(2)
  })

  it('persists data to disk and a new instance reads it back', async () => {
    const storeA = new UserStore(filePath)
    await storeA.init()
    const user = await storeA.create('alice', 'hash123', ROLES.ADMIN)

    // New instance from same file
    const storeB = new UserStore(filePath)
    await storeB.init()

    const found = storeB.getById(user.id)
    expect(found).not.toBeNull()
    expect(found!.username).toBe('alice')
    expect(found!.role).toBe(ROLES.ADMIN)
    expect(storeB.getByUsername('alice')!.id).toBe(user.id)
  })

  it('reload picks up external changes written directly to the file', async () => {
    const store = new UserStore(filePath)
    await store.init()

    const user = await store.create('alice', 'hash123')

    // Simulate an external script updating the file directly
    const raw = JSON.parse(await readFile(filePath, 'utf-8')) as Record<string, unknown>
    ;(raw[user.id] as Record<string, unknown>).role = ROLES.ADMIN
    const { writeFile } = await import('node:fs/promises')
    await writeFile(filePath, JSON.stringify(raw), 'utf-8')

    const { count } = await store.reload()
    expect(count).toBe(1)
    expect(store.getById(user.id)!.role).toBe(ROLES.ADMIN)
  })

  it('getAll returns all users as an array', async () => {
    const store = new UserStore(filePath)
    await store.init()

    await store.create('u1', 'h1')
    await store.create('u2', 'h2')

    const all = store.getAll()
    expect(all).toHaveLength(2)
    expect(all.map(u => u.username).sort()).toEqual(['u1', 'u2'])
  })
})

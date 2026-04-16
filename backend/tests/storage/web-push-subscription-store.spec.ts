// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { WebPushSubscriptionStore } from '../../src/storage/web-push-subscription-store.js'

describe('WebPushSubscriptionStore', () => {
  let tempDir: string
  let store: WebPushSubscriptionStore

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'webpush-store-'))
    store = new WebPushSubscriptionStore(join(tempDir, 'web-push-subscriptions.json'))
    await store.init()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should start empty', () => {
    expect(store.getAll()).toEqual([])
  })

  it('should add a subscription', async () => {
    await store.add({
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'key1', auth: 'auth1' },
      userId: 'user-1',
      createdAt: new Date().toISOString(),
    })
    expect(store.getAll()).toHaveLength(1)
  })

  it('should replace subscription with same endpoint', async () => {
    await store.add({
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'key1', auth: 'auth1' },
      userId: 'user-1',
      createdAt: '2024-01-01T00:00:00Z',
    })
    await store.add({
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'key2', auth: 'auth2' },
      userId: 'user-1',
      createdAt: '2024-01-02T00:00:00Z',
    })
    expect(store.getAll()).toHaveLength(1)
    expect(store.getAll()[0].keys.p256dh).toBe('key2')
  })

  it('should get subscriptions by user ID', async () => {
    await store.add({
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'key1', auth: 'auth1' },
      userId: 'user-1',
      createdAt: new Date().toISOString(),
    })
    await store.add({
      endpoint: 'https://push.example.com/sub2',
      keys: { p256dh: 'key2', auth: 'auth2' },
      userId: 'user-2',
      createdAt: new Date().toISOString(),
    })

    const user1Subs = store.getByUserId('user-1')
    expect(user1Subs).toHaveLength(1)
    expect(user1Subs[0].endpoint).toBe('https://push.example.com/sub1')
  })

  it('should remove a subscription by endpoint', async () => {
    await store.add({
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'key1', auth: 'auth1' },
      userId: 'user-1',
      createdAt: new Date().toISOString(),
    })
    const removed = await store.remove('https://push.example.com/sub1')
    expect(removed).toBe(true)
    expect(store.getAll()).toHaveLength(0)
  })

  it('should return false when removing nonexistent subscription', async () => {
    expect(await store.remove('https://push.example.com/nope')).toBe(false)
  })

  it('should remove expired endpoints in bulk', async () => {
    await store.add({
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'key1', auth: 'auth1' },
      userId: 'user-1',
      createdAt: new Date().toISOString(),
    })
    await store.add({
      endpoint: 'https://push.example.com/sub2',
      keys: { p256dh: 'key2', auth: 'auth2' },
      userId: 'user-2',
      createdAt: new Date().toISOString(),
    })
    await store.add({
      endpoint: 'https://push.example.com/sub3',
      keys: { p256dh: 'key3', auth: 'auth3' },
      userId: 'user-3',
      createdAt: new Date().toISOString(),
    })

    await store.removeExpired([
      'https://push.example.com/sub1',
      'https://push.example.com/sub3',
    ])

    expect(store.getAll()).toHaveLength(1)
    expect(store.getAll()[0].endpoint).toBe('https://push.example.com/sub2')
  })

  it('should persist and reload data', async () => {
    await store.add({
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'key1', auth: 'auth1' },
      userId: 'user-1',
      createdAt: new Date().toISOString(),
    })

    const store2 = new WebPushSubscriptionStore(join(tempDir, 'web-push-subscriptions.json'))
    await store2.init()
    expect(store2.getAll()).toHaveLength(1)
  })
})

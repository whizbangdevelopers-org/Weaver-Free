// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { NotificationConfigStore } from '../../src/storage/notification-config-store.js'
import type { ChannelConfig } from '../../src/models/notification-config.js'

describe('NotificationConfigStore', () => {
  let tempDir: string
  let store: NotificationConfigStore

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'notif-config-'))
    store = new NotificationConfigStore(join(tempDir, 'notification-config.json'))
    await store.init()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('default config', () => {
    it('should have version 1', () => {
      expect(store.getConfig().version).toBe(1)
    })

    it('should have in-app channel enabled by default', () => {
      const config = store.getConfig()
      expect(config.channels['in-app']).toBeDefined()
      expect(config.channels['in-app'].type).toBe('in-app')
      expect(config.channels['in-app'].enabled).toBe(true)
    })

    it('should have default resource alert thresholds', () => {
      const config = store.getConfig()
      expect(config.resourceAlerts.cpuThresholdPercent).toBe(90)
      expect(config.resourceAlerts.memoryThresholdPercent).toBe(90)
      expect(config.resourceAlerts.checkIntervalSeconds).toBe(30)
    })

    it('should return a deep clone from getConfig', () => {
      const config1 = store.getConfig()
      const config2 = store.getConfig()
      expect(config1).toEqual(config2)
      config1.resourceAlerts.cpuThresholdPercent = 50
      expect(store.getConfig().resourceAlerts.cpuThresholdPercent).toBe(90)
    })
  })

  describe('channel CRUD', () => {
    it('should get a channel by id', () => {
      const channel = store.getChannel('in-app')
      expect(channel).not.toBeNull()
      expect(channel!.type).toBe('in-app')
    })

    it('should return null for nonexistent channel', () => {
      expect(store.getChannel('nonexistent')).toBeNull()
    })

    it('should add a new channel', async () => {
      const ntfyConfig: ChannelConfig = {
        type: 'ntfy',
        enabled: true,
        events: ['vm:started', 'vm:failed'],
        url: 'https://ntfy.example.com',
        topic: 'dashboard',
      }
      await store.setChannel('ntfy', ntfyConfig)

      const channel = store.getChannel('ntfy')
      expect(channel).not.toBeNull()
      expect(channel!.type).toBe('ntfy')
      expect(channel!.events).toEqual(['vm:started', 'vm:failed'])
    })

    it('should update an existing channel', async () => {
      const channel = store.getChannel('in-app')!
      channel.enabled = false
      await store.setChannel('in-app', channel)

      expect(store.getChannel('in-app')!.enabled).toBe(false)
    })

    it('should remove a channel', async () => {
      const ntfyConfig: ChannelConfig = {
        type: 'ntfy',
        enabled: true,
        events: ['vm:started'],
        url: 'https://ntfy.example.com',
        topic: 'dashboard',
      }
      await store.setChannel('ntfy', ntfyConfig)
      expect(store.getChannel('ntfy')).not.toBeNull()

      const removed = await store.removeChannel('ntfy')
      expect(removed).toBe(true)
      expect(store.getChannel('ntfy')).toBeNull()
    })

    it('should return false when removing nonexistent channel', async () => {
      expect(await store.removeChannel('nope')).toBe(false)
    })

    it('should return deep clones from getChannel', () => {
      const channel = store.getChannel('in-app')!
      channel.enabled = false
      expect(store.getChannel('in-app')!.enabled).toBe(true)
    })
  })

  describe('resource alerts', () => {
    it('should update partial resource alerts', async () => {
      await store.updateResourceAlerts({ cpuThresholdPercent: 80 })
      const config = store.getConfig()
      expect(config.resourceAlerts.cpuThresholdPercent).toBe(80)
      expect(config.resourceAlerts.memoryThresholdPercent).toBe(90)
    })

    it('should update multiple fields', async () => {
      await store.updateResourceAlerts({
        cpuThresholdPercent: 75,
        memoryThresholdPercent: 85,
        checkIntervalSeconds: 60,
      })
      const alerts = store.getConfig().resourceAlerts
      expect(alerts.cpuThresholdPercent).toBe(75)
      expect(alerts.memoryThresholdPercent).toBe(85)
      expect(alerts.checkIntervalSeconds).toBe(60)
    })
  })

  describe('seedFromEnv', () => {
    it('should seed ntfy channel from env vars', async () => {
      await store.seedFromEnv({
        ntfyUrl: 'https://ntfy.example.com',
        ntfyTopic: 'dashboard',
        ntfyToken: 'tok123',
      })

      const channel = store.getChannel('ntfy')
      expect(channel).not.toBeNull()
      expect(channel!.type).toBe('ntfy')
      if (channel!.type === 'ntfy') {
        expect(channel!.url).toBe('https://ntfy.example.com')
        expect(channel!.topic).toBe('dashboard')
        expect(channel!.token).toBe('tok123')
      }
    })

    it('should not seed if ntfyUrl is missing', async () => {
      await store.seedFromEnv({ ntfyUrl: null, ntfyTopic: 'dashboard', ntfyToken: null })
      expect(store.getChannel('ntfy')).toBeNull()
    })

    it('should not seed if ntfyTopic is missing', async () => {
      await store.seedFromEnv({ ntfyUrl: 'https://ntfy.example.com', ntfyTopic: null, ntfyToken: null })
      expect(store.getChannel('ntfy')).toBeNull()
    })

    it('should not seed if ntfy channel already exists', async () => {
      const existing: ChannelConfig = {
        type: 'ntfy',
        enabled: true,
        events: ['vm:started'],
        url: 'https://existing.example.com',
        topic: 'existing',
      }
      await store.setChannel('ntfy', existing)

      await store.seedFromEnv({
        ntfyUrl: 'https://ntfy.example.com',
        ntfyTopic: 'new-topic',
        ntfyToken: null,
      })

      const channel = store.getChannel('ntfy')
      if (channel!.type === 'ntfy') {
        expect(channel!.url).toBe('https://existing.example.com')
      }
    })

    it('should seed without token when not provided', async () => {
      await store.seedFromEnv({
        ntfyUrl: 'https://ntfy.example.com',
        ntfyTopic: 'dashboard',
        ntfyToken: null,
      })

      const channel = store.getChannel('ntfy')
      if (channel!.type === 'ntfy') {
        expect(channel!.token).toBeUndefined()
      }
    })
  })

  describe('persistence', () => {
    it('should persist and reload data', async () => {
      const ntfyConfig: ChannelConfig = {
        type: 'ntfy',
        enabled: true,
        events: ['vm:started', 'vm:failed'],
        url: 'https://ntfy.example.com',
        topic: 'dashboard',
      }
      await store.setChannel('ntfy', ntfyConfig)
      await store.updateResourceAlerts({ cpuThresholdPercent: 75 })

      // Create a new store instance reading the same file
      const store2 = new NotificationConfigStore(join(tempDir, 'notification-config.json'))
      await store2.init()

      expect(store2.getChannel('ntfy')).not.toBeNull()
      expect(store2.getConfig().resourceAlerts.cpuThresholdPercent).toBe(75)
    })

    it('should write valid JSON to disk', async () => {
      await store.setChannel('test-channel', {
        type: 'ntfy',
        enabled: true,
        events: ['vm:started'],
        url: 'https://test.example.com',
        topic: 'test',
      })

      const raw = await readFile(join(tempDir, 'notification-config.json'), 'utf-8')
      const parsed = JSON.parse(raw)
      expect(parsed.version).toBe(1)
      expect(parsed.channels['test-channel']).toBeDefined()
    })
  })
})

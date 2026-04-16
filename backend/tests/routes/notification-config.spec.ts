// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { notificationConfigRoutes } from '../../src/routes/weaver/notification-config.js'
import { NotificationConfigStore } from '../../src/storage/notification-config-store.js'
import { NotificationStore } from '../../src/storage/notification-store.js'
import { NotificationService } from '../../src/services/notification.js'
import type { DashboardConfig } from '../../src/config.js'
import type { UserRole } from '../../src/models/user.js'

let mockUserRole: UserRole = 'admin'

const baseConfig: DashboardConfig = {
  tier: 'weaver' as const,
  licenseExpiry: null,
  licenseGraceMode: false,
  storageBackend: 'json',
  dataDir: './data',
  provisioningEnabled: false,
  microvmsDir: '/var/lib/microvms',
  bridgeGateway: '10.10.0.1',
  bridgeInterface: 'br-microvm',
  sudoBin: '/run/current-system/sw/bin/sudo',
  systemctlBin: '/run/current-system/sw/bin/systemctl',
  iptablesBin: '/run/current-system/sw/bin/iptables',
  microvmBin: '/run/current-system/sw/bin/microvm',
  qemuBin: '/run/current-system/sw/bin/qemu-system-x86_64',
  qemuImgBin: '/run/current-system/sw/bin/qemu-img',
  ipBin: '/run/current-system/sw/bin/ip',
  distroCatalogUrl: null,
  jwtSecret: 'test-secret',
  sessionStoreType: 'memory',
  notify: { ntfyUrl: null, ntfyTopic: null, ntfyToken: null },
}

describe('Notification Config Routes', () => {
  let tempDir: string
  let configStore: NotificationConfigStore
  let notificationStore: NotificationStore
  let notificationService: NotificationService

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'notif-config-routes-'))
    configStore = new NotificationConfigStore(join(tempDir, 'notification-config.json'))
    await configStore.init()
    notificationStore = new NotificationStore(join(tempDir, 'notifications.json'))
    await notificationStore.init()
    notificationService = new NotificationService(notificationStore)
    await notificationService.reloadAdapters(configStore.getConfig())
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('weaver tier', () => {
    let fastify: ReturnType<typeof Fastify>

    beforeEach(async () => {
      mockUserRole = 'admin'
      fastify = Fastify().withTypeProvider<ZodTypeProvider>()
      fastify.decorateRequest('userId', undefined)
      fastify.decorateRequest('userRole', undefined)
      fastify.decorateRequest('username', undefined)
      fastify.decorateRequest('tokenId', undefined)
      fastify.decorateRequest('authRejectionReason', undefined)
      fastify.setValidatorCompiler(validatorCompiler)
      fastify.setSerializerCompiler(serializerCompiler)

      fastify.addHook('onRequest', async (request) => {
        request.userRole = mockUserRole
        request.userId = 'test-user-id'
        request.username = 'test-user'
      })

      await fastify.register(notificationConfigRoutes, {
        prefix: '/api/notifications/config',
        configStore,
        notificationService,
        config: { ...baseConfig, tier: 'weaver' as const },
      })
      await fastify.ready()
    })

    afterEach(async () => {
      await fastify.close()
    })

    // --- GET config ---

    it('GET / should return full config', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/api/notifications/config' })
      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.version).toBe(1)
      expect(body.channels['in-app']).toBeDefined()
      expect(body.resourceAlerts).toBeDefined()
    })

    it('GET / should require admin role', async () => {
      mockUserRole = 'viewer'
      const response = await fastify.inject({ method: 'GET', url: '/api/notifications/config' })
      expect(response.statusCode).toBe(403)
    })

    // --- PUT channels ---

    it('PUT /channels/:channelId should create a new channel', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/notifications/config/channels/ntfy',
        payload: {
          type: 'ntfy',
          enabled: true,
          events: ['vm:started', 'vm:failed'],
          url: 'https://ntfy.example.com',
          topic: 'dashboard',
        },
      })
      expect(response.statusCode).toBe(200)
      expect(response.json().ok).toBe(true)
      expect(response.json().channelId).toBe('ntfy')

      // Verify it's persisted
      expect(configStore.getChannel('ntfy')).not.toBeNull()
    })

    it('PUT /channels/:channelId should update existing channel', async () => {
      // First create
      await fastify.inject({
        method: 'PUT',
        url: '/api/notifications/config/channels/ntfy',
        payload: {
          type: 'ntfy',
          enabled: true,
          events: ['vm:started'],
          url: 'https://ntfy.example.com',
          topic: 'dashboard',
        },
      })

      // Then update
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/notifications/config/channels/ntfy',
        payload: {
          type: 'ntfy',
          enabled: false,
          events: ['vm:started', 'vm:failed'],
          url: 'https://ntfy2.example.com',
          topic: 'dashboard2',
        },
      })
      expect(response.statusCode).toBe(200)

      const channel = configStore.getChannel('ntfy')
      expect(channel!.enabled).toBe(false)
      if (channel!.type === 'ntfy') {
        expect(channel!.url).toBe('https://ntfy2.example.com')
      }
    })

    it('PUT /channels/:channelId should reject invalid body', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/notifications/config/channels/ntfy',
        payload: {
          type: 'ntfy',
          enabled: true,
          events: [],  // min 1 required
          url: 'not-a-url',
          topic: '',
        },
      })
      expect(response.statusCode).toBe(400)
    })

    it('PUT /channels/in-app should reject type change', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/notifications/config/channels/in-app',
        payload: {
          type: 'ntfy',
          enabled: true,
          events: ['vm:started'],
          url: 'https://ntfy.example.com',
          topic: 'dashboard',
        },
      })
      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('in-app')
    })

    it('PUT /channels/:channelId should require admin role', async () => {
      mockUserRole = 'operator'
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/notifications/config/channels/ntfy',
        payload: {
          type: 'ntfy',
          enabled: true,
          events: ['vm:started'],
          url: 'https://ntfy.example.com',
          topic: 'dashboard',
        },
      })
      expect(response.statusCode).toBe(403)
    })

    it('PUT /channels/:channelId should accept webhook channel', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/notifications/config/channels/slack-webhook',
        payload: {
          type: 'webhook',
          enabled: true,
          events: ['vm:failed', 'vm:recovered'],
          url: 'https://hooks.slack.com/services/test',
          method: 'POST',
          format: 'slack',
        },
      })
      expect(response.statusCode).toBe(200)
    })

    it('PUT /channels/:channelId should accept email channel', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/notifications/config/channels/email',
        payload: {
          type: 'email',
          enabled: true,
          events: ['vm:failed'],
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpUser: 'user@example.com',
          smtpPass: 'password',
          smtpSecure: true,
          fromAddress: 'noreply@example.com',
          recipients: ['admin@example.com'],
        },
      })
      expect(response.statusCode).toBe(200)
    })

    // --- DELETE channels ---

    it('DELETE /channels/:channelId should remove a channel', async () => {
      // Create first
      await configStore.setChannel('ntfy', {
        type: 'ntfy',
        enabled: true,
        events: ['vm:started'],
        url: 'https://ntfy.example.com',
        topic: 'dashboard',
      })

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/notifications/config/channels/ntfy',
      })
      expect(response.statusCode).toBe(200)
      expect(response.json().ok).toBe(true)
      expect(configStore.getChannel('ntfy')).toBeNull()
    })

    it('DELETE /channels/:channelId should return 404 for nonexistent channel', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/notifications/config/channels/nonexistent',
      })
      expect(response.statusCode).toBe(404)
    })

    it('DELETE /channels/in-app should be rejected', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/notifications/config/channels/in-app',
      })
      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('in-app')
    })

    // --- POST test ---

    it('POST /channels/:channelId/test should return 404 for unknown channel', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/notifications/config/channels/nonexistent/test',
      })
      expect(response.statusCode).toBe(404)
    })

    // --- PUT resource-alerts ---

    it('PUT /resource-alerts should update thresholds', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/notifications/config/resource-alerts',
        payload: {
          cpuThresholdPercent: 80,
          memoryThresholdPercent: 85,
        },
      })
      expect(response.statusCode).toBe(200)
      expect(response.json().ok).toBe(true)
      expect(response.json().resourceAlerts.cpuThresholdPercent).toBe(80)
      expect(response.json().resourceAlerts.memoryThresholdPercent).toBe(85)
      // checkIntervalSeconds should keep default
      expect(response.json().resourceAlerts.checkIntervalSeconds).toBe(30)
    })

    it('PUT /resource-alerts should reject invalid thresholds', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/notifications/config/resource-alerts',
        payload: { cpuThresholdPercent: 200 },  // max 100
      })
      expect(response.statusCode).toBe(400)
    })

    it('PUT /resource-alerts should require admin role', async () => {
      mockUserRole = 'viewer'
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/notifications/config/resource-alerts',
        payload: { cpuThresholdPercent: 80 },
      })
      expect(response.statusCode).toBe(403)
    })
  })

  describe('demo tier (weaver gating)', () => {
    let fastify: ReturnType<typeof Fastify>

    beforeEach(async () => {
      mockUserRole = 'admin'
      fastify = Fastify().withTypeProvider<ZodTypeProvider>()
      fastify.decorateRequest('userId', undefined)
      fastify.decorateRequest('userRole', undefined)
      fastify.decorateRequest('username', undefined)
      fastify.decorateRequest('tokenId', undefined)
      fastify.decorateRequest('authRejectionReason', undefined)
      fastify.setValidatorCompiler(validatorCompiler)
      fastify.setSerializerCompiler(serializerCompiler)

      fastify.addHook('onRequest', async (request) => {
        request.userRole = mockUserRole
        request.userId = 'test-user-id'
        request.username = 'test-user'
      })

      await fastify.register(notificationConfigRoutes, {
        prefix: '/api/notifications/config',
        configStore,
        notificationService,
        config: { ...baseConfig, tier: 'demo' as const },
      })
      await fastify.ready()
    })

    afterEach(async () => {
      await fastify.close()
    })

    it('GET / should still work (read-only)', async () => {
      const response = await fastify.inject({ method: 'GET', url: '/api/notifications/config' })
      expect(response.statusCode).toBe(200)
    })

    it('PUT /channels/:channelId should return 403', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/notifications/config/channels/ntfy',
        payload: {
          type: 'ntfy',
          enabled: true,
          events: ['vm:started'],
          url: 'https://ntfy.example.com',
          topic: 'dashboard',
        },
      })
      expect(response.statusCode).toBe(403)
      expect(response.json().error).toContain('weaver')
    })

    it('DELETE /channels/:channelId should return 403', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/notifications/config/channels/ntfy',
      })
      expect(response.statusCode).toBe(403)
    })

    it('PUT /resource-alerts should return 403', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/notifications/config/resource-alerts',
        payload: { cpuThresholdPercent: 80 },
      })
      expect(response.statusCode).toBe(403)
    })
  })
})

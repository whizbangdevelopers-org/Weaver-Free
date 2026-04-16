// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { NotificationConfigStore } from '../../storage/notification-config-store.js'
import type { NotificationService } from '../../services/notification.js'
import type { DashboardConfig } from '../../config.js'
import { requireTier } from '../../license.js'
import { requireRole } from '../../middleware/rbac.js'
import { TIERS, ROLES } from '../../constants/vocabularies.js'
import { createRateLimit } from '../../middleware/rate-limit.js'
import {
  channelConfigSchema,
  channelIdSchema,
  resourceAlertsSchema,
} from '../../schemas/notification-config.js'

interface NotificationConfigRouteOptions {
  configStore: NotificationConfigStore
  notificationService: NotificationService
  config: DashboardConfig
}

export const notificationConfigRoutes: FastifyPluginAsync<NotificationConfigRouteOptions> = async (app, opts) => {
  const { configStore, notificationService, config } = opts

  // GET /api/notifications/config — full notification config (admin only)
  app.get('/', {
    preHandler: [requireRole(ROLES.ADMIN)],
  }, async () => {
    return configStore.getConfig()
  })

  // PUT /api/notifications/config/channels/:channelId — create/update channel (admin, weaver+)
  app.put('/channels/:channelId', {
    schema: {
      params: channelIdSchema,
      body: channelConfigSchema,
    },
    preHandler: [requireRole(ROLES.ADMIN)],
  }, async (request, reply) => {
    try {
      requireTier(config, TIERS.SOLO)
    } catch {
      return reply.status(403).send({ error: 'Notification channel configuration requires weaver tier or higher' })
    }

    const { channelId } = request.params as { channelId: string }
    const channelConfig = request.body as unknown as import('../../models/notification-config.js').ChannelConfig

    // Prevent removing in-app channel
    if (channelId === 'in-app' && channelConfig.type !== 'in-app') {
      return reply.status(400).send({ error: 'Cannot change the type of the in-app channel' })
    }

    await configStore.setChannel(channelId, channelConfig)
    await notificationService.reloadAdapters(configStore.getConfig())

    return { ok: true, channelId }
  })

  // DELETE /api/notifications/config/channels/:channelId — remove channel (admin, weaver+)
  app.delete('/channels/:channelId', {
    schema: { params: channelIdSchema },
    preHandler: [requireRole(ROLES.ADMIN)],
  }, async (request, reply) => {
    try {
      requireTier(config, TIERS.SOLO)
    } catch {
      return reply.status(403).send({ error: 'Notification channel configuration requires weaver tier or higher' })
    }

    const { channelId } = request.params as { channelId: string }

    // Prevent removing in-app channel
    if (channelId === 'in-app') {
      return reply.status(400).send({ error: 'Cannot remove the in-app channel' })
    }

    const removed = await configStore.removeChannel(channelId)
    if (!removed) {
      return reply.status(404).send({ error: `Channel '${channelId}' not found` })
    }

    await notificationService.reloadAdapters(configStore.getConfig())

    return { ok: true, channelId }
  })

  // POST /api/notifications/config/channels/:channelId/test — test specific channel (admin)
  app.post('/channels/:channelId/test', {
    schema: { params: channelIdSchema },
    preHandler: [requireRole(ROLES.ADMIN)],
    config: { rateLimit: createRateLimit(5) },
  }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }

    const result = await notificationService.testChannel(channelId)
    if (!result) {
      return reply.status(404).send({ error: `Channel '${channelId}' not found or not loaded` })
    }

    return result
  })

  // PUT /api/notifications/config/resource-alerts — update thresholds (admin, weaver+)
  app.put('/resource-alerts', {
    schema: { body: resourceAlertsSchema },
    preHandler: [requireRole(ROLES.ADMIN)],
  }, async (request, reply) => {
    try {
      requireTier(config, TIERS.SOLO)
    } catch {
      return reply.status(403).send({ error: 'Resource alert configuration requires weaver tier or higher' })
    }

    const alerts = request.body as { cpuThresholdPercent?: number; memoryThresholdPercent?: number; checkIntervalSeconds?: number }
    await configStore.updateResourceAlerts(alerts)

    return { ok: true, resourceAlerts: configStore.getConfig().resourceAlerts }
  })
}

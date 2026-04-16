// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { NotificationService } from '../services/notification.js'
import { requireRole } from '../middleware/rbac.js'
import { ROLES } from '../constants/vocabularies.js'

interface NotificationRouteOptions {
  notificationService: NotificationService
}

export const notificationRoutes: FastifyPluginAsync<NotificationRouteOptions> = async (app, opts) => {
  const { notificationService } = opts

  // GET /api/notifications — recent notifications (admin/operator only — contains security events)
  app.get('/', {
    preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR)],
    schema: {
      querystring: z.object({
        limit: z.coerce.number().min(1).max(100).optional().default(50),
      }),
      response: {
        200: z.object({
          notifications: z.array(z.object({
            id: z.string(),
            timestamp: z.string(),
            event: z.string(),
            vmName: z.string().optional(),
            severity: z.enum(['info', 'success', 'error']),
            message: z.string(),
            details: z.record(z.unknown()).optional(),
          })),
        }),
      },
    },
  }, async (request) => {
    const { limit } = request.query as { limit: number }
    return { notifications: notificationService.getRecentNotifications(limit) }
  })

  // POST /api/notifications/test — send test notification to all adapters
  app.post('/test', {
    schema: {
      response: {
        200: z.object({
          sent: z.array(z.string()),
          failed: z.array(z.string()),
        }),
      },
    },
    preHandler: [requireRole(ROLES.ADMIN)],
  }, async () => {
    return notificationService.sendTestNotification()
  })
}

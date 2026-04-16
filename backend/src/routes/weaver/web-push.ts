// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import webpush from 'web-push'
import type { WebPushSubscriptionStore } from '../../storage/web-push-subscription-store.js'
import type { NotificationConfigStore } from '../../storage/notification-config-store.js'
import { requireRole } from '../../middleware/rbac.js'
import { ROLES } from '../../constants/vocabularies.js'

interface WebPushRouteOptions {
  subscriptionStore: WebPushSubscriptionStore
  configStore: NotificationConfigStore
}

interface SubscriptionBody {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export const webPushRoutes: FastifyPluginAsync<WebPushRouteOptions> = async (app, opts) => {
  const { subscriptionStore, configStore } = opts

  // POST /api/notifications/web-push/subscribe — register push subscription
  app.post('/subscribe', {
    schema: { body: subscriptionSchema },
  }, async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Authentication required' })
    }

    const { endpoint, keys } = request.body as SubscriptionBody

    await subscriptionStore.add({
      endpoint,
      keys,
      userId: request.userId,
      createdAt: new Date().toISOString(),
    })

    return { ok: true }
  })

  // DELETE /api/notifications/web-push/subscribe — unsubscribe
  app.delete('/subscribe', {
    schema: {
      body: z.object({ endpoint: z.string().url() }),
    },
  }, async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Authentication required' })
    }

    const { endpoint } = request.body as { endpoint: string }
    const removed = await subscriptionStore.remove(endpoint)

    if (!removed) {
      return reply.status(404).send({ error: 'Subscription not found' })
    }

    return { ok: true }
  })

  // GET /api/notifications/web-push/vapid-public-key — get public key for browser subscription
  app.get('/vapid-public-key', async (_request, reply) => {
    const config = configStore.getConfig()
    const webPushChannel = Object.values(config.channels).find(c => c.type === 'web-push')

    if (!webPushChannel || webPushChannel.type !== 'web-push') {
      return reply.status(404).send({ error: 'Web Push is not configured' })
    }

    return { vapidPublicKey: webPushChannel.vapidPublicKey }
  })

  // POST /api/notifications/web-push/generate-vapid-keys — generate VAPID key pair (admin only)
  app.post('/generate-vapid-keys', {
    preHandler: [requireRole(ROLES.ADMIN)],
  }, async () => {
    const keys = webpush.generateVAPIDKeys()
    return {
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    }
  })
}

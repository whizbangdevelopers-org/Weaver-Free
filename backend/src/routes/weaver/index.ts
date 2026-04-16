// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { notificationConfigRoutes } from './notification-config.js'
import { webPushRoutes } from './web-push.js'
import { networkMgmtRoutes } from './network-mgmt.js'
import type { DashboardConfig } from '../../config.js'
import type { AuditService } from '../../services/audit.js'
import type { NotificationConfigStore } from '../../storage/notification-config-store.js'
import type { NotificationService } from '../../services/notification.js'
import type { WebPushSubscriptionStore } from '../../storage/web-push-subscription-store.js'
import type { NetworkManager } from '../../services/weaver/network-manager.js'

export interface PremiumRouteOptions {
  config: DashboardConfig
  auditService?: AuditService
  notificationConfigStore: NotificationConfigStore
  notificationService: NotificationService
  webPushSubscriptionStore: WebPushSubscriptionStore
  networkManager?: NetworkManager | null
}

export const premiumRoutes: FastifyPluginAsync<PremiumRouteOptions> = async (fastify, opts) => {
  const {
    config, notificationConfigStore, notificationService,
    webPushSubscriptionStore, networkManager,
  } = opts

  await fastify.register(notificationConfigRoutes, {
    prefix: '/api/notifications/config',
    configStore: notificationConfigStore,
    notificationService,
    config,
  })

  await fastify.register(webPushRoutes, {
    prefix: '/api/notifications/web-push',
    subscriptionStore: webPushSubscriptionStore,
    configStore: notificationConfigStore,
  })

  await fastify.register(networkMgmtRoutes, {
    prefix: '/api/network',
    config,
    networkManager: networkManager!,
  })
}

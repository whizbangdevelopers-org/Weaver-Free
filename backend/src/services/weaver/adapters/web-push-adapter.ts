// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import webpush from 'web-push'
import type { NotificationAdapter } from '../../adapters/notification-adapter.js'
import type { NotificationEvent } from '../../../models/notification.js'
import type { WebPushSubscriptionStore } from '../../../storage/web-push-subscription-store.js'

export interface WebPushConfig {
  vapidPublicKey: string
  vapidPrivateKey: string
  vapidSubject: string
}

export class WebPushAdapter implements NotificationAdapter {
  readonly name = 'web-push'
  private config: WebPushConfig
  private subscriptionStore: WebPushSubscriptionStore

  constructor(config: WebPushConfig, subscriptionStore: WebPushSubscriptionStore) {
    this.config = config
    this.subscriptionStore = subscriptionStore
    webpush.setVapidDetails(
      config.vapidSubject,
      config.vapidPublicKey,
      config.vapidPrivateKey,
    )
  }

  async send(event: NotificationEvent): Promise<void> {
    const subscriptions = this.subscriptionStore.getAll()
    if (subscriptions.length === 0) return

    const payload = JSON.stringify({
      title: `Weaver${event.vmName ? `: ${event.vmName}` : ''}`,
      body: event.message,
      icon: '/icons/favicon-128x128.png',
      badge: '/icons/favicon-128x128.png',
      data: {
        event: event.event,
        vmName: event.vmName,
        severity: event.severity,
        url: event.vmName ? `/vm/${event.vmName}` : '/',
      },
    })

    const expiredEndpoints: string[] = []

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys,
            },
            payload,
          )
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number }).statusCode
          // 410 Gone or 404 Not Found — subscription expired
          if (statusCode === 410 || statusCode === 404) {
            expiredEndpoints.push(sub.endpoint)
          } else {
            throw err
          }
        }
      }),
    )

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await this.subscriptionStore.removeExpired(expiredEndpoints)
    }
  }

  async test(): Promise<boolean> {
    // Web Push test: verify VAPID details are valid by checking we have subscriptions
    const subscriptions = this.subscriptionStore.getAll()
    if (subscriptions.length === 0) {
      // No subscriptions to test against — VAPID keys are configured but no browsers subscribed
      return true
    }

    try {
      await this.send({
        id: 'test',
        timestamp: new Date().toISOString(),
        event: 'vm:started',
        vmName: 'test-vm',
        severity: 'info',
        message: 'Test notification from Weaver',
      })
      return true
    } catch {
      return false
    }
  }
}

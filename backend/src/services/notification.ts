// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { randomUUID } from 'node:crypto'
import type { NotificationAdapter } from './adapters/notification-adapter.js'
import type { NotificationStore } from '../storage/notification-store.js'
import type { WebPushSubscriptionStore } from '../storage/web-push-subscription-store.js'
import type {
  NotificationEvent,
  NotificationEventType,
  NotificationSeverity,
} from '../models/notification.js'
import type { NotificationChannelConfigData, ChannelConfig } from '../models/notification-config.js'
import type { WorkloadInfo } from './microvm.js'
import { STATUSES } from '../constants/vocabularies.js'

const EVENT_SEVERITY: Record<NotificationEventType, NotificationSeverity> = {
  'vm:started': 'info',
  'vm:stopped': 'info',
  'vm:failed': 'error',
  'vm:recovered': 'success',
  'resource:high-cpu': 'error',
  'resource:high-memory': 'error',
  'security:auth-failure': 'error',
  'security:unauthorized-access': 'error',
  'security:permission-denied': 'info',
}

const EVENT_MESSAGES: Record<NotificationEventType, (name?: string) => string> = {
  'vm:started': (name) => `${name} started`,
  'vm:stopped': (name) => `${name} stopped`,
  'vm:failed': (name) => `${name} failed`,
  'vm:recovered': (name) => `${name} recovered`,
  'resource:high-cpu': (name) => `${name ?? 'VM'} CPU usage is high`,
  'resource:high-memory': (name) => `${name ?? 'VM'} memory usage is high`,
  'security:auth-failure': () => 'Authentication failure detected',
  'security:unauthorized-access': () => 'Unauthorized access — invalid or missing credentials',
  'security:permission-denied': () => 'Permission denied — insufficient role',
}

export class NotificationService {
  /** channelId -> adapter instance */
  private adapters = new Map<string, NotificationAdapter>()
  /** channelId -> subscribed event types */
  private channelEvents = new Map<string, NotificationEventType[]>()
  private store: NotificationStore
  private webPushSubscriptionStore: WebPushSubscriptionStore | null = null
  private previousStatus = new Map<string, string>()
  private listeners: Array<(event: NotificationEvent) => void> = []

  constructor(store: NotificationStore) {
    this.store = store
  }

  setWebPushSubscriptionStore(store: WebPushSubscriptionStore): void {
    this.webPushSubscriptionStore = store
  }

  /**
   * Reload all adapters from the persisted config.
   * Called on startup and after any config change.
   */
  async reloadAdapters(config: NotificationChannelConfigData): Promise<void> {
    this.adapters.clear()
    this.channelEvents.clear()

    for (const [channelId, channelConfig] of Object.entries(config.channels)) {
      if (!channelConfig.enabled) continue

      // Store per-channel event subscriptions
      this.channelEvents.set(channelId, [...channelConfig.events])

      // Create adapter for push channels (in-app is handled separately via listeners)
      const adapter = await this.createAdapter(channelId, channelConfig)
      if (adapter) {
        this.adapters.set(channelId, adapter)
      }
    }
  }

  /**
   * Check if the in-app channel is subscribed to a given event type.
   */
  shouldBroadcastInApp(eventType: NotificationEventType): boolean {
    const inAppEvents = this.channelEvents.get('in-app')
    if (!inAppEvents) return true // Default: broadcast all if no config
    return inAppEvents.includes(eventType)
  }

  getAdapters(): NotificationAdapter[] {
    return [...this.adapters.values()]
  }

  onNotification(listener: (event: NotificationEvent) => void): void {
    this.listeners.push(listener)
  }

  offNotification(listener: (event: NotificationEvent) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener)
  }

  /**
   * Detect VM state changes and emit notification events.
   * Called from the WebSocket broadcast loop with each status update.
   */
  async detectChanges(currentVms: WorkloadInfo[]): Promise<NotificationEvent[]> {
    const events: NotificationEvent[] = []

    for (const vm of currentVms) {
      const prev = this.previousStatus.get(vm.name)
      if (prev !== undefined && prev !== vm.status) {
        const event = this.createEvent(vm.name, prev, vm.status)
        if (event) {
          events.push(event)
          await this.store.add(event)

          // Notify listeners (used by WS broadcast) if in-app channel subscribes
          if (this.shouldBroadcastInApp(event.event)) {
            for (const listener of this.listeners) {
              listener(event)
            }
          }

          // Dispatch to push adapters based on per-channel event subscriptions
          await this.dispatchToAdapters(event)
        }
      }
      this.previousStatus.set(vm.name, vm.status)
    }

    return events
  }

  /**
   * Emit a security notification event.
   * Convenience wrapper around emitEvent for security-related alerts.
   */
  async emitSecurityEvent(
    eventType: 'security:auth-failure' | 'security:unauthorized-access' | 'security:permission-denied',
    details?: Record<string, unknown>,
  ): Promise<void> {
    const event: NotificationEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      event: eventType,
      severity: EVENT_SEVERITY[eventType],
      message: EVENT_MESSAGES[eventType](),
      details,
    }
    await this.emitEvent(event)
  }

  /**
   * Emit a notification event directly (for security events, resource alerts, etc.).
   * Stores the event, notifies listeners, and dispatches to adapters.
   */
  async emitEvent(event: NotificationEvent): Promise<void> {
    await this.store.add(event)

    if (this.shouldBroadcastInApp(event.event)) {
      for (const listener of this.listeners) {
        listener(event)
      }
    }

    await this.dispatchToAdapters(event)
  }

  getRecentNotifications(limit?: number): NotificationEvent[] {
    return this.store.getRecent(limit)
  }

  /**
   * Send a test notification to all loaded push adapters.
   */
  async sendTestNotification(): Promise<{ sent: string[]; failed: string[] }> {
    const testEvent: NotificationEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      event: 'vm:started',
      vmName: 'test-vm',
      severity: 'info',
      message: 'Test notification from Weaver',
    }

    const sent: string[] = []
    const failed: string[] = []

    for (const [channelId, adapter] of this.adapters) {
      try {
        await adapter.send(testEvent)
        sent.push(channelId)
      } catch {
        failed.push(channelId)
      }
    }

    return { sent, failed }
  }

  /**
   * Test a specific channel by ID.
   * Returns null if channel not found/loaded.
   */
  async testChannel(channelId: string): Promise<{ success: boolean; channelId: string } | null> {
    const adapter = this.adapters.get(channelId)
    if (!adapter) return null

    const success = await adapter.test()
    return { success, channelId }
  }

  private createEvent(vmName: string, prevStatus: string, newStatus: string): NotificationEvent | null {
    let eventType: NotificationEventType | null = null

    if (prevStatus === STATUSES.FAILED && newStatus === STATUSES.RUNNING) {
      eventType = 'vm:recovered'
    } else if (newStatus === STATUSES.RUNNING) {
      eventType = 'vm:started'
    } else if (newStatus === STATUSES.STOPPED) {
      eventType = 'vm:stopped'
    } else if (newStatus === STATUSES.FAILED) {
      eventType = 'vm:failed'
    }

    if (!eventType) return null

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      event: eventType,
      vmName,
      severity: EVENT_SEVERITY[eventType],
      message: EVENT_MESSAGES[eventType](vmName),
      details: { previousStatus: prevStatus, newStatus },
    }
  }

  /**
   * Dispatch an event to all push adapters that subscribe to its event type.
   */
  private async dispatchToAdapters(event: NotificationEvent): Promise<void> {
    const dispatches: Promise<void>[] = []
    for (const [channelId, adapter] of this.adapters) {
      const events = this.channelEvents.get(channelId)
      if (events && !events.includes(event.event)) continue

      dispatches.push(
        adapter.send(event).catch(err => {
          // Log but don't crash — adapters should be resilient
          console.error(`[notification] ${channelId} adapter failed:`, err)
        })
      )
    }
    await Promise.all(dispatches)
  }

  /**
   * Factory: create an adapter from a channel config.
   * Returns null for in-app (no push adapter needed), unknown types,
   * or when premium adapters are not available (free tier).
   */
  private async createAdapter(_channelId: string, config: ChannelConfig): Promise<NotificationAdapter | null> {
    try {
      switch (config.type) {
        case 'ntfy': {
          const { NtfyAdapter } = await import('./weaver/adapters/ntfy-adapter.js')
          return new NtfyAdapter({
            url: config.url,
            topic: config.topic,
            token: config.token,
          })
        }
        case 'email': {
          const { EmailAdapter } = await import('./weaver/adapters/email-adapter.js')
          return new EmailAdapter({
            smtpHost: config.smtpHost,
            smtpPort: config.smtpPort,
            smtpUser: config.smtpUser,
            smtpPass: config.smtpPass,
            smtpSecure: config.smtpSecure,
            fromAddress: config.fromAddress,
            recipients: config.recipients,
          })
        }
        case 'webhook': {
          const { WebhookAdapter } = await import('./weaver/adapters/webhook-adapter.js')
          return new WebhookAdapter({
            url: config.url,
            method: config.method,
            headers: config.headers,
            format: config.format,
          })
        }
        case 'web-push': {
          if (!this.webPushSubscriptionStore) return null
          const { WebPushAdapter } = await import('./weaver/adapters/web-push-adapter.js')
          return new WebPushAdapter(
            {
              vapidPublicKey: config.vapidPublicKey,
              vapidPrivateKey: config.vapidPrivateKey,
              vapidSubject: config.vapidSubject,
            },
            this.webPushSubscriptionStore,
          )
        }
        case 'in-app':
          return null // In-app is handled via listeners, not a push adapter
        default:
          return null
      }
    } catch {
      return null // Premium adapters not available in free tier
    }
  }
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
export type NotificationSeverity = 'info' | 'success' | 'error' | 'warning'

export type NotificationEventType =
  // VM state changes
  | 'vm:started'
  | 'vm:stopped'
  | 'vm:failed'
  | 'vm:recovered'
  // Resource alerts
  | 'resource:high-cpu'
  | 'resource:high-memory'
  // Security events
  | 'security:auth-failure'
  | 'security:unauthorized-access'
  | 'security:permission-denied'
  // Migration events (Fabrick v2.3+)
  | 'migration:eligible'
  | 'migration:completed'
  // Fleet bridge events (Fabrick v3.0+ — Decision #114)
  | 'fleet-bridge:blue-green'
  | 'fleet-bridge:cordon'
  | 'fleet-bridge:weight-adjust'
  | 'fleet-bridge:endpoint-registered'
  | 'fleet-bridge:hub-sync'

export type NotificationEventCategory = 'vm' | 'resource' | 'security' | 'migration' | 'fleet-bridge'

export const EVENT_CATEGORIES: Record<NotificationEventCategory, NotificationEventType[]> = {
  vm: ['vm:started', 'vm:stopped', 'vm:failed', 'vm:recovered'],
  resource: ['resource:high-cpu', 'resource:high-memory'],
  security: ['security:auth-failure', 'security:unauthorized-access', 'security:permission-denied'],
  migration: ['migration:eligible', 'migration:completed'],
  'fleet-bridge': ['fleet-bridge:blue-green', 'fleet-bridge:cordon', 'fleet-bridge:weight-adjust', 'fleet-bridge:endpoint-registered', 'fleet-bridge:hub-sync'],
}

export interface NotificationEvent {
  id: string
  timestamp: string
  event: NotificationEventType
  vmName?: string
  severity: NotificationSeverity
  message: string
  details?: Record<string, unknown>
}

// --- Channel config types (mirror backend/src/models/notification-config.ts) ---

export type NotificationChannelType = 'in-app' | 'ntfy' | 'email' | 'webhook' | 'web-push'

export interface ChannelConfigBase {
  enabled: boolean
  events: NotificationEventType[]
}

export interface InAppChannelConfig extends ChannelConfigBase {
  type: 'in-app'
}

export interface NtfyChannelConfig extends ChannelConfigBase {
  type: 'ntfy'
  url: string
  topic: string
  token?: string
}

export interface EmailChannelConfig extends ChannelConfigBase {
  type: 'email'
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpSecure: boolean
  fromAddress: string
  recipients: string[]
}

export interface WebhookChannelConfig extends ChannelConfigBase {
  type: 'webhook'
  url: string
  method: 'POST' | 'PUT'
  headers?: Record<string, string>
  format: 'json' | 'slack' | 'discord' | 'pagerduty'
}

export interface WebPushChannelConfig extends ChannelConfigBase {
  type: 'web-push'
  vapidPublicKey: string
  vapidPrivateKey: string
  vapidSubject: string
}

export type ChannelConfig =
  | InAppChannelConfig
  | NtfyChannelConfig
  | EmailChannelConfig
  | WebhookChannelConfig
  | WebPushChannelConfig

export interface ResourceAlertConfig {
  cpuThresholdPercent: number
  memoryThresholdPercent: number
  checkIntervalSeconds: number
}

export interface NotificationChannelConfigData {
  version: 1
  channels: Record<string, ChannelConfig>
  globalDefaults: {
    enabledEvents: NotificationEventType[]
  }
  resourceAlerts: ResourceAlertConfig
}

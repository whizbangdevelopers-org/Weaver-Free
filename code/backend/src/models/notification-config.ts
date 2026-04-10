// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { NotificationEventType } from './notification.js'

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

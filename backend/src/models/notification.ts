// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
export type NotificationSeverity = 'info' | 'success' | 'error'

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

export type NotificationEventCategory = 'vm' | 'resource' | 'security'

export const EVENT_CATEGORIES: Record<NotificationEventCategory, NotificationEventType[]> = {
  vm: ['vm:started', 'vm:stopped', 'vm:failed', 'vm:recovered'],
  resource: ['resource:high-cpu', 'resource:high-memory'],
  security: ['security:auth-failure', 'security:unauthorized-access', 'security:permission-denied'],
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

export interface NotificationConfig {
  enabledEvents: NotificationEventType[]
  ntfy?: {
    url: string
    topic: string
    token?: string
  }
}

export const ALL_NOTIFICATION_EVENTS: NotificationEventType[] = [
  'vm:started',
  'vm:stopped',
  'vm:failed',
  'vm:recovered',
  'resource:high-cpu',
  'resource:high-memory',
  'security:auth-failure',
  'security:unauthorized-access',
  'security:permission-denied',
]

export const DEFAULT_ENABLED_EVENTS: NotificationEventType[] = [
  'vm:started',
  'vm:failed',
  'vm:recovered',
]

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { NotificationAdapter } from '../../adapters/notification-adapter.js'
import type { NotificationEvent } from '../../../models/notification.js'
import { validateExternalUrl } from '../../../validate-url.js'

export type WebhookFormat = 'json' | 'slack' | 'discord' | 'pagerduty'

export interface WebhookConfig {
  url: string
  method: 'POST' | 'PUT'
  headers?: Record<string, string>
  format: WebhookFormat
}

const SEVERITY_COLOR: Record<string, string> = {
  info: '#2196F3',
  success: '#4CAF50',
  error: '#F44336',
}

const SEVERITY_EMOJI: Record<string, string> = {
  info: ':information_source:',
  success: ':white_check_mark:',
  error: ':x:',
}

export class WebhookAdapter implements NotificationAdapter {
  readonly name = 'webhook'
  private config: WebhookConfig

  constructor(config: WebhookConfig) {
    this.config = config
  }

  async send(event: NotificationEvent): Promise<void> {
    validateExternalUrl(this.config.url)
    const body = this.formatBody(event)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    }

    const response = await fetch(this.config.url, {
      method: this.config.method,
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`)
    }
  }

  async test(): Promise<boolean> {
    try {
      const testEvent: NotificationEvent = {
        id: 'test',
        timestamp: new Date().toISOString(),
        event: 'vm:started',
        vmName: 'test-vm',
        severity: 'info',
        message: 'Test notification from Weaver',
      }
      await this.send(testEvent)
      return true
    } catch {
      return false
    }
  }

  private formatBody(event: NotificationEvent): unknown {
    switch (this.config.format) {
      case 'slack':
        return this.formatSlack(event)
      case 'discord':
        return this.formatDiscord(event)
      case 'pagerduty':
        return this.formatPagerDuty(event)
      case 'json':
      default:
        return this.formatJson(event)
    }
  }

  private formatJson(event: NotificationEvent): unknown {
    return {
      source: 'weaver',
      event: event.event,
      vmName: event.vmName,
      severity: event.severity,
      message: event.message,
      timestamp: event.timestamp,
      details: event.details,
    }
  }

  private formatSlack(event: NotificationEvent): unknown {
    const emoji = SEVERITY_EMOJI[event.severity] || ''
    const color = SEVERITY_COLOR[event.severity] || '#757575'
    return {
      attachments: [{
        color,
        fallback: event.message,
        title: `${emoji} Weaver`,
        text: event.message,
        fields: [
          { title: 'Event', value: event.event, short: true },
          { title: 'Severity', value: event.severity, short: true },
          ...(event.vmName ? [{ title: 'VM', value: event.vmName, short: true }] : []),
        ],
        ts: Math.floor(new Date(event.timestamp).getTime() / 1000),
      }],
    }
  }

  private formatDiscord(event: NotificationEvent): unknown {
    const color = parseInt(SEVERITY_COLOR[event.severity]?.replace('#', '') || '757575', 16)
    return {
      embeds: [{
        title: 'Weaver Notification',
        description: event.message,
        color,
        fields: [
          { name: 'Event', value: event.event, inline: true },
          { name: 'Severity', value: event.severity, inline: true },
          ...(event.vmName ? [{ name: 'VM', value: event.vmName, inline: true }] : []),
        ],
        timestamp: event.timestamp,
      }],
    }
  }

  private formatPagerDuty(event: NotificationEvent): unknown {
    const severity = event.severity === 'error' ? 'critical' : event.severity === 'success' ? 'info' : 'warning'
    return {
      routing_key: this.config.headers?.['X-Routing-Key'] || '',
      event_action: event.severity === 'error' ? 'trigger' : 'resolve',
      payload: {
        summary: event.message,
        source: 'weaver',
        severity,
        component: event.vmName || 'dashboard',
        custom_details: event.details,
      },
    }
  }
}

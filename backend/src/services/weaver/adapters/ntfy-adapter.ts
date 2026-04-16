// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { NotificationAdapter } from '../../adapters/notification-adapter.js'
import type { NotificationEvent } from '../../../models/notification.js'
import { validateExternalUrl } from '../../../validate-url.js'

export interface NtfyConfig {
  url: string
  topic: string
  token?: string
}

export class NtfyAdapter implements NotificationAdapter {
  readonly name = 'ntfy'
  private config: NtfyConfig

  constructor(config: NtfyConfig) {
    this.config = config
  }

  async send(event: NotificationEvent): Promise<void> {
    validateExternalUrl(this.config.url)
    const priority = event.severity === 'error' ? 4 : 3
    const url = `${this.config.url.replace(/\/+$/, '')}/${this.config.topic}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `Weaver${event.vmName ? `: ${event.vmName}` : ''}`,
        message: event.message,
        priority,
        tags: [event.event.replace(':', '-')],
      }),
    })

    if (!response.ok) {
      throw new Error(`ntfy request failed: ${response.status} ${response.statusText}`)
    }
  }

  async test(): Promise<boolean> {
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

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type {
  NotificationChannelConfigData,
  ChannelConfig,
  ResourceAlertConfig,
} from '../models/notification-config.js'
import { ALL_NOTIFICATION_EVENTS } from '../models/notification.js'

const DEFAULT_CONFIG: NotificationChannelConfigData = {
  version: 1,
  channels: {
    'in-app': {
      type: 'in-app',
      enabled: true,
      events: [...ALL_NOTIFICATION_EVENTS],
    },
  },
  globalDefaults: {
    enabledEvents: [...ALL_NOTIFICATION_EVENTS],
  },
  resourceAlerts: {
    cpuThresholdPercent: 90,
    memoryThresholdPercent: 90,
    checkIntervalSeconds: 30,
  },
}

export class NotificationConfigStore {
  private filePath: string
  private data: NotificationChannelConfigData = structuredClone(DEFAULT_CONFIG)

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      this.data = JSON.parse(raw) as NotificationChannelConfigData
    } catch {
      await mkdir(dirname(this.filePath), { recursive: true })
      await this.persist()
    }
  }

  getConfig(): NotificationChannelConfigData {
    return structuredClone(this.data)
  }

  getChannel(id: string): ChannelConfig | null {
    return this.data.channels[id] ? structuredClone(this.data.channels[id]) : null
  }

  async setChannel(id: string, config: ChannelConfig): Promise<void> {
    this.data.channels[id] = config
    await this.persist()
  }

  async removeChannel(id: string): Promise<boolean> {
    if (!this.data.channels[id]) return false
    delete this.data.channels[id]
    await this.persist()
    return true
  }

  async updateResourceAlerts(alerts: Partial<ResourceAlertConfig>): Promise<void> {
    this.data.resourceAlerts = { ...this.data.resourceAlerts, ...alerts }
    await this.persist()
  }

  /**
   * Seed ntfy channel from environment variables on first init.
   * Only adds if no ntfy channel is already configured.
   */
  async seedFromEnv(notify: { ntfyUrl: string | null; ntfyTopic: string | null; ntfyToken: string | null }): Promise<void> {
    if (!notify.ntfyUrl || !notify.ntfyTopic) return

    // Check if any ntfy channel already exists
    const hasNtfy = Object.values(this.data.channels).some(c => c.type === 'ntfy')
    if (hasNtfy) return

    this.data.channels['ntfy'] = {
      type: 'ntfy',
      enabled: true,
      events: [...this.data.globalDefaults.enabledEvents],
      url: notify.ntfyUrl,
      topic: notify.ntfyTopic,
      token: notify.ntfyToken ?? undefined,
    }
    await this.persist()
  }

  private async persist(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }
}

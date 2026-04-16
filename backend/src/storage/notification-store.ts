// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { NotificationEvent } from '../models/notification.js'

const MAX_NOTIFICATIONS = 100

export class NotificationStore {
  private notifications: NotificationEvent[] = []
  private filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    try {
      const data = await readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(data) as NotificationEvent[]
      this.notifications = Array.isArray(parsed) ? parsed.slice(-MAX_NOTIFICATIONS) : []
    } catch {
      this.notifications = []
    }
  }

  async add(event: NotificationEvent): Promise<void> {
    this.notifications.push(event)
    if (this.notifications.length > MAX_NOTIFICATIONS) {
      this.notifications = this.notifications.slice(-MAX_NOTIFICATIONS)
    }
    await this.persist()
  }

  getRecent(limit = 50): NotificationEvent[] {
    return this.notifications.slice(-limit).reverse()
  }

  getAll(): NotificationEvent[] {
    return [...this.notifications].reverse()
  }

  async clear(): Promise<void> {
    this.notifications = []
    await this.persist()
  }

  private async persist(): Promise<void> {
    try {
      await mkdir(dirname(this.filePath), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(this.notifications, null, 2))
    } catch {
      // Silently fail — notifications are ephemeral
    }
  }
}

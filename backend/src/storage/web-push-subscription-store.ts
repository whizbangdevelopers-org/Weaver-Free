// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  userId: string
  createdAt: string
}

interface StoreData {
  subscriptions: PushSubscription[]
}

export class WebPushSubscriptionStore {
  private filePath: string
  private data: StoreData = { subscriptions: [] }

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      this.data = JSON.parse(raw) as StoreData
    } catch {
      await mkdir(dirname(this.filePath), { recursive: true })
      await this.persist()
    }
  }

  getAll(): PushSubscription[] {
    return [...this.data.subscriptions]
  }

  getByUserId(userId: string): PushSubscription[] {
    return this.data.subscriptions.filter(s => s.userId === userId)
  }

  async add(subscription: PushSubscription): Promise<void> {
    // Remove existing subscription with same endpoint (re-subscribe)
    this.data.subscriptions = this.data.subscriptions.filter(
      s => s.endpoint !== subscription.endpoint
    )
    this.data.subscriptions.push(subscription)
    await this.persist()
  }

  async remove(endpoint: string): Promise<boolean> {
    const before = this.data.subscriptions.length
    this.data.subscriptions = this.data.subscriptions.filter(s => s.endpoint !== endpoint)
    if (this.data.subscriptions.length === before) return false
    await this.persist()
    return true
  }

  async removeExpired(endpoints: string[]): Promise<void> {
    if (endpoints.length === 0) return
    const endpointSet = new Set(endpoints)
    this.data.subscriptions = this.data.subscriptions.filter(
      s => !endpointSet.has(s.endpoint)
    )
    await this.persist()
  }

  private async persist(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }
}

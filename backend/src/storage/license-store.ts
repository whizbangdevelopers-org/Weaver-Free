// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface LicenseRecord {
  key: string
  tier: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  expiresAt: string
  createdAt: string
  email: string | null
  foundingMember: boolean
  revokedAt?: string | null
}

export class LicenseStore {
  private filePath: string
  private records: LicenseRecord[] = []

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      this.records = JSON.parse(raw) as LicenseRecord[]
    } catch {
      // File doesn't exist yet — start empty
    }
  }

  async save(record: LicenseRecord): Promise<void> {
    // Prevent duplicates by subscription ID
    const existing = this.records.findIndex(r => r.stripeSubscriptionId === record.stripeSubscriptionId)
    if (existing >= 0) {
      this.records[existing] = record
    } else {
      this.records.push(record)
    }
    await this.persist()
  }

  findByKey(key: string): LicenseRecord | null {
    return this.records.find(r => r.key === key && !r.revokedAt) ?? null
  }

  findBySubscription(subscriptionId: string): LicenseRecord | null {
    return this.records.find(r => r.stripeSubscriptionId === subscriptionId) ?? null
  }

  findByCustomer(customerId: string): LicenseRecord[] {
    return this.records.filter(r => r.stripeCustomerId === customerId && !r.revokedAt)
  }

  async updateExpiry(subscriptionId: string, expiresAt: string): Promise<boolean> {
    const record = this.records.find(r => r.stripeSubscriptionId === subscriptionId)
    if (!record) return false
    record.expiresAt = expiresAt
    await this.persist()
    return true
  }

  async revoke(subscriptionId: string): Promise<boolean> {
    const record = this.records.find(r => r.stripeSubscriptionId === subscriptionId && !r.revokedAt)
    if (!record) return false
    record.revokedAt = new Date().toISOString()
    await this.persist()
    return true
  }

  all(): LicenseRecord[] {
    return structuredClone(this.records)
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(this.records, null, 2), 'utf-8')
  }
}

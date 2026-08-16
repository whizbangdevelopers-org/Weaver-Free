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

  /**
   * Replace a subscription's key and expiry together, as one write.
   *
   * There is deliberately no method that moves the expiry on its own. This replaced
   * `updateExpiry`, which did exactly that on every renewal — and it was writing to a field no
   * enforcement path reads. The authority is the KEY: it carries its own expiry in a signed
   * payload, and `parseLicenseKey` resolves the tier from that, never from this row. So a renewal
   * that advanced `expiresAt` here and left `key` alone recorded a customer as current while the
   * key on their host still expired at the end of their first billing period.
   *
   * Keeping the two fields inseparable is the fix, not a tidy-up: a row whose `key` and
   * `expiresAt` disagree is unrepresentable now rather than merely unlikely.
   */
  async renew(subscriptionId: string, key: string, expiresAt: string): Promise<boolean> {
    const record = this.records.find(r => r.stripeSubscriptionId === subscriptionId && !r.revokedAt)
    if (!record) return false
    record.key = key
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

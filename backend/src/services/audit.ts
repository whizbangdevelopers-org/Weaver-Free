// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { randomUUID } from 'node:crypto'
import { AuditStore } from '../storage/audit-store.js'
import type { AuditAction, AuditResourceType, AuditEntry, AuditQueryFilters, AuditQueryResult } from '../storage/audit-store.js'

export interface AuditLogParams {
  userId: string | null
  username: string
  action: AuditAction
  resourceType?: AuditResourceType
  resource?: string
  details?: Record<string, unknown>
  ip?: string
  success: boolean
}

export class AuditService {
  private onEntryListeners: Array<(entry: AuditEntry) => void> = []

  constructor(private store: AuditStore) {}

  async log(params: AuditLogParams): Promise<AuditEntry> {
    const entry: AuditEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      userId: params.userId,
      username: params.username,
      action: params.action,
      resourceType: params.resourceType,
      resource: params.resource,
      details: params.details,
      ip: params.ip,
      success: params.success,
    }

    await this.store.append(entry)

    for (const listener of this.onEntryListeners) {
      listener(entry)
    }

    return entry
  }

  onEntry(listener: (entry: AuditEntry) => void): void {
    this.onEntryListeners.push(listener)
  }

  query(filters: AuditQueryFilters = {}): AuditQueryResult {
    return this.store.query(filters)
  }
}

export type { AuditAction, AuditResourceType, AuditEntry, AuditQueryFilters, AuditQueryResult }

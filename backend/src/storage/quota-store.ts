// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { UserQuota } from '../schemas/quotas.js'

/** Stored quota record (no userId key — keyed by userId in the record) */
interface StoredQuotas {
  [userId: string]: {
    maxVms: number | null
    maxMemoryMB: number | null
    maxVcpus: number | null
  }
}

/** Result of a quota check — either allowed or blocked with a reason */
export interface QuotaCheckResult {
  allowed: boolean
  reason?: string
}

/** Current resource usage for quota comparisons */
export interface ResourceUsage {
  totalVms: number
  totalMemoryMB: number
  totalVcpus: number
}

export class QuotaStore {
  private filePath: string
  private quotas: StoredQuotas = {}

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    try {
      const data = await readFile(this.filePath, 'utf-8')
      this.quotas = JSON.parse(data) as StoredQuotas
    } catch {
      await mkdir(dirname(this.filePath), { recursive: true })
      await this.persist()
    }
  }

  /** Get quota for a specific user. Returns default (all null = unlimited) if not set. */
  get(userId: string): UserQuota {
    const stored = this.quotas[userId]
    return {
      userId,
      maxVms: stored?.maxVms ?? null,
      maxMemoryMB: stored?.maxMemoryMB ?? null,
      maxVcpus: stored?.maxVcpus ?? null,
    }
  }

  /** Set or update quota for a user */
  async set(userId: string, quota: { maxVms: number | null; maxMemoryMB: number | null; maxVcpus: number | null }): Promise<UserQuota> {
    this.quotas[userId] = {
      maxVms: quota.maxVms,
      maxMemoryMB: quota.maxMemoryMB,
      maxVcpus: quota.maxVcpus,
    }
    await this.persist()
    return { userId, ...this.quotas[userId] }
  }

  /** Remove quota for a user (resets to unlimited) */
  async remove(userId: string): Promise<boolean> {
    if (!this.quotas[userId]) return false
    delete this.quotas[userId]
    await this.persist()
    return true
  }

  /**
   * Check whether a new VM creation would exceed the user's quota.
   *
   * @param userId - The user attempting to create a VM
   * @param newVmMem - Memory in MB for the new VM
   * @param newVmVcpus - vCPU count for the new VM
   * @param currentUsage - Current system-wide resource usage
   * @returns QuotaCheckResult indicating whether creation is allowed
   */
  checkQuota(
    userId: string,
    newVmMem: number,
    newVmVcpus: number,
    currentUsage: ResourceUsage
  ): QuotaCheckResult {
    const quota = this.get(userId)

    // Check VM count limit
    if (quota.maxVms !== null && currentUsage.totalVms >= quota.maxVms) {
      return {
        allowed: false,
        reason: `VM quota exceeded: ${currentUsage.totalVms} of ${quota.maxVms} VMs used`,
      }
    }

    // Check total memory limit
    if (quota.maxMemoryMB !== null && (currentUsage.totalMemoryMB + newVmMem) > quota.maxMemoryMB) {
      return {
        allowed: false,
        reason: `Memory quota exceeded: ${currentUsage.totalMemoryMB} MB used + ${newVmMem} MB requested exceeds limit of ${quota.maxMemoryMB} MB`,
      }
    }

    // Check total vCPU limit
    if (quota.maxVcpus !== null && (currentUsage.totalVcpus + newVmVcpus) > quota.maxVcpus) {
      return {
        allowed: false,
        reason: `vCPU quota exceeded: ${currentUsage.totalVcpus} used + ${newVmVcpus} requested exceeds limit of ${quota.maxVcpus}`,
      }
    }

    return { allowed: true }
  }

  /** Get all quotas (for admin listing) */
  getAll(): UserQuota[] {
    return Object.entries(this.quotas).map(([userId, q]) => ({
      userId,
      maxVms: q.maxVms,
      maxMemoryMB: q.maxMemoryMB,
      maxVcpus: q.maxVcpus,
    }))
  }

  private async persist(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.quotas, null, 2), 'utf-8')
  }
}

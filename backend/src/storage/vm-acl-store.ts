// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

/**
 * Per-VM Access Control List store.
 *
 * Maps userId → array of VM names the user is allowed to access.
 * Users with no ACL entries see all VMs (backwards compatible).
 * Admin role always bypasses ACL checks.
 * Only enforced when tier is fabrick.
 */

interface StoredAcls {
  [userId: string]: string[]
}

export class VmAclStore {
  private filePath: string
  private acls: StoredAcls = {}

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    try {
      const data = await readFile(this.filePath, 'utf-8')
      this.acls = JSON.parse(data) as StoredAcls
    } catch {
      await mkdir(dirname(this.filePath), { recursive: true })
      await this.persist()
    }
  }

  /** Get the list of VM names assigned to a user. Empty array = no restrictions set. */
  get(userId: string): string[] {
    return this.acls[userId] ?? []
  }

  /** True if the user has explicit ACL entries (restricted access). */
  hasAcl(userId: string): boolean {
    return userId in this.acls && this.acls[userId].length > 0
  }

  /** Set the VM ACL for a user. Deduplicates and sorts. */
  async set(userId: string, vmNames: string[]): Promise<string[]> {
    const deduplicated = [...new Set(vmNames)].sort()
    if (deduplicated.length === 0) {
      // Empty array = clear restrictions
      delete this.acls[userId]
    } else {
      this.acls[userId] = deduplicated
    }
    await this.persist()
    return deduplicated
  }

  /** Clear all ACL entries for a user (revert to global access). */
  async clear(userId: string): Promise<boolean> {
    if (!(userId in this.acls)) return false
    delete this.acls[userId]
    await this.persist()
    return true
  }

  /** Check if a user is allowed to access a specific VM. No ACL = allowed. */
  isAllowed(userId: string, vmName: string): boolean {
    if (!this.hasAcl(userId)) return true
    return this.acls[userId].includes(vmName)
  }

  /** Filter a VM list to only those the user is allowed to access. No ACL = all. */
  filterVms<T extends { name: string }>(userId: string, vms: T[]): T[] {
    if (!this.hasAcl(userId)) return vms
    const allowed = new Set(this.acls[userId])
    return vms.filter(vm => allowed.has(vm.name))
  }

  private async persist(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.acls, null, 2), 'utf-8')
  }
}

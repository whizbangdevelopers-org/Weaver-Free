// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { User, UserRole } from '../models/user.js'
import { ROLES } from '../constants/vocabularies.js'

export class UserStore {
  private filePath: string
  private users: Record<string, User> = {}
  /** Secondary index: username -> userId for O(1) lookup */
  private usernameIndex = new Map<string, string>()

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async init(): Promise<void> {
    try {
      const data = await readFile(this.filePath, 'utf-8')
      this.users = JSON.parse(data) as Record<string, User>
    } catch {
      await mkdir(dirname(this.filePath), { recursive: true })
      await this.persist()
    }
    this.rebuildIndex()
  }

  /**
   * Reload users from disk. Used by SIGHUP handler to pick up external
   * changes (e.g. reset-admin-password.sh) without restarting the service.
   * Safe for fabrick multi-user — reloads ALL users atomically.
   */
  async reload(): Promise<{ count: number }> {
    const data = await readFile(this.filePath, 'utf-8')
    this.users = JSON.parse(data) as Record<string, User>
    this.rebuildIndex()
    return { count: this.count() }
  }

  getAll(): User[] {
    return Object.values(this.users)
  }

  getByUsername(username: string): User | null {
    const id = this.usernameIndex.get(username)
    return id ? this.users[id] ?? null : null
  }

  getById(id: string): User | null {
    return this.users[id] ?? null
  }

  async create(username: string, passwordHash: string, role: UserRole = ROLES.VIEWER): Promise<User> {
    const id = randomUUID()
    const user: User = {
      id,
      username,
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
    }
    this.users[id] = user
    this.usernameIndex.set(username, id)
    await this.persist()
    return user
  }

  async update(id: string, updates: Partial<Pick<User, 'username' | 'passwordHash' | 'role' | 'preferences' | 'sector'>>): Promise<User | null> {
    const user = this.users[id]
    if (!user) return null

    if (updates.username !== undefined && updates.username !== user.username) {
      this.usernameIndex.delete(user.username)
      this.usernameIndex.set(updates.username, id)
      user.username = updates.username
    }
    if (updates.passwordHash !== undefined) user.passwordHash = updates.passwordHash
    if (updates.role !== undefined) user.role = updates.role
    if (updates.preferences !== undefined) {
      user.preferences = { ...user.preferences, ...updates.preferences }
    }
    if (updates.sector !== undefined) user.sector = updates.sector

    await this.persist()
    return user
  }

  async delete(id: string): Promise<boolean> {
    const user = this.users[id]
    if (!user) return false
    this.usernameIndex.delete(user.username)
    delete this.users[id]
    await this.persist()
    return true
  }

  count(): number {
    return Object.keys(this.users).length
  }

  private rebuildIndex(): void {
    this.usernameIndex.clear()
    for (const [id, user] of Object.entries(this.users)) {
      this.usernameIndex.set(user.username, id)
    }
  }

  private async persist(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.users, null, 2), 'utf-8')
  }
}

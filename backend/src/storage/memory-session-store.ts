// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { SessionData, SessionStore } from './session-store.js'

interface StoredSession {
  data: SessionData
  expiresAt: number
}

export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, StoredSession>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    // Clean up expired sessions every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  async set(tokenId: string, data: SessionData, ttlMs: number): Promise<void> {
    this.sessions.set(tokenId, {
      data,
      expiresAt: Date.now() + ttlMs,
    })
  }

  async get(tokenId: string): Promise<SessionData | null> {
    const stored = this.sessions.get(tokenId)
    if (!stored) return null

    if (Date.now() > stored.expiresAt) {
      this.sessions.delete(tokenId)
      return null
    }

    return stored.data
  }

  async delete(tokenId: string): Promise<void> {
    this.sessions.delete(tokenId)
  }

  async deleteByUser(userId: string): Promise<void> {
    for (const [tokenId, stored] of this.sessions) {
      if (stored.data.userId === userId) {
        this.sessions.delete(tokenId)
      }
    }
  }

  async updateActivity(tokenId: string): Promise<void> {
    const stored = this.sessions.get(tokenId)
    if (stored) {
      stored.data.lastActivity = Date.now()
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.sessions.clear()
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [tokenId, stored] of this.sessions) {
      if (now > stored.expiresAt) {
        this.sessions.delete(tokenId)
      }
    }
  }
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import Database from 'better-sqlite3'
import type { SessionData, SessionStore } from './session-store.js'

export class SqliteSessionStore implements SessionStore {
  private db: Database.Database
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        token_id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        last_activity INTEGER NOT NULL DEFAULT 0
      )
    `)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
    `)
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)
    `)

    // Periodic cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  async set(tokenId: string, data: SessionData, ttlMs: number): Promise<void> {
    const expiresAt = Date.now() + ttlMs
    this.db.prepare(
      'INSERT OR REPLACE INTO sessions (token_id, data, user_id, expires_at, last_activity) VALUES (?, ?, ?, ?, ?)'
    ).run(tokenId, JSON.stringify(data), data.userId, expiresAt, data.lastActivity)
  }

  async get(tokenId: string): Promise<SessionData | null> {
    const row = this.db.prepare(
      'SELECT data, expires_at FROM sessions WHERE token_id = ?'
    ).get(tokenId) as { data: string; expires_at: number } | undefined

    if (!row) return null

    if (Date.now() > row.expires_at) {
      this.db.prepare('DELETE FROM sessions WHERE token_id = ?').run(tokenId)
      return null
    }

    return JSON.parse(row.data) as SessionData
  }

  async delete(tokenId: string): Promise<void> {
    this.db.prepare('DELETE FROM sessions WHERE token_id = ?').run(tokenId)
  }

  async deleteByUser(userId: string): Promise<void> {
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  }

  async updateActivity(tokenId: string): Promise<void> {
    const now = Date.now()
    this.db.prepare('UPDATE sessions SET last_activity = ? WHERE token_id = ?').run(now, tokenId)
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.db.close()
  }

  private cleanup(): void {
    this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now())
  }
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { EventEmitter } from 'node:events'
import type { UserStore } from '../storage/user-store.js'
import type { SessionStore, SessionData } from '../storage/session-store.js'
import type { User, SafeUser, UserRole, SectorId } from '../models/user.js'
import { toSafeUser } from '../models/user.js'
import { ROLES } from '../constants/vocabularies.js'

/** Emitted when a user's sessions are revoked (e.g. single-session enforcement on login). */
export const sessionEvents = new EventEmitter()

const BCRYPT_ROUNDS = 13
const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL = '7d'
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000
const IDLE_TIMEOUT_MS = 15 * 60 * 1000  // 15 minutes — session expires after inactivity

// Dummy hash for constant-time login — prevents user enumeration via timing
const DUMMY_HASH = '$2b$13$dummyhashfortimingequalitycheckxx'
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

// Account lockout: 5 failed attempts within 15 minutes, with progressive delay
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000
// Progressive delay: attempt 1-2 = 0s, 3 = 1s, 4 = 3s, 5+ = lockout
const PROGRESSIVE_DELAY_MS = [0, 0, 1000, 3000]

interface TokenPayload {
  sub: string       // user ID
  username: string
  role: UserRole
  jti: string       // token ID for session lookup
  type: 'access' | 'refresh'
}

export interface AuthTokens {
  token: string
  refreshToken: string
}

export interface LoginResult {
  user: SafeUser
  token: string
  refreshToken: string
}

interface LockoutRecord {
  count: number
  firstAt: number
}

export class AuthService {
  private failedAttempts = new Map<string, LockoutRecord>()
  private lockoutFilePath: string | null

  constructor(
    private userStore: UserStore,
    private sessionStore: SessionStore,
    private jwtSecret: string,
    lockoutFilePath?: string,
  ) {
    this.lockoutFilePath = lockoutFilePath ?? null
  }

  /** Load persisted lockout state from disk (call after construction). */
  async initLockout(): Promise<void> {
    if (!this.lockoutFilePath) return
    try {
      const data = await readFile(this.lockoutFilePath, 'utf-8')
      const records = JSON.parse(data) as Record<string, LockoutRecord>
      const now = Date.now()
      // Only load non-expired entries
      for (const [username, record] of Object.entries(records)) {
        if (now - record.firstAt <= LOCKOUT_WINDOW_MS) {
          this.failedAttempts.set(username, record)
        }
      }
    } catch {
      // File doesn't exist yet — that's fine
    }
  }

  async register(username: string, password: string, role: UserRole = ROLES.ADMIN, sector?: SectorId): Promise<LoginResult> {
    // Check for duplicate username
    const existing = this.userStore.getByUsername(username)
    if (existing) {
      throw new AuthError('Username already exists', 409)
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const user = await this.userStore.create(username, passwordHash, role)

    // Store sector if provided (collected at first-run setup)
    if (sector) {
      await this.userStore.update(user.id, { sector })
      user.sector = sector
    }

    const tokens = await this.createTokens(user)

    return {
      user: toSafeUser(user),
      ...tokens,
    }
  }

  async login(username: string, password: string, opts?: { singleSession?: boolean }): Promise<LoginResult> {
    // Check account lockout
    this.checkLockout(username)

    const user = this.userStore.getByUsername(username)
    if (!user) {
      // Constant-time: perform bcrypt compare against dummy hash to equalize timing
      await bcrypt.compare(password, DUMMY_HASH)
      await this.recordFailedAttempt(username)
      await this.applyProgressiveDelay(username)
      throw new AuthError('Invalid username or password', 401)
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      await this.recordFailedAttempt(username)
      await this.applyProgressiveDelay(username)
      throw new AuthError('Invalid username or password', 401)
    }

    // Clear failed attempts on successful login
    this.failedAttempts.delete(username)
    this.persistLockout()

    // Single-session enforcement (weaver+ tier): revoke prior sessions before issuing new tokens.
    // Prevents duplicate concurrent logins from the same user.
    if (opts?.singleSession) {
      await this.sessionStore.deleteByUser(user.id)
      sessionEvents.emit('session-revoked', user.id)
    }

    const tokens = await this.createTokens(user)

    return {
      user: toSafeUser(user),
      ...tokens,
    }
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as TokenPayload

      // Check session store
      const session = await this.sessionStore.get(payload.jti)
      if (!session) {
        throw new AuthError('Session expired or revoked', 401)
      }

      // Idle timeout: expire session if no activity within the timeout window
      if (Date.now() - session.lastActivity > IDLE_TIMEOUT_MS) {
        await this.sessionStore.delete(payload.jti)
        throw new AuthError('Session expired due to inactivity', 401)
      }

      return payload
    } catch (err) {
      if (err instanceof AuthError) throw err
      throw new AuthError('Invalid or expired token', 401)
    }
  }

  async refreshToken(refreshTokenStr: string): Promise<AuthTokens> {
    const payload = await this.verifyRefreshToken(refreshTokenStr)

    const user = this.userStore.getById(payload.sub)
    if (!user) {
      throw new AuthError('User not found', 401)
    }

    // Revoke old refresh token
    await this.sessionStore.delete(payload.jti)

    return this.createTokens(user)
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = this.userStore.getById(userId)
    if (!user) {
      throw new AuthError('User not found', 404)
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) {
      throw new AuthError('Current password is incorrect', 401)
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await this.userStore.update(userId, { passwordHash })

    // Invalidate all sessions for this user
    await this.sessionStore.deleteByUser(userId)
  }

  async logout(tokenId: string, userId: string): Promise<void> {
    // Revoke all sessions for this user
    await this.sessionStore.deleteByUser(userId)
  }

  getUserCount(): number {
    return this.userStore.count()
  }

  getUserById(userId: string): SafeUser | null {
    const user = this.userStore.getById(userId)
    return user ? toSafeUser(user) : null
  }

  async updatePreferences(userId: string, prefs: Partial<import('../models/user.js').UserPreferences>): Promise<SafeUser | null> {
    const updated = await this.userStore.update(userId, { preferences: prefs })
    return updated ? toSafeUser(updated) : null
  }

  async updateSector(userId: string, sector: SectorId): Promise<SafeUser | null> {
    const updated = await this.userStore.update(userId, { sector })
    return updated ? toSafeUser(updated) : null
  }

  /** Check if a session token is still active (not revoked/expired). */
  async hasValidSession(jti: string): Promise<boolean> {
    const session = await this.sessionStore.get(jti)
    return session !== null
  }

  /** Update last activity timestamp for idle timeout tracking. */
  async updateActivity(tokenId: string): Promise<void> {
    await this.sessionStore.updateActivity(tokenId)
  }

  private checkLockout(username: string): void {
    const record = this.failedAttempts.get(username)
    if (!record) return

    // Expired window — reset
    if (Date.now() - record.firstAt > LOCKOUT_WINDOW_MS) {
      this.failedAttempts.delete(username)
      return
    }

    if (record.count >= MAX_FAILED_ATTEMPTS) {
      const remainingMs = LOCKOUT_WINDOW_MS - (Date.now() - record.firstAt)
      const remainingMin = Math.ceil(remainingMs / 60_000)
      throw new AuthError(`Account temporarily locked. Try again in ${remainingMin} minute(s).`, 429)
    }
  }

  private async recordFailedAttempt(username: string): Promise<void> {
    const record = this.failedAttempts.get(username)
    const now = Date.now()

    if (!record || now - record.firstAt > LOCKOUT_WINDOW_MS) {
      this.failedAttempts.set(username, { count: 1, firstAt: now })
    } else {
      record.count++
    }

    this.persistLockout()
  }

  /** Progressive delay after failed login — slows brute-force without full lockout */
  private async applyProgressiveDelay(username: string): Promise<void> {
    const record = this.failedAttempts.get(username)
    if (!record) return
    const delayIndex = Math.min(record.count - 1, PROGRESSIVE_DELAY_MS.length - 1)
    const delayMs = PROGRESSIVE_DELAY_MS[delayIndex]
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  /** Fire-and-forget persist of lockout state to disk */
  private persistLockout(): void {
    if (!this.lockoutFilePath) return
    const data: Record<string, LockoutRecord> = {}
    const now = Date.now()
    for (const [username, record] of this.failedAttempts) {
      // Only persist non-expired entries
      if (now - record.firstAt <= LOCKOUT_WINDOW_MS) {
        data[username] = record
      }
    }
    mkdir(dirname(this.lockoutFilePath), { recursive: true })
      .then(() => writeFile(this.lockoutFilePath!, JSON.stringify(data), 'utf-8'))
      .catch(() => { /* best-effort */ })
  }

  private async verifyRefreshToken(token: string): Promise<TokenPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as TokenPayload

      if (payload.type !== 'refresh') {
        throw new AuthError('Invalid token type', 401)
      }

      const session = await this.sessionStore.get(payload.jti)
      if (!session) {
        throw new AuthError('Refresh token expired or revoked', 401)
      }

      return payload
    } catch (err) {
      if (err instanceof AuthError) throw err
      throw new AuthError('Invalid or expired refresh token', 401)
    }
  }

  private async createTokens(user: User): Promise<AuthTokens> {
    const accessTokenId = randomUUID()
    const refreshTokenId = randomUUID()

    const accessPayload: TokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      jti: accessTokenId,
      type: 'access',
    }

    const refreshPayload: TokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      jti: refreshTokenId,
      type: 'refresh',
    }

    const token = jwt.sign(accessPayload, this.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_TTL,
    })

    const refreshToken = jwt.sign(refreshPayload, this.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: REFRESH_TOKEN_TTL,
    })

    // Store sessions
    const now = Date.now()
    const accessSession: SessionData = {
      userId: user.id,
      role: user.role,
      tokenId: accessTokenId,
      type: 'access',
      createdAt: now,
      lastActivity: now,
    }

    const refreshSession: SessionData = {
      userId: user.id,
      role: user.role,
      tokenId: refreshTokenId,
      type: 'refresh',
      createdAt: now,
      lastActivity: now,
    }

    await this.sessionStore.set(accessTokenId, accessSession, ACCESS_TOKEN_TTL_MS)
    await this.sessionStore.set(refreshTokenId, refreshSession, REFRESH_TOKEN_TTL_MS)

    return { token, refreshToken }
  }
}

export class AuthError extends Error {
  statusCode: number

  constructor(message: string, statusCode: number = 401) {
    super(message)
    this.name = 'AuthError'
    this.statusCode = statusCode
  }
}

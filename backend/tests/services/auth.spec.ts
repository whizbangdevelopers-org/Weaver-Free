// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach } from 'vitest'
import { AuthService, AuthError } from '../../src/services/auth.js'
import { UserStore } from '../../src/storage/user-store.js'
import { MemorySessionStore } from '../../src/storage/memory-session-store.js'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `auth-test-${randomUUID()}`)
const JWT_SECRET = 'test-secret-key-for-auth-testing-only'

describe('AuthService', () => {
  let userStore: UserStore
  let sessionStore: MemorySessionStore
  let authService: AuthService

  beforeEach(async () => {
    const dir = join(TEST_DIR, randomUUID())
    await mkdir(dir, { recursive: true })
    userStore = new UserStore(join(dir, 'users.json'))
    await userStore.init()
    sessionStore = new MemorySessionStore()
    authService = new AuthService(userStore, sessionStore, JWT_SECRET)
  })

  describe('register', () => {
    it('should register a new user', async () => {
      const result = await authService.register('admin', 'password123', 'admin')

      expect(result.user.username).toBe('admin')
      expect(result.user.role).toBe('admin')
      expect(result.user.id).toBeDefined()
      expect(result.token).toBeDefined()
      expect(result.refreshToken).toBeDefined()
      // Ensure passwordHash is not in the safe user object
      expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined()
    })

    it('should reject duplicate username', async () => {
      await authService.register('admin', 'password123', 'admin')

      await expect(
        authService.register('admin', 'other-password', 'viewer')
      ).rejects.toThrow(AuthError)
    })

    it('should default role to admin', async () => {
      const result = await authService.register('testuser', 'password123')
      expect(result.user.role).toBe('admin')
    })
  })

  describe('login', () => {
    beforeEach(async () => {
      await authService.register('admin', 'correctpassword', 'admin')
    })

    it('should login with correct credentials', async () => {
      const result = await authService.login('admin', 'correctpassword')

      expect(result.user.username).toBe('admin')
      expect(result.token).toBeDefined()
      expect(result.refreshToken).toBeDefined()
    })

    it('should reject wrong password', async () => {
      await expect(
        authService.login('admin', 'wrongpassword')
      ).rejects.toThrow(AuthError)

      try {
        await authService.login('admin', 'wrongpassword')
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError)
        expect((err as AuthError).statusCode).toBe(401)
      }
    })

    it('should reject non-existent username', async () => {
      await expect(
        authService.login('nonexistent', 'password')
      ).rejects.toThrow(AuthError)
    })
  })

  describe('verifyToken', () => {
    it('should verify a valid access token', async () => {
      const { token } = await authService.register('admin', 'password123', 'admin')
      const payload = await authService.verifyToken(token)

      expect(payload.username).toBe('admin')
      expect(payload.role).toBe('admin')
      expect(payload.type).toBe('access')
    })

    it('should reject an invalid token', async () => {
      await expect(
        authService.verifyToken('invalid-token')
      ).rejects.toThrow(AuthError)
    })

    it('should reject a token after session is revoked', async () => {
      const { token, user } = await authService.register('admin', 'password123', 'admin')

      // Verify token works
      await authService.verifyToken(token)

      // Revoke all sessions
      await sessionStore.deleteByUser(user.id)

      // Token should no longer be valid
      await expect(authService.verifyToken(token)).rejects.toThrow(AuthError)
    })
  })

  describe('refreshToken', () => {
    it('should issue new tokens from a refresh token', async () => {
      const initial = await authService.register('admin', 'password123', 'admin')
      const newTokens = await authService.refreshToken(initial.refreshToken)

      expect(newTokens.token).toBeDefined()
      expect(newTokens.refreshToken).toBeDefined()
      expect(newTokens.token).not.toBe(initial.token)
    })

    it('should reject an invalid refresh token', async () => {
      await expect(
        authService.refreshToken('invalid-token')
      ).rejects.toThrow(AuthError)
    })

    it('should reject an access token used as refresh token', async () => {
      const { token } = await authService.register('admin', 'password123', 'admin')

      await expect(
        authService.refreshToken(token)
      ).rejects.toThrow(AuthError)
    })
  })

  describe('changePassword', () => {
    it('should change password with correct current password', async () => {
      const { user } = await authService.register('admin', 'oldpassword', 'admin')

      await authService.changePassword(user.id, 'oldpassword', 'newpassword')

      // Old password should no longer work
      await expect(
        authService.login('admin', 'oldpassword')
      ).rejects.toThrow(AuthError)

      // New password should work
      const result = await authService.login('admin', 'newpassword')
      expect(result.user.username).toBe('admin')
    })

    it('should reject wrong current password', async () => {
      const { user } = await authService.register('admin', 'password123', 'admin')

      await expect(
        authService.changePassword(user.id, 'wrong', 'newpassword')
      ).rejects.toThrow(AuthError)
    })

    it('should invalidate all sessions after password change', async () => {
      const { user, token } = await authService.register('admin', 'password123', 'admin')

      await authService.changePassword(user.id, 'password123', 'newpassword')

      // Old token should be invalid
      await expect(authService.verifyToken(token)).rejects.toThrow(AuthError)
    })
  })

  describe('getUserCount', () => {
    it('should return 0 when no users exist', () => {
      expect(authService.getUserCount()).toBe(0)
    })

    it('should return correct count after registration', async () => {
      await authService.register('user1', 'password123', 'admin')
      expect(authService.getUserCount()).toBe(1)

      await authService.register('user2', 'password123', 'viewer')
      expect(authService.getUserCount()).toBe(2)
    })
  })

  // Cleanup
  afterAll(async () => {
    try {
      await rm(TEST_DIR, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })
})

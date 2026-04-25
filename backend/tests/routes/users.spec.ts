// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { usersRoutes } from '../../src/routes/users.js'
import { AuthService } from '../../src/services/auth.js'
import { AuditService } from '../../src/services/audit.js'
import { AuditStore } from '../../src/storage/audit-store.js'
import { UserStore } from '../../src/storage/user-store.js'
import { MemorySessionStore } from '../../src/storage/memory-session-store.js'
import { createAuthMiddleware } from '../../src/middleware/auth.js'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const TEST_DIR = join('/tmp', `users-routes-test-${randomUUID()}`)
const JWT_SECRET = 'test-secret-for-users-testing'

describe('Users Routes', () => {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  let authService: AuthService
  let userStore: UserStore
  let sessionStore: MemorySessionStore
  let auditService: AuditService

  // Core test user IDs (set in beforeAll, never deleted)
  let adminId: string
  let operatorId: string
  let viewerId: string

  /** Get a fresh admin token (re-login). Use when prior tests may have invalidated sessions. */
  async function freshAdminToken(): Promise<string> {
    const result = await authService.login('admin', 'T3stP@ssw0rd!X')
    return result.token
  }

  /** Get a fresh operator token. */
  async function freshOperatorToken(): Promise<string> {
    const result = await authService.login('operator', 'T3stP@ssw0rd!X')
    return result.token
  }

  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true })

    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    // Set up stores
    userStore = new UserStore(join(TEST_DIR, 'users.json'))
    await userStore.init()
    sessionStore = new MemorySessionStore()

    authService = new AuthService(userStore, sessionStore, JWT_SECRET)

    const auditStore = new AuditStore(join(TEST_DIR, 'audit-log.json'))
    await auditStore.init()
    auditService = new AuditService(auditStore)

    // Register auth middleware
    fastify.addHook('onRequest', createAuthMiddleware(authService))

    // Register users routes
    await fastify.register(usersRoutes, {
      prefix: '/api/users',
      userStore,
      sessionStore,
      auditService,
    })
    await fastify.ready()

    // Create core test users
    const adminResult = await authService.register('admin', 'T3stP@ssw0rd!X', 'admin')
    adminId = adminResult.user.id

    const operatorResult = await authService.register('operator', 'T3stP@ssw0rd!X', 'operator')
    operatorId = operatorResult.user.id

    const viewerResult = await authService.register('viewer', 'T3stP@ssw0rd!X', 'viewer')
    viewerId = viewerResult.user.id
  })

  afterAll(async () => {
    await fastify.close()
    try {
      await rm(TEST_DIR, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  // ─── GET /api/users ───────────────────────────────────────────────────────

  describe('GET /api/users', () => {
    it('should return all users for admin', async () => {
      const token = await freshAdminToken()
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/users',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toBeInstanceOf(Array)
      expect(body.length).toBe(3)

      // Verify SafeUser shape — no password hash
      for (const user of body) {
        expect(user).toHaveProperty('id')
        expect(user).toHaveProperty('username')
        expect(user).toHaveProperty('role')
        expect(user).toHaveProperty('createdAt')
        expect(user).not.toHaveProperty('passwordHash')
      }
    })

    it('should return 403 for operator', async () => {
      const token = await freshOperatorToken()
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/users',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(403)
    })

    it('should return 403 for viewer', async () => {
      const viewerLogin = await authService.login('viewer', 'T3stP@ssw0rd!X')
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/users',
        headers: { authorization: `Bearer ${viewerLogin.token}` },
      })

      expect(response.statusCode).toBe(403)
    })

    it('should return 401 without auth', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/users',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  // ─── GET /api/users/:id ───────────────────────────────────────────────────

  describe('GET /api/users/:id', () => {
    it('should return a single user for admin', async () => {
      const token = await freshAdminToken()
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/users/${operatorId}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.id).toBe(operatorId)
      expect(body.username).toBe('operator')
      expect(body.role).toBe('operator')
      expect(body).not.toHaveProperty('passwordHash')
    })

    it('should return 404 for non-existent user', async () => {
      const token = await freshAdminToken()
      const fakeId = randomUUID()
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/users/${fakeId}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 403 for non-admin', async () => {
      const token = await freshOperatorToken()
      const response = await fastify.inject({
        method: 'GET',
        url: `/api/users/${operatorId}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(403)
    })
  })

  // ─── PUT /api/users/:id/role ──────────────────────────────────────────────

  describe('PUT /api/users/:id/role', () => {
    it('should allow admin to change a user role', async () => {
      const token = await freshAdminToken()
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${viewerId}/role`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'operator' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('viewer')
      expect(body.message).toContain('operator')

      // Verify the role actually changed
      const user = userStore.getById(viewerId)
      expect(user?.role).toBe('operator')

      // Restore role for subsequent tests
      await userStore.update(viewerId, { role: 'viewer' })
    })

    it('should return 404 for non-existent user', async () => {
      const token = await freshAdminToken()
      const fakeId = randomUUID()
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${fakeId}/role`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'viewer' },
      })

      expect(response.statusCode).toBe(404)
    })

    it('should return 409 when demoting the last admin', async () => {
      const token = await freshAdminToken()
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${adminId}/role`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'viewer' },
      })

      expect(response.statusCode).toBe(409)
      const body = response.json()
      expect(body.error).toContain('last admin')
    })

    it('should allow demoting an admin when another admin exists', async () => {
      // Promote operator to admin first (direct store update, no session impact)
      await userStore.update(operatorId, { role: 'admin' })

      // Get fresh admin token
      const token = await freshAdminToken()

      // Now demote admin — should succeed since operator is also admin
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${adminId}/role`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'operator' },
      })

      expect(response.statusCode).toBe(200)

      // Restore roles
      await userStore.update(adminId, { role: 'admin' })
      await userStore.update(operatorId, { role: 'operator' })
    })

    it('should return 403 for non-admin', async () => {
      const token = await freshOperatorToken()
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${viewerId}/role`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'admin' },
      })

      expect(response.statusCode).toBe(403)
    })

    it('should validate role value', async () => {
      const token = await freshAdminToken()
      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/users/${viewerId}/role`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'superadmin' },
      })

      // Zod validation should reject invalid role
      expect(response.statusCode).toBe(400)
    })

    it('should invalidate sessions on role change', async () => {
      // Get operator token before role change
      const opLogin = await authService.login('operator', 'T3stP@ssw0rd!X')
      const opToken = opLogin.token

      // Verify the token is valid (operator gets 403 on /api/users — correct, not admin)
      const checkResponse = await fastify.inject({
        method: 'GET',
        url: '/api/users',
        headers: { authorization: `Bearer ${opToken}` },
      })
      expect(checkResponse.statusCode).toBe(403)

      // Admin changes operator's role — this invalidates operator's sessions
      const adminToken = await freshAdminToken()
      await fastify.inject({
        method: 'PUT',
        url: `/api/users/${operatorId}/role`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { role: 'viewer' },
      })

      // Operator's old token should now be invalidated (session deleted)
      const afterResponse = await fastify.inject({
        method: 'GET',
        url: '/api/users',
        headers: { authorization: `Bearer ${opToken}` },
      })
      expect(afterResponse.statusCode).toBe(401)

      // Restore role
      await userStore.update(operatorId, { role: 'operator' })
    })
  })

  // ─── DELETE /api/users/:id ────────────────────────────────────────────────

  describe('DELETE /api/users/:id', () => {
    it('should prevent admin from deleting themselves', async () => {
      const token = await freshAdminToken()
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/users/${adminId}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(409)
      const body = response.json()
      expect(body.error).toContain('own account')
    })

    it('should allow admin to delete another user', async () => {
      // Create a throwaway user
      const throwaway = await authService.register('throwaway', 'ThrowPass123!x', 'viewer')

      const token = await freshAdminToken()
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/users/${throwaway.user.id}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('throwaway')

      // Verify user is actually deleted
      const user = userStore.getById(throwaway.user.id)
      expect(user).toBeNull()
    })

    it('should return 404 for non-existent user', async () => {
      const token = await freshAdminToken()
      const fakeId = randomUUID()
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/users/${fakeId}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(404)
    })

    it('should prevent deleting the last admin', async () => {
      // Create a second admin
      const admin2 = await authService.register('admin2', 'T3stP@ssw0rd!X', 'admin')

      // Demote the original admin so admin2 is the only admin
      await userStore.update(adminId, { role: 'operator' })

      // Login as admin2
      const admin2Login = await authService.login('admin2', 'T3stP@ssw0rd!X')

      // admin2 can't delete themselves (self-delete rule)
      const selfResponse = await fastify.inject({
        method: 'DELETE',
        url: `/api/users/${admin2.user.id}`,
        headers: { authorization: `Bearer ${admin2Login.token}` },
      })
      expect(selfResponse.statusCode).toBe(409)
      expect(selfResponse.json().error).toContain('own account')

      // Restore admin role and clean up admin2
      await userStore.update(adminId, { role: 'admin' })
      const cleanupToken = await freshAdminToken()
      await fastify.inject({
        method: 'DELETE',
        url: `/api/users/${admin2.user.id}`,
        headers: { authorization: `Bearer ${cleanupToken}` },
      })
    })

    it('should prevent deleting the last admin account (non-self)', async () => {
      // Create a second admin, then try to delete the original admin from admin2
      // when both are admin — this should succeed (2 admins)
      const admin3 = await authService.register('admin3', 'T3stP@ssw0rd!X', 'admin')
      const admin3Login = await authService.login('admin3', 'T3stP@ssw0rd!X')

      // Delete admin from admin3 — should succeed (2 admins remaining)
      const deleteResp = await fastify.inject({
        method: 'DELETE',
        url: `/api/users/${adminId}`,
        headers: { authorization: `Bearer ${admin3Login.token}` },
      })
      expect(deleteResp.statusCode).toBe(200)

      // Re-create the admin for subsequent tests
      const newAdmin = await authService.register('admin', 'T3stP@ssw0rd!X', 'admin')
      adminId = newAdmin.user.id

      // Clean up admin3
      const token = await freshAdminToken()
      await fastify.inject({
        method: 'DELETE',
        url: `/api/users/${admin3.user.id}`,
        headers: { authorization: `Bearer ${token}` },
      })
    })

    it('should return 403 for non-admin', async () => {
      const token = await freshOperatorToken()
      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/users/${viewerId}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(403)
    })

    it('should invalidate sessions of deleted user', async () => {
      // Create a user and get their token
      const temp = await authService.register('tempuser', 'TempPass123!xx', 'viewer')
      const tempToken = temp.token

      // Verify the token works (viewer can't access /api/users — gets 403, but token is valid)
      const before = await fastify.inject({
        method: 'GET',
        url: '/api/users',
        headers: { authorization: `Bearer ${tempToken}` },
      })
      expect(before.statusCode).toBe(403) // token valid, role insufficient

      // Delete the user
      const adminToken = await freshAdminToken()
      await fastify.inject({
        method: 'DELETE',
        url: `/api/users/${temp.user.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      })

      // Temp user's token should now be invalidated (session deleted → 401)
      const after = await fastify.inject({
        method: 'GET',
        url: '/api/users',
        headers: { authorization: `Bearer ${tempToken}` },
      })
      expect(after.statusCode).toBe(401)
    })
  })

  // ─── Audit logging ────────────────────────────────────────────────────────

  describe('Audit logging', () => {
    it('should create audit entries for role changes', async () => {
      const token = await freshAdminToken()

      await fastify.inject({
        method: 'PUT',
        url: `/api/users/${viewerId}/role`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'operator' },
      })

      const result = auditService.query({ action: 'user.role-change' })
      expect(result.entries.length).toBeGreaterThan(0)

      const latest = result.entries[0]
      expect(latest.action).toBe('user.role-change')
      expect(latest.success).toBe(true)

      // Restore role
      await userStore.update(viewerId, { role: 'viewer' })
    })

    it('should create audit entries for user deletions', async () => {
      const temp = await authService.register('auditdeltest', 'AuditDelPass123!', 'viewer')

      const token = await freshAdminToken()
      await fastify.inject({
        method: 'DELETE',
        url: `/api/users/${temp.user.id}`,
        headers: { authorization: `Bearer ${token}` },
      })

      const result = auditService.query({ action: 'user.delete' })
      const entry = result.entries.find(e => e.resource === 'auditdeltest')
      expect(entry).toBeDefined()
      expect(entry!.success).toBe(true)
    })

    it('should log failed last-admin demotion attempts', async () => {
      const token = await freshAdminToken()

      await fastify.inject({
        method: 'PUT',
        url: `/api/users/${adminId}/role`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'viewer' },
      })

      const result = auditService.query({ action: 'user.role-change' })
      const failedEntry = result.entries.find(
        e => !e.success && e.details && (e.details as Record<string, unknown>).reason === 'last-admin-blocked'
      )
      expect(failedEntry).toBeDefined()
    })
  })
})

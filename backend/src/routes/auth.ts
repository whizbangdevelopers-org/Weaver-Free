// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { registerSchema, loginSchema, refreshSchema, changePasswordSchema, preferencesSchema, sectorSchema } from '../schemas/auth.js'
import { AuthService, AuthError } from '../services/auth.js'
import { toSafeUser as _toSafeUser } from '../models/user.js'
import { ROLES } from '../constants/vocabularies.js'
import type { AuditService } from '../services/audit.js'
import { createRateLimit } from '../middleware/rate-limit.js'

interface AuthRouteOptions {
  authService: AuthService
  auditService?: AuditService
  onFirstAdmin?: () => void
}

const authRateLimit = createRateLimit(10)

export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { authService, auditService } = opts
  // Single-session enforced at all tiers. Multi-user (weaver/fabrick) means
  // multiple user accounts, not multiple sessions per account. Last login wins.
  // Disabled in test mode: parallel E2E workers share user accounts and
  // concurrent logins must not revoke each other's sessions.
  const singleSession = process.env.NODE_ENV !== 'test'

  // POST /auth/register — Create a new user
  // First user: no auth required (creates admin). Subsequent users: require admin role.
  app.post(
    '/register',
    { schema: { body: registerSchema }, config: { rateLimit: authRateLimit } },
    async (request, reply) => {
      const { username, password, role, sector } = request.body
      const userCount = authService.getUserCount()

      if (userCount > 0) {
        // Require admin auth for subsequent registrations
        if (!request.userId) {
          return reply.status(401).send({ error: 'Authentication required' })
        }
        if (request.userRole !== ROLES.ADMIN) {
          return reply.status(403).send({ error: 'Only admins can register new users' })
        }
      }

      try {
        // First user is always admin, ignore role param
        const effectiveRole = userCount === 0 ? ROLES.ADMIN : (role ?? ROLES.VIEWER)
        const result = await authService.register(username, password, effectiveRole, sector)

        await auditService?.log({
          userId: result.user.id,
          username,
          action: 'user.register',
          resource: username,
          details: { role: effectiveRole, createdBy: request.username ?? 'self' },
          ip: request.ip,
          success: true,
        })

        // Set httpOnly cookies (browser clients — XSS-safe token transport)
        const secureCookies = process.env.COOKIE_SECURE === 'true'
        reply.setCookie('weaver_token', result.token, {
          httpOnly: true,
          secure: secureCookies,
          sameSite: 'strict',
          path: '/',
          maxAge: 15 * 60,
        })
        reply.setCookie('weaver_refresh', result.refreshToken, {
          httpOnly: true,
          secure: secureCookies,
          sameSite: 'strict',
          path: '/api/auth/refresh',
          maxAge: 7 * 24 * 60 * 60,
        })

        // Auto-provision example VM on first admin creation
        if (userCount === 0) {
          opts.onFirstAdmin?.()
        }

        return reply.status(201).send(result)
      } catch (err) {
        if (err instanceof AuthError) {
          await auditService?.log({
            userId: null,
            username,
            action: 'user.register',
            resource: username,
            details: { error: err.message },
            ip: request.ip,
            success: false,
          })
          return reply.status(err.statusCode).send({ error: err.message })
        }
        throw err
      }
    }
  )

  // POST /auth/login — Authenticate user
  app.post(
    '/login',
    { schema: { body: loginSchema }, config: { rateLimit: authRateLimit } },
    async (request, reply) => {
      const { username, password } = request.body

      try {
        const result = await authService.login(username, password, { singleSession })

        await auditService?.log({
          userId: result.user.id,
          username,
          action: 'user.login',
          details: { method: 'password' },
          ip: request.ip,
          success: true,
        })

        // Set httpOnly cookies (browser clients — XSS-safe token transport)
        const secureCookies = process.env.COOKIE_SECURE === 'true'
        reply.setCookie('weaver_token', result.token, {
          httpOnly: true,
          secure: secureCookies,
          sameSite: 'strict',
          path: '/',
          maxAge: 15 * 60,  // 15 minutes (access token TTL)
        })
        reply.setCookie('weaver_refresh', result.refreshToken, {
          httpOnly: true,
          secure: secureCookies,
          sameSite: 'strict',
          path: '/api/auth/refresh',  // Only sent to refresh endpoint
          maxAge: 7 * 24 * 60 * 60,  // 7 days
        })

        return result
      } catch (err) {
        if (err instanceof AuthError) {
          await auditService?.log({
            userId: null,
            username,
            action: 'user.login',
            details: { error: err.message },
            ip: request.ip,
            success: false,
          })
          return reply.status(err.statusCode).send({ error: err.message })
        }
        throw err
      }
    }
  )

  // POST /auth/refresh — Refresh access token
  app.post(
    '/refresh',
    { schema: { body: refreshSchema }, config: { rateLimit: authRateLimit } },
    async (request, reply) => {
      // Accept refresh token from body (TUI/API) or httpOnly cookie (browser)
      const refreshToken = request.body.refreshToken || request.cookies?.weaver_refresh

      if (!refreshToken) {
        return reply.status(401).send({ error: 'Refresh token is required' })
      }

      try {
        const tokens = await authService.refreshToken(refreshToken)

        // Set httpOnly cookies with new tokens
        const secureCookies = process.env.COOKIE_SECURE === 'true'
        reply.setCookie('weaver_token', tokens.token, {
          httpOnly: true,
          secure: secureCookies,
          sameSite: 'strict',
          path: '/',
          maxAge: 15 * 60,
        })
        reply.setCookie('weaver_refresh', tokens.refreshToken, {
          httpOnly: true,
          secure: secureCookies,
          sameSite: 'strict',
          path: '/api/auth/refresh',
          maxAge: 7 * 24 * 60 * 60,
        })

        return tokens
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.status(err.statusCode).send({ error: err.message })
        }
        throw err
      }
    }
  )

  // POST /auth/logout — Revoke all sessions for this user
  app.post(
    '/logout',
    async (request, reply) => {
      if (!request.userId || !request.tokenId) {
        return reply.status(401).send({ error: 'Authentication required' })
      }

      await authService.logout(request.tokenId, request.userId)

      // Clear httpOnly cookies
      reply.clearCookie('weaver_token', { path: '/' })
      reply.clearCookie('weaver_refresh', { path: '/api/auth/refresh' })

      await auditService?.log({
        userId: request.userId,
        username: request.username ?? 'unknown',
        action: 'user.logout',
        ip: request.ip,
        success: true,
      })

      return { ok: true }
    }
  )

  // PUT /auth/password — Change password
  app.put(
    '/password',
    { schema: { body: changePasswordSchema } },
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Authentication required' })
      }

      const { currentPassword, newPassword } = request.body

      try {
        await authService.changePassword(request.userId, currentPassword, newPassword)

        await auditService?.log({
          userId: request.userId,
          username: request.username ?? 'unknown',
          action: 'user.password-change',
          ip: request.ip,
          success: true,
        })

        return { ok: true }
      } catch (err) {
        if (err instanceof AuthError) {
          await auditService?.log({
            userId: request.userId ?? null,
            username: request.username ?? 'unknown',
            action: 'user.password-change',
            details: { error: err.message },
            ip: request.ip,
            success: false,
          })
          return reply.status(err.statusCode).send({ error: err.message })
        }
        throw err
      }
    }
  )

  // GET /auth/me — Get current user info
  app.get(
    '/me',
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Authentication required' })
      }

      const user = authService.getUserById(request.userId)
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      return { user }
    }
  )

  // PATCH /auth/me/preferences — Update current user's preferences
  app.patch(
    '/me/preferences',
    { schema: { body: preferencesSchema } },
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Authentication required' })
      }

      const updated = await authService.updatePreferences(request.userId, request.body)
      if (!updated) {
        return reply.status(404).send({ error: 'User not found' })
      }

      return { preferences: updated.preferences }
    }
  )

  // PUT /auth/me/sector — Update current user's work sector
  app.put(
    '/me/sector',
    { schema: { body: sectorSchema } },
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Authentication required' })
      }

      const { sector } = request.body
      const updated = await authService.updateSector(request.userId, sector)
      if (!updated) {
        return reply.status(404).send({ error: 'User not found' })
      }

      return { sector: updated.sector }
    }
  )

  // GET /auth/setup-required — Check if first-run setup is needed
  app.get(
    '/setup-required',
    async () => {
      return { setupRequired: authService.getUserCount() === 0 }
    }
  )
}

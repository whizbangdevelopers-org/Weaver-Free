// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyRequest, FastifyReply } from 'fastify'
import type { AuthService } from '../services/auth.js'
import { AuthError } from '../services/auth.js'
import type { UserRole } from '../models/user.js'

/** Why the auth middleware rejected a request (attached for downstream hooks). */
export type AuthRejectionReason =
  | 'no-token'           // No Authorization header on protected route
  | 'session-revoked'    // Valid JWT but session deleted (kick/logout/role change)
  | 'invalid-token'      // Malformed or tampered JWT
  | 'token-expired'      // JWT past expiry (caught as invalid-token in practice)

// Augment Fastify request with user info
declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
    userRole?: UserRole
    username?: string
    tokenId?: string
    /** Set by auth middleware when a request is rejected (401). */
    authRejectionReason?: AuthRejectionReason
  }
}

/**
 * Routes that don't REQUIRE authentication.
 * The middleware will still extract the token if present (so request.userId
 * is set for handlers that optionally use it), but won't reject if missing.
 */
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/setup-required',
  '/api/health',
  '/api/health/',
  '/api/stripe/webhook',
  '/api/stripe/webhook/',
]

function isPublicRoute(url: string): boolean {
  const path = url.split('?')[0]
  return PUBLIC_ROUTES.includes(path)
}

/** Cached JWT decode result (CPU savings — avoids re-verifying signature) */
interface CachedDecode {
  sub: string
  role: UserRole
  username: string
  jti: string
  expiresAt: number
}

const JWT_CACHE_TTL = 30_000  // 30 seconds (JWT decode cache)
const JWT_CACHE_MAX = 500

export function createAuthMiddleware(authService: AuthService) {
  // Cache JWT decode results (CPU-bound) but always check session store
  // for correctness (revoked tokens must fail immediately).
  const jwtDecodeCache = new Map<string, CachedDecode>()

  return async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // Skip for non-API routes (static files, SPA fallback)
    const path = request.url.split('?')[0]
    // WebSocket routes handle auth via query-param token inside the handler
    if (!path.startsWith('/api/')) return

    const authHeader = request.headers.authorization
    const isPublic = isPublicRoute(request.url)

    let token: string | undefined

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7) // 'Bearer '.length
    } else {
      // Cookie fallback (browser clients with httpOnly cookies)
      const cookieToken = request.cookies?.weaver_token
      if (cookieToken) {
        token = cookieToken
      } else {
        // No token from header or cookie
        if (isPublic) return

        request.authRejectionReason = 'no-token'
        reply.status(401).send({ error: 'Authentication required' })
        return
      }
    }

    try {
      // Check JWT decode cache (saves CPU on HS256 verify)
      const cached = jwtDecodeCache.get(token)
      let sub: string, role: UserRole, username: string, jti: string

      if (cached && cached.expiresAt > Date.now()) {
        // Use cached JWT claims, but still verify session is active
        sub = cached.sub
        role = cached.role
        username = cached.username
        jti = cached.jti
      } else {
        // Full verification (JWT + session)
        const payload = await authService.verifyToken(token)
        sub = payload.sub
        role = payload.role
        username = payload.username
        jti = payload.jti

        // Cache the JWT decode
        if (jwtDecodeCache.size >= JWT_CACHE_MAX) {
          const firstKey = jwtDecodeCache.keys().next().value
          if (firstKey) jwtDecodeCache.delete(firstKey)
        }
        jwtDecodeCache.set(token, {
          sub, role, username, jti,
          expiresAt: Date.now() + JWT_CACHE_TTL,
        })

        // Session already verified by verifyToken — assign and return
        request.userId = sub
        request.userRole = role
        request.username = username
        request.tokenId = jti
        void authService.updateActivity(jti)
        return
      }

      // Cache hit: still need to verify session is active
      const sessionValid = await authService.hasValidSession(jti)
      if (!sessionValid) {
        jwtDecodeCache.delete(token)
        // JWT was valid but session was deleted (login kick, logout, role change)
        request.authRejectionReason = 'session-revoked'
        throw new Error('Session expired or revoked')
      }

      request.userId = sub
      request.userRole = role
      request.username = username
      request.tokenId = jti
      void authService.updateActivity(jti)
    } catch (err) {
      jwtDecodeCache.delete(token)

      // Public routes: ignore invalid token, let request through unauthenticated
      if (isPublic) return

      // Tag reason if not already set (cache-hit path sets it before throwing)
      if (!request.authRejectionReason) {
        // verifyToken throws 'Session expired or revoked' for deleted sessions
        const isRevoked = err instanceof AuthError && err.message.includes('revoked')
        request.authRejectionReason = isRevoked ? 'session-revoked' : 'invalid-token'
      }
      reply.status(401).send({ error: 'Invalid or expired token' })
    }
  }
}

/**
 * WebSocket auth: verify token passed as query param.
 * Returns userId or null if invalid.
 */
export async function verifyWsToken(authService: AuthService, token: string | undefined): Promise<{ userId: string; role: UserRole; username: string } | null> {
  if (!token) return null

  try {
    const payload = await authService.verifyToken(token)
    return { userId: payload.sub, role: payload.role, username: payload.username }
  } catch {
    return null
  }
}

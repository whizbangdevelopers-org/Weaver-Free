// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyRequest, FastifyReply } from 'fastify'
import type { UserRole } from '../models/user.js'

/**
 * Role-Based Access Control (RBAC) middleware factory.
 *
 * Returns a Fastify preHandler that checks whether the authenticated
 * user's role is included in the allowed roles list.
 *
 * Role hierarchy: admin > operator > viewer
 * - admin has all permissions
 * - operator has all viewer permissions plus mutation actions
 * - viewer has read-only access
 *
 * Usage:
 *   app.post('/some-route', { preHandler: [requireRole('admin', 'operator')] }, handler)
 */
export function requireRole(...roles: UserRole[]) {
  const allowed = new Set(roles)
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.userRole || !allowed.has(request.userRole)) {
      reply.status(403).send({ error: 'Insufficient permissions' })
    }
  }
}

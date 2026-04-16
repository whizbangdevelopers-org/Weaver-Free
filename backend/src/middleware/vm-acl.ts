// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { FastifyRequest, FastifyReply } from 'fastify'
import type { VmAclStore } from '../storage/vm-acl-store.js'
import type { DashboardConfig } from '../config.js'
import { TIERS, ROLES } from '../constants/vocabularies.js'

/**
 * Creates a Fastify preHandler that enforces per-VM ACL checks.
 *
 * Only active when:
 * 1. Tier is fabrick
 * 2. User is not admin (admins always bypass)
 * 3. Route has a :name param (VM-specific routes)
 * 4. User has explicit ACL entries (no entries = all access)
 */
export function createVmAclCheck(aclStore: VmAclStore, config: DashboardConfig) {
  return async function vmAclCheck(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // ACL only enforced on fabrick tier
    if (config.tier !== TIERS.FABRICK) return

    // Admin bypasses ACL
    if (request.userRole === ROLES.ADMIN) return

    // No userId = let auth middleware handle it
    if (!request.userId) return

    // Only check routes with a :name VM param
    const params = request.params as { name?: string }
    if (!params.name) return

    if (!aclStore.isAllowed(request.userId, params.name)) {
      reply.status(403).send({ error: 'You do not have access to this VM' })
    }
  }
}

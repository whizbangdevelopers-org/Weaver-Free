// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireRole } from '../middleware/rbac.js'
import { ROLES } from '../constants/vocabularies.js'
import type { PresetTagStore } from '../storage/preset-tag-store.js'

const tagSchema = z.string().min(1).max(30).regex(
  /^[a-z0-9][a-z0-9-]*$/,
  'Tags must be lowercase alphanumeric with hyphens'
)

const tagsResponseSchema = z.object({ tags: z.array(z.string()) })

interface TagRouteOptions {
  presetTagStore: PresetTagStore
}

export const tagRoutes: FastifyPluginAsync<TagRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { presetTagStore } = opts

  // GET /api/tags — list preset tags (all authenticated users)
  app.get(
    '/',
    { schema: { response: { 200: tagsResponseSchema } } },
    async () => ({ tags: presetTagStore.getAll() })
  )

  // PUT /api/tags — replace preset tags (admin only)
  app.put(
    '/',
    {
      schema: {
        body: z.object({ tags: z.array(tagSchema).max(50) }),
        response: { 200: tagsResponseSchema },
      },
      preHandler: [requireRole(ROLES.ADMIN)],
    },
    async (request) => {
      await presetTagStore.set(request.body.tags)
      return { tags: presetTagStore.getAll() }
    }
  )
}

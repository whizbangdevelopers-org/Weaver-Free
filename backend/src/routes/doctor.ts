// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireRole } from '../middleware/rbac.js'
import { ROLES } from '../constants/vocabularies.js'
import { createRateLimit } from '../middleware/rate-limit.js'
import type { DoctorService } from '../services/doctor.js'

interface DoctorRouteOptions {
  doctorService: DoctorService
}

const doctorCheckSchema = z.object({
  check: z.string(),
  status: z.enum(['pass', 'warn', 'fail']),
  detail: z.string(),
  remediation: z.string().nullable(),
})

const doctorResponseSchema = z.object({
  timestamp: z.string(),
  durationMs: z.number(),
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    warned: z.number(),
    failed: z.number(),
    result: z.enum(['pass', 'warn', 'fail']),
  }),
  checks: z.array(doctorCheckSchema),
})

export const doctorRoutes: FastifyPluginAsync<DoctorRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { doctorService } = opts

  app.get(
    '/',
    {
      config: { rateLimit: createRateLimit(5) },
      schema: {
        response: {
          200: doctorResponseSchema,
          401: z.object({ error: z.string() }),
          403: z.object({ error: z.string() }),
        },
      },
      preHandler: [requireRole(ROLES.ADMIN)],
    },
    async (_request, reply) => {
      const result = await doctorService.runDiagnostics()
      return reply.send(result)
    },
  )
}

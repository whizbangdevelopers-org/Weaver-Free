// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { join } from 'node:path'
import { z } from 'zod'
import type { DashboardConfig } from '../config.js'
import { generateCompliancePdf, isValidComplianceSlug, getComplianceSlugs } from '../services/compliance-pdf.js'

interface ComplianceRouteOptions {
  config: DashboardConfig
  docsRoot: string
  appVersion: string
}



const slugParam = z.object({
  slug: z.string().refine(isValidComplianceSlug, {
    message: 'Unknown compliance document',
  }),
})

const errorResponseSchema = z.object({
  error: z.string(),
})

export const complianceRoutes: FastifyPluginAsync<ComplianceRouteOptions> = async (fastify, opts) => {
  // GET /api/compliance — list available compliance documents
  fastify.get('/', {
    schema: {
      response: {
        200: z.object({
          documents: z.array(z.string()),
        }),
      },
    },
  }, async () => {
    return { documents: getComplianceSlugs() }
  })

  // GET /api/compliance/:slug/pdf — download branded PDF
  fastify.get('/:slug/pdf', {
    schema: {
      params: slugParam,
      response: {
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { slug } = request.params as { slug: string }

    try {
      const cacheDir = join(opts.config.dataDir, 'pdf-cache')
      const pdfBuffer = await generateCompliancePdf({
        slug,
        version: opts.appVersion,
        weasyprintBin: opts.config.weasyprintBin,
        docsRoot: opts.docsRoot,
        cacheDir,
      })

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="weaver-${slug}-v${opts.appVersion}.pdf"`)
        .send(pdfBuffer)
    } catch (err) {
      fastify.log.error(err, `Compliance PDF generation failed for ${slug}`)
      return reply.status(500).send({ error: 'PDF generation failed. Ensure WeasyPrint is installed.' })
    }
  })
}

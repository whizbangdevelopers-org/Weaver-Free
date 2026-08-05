// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
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
  // Route through the Zod type provider so `request.params` is TYPED FROM THE SCHEMA that
  // already validates it. Without this, params is untyped and handlers reach for a cast —
  // which asserts a shape nothing checked and, being a shorthand-destructure-plus-cast,
  // is the one form audit:taint's engine cannot bind through. Validation and typing must
  // come from the same declaration or they drift silently.
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  // GET /api/compliance — list available compliance documents
  app.get('/', {
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
  app.get('/:slug/pdf', {
    schema: {
      params: slugParam,
      response: {
        // The success body is a PDF, not JSON. Declaring it keeps the handler's
        // `.send()` honestly typed — without it the only declared responses are the
        // error ones, so sending the buffer type-errors and the previous code simply
        // never noticed, because the cast on `request.params` had opted the whole
        // route out of the type provider.
        //
        // Safe at runtime: Fastify skips serialization entirely for Buffer payloads, so
        // the zod serializer never touches the bytes. Verified by injection against this
        // exact schema — 200, `application/pdf`, byte-identical payload.
        200: z.instanceof(Buffer),
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { slug } = request.params

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

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { DistroStore } from '../storage/distro-store.js'
import type { CatalogStore } from '../storage/catalog-store.js'
import { ImageManager } from '../services/image-manager.js'
import type { UrlValidationService } from '../services/url-validator.js'
import { requireRole } from '../middleware/rbac.js'
import { createRateLimit } from '../middleware/rate-limit.js'
import { requireTier } from '../license.js'
import { TIERS, ROLES, STATUSES } from '../constants/vocabularies.js'
import type { DashboardConfig } from '../config.js'
import type { AuditService } from '../services/audit.js'
import type { DistroTester } from '../services/distro-tester.js'

/** Response shape for a single distro entry */
interface DistroEntry {
  name: string
  label: string
  description?: string
  url: string
  effectiveUrl: string
  format: string
  cloudInit: boolean
  guestOs: 'linux' | 'windows'
  builtin: boolean
  hasOverride: boolean
  category: 'builtin' | 'catalog' | 'custom'
  license?: string
}

/** Built-in distro labels (for display) */
const BUILTIN_LABELS: Record<string, string> = {
  arch: 'Arch Linux',
  fedora: 'Fedora',
  ubuntu: 'Ubuntu',
  debian: 'Debian',
  alpine: 'Alpine',
}

interface DistroRouteOptions {
  distroStore: DistroStore
  catalogStore: CatalogStore
  imageManager: ImageManager
  urlValidator?: UrlValidationService
  config?: DashboardConfig
  auditService?: AuditService
  distroTester?: DistroTester
}

/** Accept http://, https://, or file:// URLs */
const imageUrlSchema = z.string().refine(
  (val) => /^(https?|file):\/\/.+/.test(val),
  { message: 'Must be a valid URL (http://, https://, or file://)' },
)

const customDistroSchema = z.object({
  name: z.string()
    .regex(/^[a-z][a-z0-9-]*$/, 'Name must be lowercase letters, digits, and hyphens')
    .min(2).max(32),
  label: z.string().min(1).max(64),
  url: imageUrlSchema.or(z.literal('')).default(''),
  format: z.enum(['qcow2', 'raw', 'iso']),
  cloudInit: z.boolean(),
  guestOs: z.enum(['linux', 'windows']).default('linux'),
  license: z.string().max(64).optional(),
}).refine(
  (data) => data.url.length > 0,
  { message: 'URL is required', path: ['url'] },
)

const distroNameSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
})

const urlUpdateSchema = z.object({
  url: imageUrlSchema,
})

export const distroRoutes: FastifyPluginAsync<DistroRouteOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { distroStore, catalogStore, imageManager, urlValidator, config, auditService, distroTester } = opts

  /** Tier gate: distro mutations require weaver */
  const requirePremium: import('fastify').preHandlerHookHandler = (_req, reply, done) => {
    if (config) {
      try { requireTier(config, TIERS.SOLO) } catch {
        void reply.status(403).send({ error: 'Distro management requires weaver tier' })
        return
      }
    }
    done()
  }

  // GET /api/distros — list all distros (built-in + catalog + custom)
  app.get('/', async () => {
    const builtins = ImageManager.builtinDistros()
    const catalogAll = catalogStore.getAll()
    const customs = distroStore.getAll()

    const entries: DistroEntry[] = []

    // Built-in distros
    for (const name of builtins) {
      const builtinUrl = ImageManager.builtinUrl(name) ?? ''
      // Check if there's a custom override for this built-in
      const customOverride = customs[name]
      const hasOverride = !!customOverride
      const effectiveUrl = hasOverride ? customOverride.url : builtinUrl

      entries.push({
        name,
        label: BUILTIN_LABELS[name] ?? name,
        url: builtinUrl,
        effectiveUrl,
        format: 'qcow2',
        cloudInit: true,
        guestOs: 'linux',
        builtin: true,
        hasOverride,
        category: 'builtin',
      })
    }

    // Catalog distros (skip if shadowed by built-in)
    for (const [name, d] of Object.entries(catalogAll)) {
      if (builtins.includes(name)) continue
      const catalogUrl = d.url ?? ''
      const customOverride = customs[name]
      const hasOverride = !!customOverride
      const effectiveUrl = hasOverride ? customOverride.url : catalogUrl

      entries.push({
        name,
        label: d.label,
        description: d.description,
        url: catalogUrl,
        effectiveUrl,
        format: d.format,
        cloudInit: d.cloudInit,
        guestOs: d.guestOs ?? 'linux',
        builtin: true,
        hasOverride,
        category: 'catalog',
        license: d.license,
      })
    }

    // Custom distros (skip if shadowing built-in or catalog — those show above with hasOverride)
    for (const [name, d] of Object.entries(customs)) {
      if (builtins.includes(name)) continue
      if (catalogAll[name]) continue
      entries.push({
        name: d.name,
        label: d.label,
        url: d.url,
        effectiveUrl: d.url,
        format: d.format,
        cloudInit: d.cloudInit,
        guestOs: d.guestOs ?? 'linux',
        builtin: false,
        hasOverride: false,
        category: 'custom',
        license: d.license,
      })
    }

    return entries
  })

  // POST /api/distros — add a custom distro (admin + premium)
  app.post(
    '/',
    { schema: { body: customDistroSchema }, preHandler: [requireRole(ROLES.ADMIN), requirePremium] },
    async (request, reply) => {
      const body = request.body

      // Reject if name collides with built-in
      if (ImageManager.builtinDistros().includes(body.name)) {
        return reply.status(409).send({ error: `'${body.name}' is a built-in distro and cannot be overridden` })
      }

      // Reject if name collides with catalog
      if (catalogStore.has(body.name)) {
        return reply.status(409).send({ error: `'${body.name}' is provided by the distro catalog and cannot be overridden` })
      }

      const added = await distroStore.add(body)
      if (!added) {
        return reply.status(409).send({ error: `Custom distro '${body.name}' already exists` })
      }

      // Update image manager's custom sources
      imageManager.setCustomSources(distroStore.toImageSources())

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'distro.create',
        resource: body.name,
        details: { label: body.label, format: body.format, guestOs: body.guestOs },
        ip: request.ip,
        success: true,
      })

      return reply.status(201).send({ success: true, message: `Custom distro '${body.name}' added` })
    }
  )

  // DELETE /api/distros/:name — remove a custom distro (admin + premium)
  app.delete(
    '/:name',
    { schema: { params: distroNameSchema }, preHandler: [requireRole(ROLES.ADMIN), requirePremium] },
    async (request, reply) => {
      const { name } = request.params

      if (ImageManager.builtinDistros().includes(name)) {
        return reply.status(400).send({ error: `Cannot remove built-in distro '${name}'` })
      }

      if (catalogStore.has(name)) {
        return reply.status(400).send({ error: `Cannot remove catalog distro '${name}'` })
      }

      const removed = await distroStore.remove(name)
      if (!removed) {
        return reply.status(404).send({ error: `Custom distro '${name}' not found` })
      }

      // Update image manager's custom sources
      imageManager.setCustomSources(distroStore.toImageSources())

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'distro.delete',
        resource: name,
        ip: request.ip,
        success: true,
      })

      return { success: true, message: `Custom distro '${name}' removed` }
    }
  )

  // POST /api/distros/refresh-catalog — refresh catalog from remote URL (operator+ / premium)
  app.post('/refresh-catalog', { preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR), requirePremium] }, async (request, reply) => {
    if (!catalogStore.hasRemoteUrl()) {
      return reply.status(400).send({ error: 'No remote catalog URL configured' })
    }

    try {
      const updated = await catalogStore.refresh()
      imageManager.setCatalogSources(catalogStore.toImageSources())

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'distro.refresh-catalog',
        details: { updated, count: catalogStore.names().length },
        ip: request.ip,
        success: true,
      })

      return { success: true, updated, count: catalogStore.names().length }
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error'
      fastify.log.error(err, 'Catalog refresh failed')
      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'distro.refresh-catalog',
        details: { error: detail },
        ip: request.ip,
        success: false,
      })
      return reply.status(502).send({ error: 'Catalog refresh failed. Check server logs for details.' })
    }
  })

  // GET /api/distros/url-status — get URL validation results (any authenticated user)
  app.get('/url-status', async () => {
    if (!urlValidator) {
      return { results: {}, lastRunAt: null }
    }
    return urlValidator.getResults()
  })

  // POST /api/distros/validate-urls — trigger immediate URL validation (admin + premium)
  app.post('/validate-urls', { preHandler: [requireRole(ROLES.ADMIN), requirePremium] }, async (request) => {
    if (!urlValidator) {
      return { results: {}, lastRunAt: null }
    }

    const data = await urlValidator.validateAll()

    await auditService?.log({
      userId: request.userId ?? null,
      username: request.username ?? 'unknown',
      action: 'distro.validate-urls',
      details: {
        total: Object.keys(data.results).length,
        valid: Object.values(data.results).filter(r => r.status === 'valid').length,
        invalid: Object.values(data.results).filter(r => r.status === 'invalid').length,
      },
      ip: request.ip,
      success: true,
    })

    return data
  })

  // PUT /api/distros/:name/url — update/override a distro URL (admin + premium)
  app.put(
    '/:name/url',
    { schema: { params: distroNameSchema, body: urlUpdateSchema }, preHandler: [requireRole(ROLES.ADMIN), requirePremium] },
    async (request, reply) => {
      const { name } = request.params
      const { url } = request.body
      const builtins = ImageManager.builtinDistros()

      if (builtins.includes(name) || catalogStore.has(name)) {
        // Create or update custom override for builtin/catalog distros
        const existing = distroStore.get(name)
        if (existing) {
          await distroStore.update(name, { url })
        } else {
          // Create override entry
          const label = BUILTIN_LABELS[name] ?? catalogStore.get(name)?.label ?? name
          const source = imageManager.getDistroSource(name)
          await distroStore.add({
            name,
            label,
            url,
            format: source?.format === 'iso' ? 'iso' : source?.format === 'raw' ? 'raw' : 'qcow2',
            cloudInit: source?.cloudInit ?? true,
            guestOs: source?.guestOs,
          })
        }
      } else if (distroStore.has(name)) {
        // Update existing custom distro
        await distroStore.update(name, { url })
      } else {
        return reply.status(404).send({ error: `Distro '${name}' not found` })
      }

      imageManager.setCustomSources(distroStore.toImageSources())

      // Validate the new URL immediately
      if (urlValidator) {
        await urlValidator.validateOne(name)
      }

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'distro.update-url',
        resource: name,
        details: { url },
        ip: request.ip,
        success: true,
      })

      return { success: true, message: `URL updated for '${name}'` }
    }
  )

  // DELETE /api/distros/:name/url-override — remove custom URL override, restore default (admin + premium)
  app.delete(
    '/:name/url-override',
    { schema: { params: distroNameSchema }, preHandler: [requireRole(ROLES.ADMIN), requirePremium] },
    async (request, reply) => {
      const { name } = request.params
      const builtins = ImageManager.builtinDistros()

      // Only meaningful for builtin/catalog distros that have a custom override
      if (!builtins.includes(name) && !catalogStore.has(name)) {
        return reply.status(400).send({ error: `'${name}' is a custom distro — use DELETE /api/distros/:name to remove it` })
      }

      if (!distroStore.has(name)) {
        return reply.status(404).send({ error: `No URL override found for '${name}'` })
      }

      await distroStore.remove(name)
      imageManager.setCustomSources(distroStore.toImageSources())

      // Re-validate with restored default URL
      if (urlValidator) {
        await urlValidator.validateOne(name)
      }

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'distro.reset-url',
        resource: name,
        ip: request.ip,
        success: true,
      })

      return { success: true, message: `URL override removed for '${name}', default restored` }
    }
  )

  // POST /api/distros/:name/test — start a smoke test for a distro (admin + premium)
  app.post(
    '/:name/test',
    {
      schema: {
        params: distroNameSchema,
        response: {
          202: z.object({ status: z.string(), message: z.string() }),
          400: z.object({ error: z.string() }),
          409: z.object({ error: z.string() }),
        },
      },
      preHandler: [requireRole(ROLES.ADMIN), requirePremium],
      config: { rateLimit: createRateLimit(5) },
    },
    async (request, reply) => {
      const { name } = request.params

      if (!distroTester) {
        return reply.status(400).send({ error: 'Distro testing requires provisioning to be enabled' })
      }

      // Validate distro exists
      const allSources = imageManager.getAllSources()
      if (!(name in allSources)) {
        return reply.status(400).send({ error: `Distro '${name}' not found in catalog` })
      }

      if (distroTester.isRunning(name)) {
        return reply.status(409).send({ error: `Test already running for '${name}'` })
      }

      await distroTester.startTest(name)

      await auditService?.log({
        userId: request.userId ?? null,
        username: request.username ?? 'unknown',
        action: 'distro.test',
        resource: name,
        ip: request.ip,
        success: true,
      })

      return reply.status(202).send({ status: STATUSES.RUNNING, message: `Smoke test started for '${name}'` })
    }
  )

  // GET /api/distros/:name/test — get smoke test status for a distro (admin + premium)
  app.get(
    '/:name/test',
    {
      schema: {
        params: distroNameSchema,
        response: {
          200: z.object({
            status: z.enum([STATUSES.RUNNING, 'passed', STATUSES.FAILED, 'none']),
            error: z.string().optional(),
            durationSeconds: z.number().optional(),
            startedAt: z.string().optional(),
          }),
        },
      },
      preHandler: [requireRole(ROLES.ADMIN), requirePremium],
    },
    async (request, reply) => {
      if (!distroTester) {
        return reply.send({ status: 'none' as const })
      }
      const { name } = request.params
      return distroTester.getStatus(name)
    }
  )
}

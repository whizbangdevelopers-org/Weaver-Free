// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireRole } from '../middleware/rbac.js'
import { ROLES, TIERS, TIER_ORDER } from '../constants/vocabularies.js'
import { createRateLimit } from '../middleware/rate-limit.js'
import { DEFAULT_DNS_DOMAIN, type DnsZone } from '../services/dns-zone.js'
import type { DashboardConfig } from '../config.js'

const dnsRecordSchema = z.object({
  name: z.string(),
  type: z.enum(['A', 'PTR']),
  value: z.string(),
  vmName: z.string(),
})

/**
 * The zone response.
 *
 * `available` is explicit rather than inferred from an empty record list. "DNS Core is not active
 * on this tier" and "it is active and no workload has an address yet" are different facts, and a
 * client that has to guess between them from `records.length === 0` will guess wrong — most
 * visibly by showing an upgrade prompt to someone who has already paid.
 */
const dnsZoneResponseSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  domain: z.string(),
  ttl: z.number(),
  serial: z.number(),
  records: z.array(dnsRecordSchema),
  skipped: z.array(z.object({ name: z.string(), reason: z.string() })),
})

const errorResponseSchema = z.object({ error: z.string() })

const vmNameSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Invalid workload name format'),
})

interface DnsRoutesOptions {
  config?: DashboardConfig
  /** Null when DNS Core is not running — a Free build, or the resolver is disabled. */
  getZone?: () => DnsZone | null
}

export const dnsRoutes: FastifyPluginAsync<DnsRoutesOptions> = async (fastify, opts) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const { config, getZone } = opts

  /**
   * DNS Core is Solo+, so below Solo the zone is genuinely absent rather than withheld.
   *
   * Reads are open to every role and every tier and return an EMPTY zone with a reason, instead of
   * a 403. The endpoint answers "what does DNS resolve here", and "nothing, because this tier has
   * no zone" is a true and useful answer — the same shape as the metrics endpoint returning an
   * empty series when no collector is running. A 403 would force the UI to special-case an error
   * in order to render a state that is not an error.
   */
  function zonePayload(): z.infer<typeof dnsZoneResponseSchema> {
    const empty = {
      domain: config?.dnsDomain ?? DEFAULT_DNS_DOMAIN,
      ttl: 0,
      serial: 0,
      records: [],
      skipped: [],
    }

    if (!config || TIER_ORDER[config.tier] < TIER_ORDER[TIERS.SOLO]) {
      return { available: false, reason: 'DNS Core requires Weaver Solo or higher', ...empty }
    }
    const zone = getZone?.() ?? null
    if (!zone) {
      return { available: false, reason: 'DNS Core is not enabled on this host', ...empty }
    }
    return {
      available: true,
      domain: zone.domain,
      ttl: zone.ttl,
      serial: zone.serial,
      records: zone.records,
      skipped: zone.skipped,
    }
  }

  // GET /api/dns/zone — the whole internal zone
  app.get(
    '/zone',
    {
      schema: { response: { 200: dnsZoneResponseSchema } },
      preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER)],
      config: { rateLimit: createRateLimit(30) },
    },
    async () => zonePayload(),
  )

  // GET /api/dns/zone/:name — the records belonging to one workload
  app.get(
    '/zone/:name',
    {
      schema: {
        params: vmNameSchema,
        response: { 200: dnsZoneResponseSchema, 404: errorResponseSchema },
      },
      preHandler: [requireRole(ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER)],
      config: { rateLimit: createRateLimit(30) },
    },
    async (request, reply) => {
      const payload = zonePayload()
      if (!payload.available) return payload

      const records = payload.records.filter(r => r.vmName === request.params.name)
      const skipped = payload.skipped.filter(s => s.name === request.params.name)
      if (records.length === 0 && skipped.length === 0) {
        return reply.status(404).send({ error: `No DNS records for workload '${request.params.name}'` })
      }
      // A workload that is only in `skipped` returns 200 with its reason rather than 404 — "there
      // is no record and here is why" is the answer the user needs, and a 404 discards the why.
      return { ...payload, records, skipped }
    },
  )
}

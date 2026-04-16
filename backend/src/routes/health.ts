// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import type { DashboardConfig } from '../config.js'
import type { HostInfoService } from '../services/host-info.js'
import type { OrganizationStore } from '../storage/organization-store.js'
import { TIERS } from '../constants/vocabularies.js'
import { getAllPlugins } from '../plugins.js'

interface HealthRouteOptions {
  config?: DashboardConfig
  hostInfoService?: HostInfoService
  organizationStore?: OrganizationStore
}

export const healthRoutes: FastifyPluginAsync<HealthRouteOptions> = async (fastify, opts) => {
  // Cache health response briefly to reduce allocation under frequent polling
  let cached: { response: unknown; expiresAt: number } | null = null
  const CACHE_TTL = 5_000

  fastify.get('/', async () => {
    const now = Date.now()
    if (cached && now < cached.expiresAt) return cached.response

    const hostInfo = opts.hostInfoService
      ? await opts.hostInfoService.getBasicInfo()
      : null

    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'weaver',
      tier: opts.config?.tier ?? TIERS.DEMO,
      tierExpiry: opts.config?.licenseExpiry?.toISOString() ?? null,
      tierGraceMode: opts.config?.licenseGraceMode ?? false,
      provisioningEnabled: opts.config?.provisioningEnabled ?? false,
      bridgeGateway: opts.config?.bridgeGateway ?? null,
      hasServerKey: !!(opts.config?.aiApiKey),
      host: hostInfo,
      plugins: getAllPlugins(),
      organization: opts.organizationStore?.getIdentity() ?? null,
    }
    cached = { response, expiresAt: now + CACHE_TTL }
    return response
  })
}

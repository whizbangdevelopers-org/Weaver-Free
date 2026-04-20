// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { FastifyPluginAsync } from 'fastify'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
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

/**
 * Read the running package version once at module load. Used by the /api/health
 * response so operators can verify what version is actually live (critical for
 * upgrade validation — see docs/UPGRADE.md § Verification Checklist).
 */
function resolvePackageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    // From dist/routes/ or src/routes/ walk up to the backend package.json.
    for (const candidate of [
      resolve(here, '..', '..', 'package.json'),
      resolve(here, '..', 'package.json'),
    ]) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, 'utf-8')) as { version?: string }
        if (pkg.version) return pkg.version
      } catch {
        // try next candidate
      }
    }
  } catch {
    // fall through to 'unknown'
  }
  return 'unknown'
}

const PACKAGE_VERSION = resolvePackageVersion()

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
      version: PACKAGE_VERSION,
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

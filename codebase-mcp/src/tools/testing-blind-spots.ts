// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve, basename, relative } from 'node:path'
import { safeReadFile, listFiles, listDirs } from '../utils/file-reader.js'

interface BlindSpot {
  feature: string
  reason: string
  tier: string
  severity: 'high' | 'medium' | 'low'
}

interface SpecCoverage {
  file: string
  testedRoutes: string[]
  testedTiers: string[]
}

interface TestingBlindSpotsResult {
  blindSpots: BlindSpot[]
  specCoverage: SpecCoverage[]
  e2eTier: string
  e2eEnvVars: Record<string, string>
  warnings: string[]
}

export async function getTestingBlindSpots(projectRoot: string): Promise<TestingBlindSpotsResult> {
  const warnings: string[] = []
  const blindSpots: BlindSpot[] = []

  // ── Determine E2E tier from docker-compose ──────────────────────────────
  let e2eTier = 'weaver'
  const e2eEnvVars: Record<string, string> = {}

  const composePath = resolve(projectRoot, 'testing/e2e-docker/docker-compose.yml')
  const composeContent = await safeReadFile(composePath)
  if (composeContent) {
    const envRegex = /^\s+-\s+(\w+)=(.+)$/gm
    let match: RegExpExecArray | null
    while ((match = envRegex.exec(composeContent)) !== null) {
      // Stop at second service
      if (match.index > composeContent.indexOf('playwright-watch:')) break
      e2eEnvVars[match[1]] = match[2]
    }

    if (e2eEnvVars['PREMIUM_ENABLED'] === 'true') {
      e2eTier = 'weaver'
    }
  }

  // ── Scan routes for tier gates and identify untestable features ─────────
  const routesDir = resolve(projectRoot, 'backend/src/routes')
  const topFiles = await listFiles(routesDir, '.ts')
  const subDirs = await listDirs(routesDir)
  const subFiles: string[] = []
  for (const dir of subDirs) {
    const files = await listFiles(resolve(routesDir, dir), '.ts')
    subFiles.push(...files)
  }
  const allRouteFiles = [...topFiles, ...subFiles]

  // Collect fabrick-gated routes (can't test at weaver tier)
  const fabrickRoutes: string[] = []
  // Collect routes needing env vars not set in E2E
  const envGatedFeatures: Array<{ route: string; envVar: string }> = []

  for (const filePath of allRouteFiles) {
    const fileName = basename(filePath, '.ts')
    if (fileName === 'index') continue

    const content = await safeReadFile(filePath)
    if (!content) continue

    const relFile = relative(projectRoot, filePath)

    // Find fabrick tier gates
    const tierGateRegex = /requireTier\s*\(\s*\w+\s*,\s*'(\w+)'\s*\)/g
    let match: RegExpExecArray | null
    while ((match = tierGateRegex.exec(content)) !== null) {
      if (match[1] === 'fabrick') {
        fabrickRoutes.push(relFile)
        break  // One per file is enough
      }
    }

    // Find features gated by config/env that may not be set in E2E
    const envCheckRegex = /config\.(\w+)(?:\s*[!=]==?\s*|\s*\?\s*\.|\s*&&)/g
    while ((match = envCheckRegex.exec(content)) !== null) {
      const field = match[1]
      // Skip fields we know are set in E2E
      if (['tier', 'port', 'host', 'premiumEnabled', 'jwtSecret'].includes(field)) continue
      envGatedFeatures.push({ route: relFile, envVar: field })
    }
  }

  // ── Build blind spots ──────────────────────────────────────────────────

  // Fabrick features can't be tested at weaver tier
  if (fabrickRoutes.length > 0) {
    const uniqueFiles = [...new Set(fabrickRoutes)]
    blindSpots.push({
      feature: `Fabrick-gated routes (${uniqueFiles.length} files)`,
      reason: `E2E runs at ${e2eTier} tier. Fabrick routes return 403: ${uniqueFiles.join(', ')}`,
      tier: 'fabrick',
      severity: 'high',
    })
  }

  // Free tier behavior can't be tested at weaver tier
  blindSpots.push({
    feature: 'Free-tier feature restrictions',
    reason: `E2E runs at ${e2eTier} tier. Free-tier gates (Create VM, Delete VM, distro management) are not exercised. Tier-gating spec only tests negative cases (feature hidden at current tier).`,
    tier: 'free',
    severity: 'medium',
  })

  // Demo mode is client-only
  blindSpots.push({
    feature: 'Demo mode tier-switcher',
    reason: 'Demo mode runs as static SPA with no backend. E2E suite tests against real backend only. Demo-specific mock functions (mockCreateVm, mockDeleteVm) are untested by E2E.',
    tier: 'demo',
    severity: 'low',
  })

  // Check for BRIDGE_GATEWAY-dependent features
  if (e2eEnvVars['BRIDGE_GATEWAY']) {
    // Bridge is set in E2E, but real provisioning still won't work
    blindSpots.push({
      feature: 'VM provisioning (real microVM boot)',
      reason: 'BRIDGE_GATEWAY is set in E2E Docker but no real hypervisor is available. Provisioning routes accept requests but VMs cannot actually boot. Only mock/registration flow is testable.',
      tier: 'weaver',
      severity: 'medium',
    })
  }

  // Check for missing env vars
  const knownMissing = ['ANTHROPIC_API_KEY', 'LICENSE_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']
  for (const envVar of knownMissing) {
    if (!e2eEnvVars[envVar]) {
      const featureMap: Record<string, string> = {
        'ANTHROPIC_API_KEY': 'AI agent with server key (runs in mock mode instead)',
        'LICENSE_KEY': 'License validation (falls back to free tier detection)',
        'VAPID_PUBLIC_KEY': 'Web push notifications (subscription creation fails)',
        'VAPID_PRIVATE_KEY': 'Web push notifications (push delivery fails)',
      }
      blindSpots.push({
        feature: featureMap[envVar] || envVar,
        reason: `${envVar} not set in E2E Docker environment. Feature operates in fallback/mock mode.`,
        tier: 'weaver',
        severity: envVar === 'ANTHROPIC_API_KEY' ? 'low' : 'medium',
      })
    }
  }

  // ── Spec coverage analysis ─────────────────────────────────────────────
  const specCoverage: SpecCoverage[] = []
  const specFiles = await listFiles(resolve(projectRoot, 'testing/e2e'), '.spec.ts')

  for (const filePath of specFiles) {
    const content = await safeReadFile(filePath)
    if (!content) continue

    const relFile = relative(projectRoot, filePath)

    // Find API routes tested
    const testedRoutes: string[] = []
    const routeRegex = /['"`](\/api\/[^'"`\s]+)['"`]/g
    let match: RegExpExecArray | null
    const seenRoutes = new Set<string>()
    while ((match = routeRegex.exec(content)) !== null) {
      if (!seenRoutes.has(match[1])) {
        testedRoutes.push(match[1])
        seenRoutes.add(match[1])
      }
    }

    // Find tier references
    const testedTiers: string[] = []
    const tierRefRegex = /\b(fabrick|weaver|free|demo)\b/gi
    const seenTiers = new Set<string>()
    while ((match = tierRefRegex.exec(content)) !== null) {
      const tier = match[1].toLowerCase()
      if (!seenTiers.has(tier)) {
        testedTiers.push(tier)
        seenTiers.add(tier)
      }
    }

    specCoverage.push({ file: relFile, testedRoutes, testedTiers })
  }

  return { blindSpots, specCoverage, e2eTier, e2eEnvVars, warnings }
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve, relative } from 'node:path'
import { safeReadFile, listFiles, listDirs } from '../utils/file-reader.js'

interface FrontendGatingExample {
  file: string
  minimumTier: string
  featureName: string
  loaderPath: string
}

interface BackendGatingExample {
  file: string
  route: string
  tier: string
  line: string
}

interface TierGatingPatternResult {
  frontendPattern: {
    composable: string
    gotcha: string
    usageExample: string
    tierOrder: Record<string, number>
    instances: FrontendGatingExample[]
  }
  backendPattern: {
    function: string
    usageExample: string
    instances: BackendGatingExample[]
  }
  tierMatrixRule: string
  dynamicImportPattern: string
  warnings: string[]
}

export async function getTierGatingPattern(projectRoot: string): Promise<TierGatingPatternResult> {
  const warnings: string[] = []

  // ── Frontend: useTierFeature composable ────────────────────────────────
  const composablePath = resolve(projectRoot, 'src/composables/useTierFeature.ts')
  const composableContent = await safeReadFile(composablePath)
  if (!composableContent) {
    warnings.push('Could not read src/composables/useTierFeature.ts')
  }

  // Scan pages for useTierFeature() call sites
  const instances: FrontendGatingExample[] = []
  const pagesDir = resolve(projectRoot, 'src/pages')
  const pageFiles = await listFiles(pagesDir, '.vue')

  for (const filePath of pageFiles) {
    const content = await safeReadFile(filePath)
    if (!content || !content.includes('useTierFeature')) continue

    const relFile = relative(projectRoot, filePath)

    // Extract useTierFeature({ minimumTier: '...', featureName: '...', loader: ... })
    const callRegex = /useTierFeature\s*\(\s*\{([^}]+)\}/gs
    let match: RegExpExecArray | null
    while ((match = callRegex.exec(content)) !== null) {
      const opts = match[1]
      const tierMatch = opts.match(/minimumTier:\s*['"](\w+)['"]/)
      const nameMatch = opts.match(/featureName:\s*['"]([^'"]+)['"]/)
      const loaderMatch = opts.match(/loader:\s*\(\)\s*=>\s*import\s*\(['"]([^'"]+)['"]\)/)

      instances.push({
        file: relFile,
        minimumTier: tierMatch?.[1] ?? '?',
        featureName: nameMatch?.[1] ?? '?',
        loaderPath: loaderMatch?.[1] ?? '?',
      })
    }
  }

  // ── Backend: requireTier() call sites ──────────────────────────────────
  const backendInstances: BackendGatingExample[] = []
  const routesDir = resolve(projectRoot, 'backend/src/routes')
  const topFiles = await listFiles(routesDir, '.ts')
  const subDirs = await listDirs(routesDir)
  const subFiles: string[] = []
  for (const dir of subDirs) {
    const files = await listFiles(resolve(routesDir, dir), '.ts')
    subFiles.push(...files)
  }

  for (const filePath of [...topFiles, ...subFiles]) {
    const content = await safeReadFile(filePath)
    if (!content || !content.includes('requireTier')) continue

    const relFile = relative(projectRoot, filePath)
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes('requireTier')) continue
      const tierMatch = lines[i].match(/requireTier\s*\(\s*\w+\s*,\s*['"](\w+)['"]/)
      if (!tierMatch) continue

      // Find the HTTP method + path on nearby lines (may span two lines)
      let routeCtx = ''
      const window = lines.slice(Math.max(0, i - 20), i + 2).join('\n')
      const routeMatch = window.match(
        /(?:fastify|app|router)\.(get|post|put|patch|delete)\s*\(\s*\n?\s*['"]([^'"]+)['"]/
      )
      if (routeMatch) {
        routeCtx = `${routeMatch[1].toUpperCase()} ${routeMatch[2]}`
      }

      backendInstances.push({
        file: relFile,
        route: routeCtx || '(see file)',
        tier: tierMatch[1],
        line: lines[i].trim(),
      })
    }
  }

  return {
    frontendPattern: {
      composable: 'src/composables/useTierFeature.ts',
      gotcha: [
        'NEVER use defineAsyncComponent for tier gating — it caches the result on first evaluation.',
        'If appStore.tier is still "demo" (default) when the component first loads (health endpoint not yet fetched),',
        'the UpgradeNag gets cached permanently. Logout/login appears to fix it because the store is populated by then.',
        'useTierFeature uses a reactive defineComponent with watch(hasTier) so it re-evaluates when tier changes.',
        'appStore.initialize() (fetches /health) runs in the router beforeEach guard to ensure tier is set before render.',
      ].join(' '),
      usageExample: [
        "import { useTierFeature } from 'src/composables/useTierFeature'",
        '',
        'const WeaverPanel = useTierFeature({',
        "  minimumTier: 'weaver',",
        "  loader: () => import('src/components/weaver/WeaverPanel.vue'),",
        "  featureName: 'My Feature',",
        "  featureDescription: 'Available on Weaver and above',",
        "  features: ['Feature bullet 1', 'Feature bullet 2'],",
        '})',
      ].join('\n'),
      tierOrder: { demo: 0, free: 1, weaver: 2, fabrick: 3 },
      instances,
    },
    backendPattern: {
      function: 'requireTier(reply, tier) from backend/src/middleware/vm-acl.ts or inline config check',
      usageExample: [
        "// In a Fastify route handler:",
        "if (requireTier(reply, config, 'weaver')) return",
        "// requireTier sends 403 with upgrade message and returns true when tier insufficient",
        "// Returns false (and does NOT reply) when tier is sufficient — handler continues normally",
      ].join('\n'),
      instances: backendInstances,
    },
    tierMatrixRule: [
      'ALWAYS update tier-matrix.json before adding any new tier gate.',
      'Run npm run audit:tier-parity after adding a gate — it cross-references tier-matrix.json',
      'against backend requireTier() calls and frontend useTierFeature() calls.',
      'Orphan gates (in code but not in matrix) fail the audit.',
    ].join(' '),
    dynamicImportPattern: [
      'Premium/Enterprise code uses dynamic imports so the free repo works without the directory:',
      "try { const mod = await import('./weaver/MyFeature.js'); ... } catch { /* directory absent */ }",
      'This applies to both backend services (src/services/weaver/) and frontend components (src/components/weaver/).',
      'useTierFeature.loader() catches import failures automatically (loadFailed ref → shows UpgradeNag).',
    ].join(' '),
    warnings,
  }
}

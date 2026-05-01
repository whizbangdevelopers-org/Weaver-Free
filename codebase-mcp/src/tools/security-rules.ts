// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve, basename, relative } from 'node:path'
import { safeReadFile, listFiles, listDirs } from '../utils/file-reader.js'

interface RouteSecurityInfo {
  method: string
  path: string
  roles: string[]
  tierGate: string | null
  rateLimit: string | null
  file: string
}

interface SecuritySummary {
  publicRoutes: string[]
  adminOnlyRoutes: string[]
  enterpriseGatedRoutes: string[]
  premiumGatedRoutes: string[]
  rateLimitedRoutes: string[]
  unprotectedMutations: string[]
}

interface SecurityRulesResult {
  routes: RouteSecurityInfo[]
  summary: SecuritySummary
  roleHierarchy: string[]
  tierHierarchy: string[]
  warnings: string[]
}

export async function getSecurityRules(projectRoot: string): Promise<SecurityRulesResult> {
  const warnings: string[] = []

  // ── Collect all route files (top-level + subdirectories) ─────────────────
  const routesDir = resolve(projectRoot, 'backend/src/routes')
  const topLevelFiles = await listFiles(routesDir, '.ts')

  const subDirs = await listDirs(routesDir)
  const subDirFiles: string[] = []
  for (const dir of subDirs) {
    const files = await listFiles(resolve(routesDir, dir), '.ts')
    subDirFiles.push(...files)
  }

  const allRouteFiles = [...topLevelFiles, ...subDirFiles]

  // ── Read index.ts for prefix mappings ────────────────────────────────────
  const indexPath = resolve(projectRoot, 'backend/src/index.ts')
  const indexContent = await safeReadFile(indexPath)
  const prefixMap: Record<string, string> = {}

  if (indexContent) {
    const registerRegex = /register\s*\(\s*(\w+)\s*,\s*\{[^}]*prefix:\s*['"]([^'"]+)['"]/g
    let match: RegExpExecArray | null
    while ((match = registerRegex.exec(indexContent)) !== null) {
      prefixMap[match[1]] = match[2]
    }
  }

  // ── Read subdirectory index files for sub-prefixes ──────────────────────
  const subPrefixMap = new Map<string, string>()
  for (const filePath of subDirFiles) {
    if (basename(filePath, '.ts') !== 'index') continue
    const content = await safeReadFile(filePath)
    if (!content) continue

    const subRegex = /register\s*\(\s*(\w+)\s*,\s*\{[^}]*prefix:\s*['"]([^'"]+)['"]/g
    let match: RegExpExecArray | null
    while ((match = subRegex.exec(content)) !== null) {
      subPrefixMap.set(match[1], match[2])
    }
  }

  // ── Parse each route file ──────────────────────────────────────────────
  const routes: RouteSecurityInfo[] = []

  for (const filePath of allRouteFiles) {
    const fileName = basename(filePath, '.ts')
    if (fileName === 'index') continue

    const content = await safeReadFile(filePath)
    if (!content) continue

    const relFile = relative(projectRoot, filePath)

    // Determine prefix
    const exportedName = findExportedRouteName(content)
    let prefix = ''
    if (exportedName && subPrefixMap.has(exportedName)) {
      prefix = subPrefixMap.get(exportedName)!
    } else {
      const routeVarName = Object.keys(prefixMap).find(key =>
        key.toLowerCase().includes(fileName.replace(/-/g, ''))
      )
      prefix = routeVarName ? prefixMap[routeVarName] : ''
    }

    // Extract route definitions with their surrounding context
    const routeRegex = /(?:app|fastify)\.(get|post|put|delete|patch)\s*(?:<[^>]*>)?\s*\(\s*['"]([^'"]+)['"]/gi
    let match: RegExpExecArray | null

    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase()
      const subPath = match[2]
      const fullPath = prefix + subPath

      // Look at broader context: from start of the route call to +800 chars
      // (need to capture preHandler and body)
      const contextStart = Math.max(0, match.index - 20)
      const contextEnd = Math.min(content.length, match.index + 800)
      const context = content.slice(contextStart, contextEnd)

      // Extract roles from requireRole
      const roles: string[] = []
      const roleMatch = context.match(/requireRole\s*\(\s*([^)]+)\)/)
      if (roleMatch) {
        const roleArgs = roleMatch[1].replace(/['"]/g, '').split(',').map(s => s.trim()).filter(Boolean)
        roles.push(...roleArgs)
      }

      // Check for public routes (no auth)
      const isPublic = fileName === 'health' || fileName === 'auth' || subPath.startsWith('/ws/')
      if (isPublic && roles.length === 0) {
        roles.push('public')
      }

      // If no explicit roles found and not public, it's auth-required but role-unrestricted
      if (roles.length === 0) {
        roles.push('authenticated')
      }

      // Extract tier gate
      let tierGate: string | null = null
      const tierMatch = context.match(/requireTier\s*\(\s*\w+\s*,\s*['"](\w+)['"]/)
      if (tierMatch) {
        tierGate = tierMatch[1]
      }

      // Extract rate limit
      let rateLimit: string | null = null
      const rateLimitMatch = context.match(/rateLimit\s*:\s*\{[^}]*max:\s*(\d+)[^}]*timeWindow:\s*['"]?([^'"}\s]+)['"]?/s)
        ?? context.match(/createRateLimit\s*\(\s*(\d+)\s*\)/)
      if (rateLimitMatch) {
        rateLimit = rateLimitMatch[2]
          ? `${rateLimitMatch[1]}/${rateLimitMatch[2]}`
          : `${rateLimitMatch[1]}/min`
      }

      routes.push({ method, path: fullPath, roles, tierGate, rateLimit, file: relFile })
    }
  }

  // Sort by path then method
  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))

  // ── Build summary ──────────────────────────────────────────────────────
  const summary: SecuritySummary = {
    publicRoutes: [],
    adminOnlyRoutes: [],
    enterpriseGatedRoutes: [],
    premiumGatedRoutes: [],
    rateLimitedRoutes: [],
    unprotectedMutations: [],
  }

  for (const r of routes) {
    const label = `${r.method} ${r.path}`
    if (r.roles.includes('public')) summary.publicRoutes.push(label)
    if (r.roles.length === 1 && r.roles[0] === 'admin') summary.adminOnlyRoutes.push(label)
    if (r.tierGate === 'fabrick') summary.enterpriseGatedRoutes.push(label)
    if (r.tierGate === 'weaver') summary.premiumGatedRoutes.push(label)
    if (r.rateLimit) summary.rateLimitedRoutes.push(`${label} (${r.rateLimit})`)

    // Flag mutations (POST/PUT/DELETE) that lack role restrictions
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(r.method)
    if (isMutation && r.roles.includes('authenticated') && !r.roles.includes('public')) {
      summary.unprotectedMutations.push(label)
    }
  }

  return {
    routes,
    summary,
    roleHierarchy: ['admin', 'operator', 'viewer'],
    tierHierarchy: ['fabrick', 'weaver', 'free', 'demo'],
    warnings,
  }
}

function findExportedRouteName(content: string): string | null {
  const match = content.match(/export\s+(?:const|function)\s+(\w+Routes?\w*)/)
  return match ? match[1] : null
}

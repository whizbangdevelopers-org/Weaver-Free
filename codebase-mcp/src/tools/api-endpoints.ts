// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve, basename, relative } from 'node:path'
import { safeReadFile, listFiles, listDirs } from '../utils/file-reader.js'

interface EndpointInfo {
  method: string
  path: string
  auth: string
  rateLimit: string | null
  tierGate: string | null
  file: string
}

interface ApiEndpointsResult {
  endpoints: EndpointInfo[]
  prefixMap: Record<string, string>
  warnings: string[]
}

export async function getApiEndpoints(projectRoot: string): Promise<ApiEndpointsResult> {
  const warnings: string[] = []

  // Step 1: Read backend/src/index.ts to extract route prefix mappings
  const indexPath = resolve(projectRoot, 'backend/src/index.ts')
  const indexContent = await safeReadFile(indexPath)
  const prefixMap: Record<string, string> = {}

  if (indexContent) {
    // Match: await fastify.register(vmsRoutes, { prefix: '/api/workload', ... })
    const registerRegex = /register\s*\(\s*(\w+)\s*,\s*\{[^}]*prefix:\s*['"]([^'"]+)['"]/g
    let match: RegExpExecArray | null
    while ((match = registerRegex.exec(indexContent)) !== null) {
      prefixMap[match[1]] = match[2]
    }

    // Routes without prefix (wsRoutes, consoleRoutes)
    const noPrefixRegex = /register\s*\(\s*(\w+)\s*,\s*\{(?:(?!prefix:)[^}])*\}/g
    while ((match = noPrefixRegex.exec(indexContent)) !== null) {
      if (!prefixMap[match[1]]) {
        prefixMap[match[1]] = ''
      }
    }
  } else {
    warnings.push('Could not read backend/src/index.ts')
  }

  // Step 2: Collect all route files — top-level and subdirectories (premium/, enterprise/)
  const routesDir = resolve(projectRoot, 'backend/src/routes')
  const topLevelFiles = await listFiles(routesDir, '.ts')

  const subDirs = await listDirs(routesDir)
  const subDirFiles: string[] = []
  for (const dir of subDirs) {
    const dirPath = resolve(routesDir, dir)
    const files = await listFiles(dirPath, '.ts')
    subDirFiles.push(...files)
  }

  const allRouteFiles = [...topLevelFiles, ...subDirFiles]

  // Step 3: For subdirectory index files, extract prefix mappings from register calls
  // Premium/enterprise index files register sub-routes with their own prefixes
  const subPrefixMap = new Map<string, string>()
  for (const filePath of subDirFiles) {
    const fileName = basename(filePath, '.ts')
    if (fileName !== 'index') continue

    const content = await safeReadFile(filePath)
    if (!content) continue

    // Match: await fastify.register(notificationConfigRoutes, { prefix: '/api/notifications/config', ... })
    const subRegex = /register\s*\(\s*(\w+)\s*,\s*\{[^}]*prefix:\s*['"]([^'"]+)['"]/g
    let match: RegExpExecArray | null
    while ((match = subRegex.exec(content)) !== null) {
      subPrefixMap.set(match[1], match[2])
    }
  }

  // Step 4: Read each route file and extract endpoints
  const endpoints: EndpointInfo[] = []

  for (const filePath of allRouteFiles) {
    const fileName = basename(filePath, '.ts')
    // Skip index files — they just aggregate sub-routes
    if (fileName === 'index') continue

    const content = await safeReadFile(filePath)
    if (!content) {
      const relPath = relative(resolve(projectRoot, 'backend/src'), filePath)
      warnings.push(`Could not read ${relPath}`)
      continue
    }

    // Compute the relative file path for display
    const relFile = relative(resolve(projectRoot), filePath)

    // Determine prefix for this file
    // First check sub-prefix map (from premium/enterprise index files)
    const exportedName = findExportedRouteName(content)
    let prefix = ''
    if (exportedName && subPrefixMap.has(exportedName)) {
      prefix = subPrefixMap.get(exportedName)!
    } else {
      // Fall back to top-level prefix map from index.ts
      const routeVarName = Object.keys(prefixMap).find(key =>
        key.toLowerCase().includes(fileName.replace(/-/g, ''))
      )
      prefix = routeVarName ? prefixMap[routeVarName] : ''
    }

    // Extract route definitions
    // Patterns: app.get('/path', ...) or fastify.get('/path', ...) or app.get<...>('/path', ...)
    const routeRegex = /(?:app|fastify)\.(get|post|put|delete|patch)\s*(?:<[^>]*>)?\s*\(\s*['"]([^'"]+)['"]/gi
    let match: RegExpExecArray | null
    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase()
      const subPath = match[2]
      const fullPath = prefix + subPath

      // Look at context around this route for auth/rate-limit
      const contextStart = Math.max(0, match.index - 50)
      const contextEnd = Math.min(content.length, match.index + 500)
      const context = content.slice(contextStart, contextEnd)

      // Check for requireRole
      let auth = 'required'
      const roleMatch = context.match(/requireRole\s*\(\s*([^)]+)\)/)
      if (roleMatch) {
        auth = roleMatch[1].replace(/['"]/g, '').trim()
      }

      // Check if this is a public route (ws, health, auth)
      if (fileName === 'health' || subPath.startsWith('/ws/')) {
        auth = 'public'
      }
      if (fileName === 'auth') {
        auth = 'public'
      }

      // Check for rate limit override
      let rateLimit: string | null = null
      const rateLimitMatch = context.match(/rateLimit\s*:\s*\{[^}]*max:\s*(\d+)[^}]*timeWindow:\s*['"]?(\d+)/s)
        ?? context.match(/config\s*:\s*\{[^}]*rateLimit\s*:\s*\{[^}]*max:\s*(\d+)/s)
      if (rateLimitMatch) {
        rateLimit = `${rateLimitMatch[1]}/min`
      }

      // Check for tier gate
      let tierGate: string | null = null
      const tierMatch = context.match(/requireTier\s*\(\s*\w+\s*,\s*['"](\w+)['"]/)
      if (tierMatch) {
        tierGate = `${tierMatch[1]}+`
      }

      endpoints.push({
        method,
        path: fullPath,
        auth,
        rateLimit,
        tierGate,
        file: relFile,
      })
    }
  }

  // Sort by path then method
  endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))

  return { endpoints, prefixMap, warnings }
}

/** Find the exported route variable name from a route file (e.g. `export const notificationConfigRoutes`) */
function findExportedRouteName(content: string): string | null {
  const match = content.match(/export\s+(?:const|function)\s+(\w+Routes?\w*)/)
  return match ? match[1] : null
}

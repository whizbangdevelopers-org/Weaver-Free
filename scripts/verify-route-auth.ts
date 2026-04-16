// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * verify-route-auth.ts — Static analysis script for backend route auth/tier/rate-limit compliance.
 *
 * Scans all backend route files and reports which routes have:
 *   - requireRole() in preHandler
 *   - requireTier() usage
 *   - createRateLimit() or inline rateLimit config
 *
 * Usage:  npx tsx scripts/verify-route-auth.ts
 * Exit:   0 = all compliant, 1 = unexpected missing auth found
 */

import { readFileSync, existsSync } from 'fs'
import { globSync } from 'glob'
import { resolve, relative } from 'path'
import { saveReport } from './lib/save-report.js'

// ---------------------------------------------------------------------------
// ANSI colors
// ---------------------------------------------------------------------------
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const RED = '\x1b[31m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RouteInfo {
  method: string
  localPath: string        // path as written in the route file (e.g. '/', '/:name/agent')
  fullPath: string         // resolved full API path (e.g. '/api/workload/:name/agent')
  file: string             // relative file path
  line: number             // line number in file
  requireRole: string | null   // e.g. "admin,operator" or null
  requireTier: string | null   // e.g. "fabrick" or null
  rateLimit: 'createRateLimit' | 'inline' | null
  isWebSocket: boolean
  hasManualAuth: boolean   // uses manual userId/tokenId check
  hasAclPreHandler: boolean // uses ACL preHandler
  hasTierHook: boolean     // file-level tier gate via addHook
}

// ---------------------------------------------------------------------------
// Known exemptions — routes that correctly bypass both global JWT and per-route auth
// ---------------------------------------------------------------------------
const EXEMPTIONS: Record<string, string> = {
  'WS /ws/status': 'verifyWsToken',
  'WS /ws/console/:vmName': 'verifyWsToken',
}

// ---------------------------------------------------------------------------
// Global JWT layer — parsed from backend/src/middleware/auth.ts
// All /api/* routes are JWT-authenticated except PUBLIC_ROUTES.
// These routes don't need per-route auth (any logged-in user can access).
// ---------------------------------------------------------------------------
const JWT_ONLY_ROUTES: Record<string, string> = {
  'GET /api/distros': 'public catalog read (global JWT optional)',
  'GET /api/distros/url-status': 'public catalog read (global JWT optional)',
  'GET /api/tags': 'read-only (any authenticated user)',
  'GET /api/notifications/web-push/vapid-public-key': 'public key endpoint (global JWT optional)',
  'GET /api/network/topology': 'read-only topology (any authenticated user)',
}

// ---------------------------------------------------------------------------
// Parse PUBLIC_ROUTES from auth middleware (source of truth for JWT bypass)
// ---------------------------------------------------------------------------
function parsePublicRoutes(): Set<string> {
  const authPath = resolve(ROOT, 'backend/src/middleware/auth.ts')
  if (!existsSync(authPath)) {
    console.error(`${RED}${BOLD}ERROR${RESET}: backend/src/middleware/auth.ts not found`)
    process.exit(1)
  }
  const content = readFileSync(authPath, 'utf-8')
  const match = content.match(/const PUBLIC_ROUTES\s*=\s*\[([\s\S]*?)\]/)
  if (!match) {
    console.error(`${RED}${BOLD}ERROR${RESET}: Could not parse PUBLIC_ROUTES from auth.ts`)
    process.exit(1)
  }
  const routes = new Set<string>()
  const routePattern = /['"`]([^'"`]+)['"`]/g
  let m: RegExpExecArray | null
  while ((m = routePattern.exec(match[1])) !== null) {
    routes.add(m[1].replace(/\/$/, '')) // normalize trailing slash
  }
  return routes
}

// ---------------------------------------------------------------------------
// Route prefix mapping — derived from backend/src/index.ts registrations
// ---------------------------------------------------------------------------
interface PrefixMapping {
  filePattern: string
  prefix: string
}

const PREFIX_MAPPINGS: PrefixMapping[] = [
  { filePattern: 'routes/auth.ts', prefix: '/api/auth' },
  { filePattern: 'routes/health.ts', prefix: '/api/health' },
  { filePattern: 'routes/workloads.ts', prefix: '/api/workload' },
  { filePattern: 'routes/agent.ts', prefix: '/api/workload' },
  { filePattern: 'routes/distros.ts', prefix: '/api/distros' },
  { filePattern: 'routes/audit.ts', prefix: '/api/audit' },
  { filePattern: 'routes/users.ts', prefix: '/api/users' },
  { filePattern: 'routes/quotas.ts', prefix: '/api/users' },
  { filePattern: 'routes/vm-acl.ts', prefix: '/api/users' },
  { filePattern: 'routes/tags.ts', prefix: '/api/tags' },
  { filePattern: 'routes/notifications.ts', prefix: '/api/notifications' },
  { filePattern: 'routes/network.ts', prefix: '/api/network' },
  { filePattern: 'routes/ws.ts', prefix: '' },
  { filePattern: 'routes/console.ts', prefix: '' },
  { filePattern: 'routes/host.ts', prefix: '/api/host' },
  { filePattern: 'routes/host-config.ts', prefix: '/api/config' },
  { filePattern: 'routes/organization.ts', prefix: '/api/organization' },
  // Weaver routes (registered under premiumRoutes with their own prefix)
  { filePattern: 'routes/weaver/notification-config.ts', prefix: '/api/notifications/config' },
  { filePattern: 'routes/weaver/web-push.ts', prefix: '/api/notifications/web-push' },
  { filePattern: 'routes/weaver/network-mgmt.ts', prefix: '/api/network' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const ROOT = resolve(import.meta.dirname, '..')

function getPrefix(filePath: string): string {
  const rel = relative(resolve(ROOT, 'backend/src'), filePath).replace(/\\/g, '/')
  for (const mapping of PREFIX_MAPPINGS) {
    if (rel === mapping.filePattern) return mapping.prefix
  }
  return '/api'
}

function resolveFullPath(prefix: string, localPath: string): string {
  if (localPath === '/') return prefix || '/'
  // Remove trailing slash from prefix and leading slash from local path
  const cleanPrefix = prefix.replace(/\/$/, '')
  const cleanLocal = localPath.startsWith('/') ? localPath : '/' + localPath
  return cleanPrefix + cleanLocal
}

// ---------------------------------------------------------------------------
// Parser — regex-based route extraction
// ---------------------------------------------------------------------------
function extractRoutes(filePath: string): RouteInfo[] {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const relFile = relative(ROOT, filePath)
  const prefix = getPrefix(filePath)
  const routes: RouteInfo[] = []

  // Detect file-level tier gate (addHook with requireTier)
  const hasTierHook = /addHook\s*\(\s*['"]preHandler['"][\s\S]*?requireTier/.test(content)

  // Match route registrations: fastify.get(, app.get(, fastify.post(, etc.
  // Also match fastify.get<{...}>( with generic parameters
  const routeRegex = /(?:fastify|app)\.(get|post|put|delete|patch)\s*(?:<[^>]*>)?\s*\(\s*['"`]([^'"`]+)['"`]/g
  let match: RegExpExecArray | null

  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase()
    const localPath = match[2]

    // Find the line number
    const beforeMatch = content.slice(0, match.index)
    const lineNumber = beforeMatch.split('\n').length

    // Determine if this is a WebSocket route
    const isWebSocket = localPath.startsWith('/ws/') || localPath.startsWith('ws/')

    // Extract the route block — find surrounding context (up to ~40 lines after match)
    const startLine = lineNumber - 1
    const endLine = Math.min(startLine + 40, lines.length)
    const blockLines = lines.slice(startLine, endLine)
    const block = blockLines.join('\n')

    // Check for requireRole in this route's preHandler or options
    // Supports both literal strings: requireRole('admin') and constants: requireRole(ROLES.ADMIN)
    let requireRole: string | null = null
    const roleLiteralMatch = block.match(/requireRole\s*\(\s*(['"`])(.+?)\1(?:\s*,\s*(['"`])(.+?)\3)?(?:\s*,\s*(['"`])(.+?)\5)?\s*\)/)
    const roleConstMatch = block.match(/requireRole\s*\(\s*(ROLES\.\w+(?:\s*,\s*ROLES\.\w+)*)\s*\)/)
    if (roleLiteralMatch) {
      const roles = [roleLiteralMatch[2], roleLiteralMatch[4], roleLiteralMatch[6]].filter(Boolean)
      requireRole = roles.join(',')
    } else if (roleConstMatch) {
      // Convert ROLES.ADMIN, ROLES.OPERATOR → admin, operator
      requireRole = roleConstMatch[1]
        .split(',')
        .map(r => r.trim().replace('ROLES.', '').toLowerCase())
        .join(',')
    }

    // Check for requireTier in this route's block
    // Supports both literal strings: requireTier(config, 'weaver') and constants: requireTier(config, TIERS.SOLO)
    let requireTier: string | null = null
    const tierLiteralMatch = block.match(/requireTier\s*\(\s*(?:\w+\s*,\s*)?['"`](\w+)['"`]\s*\)/)
    const tierConstMatch = block.match(/requireTier\s*\([^)]*TIERS\.(\w+)\s*\)/)
    if (tierLiteralMatch) {
      requireTier = tierLiteralMatch[1]
    } else if (tierConstMatch) {
      requireTier = tierConstMatch[1].toLowerCase()
    }

    // If file has a tier hook, apply it to all routes
    if (hasTierHook && !requireTier) {
      const fileTierLiteral = content.match(/requireTier\s*\(\s*(?:\w+\s*,\s*)?['"`](\w+)['"`]\s*\)/)
      const fileTierConst = content.match(/requireTier\s*\([^)]*TIERS\.(\w+)\s*\)/)
      if (fileTierLiteral) {
        requireTier = fileTierLiteral[1] + ' (hook)'
      } else if (fileTierConst) {
        requireTier = fileTierConst[1].toLowerCase() + ' (hook)'
      }
    }

    // Check for rate limiting
    let rateLimit: 'createRateLimit' | 'inline' | null = null
    if (block.includes('createRateLimit')) {
      rateLimit = 'createRateLimit'
    } else if (/config\s*:\s*\{[^}]*rateLimit/.test(block) || /rateLimit\s*:/.test(block)) {
      rateLimit = 'inline'
    }

    // Check for manual auth patterns (userId check in handler body)
    const hasManualAuth = /request\.userId/.test(block) && /reply\.status\s*\(\s*401\s*\)/.test(block)

    // Check for ACL preHandler
    const hasAclPreHandler = /aclPreHandler/.test(block) || /aclCheck/.test(block)

    const fullPath = resolveFullPath(prefix, localPath)

    routes.push({
      method: isWebSocket ? 'WS' : method,
      localPath,
      fullPath,
      file: relFile,
      line: lineNumber,
      requireRole,
      requireTier,
      rateLimit,
      isWebSocket,
      hasManualAuth,
      hasAclPreHandler,
      hasTierHook,
    })
  }

  return routes
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const routeGlobs = [
    'backend/src/routes/*.ts',
    'backend/src/routes/weaver/*.ts',
    'backend/src/routes/fabrick/*.ts',
  ]

  const files: string[] = []
  for (const pattern of routeGlobs) {
    const matches = globSync(pattern, { cwd: ROOT, absolute: true })
    files.push(...matches)
  }

  // Skip index.ts files (they just re-export/register, not define routes)
  const routeFiles = files.filter(f => !f.endsWith('/premium/index.ts') && !f.endsWith('/fabrick/index.ts'))

  const allRoutes: RouteInfo[] = []
  for (const file of routeFiles) {
    allRoutes.push(...extractRoutes(file))
  }

  // Parse global JWT public routes from auth middleware
  const publicRoutes = parsePublicRoutes()

  // Classify routes into four buckets:
  //   1. AUTHORIZED — per-route role/ACL/manual check (strongest)
  //   2. JWT_PROTECTED — global JWT middleware protects, no per-route role check
  //   3. PUBLIC_EXEMPT — in PUBLIC_ROUTES or EXEMPTIONS (intentionally open)
  //   4. MISSING_AUTH — not protected by any layer (real security gap)
  const authorized: RouteInfo[] = []
  const jwtProtected: { route: RouteInfo; reason: string }[] = []
  const publicExempt: { route: RouteInfo; reason: string }[] = []
  const issues: { route: RouteInfo; issue: string }[] = []
  let hasUnexpectedMissing = false

  for (const route of allRoutes) {
    const key = `${route.method} ${route.fullPath}`

    // Check manual exemptions (WebSocket routes with their own auth)
    const exemptionReason = EXEMPTIONS[key]
    if (exemptionReason) {
      publicExempt.push({ route, reason: exemptionReason })
      continue
    }

    // Check for inline rate limit (warning, not failure)
    if (route.rateLimit === 'inline') {
      issues.push({ route, issue: 'INLINE_RATELIMIT' })
    }

    // Does this route have per-route authorization?
    const hasPerRouteAuth = route.requireRole !== null
    const hasManualOrAcl = route.hasManualAuth || route.hasAclPreHandler

    if (hasPerRouteAuth || hasManualOrAcl) {
      authorized.push(route)
      continue
    }

    // No per-route auth — is it protected by global JWT middleware?
    const isApiRoute = route.fullPath.startsWith('/api')
    const isPublic = publicRoutes.has(route.fullPath)

    if (isPublic) {
      // Route is in PUBLIC_ROUTES — intentionally open
      publicExempt.push({ route, reason: 'global JWT public route' })
      continue
    }

    if (isApiRoute && !route.isWebSocket) {
      // Protected by global JWT but no per-route role check
      const jwtReason = JWT_ONLY_ROUTES[key] || 'global JWT (any authenticated user)'
      jwtProtected.push({ route, reason: jwtReason })
      continue
    }

    if (route.isWebSocket) {
      // WebSocket routes not in exemptions — flag
      issues.push({ route, issue: 'MISSING_AUTH' })
      hasUnexpectedMissing = true
      continue
    }

    // Non-API route with no auth — flag
    issues.push({ route, issue: 'MISSING_AUTH' })
    hasUnexpectedMissing = true
  }

  // ---------------------------------------------------------------------------
  // Output report
  // ---------------------------------------------------------------------------
  console.log('')
  console.log(`${BOLD}Route Auth Coverage Report${RESET}`)
  console.log('==========================')
  console.log(`Files scanned: ${routeFiles.length}`)
  console.log(`Routes found:  ${allRoutes.length}`)
  console.log(`Global JWT:    ${publicRoutes.size} public routes parsed from auth.ts`)
  console.log('')

  // Authorized routes (per-route role/ACL/manual check)
  console.log(`${GREEN}${BOLD}+ AUTHORIZED (${authorized.length}):${RESET}`)
  for (const route of authorized) {
    const method = route.method.padEnd(7)
    const path = route.fullPath.padEnd(50)
    const parts: string[] = []
    if (route.requireRole) parts.push(`requireRole: ${route.requireRole}`)
    if (route.requireTier) parts.push(`tier: ${route.requireTier}`)
    if (route.rateLimit) parts.push(`rateLimit: ${route.rateLimit}`)
    if (route.hasAclPreHandler) parts.push('ACL')
    if (route.hasManualAuth) parts.push('manual-auth')
    const detail = parts.length > 0 ? `${DIM}${parts.join('  ')}${RESET}` : ''
    console.log(`  ${GREEN}${method}${RESET} ${path} ${detail}`)
    console.log(`         ${DIM}${route.file}:${route.line}${RESET}`)
  }
  console.log('')

  // JWT-protected routes (global middleware, no per-route role check)
  console.log(`${CYAN}${BOLD}o JWT-PROTECTED (${jwtProtected.length}):${RESET}`)
  for (const { route, reason } of jwtProtected) {
    const method = route.method.padEnd(7)
    const path = route.fullPath.padEnd(50)
    const parts: string[] = []
    if (route.requireTier) parts.push(`tier: ${route.requireTier}`)
    if (route.rateLimit) parts.push(`rateLimit: ${route.rateLimit}`)
    const detail = parts.length > 0 ? `  ${DIM}${parts.join('  ')}${RESET}` : ''
    console.log(`  ${CYAN}${method}${RESET} ${path} ${DIM}-- ${reason}${RESET}${detail}`)
    console.log(`         ${DIM}${route.file}:${route.line}${RESET}`)
  }
  console.log('')

  // Public/exempt routes
  console.log(`${YELLOW}${BOLD}· PUBLIC/EXEMPT (${publicExempt.length}):${RESET}`)
  for (const { route, reason } of publicExempt) {
    const method = route.method.padEnd(7)
    const path = route.fullPath.padEnd(50)
    console.log(`  ${YELLOW}${method}${RESET} ${path} ${DIM}-- ${reason}${RESET}`)
    console.log(`         ${DIM}${route.file}:${route.line}${RESET}`)
  }
  console.log('')

  // Issues
  const missingAuthCount = issues.filter(i => i.issue === 'MISSING_AUTH').length
  const warningCount = issues.filter(i => i.issue === 'INLINE_RATELIMIT').length
  if (issues.length > 0) {
    const color = hasUnexpectedMissing ? RED : YELLOW
    console.log(`${color}${BOLD}! ISSUES (${issues.length}):${RESET}`)
    for (const { route, issue } of issues) {
      const method = route.method.padEnd(7)
      const path = route.fullPath
      if (issue === 'INLINE_RATELIMIT') {
        console.log(`  ${YELLOW}[INLINE_RATELIMIT]${RESET} ${method} ${path} -- uses inline config, should use createRateLimit()`)
      } else if (issue === 'MISSING_AUTH') {
        console.log(`  ${RED}[MISSING_AUTH]${RESET}     ${method} ${path} -- not protected by global JWT, role check, or ACL`)
      }
      console.log(`         ${DIM}${route.file}:${route.line}${RESET}`)
    }
    console.log('')
  }

  // Save report
  saveReport({
    reportName: 'route-auth',
    timestamp: new Date().toISOString(),
    durationMs: 0,
    result: hasUnexpectedMissing ? 'fail' : warningCount > 0 ? 'warn' : 'pass',
    summary: {
      filesScanned: routeFiles.length,
      totalRoutes: allRoutes.length,
      authorized: authorized.length,
      jwtProtected: jwtProtected.length,
      publicExempt: publicExempt.length,
      issues: issues.length,
      missingAuth: missingAuthCount,
      inlineRateLimit: warningCount,
    },
    data: {
      authorized: authorized.map(r => ({ method: r.method, path: r.fullPath, file: r.file, line: r.line, role: r.requireRole, tier: r.requireTier, rateLimit: r.rateLimit })),
      jwtProtected: jwtProtected.map(({ route: r, reason }) => ({ method: r.method, path: r.fullPath, file: r.file, line: r.line, reason })),
      publicExempt: publicExempt.map(({ route: r, reason }) => ({ method: r.method, path: r.fullPath, file: r.file, line: r.line, reason })),
      issues: issues.map(({ route: r, issue }) => ({ method: r.method, path: r.fullPath, file: r.file, line: r.line, issue })),
    },
  })

  // Summary
  console.log(`${BOLD}Summary:${RESET} ${authorized.length} authorized + ${jwtProtected.length} JWT-protected + ${publicExempt.length} public/exempt = ${authorized.length + jwtProtected.length + publicExempt.length} covered / ${allRoutes.length} total`)
  console.log('')
  if (hasUnexpectedMissing) {
    console.log(`${RED}${BOLD}FAIL${RESET}: ${missingAuthCount} route(s) missing auth protection`)
    process.exit(1)
  } else {
    if (warningCount > 0) {
      console.log(`${GREEN}${BOLD}RESULT: PASS${RESET} ${DIM}(${warningCount} inline rate-limit warning(s))${RESET}`)
    } else {
      console.log(`${GREEN}${BOLD}RESULT: PASS${RESET}`)
    }
  }
}

main()

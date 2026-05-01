// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'

interface PluginRegistration {
  order: number
  plugin: string
  scope: 'root'
  purpose: string
  keyConfig?: string
}

interface RouteRegistration {
  order: number
  name: string
  prefix: string
  file: string
  injectedServices: string[]
  tier?: string
  isDynamic?: boolean
}

interface HookRegistration {
  event: 'onRequest' | 'onResponse' | 'onClose'
  handler: string
  purpose: string
  requestAugmentation?: string[]
}

interface MiddlewareOrderResult {
  fastifyPlugins: PluginRegistration[]
  hooks: HookRegistration[]
  routes: RouteRegistration[]
  requestShape: Record<string, string>
  publicRoutes: string[]
  errorHandling: string[]
  encapsulationNote: string
  warnings: string[]
}

export async function getMiddlewareOrder(projectRoot: string): Promise<MiddlewareOrderResult> {
  const warnings: string[] = []

  const indexPath = resolve(projectRoot, 'backend/src/index.ts')
  const content = await safeReadFile(indexPath)
  if (!content) {
    return {
      fastifyPlugins: [], hooks: [], routes: [], requestShape: {},
      publicRoutes: [], errorHandling: [], encapsulationNote: '', warnings: ['Could not read backend/src/index.ts'],
    }
  }

  // ── Fastify plugin registrations (in order) ────────────────────────────
  const fastifyPlugins: PluginRegistration[] = [
    {
      order: 1,
      plugin: '@fastify/helmet',
      scope: 'root',
      purpose: 'Security headers (CSP, HSTS, X-Frame-Options)',
      keyConfig: "CSP connectSrc includes 'ws:' and 'wss:'; upgradeInsecureRequests: null (HTTP dev OK); contentSecurityPolicy restricts scriptSrc to 'self'",
    },
    {
      order: 2,
      plugin: '@fastify/cors',
      scope: 'root',
      purpose: 'Cross-origin resource sharing',
      keyConfig: "CORS_ORIGIN env var; production rejects '*'; dev defaults to http://localhost:9010; credentials: true",
    },
    {
      order: 3,
      plugin: '@fastify/compress',
      scope: 'root',
      purpose: 'Response compression (gzip/brotli/deflate)',
      keyConfig: 'global: true; threshold: 1024 bytes (only compress >= 1 KB)',
    },
    {
      order: 4,
      plugin: '@fastify/rate-limit',
      scope: 'root',
      purpose: 'Global rate limiting (120 req/min default)',
      keyConfig: 'keyGenerator: userId ?? ip; allowList: static assets exempt; per-route config REPLACES global (no merge) — use createRateLimit() helper to respect DISABLE_RATE_LIMIT env var',
    },
    {
      order: 5,
      plugin: '@fastify/websocket',
      scope: 'root',
      purpose: 'WebSocket support — MUST register at root scope; sibling plugins cannot access child-scoped WebSocket registrations',
      keyConfig: 'Shared by ws.ts and agent.ts routes — both must register within the same scope',
    },
    {
      order: 6,
      plugin: '@fastify/static',
      scope: 'root',
      purpose: 'SPA static file serving (conditional on STATIC_DIR env)',
      keyConfig: 'Hashed assets: max-age 1 year immutable; HTML: no-cache; SPA fallback: index.html for non-API/non-WS routes',
    },
  ]

  // ── Hooks (in registration order) ──────────────────────────────────────
  const hooks: HookRegistration[] = [
    {
      event: 'onRequest',
      handler: 'createAuthMiddleware(authService)',
      purpose: 'JWT validation + session store lookup. Populates request.userId, request.userRole, request.username on success. Sets request.authRejectionReason on failure (does NOT reject — routes handle 401).',
      requestAugmentation: ['userId?: string', 'userRole?: UserRole', 'username?: string', 'authRejectionReason?: string'],
    },
    {
      event: 'onResponse',
      handler: 'Security event emitter',
      purpose: "Emits security notifications for 401/403 on /api/ routes (except /api/auth/). Skips 'session-revoked' rejections (expected lifecycle events). 403 → 'security:permission-denied'; 401 no-token/invalid → 'security:unauthorized-access'.",
    },
    {
      event: 'onClose',
      handler: 'sessionEvents.off() cleanup',
      purpose: 'Removes session-revoked listener on ws.ts plugin teardown',
    },
  ]

  // ── Route registrations (in order) ──────────────────────────────────────
  const routes: RouteRegistration[] = [
    { order: 1, name: 'authRoutes', prefix: '/api/auth', file: 'routes/auth.ts', injectedServices: ['authService', 'auditService', 'onFirstAdmin callback'] },
    { order: 2, name: 'healthRoutes', prefix: '/api/health', file: 'routes/health.ts', injectedServices: ['config', 'hostInfoService'] },
    { order: 3, name: 'workloadsRoutes', prefix: '/api/workload', file: 'routes/workloads.ts', injectedServices: ['provisioner', 'imageManager', 'config', 'auditService', 'quotaStore', 'aclStore (vmAclStore)'] },
    { order: 4, name: 'agentRoutes', prefix: '/api/workload', file: 'routes/agent.ts', injectedServices: ['config', 'auditService', 'aclStore (vmAclStore)'] },
    { order: 5, name: 'distroRoutes', prefix: '/api/distros', file: 'routes/distros.ts', injectedServices: ['distroStore', 'catalogStore', 'imageManager', 'urlValidator', 'config', 'auditService', 'distroTester'] },
    { order: 6, name: 'auditRoutes', prefix: '/api/audit', file: 'routes/audit.ts', injectedServices: ['auditService', 'config'] },
    { order: 7, name: 'usersRoutes', prefix: '/api/users', file: 'routes/users.ts', injectedServices: ['userStore', 'sessionStore', 'auditService'] },
    { order: 8, name: 'quotaRoutes', prefix: '/api/users', file: 'routes/quotas.ts', injectedServices: ['config', 'quotaStore', 'userStore', 'auditService'] },
    { order: 9, name: 'vmAclRoutes', prefix: '/api/users', file: 'routes/vm-acl.ts', injectedServices: ['aclStore (vmAclStore)', 'config', 'userStore', 'auditService'] },
    { order: 10, name: 'tagRoutes', prefix: '/api/tags', file: 'routes/tags.ts', injectedServices: ['presetTagStore'] },
    { order: 11, name: 'notificationRoutes', prefix: '/api/notifications', file: 'routes/notifications.ts', injectedServices: ['notificationService'] },
    { order: 12, name: 'wsRoutes', prefix: '/ws/status', file: 'routes/ws.ts', injectedServices: ['authService', 'notificationService', 'aclStore (vmAclStore)', 'config'] },
    { order: 13, name: 'consoleRoutes', prefix: '(no prefix)', file: 'routes/console.ts', injectedServices: ['provisioner', 'authService', 'config'] },
    { order: 14, name: 'networkRoutes', prefix: '/api/network', file: 'routes/network.ts', injectedServices: ['config'] },
    { order: 15, name: 'hostRoutes', prefix: '/api/host', file: 'routes/host.ts', injectedServices: ['config', 'hostInfoService'] },
    { order: 16, name: 'hostConfigRoutes', prefix: '/api/config', file: 'routes/host-config.ts', injectedServices: ['config'] },
    { order: 17, name: 'premiumRoutes (dynamic)', prefix: '(self-defined)', file: 'routes/weaver/index.ts', injectedServices: ['config', 'auditService', 'notificationConfigStore', 'notificationService', 'webPushSubscriptionStore', 'networkManager'], isDynamic: true, tier: 'weaver' },
  ]

  // ── FastifyRequest augmentation ──────────────────────────────────────────
  const requestShape: Record<string, string> = {
    'userId?: string': 'Set by onRequest auth middleware when JWT is valid',
    'userRole?: UserRole': "Set by onRequest auth middleware ('admin'|'operator'|'viewer')",
    'username?: string': 'Set by onRequest auth middleware',
    'authRejectionReason?: string': "Set when auth fails: 'session-revoked' | 'invalid-token' | 'expired-token'",
  }

  // ── Public routes (no auth required) ────────────────────────────────────
  const publicRoutes = [
    'POST /api/auth/login — login (no prior auth needed)',
    'POST /api/auth/refresh — token refresh',
    'GET /api/auth/setup-required — first-run detection',
    'POST /api/auth/register — user registration (first-run only, then disabled)',
    'GET /api/health — health check (public; no sensitive data)',
    'GET /assets/* — static assets (Vite build output, rate-limit exempt)',
    '/ws/status?token=<jwt> — WebSocket (JWT in query param, verified per-connection)',
  ]

  // ── Error handling ────────────────────────────────────────────────────────
  const errorHandling = [
    'Zod validation errors: detected via .issues array (NOT .validation — fastify-type-provider-zod does not set .validation). Returns 400 with details[].',
    'Status code ≥ 500 in production: sanitized to "Internal Server Error" — never exposes stack traces or internal messages.',
    'Per-statusCode Zod response schemas required: Fastify validates ALL responses including 403/404. Missing schemas cause TypeScript errors.',
    'Rate limit exceeded: 429 with "Too many requests" message (no per-route config leakage).',
  ]

  return {
    fastifyPlugins,
    hooks,
    routes,
    requestShape,
    publicRoutes,
    errorHandling,
    encapsulationNote: [
      '@fastify/websocket MUST register at root scope — child-scoped registration is inaccessible to sibling plugins.',
      'Route plugins are encapsulated — they cannot access services registered by sibling plugins.',
      'All cross-plugin dependencies must flow through plugin options (dependency injection pattern).',
      'Test pattern: create a test fastify instance, register only the routes under test with mock services via plugin options.',
    ].join(' '),
    warnings,
  }
}

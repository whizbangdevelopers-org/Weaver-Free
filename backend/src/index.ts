// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import 'dotenv/config'
import { resolve, join } from 'path'
import Fastify, { type FastifyError } from 'fastify'
import compress from '@fastify/compress'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import cookie from '@fastify/cookie'
import websocket from '@fastify/websocket'
import { workloadsRoutes } from './routes/workloads.js'
import { healthRoutes } from './routes/health.js'
import { wsRoutes } from './routes/ws.js'
import { agentRoutes } from './routes/agent.js'
import { networkRoutes } from './routes/network.js'
import { distroRoutes } from './routes/distros.js'
import { consoleRoutes } from './routes/console.js'
import { createRegistry } from './storage/index.js'
import { setRegistry, setProvisioner, setConfig, startAutostartVms, scanMicrovms } from './services/microvm.js'
import { createImageManager } from './services/image-manager.js'
import { UrlValidationService } from './services/url-validator.js'
import type { Provisioner } from './services/provisioner-types.js'
import { DistroTester } from './services/distro-tester.js'
import { DistroStore } from './storage/distro-store.js'
import { CatalogStore } from './storage/catalog-store.js'
import { loadConfig } from './config.js'
import { TIERS, ROLES } from './constants/vocabularies.js'
import { NetworkStore } from './storage/network-store.js'
import { UserStore } from './storage/user-store.js'
import { MemorySessionStore } from './storage/memory-session-store.js'
import { SqliteSessionStore } from './storage/sqlite-session-store.js'
import { AuthService } from './services/auth.js'
import { authRoutes } from './routes/auth.js'
import { createAuthMiddleware } from './middleware/auth.js'
import type { SessionStore } from './storage/session-store.js'
import { AuditStore } from './storage/audit-store.js'
import { AuditService } from './services/audit.js'
import { auditRoutes } from './routes/audit.js'
import { NotificationStore } from './storage/notification-store.js'
import { NotificationService } from './services/notification.js'
import { createRateLimit } from './middleware/rate-limit.js'
import { NotificationConfigStore } from './storage/notification-config-store.js'
import { WebPushSubscriptionStore } from './storage/web-push-subscription-store.js'
import { notificationRoutes } from './routes/notifications.js'
import { usersRoutes } from './routes/users.js'
import { QuotaStore } from './storage/quota-store.js'
import { quotaRoutes } from './routes/quotas.js'
import { PresetTagStore } from './storage/preset-tag-store.js'
import { tagRoutes } from './routes/tags.js'
import { VmAclStore } from './storage/vm-acl-store.js'
import { vmAclRoutes } from './routes/vm-acl.js'
import { HostInfoService } from './services/host-info.js'
import { DoctorService } from './services/doctor.js'
import { hostRoutes } from './routes/host.js'
import { hostConfigRoutes } from './routes/host-config.js'
import { doctorRoutes } from './routes/doctor.js'
import { OrganizationStore } from './storage/organization-store.js'
import { organizationRoutes } from './routes/organization.js'
import { complianceRoutes } from './routes/compliance.js'
import { licenseRoutes } from './routes/license.js'
import { stripeWebhookRoutes } from './routes/stripe-webhook.js'
import { LicenseStore } from './storage/license-store.js'
import { initStripe, initProductMap } from './services/stripe.js'
import { EmailService } from './services/email.js'

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined
  },
  bodyLimit: 1_048_576, // 1 MB — explicit limit to prevent large payload abuse
}).withTypeProvider<ZodTypeProvider>()

// Declare custom request properties (required by Fastify 5 for property shape optimization)
fastify.decorateRequest('userId', undefined)
fastify.decorateRequest('userRole', undefined)
fastify.decorateRequest('username', undefined)
fastify.decorateRequest('tokenId', undefined)
fastify.decorateRequest('authRejectionReason', undefined)

// Set up Zod validation
fastify.setValidatorCompiler(validatorCompiler)
fastify.setSerializerCompiler(serializerCompiler)

// Register plugins
await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      imgSrc: ["'self'", 'data:'],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
})
const corsOriginEnv = process.env.CORS_ORIGIN
if (process.env.NODE_ENV === 'production' && corsOriginEnv === '*') {
  throw new Error('[cors] CORS_ORIGIN must not be "*" in production')
}
// Same-origin by default — NixOS serves frontend + backend on the same port. Set CORS_ORIGIN for reverse proxy setups.
const corsOrigin: string | boolean = corsOriginEnv ?? (process.env.NODE_ENV === 'production' ? false : 'http://localhost:9010')
await fastify.register(cors, {
  origin: corsOrigin,
  credentials: true
})

// Register cookie plugin (httpOnly token cookies)
await fastify.register(cookie)

// Register response compression (gzip/brotli/deflate)
await fastify.register(compress, {
  global: true,
  threshold: 1024, // Only compress responses >= 1 KB
  encodings: ['br', 'gzip', 'deflate'],
})

// Register rate limiting (global default: 120 req/min)
const globalLimit = createRateLimit(120)
await fastify.register(rateLimit, {
  global: true,
  max: globalLimit.max,
  timeWindow: globalLimit.timeWindow,
  keyGenerator: (request) => request.userId ?? request.ip,
  allowList: (request) => {
    // Don't rate-limit static assets — initial page load fetches many files at once
    const url = request.url
    return url.startsWith('/assets/') ||
      url.endsWith('.js') ||
      url.endsWith('.css') ||
      url.endsWith('.woff') ||
      url.endsWith('.woff2') ||
      url.endsWith('.png') ||
      url.endsWith('.ico') ||
      url.endsWith('.svg') ||
      url.endsWith('.webmanifest')
  },
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too many requests. Please try again later.',
  }),
})

// Register WebSocket plugin at root level (shared by ws + agent routes)
await fastify.register(websocket)

// Initialize VM registry
const vmRegistry = await createRegistry()
setRegistry(vmRegistry)

// Load config
const config = loadConfig()
setConfig(config)

// Initialize host info service
const hostInfoService = new HostInfoService({
  lscpuBin: config.lscpuBin,
  dfBin: config.dfBin,
  ipBin: config.ipBin,
  nixosVersionBin: config.nixosVersionBin,
  isDemo: config.tier === TIERS.DEMO,
})

const doctorService = new DoctorService({
  dashboardConfig: config,
  hostInfoService,
  isDemo: config.tier === TIERS.DEMO,
})

// Initialize provisioning services
const imageManager = createImageManager(config)

// Initialize curated distro catalog
const catalogDefaultPath = join(import.meta.dirname, '..', 'data', 'distro-catalog.json')
const catalogPersistPath = join(config.dataDir, 'distro-catalog.json')
const catalogStore = new CatalogStore(catalogPersistPath, catalogDefaultPath, config.distroCatalogUrl ?? undefined)
await catalogStore.init()
imageManager.setCatalogSources(catalogStore.toImageSources())

// Initialize custom distro store
const distroStore = new DistroStore(join(config.dataDir, 'custom-distros.json'))
await distroStore.init()

// Auto-remove custom distros that are now in the catalog
for (const name of distroStore.names()) {
  if (catalogStore.has(name)) {
    await distroStore.remove(name)
    fastify.log.warn(`Custom distro '${name}' removed — now provided by catalog`)
  }
}

imageManager.setCustomSources(distroStore.toImageSources())

// Initialize URL validation service (daily checks for broken image URLs)
const urlValidator = new UrlValidationService(
  join(config.dataDir, 'url-validation.json'),
  imageManager,
  [config.dataDir, config.microvmsDir ?? '/var/lib/microvms'],
)
await urlValidator.init()

let provisioner: Provisioner | null = null
if (config.provisioningEnabled) {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - tier-gated path sync-excluded from Free repo
    const { createProvisioner } = await import('./services/weaver/provisioner.js')
    provisioner = createProvisioner(vmRegistry, imageManager, config)
    setProvisioner(provisioner)
    fastify.log.info('VM provisioning enabled')
    await provisioner!.autostartCloudVms()
  } catch {
    fastify.log.info('Provisioning services not available')
  }
}

// Initialize network management (premium)
const networkStore = new NetworkStore(join(config.dataDir, 'network-config.json'))
await networkStore.init()
let networkManager: unknown = null
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - tier-gated path sync-excluded from Free repo
  const { NetworkManager } = await import('./services/weaver/network-manager.js')
  networkManager = new NetworkManager(networkStore, config)
} catch {
  fastify.log.info('Network management not available (premium feature)')
}

// Initialize authentication
const userStore = new UserStore(join(config.dataDir, 'users.json'))
await userStore.init()

let sessionStore: SessionStore
if (config.sessionStoreType === 'sqlite') {
  sessionStore = new SqliteSessionStore(join(config.dataDir, 'sessions.db'))
  fastify.log.info('Session store: SQLite')
} else {
  sessionStore = new MemorySessionStore()
  fastify.log.info('Session store: in-memory')
}

const authService = new AuthService(userStore, sessionStore, config.jwtSecret, join(config.dataDir, 'lockout.json'))
await authService.initLockout()
fastify.log.info(`Auth initialized (${userStore.count()} existing users)`)

// Initialize audit logging
const auditStore = new AuditStore(join(config.dataDir, 'audit-log.json'))
await auditStore.init()
const auditService = new AuditService(auditStore)
fastify.log.info('Audit logging initialized')

// Initialize quota store (fabrick)
const quotaStore = new QuotaStore(join(config.dataDir, 'quotas.json'))
await quotaStore.init()
fastify.log.info('Quota store initialized')

// Initialize preset tag store
const presetTagStore = new PresetTagStore(join(config.dataDir, 'preset-tags.json'))
await presetTagStore.init()
fastify.log.info('Preset tag store initialized')

// Initialize per-VM ACL store (fabrick)
const vmAclStore = new VmAclStore(join(config.dataDir, 'vm-acls.json'))
await vmAclStore.init()
fastify.log.info('VM ACL store initialized')

// Initialize organization identity store
const organizationStore = new OrganizationStore(join(config.dataDir, 'organization.json'))
await organizationStore.init()
fastify.log.info('Organization store initialized')

// Initialize notification service with dynamic channel config
const notificationStore = new NotificationStore(join(config.dataDir, 'notifications.json'))
await notificationStore.init()
const notificationConfigStore = new NotificationConfigStore(join(config.dataDir, 'notification-config.json'))
await notificationConfigStore.init()
const webPushSubscriptionStore = new WebPushSubscriptionStore(join(config.dataDir, 'web-push-subscriptions.json'))
await webPushSubscriptionStore.init()

// Seed ntfy channel from env vars (migration path from static config)
await notificationConfigStore.seedFromEnv(config.notify)

const notificationService = new NotificationService(notificationStore)
notificationService.setWebPushSubscriptionStore(webPushSubscriptionStore)
await notificationService.reloadAdapters(notificationConfigStore.getConfig())

const loadedAdapters = notificationService.getAdapters()
if (loadedAdapters.length > 0) {
  fastify.log.info(`Notification adapters loaded: ${loadedAdapters.map(a => a.name).join(', ')}`)
}
fastify.log.info('Notification service initialized')

// Helper: auto-provision example CirOS VM (fire-and-forget, idempotent)
const triggerExampleVm = provisioner
  ? () => {
      import('./services/example-vm.js').then(({ provisionExampleVm }) => {
        provisionExampleVm(vmRegistry, provisioner!, config, fastify.log).catch(err => {
          fastify.log.error(err, 'Example VM auto-provisioning failed')
        })
      })
    }
  : undefined

// Auto-create initial admin from env var (NixOS first-run support)
if (userStore.count() === 0) {
  let initialPassword = process.env.INITIAL_ADMIN_PASSWORD
  if (!initialPassword && process.env.INITIAL_ADMIN_PASSWORD_FILE) {
    try {
      const { readFileSync } = await import('node:fs')
      initialPassword = readFileSync(process.env.INITIAL_ADMIN_PASSWORD_FILE, 'utf-8').trim()
    } catch (_err) {
      fastify.log.warn('Failed to read INITIAL_ADMIN_PASSWORD_FILE')
    }
  }
  if (initialPassword) {
    try {
      await authService.register(ROLES.ADMIN, initialPassword, ROLES.ADMIN)
      fastify.log.info('Initial admin account created from INITIAL_ADMIN_PASSWORD')
      triggerExampleVm?.()
    } catch (err) {
      fastify.log.error(err, 'Failed to create initial admin account')
    }
  }
}

// Register auth middleware (runs before route handlers)
fastify.addHook('onRequest', createAuthMiddleware(authService))

// Wire security event emission from audit log
auditService.onEntry((entry) => {
  if (entry.action === 'user.login' && !entry.success) {
    notificationService.emitSecurityEvent('security:auth-failure', {
      username: entry.username,
      ip: entry.ip,
    }).catch(err => fastify.log.error(err, 'Failed to emit auth-failure notification'))
  }
})

// Emit security events for 401/403 on API routes.
// Session-revoked 401s (login kick, logout, role change) are expected lifecycle
// events — not security incidents — so they are silently skipped.
fastify.addHook('onResponse', async (request, reply) => {
  if (!request.url.startsWith('/api/')) return
  if (request.url.startsWith('/api/auth/')) return
  if (reply.statusCode !== 401 && reply.statusCode !== 403) return

  // Skip expected lifecycle events (session kick, logout, role change)
  if (request.authRejectionReason === 'session-revoked') return

  const details = {
    url: request.url,
    method: request.method,
    statusCode: reply.statusCode,
    ip: request.ip,
    username: request.username,
  }

  if (reply.statusCode === 403) {
    // Valid user, insufficient role — fabrick audit trail, not an attack
    notificationService.emitSecurityEvent('security:permission-denied', details)
      .catch(err => fastify.log.error(err, 'Failed to emit permission-denied notification'))
  } else {
    // 401 with no-token or invalid-token — genuinely suspicious
    notificationService.emitSecurityEvent('security:unauthorized-access', details)
      .catch(err => fastify.log.error(err, 'Failed to emit unauthorized-access notification'))
  }
})

// Register routes (auth routes are public, other routes protected by middleware)
await fastify.register(authRoutes, { prefix: '/api/auth', authService, auditService, onFirstAdmin: triggerExampleVm })
await fastify.register(healthRoutes, { prefix: '/api/health', config, hostInfoService, organizationStore })
await fastify.register(workloadsRoutes, { prefix: '/api/workload', provisioner, imageManager, config, auditService, quotaStore, aclStore: vmAclStore })
await fastify.register(agentRoutes, { prefix: '/api/workload', config, auditService, aclStore: vmAclStore })
const distroTester = provisioner ? new DistroTester(vmRegistry, provisioner, config) : undefined
await fastify.register(distroRoutes, { prefix: '/api/distros', distroStore, catalogStore, imageManager, urlValidator, config, auditService, distroTester })
await fastify.register(auditRoutes, { prefix: '/api/audit', auditService, config })
await fastify.register(usersRoutes, { prefix: '/api/users', userStore, sessionStore, auditService })
await fastify.register(quotaRoutes, { prefix: '/api/users', config, quotaStore, userStore, auditService })
await fastify.register(vmAclRoutes, { prefix: '/api/users', aclStore: vmAclStore, config, userStore, auditService })
await fastify.register(tagRoutes, { prefix: '/api/tags', presetTagStore })
await fastify.register(notificationRoutes, { prefix: '/api/notifications', notificationService })
await fastify.register(wsRoutes, { authService, notificationService, aclStore: vmAclStore, config })
await fastify.register(consoleRoutes, { provisioner, authService, config })
await fastify.register(networkRoutes, { prefix: '/api/network', config })
await fastify.register(hostRoutes, { prefix: '/api/host', config, hostInfoService })
await fastify.register(doctorRoutes, { prefix: '/api/system/doctor', doctorService })
await fastify.register(hostConfigRoutes, { prefix: '/api/config', config })
await fastify.register(organizationRoutes, { prefix: '/api/organization', organizationStore, config })

// Compliance PDF export (all tiers)
const docsRoot = process.env.DOCS_ROOT ?? join(import.meta.dirname, '..', '..', 'docs')
const appVersion = process.env.npm_package_version ?? '0.1.0'
await fastify.register(complianceRoutes, { prefix: '/api/compliance', config, docsRoot, appVersion })

// Initialize license store
const licenseStore = new LicenseStore(join(config.dataDir, 'licenses.json'))
await licenseStore.init()
fastify.log.info('License store initialized')

// Initialize Stripe (if configured)
if (config.stripeSecretKey) {
  initStripe(config.stripeSecretKey)
  initProductMap(config.stripeProducts)
  fastify.log.info('Stripe initialized')

  // License + checkout routes (authenticated — users create checkout sessions)
  await fastify.register(licenseRoutes, {
    prefix: '/api/license',
    config,
    hmacSecret: config.jwtSecret, // Reuse JWT secret for HMAC in dev; LICENSE_HMAC_SECRET in prod
    licenseStore,
    priceMap: config.stripePrices,
    siteUrl: config.siteUrl,
  })

  // Stripe webhook (unauthenticated — signature-verified by Stripe)
  if (config.stripeWebhookSecret) {
    let emailService: EmailService | undefined
    if (config.smtp) {
      emailService = new EmailService(config.smtp)
      fastify.log.info('Email service configured (SMTP: %s:%d)', config.smtp.host, config.smtp.port)
    } else {
      fastify.log.info('Email service not configured (SMTP_HOST not set) — license emails disabled')
    }

    await fastify.register(stripeWebhookRoutes, {
      prefix: '/api/stripe/webhook',
      webhookSecret: config.stripeWebhookSecret,
      hmacSecret: config.jwtSecret,
      licenseStore,
      auditService,
      emailService,
      siteUrl: config.siteUrl,
    })
    fastify.log.info('Stripe webhook route registered')
  }
} else {
  fastify.log.info('Stripe not configured (STRIPE_SECRET_KEY not set) — commerce routes disabled')
}

// Premium routes (dynamically loaded — absent in free tier)
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - tier-gated path sync-excluded from Free repo
  const { premiumRoutes } = await import('./routes/weaver/index.js')
  await fastify.register(premiumRoutes, {
    config, auditService,
    notificationConfigStore, notificationService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- networkManager typed as unknown from dynamic import
    webPushSubscriptionStore, networkManager: networkManager as any,
  })
  fastify.log.info('Premium routes loaded')
} catch {
  fastify.log.info('Premium routes not available (free tier)')
}

// Serve frontend SPA if STATIC_DIR is set
const staticDir = process.env.STATIC_DIR
if (staticDir) {
  await fastify.register(fastifyStatic, {
    root: resolve(staticDir),
    // Cache-Control for hashed assets (Vite outputs to assets/ with content hashes)
    setHeaders(res, filePath) {
      if (/[/\\]assets[/\\]/.test(filePath) && /\.[a-f0-9]{8,}\.\w+$/.test(filePath)) {
        // Immutable hashed files: cache for 1 year
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      } else if (filePath.endsWith('.html')) {
        // HTML files (index.html, etc.): always revalidate
        res.setHeader('Cache-Control', 'no-cache')
      } else if (/\.(json|webmanifest)$/.test(filePath)) {
        // Manifests and config: short cache with revalidation
        res.setHeader('Cache-Control', 'public, max-age=600, must-revalidate')
      } else {
        // Other static files (icons, fonts): moderate cache
        res.setHeader('Cache-Control', 'public, max-age=86400')
      }
    },
  })
  // SPA fallback: serve index.html for non-API routes
  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/') || request.url.startsWith('/ws/')) {
      reply.status(404).send({ error: 'Not Found' })
    } else {
      reply.header('Cache-Control', 'no-cache')
      reply.sendFile('index.html')
    }
  })
}

// Error handler
fastify.setErrorHandler((error: FastifyError, request, reply) => {
  fastify.log.error(error)

  // Zod validation errors — fastify-type-provider-zod v4+ populates error.validation
  // with ZodFastifySchemaValidationError objects (each has .message and .params.issue).
  if (error.validation) {
    const messages = error.validation
      .map((v: { message?: string }) => v.message ?? '')
      .filter(Boolean)
    return reply.status(400).send({
      error: 'Validation failed',
      details: messages.length > 0 ? messages : ['Invalid request data'],
    })
  }

  // Default error — suppress internal details for 500s in production
  const statusCode = error.statusCode || 500
  const isProduction = process.env.NODE_ENV === 'production'
  const message = statusCode >= 500 && isProduction
    ? 'Internal Server Error'
    : (error.message || 'Internal Server Error')
  reply.status(statusCode).send({ error: message })
})

// Check if a port is already in use before attempting to listen
async function checkPortAvailable(port: number, host: string): Promise<void> {
  const { createServer } = await import('node:net')
  return new Promise((resolve, reject) => {
    const tester = createServer()
    tester.once('error', (err: NodeJS.ErrnoException) => {
      tester.close()
      if (err.code === 'EADDRINUSE') {
        reject(new Error(
          `Port ${port} is already in use.\n` +
          `  Common causes:\n` +
          `    - NixOS systemd service: sudo systemctl stop weaver\n` +
          `    - Another dev server: lsof -ti:${port} | xargs kill\n` +
          `  Port assignments:\n` +
          `    3100 = NixOS service (production)\n` +
          `    3110 = dev backend (npm run dev:backend)\n` +
          `    3120 = e2e tests\n`
        ))
      } else {
        reject(err)
      }
    })
    tester.listen(port, host, () => {
      tester.close(() => resolve())
    })
  })
}

// SIGHUP handler: reload user store from disk (supports external password resets)
process.on('SIGHUP', () => {
  fastify.log.info('SIGHUP received — reloading user store from disk')
  userStore.reload()
    .then(({ count }) => {
      fastify.log.info(`User store reloaded (${count} users)`)
    })
    .catch(err => {
      fastify.log.error(err, 'Failed to reload user store on SIGHUP')
    })
})

// Start server
async function start() {
  try {
    const port = Number(process.env.PORT) || 3110
    const host = process.env.HOST || '0.0.0.0'

    await checkPortAvailable(port, host)
    await fastify.listen({ port, host })

    // Start VMs with autostart=true (non-blocking, after server is ready)
    startAutostartVms(fastify.log).catch(err => {
      fastify.log.error(err, 'Autostart VMs failed')
    })

    // Schedule URL validation: first check 30s after startup, then every 24 hours
    setTimeout(() => {
      urlValidator.validateAll().then(data => {
        const valid = Object.values(data.results).filter(r => r.status === 'valid').length
        const invalid = Object.values(data.results).filter(r => r.status === 'invalid').length
        fastify.log.info(`URL validation complete: ${valid} valid, ${invalid} invalid`)
      }).catch(err => {
        fastify.log.error(err, 'URL validation failed')
      })
    }, 30_000)
    setInterval(() => {
      urlValidator.validateAll().catch(err => {
        fastify.log.error(err, 'Scheduled URL validation failed')
      })
    }, 24 * 60 * 60 * 1000)

    // Auto-discover microvm@* services on first production run (empty registry)
    if (process.env.NODE_ENV === 'production') {
      const allVms = await vmRegistry.getAll()
      if (Object.keys(allVms).length === 0) {
        scanMicrovms().then(result => {
          if (result.added.length > 0) {
            fastify.log.info(`Auto-discovered ${result.added.length} VM(s): ${result.added.join(', ')}`)
          } else {
            fastify.log.info('No microvm@* services found on this host')
          }
        }).catch(err => {
          fastify.log.error(err, 'Auto-scan for VMs failed')
        })
      }
    }
  } catch (error) {
    fastify.log.error(error)
    process.exit(1)
  }
}

start()

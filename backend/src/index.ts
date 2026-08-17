// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import 'dotenv/config'
import { resolve, join } from 'path'
import { readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID, createPrivateKey, type KeyObject } from 'node:crypto'
import { readFileSync } from 'node:fs'

const execFileAsync = promisify(execFile)
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
import { metricsRoutes } from './routes/metrics.js'
import { wsRoutes } from './routes/ws.js'
import { agentRoutes } from './routes/agent.js'
import { networkRoutes } from './routes/network.js'
import { distroRoutes } from './routes/distros.js'
import { consoleRoutes } from './routes/console.js'
import { dnsRoutes } from './routes/dns.js'
import { createRegistry } from './storage/index.js'
import { setRegistry, setProvisioner, setConfig, startAutostartVms, scanMicrovms, getWorkloadDefinitions } from './services/microvm.js'
import { SAMPLE_INTERVAL_MS } from './services/metrics.js'
import { PromqlMetricsSource, httpRangeQuery } from './services/promql.js'
import { DnsZoneWriter, retireZone } from './services/dns-writer.js'
import {
  resolveLicense, daysUntil, decideWarning, sentFor, createLicenseApplier, dnsPublishable,
  FREE_SNAPSHOT, EMPTY_WARNING_STATE, DEFAULT_POLL_INTERVAL_MS,
  type WarningState,
} from './services/license-watcher.js'
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
  } catch (err) {
    // services/weaver/ (provisioner) is BSL and sync-excluded from the AGPL Free mirror, so on a
    // Free build this import is EXPECTED to be absent. Distinguish that from a genuine load failure
    // — the tier is set by the license, never by whether this module loaded. See G-backend-2026-06-14-01KYSBXCJ6839ZDAHSMJ97EQB1.
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
      // Free/AGPL build has no provisioner. If the license nonetheless permits provisioning, the
      // operator deployed the wrong artifact for the tier — surface it loudly, else the resulting
      // create-time 400s are baffling (this is what bit F1, 2026-06-14). A keyless install is Free
      // tier and provisions nothing, so no warning there.
      if (config.tier !== TIERS.FREE && config.tier !== TIERS.DEMO) {
        fastify.log.warn(`Provisioning unavailable: services/weaver absent (Free/AGPL build) but license tier '${config.tier}' permits provisioning — deploy the BSL (Solo+) artifact to enable cloud-vm creation.`)
      } else {
        fastify.log.info('VM provisioning not available (Free build — services/weaver absent)')
      }
    } else {
      fastify.log.error({ err }, 'Provisioner present but FAILED to load — provisioning unavailable')
    }
  }
}

// Initialize network management (weaver tier)
const networkStore = new NetworkStore(join(config.dataDir, 'network-config.json'))
await networkStore.init()
let networkManager: unknown = null
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - tier-gated path sync-excluded from Free repo
  const { NetworkManager } = await import('./services/weaver/network-manager.js')
  networkManager = new NetworkManager(networkStore, config)
} catch (err) {
  // services/weaver/ (network-manager) is BSL and sync-excluded from the Free mirror — absent on a
  // Free build is EXPECTED. Distinguish that from a real load failure. See G-backend-2026-06-14-01KYSBXCJ6839ZDAHSMJ97EQB1.
  const code = (err as NodeJS.ErrnoException)?.code
  if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
    fastify.log.info('Network management not available (Free build — services/weaver absent)')
  } else {
    fastify.log.error({ err }, 'Network manager present but FAILED to load — network management unavailable')
  }
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

// Helper: auto-provision example CirrOS VM (fire-and-forget, idempotent)
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

// Prometheus scrape endpoint. Mounted at the conventional `/metrics` (NOT under /api) because
// that is where every scrape config looks by default, and a non-standard path is a configuration
// step that gets skipped. Loopback-only — see routes/metrics.ts for why that is the whole reason
// it can be unauthenticated.
//
// Reads cgroups at scrape time through its own reader; the ring buffer that serves the existing
// metrics API is untouched and still running on its own 30-second clock. Two independent readers
// of the same files, which is what lets the exporter land before anything migrates onto it.
await fastify.register(metricsRoutes, {
  prefix: '/metrics',
  read: async (path: string) => {
    try {
      return await readFile(path, 'utf-8')
    } catch {
      return null
    }
  },
  listWorkloads: async () => {
    const defs = await getWorkloadDefinitions()
    return Object.values(defs).map(d => ({ name: d.name, vcpu: d.vcpu }))
  },
  getHost: async () => {
    const basic = await hostInfoService.getBasicInfo()
    return {
      loadAvg1: basic.liveMetrics?.loadAvg1,
      loadAvg5: basic.liveMetrics?.loadAvg5,
      loadAvg15: basic.liveMetrics?.loadAvg15,
      totalMemBytes: basic.totalMemMb * 1024 * 1024,
      freeMemBytes: basic.liveMetrics?.freeMemMb === undefined
        ? undefined
        : basic.liveMetrics.freeMemMb * 1024 * 1024,
      cpuCount: basic.cpuCount,
    }
  },
})
// The in-process MetricsCollector was constructed here until the Prometheus migration retired it.
// Prometheus scrapes /metrics and holds the history; nothing samples cgroups on a timer any more.
// See services/metrics.ts for why the buffer went.

/**
 * DNS Core — the `.vm.internal` auto-zone.
 *
 * Solo+ only, so the writer is not constructed below that tier: there is no zone to publish and a
 * writer that never writes is a timer burning wakeups on a Free host. What a Free host DOES do is
 * withdraw a zone an earlier licence left behind — see the retirement below.
 *
 * The reload is a placeholder until the NixOS module lands — it needs a `services.weaver.dns`
 * option to own the dnsmasq unit, and that half is only meaningful once verified on a real NixOS
 * host. Until then the zone file is written and the reload is a no-op, which is honest: the
 * generated file is correct and inert rather than half-applied.
 */
const dnsHostsPath = join(config.dataDir, 'dns-hosts')

const dnsDeps = {
  writeFile: async (path: string, content: string) => {
    await writeFile(path, content, 'utf-8')
  },
  reload: async () => {
    // Only when the NixOS module told us how. An empty command means DNS Core is not
    // deployed here, and the zone file is written-but-unserved — which is a correct,
    // inert state rather than a half-applied one. Never guess at a systemctl invocation:
    // signalling a unit this build does not manage would either fail on every host or
    // reload someone else's dnsmasq.
    const command = config.dnsReloadCommand
    if (!command) return
    const [bin, ...args] = command.split(/\s+/)
    if (!bin) return
    // execFile with an argument array, never a shell — the value crosses a config boundary.
    await execFileAsync(config.sudoBin, [bin, ...args])
  },
}

/**
 * DNS Core is Solo+, so whether this host publishes a zone follows the tier — and the tier can
 * now change while the process runs. Publishing is therefore a state to enter and
 * leave, not a decision taken once at start-up.
 *
 * `weaver-dnsmasq` is gated on `services.weaver.dns.enable`, the OPTION rather than the tier, so
 * on a host where DNS Core is deployed the resolver keeps running and keeps answering from the
 * last file Weaver wrote. Records left behind by a lapsed licence therefore outlive it
 * indefinitely, frozen at the moment it lapsed and drifting from the registry thereafter — which
 * is why leaving is an explicit withdrawal and not simply "stop writing".
 */
let dnsWriter: DnsZoneWriter | null = null
let dnsTimer: ReturnType<typeof setInterval> | null = null

const dnsRetireDeps = {
  ...dnsDeps,
  readFile: async (path: string): Promise<string | null> => {
    try {
      return await readFile(path, 'utf-8')
    } catch {
      return null
    }
  },
}

/**
 * Begin (or resume) publishing.
 *
 * Idempotent, because it is called both at start-up and on every upward tier transition, and a
 * second writer would mean two timers racing to advance the same zone serial.
 */
function startDnsPublishing(): void {
  if (dnsWriter) return
  dnsWriter = new DnsZoneWriter(dnsDeps, { hostsPath: dnsHostsPath, domain: config.dnsDomain })

  // Only while there IS a writer: below Solo there is no zone to publish, and a timer that wakes
  // every 30 seconds to do nothing is real cost on a Free host.
  dnsTimer = setInterval(() => {
    void (async () => {
      try {
        const defs = await getWorkloadDefinitions()
        // The writer no-ops when the zone is unchanged, so a quiet host costs one comparison.
        await dnsWriter?.sync(Object.values(defs).map(d => ({ name: d.name, ip: d.ip })))
      } catch (err) {
        fastify.log.error({ err }, 'DNS zone sync failed')
      }
    })()
  }, SAMPLE_INTERVAL_MS)
  // Never hold the process open for a housekeeping timer.
  dnsTimer.unref?.()
}

/**
 * Stop publishing and withdraw whatever is already published.
 *
 * Safe to call when nothing was ever published: `retireZone` inspects first and reports
 * `retired: false` for an absent file or one already carrying the banner, so an ordinary Free
 * host neither creates a file it never had nor signals the resolver on every boot.
 */
async function stopDnsPublishing(): Promise<void> {
  if (dnsTimer) {
    clearInterval(dnsTimer)
    dnsTimer = null
  }
  dnsWriter = null

  try {
    const result = await retireZone(dnsRetireDeps, dnsHostsPath)
    if (result.retired) {
      fastify.log.warn(
        { hostsPath: dnsHostsPath, reloaded: result.reloaded },
        'dns: withdrew a published zone — DNS Core requires Solo or above and this host has no ' +
          'licence for it. The file is emptied, not removed, because dnsmasq refuses to start ' +
          'without it. Install a licence and the zone republishes on the next sync.',
      )
    }
  } catch (err) {
    fastify.log.error({ err }, 'dns: failed to withdraw a published zone')
  }
}

if (dnsPublishable(config.tier)) {
  startDnsPublishing()
} else {
  void stopDnsPublishing()
}

/**
 * Licence re-read.
 *
 * The tier used to be resolved once, at start-up, and every gate in the backend reads that one
 * value — so a renewal key could not take effect without a restart, and an expiry that elapsed
 * mid-run left the process serving a tier the customer no longer had. Both are the same defect
 * seen from opposite ends, and both are fixed by re-parsing the key on a timer.
 *
 * Nothing to do when the tier did not come from a file: `LICENSE_KEY` and `PREMIUM_ENABLED` are
 * process environment, which cannot change under a running process.
 */
const warningStatePath = join(config.dataDir, 'license-warnings.json')

async function readWarningState(): Promise<WarningState> {
  try {
    return JSON.parse(await readFile(warningStatePath, 'utf-8')) as WarningState
  } catch {
    return EMPTY_WARNING_STATE
  }
}

async function writeWarningState(state: WarningState): Promise<void> {
  try {
    await writeFile(warningStatePath, JSON.stringify(state, null, 2), 'utf-8')
  } catch (err) {
    // A warning we cannot record is still a warning worth sending — the cost of failing to
    // persist is a duplicate after a restart, which is strictly better than staying silent.
    fastify.log.error({ err, path: warningStatePath }, 'license: failed to persist warning state')
  }
}

/**
 * Apply a freshly-resolved licence to the running process.
 *
 * The behaviour lives in `createLicenseApplier` so the lapse transition can be driven in a test —
 * `index.ts` starts a server on import, so anything defined here is reachable only by running one.
 * What stays here is the wiring: the live config object, the logger, and the two DNS controls.
 */
const applyLicense = createLicenseApplier({
  config,
  log: { warn: (obj, msg) => fastify.log.warn(obj, msg) },
  audit: entry => { void auditService.log(entry) },
  notify: async n => {
    await notificationService.emitEvent({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...n,
    })
  },
  dns: { start: startDnsPublishing, stop: stopDnsPublishing },
})

/** Raise the tightest expiry warning that is newly due, at most one per check. */
async function checkExpiryWarnings(now: Date): Promise<void> {
  const expiry = config.licenseExpiry
  if (!expiry) return

  const state = await readWarningState()
  const decision = decideWarning(daysUntil(expiry, now), sentFor(state, expiry))
  if (decision.send === null) return

  const days = decision.send
  await notificationService.emitEvent({
    id: randomUUID(),
    timestamp: now.toISOString(),
    event: 'license:expiring',
    // The last week is not the same news as the first month, and an admin who filters on
    // severity should still see the ones that are about to cost them their tier.
    severity: days <= 7 ? 'error' : 'info',
    message: days === 1
      ? 'License expires tomorrow — renew to keep your tier'
      : `License expires in ${days} days — renew to keep your tier`,
    details: { daysRemaining: days, expiresAt: expiry.toISOString(), tier: config.tier },
  })

  await writeWarningState({ expiry: expiry.toISOString(), sent: decision.sent })
}

if (config.licenseKeyFile) {
  const keyFile = config.licenseKeyFile

  const pollLicense = async (): Promise<void> => {
    const now = new Date()
    let read: { content: string | null; error?: string }
    try {
      read = { content: await readFile(keyFile, 'utf-8') }
    } catch (err) {
      read = (err as NodeJS.ErrnoException)?.code === 'ENOENT'
        ? { content: null }
        : { content: null, error: err instanceof Error ? err.message : 'unreadable' }
    }

    const outcome = resolveLicense(read, now)
    if (outcome.kind === 'unreadable') {
      // Hold the current tier. A present-but-unusable file is a mid-write far more often than a
      // real downgrade, and this poll can land inside the very push it is waiting for.
      fastify.log.warn({ path: keyFile, reason: outcome.reason }, 'license: key file unusable — holding current tier')
      return
    }

    await applyLicense(outcome.kind === 'absent' ? FREE_SNAPSHOT : outcome.snapshot)
    await checkExpiryWarnings(now)
  }

  // Once at start-up too: the expiry countdown must not wait a full interval to say a licence
  // expires tomorrow, and a host that was off across a threshold has to catch up on boot.
  void pollLicense().catch(err => fastify.log.error({ err }, 'license: initial poll failed'))

  const licenseTimer = setInterval(() => {
    void pollLicense().catch(err => fastify.log.error({ err }, 'license: poll failed'))
  }, DEFAULT_POLL_INTERVAL_MS)
  licenseTimer.unref?.()

  fastify.log.info(
    { path: keyFile, intervalMs: DEFAULT_POLL_INTERVAL_MS },
    'license: watching key file — a renewal takes effect without a restart',
  )
}

/**
 * PromQL read path — the ONLY source of metric history since phase 4.
 *
 * Constructed only when the NixOS module told us where Prometheus lives. When it is null there is
 * no history at all: the ring buffer that used to answer in that case is gone, so the endpoint
 * returns an empty series and says so via `historySource`.
 *
 * That is a deliberate consequence of `metrics.enable`, not a degradation to paper over. The
 * option defaults to TRUE on every tier including Free, precisely so the ordinary install has
 * graphs; switching it off is an operator choosing a constrained host over charts. Keeping the
 * buffer as a silent fallback would have committed the product to two metrics backends forever,
 * which is the alternative the migration considered and rejected before any code was written.
 */
const promqlSource = config.prometheusUrl
  ? new PromqlMetricsSource(httpRangeQuery(config.prometheusUrl))
  : null

if (promqlSource) {
  fastify.log.info({ url: config.prometheusUrl }, 'metrics: serving history from Prometheus')
} else {
  // WARN, not info, and at startup rather than per request: this is the one moment an operator is
  // watching, and the symptom otherwise is a permanently empty chart with no stated cause.
  fastify.log.warn(
    'metrics: PROMETHEUS_URL is unset — no metric history will be served. ' +
      'Set services.weaver.metrics.enable = true (the default) to restore charts.',
  )
}

// The DNS zone-sync timer moved into `startDnsPublishing()` above, alongside the writer it
// drives. It used to ride the metrics collector's 30-second tick — "rather than adding a second
// timer", true while that timer had to exist anyway — and then owned its own interval here. Both
// forms decided ONCE whether to run; the timer now starts and stops with the licence.

// networkManager is the IP allocator the clone route uses when the caller omits an address. It is
// null on a Free build (services/weaver is sync-excluded) — the route degrades to requiring an
// explicit IP rather than failing, and clone is Solo-gated anyway so the null path is unreachable
// in practice. Cast for the same reason as the ws registration below: the dynamic import above
// types it `unknown`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- networkManager typed as unknown from dynamic import
await fastify.register(workloadsRoutes, { prefix: '/api/workload', provisioner, imageManager, config, auditService, quotaStore, aclStore: vmAclStore, networkManager: networkManager as any, promqlSource })
await fastify.register(agentRoutes, { prefix: '/api/workload', config, auditService, aclStore: vmAclStore })
await fastify.register(dnsRoutes, { prefix: '/api/dns', config, getZone: () => dnsWriter?.currentZone ?? null })
const distroTester = provisioner ? new DistroTester(vmRegistry, provisioner, config) : undefined
await fastify.register(distroRoutes, { prefix: '/api/distros', distroStore, catalogStore, imageManager, urlValidator, config, auditService, distroTester })
await fastify.register(auditRoutes, { prefix: '/api/audit', auditService, config })
// /api/engram/* removed 2026-07-20: Engram monitoring + host admin migrated to the
// engram-query service (engram-ui reads/writes it directly). Weaver no longer proxies the store.
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

  /**
   * Load the hub's Ed25519 private signing key, if this deployment is an issuer.
   *
   * Returns null when unset or unusable — never a fallback key, never a generated one. A
   * generated key would sign licences nothing on earth can verify (the accepted public keys are
   * compiled in), so it would look like issuance working while producing dead credentials.
   * A missing config must fail loudly; a silent fallback to a baked-in default is how a
   * placeholder credential ends up in production.
   */
  function loadLicenseSigningKey(log: typeof fastify.log): KeyObject | null {
    const path = process.env.LICENSE_SIGNING_KEY_FILE
    if (!path) return null
    try {
      return createPrivateKey(readFileSync(path, 'utf-8'))
    } catch (err) {
      log.error(
        { path, err: err instanceof Error ? err.message : String(err) },
        'license: LICENSE_SIGNING_KEY_FILE set but unusable — issuance stays disabled',
      )
      return null
    }
  }

  // License + checkout routes (authenticated — users create checkout sessions).
  // The `hmacSecret: config.jwtSecret` option is gone: these routes verify keys, and
  // verification material now comes from the build, not from a caller-supplied value.
  await fastify.register(licenseRoutes, {
    prefix: '/api/license',
    config,
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

    // The issuer needs the hub's Ed25519 PRIVATE key. This slot used to read
    // `hmacSecret: config.jwtSecret` — the webhook minted licence keys with the JWT secret while
    // every host validated against `LICENSE_HMAC_SECRET`, two unrelated credentials with different
    // lifecycles, so a Stripe-issued key could not have verified anywhere. Both halves are now
    // gone.
    //
    // Reading a private key from a path is safe here in a way the old symmetric secret was not:
    // a customer who points this at their own key mints keys that fail verification, because the
    // accepted PUBLIC keys are compiled in and are not theirs. The asymmetry is doing the work.
    const signingKey = loadLicenseSigningKey(fastify.log)
    if (!signingKey) {
      // Fail closed and loudly. Registering the webhook without a signing key would accept
      // checkouts and then fail to issue, taking payment for a licence never delivered.
      fastify.log.warn(
        'Stripe webhook NOT registered — no licence signing key (LICENSE_SIGNING_KEY_FILE). ' +
        'Issuance is disabled until the hub signing key is provisioned.',
      )
    } else {
      await fastify.register(stripeWebhookRoutes, {
        prefix: '/api/stripe/webhook',
        webhookSecret: config.stripeWebhookSecret,
        signingKey,
        licenseStore,
        auditService,
        emailService,
        siteUrl: config.siteUrl,
      })
      fastify.log.info('Stripe webhook route registered')
    }
  }
} else {
  fastify.log.info('Stripe not configured (STRIPE_SECRET_KEY not set) — commerce routes disabled')
}

// Weaver-tier routes (dynamically loaded — absent in free tier)
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - tier-gated path sync-excluded from Free repo
  const { weaverRoutes } = await import('./routes/weaver/index.js')
  await fastify.register(weaverRoutes, {
    config, auditService,
    notificationConfigStore, notificationService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- networkManager typed as unknown from dynamic import
    webPushSubscriptionStore, networkManager: networkManager as any,
  })
  fastify.log.info('Weaver-tier routes loaded')
} catch (err) {
  // routes/weaver/ (provisioning + network) is BSL and sync-excluded from the AGPL Free
  // mirror, so on a Free build this import is EXPECTED to be absent. Distinguish that from a
  // genuine load failure at weaver tier — never mislabel either as "free tier" (the tier is
  // set by the license, not by whether this module loaded). See G-backend-2026-06-14-01KYSBXCJ6839ZDAHSMJ97EQB1.
  const code = (err as NodeJS.ErrnoException)?.code
  if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
    fastify.log.info('Weaver-tier routes absent (Free build) — provisioning/network disabled')
  } else {
    fastify.log.error({ err }, 'Weaver-tier routes present but FAILED to load — provisioning/network unavailable')
  }
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

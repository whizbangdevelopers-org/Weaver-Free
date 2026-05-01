// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve, basename, relative } from 'node:path'
import { safeReadFile, listFiles } from '../utils/file-reader.js'

interface ServiceEvent {
  name: string
  emitter: string
  description?: string
}

interface ServiceMethod {
  name: string
  isAsync: boolean
  signature: string
}

interface ServiceInfo {
  file: string
  exportedClasses: string[]
  exportedFunctions: string[]
  constructorParams: string[]
  publicMethods: ServiceMethod[]
  events: ServiceEvent[]
  storageImports: string[]
  tierConditioned: boolean
  isDynamic: boolean
  notes: string[]
}

interface ServiceArchitectureResult {
  services: ServiceInfo[]
  initializationOrder: string[]
  storageLayer: string[]
  warnings: string[]
}

function extractConstructorParams(content: string, className: string): string[] {
  const regex = new RegExp(
    `class\\s+${className}[^{]*\\{[\\s\\S]*?constructor\\s*\\(([^)]+)\\)`,
    'm'
  )
  const m = regex.exec(content)
  if (!m) return []
  return m[1]
    .split(',')
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)
}

function extractPublicMethods(content: string, className: string): ServiceMethod[] {
  // Find the class body
  const classRegex = new RegExp(`class\\s+${className}[^{]*\\{`, 'm')
  const classStart = classRegex.exec(content)
  if (!classStart) return []

  const methods: ServiceMethod[] = []
  // Match public/async methods (not private, not constructor)
  const methodRegex = /^\s{2}(?:async\s+)?(?!private\s|protected\s|constructor\s|#)(\w+)\s*\(([^)]*)\)/gm
  let m: RegExpExecArray | null
  while ((m = methodRegex.exec(content)) !== null) {
    if (m.index < classStart.index) continue
    const name = m[1]
    if (['constructor', 'get', 'set'].includes(name)) continue
    const isAsync = content.slice(Math.max(0, m.index - 10), m.index).includes('async')
    methods.push({
      name,
      isAsync,
      signature: `${isAsync ? 'async ' : ''}${name}(${m[2].trim()})`,
    })
  }
  return methods.slice(0, 15) // cap at 15 to avoid noise
}

function extractEmittedEvents(content: string): ServiceEvent[] {
  const events: ServiceEvent[] = []
  const seen = new Set<string>()

  // EventEmitter.emit('event-name') or events.emit('event-name')
  const emitRegex = /(\w+)\.emit\s*\(\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = emitRegex.exec(content)) !== null) {
    const key = `${m[1]}:${m[2]}`
    if (!seen.has(key)) {
      events.push({ name: m[2], emitter: m[1] })
      seen.add(key)
    }
  }

  // new EventEmitter() declarations
  const emitterRegex = /export\s+const\s+(\w+)\s*=\s*new\s+EventEmitter/g
  while ((m = emitterRegex.exec(content)) !== null) {
    // Already captured via .emit, just note the emitter exists
  }

  return events
}

function extractStorageImports(content: string): string[] {
  const imports: string[] = []
  const importRegex = /from\s+'\.\.\/storage\/([^'"]+)'/g
  let m: RegExpExecArray | null
  while ((m = importRegex.exec(content)) !== null) {
    const name = m[1].replace('.js', '').replace(/[-/](\w)/g, (_, c) => c.toUpperCase())
    if (!imports.includes(name)) imports.push(name)
  }
  return imports
}

export async function getServiceArchitecture(
  projectRoot: string,
  service?: string
): Promise<ServiceArchitectureResult> {
  const warnings: string[] = []
  const servicesDir = resolve(projectRoot, 'backend/src/services')
  const allFiles = await listFiles(servicesDir, '.ts')

  // Also check weaver/ and fabrick/ subdirectories
  const weaverFiles = await listFiles(resolve(servicesDir, 'weaver'), '.ts')
  const fabrickFiles = await listFiles(resolve(servicesDir, 'fabrick'), '.ts')

  const serviceFiles = [...allFiles, ...weaverFiles, ...fabrickFiles]
    .filter(f => !f.endsWith('.gitkeep'))

  const services: ServiceInfo[] = []

  for (const filePath of serviceFiles) {
    const fileName = basename(filePath, '.ts')
    if (service && !fileName.toLowerCase().includes(service.toLowerCase())) continue

    const content = await safeReadFile(filePath)
    if (!content) continue

    const relFile = relative(projectRoot, filePath)

    // Extract exported classes
    const classRegex = /export\s+class\s+(\w+)/g
    const exportedClasses: string[] = []
    let m: RegExpExecArray | null
    while ((m = classRegex.exec(content)) !== null) exportedClasses.push(m[1])

    // Extract exported functions/consts
    const funcRegex = /export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)/g
    const exportedFunctions: string[] = []
    while ((m = funcRegex.exec(content)) !== null) {
      const name = m[1] || m[2]
      if (name && !exportedClasses.includes(name)) exportedFunctions.push(name)
    }

    // Constructor params for first class
    const constructorParams = exportedClasses.length > 0
      ? extractConstructorParams(content, exportedClasses[0])
      : []

    // Public methods for first class
    const publicMethods = exportedClasses.length > 0
      ? extractPublicMethods(content, exportedClasses[0])
      : []

    const events = extractEmittedEvents(content)
    const storageImports = extractStorageImports(content)

    // Is it conditionally loaded (dynamic import pattern)?
    const isDynamic = filePath.includes('/weaver/') || filePath.includes('/fabrick/')

    // Is it tier-conditioned in index.ts?
    const tierConditioned = isDynamic

    const notes: string[] = []
    if (isDynamic) notes.push('Dynamically imported — only available when weaver/fabrick directory is present (tier-gated)')
    if (content.includes('provisioningEnabled')) notes.push('Only active when config.provisioningEnabled=true')
    if (content.includes('EventEmitter')) notes.push('Exports EventEmitter for inter-service pub/sub')
    if (content.includes('LlmProvider')) notes.push('Implements LlmProvider interface for BYOK/BYOV pattern')

    services.push({
      file: relFile,
      exportedClasses,
      exportedFunctions: exportedFunctions.slice(0, 10),
      constructorParams,
      publicMethods,
      events,
      storageImports,
      tierConditioned,
      isDynamic,
      notes,
    })
  }

  // Initialization order from index.ts (static knowledge)
  const initializationOrder = [
    '1. vmRegistry (createRegistry) — VM persistence layer',
    '2. config (loadConfig) — env vars + tier resolution',
    '3. HostInfoService — system info (lscpu, df, ip, nixos-version)',
    '4. ImageManager (createImageManager) — distro image cache',
    '5. CatalogStore + DistroStore — distro catalog persistence',
    '6. UrlValidationService — broken image URL detection',
    '7. Provisioner (dynamic import, provisioningEnabled only) — VM lifecycle',
    '8. NetworkManager (dynamic import, weaver only) — bridge/firewall/network',
    '9. UserStore + SessionStore — authentication persistence',
    '10. AuthService — login, JWT, lockout',
    '11. AuditStore + AuditService — audit log',
    '12. QuotaStore — per-user resource limits (enterprise)',
    '13. PresetTagStore — reusable VM tags',
    '14. VmAclStore — per-VM access control (enterprise)',
    '15. NotificationStore + NotificationConfigStore + WebPushSubscriptionStore',
    '16. NotificationService — event dispatch, adapter loading',
    '17. Auth middleware registered (onRequest hook)',
    '18. Routes registered (auth → health → workloads → agent → distros → audit → users → ...)',
  ]

  // Storage layer inventory
  const storageLayer = [
    'VmRegistry (storage/index.ts) — VM state persistence (JSON or SQLite)',
    'UserStore (storage/user-store.ts) — user accounts, secondary username index',
    'SessionStore interface — MemorySessionStore (demo/free) | SqliteSessionStore (premium)',
    'AuditStore (storage/audit-store.ts) — append-only audit log, debounced disk writes',
    'QuotaStore (storage/quota-store.ts) — per-user resource limits',
    'VmAclStore (storage/vm-acl-store.ts) — per-VM access control lists',
    'NetworkStore (storage/network-store.ts) — bridge/IP pool/firewall config',
    'DistroStore (storage/distro-store.ts) — custom distro definitions',
    'CatalogStore (storage/catalog-store.ts) — curated distro catalog',
    'NotificationStore (storage/notification-store.ts) — notification history',
    'NotificationConfigStore (storage/notification-config-store.ts) — channel config',
    'WebPushSubscriptionStore (storage/web-push-subscription-store.ts) — VAPID subscriptions',
    'PresetTagStore (storage/preset-tag-store.ts) — reusable VM tags',
  ]

  return { services, initializationOrder, storageLayer, warnings }
}

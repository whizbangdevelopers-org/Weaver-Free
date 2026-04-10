// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Mock API and WebSocket clients for TUI --demo mode.
 * No backend connection needed — all data is in-memory.
 */

import type { VmInfo, VmCreateInput } from '../types/vm.js'
import type { AgentWsMessage } from '../types/agent.js'
import type { ApiResponse, TuiApiClient } from '../client/api.js'
import type { TuiWsClient } from '../client/ws.js'
import type { SafeUser } from '../types/user.js'
import { TIERS, STATUSES, ROLES } from '../constants/vocabularies.js'
import { getDemoVmsForTier, DEMO_VMS, DEMO_FLEET_BRIDGES } from './data.js'

// Mutable demo tier — updated at runtime by setDemoTier()
let currentDemoTier = TIERS.WEAVER as string
let currentDemoVersion = '1.0'

/**
 * Tier cycle for Tab key in demo mode.
 * 'weaver-team' is a display-only step — internally it sets tier='weaver' + subTier='team'.
 * Team is a product SKU from day one, always in the cycle.
 */
export const DEMO_TIER_CYCLE = [TIERS.FREE, TIERS.WEAVER, 'weaver-team', TIERS.FABRICK, TIERS.DEMO] as const

/** Resolve a cycle tier to its internal tier value. */
export function resolveInternalTier(cycleTier: string): string {
  return cycleTier === 'weaver-team' ? TIERS.WEAVER : cycleTier
}

/** Get the display label for a cycle tier. */
export function tierDisplayLabel(cycleTier: string): string {
  switch (cycleTier) {
    case TIERS.FREE: return 'Weaver Free'
    case TIERS.WEAVER: return 'Weaver Solo'
    case 'weaver-team': return 'Weaver Team'
    case TIERS.FABRICK: return 'FabricK'
    case TIERS.DEMO: return 'Demo'
    default: return cycleTier
  }
}

/** Version registry — mirrors web demo DEMO_VERSIONS from src/config/demo.ts */
export interface DemoVersionEntry {
  version: string
  headline: string
  tierCeiling?: string
}

export const DEMO_VERSIONS: DemoVersionEntry[] = [
  { version: '1.0', headline: 'Core Platform' },
  { version: '1.1', headline: 'Container Visibility' },
  { version: '1.2', headline: 'Container Management' },
  { version: '1.3', headline: 'Remote Access + Mobile', tierCeiling: TIERS.FREE },
  { version: '1.4', headline: 'Cross-Resource AI' },
  { version: '1.5', headline: 'Integrated Secrets Management' },
  { version: '1.6', headline: 'Migration Tooling' },
  { version: '2.0', headline: 'Storage + Templates', tierCeiling: TIERS.WEAVER },
  { version: '2.1', headline: 'Storage Phase 2' },
  { version: '2.2', headline: 'Weaver Team — Peer Federation' },
  { version: '2.3', headline: 'FabricK Basic Clustering' },
  { version: '2.4', headline: 'Backup Weaver' },
  { version: '2.5', headline: 'Storage & Template FabricK' },
  { version: '2.6', headline: 'Backup FabricK + Extensions' },
  { version: '3.0', headline: 'FabricK — Multi-Host Fleet' },
  { version: '3.1', headline: 'Edge Fleet + Cloud Burst' },
  { version: '3.2', headline: 'Cloud Burst Self-Serve Billing' },
  { version: '3.3', headline: 'FabricK Maturity — Workload Groups + Compliance' },
]

export function setDemoTier(tier: string): void {
  currentDemoTier = tier
}

export function setDemoVersion(version: string): void {
  currentDemoVersion = version
}

/** Returns true when current demo version >= target version */
export function isDemoVersionAtLeast(target: string): boolean {
  const parse = (v: string) => {
    const [maj, min] = v.replace(/^v/, '').split('.').map(Number)
    return (maj ?? 0) * 100 + (min ?? 0)
  }
  return parse(currentDemoVersion) >= parse(target)
}

export function getDemoVersion(): string {
  return currentDemoVersion
}

// In-memory VM state for the demo session
let demoVms: VmInfo[] = structuredClone(DEMO_VMS)

// In-memory users for the demo session
let demoUsers: SafeUser[] = [
  { id: 'u1', username: ROLES.ADMIN, role: ROLES.ADMIN, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'u2', username: 'ops-1', role: ROLES.OPERATOR, createdAt: '2026-01-15T00:00:00Z' },
  { id: 'u3', username: 'viewer-1', role: ROLES.VIEWER, createdAt: '2026-02-01T00:00:00Z' },
]

function findVm(name: string): VmInfo | undefined {
  return demoVms.find(v => v.name === name)
}

function ok<T>(data: T): ApiResponse<T> {
  return { status: 200, data }
}

function created<T>(data: T): ApiResponse<T> {
  return { status: 201, data }
}

function notFound(): ApiResponse<{ error: string }> {
  return { status: 404, data: { error: 'VM not found' } }
}

function forbidden(msg: string): ApiResponse<{ error: string }> {
  return { status: 403, data: { error: msg } }
}

/**
 * Tier blocklist — features BLOCKED at each tier.
 * demo: all features visible (mock data for everything)
 * free: blocks weaver/fabrick features
 * weaver: blocks fabrick features
 * fabrick: nothing blocked
 *
 * Agent BYOK is free tier (backend rate-limits to 5/min).
 * Agent with server key is weaver+ (backend enforces).
 * The demo mock always allows agent since it's BYOK-capable.
 */
const TIER_BLOCKED: Record<string, Set<string>> = {
  [TIERS.DEMO]:    new Set(),
  [TIERS.FREE]:    new Set(['network-mgmt', 'distros-mgmt', 'templates-mgmt', 'host-detail', 'plugins']),
  [TIERS.WEAVER]:  new Set(['users', 'audit', 'quotas', 'acl', 'bulk-ops', 'fleet-bridges']),
  [TIERS.FABRICK]: new Set(),
}

function isTierBlocked(tier: string, feature: string): boolean {
  return TIER_BLOCKED[tier]?.has(feature) ?? false
}

/**
 * Create a mock API client that operates on in-memory DEMO_VMS.
 */
export function createDemoApiClient(tier: string): TuiApiClient {
  // Initialize mutable tier + reset state each time
  currentDemoTier = tier
  demoVms = structuredClone(getDemoVmsForTier(tier))
  demoUsers = [
    { id: 'u1', username: ROLES.ADMIN, role: ROLES.ADMIN, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'u2', username: 'ops-1', role: ROLES.OPERATOR, createdAt: '2026-01-15T00:00:00Z' },
    { id: 'u3', username: 'viewer-1', role: ROLES.VIEWER, createdAt: '2026-02-01T00:00:00Z' },
  ]

  // We cast an object implementing the same interface shape
  const mock = {
    setRefreshToken() { /* no-op */ },

    // Auth
    async checkSetupRequired() {
      return ok({ setupRequired: false })
    },

    async login(_username: string, _password: string) {
      return ok({
        user: { id: 'demo', username: ROLES.ADMIN, role: ROLES.ADMIN, createdAt: new Date().toISOString() },
        token: 'demo-token',
        refreshToken: 'demo-refresh',
      })
    },

    async register(username: string, _password: string) {
      return created({
        user: { id: `demo-${Date.now()}`, username, role: ROLES.ADMIN, createdAt: new Date().toISOString() },
        token: 'demo-token',
        refreshToken: 'demo-refresh',
      })
    },

    // Health
    async getHealth() {
      return ok({
        status: 'ok',
        tier: currentDemoTier,
        provisioningEnabled: false,
        bridgeGateway: null,
        hasServerKey: true,
        host: {
          hostname: 'nixos-demo', arch: 'x86_64', cpuModel: 'Intel Core i7-12700',
          cpuCount: 12, totalMemMb: 32768, kernelVersion: '6.6.0',
          uptimeSeconds: 86400 * 3, kvmAvailable: true,
        },
      })
    },

    // VMs
    async listVms() {
      return ok(demoVms)
    },

    async getVm(name: string) {
      const vm = findVm(name)
      return vm ? ok(vm) : notFound() as unknown as ApiResponse<VmInfo>
    },

    async startVm(name: string) {
      const vm = findVm(name)
      if (!vm) return notFound()
      if (vm.status === STATUSES.RUNNING) return ok({ name, action: 'start' as const, success: true, message: 'Already running' })
      vm.status = STATUSES.RUNNING
      vm.uptime = new Date().toISOString()
      return ok({ name, action: 'start' as const, success: true, message: 'Started' })
    },

    async stopVm(name: string) {
      const vm = findVm(name)
      if (!vm) return notFound()
      vm.status = STATUSES.STOPPED
      vm.uptime = null
      return ok({ name, action: 'stop' as const, success: true, message: 'Stopped' })
    },

    async restartVm(name: string) {
      const vm = findVm(name)
      if (!vm) return notFound()
      vm.status = STATUSES.RUNNING
      vm.uptime = new Date().toISOString()
      return ok({ name, action: 'restart' as const, success: true, message: 'Restarted' })
    },

    async createVm(input: VmCreateInput) {
      if (demoVms.find(v => v.name === input.name)) {
        return { status: 409, data: { error: `VM "${input.name}" already exists` } }
      }
      const newVm: VmInfo = {
        name: input.name, status: STATUSES.STOPPED,
        ip: input.ip, mem: input.mem, vcpu: input.vcpu,
        hypervisor: input.hypervisor, uptime: null,
        distro: input.distro, autostart: input.autostart,
        description: input.description, tags: input.tags,
        bridge: 'br-microvm',
      }
      demoVms.push(newVm)
      return created({ success: true, message: `VM "${input.name}" registered` })
    },

    async deleteVm(name: string) {
      const idx = demoVms.findIndex(v => v.name === name)
      if (idx === -1) return notFound()
      demoVms.splice(idx, 1)
      return ok({ success: true, message: `VM "${name}" deleted` })
    },

    async scanVms() {
      const newName = `discovered-${Date.now() % 10000}`
      const newVm: VmInfo = {
        name: newName, status: STATUSES.STOPPED, ip: '10.10.0.99',
        mem: 256, vcpu: 1, hypervisor: 'qemu', uptime: null,
        bridge: 'br-microvm',
      }
      demoVms.push(newVm)
      return ok({ discovered: [newName], added: [newName], existing: [] })
    },

    // Logs
    async getVmLogs(name: string) {
      const vm = findVm(name)
      if (!vm) return notFound()
      return ok({
        name,
        log: generateMockProvisioningLog(name, vm),
      })
    },

    // Agent
    async startAgent(vmName: string, action: string, _apiKey?: string, _vendor?: string) {
      const vm = findVm(vmName)
      if (!vm) return notFound()

      const operationId = `demo-${Date.now()}`

      // Simulate streaming: emit tokens then complete after a delay
      setTimeout(() => {
        const text = generateMockAgentResponse(vmName, action, vm)
        const words = text.split(' ')
        let sent = 0

        const interval = setInterval(() => {
          if (sent >= words.length) {
            clearInterval(interval)
            demoAgentHandlers.forEach(fn => fn({
              type: 'agent-complete',
              operationId,
              fullText: text,
            } as AgentWsMessage))
            return
          }
          const chunk = words.slice(sent, sent + 3).join(' ') + ' '
          sent += 3
          demoAgentHandlers.forEach(fn => fn({
            type: 'agent-token',
            operationId,
            token: chunk,
          } as AgentWsMessage))
        }, 100)
      }, 300)

      return { status: 202, data: { operationId } }
    },

    async getAgentStatus(_vmName: string, _operationId: string) {
      return ok({ status: 'complete' })
    },

    // Network
    async getNetworkTopology() {
      if (isTierBlocked(currentDemoTier, 'network-mgmt')) {
        return forbidden('Network management requires Weaver Solo')
      }
      const bridgesByTier: Record<string, { name: string; gateway: string; subnet: string }[]> = {
        [TIERS.FREE]:    [{ name: 'br-microvm', gateway: '10.10.0.1', subnet: '10.10.0.0/24' }],
        [TIERS.WEAVER]:  [
          { name: 'br-prod', gateway: '10.10.0.1', subnet: '10.10.0.0/24' },
          { name: 'br-dev',  gateway: '10.10.1.1', subnet: '10.10.1.0/24' },
        ],
        [TIERS.FABRICK]: [
          { name: 'br-edge',    gateway: '10.10.1.1',   subnet: '10.10.1.0/24' },
          { name: 'br-app',     gateway: '10.10.2.1',   subnet: '10.10.2.0/24' },
          { name: 'br-data',    gateway: '10.10.3.1',   subnet: '10.10.3.0/24' },
          { name: 'br-mgmt',    gateway: '10.10.100.1', subnet: '10.10.100.0/24' },
          { name: 'br-staging', gateway: '10.10.10.1',  subnet: '10.10.10.0/24' },
        ],
        [TIERS.DEMO]: [
          { name: 'br-prod', gateway: '10.10.0.1', subnet: '10.10.0.0/24' },
          { name: 'br-dev',  gateway: '10.10.1.1', subnet: '10.10.1.0/24' },
        ],
      }
      return ok({
        bridges: bridgesByTier[currentDemoTier] ?? bridgesByTier[TIERS.FREE],
        nodes: demoVms.map(vm => ({
          name: vm.name, ip: vm.ip, bridge: vm.bridge ?? 'br-microvm',
          status: vm.status, hypervisor: vm.hypervisor, distro: vm.distro,
          mem: vm.mem, vcpu: vm.vcpu, uptime: vm.uptime,
          description: vm.description, tags: vm.tags, autostart: vm.autostart,
        })),
      })
    },

    // Host
    async getHostInfo() {
      if (isTierBlocked(currentDemoTier, 'host-detail')) {
        return forbidden('Detailed host info requires Weaver Solo')
      }
      return ok({
        nixosVersion: '25.11',
        cpuTopology: {
          sockets: 1, coresPerSocket: 8, threadsPerCore: 2,
          virtualizationType: 'VT-x',
          l1dCache: '48K', l1iCache: '32K', l2Cache: '1.25M', l3Cache: '25M',
        },
        diskUsage: [{
          filesystem: '/dev/nvme0n1p3', sizeHuman: '500G', usedHuman: '120G',
          availHuman: '380G', usePercent: 24, mountPoint: '/',
        }],
        networkInterfaces: [
          { name: 'eth0', state: 'UP', macAddress: 'aa:bb:cc:dd:ee:ff' },
          { name: 'br-microvm', state: 'UP', macAddress: null },
        ],
        liveMetrics: { freeMemMb: 12288, loadAvg1: 0.5, loadAvg5: 0.3, loadAvg15: 0.2 },
      })
    },

    // Distros (read-only list is free, mutations would be premium)
    async listDistros() {
      return ok([
        { name: 'nixos', label: 'NixOS', url: 'https://hydra.nixos.org/build/latest/download/nixos-image.qcow2',
          format: 'qcow2', cloudInit: false, guestOs: 'linux', builtin: true, category: 'builtin' },
        { name: 'ubuntu-24.04', label: 'Ubuntu 24.04 LTS', url: 'https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img',
          format: 'qcow2', cloudInit: true, guestOs: 'linux', builtin: true, category: 'builtin' },
        { name: 'rocky-9', label: 'Rocky Linux 9', url: 'https://dl.rockylinux.org/pub/rocky/9/images/x86_64/Rocky-9-GenericCloud.latest.x86_64.qcow2',
          format: 'qcow2', cloudInit: true, guestOs: 'linux', builtin: true, category: 'builtin' },
        { name: 'custom-corp', label: 'Corp Build', url: 'file:///data/images/corp.qcow2',
          format: 'qcow2', cloudInit: false, guestOs: 'linux', builtin: false, category: 'custom' },
      ])
    },

    // Templates
    async listTemplates() {
      if (isTierBlocked(currentDemoTier, 'templates-mgmt')) {
        return forbidden('VM templates require Weaver Solo')
      }
      return ok([
        { id: 't1', name: 'Web Server', description: 'Nginx reverse proxy with optimized settings',
          distro: 'nixos', mem: 256, vcpu: 1, hypervisor: 'qemu', autostart: true,
          tags: ['web', 'proxy'], category: 'builtin' },
        { id: 't2', name: 'App Server', description: 'Node.js application runtime with 512MB RAM',
          distro: 'nixos', mem: 512, vcpu: 2, hypervisor: 'qemu', autostart: true,
          tags: ['app', 'node'], category: 'builtin' },
        { id: 't3', name: 'Database', description: 'PostgreSQL database with 1GB RAM',
          distro: 'nixos', mem: 1024, vcpu: 2, hypervisor: 'qemu', autostart: true,
          tags: ['db', 'postgres'], category: 'builtin' },
        { id: 't4', name: 'CI Runner', description: 'Lightweight CI/CD runner for build jobs',
          distro: 'ubuntu-24.04', mem: 512, vcpu: 1, hypervisor: 'firecracker', autostart: false,
          tags: ['ci', 'build'], category: 'builtin' },
        { id: 't5', name: 'Dev Environment', description: 'Full development environment with tools',
          distro: 'ubuntu-24.04', mem: 2048, vcpu: 4, hypervisor: 'cloud-hypervisor', autostart: false,
          tags: ['dev'], category: 'custom' },
      ])
    },

    // Notifications
    async getNotifications(_limit?: number) {
      if (isTierBlocked(currentDemoTier, 'notifications-config')) {
        return forbidden('Notification management requires Weaver Solo')
      }
      return ok({ notifications: [
        { id: 'n1', timestamp: new Date(Date.now() - 3_600_000).toISOString(), event: 'vm.started',
          vmName: 'web-nginx', severity: 'success', message: 'VM started successfully' },
        { id: 'n2', timestamp: new Date(Date.now() - 7_200_000).toISOString(), event: 'vm.stopped',
          vmName: 'ci-runner', severity: 'info', message: 'VM stopped' },
        { id: 'n3', timestamp: new Date(Date.now() - 86_400_000).toISOString(), event: 'vm.failed',
          vmName: 'staging-env', severity: 'error', message: 'VM failed to start — resource limit exceeded' },
      ]})
    },

    // Users (fabrick)
    async listUsers() {
      if (isTierBlocked(currentDemoTier, 'users')) {
        return forbidden('User management requires FabricK tier')
      }
      return ok(demoUsers)
    },

    async updateUserRole(id: string, role: string) {
      if (isTierBlocked(currentDemoTier, 'users')) {
        return forbidden('User management requires FabricK tier')
      }
      const user = demoUsers.find(u => u.id === id)
      if (!user) return { status: 404, data: { error: 'User not found' } }
      user.role = role as SafeUser['role']
      return ok(user)
    },

    async deleteUser(id: string) {
      if (isTierBlocked(currentDemoTier, 'users')) {
        return forbidden('User management requires FabricK tier')
      }
      const idx = demoUsers.findIndex(u => u.id === id)
      if (idx === -1) return { status: 404, data: { error: 'User not found' } }
      if (demoUsers[idx]!.role === ROLES.ADMIN) {
        return { status: 400, data: { error: 'Cannot delete admin user' } }
      }
      demoUsers.splice(idx, 1)
      return ok({ success: true })
    },

    // Quotas (fabrick)
    async getUserQuotas(id: string) {
      if (isTierBlocked(currentDemoTier, 'quotas')) {
        return forbidden('User quotas require FabricK tier')
      }
      return ok({
        userId: id, maxVms: 10, maxMemoryMB: 8192, maxVcpus: 16,
        currentVms: 3, currentMemoryMB: 1792, currentVcpus: 4,
      })
    },

    async setUserQuotas(id: string, quotas: { maxVms?: number | null; maxMemoryMB?: number | null; maxVcpus?: number | null }) {
      if (isTierBlocked(currentDemoTier, 'quotas')) {
        return forbidden('User quotas require FabricK tier')
      }
      return ok({ userId: id, ...quotas })
    },

    // VM ACL (fabrick)
    async getVmAcl(id: string) {
      if (isTierBlocked(currentDemoTier, 'acl')) {
        return forbidden('Per-VM ACL requires FabricK tier')
      }
      const user = demoUsers.find(u => u.id === id)
      if (!user) return { status: 404, data: { error: 'User not found' } }
      if (user.role === ROLES.ADMIN) return ok({ userId: id, vmNames: [] })
      return ok({ userId: id, vmNames: ['web-nginx', 'web-app'] })
    },

    async setVmAcl(id: string, vmNames: string[]) {
      if (isTierBlocked(currentDemoTier, 'acl')) {
        return forbidden('Per-VM ACL requires FabricK tier')
      }
      return ok({ userId: id, vmNames })
    },

    // Audit (fabrick)
    async getAuditLog(_params?: Record<string, unknown>) {
      if (isTierBlocked(currentDemoTier, 'audit')) {
        return forbidden('Audit log requires FabricK tier')
      }
      return ok({
        entries: [
          { id: 'a1', timestamp: new Date(Date.now() - 1_800_000).toISOString(),
            userId: 'u1', username: 'admin', action: 'vm.start', resource: 'web-nginx',
            success: true, ip: '127.0.0.1' },
          { id: 'a2', timestamp: new Date(Date.now() - 3_600_000).toISOString(),
            userId: 'u2', username: 'ops-1', action: 'vm.stop', resource: 'ci-runner',
            success: true, ip: '10.0.0.5' },
          { id: 'a3', timestamp: new Date(Date.now() - 7_200_000).toISOString(),
            userId: 'u1', username: 'admin', action: 'vm.create', resource: 'staging-env',
            success: true, ip: '127.0.0.1' },
          { id: 'a4', timestamp: new Date(Date.now() - 14_400_000).toISOString(),
            userId: 'u3', username: 'viewer-1', action: 'user.login', resource: null,
            success: true, ip: '192.168.1.50' },
          { id: 'a5', timestamp: new Date(Date.now() - 28_800_000).toISOString(),
            userId: null, username: 'unknown', action: 'user.login', resource: null,
            success: false, ip: '10.0.0.99' },
          { id: 'a6', timestamp: new Date(Date.now() - 86_400_000).toISOString(),
            userId: 'u1', username: 'admin', action: 'agent.run', resource: 'db-postgres',
            success: true, ip: '127.0.0.1' },
        ],
        total: 6,
      })
    },

    // Fleet bridges (Fabrick v3.0+)
    async getFleetBridges() {
      if (isTierBlocked(currentDemoTier, 'fleet-bridges')) {
        return forbidden('Fleet bridges require FabricK tier')
      }
      return ok(DEMO_FLEET_BRIDGES)
    },
  } as unknown as TuiApiClient

  return mock
}

function generateMockAgentResponse(vmName: string, action: string, vm: VmInfo): string {
  switch (action) {
    case 'diagnose':
      return `Diagnosis for ${vmName}: The VM is currently ${vm.status}. ` +
        `It has ${vm.mem}MB RAM and ${vm.vcpu} vCPU(s) allocated. ` +
        `Running on ${vm.hypervisor} with ${vm.distro ?? 'unknown'} distribution. ` +
        `No critical issues detected. Memory utilization appears normal. ` +
        `Network interface is ${vm.ip ? 'configured at ' + vm.ip : 'not configured'}.`
    case 'explain':
      return `Configuration for ${vmName}: This VM is a ${vm.distro ?? 'generic'} instance ` +
        `running on the ${vm.hypervisor} hypervisor. It is allocated ${vm.mem}MB of RAM ` +
        `and ${vm.vcpu} virtual CPU(s). ` +
        `${vm.bridge ? `Connected to bridge ${vm.bridge}. ` : ''}` +
        `${vm.ip ? `Network address: ${vm.ip}. ` : ''}` +
        `The VM ${vm.status === STATUSES.RUNNING ? 'is actively running' : 'is currently ' + vm.status}.`
    case 'suggest':
      return `Suggestions for ${vmName}: ` +
        `${vm.mem < 512 ? 'Consider increasing memory allocation to at least 512MB for better performance. ' : ''}` +
        `${vm.vcpu < 2 ? 'Adding a second vCPU could improve responsiveness for multi-threaded workloads. ' : ''}` +
        `Ensure regular snapshots are configured for backup. ` +
        `Monitor disk I/O patterns to identify potential bottlenecks.`
    default:
      return `Analysis complete for ${vmName}.`
  }
}

function generateMockProvisioningLog(name: string, vm: VmInfo): string {
  const ts = '2026-01-15T00:00'
  return [
    `[${ts}:00.000Z] Starting provisioning for VM: ${name}`,
    `[${ts}:00.100Z] Hypervisor: ${vm.hypervisor}`,
    `[${ts}:00.200Z] Allocating ${vm.mem}MB RAM, ${vm.vcpu} vCPU(s)`,
    `[${ts}:00.300Z] Creating disk image: /var/lib/microvms/${name}/root.qcow2`,
    `[${ts}:00.500Z] Disk format: qcow2, size: ${vm.diskSize ?? 10}G`,
    vm.distro ? `[${ts}:00.600Z] Base image: ${vm.distro}` : null,
    `[${ts}:00.800Z] Configuring network interface on bridge ${vm.bridge ?? 'br-microvm'}`,
    vm.ip ? `[${ts}:00.900Z] Assigned IP: ${vm.ip}` : null,
    vm.macAddress ? `[${ts}:01.000Z] MAC address: ${vm.macAddress}` : null,
    `[${ts}:01.200Z] Writing cloud-init metadata`,
    `[${ts}:01.500Z] Generating NixOS configuration`,
    `[${ts}:02.000Z] Building system closure (this may take a while)`,
    `[${ts}:05.000Z] System closure built successfully`,
    `[${ts}:05.200Z] Installing bootloader`,
    `[${ts}:05.500Z] Registering VM with microvm manager`,
    `[${ts}:05.600Z] Setting autostart: ${vm.autostart ? 'enabled' : 'disabled'}`,
    `[${ts}:05.800Z] Provisioning complete for ${name}`,
  ].filter(Boolean).join('\n')
}

// Shared agent handlers for demo WS
const demoAgentHandlers = new Set<(msg: AgentWsMessage) => void>()

/**
 * Create a mock WebSocket client that cycles VM status every 5s.
 */
export function createDemoWsClient(_tier: string): TuiWsClient {
  const vmStatusHandlers = new Set<(vms: VmInfo[]) => void>()
  const connectHandlers = new Set<() => void>()
  const disconnectHandlers = new Set<() => void>()
  const authExpiredHandlers = new Set<() => void>()

  let statusInterval: ReturnType<typeof setInterval> | null = null

  const mock = {
    connect(_token: string) {
      // Fire connected immediately
      setTimeout(() => {
        connectHandlers.forEach(fn => fn())
        // Send initial VM status
        vmStatusHandlers.forEach(fn => fn(demoVms))
      }, 50)

      // Cycle VM status every 5s
      statusInterval = setInterval(() => {
        vmStatusHandlers.forEach(fn => fn(demoVms))
      }, 5000)
    },

    disconnect() {
      if (statusInterval) {
        clearInterval(statusInterval)
        statusInterval = null
      }
      disconnectHandlers.forEach(fn => fn())
    },

    onVmStatus(handler: (vms: VmInfo[]) => void): () => void {
      vmStatusHandlers.add(handler)
      return () => vmStatusHandlers.delete(handler)
    },

    onAgentMessage(handler: (msg: AgentWsMessage) => void): () => void {
      demoAgentHandlers.add(handler)
      return () => demoAgentHandlers.delete(handler)
    },

    onConnect(handler: () => void): () => void {
      connectHandlers.add(handler)
      return () => connectHandlers.delete(handler)
    },

    onDisconnect(handler: () => void): () => void {
      disconnectHandlers.add(handler)
      return () => disconnectHandlers.delete(handler)
    },

    onAuthExpired(handler: () => void): () => void {
      authExpiredHandlers.add(handler)
      return () => authExpiredHandlers.delete(handler)
    },

    onSessionKicked(handler: () => void): () => void {
      // Never fires in demo mode
      void handler
      return () => {}
    },

    isConnected() {
      return statusInterval !== null
    },
  } as unknown as TuiWsClient

  return mock
}

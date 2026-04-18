// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { api } from 'src/boot/axios'
import type { AxiosRequestConfig } from 'axios'
import type { WorkloadInfo, WorkloadActionResult, VmCreateInput } from 'src/types/workload'
import type { NetworkTopology, BridgeInfo, IpPoolConfig, FirewallRule } from 'src/types/network'
import type { NotificationEvent, NotificationChannelConfigData, ChannelConfig, ResourceAlertConfig } from 'src/types/notification'
import { isDemoMode } from 'src/config/demo-mode'
import { STATUSES } from 'src/constants/vocabularies'

/**
 * Generic API service with common HTTP methods
 * Extend this for specific API endpoints
 */
export class ApiService {
  private basePath: string

  constructor(basePath: string = '') {
    this.basePath = basePath
  }

  protected async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await api.get<T>(`${this.basePath}${path}`, config)
    return response.data
  }

  protected async post<T>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await api.post<T>(`${this.basePath}${path}`, data, config)
    return response.data
  }

  protected async put<T>(
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await api.put<T>(`${this.basePath}${path}`, data, config)
    return response.data
  }

  protected async delete<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await api.delete<T>(`${this.basePath}${path}`, config)
    return response.data
  }
}

/**
 * VM API service for managing MicroVMs
 */
export class VmApiService extends ApiService {
  constructor() {
    super('/workload')
  }

  async getAll(): Promise<WorkloadInfo[]> {
    return this.get<WorkloadInfo[]>('/')
  }

  async getByName(name: string): Promise<WorkloadInfo> {
    return this.get<WorkloadInfo>(`/${name}`)
  }

  async start(name: string): Promise<WorkloadActionResult> {
    return this.post<WorkloadActionResult>(`/${name}/start`)
  }

  async stop(name: string): Promise<WorkloadActionResult> {
    return this.post<WorkloadActionResult>(`/${name}/stop`)
  }

  async restart(name: string): Promise<WorkloadActionResult> {
    return this.post<WorkloadActionResult>(`/${name}/restart`)
  }

  async setAutostart(name: string, autostart: boolean): Promise<{ success: boolean; autostart: boolean }> {
    return this.put<{ success: boolean; autostart: boolean }>(`/${name}/autostart`, { autostart })
  }

  async setDescription(name: string, description: string): Promise<{ success: boolean; description: string }> {
    return this.put<{ success: boolean; description: string }>(`/${name}/description`, { description })
  }

  async setTags(name: string, tags: string[]): Promise<{ success: boolean; tags: string[] }> {
    return this.put<{ success: boolean; tags: string[] }>(`/${name}/tags`, { tags })
  }

  async scan(): Promise<{ discovered: string[]; added: string[]; existing: string[] }> {
    return this.post<{ discovered: string[]; added: string[]; existing: string[] }>('/scan')
  }

  async create(input: VmCreateInput): Promise<WorkloadActionResult> {
    return this.post<WorkloadActionResult>('/', input)
  }

  async remove(name: string): Promise<WorkloadActionResult> {
    return this.delete<WorkloadActionResult>(`/${name}`)
  }

  async getLogs(name: string): Promise<{ name: string; log: string }> {
    return this.get<{ name: string; log: string }>(`/${name}/logs`)
  }
}

export const vmApiService = new VmApiService()

/**
 * Distro entry returned by the API
 */
export interface DistroEntry {
  name: string
  label: string
  description?: string
  url: string
  effectiveUrl: string
  format: 'qcow2' | 'raw' | 'iso'
  cloudInit: boolean
  guestOs?: 'linux' | 'windows'
  builtin: boolean
  hasOverride: boolean
  category: 'builtin' | 'catalog' | 'custom'
  license?: string
}

export interface UrlValidationResult {
  distro: string
  url: string
  status: 'valid' | 'invalid' | typeof STATUSES.UNKNOWN
  httpStatus?: number
  error?: string
  checkedAt: string
}

export interface UrlValidationData {
  results: Record<string, UrlValidationResult>
  lastRunAt: string | null
}

export interface DistroTestStatus {
  status: typeof STATUSES.RUNNING | 'passed' | typeof STATUSES.FAILED | 'none'
  error?: string
  durationSeconds?: number
  startedAt?: string
}

/**
 * Input for adding a custom distro
 */
export interface CustomDistroInput {
  name: string
  label: string
  url?: string
  format: 'qcow2' | 'raw' | 'iso'
  cloudInit: boolean
  guestOs?: 'linux' | 'windows'
}

/**
 * Distro API service for managing distributions
 */
export class DistroApiService extends ApiService {
  constructor() {
    super('/distros')
  }

  async getAll(): Promise<DistroEntry[]> {
    return this.get<DistroEntry[]>('/')
  }

  async add(input: CustomDistroInput): Promise<{ success: boolean; message: string }> {
    return this.post<{ success: boolean; message: string }>('/', input)
  }

  async remove(name: string): Promise<{ success: boolean; message: string }> {
    return this.delete<{ success: boolean; message: string }>(`/${name}`)
  }

  async refreshCatalog(): Promise<{ success: boolean; updated: boolean; count: number }> {
    return this.post<{ success: boolean; updated: boolean; count: number }>('/refresh-catalog')
  }

  async getUrlStatus(): Promise<UrlValidationData> {
    return this.get<UrlValidationData>('/url-status')
  }

  async validateUrls(): Promise<UrlValidationData> {
    return this.post<UrlValidationData>('/validate-urls')
  }

  async updateUrl(name: string, url: string): Promise<{ success: boolean; message: string }> {
    return this.put<{ success: boolean; message: string }>(`/${name}/url`, { url })
  }

  async resetUrlOverride(name: string): Promise<{ success: boolean; message: string }> {
    return this.delete<{ success: boolean; message: string }>(`/${name}/url-override`)
  }

  async startTest(name: string): Promise<{ status: string; message: string }> {
    return this.post<{ status: string; message: string }>(`/${name}/test`)
  }

  async getTestStatus(name: string): Promise<DistroTestStatus> {
    return this.get<DistroTestStatus>(`/${name}/test`)
  }
}

export const distroApiService = new DistroApiService()

/**
 * Network API service for topology data
 */
export class NetworkApiService extends ApiService {
  constructor() {
    super('/network')
  }

  async getTopology(): Promise<NetworkTopology> {
    return this.get<NetworkTopology>('/topology')
  }

  // Weaver Solo+ endpoints

  async getBridges(): Promise<{ bridges: BridgeInfo[] }> {
    return this.get<{ bridges: BridgeInfo[] }>('/bridges')
  }

  async createBridge(bridge: { name: string; subnet: string; gateway: string }): Promise<{ success: boolean; message: string }> {
    return this.post<{ success: boolean; message: string }>('/bridges', bridge)
  }

  async deleteBridge(name: string): Promise<{ success: boolean; message: string }> {
    return this.delete<{ success: boolean; message: string }>(`/bridges/${name}`)
  }

  async getIpPool(bridge: string): Promise<IpPoolConfig> {
    return this.get<IpPoolConfig>(`/ip-pool/${bridge}`)
  }

  async setIpPool(bridge: string, pool: { start: string; end: string; allocated?: string[] }): Promise<{ success: boolean; message: string }> {
    return this.put<{ success: boolean; message: string }>(`/ip-pool/${bridge}`, pool)
  }

  async getFirewallRules(): Promise<{ rules: FirewallRule[] }> {
    return this.get<{ rules: FirewallRule[] }>('/firewall')
  }

  async addFirewallRule(rule: Omit<FirewallRule, 'id'>): Promise<{ success: boolean; rule: FirewallRule }> {
    return this.post<{ success: boolean; rule: FirewallRule }>('/firewall', rule)
  }

  async deleteFirewallRule(id: string): Promise<{ success: boolean; message: string }> {
    return this.delete<{ success: boolean; message: string }>(`/firewall/${id}`)
  }

  async getVmNetworkConfig(vmName: string): Promise<{ ip?: string; bridge?: string; gateway?: string; dns?: string }> {
    return this.get<{ ip?: string; bridge?: string; gateway?: string; dns?: string }>(`/vm-config/${vmName}`)
  }

  async setVmNetworkConfig(vmName: string, config: { ip?: string; bridge?: string; gateway?: string; dns?: string }): Promise<{ success: boolean; message: string }> {
    return this.put<{ success: boolean; message: string }>(`/vm-config/${vmName}`, config)
  }
}

export const networkApiService = new NetworkApiService()

/**
 * Notification API service
 */
export class NotificationApiService extends ApiService {
  /** Mutable in-memory config for demo mode — shared across all method calls. */
  private _demoConfig: NotificationChannelConfigData | null = null

  constructor() {
    super('/notifications')
  }

  private _initDemoConfig(): NotificationChannelConfigData {
    if (!this._demoConfig) {
      this._demoConfig = {
        version: 1,
        channels: {
          'ntfy-alerts': {
            type: 'ntfy',
            enabled: true,
            url: 'https://ntfy.sh',
            topic: 'microvm-alerts',
            events: ['vm:failed', 'vm:recovered', 'resource:high-cpu', 'resource:high-memory', 'security:auth-failure'],
          },
          'webhook-slack': {
            type: 'webhook',
            enabled: false,
            url: 'https://hooks.slack.com/services/demo/demo/demo',
            method: 'POST',
            format: 'slack',
            events: ['vm:failed', 'vm:recovered'],
          },
        },
        globalDefaults: {
          enabledEvents: ['vm:failed', 'vm:recovered', 'resource:high-cpu', 'resource:high-memory'],
        },
        resourceAlerts: { cpuThresholdPercent: 80, memoryThresholdPercent: 85, checkIntervalSeconds: 60 },
      }
    }
    return this._demoConfig
  }

  async getRecent(limit = 50): Promise<{ notifications: NotificationEvent[] }> {
    return this.get<{ notifications: NotificationEvent[] }>(`/?limit=${limit}`)
  }

  async sendTest(): Promise<{ sent: string[]; failed: string[] }> {
    return this.post<{ sent: string[]; failed: string[] }>('/test')
  }

  async getConfig(): Promise<NotificationChannelConfigData> {
    if (isDemoMode()) return this._initDemoConfig()
    return this.get<NotificationChannelConfigData>('/config')
  }

  async setChannel(channelId: string, config: ChannelConfig): Promise<{ ok: boolean; channelId: string }> {
    if (isDemoMode()) {
      this._initDemoConfig().channels[channelId] = config
      return { ok: true, channelId }
    }
    return this.put<{ ok: boolean; channelId: string }>(`/config/channels/${channelId}`, config)
  }

  async removeChannel(channelId: string): Promise<{ ok: boolean; channelId: string }> {
    if (isDemoMode()) {
      delete this._initDemoConfig().channels[channelId]
      return { ok: true, channelId }
    }
    return this.delete<{ ok: boolean; channelId: string }>(`/config/channels/${channelId}`)
  }

  async testChannel(channelId: string): Promise<{ success: boolean; channelId: string }> {
    if (isDemoMode()) return { success: true, channelId }
    return this.post<{ success: boolean; channelId: string }>(`/config/channels/${channelId}/test`)
  }

  async updateResourceAlerts(alerts: Partial<ResourceAlertConfig>): Promise<{ ok: boolean; resourceAlerts: ResourceAlertConfig }> {
    if (isDemoMode()) {
      const cfg = this._initDemoConfig()
      cfg.resourceAlerts = { ...cfg.resourceAlerts, ...alerts }
      return { ok: true, resourceAlerts: cfg.resourceAlerts }
    }
    return this.put<{ ok: boolean; resourceAlerts: ResourceAlertConfig }>('/config/resource-alerts', alerts)
  }

  async generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
    if (isDemoMode()) {
      return {
        publicKey: 'BDemo_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        privateKey: 'demo_private_AAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      }
    }
    return this.post<{ publicKey: string; privateKey: string }>('/web-push/generate-vapid-keys')
  }

  async getVapidPublicKey(): Promise<{ vapidPublicKey: string }> {
    if (isDemoMode()) return { vapidPublicKey: 'BDemo_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }
    return this.get<{ vapidPublicKey: string }>('/web-push/vapid-public-key')
  }

  async subscribePush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<{ ok: boolean }> {
    if (isDemoMode()) return { ok: true }
    return this.post<{ ok: boolean }>('/web-push/subscribe', subscription)
  }

  async unsubscribePush(endpoint: string): Promise<{ ok: boolean }> {
    if (isDemoMode()) return { ok: true }
    return this.delete<{ ok: boolean }>('/web-push/subscribe', { data: { endpoint } })
  }
}

export const notificationApiService = new NotificationApiService()

/**
 * Audit entry returned by the backend
 */
export interface AuditEntry {
  id: string
  timestamp: string
  userId: string | null
  username: string
  action: string
  resource?: string
  details?: Record<string, unknown>
  ip?: string
  success: boolean
}

export interface AuditQueryResult {
  entries: AuditEntry[]
  total: number
  limit: number
  offset: number
}

export interface AuditQueryParams {
  userId?: string
  action?: string
  resource?: string
  since?: string
  until?: string
  success?: string
  limit?: number
  offset?: number
}

/**
 * Audit API service for querying audit log entries
 */
export class AuditApiService extends ApiService {
  constructor() {
    super('/audit')
  }

  async query(params: AuditQueryParams = {}): Promise<AuditQueryResult> {
    // Build query string from non-undefined params
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '' && value !== null) {
        searchParams.set(key, String(value))
      }
    }
    const qs = searchParams.toString()
    return this.get<AuditQueryResult>(qs ? `/?${qs}` : '/')
  }
}

export const auditApiService = new AuditApiService()

// ─── Preset Tags ────────────────────────────────────────────────────────────

export class PresetTagApiService extends ApiService {
  constructor() {
    super('/tags')
  }

  async getAll(): Promise<string[]> {
    const res = await this.get<{ tags: string[] }>('/')
    return res.tags
  }

  async set(tags: string[]): Promise<string[]> {
    const res = await this.put<{ tags: string[] }>('/', { tags })
    return res.tags
  }
}

export const presetTagApiService = new PresetTagApiService()

// ── Host Info ─────────────────────────────────────────────────────────

export class HostApiService extends ApiService {
  constructor() {
    super('/host')
  }

  async getDetailed(): Promise<import('src/types/host').HostDetailedInfo> {
    return this.get<import('src/types/host').HostDetailedInfo>('/')
  }
}

export const hostApiService = new HostApiService()

// ── Doctor (System Health) ────────────────────────────────────────────────

export class DoctorApiService extends ApiService {
  constructor() {
    super('/system/doctor')
  }

  async runDiagnostics(): Promise<import('src/types/host').DoctorResult> {
    return this.get<import('src/types/host').DoctorResult>('/')
  }
}

export const doctorApiService = new DoctorApiService()

// ── Host Config ────────────────────────────────────────────────────────────

export class HostConfigApiService extends ApiService {
  constructor() {
    super('/config')
  }

  async getConfig(): Promise<import('src/types/host-config').NixConfigResponse> {
    return this.get<import('src/types/host-config').NixConfigResponse>('/')
  }
}

export const hostConfigApiService = new HostConfigApiService()

// ── Organization Identity ─────────────────────────────────────────────────

export class OrganizationApiService extends ApiService {
  constructor() {
    super('/organization')
  }

  async getIdentity(): Promise<import('src/types/organization').OrganizationIdentity> {
    if (isDemoMode()) {
      return { name: '', logoUrl: null, contactEmail: null, contactPhone: null }
    }
    return this.get<import('src/types/organization').OrganizationIdentity>('/')
  }

  async setIdentity(identity: Partial<import('src/types/organization').OrganizationIdentity>): Promise<import('src/types/organization').OrganizationIdentity> {
    if (isDemoMode()) {
      return { name: '', logoUrl: null, contactEmail: null, contactPhone: null, ...identity }
    }
    return this.put<import('src/types/organization').OrganizationIdentity>('/', identity)
  }
}

export const organizationApiService = new OrganizationApiService()

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { VmInfo, VmCreateInput, VmActionResult } from '../types/vm.js'
import type { AgentAction, AgentOperationStarted } from '../types/agent.js'
import type { NetworkTopology } from '../types/network.js'
import type { DistroEntry } from '../types/distro.js'
import type { VmTemplate } from '../types/template.js'
import type { SafeUser, UserQuota, VmAcl } from '../types/user.js'
import type { AuditEntry, AuditQueryParams } from '../types/audit.js'
import type { Notification } from '../types/notification.js'
import type { FleetBridge } from '../types/fleet-bridge.js'

export interface ApiResponse<T> {
  status: number
  data: T
}

export interface AuthResponse {
  user: { id: string; username: string; role: string; createdAt: string }
  token: string
  refreshToken: string
}

export interface HealthResponse {
  status: string
  tier: string
  provisioningEnabled: boolean
  bridgeGateway: string | null
  hasServerKey: boolean
  host: Record<string, unknown> | null
}

export class TuiApiClient {
  private baseUrl: string
  private getToken: () => string | null
  private refreshTokenValue: string | null = null
  private refreshing: Promise<boolean> | null = null

  constructor(baseUrl: string, getToken: () => string | null) {
    this.baseUrl = baseUrl
    this.getToken = getToken
  }

  setRefreshToken(token: string | null): void {
    this.refreshTokenValue = token
  }

  private async request<T>(method: string, path: string, body?: unknown, skipAuth = false): Promise<ApiResponse<T>> {
    const token = this.getToken()
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (!skipAuth && token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    // Attempt token refresh on 401
    if (res.status === 401 && !skipAuth && this.refreshTokenValue) {
      const refreshed = await this.tryRefresh()
      if (refreshed) {
        return this.request<T>(method, path, body, true)
      }
    }

    const data = await res.json().catch(() => ({}) as T) as T
    return { status: res.status, data }
  }

  private async tryRefresh(): Promise<boolean> {
    if (this.refreshing) return this.refreshing

    this.refreshing = (async () => {
      try {
        const result = await this.request<AuthResponse>(
          'POST', '/api/auth/refresh',
          { refreshToken: this.refreshTokenValue },
          true
        )
        if (result.status === 200) {
          this.refreshTokenValue = result.data.refreshToken
          return true
        }
        return false
      } catch {
        return false
      } finally {
        this.refreshing = null
      }
    })()

    return this.refreshing
  }

  // Auth
  async logout(): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('POST', '/api/auth/logout')
  }

  async checkSetupRequired(): Promise<ApiResponse<{ setupRequired: boolean }>> {
    return this.request('GET', '/api/auth/setup-required', undefined, true)
  }

  async login(username: string, password: string): Promise<ApiResponse<AuthResponse>> {
    const result = await this.request<AuthResponse>('POST', '/api/auth/login', { username, password }, true)
    if (result.status === 200) {
      this.refreshTokenValue = result.data.refreshToken
    }
    return result
  }

  // Health
  async getHealth(): Promise<ApiResponse<HealthResponse>> {
    return this.request('GET', '/api/health')
  }

  // VMs
  async listVms(): Promise<ApiResponse<VmInfo[]>> {
    return this.request('GET', '/api/workload')
  }

  async getVm(name: string): Promise<ApiResponse<VmInfo>> {
    return this.request('GET', `/api/workload/${encodeURIComponent(name)}`)
  }

  async startVm(name: string): Promise<ApiResponse<VmActionResult>> {
    return this.request('POST', `/api/workload/${encodeURIComponent(name)}/start`)
  }

  async stopVm(name: string): Promise<ApiResponse<VmActionResult>> {
    return this.request('POST', `/api/workload/${encodeURIComponent(name)}/stop`)
  }

  async restartVm(name: string): Promise<ApiResponse<VmActionResult>> {
    return this.request('POST', `/api/workload/${encodeURIComponent(name)}/restart`)
  }

  // Agent
  async startAgent(
    vmName: string,
    action: AgentAction,
    apiKey?: string,
    vendor?: string,
  ): Promise<ApiResponse<AgentOperationStarted>> {
    return this.request('POST', `/api/workload/${encodeURIComponent(vmName)}/agent`, {
      action,
      ...(apiKey ? { apiKey } : {}),
      ...(vendor ? { vendor } : {}),
    })
  }

  async getAgentStatus(vmName: string, operationId: string): Promise<ApiResponse<unknown>> {
    return this.request('GET', `/api/workload/${encodeURIComponent(vmName)}/agent/${encodeURIComponent(operationId)}`)
  }

  // VM management
  async createVm(input: VmCreateInput): Promise<ApiResponse<VmActionResult>> {
    return this.request('POST', '/api/workload', input)
  }

  async deleteVm(name: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request('DELETE', `/api/workload/${encodeURIComponent(name)}`)
  }

  async scanVms(): Promise<ApiResponse<{ discovered: string[]; added: string[]; existing: string[] }>> {
    return this.request('POST', '/api/workload/scan')
  }

  // Auth
  async register(username: string, password: string): Promise<ApiResponse<AuthResponse>> {
    const result = await this.request<AuthResponse>('POST', '/api/auth/register', { username, password }, true)
    if (result.status === 201) {
      this.refreshTokenValue = result.data.refreshToken
    }
    return result
  }

  // Network
  async getNetworkTopology(): Promise<ApiResponse<NetworkTopology>> {
    return this.request('GET', '/api/network/topology')
  }

  // Host
  async getHostInfo(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request('GET', '/api/host/')
  }

  // Distros
  async listDistros(): Promise<ApiResponse<DistroEntry[]>> {
    return this.request('GET', '/api/distros')
  }

  // Templates
  async listTemplates(): Promise<ApiResponse<VmTemplate[]>> {
    return this.request('GET', '/api/templates')
  }

  // Notifications
  async getNotifications(limit = 50): Promise<ApiResponse<{ notifications: Notification[] }>> {
    return this.request('GET', `/api/notifications?limit=${limit}`)
  }

  // Users
  async listUsers(): Promise<ApiResponse<SafeUser[]>> {
    return this.request('GET', '/api/users')
  }

  async updateUserRole(id: string, role: string): Promise<ApiResponse<SafeUser>> {
    return this.request('PUT', `/api/users/${encodeURIComponent(id)}/role`, { role })
  }

  async deleteUser(id: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('DELETE', `/api/users/${encodeURIComponent(id)}`)
  }

  // Quotas (fabrick)
  async getUserQuotas(id: string): Promise<ApiResponse<UserQuota>> {
    return this.request('GET', `/api/users/${encodeURIComponent(id)}/quotas`)
  }

  async setUserQuotas(id: string, quotas: Partial<UserQuota>): Promise<ApiResponse<UserQuota>> {
    return this.request('PUT', `/api/users/${encodeURIComponent(id)}/quotas`, quotas)
  }

  // VM ACL (fabrick)
  async getVmAcl(id: string): Promise<ApiResponse<VmAcl>> {
    return this.request('GET', `/api/users/${encodeURIComponent(id)}/vms`)
  }

  async setVmAcl(id: string, vmNames: string[]): Promise<ApiResponse<VmAcl>> {
    return this.request('PUT', `/api/users/${encodeURIComponent(id)}/vms`, { vmNames })
  }

  // Logs
  async getVmLogs(name: string): Promise<ApiResponse<{ name: string; log: string }>> {
    return this.request('GET', `/api/workload/${encodeURIComponent(name)}/logs`)
  }

  // Audit (fabrick)
  async getAuditLog(params?: AuditQueryParams): Promise<ApiResponse<{ entries: AuditEntry[]; total: number }>> {
    const qs = new URLSearchParams()
    if (params?.userId) qs.set('userId', params.userId)
    if (params?.action) qs.set('action', params.action)
    if (params?.resource) qs.set('resource', params.resource)
    if (params?.since) qs.set('since', params.since)
    if (params?.until) qs.set('until', params.until)
    if (params?.success !== undefined) qs.set('success', String(params.success))
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    const query = qs.toString()
    return this.request('GET', `/api/audit${query ? '?' + query : ''}`)
  }

  // Fleet bridges (Fabrick v3.0+)
  async getFleetBridges(): Promise<ApiResponse<FleetBridge[]>> {
    return this.request('GET', '/api/bridges/fleet')
  }
}

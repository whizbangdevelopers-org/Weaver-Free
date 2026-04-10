// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { defineStore } from 'pinia'
import { api } from 'src/boot/axios'
import { useSettingsStore } from 'src/stores/settings-store'
import { isDemoMode } from 'src/config/demo'
import { ROLES, type UserRole } from 'src/constants/vocabularies'

export type SectorId =
  | 'healthcare'
  | 'defense'
  | 'financial'
  | 'pharma'
  | 'education-k12'
  | 'education-higher'
  | 'government'
  | 'manufacturing'
  | 'research'
  | 'msp'
  | 'homelab'
  | 'student'

export const SECTOR_OPTIONS: { label: string; value: SectorId }[] = [
  { label: 'Healthcare', value: 'healthcare' },
  { label: 'Defense / Government Contractor', value: 'defense' },
  { label: 'Financial Services', value: 'financial' },
  { label: 'Pharma / Life Sciences', value: 'pharma' },
  { label: 'Education (K-12)', value: 'education-k12' },
  { label: 'Education (Higher Ed)', value: 'education-higher' },
  { label: 'Government / Public Sector', value: 'government' },
  { label: 'Manufacturing / OT', value: 'manufacturing' },
  { label: 'Research / HPC', value: 'research' },
  { label: 'MSP / IT Consulting', value: 'msp' },
  { label: 'Home Lab / Personal', value: 'homelab' },
  { label: 'Student', value: 'student' },
]

export interface UserPreferences {
  hasSeenWizard?: boolean
}

export interface AuthUser {
  id: string
  username: string
  role: UserRole
  createdAt: string
  preferences: UserPreferences
  sector: SectorId | null
}

export interface AuthState {
  user: AuthUser | null
  /** @deprecated Tokens now transported via httpOnly cookies. Kept for TUI backward compat. */
  token: string | null
  /** @deprecated Tokens now transported via httpOnly cookies. Kept for TUI backward compat. */
  refreshToken: string | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
    refreshToken: null,
  }),

  getters: {
    isAuthenticated: (state): boolean => !!state.user,
    isAdmin: (state): boolean => state.user?.role === ROLES.ADMIN,
    /** Admin or operator (can perform mutations on VMs and network) */
    isOperator: (state): boolean => state.user?.role === ROLES.ADMIN || state.user?.role === ROLES.OPERATOR,
    /** Can start/stop/restart/create VMs (admin or operator) */
    canManageVms: (state): boolean => state.user?.role === ROLES.ADMIN || state.user?.role === ROLES.OPERATOR,
    /** Can delete VMs (admin only) */
    canDeleteVms: (state): boolean => state.user?.role === ROLES.ADMIN,
    /** Can add/remove custom distributions (admin only) */
    canManageDistros: (state): boolean => state.user?.role === ROLES.ADMIN,
    /** Can start/stop/restart containers (admin or operator) */
    canManageContainers: (state): boolean => state.user?.role === ROLES.ADMIN || state.user?.role === ROLES.OPERATOR,
    /** Can delete containers (admin only) */
    canDeleteContainers: (state): boolean => state.user?.role === ROLES.ADMIN,
    /** Can register new users and manage user accounts (admin only) */
    canManageUsers: (state): boolean => state.user?.role === ROLES.ADMIN,
    displayName: (state): string => state.user?.username ?? '',
    userRole: (state): string => state.user?.role ?? '',
  },

  actions: {
    async login(username: string, password: string): Promise<void> {
      if (isDemoMode()) { this.loginAsDemo(); return }
      const response = await api.post('/auth/login', { username, password })
      const { user, token, refreshToken } = response.data
      this.user = user
      this.token = token
      this.refreshToken = refreshToken
      // Sync server-side wizard preference to local settings store (no PATCH back)
      useSettingsStore().syncWizardFromServer(!!user.preferences?.hasSeenWizard)
    },

    async register(username: string, password: string, sector?: SectorId): Promise<void> {
      if (isDemoMode()) { this.loginAsDemo(); return }
      const response = await api.post('/auth/register', { username, password, sector })
      const { user, token, refreshToken } = response.data
      this.user = user
      this.token = token
      this.refreshToken = refreshToken
      // Reset wizard so Getting Started dialog shows after fresh install
      useSettingsStore().resetWizard()
    },

    async refresh(): Promise<boolean> {
      if (isDemoMode()) return true
      if (!this.refreshToken) return false

      try {
        const response = await api.post('/auth/refresh', {
          refreshToken: this.refreshToken,
        })
        const { token, refreshToken } = response.data
        this.token = token
        this.refreshToken = refreshToken
        return true
      } catch {
        this.clearAuth()
        return false
      }
    },

    async fetchMe(): Promise<void> {
      const response = await api.get('/auth/me')
      this.user = response.data.user
      // Sync server-side wizard preference to local settings store (no PATCH back)
      if (response.data.user.preferences?.hasSeenWizard) {
        useSettingsStore().syncWizardFromServer(true)
      }
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
      await api.put('/auth/password', { currentPassword, newPassword })
    },

    async updateSector(sector: SectorId): Promise<void> {
      if (isDemoMode()) {
        if (this.user) this.user.sector = sector
        return
      }
      await api.put('/auth/me/sector', { sector })
      if (this.user) this.user.sector = sector
    },

    async logout(): Promise<void> {
      if (!isDemoMode()) {
        try {
          await api.post('/auth/logout')
        } catch {
          // Ignore logout API errors — clear local state regardless
        }
      }
      this.clearAuth()
    },

    /** Enter demo mode with a synthetic admin user (no backend required). */
    loginAsDemo() {
      this.user = {
        id: 'demo-user',
        username: 'demo',
        role: ROLES.ADMIN,
        createdAt: new Date().toISOString(),
        preferences: {},
        sector: null,
      }
      this.token = 'demo-token'
      this.refreshToken = null
    },

    clearAuth() {
      this.user = null
      this.token = null
      this.refreshToken = null
    },

    loadFromStorage() {
      // pinia-plugin-persistedstate handles this automatically
      // This method exists for explicit calls if needed
    },
  },

  persist: {
    key: 'auth',
    paths: ['user'],  // Tokens transported via httpOnly cookies — no localStorage
  },
})

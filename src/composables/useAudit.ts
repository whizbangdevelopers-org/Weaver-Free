// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { ref, reactive, computed, watch } from 'vue'
import { auditApiService } from 'src/services/api'
import type { AuditEntry, AuditQueryParams } from 'src/services/api'
import { extractErrorMessage } from 'src/utils/error'
import { isDemoMode } from 'src/config/demo-mode'
import { ROLES } from 'src/constants/vocabularies'

/** Known audit action categories for color-coding and filtering */
export const AUDIT_ACTION_CATEGORIES = {
  vm: ['vm.start', 'vm.stop', 'vm.restart', 'vm.create', 'vm.delete', 'vm.scan'],
  auth: ['user.login', 'user.register', 'user.password-change'],
  admin: ['admin.user-role-change', 'admin.config-change'],
} as const

/** All known action values for the filter dropdown */
export const AUDIT_ACTIONS = [
  ...AUDIT_ACTION_CATEGORIES.vm,
  ...AUDIT_ACTION_CATEGORIES.auth,
  ...AUDIT_ACTION_CATEGORIES.admin,
]

/** Map action prefix to display category */
export function actionCategory(action: string): 'vm' | 'auth' | 'admin' | 'other' {
  if (action.startsWith('vm.')) return 'vm'
  if (action.startsWith('user.')) return 'auth'
  if (action.startsWith('admin.')) return 'admin'
  return 'other'
}

/** Map category to Quasar color */
export function actionColor(action: string): string {
  switch (actionCategory(action)) {
    case 'vm': return 'blue'
    case 'auth': return 'orange'
    case 'admin': return 'purple'
    default: return 'grey'
  }
}

const DEFAULT_LIMIT = 50

export interface AuditFilters {
  action: string
  userId: string
  resource: string
  since: string
  until: string
}

export function useAudit() {
  const entries = ref<AuditEntry[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const offset = ref(0)
  const limit = ref(DEFAULT_LIMIT)

  const filters = reactive<AuditFilters>({
    action: '',
    userId: '',
    resource: '',
    since: '',
    until: '',
  })

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))
  const currentPage = computed(() => Math.floor(offset.value / limit.value) + 1)
  const hasNext = computed(() => offset.value + limit.value < total.value)
  const hasPrev = computed(() => offset.value > 0)

  async function fetch() {
    loading.value = true
    error.value = null

    try {
      if (isDemoMode()) {
        const _t = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString()
        entries.value = [
          { id: 'a-01', action: 'user.login',             userId: 'demo-user',   username: 'demo',      ip: '192.168.1.10', success: true,  timestamp: _t(5) },
          { id: 'a-02', action: 'vm.start',               userId: 'demo-ops',    username: 'operator1', resource: 'qa-staging',      ip: '192.168.1.11', success: true,  timestamp: _t(24 * 60) },
          { id: 'a-03', action: 'vm.stop',                userId: 'demo-ops',    username: 'operator1', resource: 'qa-load-test',    ip: '192.168.1.11', success: true,  timestamp: _t(26 * 60) },
          { id: 'a-04', action: 'vm.restart',             userId: 'demo-user',   username: 'demo',      resource: 'lb-haproxy-01',   ip: '192.168.1.10', success: true,  timestamp: _t(48 * 60) },
          { id: 'a-05', action: 'admin.user-role-change', userId: 'demo-user',   username: 'demo',      resource: 'viewer1',         ip: '192.168.1.10', success: true,  timestamp: _t(72 * 60),  details: { from: ROLES.VIEWER, to: ROLES.OPERATOR } },
          { id: 'a-06', action: 'vm.create',              userId: 'demo-user',   username: 'demo',      resource: 'qa-staging',      ip: '192.168.1.10', success: true,  timestamp: _t(96 * 60) },
          { id: 'a-07', action: 'user.login',             userId: 'demo-viewer', username: 'viewer1',   ip: '10.0.0.55',  success: false, timestamp: _t(120 * 60), details: { reason: 'invalid password' } },
          { id: 'a-08', action: 'admin.config-change',    userId: 'demo-user',   username: 'demo',      resource: 'settings',        ip: '192.168.1.10', success: true,  timestamp: _t(144 * 60), details: { change: 'Added ntfy push channel' } },
          { id: 'a-09', action: 'vm.delete',              userId: 'demo-ops',    username: 'operator1', resource: 'qa-load-test',    ip: '192.168.1.11', success: false, timestamp: _t(168 * 60), details: { reason: 'insufficient permissions' } },
          { id: 'a-10', action: 'user.register',          userId: 'demo-viewer', username: 'viewer1',   ip: '192.168.1.10', success: true,  timestamp: _t(7 * 24 * 60) },
        ]
        total.value = entries.value.length
        return
      }

      const params: AuditQueryParams = {
        limit: limit.value,
        offset: offset.value,
      }

      if (filters.action) params.action = filters.action
      if (filters.userId) params.userId = filters.userId
      if (filters.resource) params.resource = filters.resource
      if (filters.since) params.since = new Date(filters.since).toISOString()
      if (filters.until) params.until = new Date(filters.until).toISOString()

      const result = await auditApiService.query(params)
      entries.value = result.entries
      total.value = result.total
    } catch (err) {
      error.value = extractErrorMessage(err, 'Failed to load audit log')
    } finally {
      loading.value = false
    }
  }

  function nextPage() {
    if (hasNext.value) {
      offset.value += limit.value
    }
  }

  function prevPage() {
    if (hasPrev.value) {
      offset.value = Math.max(0, offset.value - limit.value)
    }
  }

  function goToPage(page: number) {
    offset.value = (page - 1) * limit.value
  }

  function resetFilters() {
    filters.action = ''
    filters.userId = ''
    filters.resource = ''
    filters.since = ''
    filters.until = ''
    offset.value = 0
  }

  function applyFilters() {
    offset.value = 0
    void fetch()
  }

  // Refetch when offset changes (pagination)
  watch(offset, () => {
    void fetch()
  })

  return {
    entries,
    total,
    loading,
    error,
    filters,
    offset,
    limit,
    totalPages,
    currentPage,
    hasNext,
    hasPrev,
    fetch,
    nextPage,
    prevPage,
    goToPage,
    resetFilters,
    applyFilters,
  }
}

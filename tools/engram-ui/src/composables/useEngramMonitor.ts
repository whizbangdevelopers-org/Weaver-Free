// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

import { ref } from 'vue'

// Response types — mirrors backend/src/routes/engram.ts

export interface EngramToolStat {
  tool: string
  count: number
  avg_latency_ms: number
  last_called: number
}

export interface EngramIngestionSummary {
  ts: number
  dataset: string
  entry_count: number
  success_count: number
  failure_count: number
  improved: boolean | number
  duration_ms: number
}

export interface EngramStatus {
  dbExists: boolean
  dbSizeBytes: number
  totalQueries: number
  lastIngestion: EngramIngestionSummary | null
  queryCountsByTool: EngramToolStat[]
}

export interface EngramQueryRow {
  id: number
  ts: number
  tool: string
  params: string
  result_count: number
  result_ids: string
  latency_ms: number
}

export interface EngramIngestionRow {
  id: number
  ts: number
  dataset: string
  entry_count: number
  success_count: number
  failure_count: number
  improved: boolean | number
  duration_ms: number
  flags: string
}

const LIMIT = 50

async function weaverFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    credentials: 'include',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = `HTTP ${res.status}`
    try {
      const j = JSON.parse(text) as Record<string, unknown>
      msg = String(j['error'] ?? j['message'] ?? msg)
    } catch { if (text) msg += `: ${text}` }
    const err = new Error(msg)
    ;(err as Error & { status: number }).status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

function isAuthError(err: unknown): boolean {
  const s = (err as Error & { status?: number }).status
  return s === 401 || s === 403
}

export function useEngramMonitor() {
  const weaverAuthed = ref(false)
  const loginLoading = ref(false)
  const loginError = ref<string | null>(null)

  const status = ref<EngramStatus | null>(null)
  const statusLoading = ref(false)
  const statusError = ref<string | null>(null)

  const queries = ref<EngramQueryRow[]>([])
  const queriesTotal = ref(0)
  const queriesOffset = ref(0)
  const queriesLoading = ref(false)
  const queriesError = ref<string | null>(null)
  const queryToolFilter = ref<string | null>(null)

  const runs = ref<EngramIngestionRow[]>([])
  const runsTotal = ref(0)
  const runsOffset = ref(0)
  const runsLoading = ref(false)
  const runsError = ref<string | null>(null)

  async function weaverLogin(username: string, password: string) {
    loginLoading.value = true
    loginError.value = null
    try {
      await weaverFetch('/weaver/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      weaverAuthed.value = true
    } catch (err) {
      loginError.value = err instanceof Error ? err.message : 'Login failed'
    } finally {
      loginLoading.value = false
    }
  }

  async function weaverLogout() {
    await fetch('/weaver/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    weaverAuthed.value = false
    status.value = null
    queries.value = []
    runs.value = []
  }

  async function fetchStatus() {
    statusLoading.value = true
    statusError.value = null
    try {
      status.value = await weaverFetch<EngramStatus>('/weaver/api/engram/status')
      weaverAuthed.value = true
    } catch (err) {
      if (isAuthError(err)) weaverAuthed.value = false
      statusError.value = err instanceof Error ? err.message : 'Failed to load status'
    } finally {
      statusLoading.value = false
    }
  }

  async function fetchQueries(offset = 0) {
    queriesLoading.value = true
    queriesOffset.value = offset
    queriesError.value = null
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) })
      if (queryToolFilter.value) params.set('tool', queryToolFilter.value)
      const data = await weaverFetch<{ queries: EngramQueryRow[]; total: number }>(
        `/weaver/api/engram/queries?${params}`,
      )
      queries.value = data.queries
      queriesTotal.value = data.total
      weaverAuthed.value = true
    } catch (err) {
      if (isAuthError(err)) weaverAuthed.value = false
      queriesError.value = err instanceof Error ? err.message : 'Failed to load queries'
    } finally {
      queriesLoading.value = false
    }
  }

  async function fetchIngestionHistory(offset = 0) {
    runsLoading.value = true
    runsOffset.value = offset
    runsError.value = null
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) })
      const data = await weaverFetch<{ runs: EngramIngestionRow[]; total: number }>(
        `/weaver/api/engram/ingestion-history?${params}`,
      )
      runs.value = data.runs
      runsTotal.value = data.total
      weaverAuthed.value = true
    } catch (err) {
      if (isAuthError(err)) weaverAuthed.value = false
      runsError.value = err instanceof Error ? err.message : 'Failed to load ingestion history'
    } finally {
      runsLoading.value = false
    }
  }

  async function checkAuthAndLoad() {
    // Probe with status; if auth succeeds, the tab is ready
    await fetchStatus()
    if (weaverAuthed.value) {
      await Promise.all([fetchQueries(0), fetchIngestionHistory(0)])
    }
  }

  return {
    weaverAuthed,
    loginLoading,
    loginError,
    status,
    statusLoading,
    statusError,
    queries,
    queriesTotal,
    queriesOffset,
    queriesLoading,
    queriesError,
    queryToolFilter,
    runs,
    runsTotal,
    runsOffset,
    runsLoading,
    runsError,
    LIMIT,
    weaverLogin,
    weaverLogout,
    fetchStatus,
    fetchQueries,
    fetchIngestionHistory,
    checkAuthAndLoad,
  }
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

import { ref } from 'vue'

// Response types — mirrors backend/src/routes/engram.ts
// Auth is handled at the RBAC layer (Weaver Team/Fabrick) on integration.

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

export interface EngramPgvectorStats {
  chunks: number
  summaries: number
  entities: number
}

export interface EngramStats {
  totalEntries: number
  strategy: 'embed-only' | 'embed+graph' | 'full-cognify'
  pgvector: EngramPgvectorStats | null
}

export interface EngramGraphNode {
  id: string
  title: string
  domain: string
  type: string
  scope: string
  status: string
}

export interface EngramGraphEdge {
  source: string
  target: string
}

export interface EngramGraphData {
  nodes: EngramGraphNode[]
  edges: EngramGraphEdge[]
}

export interface EngramEntryDomainRow {
  domain: string
  type: string
  scope: string
  count: number
}

export interface EngramComponentStatus {
  available: boolean
  latencyMs: number | null
  detail: string | null
}

export interface EngramInfrastructure {
  llm:       EngramComponentStatus
  embedding: EngramComponentStatus & { headroomPer15s: number | null }
  pipeline:  EngramComponentStatus
  pgvector:  EngramComponentStatus
  methodFeasibility: {
    gradual:         boolean
    additive:        boolean
    priorityTrickle: boolean
    bulkReprocess:   boolean
    parallelAtomic:  boolean
  }
  polledAt: number
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
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export function useEngramMonitor() {
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

  const entries = ref<EngramEntryDomainRow[]>([])
  const entriesTotal = ref(0)
  const entriesLoading = ref(false)
  const entriesError = ref<string | null>(null)

  const engramStats = ref<EngramStats | null>(null)
  const statsLoading = ref(false)
  const statsError = ref<string | null>(null)

  const graphData = ref<EngramGraphData | null>(null)
  const graphLoading = ref(false)
  const graphError = ref<string | null>(null)

  const infrastructure = ref<EngramInfrastructure | null>(null)
  const infraLoading = ref(false)
  const infraError = ref<string | null>(null)

  async function fetchStatus() {
    statusLoading.value = true
    statusError.value = null
    try {
      status.value = await weaverFetch<EngramStatus>('/weaver/api/engram/status')
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      runsError.value = err instanceof Error ? err.message : 'Failed to load ingestion history'
    } finally {
      runsLoading.value = false
    }
  }

  async function fetchEntries() {
    entriesLoading.value = true
    entriesError.value = null
    try {
      const data = await weaverFetch<{ entries: EngramEntryDomainRow[]; total: number }>(
        '/weaver/api/engram/entries',
      )
      entries.value = data.entries
      entriesTotal.value = data.total
    } catch (err) {
      entriesError.value = err instanceof Error ? err.message : 'Failed to load registry'
    } finally {
      entriesLoading.value = false
    }
  }

  async function fetchStats() {
    statsLoading.value = true
    statsError.value = null
    try {
      engramStats.value = await weaverFetch<EngramStats>('/weaver/api/engram/stats')
    } catch (err) {
      statsError.value = err instanceof Error ? err.message : 'Failed to load stats'
    } finally {
      statsLoading.value = false
    }
  }

  async function fetchGraphData() {
    graphLoading.value = true
    graphError.value = null
    try {
      graphData.value = await weaverFetch<EngramGraphData>('/weaver/api/engram/graph-data')
    } catch (err) {
      graphError.value = err instanceof Error ? err.message : 'Failed to load graph data'
    } finally {
      graphLoading.value = false
    }
  }

  async function fetchInfrastructure() {
    infraLoading.value = true
    infraError.value = null
    try {
      infrastructure.value = await weaverFetch<EngramInfrastructure>('/weaver/api/engram/infrastructure')
    } catch (err) {
      infraError.value = err instanceof Error ? err.message : 'Failed to probe infrastructure'
    } finally {
      infraLoading.value = false
    }
  }

  async function viewEntries(domain: string, type?: string, scope?: string): Promise<{ entryCount: number; content: string | null; note?: string }> {
    return weaverFetch('/weaver/api/engram/view', {
      method: 'POST',
      body: JSON.stringify({ domain, type, scope }),
    })
  }

  async function loadAll() {
    await Promise.all([fetchStatus(), fetchQueries(0), fetchIngestionHistory(0), fetchEntries(), fetchStats(), fetchGraphData()])
  }

  return {
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
    fetchStatus,
    fetchQueries,
    fetchIngestionHistory,
    fetchEntries,
    entries,
    entriesTotal,
    entriesLoading,
    entriesError,
    engramStats,
    statsLoading,
    statsError,
    fetchStats,
    graphData,
    graphLoading,
    graphError,
    fetchGraphData,
    infrastructure,
    infraLoading,
    infraError,
    fetchInfrastructure,
    viewEntries,
    loadAll,
  }
}

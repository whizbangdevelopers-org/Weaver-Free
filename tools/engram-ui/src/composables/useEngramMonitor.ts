// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

import { ref } from 'vue'

// Localized off the deleted useEngram (Cognee) composable (greenfield rebuild, WVR-198).
export type ProcessingStrategy = 'embed-only' | 'embed+graph' | 'full-engram'

// Semantic-recall result shape (pgvector /engram-query/search) — replaces useEngram.RecallResult.
export interface RecallResult {
  text: string
  score: number
  metadata?: Record<string, unknown>
}

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
  project: string
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

export interface HostCapacity {
  cpus:      number
  cpu_model: string
  memory_mb: number
  disk_gb:   number
}

export interface HostNetwork {
  ips?:     Record<string, string>
  bridges?: Record<string, string>
}

export interface HostRecord {
  hostname:    string
  role:        string
  os:          string
  arch:        string
  status:      string
  capacity:    HostCapacity
  network:     HostNetwork
  facts:       Record<string, unknown>
  lastProbed:  number | null
  lastUpdated: number
}

export type HostInput = Omit<HostRecord, 'lastProbed' | 'lastUpdated'>
export type HostPatch = Partial<Omit<HostRecord, 'hostname' | 'lastProbed' | 'lastUpdated'>>

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

  // Semantic recall over the served pgvector store (replaces the deleted useEngram.recall).
  const results = ref<RecallResult[]>([])
  const recallLoading = ref(false)
  const recallError = ref<string | null>(null)

  const graphData = ref<EngramGraphData | null>(null)
  const graphLoading = ref(false)
  const graphError = ref<string | null>(null)

  const infrastructure = ref<EngramInfrastructure | null>(null)
  const infraLoading = ref(false)
  const infraError = ref<string | null>(null)

  // Governance-console health — is engram-query reachable? (replaces the Cognee
  // sidecar status check the old shell owned.)
  const health = ref<'checking' | 'available' | 'unavailable'>('checking')
  async function checkHealth() {
    health.value = 'checking'
    try {
      const res = await fetch('/engram-query/entries')
      health.value = res.ok ? 'available' : 'unavailable'
    } catch {
      health.value = 'unavailable'
    }
  }

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

  async function fetchIngestionHistory(offset = 0, strategy?: string) {
    runsLoading.value = true
    runsOffset.value = offset
    runsError.value = null
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) })
      if (strategy) params.set('strategy', strategy)
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
      const res = await fetch('/engram-query/entries')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { entries: EngramEntryDomainRow[]; total: number }
      entries.value = data.entries
      entriesTotal.value = data.total
    } catch (err) {
      entriesError.value = err instanceof Error ? err.message : 'Failed to load registry'
    } finally {
      entriesLoading.value = false
    }
  }

  async function fetchGraphData() {
    graphLoading.value = true
    graphError.value = null
    try {
      const res = await fetch('/engram-query/graph-data')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      graphData.value = await res.json() as EngramGraphData
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

  // Knowledge search — semantic recall over engram_chunks via the engram-query FastAPI.
  async function searchKnowledge(query: string): Promise<void> {
    recallLoading.value = true
    recallError.value = null
    results.value = []
    try {
      const res = await fetch(`/engram-query/search?q=${encodeURIComponent(query)}&limit=50`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as {
        results: Array<{ project: string; entry_id: string; chunk_type: string; content: string; score: number; metadata?: Record<string, unknown> }>
      }
      results.value = (data.results ?? []).map((r) => ({
        text: r.content,
        score: r.score,
        metadata: { project: r.project, entry_id: r.entry_id, chunk_type: r.chunk_type, ...r.metadata },
      }))
    } catch (err) {
      recallError.value = err instanceof Error ? err.message : 'Search failed'
    } finally {
      recallLoading.value = false
    }
  }

  async function viewEntries(domain: string, type?: string, scope?: string, project?: string): Promise<{ entryCount: number; content: string | null; note?: string }> {
    const res = await fetch('/engram-query/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, domain, type, scope }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  async function loadAll() {
    await Promise.all([fetchStatus(), fetchQueries(0), fetchIngestionHistory(0), fetchEntries(), fetchGraphData()])
  }

  // ── Host inventory ────────────────────────────────────────────────────────
  const hosts         = ref<HostRecord[]>([])
  const hostsLoading  = ref(false)
  const hostsError    = ref<string | null>(null)

  async function fetchHosts() {
    hostsLoading.value = true
    hostsError.value   = null
    try {
      const data = await weaverFetch<{ hosts: HostRecord[] }>('/weaver/api/engram/hosts')
      hosts.value = data.hosts
    } catch (e) {
      hostsError.value = e instanceof Error ? e.message : 'Failed to load hosts'
    } finally {
      hostsLoading.value = false
    }
  }

  async function createHost(input: HostInput): Promise<HostRecord> {
    const data = await weaverFetch<{ host: HostRecord }>('/weaver/api/engram/hosts', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    await fetchHosts()
    return data.host
  }

  async function updateHost(hostname: string, patch: HostPatch): Promise<HostRecord> {
    const data = await weaverFetch<{ host: HostRecord }>(`/weaver/api/engram/hosts/${encodeURIComponent(hostname)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    })
    await fetchHosts()
    return data.host
  }

  async function deleteHost(hostname: string): Promise<void> {
    await weaverFetch(`/weaver/api/engram/hosts/${encodeURIComponent(hostname)}`, { method: 'DELETE' })
    hosts.value = hosts.value.filter(h => h.hostname !== hostname)
  }

  async function syncHostsFromInventory(): Promise<{ synced: number; errors: string[] }> {
    return weaverFetch<{ synced: number; errors: string[] }>('/weaver/api/engram/hosts/sync', { method: 'POST', body: '{}' })
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
    graphData,
    graphLoading,
    graphError,
    fetchGraphData,
    infrastructure,
    infraLoading,
    infraError,
    fetchInfrastructure,
    viewEntries,
    results,
    recallLoading,
    recallError,
    searchKnowledge,
    health,
    checkHealth,
    loadAll,
    hosts,
    hostsLoading,
    hostsError,
    fetchHosts,
    createHost,
    updateHost,
    deleteHost,
    syncHostsFromInventory,
  }
}

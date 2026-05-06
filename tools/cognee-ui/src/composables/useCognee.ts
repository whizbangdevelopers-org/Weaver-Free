// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

import { ref } from 'vue'

export type SidecarStatus = 'checking' | 'available' | 'unavailable'
export type SearchType = 'CHUNKS' | 'GRAPH_COMPLETION' | 'SUMMARIES'

export interface Dataset {
  id: string
  name: string
  created_at: string
  owner_id: string
}

export interface RecallResult {
  text: string
  score: number
  metadata?: Record<string, unknown>
}

export interface GraphNode {
  id: string
  label: string
  type: string
  properties: Record<string, unknown>
}

export interface GraphEdge {
  source: string
  target: string
  label: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface LLMConfig {
  provider: string
  model: string
  api_key: string
}

export interface VectorDBConfig {
  provider: string
  url: string
  api_key: string
}

export interface Settings {
  llm: LLMConfig
  vector_db: VectorDBConfig
}

export interface ApiKey {
  id: string
  key: string
  label: string
  name: string
}

export interface PipelineRun {
  id: string
  pipeline_name: string
  status: string | null
  dataset_id: string | null
  dataset_name: string | null
  created_at: string | null
  pipeline_run_id: string | null
}

// Terminal statuses — polling stops when all runs are terminal
const TERMINAL = new Set([
  'DATASET_PROCESSING_COMPLETED',
  'DATASET_PROCESSING_ERRORED',
])

function isInFlight(runs: PipelineRun[]): boolean {
  return runs.some((r) => r.status !== null && !TERMINAL.has(r.status))
}

function extractError(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return fallback
}

const RECALL_TIMEOUT = 10_000
const ADD_TIMEOUT = 30_000
const DEFAULT_TIMEOUT = 5_000

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  timeout = DEFAULT_TIMEOUT,
): Promise<T> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(path, { ...options, signal: controller.signal })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let msg = `HTTP ${res.status}`
      try {
        const json = JSON.parse(text)
        msg = json.error || json.detail || msg
      } catch {
        if (text) msg += `: ${text}`
      }
      throw new Error(msg)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(id)
  }
}

export function useCognee() {
  const status = ref<SidecarStatus>('checking')
  const statusDetail = ref<{ version: string; llmBackend: string } | null>(null)
  const datasets = ref<Dataset[]>([])
  const activeDatasetId = ref<string | null>(null)
  const results = ref<RecallResult[]>([])
  const graphData = ref<GraphData | null>(null)
  const settings = ref<Settings | null>(null)
  const apiKeys = ref<ApiKey[]>([])
  const pipelineRuns = ref<PipelineRun[]>([])
  const loading = ref(false)
  const activityLoading = ref(false)
  const error = ref<string | null>(null)

  let pollTimer: ReturnType<typeof setInterval> | null = null

  // ── Activity polling ──────────────────────────────────────────────────────

  async function listPipelineRuns() {
    activityLoading.value = true
    try {
      pipelineRuns.value = await apiFetch<PipelineRun[]>('/api/v1/activity/pipeline-runs')
    } catch {
      // silent — activity is best-effort
    } finally {
      activityLoading.value = false
    }
  }

  function startActivityPolling() {
    stopActivityPolling()
    pollTimer = setInterval(async () => {
      await listPipelineRuns()
      if (!isInFlight(pipelineRuns.value)) stopActivityPolling()
    }, 2000)
  }

  function stopActivityPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  // ── Core API ──────────────────────────────────────────────────────────────

  async function checkStatus() {
    status.value = 'checking'
    error.value = null
    try {
      const data = await apiFetch<Record<string, unknown>>('/health')
      status.value = 'available'
      statusDetail.value = {
        version: String(data.version ?? ''),
        llmBackend: String(data.llm_provider ?? data.llmBackend ?? ''),
      }
    } catch (err) {
      status.value = 'unavailable'
      statusDetail.value = null
      error.value = extractError(err, 'Sidecar unreachable')
    }
  }

  async function listDatasets() {
    loading.value = true
    error.value = null
    try {
      datasets.value = await apiFetch<Dataset[]>('/api/v1/datasets')
    } catch (err) {
      error.value = extractError(err, 'Failed to load datasets')
    } finally {
      loading.value = false
    }
  }

  async function recall(query: string, searchType: SearchType = 'CHUNKS') {
    loading.value = true
    error.value = null
    results.value = []
    try {
      const body: Record<string, unknown> = { query, searchType }
      if (activeDatasetId.value) {
        const ds = datasets.value.find((d) => d.id === activeDatasetId.value)
        if (ds) body.datasets = [ds.name]
      }
      const data = await apiFetch<RecallResult[]>(
        '/api/v1/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        RECALL_TIMEOUT,
      )
      results.value = Array.isArray(data) ? data : []
    } catch (err) {
      error.value = extractError(err, 'Recall failed')
    } finally {
      loading.value = false
    }
  }

  // Add text content as a .txt file upload, then cognify synchronously.
  async function remember(text: string, datasetName: string) {
    loading.value = true
    error.value = null
    try {
      const file = new File([text], 'content.txt', { type: 'text/plain' })
      await addData([file], datasetName)
      await cognifyDataset([datasetName], undefined, false)
    } catch (err) {
      error.value = extractError(err, 'Remember failed')
      throw err
    } finally {
      loading.value = false
    }
  }

  // Upload one or more files to a dataset (add step only — no cognify).
  async function addData(files: File[], datasetName: string, datasetId?: string): Promise<void> {
    const form = new FormData()
    for (const f of files) form.append('data', f)
    form.append('datasetName', datasetName)
    if (datasetId) form.append('datasetId', datasetId)
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), ADD_TIMEOUT)
    try {
      const res = await fetch('/api/v1/add', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let msg = `HTTP ${res.status}`
        try {
          const json = JSON.parse(text)
          msg = json.error || json.detail || msg
        } catch {
          if (text) msg += `: ${text}`
        }
        throw new Error(msg)
      }
    } finally {
      clearTimeout(id)
    }
  }

  // Trigger cognify on one or more datasets by name or id.
  // background=true: returns immediately, starts activity polling.
  // background=false: blocks until pipeline completes (used by remember()).
  async function cognifyDataset(
    datasetNames?: string[],
    datasetIds?: string[],
    background = true,
  ): Promise<void> {
    await apiFetch(
      '/api/v1/cognify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasets: datasetNames,
          dataset_ids: datasetIds,
          run_in_background: background,
        }),
      },
      background ? DEFAULT_TIMEOUT : 120_000,
    )
    if (background) {
      await listPipelineRuns()
      startActivityPolling()
    }
  }

  async function fetchGraph(datasetId: string) {
    loading.value = true
    error.value = null
    graphData.value = null
    try {
      graphData.value = await apiFetch<GraphData>(`/api/v1/datasets/${datasetId}/graph`)
    } catch (err) {
      error.value = extractError(err, 'Failed to load graph')
    } finally {
      loading.value = false
    }
  }

  async function getSettings() {
    loading.value = true
    error.value = null
    try {
      settings.value = await apiFetch<Settings>('/api/v1/settings')
    } catch (err) {
      error.value = extractError(err, 'Failed to load settings')
    } finally {
      loading.value = false
    }
  }

  async function saveSettings(
    payload: Partial<{ llm: Partial<LLMConfig>; vector_db: Partial<VectorDBConfig> }>,
  ) {
    loading.value = true
    error.value = null
    try {
      await apiFetch('/api/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await getSettings()
    } catch (err) {
      error.value = extractError(err, 'Failed to save settings')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function listApiKeys() {
    loading.value = true
    error.value = null
    try {
      apiKeys.value = await apiFetch<ApiKey[]>('/api/v1/auth/api-keys')
    } catch (err) {
      error.value = extractError(err, 'Failed to load API keys')
    } finally {
      loading.value = false
    }
  }

  async function createApiKey(name?: string) {
    loading.value = true
    error.value = null
    try {
      const key = await apiFetch<ApiKey>('/api/v1/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      await listApiKeys()
      return key
    } catch (err) {
      error.value = extractError(err, 'Failed to create API key')
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteApiKey(id: string) {
    loading.value = true
    error.value = null
    try {
      await apiFetch(`/api/v1/auth/api-keys/${id}`, { method: 'DELETE' })
      await listApiKeys()
    } catch (err) {
      error.value = extractError(err, 'Failed to delete API key')
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    status,
    statusDetail,
    datasets,
    activeDatasetId,
    results,
    graphData,
    settings,
    apiKeys,
    pipelineRuns,
    loading,
    activityLoading,
    error,
    checkStatus,
    listDatasets,
    recall,
    remember,
    addData,
    cognifyDataset,
    listPipelineRuns,
    startActivityPolling,
    stopActivityPolling,
    fetchGraph,
    getSettings,
    saveSettings,
    listApiKeys,
    createApiKey,
    deleteApiKey,
  }
}

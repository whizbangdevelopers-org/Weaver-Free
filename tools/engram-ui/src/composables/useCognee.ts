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

export interface DataFile {
  id: string
  name: string
  extension: string
  mime_type: string
  raw_data_location: string
  created_at: string
  updated_at: string | null
  dataset_id: string
}

// Terminal statuses — polling stops when all runs are terminal
const TERMINAL = new Set([
  'DATASET_PROCESSING_COMPLETED',
  'DATASET_PROCESSING_ERRORED',
])

// Per-pipeline stale thresholds. Add is fast (seconds); cognify is slow (up to 2h).
// Runs older than their threshold in a non-terminal state are zombie records —
// the sidecar was killed before writing terminal status. They don't drive polling.
export const STALE_MS: Record<string, number> = {
  add_pipeline:     5 * 60 * 1000,        // 5 min
  cognify_pipeline: 2 * 60 * 60 * 1000,   // 2 h
}
export const DEFAULT_STALE_MS = 30 * 60 * 1000   // 30 min fallback for unknown pipelines

function staleMsFor(pipelineName: string | null): number {
  return STALE_MS[pipelineName ?? ''] ?? DEFAULT_STALE_MS
}

function isInFlight(runs: PipelineRun[]): boolean {
  return runs.some((r) => {
    if (r.status === null || TERMINAL.has(r.status)) return false
    if (!r.created_at) return false
    const age = Date.now() - new Date(r.created_at).getTime()
    return !isNaN(age) && age < staleMsFor(r.pipeline_name)
  })
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
  const datasetFiles = ref<DataFile[]>([])
  const currentUser = ref<string | null>(null)
  const loading = ref(false)
  const activityLoading = ref(false)
  const filesLoading = ref(false)
  const error = ref<string | null>(null)
  const graphStatus = ref<string | null>(null)

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let graphController: AbortController | null = null

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

  // Two-phase timeout: 10s to get first byte, then 1s per 20KB for body transfer.
  // Graph payloads vary wildly with dataset size — a fixed timeout is either too short
  // for large graphs or masks hangs on small ones. Content-Length lets us set the
  // transfer window proportionally once we know the server is responding.
  function cancelGraph() {
    graphController?.abort()
    graphController = null
  }

  async function fetchGraph(datasetId: string) {
    cancelGraph() // abort any in-flight request
    loading.value = true
    error.value = null
    graphData.value = null
    graphStatus.value = 'Connecting…'
    graphController = new AbortController()
    const signal = graphController.signal
    let timerId: ReturnType<typeof setTimeout> | null = null
    const arm = (ms: number) => {
      if (timerId) clearTimeout(timerId)
      timerId = setTimeout(() => graphController?.abort(), ms)
    }
    try {
      arm(10_000) // connection timeout
      const res = await fetch(`/api/v1/datasets/${datasetId}/graph`, { signal })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let msg = `HTTP ${res.status}`
        try { const j = JSON.parse(text); msg = j.error || j.detail || msg } catch { if (text) msg += `: ${text}` }
        throw new Error(msg)
      }
      // Transfer timeout: 1s per 20KB, min 15s, max 120s
      const cl = res.headers.get('content-length')
      const bytes = cl ? parseInt(cl, 10) : NaN
      const transferMs = isNaN(bytes) ? 60_000 : Math.min(120_000, Math.max(15_000, Math.ceil(bytes / 20_000) * 1_000))
      arm(transferMs)
      graphStatus.value = isNaN(bytes)
        ? 'Transferring…'
        : `Transferring ${Math.round(bytes / 1024)} KB…`
      const raw = (await res.json()) as GraphData
      graphStatus.value = 'Rendering…'
      graphData.value = raw
    } catch (err) {
      error.value = extractError(err, 'Failed to load graph')
      throw err
    } finally {
      if (timerId) clearTimeout(timerId)
      graphController = null
      loading.value = false
      graphStatus.value = null
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

  async function fetchCurrentUser() {
    try {
      const data = await apiFetch<{ email: string }>('/api/v1/auth/me')
      currentUser.value = data.email
    } catch {
      currentUser.value = null
    }
  }

  async function login(email: string, password: string) {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let msg = 'Login failed'
      try { msg = JSON.parse(text).detail ?? msg } catch { /* ignore */ }
      throw new Error(msg)
    }
    currentUser.value = email
  }

  async function logout() {
    await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {})
    currentUser.value = null
    datasets.value = []
    activeDatasetId.value = null
    results.value = []
    graphData.value = null
    datasetFiles.value = []
    pipelineRuns.value = []
  }

  async function listDatasetFiles(datasetId: string) {
    filesLoading.value = true
    datasetFiles.value = []
    try {
      datasetFiles.value = await apiFetch<DataFile[]>(`/api/v1/datasets/${datasetId}/data`)
    } catch (err) {
      error.value = extractError(err, 'Failed to load dataset files')
    } finally {
      filesLoading.value = false
    }
  }

  async function deleteDatasetFile(datasetId: string, dataId: string) {
    try {
      await apiFetch(`/api/v1/datasets/${datasetId}/data/${dataId}`, { method: 'DELETE' })
      datasetFiles.value = datasetFiles.value.filter((f) => f.id !== dataId)
    } catch (err) {
      error.value = extractError(err, 'Failed to delete file')
      throw err
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
    datasetFiles,
    currentUser,
    loading,
    activityLoading,
    filesLoading,
    error,
    graphStatus,
    checkStatus,
    fetchCurrentUser,
    login,
    logout,
    listDatasets,
    recall,
    remember,
    addData,
    cognifyDataset,
    listPipelineRuns,
    startActivityPolling,
    stopActivityPolling,
    fetchGraph,
    cancelGraph,
    getSettings,
    saveSettings,
    listApiKeys,
    createApiKey,
    deleteApiKey,
    listDatasetFiles,
    deleteDatasetFile,
  }
}

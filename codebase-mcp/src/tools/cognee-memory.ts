// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Cognee live-memory tools — HTTP client for the cognee sidecar.
 *
 * These are the first HTTP-client tools in the coding MCP server. All calls use
 * Node 24 native fetch. All fail gracefully when the sidecar is not reachable,
 * returning { available: false, error: string } instead of throwing.
 *
 * Sidecar URL: COGNEE_URL env var (default: http://localhost:8765)
 * Sidecar is available on Foundry when the cognee NixOS service is running
 * (v1.4.0+). Returns unavailable gracefully on developer workstations.
 */

const COGNEE_URL = process.env.COGNEE_URL ?? 'http://localhost:8765'
const TIMEOUT_MS = 2000

export interface CogneeStatusResult {
  available: boolean
  version?: string
  llmBackend?: string
  datasets?: string[]
  error?: string
}

export interface CogneeRecallItem {
  text: string
  score: number
  metadata?: Record<string, unknown>
}

export interface CogneeRecallResult {
  available: boolean
  results: CogneeRecallItem[]
  query?: string
  dataset?: string
  searchType?: string
  error?: string
}

export interface CogneeRememberResult {
  available: boolean
  status?: string
  error?: string
}

export interface CogneeImproveResult {
  available: boolean
  entitiesExtracted?: number
  error?: string
}

export interface CogneeForgetResult {
  available: boolean
  error?: string
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
}

export async function cogStatus(): Promise<CogneeStatusResult> {
  try {
    const res = await fetchWithTimeout(`${COGNEE_URL}/health`)
    if (!res.ok) {
      return { available: false, error: `cognee health check returned HTTP ${res.status}` }
    }
    const body = await res.json() as Record<string, unknown>

    // Fetch datasets alongside status
    let datasets: string[] | undefined
    try {
      const dsRes = await fetchWithTimeout(`${COGNEE_URL}/api/v1/datasets`)
      if (dsRes.ok) {
        const dsBody = await dsRes.json() as Array<{ name: string }>
        datasets = dsBody.map(d => d.name)
      }
    } catch {
      // datasets unavailable, non-fatal
    }

    return {
      available: true,
      version: typeof body.version === 'string' ? body.version : undefined,
      llmBackend: typeof body.llmBackend === 'string' ? body.llmBackend : undefined,
      datasets,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { available: false, error: `cognee sidecar not reachable at ${COGNEE_URL}: ${msg}` }
  }
}

export async function cogRecall(
  query: string,
  dataset?: string,
  searchType?: string
): Promise<CogneeRecallResult> {
  // Default CHUNKS — GRAPH_COMPLETION requires KuzuDB graph data which cognee's
  // extract_graph_and_summarize pipeline fails to produce with Anthropic models
  // at max_tokens=2048 (KnowledgeGraph JSON consistently exceeds output budget).
  // CHUNKS searches LanceDB embeddings only — works without successful graph extraction.
  const resolvedType = searchType ?? 'CHUNKS'
  try {
    const body: Record<string, unknown> = {
      query,
      searchType: resolvedType,
    }
    if (dataset) body.datasets = [dataset]

    const res = await fetchWithTimeout(`${COGNEE_URL}/api/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      return {
        available: true,
        results: [],
        error: `recall returned HTTP ${res.status}: ${await res.text()}`,
      }
    }

    const raw = await res.json() as unknown[]
    const results: CogneeRecallItem[] = raw.map(item => {
      const r = item as Record<string, unknown>
      return {
        text: typeof r.text === 'string' ? r.text : JSON.stringify(r),
        score: typeof r.score === 'number' ? r.score : 0,
        metadata: typeof r.metadata === 'object' && r.metadata !== null
          ? r.metadata as Record<string, unknown>
          : undefined,
      }
    })

    return { available: true, results, query, dataset, searchType: resolvedType }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      available: false,
      results: [],
      error: `cognee sidecar not reachable at ${COGNEE_URL}: ${msg}`,
    }
  }
}

export async function cogImprove(sessionId: string): Promise<CogneeImproveResult> {
  try {
    const res = await fetchWithTimeout(`${COGNEE_URL}/api/v1/cognify/improve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    if (!res.ok) {
      return { available: true, error: `improve returned HTTP ${res.status}: ${await res.text()}` }
    }
    const body = await res.json() as Record<string, unknown>
    return {
      available: true,
      entitiesExtracted: typeof body.entitiesExtracted === 'number' ? body.entitiesExtracted : undefined,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { available: false, error: `cognee sidecar not reachable at ${COGNEE_URL}: ${msg}` }
  }
}

export async function cogForget(dataset: string): Promise<CogneeForgetResult> {
  try {
    const res = await fetchWithTimeout(`${COGNEE_URL}/api/v1/datasets`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset }),
    })
    if (!res.ok) {
      return { available: true, error: `forget returned HTTP ${res.status}: ${await res.text()}` }
    }
    return { available: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { available: false, error: `cognee sidecar not reachable at ${COGNEE_URL}: ${msg}` }
  }
}

export async function cogRemember(text: string, dataset: string): Promise<CogneeRememberResult> {
  try {
    const res = await fetchWithTimeout(`${COGNEE_URL}/api/v1/cognify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: text, datasets: [dataset] }),
    })

    if (!res.ok) {
      return {
        available: true,
        error: `remember returned HTTP ${res.status}: ${await res.text()}`,
      }
    }

    const body = await res.json() as Record<string, unknown>
    return {
      available: true,
      status: typeof body.status === 'string' ? body.status : 'ok',
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      available: false,
      error: `cognee sidecar not reachable at ${COGNEE_URL}: ${msg}`,
    }
  }
}

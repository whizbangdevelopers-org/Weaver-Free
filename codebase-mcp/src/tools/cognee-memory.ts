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
 * Auth:        COGNEE_EMAIL / COGNEE_PASSWORD env vars (default: seeder credentials).
 *              cognee scopes datasets by user even when REQUIRE_AUTHENTICATION=false,
 *              so a token is needed for any dataset-aware call. The token is fetched
 *              lazily on first use and cached until expiry.
 *
 * Tests: call setAuthToken('test-token') in beforeEach to bypass the login fetch.
 *        Call setAuthToken(null) in afterEach to reset.
 *
 * Sidecar is available on Foundry when the cognee NixOS service is running
 * (v1.4.0+). Returns unavailable gracefully on developer workstations.
 */

const COGNEE_URL = process.env.COGNEE_URL ?? 'http://localhost:8765'
const COGNEE_EMAIL = process.env.COGNEE_EMAIL ?? 'weaver@weaver.dev'
const COGNEE_PASSWORD = process.env.COGNEE_PASSWORD ?? 'weaver-dev-2026'
const TIMEOUT_MS = 2000        // health / lightweight calls
const SEARCH_TIMEOUT_MS = 10000 // vector search — warm LanceDB; first post-restart search <2s

// ---------------------------------------------------------------------------
// Auth token cache — injectable by tests via setAuthToken()
// ---------------------------------------------------------------------------

let _token: string | null = null
let _tokenExpiry = 0

/** Pre-set auth token (used by tests to skip the login fetch). */
export function setAuthToken(token: string | null, expiresAt?: number): void {
  _token = token
  _tokenExpiry = token ? (expiresAt ?? (Date.now() / 1000 + 7200)) : 0
}

async function getToken(): Promise<string | null> {
  if (_token && Date.now() / 1000 < _tokenExpiry - 60) return _token

  try {
    const res = await fetchWithTimeout(`${COGNEE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `username=${encodeURIComponent(COGNEE_EMAIL)}&password=${encodeURIComponent(COGNEE_PASSWORD)}`,
    })
    if (!res.ok) return null
    const body = await res.json() as { access_token?: string }
    const tok = body.access_token
    if (!tok) return null

    // Parse expiry from JWT payload
    let expiry = Date.now() / 1000 + 7200
    try {
      const payload = JSON.parse(atob(tok.split('.')[1])) as { exp?: number }
      if (typeof payload.exp === 'number') expiry = payload.exp
    } catch { /* ignore malformed JWT */ }

    setAuthToken(tok, expiry)
    return _token
  } catch {
    return null
  }
}

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
}

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

export async function cogStatus(): Promise<CogneeStatusResult> {
  try {
    const res = await fetchWithTimeout(`${COGNEE_URL}/health`)
    if (!res.ok) {
      return { available: false, error: `cognee health check returned HTTP ${res.status}` }
    }
    const body = await res.json() as Record<string, unknown>

    // Fetch datasets alongside status (requires auth — datasets are user-scoped)
    let datasets: string[] | undefined
    try {
      const token = await getToken()
      const dsRes = await fetchWithTimeout(`${COGNEE_URL}/api/v1/datasets`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
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
  // (LLM returns multiple tool_use blocks; instructor retries exhaust on BadRequestError).
  // CHUNKS searches LanceDB embeddings only — works without successful graph extraction.
  const resolvedType = searchType ?? 'CHUNKS'
  try {
    const token = await getToken()
    const reqBody: Record<string, unknown> = {
      query,
      searchType: resolvedType,
    }
    if (dataset) reqBody.datasets = [dataset]

    const res = await fetch(`${COGNEE_URL}/api/v1/search`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(reqBody),
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
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
    const token = await getToken()
    const res = await fetchWithTimeout(`${COGNEE_URL}/api/v1/cognify/improve`, {
      method: 'POST',
      headers: authHeaders(token),
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
    const token = await getToken()
    const res = await fetchWithTimeout(`${COGNEE_URL}/api/v1/datasets`, {
      method: 'DELETE',
      headers: authHeaders(token),
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
    const token = await getToken()
    const res = await fetchWithTimeout(`${COGNEE_URL}/api/v1/cognify`, {
      method: 'POST',
      headers: authHeaders(token),
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

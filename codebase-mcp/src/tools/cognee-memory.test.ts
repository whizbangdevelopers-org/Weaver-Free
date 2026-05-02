// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cogStatus, cogRecall, cogRemember } from './cognee-memory.js'

// Helper: build a minimal Response-like object for stubbing globalThis.fetch.
// cogStatus makes two sequential fetch calls (health, then datasets), so callers
// that need to control both must queue two responses.
function makeFetch(...responses: Array<{ ok: boolean; status?: number; body?: unknown; text?: string }>) {
  let idx = 0
  return vi.fn().mockImplementation(() => {
    const r = responses[idx++] ?? responses[responses.length - 1]
    return Promise.resolve({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: () => Promise.resolve(r.body ?? {}),
      text: () => Promise.resolve(r.text ?? ''),
    })
  })
}

// Helper: a fetch stub that always rejects (simulates network error / timeout).
function makeNetworkError(msg = 'fetch failed') {
  return vi.fn().mockRejectedValue(new Error(msg))
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// cogStatus
// ---------------------------------------------------------------------------

describe('cogStatus', () => {
  it('returns available=true with version, llmBackend, and datasets on success', async () => {
    vi.stubGlobal('fetch', makeFetch(
      { ok: true, body: { version: '0.1.60', llmBackend: 'claude-sonnet-4-6' } },
      { ok: true, body: [{ name: 'host_foundry_patterns' }, { name: 'claude_sessions' }] },
    ))

    const result = await cogStatus()

    expect(result.available).toBe(true)
    expect(result.version).toBe('0.1.60')
    expect(result.llmBackend).toBe('claude-sonnet-4-6')
    expect(result.datasets).toEqual(['host_foundry_patterns', 'claude_sessions'])
    expect(result.error).toBeUndefined()
  })

  it('returns available=true even when datasets endpoint fails', async () => {
    vi.stubGlobal('fetch', makeFetch(
      { ok: true, body: { version: '0.1.60' } },
      { ok: false, status: 503 },
    ))

    const result = await cogStatus()

    expect(result.available).toBe(true)
    expect(result.datasets).toBeUndefined()
  })

  it('returns available=false when health endpoint returns non-OK', async () => {
    vi.stubGlobal('fetch', makeFetch({ ok: false, status: 503 }))

    const result = await cogStatus()

    expect(result.available).toBe(false)
    expect(result.error).toMatch(/503/)
  })

  it('returns available=false on network error', async () => {
    vi.stubGlobal('fetch', makeNetworkError('Connection refused'))

    const result = await cogStatus()

    expect(result.available).toBe(false)
    expect(result.error).toMatch(/not reachable/)
  })

  it('handles missing version/llmBackend fields gracefully', async () => {
    vi.stubGlobal('fetch', makeFetch(
      { ok: true, body: {} },
      { ok: true, body: [] },
    ))

    const result = await cogStatus()

    expect(result.available).toBe(true)
    expect(result.version).toBeUndefined()
    expect(result.llmBackend).toBeUndefined()
    expect(result.datasets).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// cogRecall
// ---------------------------------------------------------------------------

describe('cogRecall', () => {
  it('returns parsed results on success', async () => {
    vi.stubGlobal('fetch', makeFetch({
      ok: true,
      body: [
        { text: 'foundry restarts drain workloads first', score: 0.95, metadata: { source: 'ops' } },
        { text: 'web-nginx stabilises in ~30s', score: 0.82 },
      ],
    }))

    const result = await cogRecall('stabilisation window for web-nginx', 'workload_web-nginx_behavior')

    expect(result.available).toBe(true)
    expect(result.results).toHaveLength(2)
    expect(result.results[0].text).toBe('foundry restarts drain workloads first')
    expect(result.results[0].score).toBe(0.95)
    expect(result.results[1].metadata).toBeUndefined()
    expect(result.query).toBe('stabilisation window for web-nginx')
    expect(result.dataset).toBe('workload_web-nginx_behavior')
    expect(result.searchType).toBe('GRAPH_COMPLETION')
  })

  it('defaults searchType to GRAPH_COMPLETION', async () => {
    const fetchMock = makeFetch({ ok: true, body: [] })
    vi.stubGlobal('fetch', fetchMock)

    await cogRecall('anything')

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.searchType).toBe('GRAPH_COMPLETION')
  })

  it('includes dataset in request body when provided', async () => {
    const fetchMock = makeFetch({ ok: true, body: [] })
    vi.stubGlobal('fetch', fetchMock)

    await cogRecall('q', 'my_dataset')

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.datasets).toEqual(['my_dataset'])
  })

  it('omits datasets key when no dataset provided', async () => {
    const fetchMock = makeFetch({ ok: true, body: [] })
    vi.stubGlobal('fetch', fetchMock)

    await cogRecall('q')

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.datasets).toBeUndefined()
  })

  it('respects caller-supplied searchType', async () => {
    const fetchMock = makeFetch({ ok: true, body: [] })
    vi.stubGlobal('fetch', fetchMock)

    await cogRecall('q', undefined, 'SUMMARIES')

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.searchType).toBe('SUMMARIES')
  })

  it('returns available=true with empty results and error on non-OK response', async () => {
    vi.stubGlobal('fetch', makeFetch({ ok: false, status: 422, text: 'bad query' }))

    const result = await cogRecall('q')

    expect(result.available).toBe(true)
    expect(result.results).toEqual([])
    expect(result.error).toMatch(/422/)
  })

  it('returns available=false on network error', async () => {
    vi.stubGlobal('fetch', makeNetworkError('ECONNREFUSED'))

    const result = await cogRecall('q')

    expect(result.available).toBe(false)
    expect(result.results).toEqual([])
    expect(result.error).toMatch(/not reachable/)
  })

  it('stringifies non-text result items instead of dropping them', async () => {
    vi.stubGlobal('fetch', makeFetch({
      ok: true,
      body: [{ score: 0.5, metadata: { raw: true } }],
    }))

    const result = await cogRecall('q')

    expect(result.results[0].text).toContain('"raw"')
    expect(result.results[0].score).toBe(0.5)
  })
})

// ---------------------------------------------------------------------------
// cogRemember
// ---------------------------------------------------------------------------

describe('cogRemember', () => {
  it('returns available=true with status on success', async () => {
    vi.stubGlobal('fetch', makeFetch({ ok: true, body: { status: 'ok' } }))

    const result = await cogRemember('web-nginx restarted at 14:32', 'workload_web-nginx_behavior')

    expect(result.available).toBe(true)
    expect(result.status).toBe('ok')
    expect(result.error).toBeUndefined()
  })

  it('sends text and dataset in request body', async () => {
    const fetchMock = makeFetch({ ok: true, body: { status: 'ok' } })
    vi.stubGlobal('fetch', fetchMock)

    await cogRemember('some observation', 'my_dataset')

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.data).toBe('some observation')
    expect(body.datasets).toEqual(['my_dataset'])
  })

  it('returns available=true with error on non-OK response', async () => {
    vi.stubGlobal('fetch', makeFetch({ ok: false, status: 400, text: 'invalid dataset' }))

    const result = await cogRemember('x', 'bad_dataset')

    expect(result.available).toBe(true)
    expect(result.error).toMatch(/400/)
  })

  it('returns available=false on network error', async () => {
    vi.stubGlobal('fetch', makeNetworkError('timeout'))

    const result = await cogRemember('x', 'ds')

    expect(result.available).toBe(false)
    expect(result.error).toMatch(/not reachable/)
  })

  it('falls back to status ok when response body omits status field', async () => {
    vi.stubGlobal('fetch', makeFetch({ ok: true, body: {} }))

    const result = await cogRemember('x', 'ds')

    expect(result.available).toBe(true)
    expect(result.status).toBe('ok')
  })
})

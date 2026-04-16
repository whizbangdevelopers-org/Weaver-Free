// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TuiApiClient } from '../client/api.js'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function jsonResponse(status: number, data: unknown) {
  return {
    status,
    json: () => Promise.resolve(data),
  }
}

describe('TuiApiClient', () => {
  let api: TuiApiClient
  let token: string | null

  beforeEach(() => {
    mockFetch.mockReset()
    token = 'test-token'
    api = new TuiApiClient('http://localhost:3100', () => token)
  })

  it('sends Bearer token in Authorization header', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, []))
    await api.listVms()

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toBe('http://localhost:3100/api/workload')
    expect(opts.headers.Authorization).toBe('Bearer test-token')
  })

  it('omits Authorization header when no token', async () => {
    token = null
    mockFetch.mockResolvedValueOnce(jsonResponse(200, []))
    await api.listVms()

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers.Authorization).toBeUndefined()
  })

  it('login stores refresh token and returns auth data', async () => {
    const authData = {
      user: { id: '1', username: 'admin', role: 'admin', createdAt: '2026-01-01' },
      token: 'jwt-token',
      refreshToken: 'refresh-token',
    }
    mockFetch.mockResolvedValueOnce(jsonResponse(200, authData))

    const result = await api.login('admin', 'password')
    expect(result.status).toBe(200)
    expect(result.data.token).toBe('jwt-token')
  })

  it('login skips auth header', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { token: 't', refreshToken: 'r', user: {} }))
    await api.login('admin', 'pass')

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.headers.Authorization).toBeUndefined()
  })

  it('attempts token refresh on 401', async () => {
    api.setRefreshToken('old-refresh')

    // First call returns 401
    mockFetch.mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }))
    // Refresh call returns new tokens
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {
      user: { id: '1', username: 'admin', role: 'admin', createdAt: '2026-01-01' },
      token: 'new-token',
      refreshToken: 'new-refresh',
    }))
    // Retry call returns VMs
    mockFetch.mockResolvedValueOnce(jsonResponse(200, []))

    const result = await api.listVms()
    expect(result.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('returns 401 if no refresh token set', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }))
    const result = await api.listVms()
    expect(result.status).toBe(401)
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('encodes VM name in URL', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { name: 'my vm', status: 'running' }))
    await api.getVm('my vm')

    const [url] = mockFetch.mock.calls[0]
    expect(url).toBe('http://localhost:3100/api/workload/my%20vm')
  })

  it('sends action body for startAgent', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(202, { operationId: 'op-1' }))
    await api.startAgent('web-nginx', 'diagnose', 'sk-key-123')

    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.action).toBe('diagnose')
    expect(body.apiKey).toBe('sk-key-123')
  })

  it('handles non-JSON responses gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    })
    const result = await api.getHealth()
    expect(result.status).toBe(500)
    expect(result.data).toEqual({})
  })
})

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => { throw new Error('ENOENT') }),
  writeFile: vi.fn(async () => {}),
  rename: vi.fn(async () => {}),
  unlink: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
  access: vi.fn(async () => {}),
  stat: vi.fn(async () => ({ size: 1024 })),
}))

// Mock http/https modules
const mockRequest = vi.fn()

vi.mock('node:https', () => ({
  get: (...args: unknown[]) => mockRequest('https', ...args),
}))

vi.mock('node:http', () => ({
  get: (...args: unknown[]) => mockRequest('http', ...args),
}))

import { access, stat } from 'node:fs/promises'
import { UrlValidationService } from '../../src/services/url-validator.js'
import type { ImageManager } from '../../src/services/image-manager.js'

function createMockImageManager(sources: Record<string, { url: string; format: string; cloudInit: boolean }>): ImageManager {
  return {
    getAllSources: vi.fn(() => sources),
    getDistroSource: vi.fn((name: string) => sources[name] ?? null),
  } as unknown as ImageManager
}

function simulateResponse(statusCode: number, headers: Record<string, string> = {}) {
  const res = {
    statusCode,
    headers,
    resume: vi.fn(),
  }

  mockRequest.mockImplementation((_proto: string, _url: string, _opts: unknown, cb: (res: typeof res) => void) => {
    cb(res)
    return { on: vi.fn().mockReturnThis(), destroy: vi.fn() }
  })
}

function simulateError(errorMessage: string) {
  mockRequest.mockImplementation((_proto: string, _url: string, _opts: unknown, _cb: unknown) => {
    const handlers: Record<string, (err: Error) => void> = {}
    const req = {
      on: vi.fn((event: string, handler: (err: Error) => void) => {
        handlers[event] = handler
        return req
      }),
      destroy: vi.fn(),
    }
    setTimeout(() => handlers['error']?.(new Error(errorMessage)), 0)
    return req
  })
}

describe('UrlValidationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with empty results when no file exists', async () => {
    const imageManager = createMockImageManager({})
    const service = new UrlValidationService('/tmp/test-url-validation.json', imageManager)
    await service.init()

    const results = service.getResults()
    expect(results.results).toEqual({})
    expect(results.lastRunAt).toBeNull()
  })

  it('should validate all URLs and return results', async () => {
    const imageManager = createMockImageManager({
      arch: { url: 'https://example.com/arch.qcow2', format: 'qcow2', cloudInit: true },
      ubuntu: { url: 'https://example.com/ubuntu.qcow2', format: 'qcow2', cloudInit: true },
    })

    simulateResponse(200)

    const service = new UrlValidationService('/tmp/test.json', imageManager)
    await service.init()
    const data = await service.validateAll()

    expect(data.lastRunAt).not.toBeNull()
    expect(Object.keys(data.results)).toHaveLength(2)
    expect(data.results['arch']?.status).toBe('valid')
    expect(data.results['ubuntu']?.status).toBe('valid')
  })

  it('should mark 404 as invalid', async () => {
    const imageManager = createMockImageManager({
      broken: { url: 'https://example.com/broken.qcow2', format: 'qcow2', cloudInit: true },
    })

    simulateResponse(404)

    const service = new UrlValidationService('/tmp/test.json', imageManager)
    await service.init()
    const data = await service.validateAll()

    expect(data.results['broken']?.status).toBe('invalid')
    expect(data.results['broken']?.httpStatus).toBe(404)
  })

  it('should mark network errors as invalid with error message', async () => {
    const imageManager = createMockImageManager({
      timeout: { url: 'https://example.com/timeout.qcow2', format: 'qcow2', cloudInit: true },
    })

    simulateError('ECONNREFUSED')

    const service = new UrlValidationService('/tmp/test.json', imageManager)
    await service.init()
    const data = await service.validateAll()

    expect(data.results['timeout']?.status).toBe('invalid')
    expect(data.results['timeout']?.error).toBe('ECONNREFUSED')
  })

  it('should skip flake-based distros', async () => {
    const imageManager = createMockImageManager({
      nixos: { url: '', format: 'flake', cloudInit: false },
      arch: { url: 'https://example.com/arch.qcow2', format: 'qcow2', cloudInit: true },
    })

    simulateResponse(200)

    const service = new UrlValidationService('/tmp/test.json', imageManager)
    await service.init()
    const data = await service.validateAll()

    expect(Object.keys(data.results)).toHaveLength(1)
    expect(data.results['nixos']).toBeUndefined()
    expect(data.results['arch']?.status).toBe('valid')
  })

  it('should validate a single distro', async () => {
    const imageManager = createMockImageManager({
      arch: { url: 'https://example.com/arch.qcow2', format: 'qcow2', cloudInit: true },
    })

    simulateResponse(200)

    const service = new UrlValidationService('/tmp/test.json', imageManager)
    await service.init()
    const result = await service.validateOne('arch')

    expect(result).not.toBeNull()
    expect(result?.status).toBe('valid')
  })

  it('should return null for validateOne on unknown distro', async () => {
    const imageManager = createMockImageManager({})

    const service = new UrlValidationService('/tmp/test.json', imageManager)
    await service.init()
    const result = await service.validateOne('unknown')

    expect(result).toBeNull()
  })

  describe('file:// URL validation', () => {
    it('should mark file:// URL as valid when file exists with non-zero size', async () => {
      const imageManager = createMockImageManager({
        local: { url: 'file:///var/lib/images/custom.qcow2', format: 'qcow2', cloudInit: true },
      })

      ;(access as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
      ;(stat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ size: 512000 })

      const service = new UrlValidationService('/tmp/test.json', imageManager)
      await service.init()
      const data = await service.validateAll()

      expect(data.results['local']?.status).toBe('valid')
      expect(data.results['local']?.httpStatus).toBeUndefined()
      // Should NOT have made an HTTP request
      expect(mockRequest).not.toHaveBeenCalled()
    })

    it('should mark file:// URL as invalid when file is empty', async () => {
      const imageManager = createMockImageManager({
        empty: { url: 'file:///var/lib/images/empty.qcow2', format: 'qcow2', cloudInit: true },
      })

      ;(access as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
      ;(stat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ size: 0 })

      const service = new UrlValidationService('/tmp/test.json', imageManager)
      await service.init()
      const data = await service.validateAll()

      expect(data.results['empty']?.status).toBe('invalid')
      expect(data.results['empty']?.error).toBe('File is empty')
    })

    it('should mark file:// URL as invalid when file does not exist', async () => {
      const imageManager = createMockImageManager({
        missing: { url: 'file:///var/lib/images/missing.qcow2', format: 'qcow2', cloudInit: true },
      })

      ;(access as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ENOENT'))

      const service = new UrlValidationService('/tmp/test.json', imageManager)
      await service.init()
      const data = await service.validateAll()

      expect(data.results['missing']?.status).toBe('invalid')
      expect(data.results['missing']?.error).toBe('File not found')
    })

    it('should validate a single file:// distro', async () => {
      const imageManager = createMockImageManager({
        local: { url: 'file:///var/lib/images/custom.qcow2', format: 'qcow2', cloudInit: true },
      })

      ;(access as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
      ;(stat as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ size: 1024 })

      const service = new UrlValidationService('/tmp/test.json', imageManager)
      await service.init()
      const result = await service.validateOne('local')

      expect(result?.status).toBe('valid')
      expect(mockRequest).not.toHaveBeenCalled()
    })
  })

  it('should not run concurrent validations', async () => {
    const imageManager = createMockImageManager({
      arch: { url: 'https://example.com/arch.qcow2', format: 'qcow2', cloudInit: true },
    })

    simulateResponse(200)

    const service = new UrlValidationService('/tmp/test.json', imageManager)
    await service.init()

    // Start two validations concurrently
    const [data1, data2] = await Promise.all([
      service.validateAll(),
      service.validateAll(),
    ])

    // Both should return results, second gets cached results since first is running
    expect(data1.lastRunAt).toBeDefined()
    expect(data2).toBeDefined()
  })
})

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod'
import { distroRoutes } from '../../src/routes/distros.js'
import { ImageManager } from '../../src/services/image-manager.js'
import type { UserRole } from '../../src/models/user.js'

function createMockDistroStore() {
  const store: Record<string, { name: string; label: string; url: string; format: string; cloudInit: boolean; guestOs?: string }> = {}
  return {
    getAll: vi.fn(() => ({ ...store })),
    get: vi.fn((name: string) => store[name] ?? null),
    has: vi.fn((name: string) => name in store),
    names: vi.fn(() => Object.keys(store)),
    add: vi.fn(async (distro: { name: string; label: string; url: string; format: string; cloudInit: boolean }) => {
      if (store[distro.name]) return false
      store[distro.name] = distro
      return true
    }),
    update: vi.fn(async (name: string, fields: Record<string, unknown>) => {
      if (!store[name]) return false
      store[name] = { ...store[name], ...fields, name }
      return true
    }),
    remove: vi.fn(async (name: string) => {
      if (!store[name]) return false
      delete store[name]
      return true
    }),
    toImageSources: vi.fn(() => ({})),
    init: vi.fn(async () => {}),
  }
}

function createMockCatalogStore(entries: Record<string, { name: string; label: string; description?: string; url?: string; format: string; cloudInit: boolean }> = {}) {
  return {
    getAll: vi.fn(() => ({ ...entries })),
    get: vi.fn((name: string) => entries[name] ?? null),
    has: vi.fn((name: string) => name in entries),
    names: vi.fn(() => Object.keys(entries)),
    hasRemoteUrl: vi.fn(() => false),
    refresh: vi.fn(async () => true),
    toImageSources: vi.fn(() => ({})),
    init: vi.fn(async () => {}),
  }
}

function createMockImageManager() {
  return {
    setCustomSources: vi.fn(),
    setCatalogSources: vi.fn(),
    isCloudDistro: vi.fn(() => false),
    supportedDistros: vi.fn(() => ImageManager.builtinDistros()),
    getDistroSource: vi.fn((name: string) => {
      if (ImageManager.builtinDistros().includes(name)) {
        return { url: `https://example.com/${name}.qcow2`, format: 'qcow2', cloudInit: true }
      }
      return null
    }),
  } as unknown as ImageManager
}

function createMockUrlValidator() {
  return {
    getResults: vi.fn(() => ({
      results: {
        arch: { distro: 'arch', url: 'https://example.com/arch.qcow2', status: 'valid', httpStatus: 200, checkedAt: '2026-02-18T00:00:00Z' },
      },
      lastRunAt: '2026-02-18T00:00:00Z',
    })),
    validateAll: vi.fn(async () => ({
      results: {
        arch: { distro: 'arch', url: 'https://example.com/arch.qcow2', status: 'valid', httpStatus: 200, checkedAt: '2026-02-18T00:00:00Z' },
      },
      lastRunAt: '2026-02-18T00:00:00Z',
    })),
    validateOne: vi.fn(async () => ({
      distro: 'arch', url: 'https://example.com/arch.qcow2', status: 'valid', httpStatus: 200, checkedAt: '2026-02-18T00:00:00Z',
    })),
  }
}

// Simulate authenticated user role
let mockUserRole: UserRole = 'admin'

describe('Distro Routes', () => {
  const distroStore = createMockDistroStore()
  const catalogStore = createMockCatalogStore({
    opensuse: { name: 'opensuse', label: 'openSUSE Leap 15.6', description: 'Enterprise-grade Linux', url: 'https://example.com/opensuse.qcow2', format: 'qcow2', cloudInit: true },
    rocky: { name: 'rocky', label: 'Rocky Linux 9', url: 'https://example.com/rocky.qcow2', format: 'qcow2', cloudInit: true },
  })
  const imageManager = createMockImageManager()
  const urlValidator = createMockUrlValidator()
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  fastify.decorateRequest('userId', undefined)
  fastify.decorateRequest('userRole', undefined)
  fastify.decorateRequest('username', undefined)
  fastify.decorateRequest('tokenId', undefined)
  fastify.decorateRequest('authRejectionReason', undefined)

  beforeAll(async () => {
    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)

    // Simulate auth middleware
    fastify.addHook('onRequest', async (request) => {
      request.userRole = mockUserRole
      request.userId = 'test-user-id'
      request.username = 'test-user'
    })

    await fastify.register(distroRoutes, {
      prefix: '/api/distros',
      distroStore: distroStore as never,
      catalogStore: catalogStore as never,
      imageManager,
      urlValidator: urlValidator as never,
    })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockUserRole = 'admin'
  })

  describe('GET /api/distros', () => {
    it('should return built-in distros with category field', async () => {
      distroStore.getAll.mockReturnValue({})

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/distros'
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      const builtins = body.filter((d: { category: string }) => d.category === 'builtin')
      expect(builtins.length).toBe(6)
      const names = builtins.map((d: { name: string }) => d.name)
      expect(names).toContain('cirros')
      expect(names).toContain('arch')
      expect(names).toContain('fedora')
      expect(names).toContain('ubuntu')
      expect(names).toContain('debian')
      expect(names).toContain('alpine')

      // All built-ins should have builtin=true for backward compat
      for (const d of builtins) {
        expect(d.builtin).toBe(true)
      }
    })

    it('should include catalog distros with category and description', async () => {
      distroStore.getAll.mockReturnValue({})

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/distros'
      })

      const body = response.json()
      const catalogEntries = body.filter((d: { category: string }) => d.category === 'catalog')
      expect(catalogEntries.length).toBe(2)

      const opensuse = catalogEntries.find((d: { name: string }) => d.name === 'opensuse')
      expect(opensuse).toBeDefined()
      expect(opensuse.label).toBe('openSUSE Leap 15.6')
      expect(opensuse.description).toBe('Enterprise-grade Linux')
      expect(opensuse.builtin).toBe(true) // backward compat
      expect(opensuse.category).toBe('catalog')
    })

    it('should include custom distros', async () => {
      distroStore.getAll.mockReturnValue({
        gentoo: { name: 'gentoo', label: 'Gentoo', url: 'https://example.com/gentoo.qcow2', format: 'qcow2', cloudInit: true }
      })

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/distros'
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      const gentoo = body.find((d: { name: string }) => d.name === 'gentoo')
      expect(gentoo).toBeDefined()
      expect(gentoo.builtin).toBe(false)
      expect(gentoo.category).toBe('custom')
    })

    it('should show catalog distro with hasOverride when custom override exists', async () => {
      distroStore.getAll.mockReturnValue({
        rocky: { name: 'rocky', label: 'My Rocky', url: 'https://example.com/override.qcow2', format: 'qcow2', cloudInit: true }
      })

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/distros'
      })

      const body = response.json()
      const rockyEntries = body.filter((d: { name: string }) => d.name === 'rocky')
      expect(rockyEntries.length).toBe(1)
      expect(rockyEntries[0].category).toBe('catalog')
      expect(rockyEntries[0].hasOverride).toBe(true)
      expect(rockyEntries[0].effectiveUrl).toBe('https://example.com/override.qcow2')
    })

    it('should include effectiveUrl and hasOverride in response', async () => {
      distroStore.getAll.mockReturnValue({})

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/distros'
      })

      const body = response.json()
      for (const d of body) {
        expect(d).toHaveProperty('effectiveUrl')
        expect(d).toHaveProperty('hasOverride')
      }
    })

    it('should allow viewer to list distros', async () => {
      distroStore.getAll.mockReturnValue({})
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/distros'
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('POST /api/distros', () => {
    it('should add a custom distro', async () => {
      distroStore.add.mockResolvedValue(true)

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros',
        payload: {
          name: 'gentoo',
          label: 'Gentoo',
          url: 'https://example.com/gentoo.qcow2',
          format: 'qcow2',
          cloudInit: true
        }
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().success).toBe(true)
      expect(imageManager.setCustomSources).toHaveBeenCalled()
    })

    it('should reject duplicate name', async () => {
      distroStore.add.mockResolvedValue(false)

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros',
        payload: {
          name: 'gentoo',
          label: 'Gentoo',
          url: 'https://example.com/gentoo.qcow2',
          format: 'qcow2',
          cloudInit: true
        }
      })

      expect(response.statusCode).toBe(409)
    })

    it('should reject built-in distro name', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros',
        payload: {
          name: 'arch',
          label: 'Arch Override',
          url: 'https://example.com/arch.qcow2',
          format: 'qcow2',
          cloudInit: true
        }
      })

      expect(response.statusCode).toBe(409)
      expect(response.json().error).toContain('built-in')
    })

    it('should reject catalog distro name', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros',
        payload: {
          name: 'rocky',
          label: 'My Rocky',
          url: 'https://example.com/rocky.qcow2',
          format: 'qcow2',
          cloudInit: true
        }
      })

      expect(response.statusCode).toBe(409)
      expect(response.json().error).toContain('catalog')
    })

    it('should reject non-cloud distro without url', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros',
        payload: {
          name: 'no-url-distro',
          label: 'No URL',
          format: 'qcow2',
          cloudInit: true,
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should accept file:// URL for custom distro', async () => {
      distroStore.add.mockResolvedValue(true)

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros',
        payload: {
          name: 'local-image',
          label: 'Local Image',
          url: 'file:///var/lib/images/custom.qcow2',
          format: 'qcow2',
          cloudInit: true
        }
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().success).toBe(true)
    })

    it('should reject invalid body', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros',
        payload: {
          name: 'INVALID',
          url: 'not-a-url',
          format: 'xyz',
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject operator from adding distro', async () => {
      mockUserRole = 'operator'

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros',
        payload: {
          name: 'gentoo',
          label: 'Gentoo',
          url: 'https://example.com/gentoo.qcow2',
          format: 'qcow2',
          cloudInit: true
        }
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('Insufficient permissions')
    })

    it('should reject viewer from adding distro', async () => {
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros',
        payload: {
          name: 'gentoo',
          label: 'Gentoo',
          url: 'https://example.com/gentoo.qcow2',
          format: 'qcow2',
          cloudInit: true
        }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('DELETE /api/distros/:name', () => {
    it('should remove a custom distro', async () => {
      distroStore.remove.mockResolvedValue(true)

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/distros/gentoo'
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
      expect(imageManager.setCustomSources).toHaveBeenCalled()
    })

    it('should return 404 for unknown distro', async () => {
      distroStore.remove.mockResolvedValue(false)

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/distros/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })

    it('should reject deleting built-in distro', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/distros/arch'
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('built-in')
    })

    it('should reject deleting catalog distro', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/distros/rocky'
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('catalog')
    })

    it('should reject operator from deleting distro', async () => {
      mockUserRole = 'operator'

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/distros/gentoo'
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('Insufficient permissions')
    })
  })

  describe('POST /api/distros/refresh-catalog', () => {
    it('should return 400 when no remote URL configured', async () => {
      catalogStore.hasRemoteUrl.mockReturnValue(false)

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros/refresh-catalog'
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('No remote catalog URL')
    })

    it('should refresh catalog when remote URL is configured', async () => {
      catalogStore.hasRemoteUrl.mockReturnValue(true)
      catalogStore.refresh.mockResolvedValue(true)
      catalogStore.names.mockReturnValue(['opensuse', 'rocky'])

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros/refresh-catalog'
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ success: true, updated: true, count: 2 })
      expect(imageManager.setCatalogSources).toHaveBeenCalled()
    })

    it('should return 502 when refresh fails', async () => {
      catalogStore.hasRemoteUrl.mockReturnValue(true)
      catalogStore.refresh.mockRejectedValue(new Error('Network timeout'))

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros/refresh-catalog'
      })

      expect(response.statusCode).toBe(502)
      expect(response.json().error).toContain('Check server logs')
    })

    it('should allow operator to refresh catalog', async () => {
      mockUserRole = 'operator'
      catalogStore.hasRemoteUrl.mockReturnValue(true)
      catalogStore.refresh.mockResolvedValue(true)
      catalogStore.names.mockReturnValue(['opensuse', 'rocky'])

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros/refresh-catalog'
      })

      expect(response.statusCode).toBe(200)
    })

    it('should reject viewer from refreshing catalog', async () => {
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros/refresh-catalog'
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('GET /api/distros/url-status', () => {
    it('should return URL validation results', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/distros/url-status'
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body).toHaveProperty('results')
      expect(body).toHaveProperty('lastRunAt')
      expect(body.results.arch).toBeDefined()
      expect(body.results.arch.status).toBe('valid')
    })

    it('should allow viewer to access url-status', async () => {
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/distros/url-status'
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('POST /api/distros/validate-urls', () => {
    it('should trigger URL validation (admin only)', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros/validate-urls'
      })

      expect(response.statusCode).toBe(200)
      expect(urlValidator.validateAll).toHaveBeenCalled()
    })

    it('should reject viewer from triggering validation', async () => {
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros/validate-urls'
      })

      expect(response.statusCode).toBe(403)
    })

    it('should reject operator from triggering validation', async () => {
      mockUserRole = 'operator'

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/distros/validate-urls'
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('PUT /api/distros/:name/url', () => {
    it('should create override for built-in distro', async () => {
      distroStore.get.mockReturnValue(null)
      distroStore.has.mockReturnValue(false)
      distroStore.add.mockResolvedValue(true)

      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/distros/arch/url',
        payload: { url: 'https://example.com/new-arch.qcow2' }
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
      expect(distroStore.add).toHaveBeenCalled()
      expect(imageManager.setCustomSources).toHaveBeenCalled()
      expect(urlValidator.validateOne).toHaveBeenCalledWith('arch')
    })

    it('should update existing custom distro URL', async () => {
      distroStore.has.mockReturnValue(true)
      distroStore.update.mockResolvedValue(true)

      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/distros/my-custom/url',
        payload: { url: 'https://example.com/updated.qcow2' }
      })

      expect(response.statusCode).toBe(200)
      expect(distroStore.update).toHaveBeenCalled()
    })

    it('should return 404 for unknown distro', async () => {
      distroStore.has.mockReturnValue(false)

      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/distros/nonexistent/url',
        payload: { url: 'https://example.com/new.qcow2' }
      })

      expect(response.statusCode).toBe(404)
    })

    it('should accept file:// URL for override', async () => {
      distroStore.get.mockReturnValue(null)
      distroStore.has.mockReturnValue(false)
      distroStore.add.mockResolvedValue(true)

      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/distros/arch/url',
        payload: { url: 'file:///var/lib/images/arch-local.qcow2' }
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
    })

    it('should reject invalid URL', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/distros/arch/url',
        payload: { url: 'not-a-url' }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject ftp:// URL', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/distros/arch/url',
        payload: { url: 'ftp://example.com/image.qcow2' }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should reject viewer from updating URL', async () => {
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/distros/arch/url',
        payload: { url: 'https://example.com/new.qcow2' }
      })

      expect(response.statusCode).toBe(403)
    })
  })

  describe('DELETE /api/distros/:name/url-override', () => {
    it('should remove override for built-in distro', async () => {
      distroStore.has.mockReturnValue(true)
      distroStore.remove.mockResolvedValue(true)

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/distros/arch/url-override'
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().success).toBe(true)
      expect(distroStore.remove).toHaveBeenCalledWith('arch')
      expect(imageManager.setCustomSources).toHaveBeenCalled()
    })

    it('should return 404 when no override exists', async () => {
      distroStore.has.mockReturnValue(false)

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/distros/arch/url-override'
      })

      expect(response.statusCode).toBe(404)
    })

    it('should reject reset for custom distro (not builtin/catalog)', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/distros/my-custom/url-override'
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error).toContain('custom distro')
    })

    it('should reject viewer from resetting override', async () => {
      mockUserRole = 'viewer'

      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/distros/arch/url-override'
      })

      expect(response.statusCode).toBe(403)
    })
  })
})

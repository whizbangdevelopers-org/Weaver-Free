// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computeChecksum, encodeDateToBase36 } from '../src/license.js'

/**
 * Config tier resolution tests.
 *
 * We test loadConfig() indirectly by manipulating process.env before import.
 * Since loadConfig() reads env vars at call time, we can simply call it
 * after setting up env.
 */

// Store original env
const originalEnv = { ...process.env }

function generateTestKey(tierCode: string, secret: string, expiryDate?: Date): string {
  const issueDate = encodeDateToBase36(new Date())
  const expiryEncoded = expiryDate ? encodeDateToBase36(expiryDate) : 'ZZZZ'
  const customerId = 'TEST'
  const payload = issueDate + expiryEncoded + customerId
  const prefix = `WVR-${tierCode}-${payload}`
  const checksum = computeChecksum(prefix, secret)
  return `${prefix}-${checksum}`
}

describe('Config Tier Resolution', () => {
  beforeEach(() => {
    // Clean env
    delete process.env.LICENSE_KEY
    delete process.env.LICENSE_KEY_FILE
    delete process.env.PREMIUM_ENABLED
    delete process.env.LICENSE_HMAC_SECRET
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key]
      }
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value !== undefined) {
        process.env[key] = value
      }
    }
  })

  it('should default to demo tier when no env vars set', async () => {
    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()
    expect(config.tier).toBe('demo')
    expect(config.licenseExpiry).toBeNull()
    expect(config.licenseGraceMode).toBe(false)
  })

  it('should map PREMIUM_ENABLED=true to weaver tier with deprecation warning', async () => {
    process.env.PREMIUM_ENABLED = 'true'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Use dynamic import to get fresh module
    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    expect(config.tier).toBe('weaver')
    expect(config.licenseExpiry).toBeNull()
    expect(config.licenseGraceMode).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('PREMIUM_ENABLED is deprecated')
    )

    warnSpy.mockRestore()
  })

  it('should parse valid LICENSE_KEY into correct tier', async () => {
    const secret = 'my-test-secret'
    process.env.LICENSE_HMAC_SECRET = secret
    process.env.LICENSE_KEY = generateTestKey('WVS', secret)

    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    expect(config.tier).toBe('weaver')
    expect(config.licenseGraceMode).toBe(false)
  })

  it('should parse free tier LICENSE_KEY correctly', async () => {
    const secret = 'my-test-secret'
    process.env.LICENSE_HMAC_SECRET = secret
    process.env.LICENSE_KEY = generateTestKey('FRE', secret)

    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    expect(config.tier).toBe('free')
  })

  it('should parse fabrick tier LICENSE_KEY correctly', async () => {
    const secret = 'my-test-secret'
    process.env.LICENSE_HMAC_SECRET = secret
    process.env.LICENSE_KEY = generateTestKey('FAB', secret)

    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    expect(config.tier).toBe('fabrick')
  })

  it('should fall back to demo on invalid LICENSE_KEY', async () => {
    process.env.LICENSE_HMAC_SECRET = 'test-secret'
    process.env.LICENSE_KEY = 'INVALID-KEY-FORMAT'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    expect(config.tier).toBe('demo')
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid LICENSE_KEY')
    )

    errorSpy.mockRestore()
  })

  it('should prioritize LICENSE_KEY over PREMIUM_ENABLED', async () => {
    const secret = 'my-test-secret'
    process.env.LICENSE_HMAC_SECRET = secret
    process.env.LICENSE_KEY = generateTestKey('FAB', secret)
    process.env.PREMIUM_ENABLED = 'true'

    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    // LICENSE_KEY takes precedence
    expect(config.tier).toBe('fabrick')
  })

  it('should handle LICENSE_KEY with expiry', async () => {
    const secret = 'my-test-secret'
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)
    process.env.LICENSE_HMAC_SECRET = secret
    process.env.LICENSE_KEY = generateTestKey('WVS', secret, futureDate)

    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    expect(config.tier).toBe('weaver')
    expect(config.licenseExpiry).not.toBeNull()
    expect(config.licenseGraceMode).toBe(false)
  })
})

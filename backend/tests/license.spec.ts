// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect } from 'vitest'
import {
  parseLicenseKey,
  generateLicenseKey,
  requireTier,
  computeChecksum,
  encodeDateToBase36,
  decodeDateFromBase36,
  TIER_ORDER,
} from '../src/license.js'

const TEST_SECRET = 'test-hmac-secret-for-license-keys'

/** Helper: generate a valid key for testing */
function generateKey(tierCode: string, issueDate: Date, expiryDate: Date | null, customerId: string): string {
  const issueDateEncoded = encodeDateToBase36(issueDate)
  const expiryEncoded = expiryDate ? encodeDateToBase36(expiryDate) : 'ZZZZ'
  const payload = issueDateEncoded + expiryEncoded + customerId
  const prefix = `WVR-${tierCode}-${payload}`
  const checksum = computeChecksum(prefix, TEST_SECRET)
  return `${prefix}-${checksum}`
}

describe('License Key System', () => {
  describe('encodeDateToBase36 / decodeDateFromBase36', () => {
    it('should round-trip a date correctly', () => {
      const date = new Date('2026-06-15T00:00:00Z')
      const encoded = encodeDateToBase36(date)
      const decoded = decodeDateFromBase36(encoded)
      expect(decoded).not.toBeNull()
      // Compare day-level precision (no time component)
      expect(decoded!.toISOString().slice(0, 10)).toBe('2026-06-15')
    })

    it('should return null for ZZZZ sentinel', () => {
      expect(decodeDateFromBase36('ZZZZ')).toBeNull()
    })

    it('should return null for invalid base36', () => {
      expect(decodeDateFromBase36('!!!!')).toBeNull()
    })

    it('should pad to 4 characters', () => {
      const encoded = encodeDateToBase36(new Date('2020-01-02T00:00:00Z'))
      expect(encoded).toHaveLength(4)
    })
  })

  describe('computeChecksum', () => {
    it('should return 4 uppercase hex characters', () => {
      const checksum = computeChecksum('WVR-WVS-123456789ABC', TEST_SECRET)
      expect(checksum).toMatch(/^[A-F0-9]{4}$/)
    })

    it('should produce different checksums for different inputs', () => {
      const c1 = computeChecksum('WVR-WVS-AAAAAAAAAAAA', TEST_SECRET)
      const c2 = computeChecksum('WVR-WVS-BBBBBBBBBBBB', TEST_SECRET)
      expect(c1).not.toBe(c2)
    })

    it('should produce different checksums for different secrets', () => {
      const c1 = computeChecksum('WVR-WVS-AAAAAAAAAAAA', 'secret1')
      const c2 = computeChecksum('WVR-WVS-AAAAAAAAAAAA', 'secret2')
      expect(c1).not.toBe(c2)
    })
  })

  describe('parseLicenseKey — valid keys', () => {
    it('should parse a valid free key', () => {
      const key = generateKey('FRE', new Date(), new Date('2027-12-31'), 'TST1')
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('free')
      expect(result.expiry).not.toBeNull()
      expect(result.graceMode).toBe(false)
    })

    it('should parse a valid weaver key (WVS)', () => {
      const key = generateKey('WVS', new Date(), new Date('2027-12-31'), 'TST2')
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('weaver')
      expect(result.graceMode).toBe(false)
    })

    it('should parse a valid weaver key (WVT — Team)', () => {
      const key = generateKey('WVT', new Date(), new Date('2027-12-31'), 'TST2')
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('weaver')
    })

    it('should parse a valid fabrick key (FAB)', () => {
      const key = generateKey('FAB', new Date(), new Date('2027-12-31'), 'TST3')
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('fabrick')
    })

    it('should accept legacy PRE code and map to weaver', () => {
      const key = generateKey('PRE', new Date(), new Date('2027-12-31'), 'TST2')
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('weaver')
    })

    it('should accept legacy ENT code and map to fabrick', () => {
      const key = generateKey('ENT', new Date(), new Date('2027-12-31'), 'TST3')
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('fabrick')
    })

    it('should parse a key with no expiry (ZZZZ)', () => {
      const key = generateKey('WVS', new Date(), null, 'NOEX')
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('weaver')
      expect(result.expiry).toBeNull()
      expect(result.graceMode).toBe(false)
    })

    it('should extract customer ID', () => {
      const key = generateKey('WVS', new Date(), null, 'AB12')
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.customerId).toBe('AB12')
    })
  })

  describe('parseLicenseKey — invalid keys', () => {
    it('should reject empty string', () => {
      expect(() => parseLicenseKey('', TEST_SECRET)).toThrow('Invalid license key format')
    })

    it('should reject key with wrong prefix', () => {
      expect(() => parseLicenseKey('XYZ-WVS-AAAAAAAAAAAA-1234', TEST_SECRET)).toThrow('Invalid license key format')
    })

    it('should reject key with invalid tier code', () => {
      expect(() => parseLicenseKey('WVR-XXX-AAAAAAAAAAAA-1234', TEST_SECRET)).toThrow('Invalid license key format')
    })

    it('should reject key with wrong payload length', () => {
      expect(() => parseLicenseKey('WVR-WVS-AAAA-1234', TEST_SECRET)).toThrow('Invalid license key format')
    })

    it('should reject key with lowercase payload', () => {
      expect(() => parseLicenseKey('WVR-WVS-aaaaaaaaaaaa-1234', TEST_SECRET)).toThrow('Invalid license key format')
    })

    it('should reject tampered key (wrong checksum)', () => {
      const key = generateKey('WVS', new Date(), new Date('2027-12-31'), 'TST1')
      // Tamper with the checksum
      const tampered = key.slice(0, -4) + '0000'
      expect(() => parseLicenseKey(tampered, TEST_SECRET)).toThrow('checksum verification failed')
    })

    it('should reject key verified with wrong secret', () => {
      const key = generateKey('WVS', new Date(), new Date('2027-12-31'), 'TST1')
      expect(() => parseLicenseKey(key, 'wrong-secret')).toThrow('checksum verification failed')
    })
  })

  describe('parseLicenseKey — expiry and grace period', () => {
    it('should return non-expired key normally', () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)
      const key = generateKey('WVS', new Date(), futureDate, 'TST1')
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('weaver')
      expect(result.graceMode).toBe(false)
    })

    it('should activate grace mode for recently expired key (within 30 days)', () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 15) // Expired 15 days ago
      const key = generateKey('WVS', new Date('2024-01-01'), expiredDate, 'TST1')
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('weaver')
      expect(result.graceMode).toBe(true)
    })

    it('should downgrade to free for key expired beyond 30 days', () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 45) // Expired 45 days ago
      const key = generateKey('WVS', new Date('2024-01-01'), expiredDate, 'TST1')
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('free')
      expect(result.graceMode).toBe(false)
    })

    it('should downgrade fabrick to free beyond grace period', () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 60) // Well beyond grace
      const key = generateKey('FAB', new Date('2024-01-01'), expiredDate, 'TST1')
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('free')
      expect(result.graceMode).toBe(false)
    })

    it('should keep expiry info even when downgraded to free', () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 60)
      const key = generateKey('WVS', new Date('2024-01-01'), expiredDate, 'TST1')
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.expiry).not.toBeNull()
    })
  })

  describe('requireTier', () => {
    it('should not throw when tier meets minimum', () => {
      expect(() => requireTier({ tier: 'weaver' }, 'weaver')).not.toThrow()
    })

    it('should not throw when tier exceeds minimum', () => {
      expect(() => requireTier({ tier: 'fabrick' }, 'weaver')).not.toThrow()
    })

    it('should throw when tier is below minimum', () => {
      expect(() => requireTier({ tier: 'demo' }, 'weaver')).toThrow('requires weaver tier or higher')
    })

    it('should throw when free tries to access weaver', () => {
      expect(() => requireTier({ tier: 'free' }, 'weaver')).toThrow('requires weaver tier or higher')
    })

    it('should allow free to access free', () => {
      expect(() => requireTier({ tier: 'free' }, 'free')).not.toThrow()
    })

    it('should throw with statusCode 403', () => {
      try {
        requireTier({ tier: 'demo' }, 'weaver')
      } catch (err) {
        expect((err as { statusCode: number }).statusCode).toBe(403)
      }
    })
  })

  describe('generateLicenseKey', () => {
    it('should generate a valid free key that round-trips through parse', () => {
      const key = generateLicenseKey('free', TEST_SECRET)
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('free')
      expect(result.expiry).toBeNull()
      expect(result.graceMode).toBe(false)
    })

    it('should generate a valid weaver key', () => {
      const key = generateLicenseKey('weaver', TEST_SECRET)
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('weaver')
    })

    it('should generate a valid fabrick key', () => {
      const key = generateLicenseKey('fabrick', TEST_SECRET)
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.tier).toBe('fabrick')
    })

    it('should support custom expiry', () => {
      const expiry = new Date('2027-06-15T00:00:00Z')
      const key = generateLicenseKey('weaver', TEST_SECRET, { expiry })
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.expiry).not.toBeNull()
      expect(result.expiry!.toISOString().slice(0, 10)).toBe('2027-06-15')
    })

    it('should support custom customer ID', () => {
      const key = generateLicenseKey('weaver', TEST_SECRET, { customerId: 'AB12' })
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.customerId).toBe('AB12')
    })

    it('should default customer ID to 0000', () => {
      const key = generateLicenseKey('free', TEST_SECRET)
      const result = parseLicenseKey(key, TEST_SECRET)
      expect(result.customerId).toBe('0000')
    })

    it('should match KEY_REGEX format', () => {
      const key = generateLicenseKey('weaver', TEST_SECRET)
      expect(key).toMatch(/^WVR-(FRE|WVS|WVT|FAB|PRE|ENT)-[A-Z0-9]{12}-[A-Z0-9]{4}$/)
    })
  })

  describe('TIER_ORDER', () => {
    it('should have correct ordering', () => {
      expect(TIER_ORDER.demo).toBeLessThan(TIER_ORDER.free)
      expect(TIER_ORDER.free).toBeLessThan(TIER_ORDER.weaver)
      expect(TIER_ORDER.weaver).toBeLessThan(TIER_ORDER.fabrick)
    })
  })
})

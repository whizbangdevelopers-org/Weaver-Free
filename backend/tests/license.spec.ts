// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect } from 'vitest'
import { generateKeyPairSync, type KeyObject } from 'node:crypto'
import {
  parseLicenseKey,
  generateLicenseKey,
  requireTier,
  encodeDateToBase36,
  decodeDateFromBase36,
  TIER_ORDER,
} from '../src/license.js'
import { signLicensePrefix, base32Encode, base32Decode } from '../src/license-signing.js'

/**
 * Ephemeral signing keypairs, minted per test run.
 *
 * Deliberately NOT added to `ACCEPTED_PUBLIC_KEYS` — a test keypair that shipped builds trusted
 * would be a second minting authority, which is the very shape this change removes. The accepted set
 * is passed explicitly to `parseLicenseKey`, a seam the runtime never uses (config.ts passes
 * nothing) and which no operator can reach without rebuilding from source.
 */
function makeKeypair(): { privateKey: KeyObject; publicB64: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string }
  return { privateKey, publicB64: jwk.x }
}

const AUTHORITY = makeKeypair()
const OTHER_AUTHORITY = makeKeypair()

/** The accepted set for the assertions below — the product's real set stays untouched. */
const ACCEPTED = [AUTHORITY.publicB64]

/** Helper: mint a valid key for testing, signed by AUTHORITY. */
function generateKey(tierCode: string, issueDate: Date, expiryDate: Date | null, customerId: string): string {
  const issueDateEncoded = encodeDateToBase36(issueDate)
  const expiryEncoded = expiryDate ? encodeDateToBase36(expiryDate) : 'ZZZZ'
  const payload = issueDateEncoded + expiryEncoded + customerId
  const prefix = `WVR-${tierCode}-${payload}`
  return `${prefix}-${signLicensePrefix(prefix, AUTHORITY.privateKey)}`
}

/** Swap the tier code in a minted key, leaving its signature intact. */
function retier(key: string, newTierCode: string): string {
  const [, , payload, sig] = key.split('-')
  return `WVR-${newTierCode}-${payload}-${sig}`
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

  // `computeChecksum` and its three tests are deleted with the function. They asserted that the
  // HMAC was a well-formed 4-hex-char digest and varied with input and secret — all true, and none
  // of it load-bearing, because the defect was never that the checksum was computed wrongly. It was
  // that computing it at all required the secret that mints. Signature-verification coverage is in
  // the CATCH/IGNORE blocks below.

  describe('base32 (signature encoding)', () => {
    it('round-trips arbitrary bytes', () => {
      const bytes = Uint8Array.from({ length: 64 }, (_, i) => (i * 37 + 11) % 256)
      const decoded = base32Decode(base32Encode(bytes))
      expect(decoded).not.toBeNull()
      expect(Array.from(decoded!)).toEqual(Array.from(bytes))
    })

    it('emits only the RFC 4648 uppercase alphabet', () => {
      const bytes = Uint8Array.from({ length: 64 }, (_, i) => (i * 91 + 5) % 256)
      expect(base32Encode(bytes)).toMatch(/^[A-Z2-7]+$/)
    })

    it('encodes a 64-byte signature to exactly 103 characters', () => {
      expect(base32Encode(new Uint8Array(64))).toHaveLength(103)
    })

    it('returns null on a character outside the alphabet', () => {
      // '0', '1' and '8' are deliberately absent from RFC 4648 base32.
      expect(base32Decode('AAAA0AAA')).toBeNull()
      expect(base32Decode('AAAA1AAA')).toBeNull()
      expect(base32Decode('AAAA8AAA')).toBeNull()
    })
  })

  describe('parseLicenseKey — valid keys', () => {
    it('should parse a valid free key', () => {
      const key = generateKey('FRE', new Date(), new Date('2027-12-31'), 'TST1')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('free')
      expect(result.expiry).not.toBeNull()
      expect(result.graceMode).toBe(false)
    })

    it('should parse a valid weaver key (WVS)', () => {
      const key = generateKey('WVS', new Date(), new Date('2027-12-31'), 'TST2')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('weaver')
      expect(result.graceMode).toBe(false)
    })

    it('should parse a valid team key (WVT → team, distinct tier)', () => {
      const key = generateKey('WVT', new Date(), new Date('2027-12-31'), 'TST2')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('team')
    })

    it('should parse a valid fabrick key (FAB)', () => {
      const key = generateKey('FAB', new Date(), new Date('2027-12-31'), 'TST3')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('fabrick')
    })

    it('should accept legacy PRE code and map to weaver', () => {
      const key = generateKey('PRE', new Date(), new Date('2027-12-31'), 'TST2')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('weaver')
    })

    it('should accept legacy ENT code and map to fabrick', () => {
      const key = generateKey('ENT', new Date(), new Date('2027-12-31'), 'TST3')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('fabrick')
    })

    it('should parse a key with no expiry (ZZZZ)', () => {
      const key = generateKey('WVS', new Date(), null, 'NOEX')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('weaver')
      expect(result.expiry).toBeNull()
      expect(result.graceMode).toBe(false)
    })

    it('should extract customer ID', () => {
      const key = generateKey('WVS', new Date(), null, 'AB12')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.customerId).toBe('AB12')
    })
  })

  describe('parseLicenseKey — malformed keys', () => {
    const SIG = 'A'.repeat(103)

    it('should reject empty string', () => {
      expect(() => parseLicenseKey('', undefined, ACCEPTED)).toThrow('Invalid license key format')
    })

    it('should reject key with wrong prefix', () => {
      expect(() => parseLicenseKey(`XYZ-WVS-AAAAAAAAAAAA-${SIG}`, undefined, ACCEPTED)).toThrow('Invalid license key format')
    })

    it('should reject key with invalid tier code', () => {
      expect(() => parseLicenseKey(`WVR-XXX-AAAAAAAAAAAA-${SIG}`, undefined, ACCEPTED)).toThrow('Invalid license key format')
    })

    it('should reject key with wrong payload length', () => {
      expect(() => parseLicenseKey(`WVR-WVS-AAAA-${SIG}`, undefined, ACCEPTED)).toThrow('Invalid license key format')
    })

    it('should reject key with lowercase payload', () => {
      expect(() => parseLicenseKey(`WVR-WVS-aaaaaaaaaaaa-${SIG}`, undefined, ACCEPTED)).toThrow('Invalid license key format')
    })

    it('should reject an old-format HMAC key (4-char checksum)', () => {
      // The previous shape. There is no dual-accept window by design — no key was ever issued,
      // so accepting the old format would add exposure to buy compatibility nobody needs.
      expect(() => parseLicenseKey('WVR-WVS-AAAAAAAAAAAA-1234', undefined, ACCEPTED)).toThrow('Invalid license key format')
    })
  })

  // ---- CATCH: every one of these must be REJECTED ---------------------------------------------
  describe('parseLicenseKey — signature forgery (CATCH)', () => {
    it('rejects a key signed by a different private key', () => {
      const prefix = 'WVR-FAB-AAAAAAAAAAAA'
      const forged = `${prefix}-${signLicensePrefix(prefix, OTHER_AUTHORITY.privateKey)}`
      expect(() => parseLicenseKey(forged, undefined, ACCEPTED)).toThrow('signature verification failed')
    })

    it('rejects a valid signature with the TIER altered', () => {
      // The signed message is the prefix, which contains the tier — so a Solo key cannot be
      // promoted to Fabrick by editing four characters. This is the escalation that matters.
      const solo = generateKey('WVS', new Date(), new Date('2027-12-31'), 'TST1')
      expect(() => parseLicenseKey(retier(solo, 'FAB'), undefined, ACCEPTED)).toThrow('signature verification failed')
    })

    it('rejects a valid signature with the EXPIRY altered', () => {
      const key = generateKey('WVS', new Date(), new Date('2026-01-01'), 'TST1')
      const [, tier, payload, sig] = key.split('-')
      const extended = `WVR-${tier}-${payload.slice(0, 4)}ZZZZ${payload.slice(8)}-${sig}`
      expect(() => parseLicenseKey(extended, undefined, ACCEPTED)).toThrow('signature verification failed')
    })

    it('rejects a SPLICED signature — genuine, but from another key', () => {
      const a = generateKey('WVS', new Date(), new Date('2027-12-31'), 'AAAA')
      const b = generateKey('WVS', new Date(), new Date('2027-12-31'), 'BBBB')
      const spliced = `${b.split('-').slice(0, 3).join('-')}-${a.split('-')[3]}`
      expect(() => parseLicenseKey(spliced, undefined, ACCEPTED)).toThrow('signature verification failed')
    })

    it('rejects a signature of the wrong length (format gate)', () => {
      const key = generateKey('WVS', new Date(), new Date('2027-12-31'), 'TST1')
      expect(() => parseLicenseKey(key.slice(0, -1), undefined, ACCEPTED)).toThrow('Invalid license key format')
    })

    it('rejects EVERYTHING when the accepted key set is empty — never fails open', () => {
      // The shipped `ACCEPTED_PUBLIC_KEYS` is empty until phase 7 places the production private key
      // under sops. Empty must mean "verify nothing", not "verify anything": asserted, not assumed.
      const key = generateKey('FAB', new Date(), new Date('2027-12-31'), 'TST1')
      expect(() => parseLicenseKey(key, undefined, [])).toThrow('signature verification failed')
      expect(() => parseLicenseKey(key)).toThrow('signature verification failed')
    })

    it('rejects a malformed entry in the accepted set rather than treating it as a match', () => {
      const key = generateKey('WVS', new Date(), new Date('2027-12-31'), 'TST1')
      expect(() => parseLicenseKey(key, undefined, ['not-a-key'])).toThrow('signature verification failed')
    })
  })

  // ---- IGNORE: every one of these must be ACCEPTED ---------------------------------------------
  describe('parseLicenseKey — legitimate keys (IGNORE)', () => {
    it('accepts a freshly minted key for each tier', () => {
      const cases: Array<[string, string]> = [['FRE', 'free'], ['WVS', 'weaver'], ['WVT', 'team'], ['FAB', 'fabrick']]
      for (const [code, tier] of cases) {
        const key = generateKey(code, new Date(), new Date('2027-12-31'), 'TST1')
        expect(parseLicenseKey(key, undefined, ACCEPTED).tier).toBe(tier)
      }
    })

    it('accepts a key signed by an OLDER key still in the rotation set', () => {
      // Rotation adds the new public key and ships before signing switches, so both must verify.
      const older = makeKeypair()
      const prefix = 'WVR-WVS-AAAAAAAAAAAA'
      const key = `${prefix}-${signLicensePrefix(prefix, older.privateKey)}`
      const rotationSet = [AUTHORITY.publicB64, older.publicB64]
      expect(parseLicenseKey(key, undefined, rotationSet).tier).toBe('weaver')
    })

    it('accepts the ZZZZ no-expiry sentinel exactly as before', () => {
      const key = generateKey('WVS', new Date(), null, 'TST1')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.expiry).toBeNull()
      expect(result.graceMode).toBe(false)
    })
  })

  describe('parseLicenseKey — expiry and grace period', () => {
    it('should return non-expired key normally', () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)
      const key = generateKey('WVS', new Date(), futureDate, 'TST1')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('weaver')
      expect(result.graceMode).toBe(false)
    })

    it('should activate grace mode for recently expired key (within 30 days)', () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 15) // Expired 15 days ago
      const key = generateKey('WVS', new Date('2024-01-01'), expiredDate, 'TST1')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('weaver')
      expect(result.graceMode).toBe(true)
    })

    it('should downgrade to free for key expired beyond 30 days', () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 45) // Expired 45 days ago
      const key = generateKey('WVS', new Date('2024-01-01'), expiredDate, 'TST1')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('free')
      expect(result.graceMode).toBe(false)
    })

    it('should downgrade fabrick to free beyond grace period', () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 60) // Well beyond grace
      const key = generateKey('FAB', new Date('2024-01-01'), expiredDate, 'TST1')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('free')
      expect(result.graceMode).toBe(false)
    })

    it('should keep expiry info even when downgraded to free', () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 60)
      const key = generateKey('WVS', new Date('2024-01-01'), expiredDate, 'TST1')
      const result = parseLicenseKey(key, undefined, ACCEPTED)
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
      const key = generateLicenseKey('free', AUTHORITY.privateKey)
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('free')
      expect(result.expiry).toBeNull()
      expect(result.graceMode).toBe(false)
    })

    it('should generate a valid weaver key', () => {
      const key = generateLicenseKey('weaver', AUTHORITY.privateKey)
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('weaver')
    })

    it('should generate a valid fabrick key', () => {
      const key = generateLicenseKey('fabrick', AUTHORITY.privateKey)
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.tier).toBe('fabrick')
    })

    it('should support custom expiry', () => {
      const expiry = new Date('2027-06-15T00:00:00Z')
      const key = generateLicenseKey('weaver', AUTHORITY.privateKey, { expiry })
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.expiry).not.toBeNull()
      expect(result.expiry!.toISOString().slice(0, 10)).toBe('2027-06-15')
    })

    it('should support custom customer ID', () => {
      const key = generateLicenseKey('weaver', AUTHORITY.privateKey, { customerId: 'AB12' })
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.customerId).toBe('AB12')
    })

    it('should default customer ID to 0000', () => {
      const key = generateLicenseKey('free', AUTHORITY.privateKey)
      const result = parseLicenseKey(key, undefined, ACCEPTED)
      expect(result.customerId).toBe('0000')
    })

    it('should match KEY_REGEX format', () => {
      const key = generateLicenseKey('weaver', AUTHORITY.privateKey)
      expect(key).toMatch(/^WVR-(FRE|WVS|WVT|FAB|PRE|ENT)-[A-Z0-9]{12}-[A-Z2-7]{103}$/)
    })

    it('mints a key that is uppercase and transcription-safe end to end', () => {
      // The key is emailed and pasted. It got ~5x longer; it must not have gained a character
      // class that survives a copy badly (mixed case, +/ from base64, or URL-unsafe punctuation).
      const key = generateLicenseKey('fabrick', AUTHORITY.privateKey, { expiry: new Date('2027-06-15T00:00:00Z') })
      expect(key).toMatch(/^[A-Z0-9-]+$/)
      expect(key).toHaveLength(124)
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

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { encodeDateToBase36 } from '../src/license.js'
import { ACCEPTED_PUBLIC_KEYS, signLicensePrefix } from '../src/license-signing.js'

/**
 * Config tier resolution tests.
 *
 * We test loadConfig() indirectly by manipulating process.env before import.
 * Since loadConfig() reads env vars at call time, we can simply call it
 * after setting up env.
 *
 * **The positive-path tier tests were deleted, not adapted.** They asserted that an
 * operator who sets `LICENSE_HMAC_SECRET` and mints a key against it resolves to a paid tier —
 * which was true, and was the vulnerability stated as a contract: validation and minting used the
 * same operator-supplied value, so the suite was certifying that anyone could grant themselves any
 * tier. Rewriting them to "still reach fabrick, somehow" would have preserved exactly the property
 * being removed. What replaces them asserts the closure directly.
 */

// Store original env
const originalEnv = { ...process.env }

/** An adversary's keypair — i.e. any operator's. Never in the accepted set, which is the point. */
const OPERATOR = generateKeyPairSync('ed25519')

/**
 * A structurally PERFECT key minted by someone who is not the licence authority.
 *
 * This is the realistic attack, and it is why a format-invalid string is not a sufficient test: an
 * operator with the source can produce a key that satisfies every syntactic check. Only the
 * signature separates it from a real one.
 */
function operatorMintedKey(tierCode: string, expiryDate?: Date): string {
  const issueDate = encodeDateToBase36(new Date())
  const expiryEncoded = expiryDate ? encodeDateToBase36(expiryDate) : 'ZZZZ'
  // version(1) + issued(4) + expiry(4) + customerId(4) + serial(8) + quantity(3) = 24.
  // This has to stay byte-correct: the assertion below checks the key fails on the SIGNATURE, so a
  // malformed payload would make the test pass for the wrong reason and keep passing if signature
  // verification were removed entirely.
  const payload = '1' + issueDate + expiryEncoded + 'TEST' + 'AAAAAAAA' + '001'
  const prefix = `WVR-${tierCode}-${payload}`
  return `${prefix}-${signLicensePrefix(prefix, OPERATOR.privateKey)}`
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

  it('should default to free tier when no env vars set', async () => {
    // A real install with no license key is Free tier (not demo).
    // Demo tier is only used for frontend demo builds (VITE_DEMO_MODE).
    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()
    expect(config.tier).toBe('free')
    expect(config.licenseExpiry).toBeNull()
    expect(config.licenseGraceMode).toBe(false)
  })

  it('should map PREMIUM_ENABLED=true to solo tier with deprecation warning (non-production)', async () => {
    process.env.PREMIUM_ENABLED = 'true'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Use dynamic import to get fresh module
    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    expect(config.tier).toBe('solo')
    expect(config.licenseExpiry).toBeNull()
    expect(config.licenseGraceMode).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('PREMIUM_ENABLED is deprecated')
    )

    warnSpy.mockRestore()
  })

  /**
   * The production half of the same variable, and the reason the branch above still exists.
   *
   * PREMIUM_ENABLED grants a paid tier with nothing verified — no key, no signature. That is the
   * capability the whole Ed25519 change exists to take away from the operator, and leaving it
   * ungated made it the cheapest possible bypass of the entire scheme: far easier than forging a
   * key, and it was never covered by a test because the deprecation was read as harmless.
   *
   * The NixOS module sets NODE_ENV=production, so this case is the one every real deployment
   * takes. The pair matters more than either half: the test above proves dev and E2E still work
   * (a gate that broke them would be reverted), this one proves a deployed host cannot be talked
   * into a paid tier by its own configuration.
   */
  it('IGNORES PREMIUM_ENABLED in production — an operator cannot grant themselves a tier', async () => {
    process.env.NODE_ENV = 'production'
    process.env.PREMIUM_ENABLED = 'true'
    // Production refuses to start without one. A throwaway value for a throwaway config object —
    // this test is about tier resolution, and the secret is only here to reach that code.
    process.env.JWT_SECRET = 'test-only-not-a-secret-'.padEnd(64, 'x')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    expect(config.tier).toBe('free')
    expect(config.licenseExpiry).toBeNull()
    expect(config.licenseGraceMode).toBe(false)

    // Loudly, not silently. A setting that stops working without saying so is how someone keeps
    // believing their host is licensed.
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('IGNORED in production'))
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('PREMIUM_ENABLED is deprecated')
    )

    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })

  // ---- The operator cannot grant themselves a tier -------------------------------------------
  //
  // Each of these is the old positive-path test with its premise made explicit: the operator holds
  // the minting material and a well-formed key, and still gets Free. `LICENSE_HMAC_SECRET` is set
  // throughout precisely to show it is now inert — an env var nothing reads.

  it('an operator-minted FABRICK key resolves to FREE — a self-granted tier is not granted', async () => {
    process.env.LICENSE_HMAC_SECRET = 'whatever-the-operator-likes'
    process.env.LICENSE_KEY = operatorMintedKey('FAB')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    expect(config.tier).toBe('free')
    // The REASON matters as much as the tier: it must fail on the signature, not on the format.
    // A format failure would mean this test passes for the wrong reason and would keep passing if
    // signature verification were removed entirely.
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('signature verification failed'))

    errorSpy.mockRestore()
  })

  it('an operator-minted SOLO key resolves to FREE', async () => {
    process.env.LICENSE_HMAC_SECRET = 'whatever-the-operator-likes'
    process.env.LICENSE_KEY = operatorMintedKey('WVS')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    expect(config.tier).toBe('free')
    errorSpy.mockRestore()
  })

  it('setting LICENSE_HMAC_SECRET alone changes nothing — the env var is inert', async () => {
    process.env.LICENSE_HMAC_SECRET = 'a-perfectly-good-secret'
    const { loadConfig } = await import('../src/config.js')
    expect(loadConfig().tier).toBe('free')
  })

  /**
   * Phase-scoped guard that names its own expiry (L-process-2026-08-04).
   *
   * While `ACCEPTED_PUBLIC_KEYS` is empty, NO key verifies — so the assertions above would also
   * pass against a build that had no signature check at all, and the positive path is untestable
   * here. That is correct for now and must not become permanent. This fails the moment the
   * production public key ships, which is exactly when a real positive-path test becomes possible
   * and must be written. Do not delete it without adding that test.
   */
  it('GUARD: restore positive-path tier tests once a production public key ships', () => {
    expect(ACCEPTED_PUBLIC_KEYS).toHaveLength(0)
  })

  it('should fall back to free on invalid LICENSE_KEY', async () => {
    process.env.LICENSE_HMAC_SECRET = 'test-secret'
    process.env.LICENSE_KEY = 'INVALID-KEY-FORMAT'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    expect(config.tier).toBe('free')
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid LICENSE_KEY')
    )

    errorSpy.mockRestore()
  })

  it('an unverifiable LICENSE_KEY does not fall through to PREMIUM_ENABLED', async () => {
    // Precedence still belongs to LICENSE_KEY, and the interesting case is now the failing one:
    // a rejected key must not quietly hand the decision to the deprecated boolean, which would
    // turn "forge a key badly" into a working upgrade path via a legacy flag.
    process.env.LICENSE_KEY = operatorMintedKey('FAB')
    process.env.PREMIUM_ENABLED = 'true'
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    expect(config.tier).toBe('free')
    errorSpy.mockRestore()
  })

  it('an unverifiable key carries no expiry or grace state', async () => {
    // A rejected key must leave the licence fields untouched rather than half-applied — reading
    // expiry out of an unverified payload is exactly the "trust it before checking it" mistake.
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)
    process.env.LICENSE_KEY = operatorMintedKey('WVS', futureDate)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { loadConfig } = await import('../src/config.js')
    const config = loadConfig()

    expect(config.tier).toBe('free')
    expect(config.licenseExpiry).toBeNull()
    expect(config.licenseGraceMode).toBe(false)
    errorSpy.mockRestore()
  })
})

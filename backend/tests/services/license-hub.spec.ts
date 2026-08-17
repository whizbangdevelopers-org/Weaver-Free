// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// The substitute licence hub, driven through the lifecycle it stands in for.
//
// Two things are being tested and they are easy to conflate:
//
//   1. That the hub works — checkout mints, renewal re-mints, cancel revokes.
//   2. That the hub is NOT an authority — its keys are worthless against a shipped build.
//
// (2) is the load-bearing one. It is the reason an unauthenticated minting service is safe to run
// on a laptop, and it is a claim about `ACCEPTED_PUBLIC_KEYS` rather than about this file, so it
// gets asserted rather than assumed.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startHub } from '../../../testing/license-hub/server.js'
import { parseLicenseKey } from '../../src/license.js'
import { TIERS } from '../../src/constants/vocabularies.js'

let hub: Awaited<ReturnType<typeof startHub>>
let base: string
let workDir: string

async function post(path: string, body: unknown) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() as Record<string, string> }
}

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'weaver-hub-test-'))
  // Port 0 — the OS assigns a free one. A hardcoded port makes a test suite fail for reasons that
  // have nothing to do with the code under test.
  hub = await startHub({ port: 0, host: '127.0.0.1', storePath: join(workDir, 'licenses.json'), quiet: true })
  base = `http://127.0.0.1:${hub.port}`
})

afterAll(async () => {
  await hub?.close()
  rmSync(workDir, { recursive: true, force: true })
})

describe('substitute licence hub — issuance', () => {
  it('mints a key at checkout that the product accepts against the hub authority', async () => {
    const { status, body } = await post('/checkout', { tier: 'fabrick', expiresAt: '2027-06-15T00:00:00Z' })
    expect(status).toBe(200)

    const parsed = parseLicenseKey(body.key, new Date('2026-08-17T00:00:00Z'), [hub.publicKey])
    expect(parsed.tier).toBe(TIERS.FABRICK)
    expect(parsed.expiry?.toISOString().slice(0, 10)).toBe('2027-06-15')
  })

  it('mints every issuable tier', async () => {
    for (const [name, tier] of [['solo', TIERS.SOLO], ['team', TIERS.TEAM], ['fabrick', TIERS.FABRICK]] as const) {
      const { body } = await post('/checkout', { tier: name, expiresAt: '2027-06-15T00:00:00Z' })
      expect(parseLicenseKey(body.key, new Date('2026-08-17T00:00:00Z'), [hub.publicKey]).tier).toBe(tier)
    }
  })

  it('rejects an unknown tier rather than guessing', async () => {
    // Deliberately a name that never was a Weaver tier. The tempting fixture here is a RETIRED
    // name, which reads as the more realistic typo — but retired vocabulary in source is a
    // reintroduction vector wherever it appears, and `audit:vocabulary` is right to refuse it.
    // The assertion is about an unmapped tier, and an unmapped tier is an unmapped tier.
    const { status } = await post('/checkout', { tier: 'platinum' })
    expect(status).toBe(400)
  })
})

describe('substitute licence hub — renewal (shape)', () => {
  it('mints a NEW key for the new period, and both verify', async () => {
    const first = await post('/checkout', { tier: 'solo', subscriptionId: 'sub_renew', expiresAt: '2026-09-01T00:00:00Z' })
    const renewed = await post('/renew', { subscriptionId: 'sub_renew', expiresAt: '2027-09-01T00:00:00Z' })

    expect(renewed.status).toBe(200)
    expect(renewed.body.key).not.toBe(first.body.key)

    const now = new Date('2026-08-17T00:00:00Z')
    // The OLD key stays cryptographically valid — renewal supersedes by expiry, not by
    // invalidation. Anything else would need a revocation channel the product does not have.
    expect(parseLicenseKey(first.body.key, now, [hub.publicKey]).expiry?.getUTCFullYear()).toBe(2026)
    expect(parseLicenseKey(renewed.body.key, now, [hub.publicKey]).expiry?.getUTCFullYear()).toBe(2027)
  })

  it('refuses to renew an unknown subscription', async () => {
    expect((await post('/renew', { subscriptionId: 'sub_nope' })).status).toBe(404)
  })

  it('refuses to renew a REVOKED licence — a routine event must not un-revoke', async () => {
    await post('/checkout', { tier: 'solo', subscriptionId: 'sub_revoked' })
    await post('/cancel', { subscriptionId: 'sub_revoked' })

    expect((await post('/renew', { subscriptionId: 'sub_revoked' })).status).toBe(409)
  })
})

describe('substitute licence hub — cancellation is hub-side only', () => {
  it('revokes the record while the KEY keeps verifying — the honest model', async () => {
    const issued = await post('/checkout', { tier: 'fabrick', subscriptionId: 'sub_cancel', expiresAt: '2027-06-15T00:00:00Z' })
    const cancelled = await post('/cancel', { subscriptionId: 'sub_cancel' })
    expect(cancelled.status).toBe(200)

    // This is the finding the enforcement decision recorded and deliberately did NOT fix,
    // reproduced here on purpose: revocation is
    // written to a row the host never reads, so a cancelled customer's key still resolves to its
    // paid tier until the key's own expiry. A test hub that pretended otherwise would model a
    // capability the product does not have and hide the exposure.
    const parsed = parseLicenseKey(issued.body.key, new Date('2026-08-17T00:00:00Z'), [hub.publicKey])
    expect(parsed.tier).toBe(TIERS.FABRICK)
  })
})

describe('substitute licence hub — it is NOT an authority', () => {
  it('its keys are rejected by a build that does not accept its public key', async () => {
    const { body } = await post('/checkout', { tier: 'fabrick' })

    // The default accepted set is the SHIPPED one. This is the assertion that makes an
    // unauthenticated minting endpoint safe to run at all.
    expect(() => parseLicenseKey(body.key)).toThrow('signature verification failed')
  })

  it('reports itself as a non-production authority', async () => {
    const res = await fetch(`${base}/authority`)
    const body = await res.json() as { publicKey: string; isProductionAuthority: boolean }

    expect(body.isProductionAuthority).toBe(false)
    expect(body.publicKey).toBe(hub.publicKey)
  })
})

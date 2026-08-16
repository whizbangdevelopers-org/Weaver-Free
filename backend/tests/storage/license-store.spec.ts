// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LicenseStore } from '../../src/storage/license-store.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('LicenseStore', () => {
  let store: LicenseStore
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'license-store-test-'))
    store = new LicenseStore(join(tempDir, 'licenses.json'))
    await store.init()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  const makeRecord = (overrides: Partial<Parameters<typeof store.save>[0]> = {}) => ({
    key: 'WVR-WVS-ABCD1234EFGH-A1B2',
    tier: 'weaver',
    stripeCustomerId: 'cus_test123',
    stripeSubscriptionId: 'sub_test456',
    expiresAt: '2027-01-01T00:00:00.000Z',
    createdAt: '2026-04-08T00:00:00.000Z',
    email: 'test@example.com',
    foundingMember: false,
    ...overrides,
  })

  it('saves and retrieves a license by key', async () => {
    await store.save(makeRecord())
    const found = store.findByKey('WVR-WVS-ABCD1234EFGH-A1B2')
    expect(found).not.toBeNull()
    expect(found!.tier).toBe('weaver')
    expect(found!.email).toBe('test@example.com')
  })

  it('returns null for unknown key', () => {
    expect(store.findByKey('WVR-WVS-NONEXISTENT00-XXXX')).toBeNull()
  })

  it('finds by subscription ID', async () => {
    await store.save(makeRecord())
    const found = store.findBySubscription('sub_test456')
    expect(found).not.toBeNull()
    expect(found!.key).toBe('WVR-WVS-ABCD1234EFGH-A1B2')
  })

  it('finds by customer ID', async () => {
    await store.save(makeRecord())
    await store.save(makeRecord({
      key: 'WVR-FAB-XXXX1234YYYY-B2C3',
      tier: 'fabrick',
      stripeSubscriptionId: 'sub_fab789',
    }))
    const found = store.findByCustomer('cus_test123')
    expect(found).toHaveLength(2)
  })

  // `renew` replaced `updateExpiry`, which moved the expiry ALONE. That wrote to a field no
  // enforcement path reads — the authority is the key, which carries its own signed expiry — so
  // a renewed row recorded a customer as current while the key on their host still expired at
  // the end of their first billing period.
  it('replaces the key and the expiry together', async () => {
    await store.save(makeRecord())
    const renewed = await store.renew('sub_test456', 'WVR-WVS-NEWKEY123456-C3D4', '2028-01-01T00:00:00.000Z')

    expect(renewed).toBe(true)
    const found = store.findBySubscription('sub_test456')
    expect(found!.expiresAt).toBe('2028-01-01T00:00:00.000Z')
    // The half that used to be missed: the stored key must be the one that carries that expiry.
    expect(found!.key).toBe('WVR-WVS-NEWKEY123456-C3D4')
  })

  it('finds the renewed licence by its NEW key, and no longer by the old one', async () => {
    await store.save(makeRecord())
    await store.renew('sub_test456', 'WVR-WVS-NEWKEY123456-C3D4', '2028-01-01T00:00:00.000Z')

    expect(store.findByKey('WVR-WVS-NEWKEY123456-C3D4')).not.toBeNull()
    expect(store.findByKey('WVR-WVS-ABCD1234EFGH-A1B2')).toBeNull()
  })

  it('returns false when renewing a non-existent subscription', async () => {
    const renewed = await store.renew('sub_nonexistent', 'WVR-WVS-NEWKEY123456-C3D4', '2028-01-01T00:00:00.000Z')
    expect(renewed).toBe(false)
  })

  // Re-minting for a revoked licence would silently un-revoke it through a routine Stripe event.
  it('refuses to renew a revoked licence', async () => {
    await store.save(makeRecord())
    await store.revoke('sub_test456')

    expect(await store.renew('sub_test456', 'WVR-WVS-NEWKEY123456-C3D4', '2028-01-01T00:00:00.000Z')).toBe(false)
    expect(store.findBySubscription('sub_test456')!.key).toBe('WVR-WVS-ABCD1234EFGH-A1B2')
  })

  it('revokes a license by subscription ID', async () => {
    await store.save(makeRecord())
    const revoked = await store.revoke('sub_test456')
    expect(revoked).toBe(true)
    // Revoked key should not be found
    expect(store.findByKey('WVR-WVS-ABCD1234EFGH-A1B2')).toBeNull()
  })

  it('returns false when revoking non-existent subscription', async () => {
    const revoked = await store.revoke('sub_nonexistent')
    expect(revoked).toBe(false)
  })

  it('deduplicates by subscription ID on save', async () => {
    await store.save(makeRecord())
    await store.save(makeRecord({ email: 'updated@example.com' }))
    expect(store.all()).toHaveLength(1)
    expect(store.all()[0].email).toBe('updated@example.com')
  })

  it('persists across reloads', async () => {
    await store.save(makeRecord())

    const store2 = new LicenseStore(join(tempDir, 'licenses.json'))
    await store2.init()
    expect(store2.findByKey('WVR-WVS-ABCD1234EFGH-A1B2')).not.toBeNull()
  })

  it('excludes revoked licenses from findByCustomer', async () => {
    await store.save(makeRecord())
    await store.revoke('sub_test456')
    expect(store.findByCustomer('cus_test123')).toHaveLength(0)
  })
})

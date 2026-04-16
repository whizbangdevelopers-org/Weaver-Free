// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { describe, it, expect } from 'vitest'
import {
  getComplianceSlugs,
  isValidComplianceSlug,
  generateCompliancePdf,
} from '../../src/services/compliance-pdf.js'

describe('getComplianceSlugs()', () => {
  it('returns an array of strings', () => {
    const slugs = getComplianceSlugs()
    expect(Array.isArray(slugs)).toBe(true)
    expect(slugs.length).toBeGreaterThan(0)
    expect(slugs.every(s => typeof s === 'string')).toBe(true)
  })

  it('includes known compliance document slugs', () => {
    const slugs = getComplianceSlugs()
    expect(slugs).toContain('security-baselines')
    expect(slugs).toContain('nist-800-171')
    expect(slugs).toContain('hipaa-164-312')
    expect(slugs).toContain('pci-dss')
    expect(slugs).toContain('cis-benchmarks')
    expect(slugs).toContain('soc2-readiness')
  })

  it('returns 6 slugs (matches the COMPLIANCE_DOCS map)', () => {
    const slugs = getComplianceSlugs()
    expect(slugs).toHaveLength(6)
  })

  it('returns the same set on repeated calls', () => {
    const a = getComplianceSlugs()
    const b = getComplianceSlugs()
    expect(a).toEqual(b)
  })
})

describe('isValidComplianceSlug()', () => {
  it('returns true for known slugs', () => {
    expect(isValidComplianceSlug('security-baselines')).toBe(true)
    expect(isValidComplianceSlug('nist-800-171')).toBe(true)
    expect(isValidComplianceSlug('hipaa-164-312')).toBe(true)
    expect(isValidComplianceSlug('pci-dss')).toBe(true)
    expect(isValidComplianceSlug('cis-benchmarks')).toBe(true)
    expect(isValidComplianceSlug('soc2-readiness')).toBe(true)
  })

  it('returns false for unknown slugs', () => {
    expect(isValidComplianceSlug('unknown')).toBe(false)
    expect(isValidComplianceSlug('')).toBe(false)
    expect(isValidComplianceSlug('gdpr')).toBe(false)
    expect(isValidComplianceSlug('SECURITY-BASELINES')).toBe(false) // case sensitive
  })

  it('returns false for near-miss slugs', () => {
    expect(isValidComplianceSlug('security_baselines')).toBe(false)
    expect(isValidComplianceSlug('nist800171')).toBe(false)
  })
})

describe('generateCompliancePdf()', () => {
  it('throws for an unknown slug', async () => {
    await expect(
      generateCompliancePdf({
        slug: 'not-a-real-slug',
        version: '1.0.0',
        weasyprintBin: 'weasyprint',
        docsRoot: '/tmp/docs',
        cacheDir: '/tmp/cache',
      }),
    ).rejects.toThrow('Unknown compliance document: not-a-real-slug')
  })

  it('throws for an empty slug', async () => {
    await expect(
      generateCompliancePdf({
        slug: '',
        version: '1.0.0',
        weasyprintBin: 'weasyprint',
        docsRoot: '/tmp/docs',
        cacheDir: '/tmp/cache',
      }),
    ).rejects.toThrow('Unknown compliance document:')
  })
})

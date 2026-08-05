// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Route-level contract for the compliance PDF endpoint.
 *
 * WHY THIS EXISTS: `compliance.ts` is allowlisted in audit:test-coverage as a "thin route —
 * delegates to compliance-pdf service", which was true until the route gained a `200:
 * z.instanceof(Buffer)` response schema. That schema is route-level behaviour the service
 * test cannot see: a response schema is what Fastify serializes through, so getting it
 * wrong corrupts the download while every service test stays green.
 *
 * WHAT THE BYTE-IDENTITY ASSERTION ACTUALLY PINS — stated precisely, because the obvious
 * claim is wrong. It does NOT prove "the response schema doesn't serialize the buffer":
 * Fastify skips serialization for Buffer payloads *unconditionally*, so that failure is
 * unreachable. Measured — a deliberately mismatched `200: z.object({ nope: z.string() })`
 * still returns the bytes intact. A test whose stated purpose cannot fail is decoration,
 * and writing one here would repeat the exact defect this change set out to fix.
 *
 * What it does pin, both of which are reachable:
 *   1. the handler keeps sending a Buffer with `application/pdf` — a refactor to
 *      `.send(buf.toString())` or a dropped header fails here;
 *   2. the framework's Buffer bypass itself, which the `200: z.instanceof(Buffer)` schema
 *      RELIES on. If a future Fastify or fastify-type-provider-zod ever serializes Buffers,
 *      this test fails and tells us the schema is no longer safe — which is the assumption
 *      that was verified by hand exactly once, during the change that introduced it.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'

// A real PDF header plus bytes that are NOT valid UTF-8 — if anything serializes or
// re-encodes the payload, these are the bytes that change.
const FAKE_PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0xe2, 0xe3, 0xcf, 0xd3, 0x00, 0xff])

vi.mock('../../src/services/compliance-pdf.js', () => ({
  getComplianceSlugs: () => ['soc2-readiness', 'pci-dss-mapping'],
  isValidComplianceSlug: (slug: string) => ['soc2-readiness', 'pci-dss-mapping'].includes(slug),
  generateCompliancePdf: vi.fn(async () => Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0xe2, 0xe3, 0xcf, 0xd3, 0x00, 0xff])),
}))

const { complianceRoutes } = await import('../../src/routes/compliance.js')

describe('Compliance Routes', () => {
  let fastify: ReturnType<typeof Fastify>

  beforeAll(async () => {
    fastify = Fastify()
    fastify.setValidatorCompiler(validatorCompiler)
    fastify.setSerializerCompiler(serializerCompiler)
    await fastify.register(complianceRoutes, {
      prefix: '/api/compliance',
      config: { dataDir: '/tmp/weaver-compliance-test', weasyprintBin: 'weasyprint' } as never,
      docsRoot: '/tmp/weaver-docs',
      appVersion: '1.0.5',
    })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
  })

  it('lists available compliance documents', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/compliance' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ documents: ['soc2-readiness', 'pci-dss-mapping'] })
  })

  it('returns the PDF byte-identical as application/pdf', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/compliance/soc2-readiness/pdf' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    // Raw bytes out === raw bytes in, including the non-UTF-8 ones. See the file header
    // for what this does and does not prove.
    expect(res.rawPayload.equals(FAKE_PDF)).toBe(true)
  })

  it('sets a versioned attachment filename', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/compliance/pci-dss-mapping/pdf' })
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="weaver-pci-dss-mapping-v1.0.5.pdf"',
    )
  })

  it('rejects an unknown slug at validation rather than reaching the generator', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/compliance/not-a-real-doc/pdf' })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.statusCode).toBeLessThan(500)
  })
})

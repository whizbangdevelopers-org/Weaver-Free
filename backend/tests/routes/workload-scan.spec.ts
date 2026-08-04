// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// `POST /api/workload/scan` had NO test of any kind before this file, on either the pre-existing
// behaviour or the two changes slice 2 makes to it (apptainer joining the declared runtime set,
// and Promise.all -> allSettled). It is the route that writes to the registry, it is the one an
// operator reaches for when the dashboard looks wrong, and every property below was previously
// resting on inspection alone.
//
// The aggregation properties in particular are invisible from the outside when they break: a
// dropped runtime and a runtime that found nothing return the identical 200 with an empty array.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import type { ScanResult } from '../../src/services/microvm.js'
import type { DashboardConfig } from '../../src/config.js'

vi.mock('../../src/services/microvm.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/microvm.js')>()),
  scanMicrovms: vi.fn(),
  scanContainers: vi.fn(),
}))

import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod'
import { workloadsRoutes } from '../../src/routes/workloads.js'
import { scanMicrovms, scanContainers } from '../../src/services/microvm.js'
import type { UserRole } from '../../src/models/user.js'

const mockScanMicrovms = scanMicrovms as ReturnType<typeof vi.fn>
const mockScanContainers = scanContainers as ReturnType<typeof vi.fn>

const empty = (): ScanResult => ({ discovered: [], added: [], existing: [] })
const found = (name: string): ScanResult => ({ discovered: [name], added: [name], existing: [] })

function makeConfig(runtimes: string[] | undefined): DashboardConfig {
  return { tier: 'weaver', containerRuntimes: runtimes } as unknown as DashboardConfig
}

let mockUserRole: UserRole = 'admin'
let routeConfig: DashboardConfig

/** Fresh app per suite: containerRuntimes is read from plugin options at request time. */
function buildApp(config: DashboardConfig) {
  const fastify = Fastify().withTypeProvider<ZodTypeProvider>()
  fastify.decorateRequest('userId', undefined)
  fastify.decorateRequest('userRole', undefined)
  fastify.decorateRequest('username', undefined)
  fastify.setValidatorCompiler(validatorCompiler)
  fastify.setSerializerCompiler(serializerCompiler)
  fastify.addHook('onRequest', async (request) => {
    request.userRole = mockUserRole
    request.userId = 'test-user-id'
    request.username = 'test-user'
  })
  return fastify.register(workloadsRoutes, { prefix: '/api/workload', config }).then(() => fastify)
}

describe('POST /api/workload/scan', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    routeConfig = makeConfig(['docker', 'podman', 'apptainer'])
    app = await buildApp(routeConfig)
    await app.ready()
  })
  afterAll(async () => { await app.close() })

  beforeEach(() => {
    // resetAllMocks, NOT clearAllMocks. clearAllMocks clears recorded calls but LEAVES the
    // mockResolvedValueOnce queue intact, so a test that queues three `once` values and only makes
    // two calls hands its leftover to the NEXT test's first call. That is not hypothetical: it
    // masked a genuine failure in the mutation check on this very file — the allSettled guard
    // reported green in-file and red in isolation, which is the worse of the two orderings because
    // the in-file run is the one CI reads.
    vi.resetAllMocks()
    mockUserRole = 'admin'
    mockScanMicrovms.mockResolvedValue(empty())
    mockScanContainers.mockResolvedValue(empty())
  })

  it('requires admin', async () => {
    mockUserRole = 'operator'
    const res = await app.inject({ method: 'POST', url: '/api/workload/scan' })
    expect(res.statusCode).toBe(403)
  })

  // The gap-1 wiring, seen from the route: apptainer is now scanned when declared. Before slice 2
  // a `docker|podman` filter dropped it here regardless of what the operator declared.
  it('scans every DECLARED runtime, apptainer included', async () => {
    await app.inject({ method: 'POST', url: '/api/workload/scan' })
    expect(mockScanContainers.mock.calls.map(c => c[0])).toEqual(['docker', 'podman', 'apptainer'])
  })

  it('aggregates microvm and container results into one response', async () => {
    mockScanMicrovms.mockResolvedValue(found('web-nginx'))
    mockScanContainers
      .mockResolvedValueOnce(found('my-nginx'))
      .mockResolvedValueOnce(empty())
      .mockResolvedValueOnce(found('logtest'))

    const res = await app.inject({ method: 'POST', url: '/api/workload/scan' })
    expect(res.statusCode).toBe(200)
    expect(res.json().discovered.sort()).toEqual(['logtest', 'my-nginx', 'web-nginx'])
    expect(res.json().added.sort()).toEqual(['logtest', 'my-nginx', 'web-nginx'])
  })

  // Acceptance criterion 4. The per-scan catch handles a MISSING BINARY; this covers the case it
  // cannot — a scan that rejects after the exec (a registry write failing). Under Promise.all one
  // rejection discarded every other scan's results, so a complete docker inventory was lost
  // because a different runtime failed. The 200 is deliberate: partial discovery is the useful
  // answer, and the failure is logged rather than returned (it carries binary and registry paths).
  it('keeps the other runtimes results when one scan rejects outright', async () => {
    mockScanMicrovms.mockResolvedValue(found('web-nginx'))
    mockScanContainers
      .mockResolvedValueOnce(found('my-nginx'))
      .mockRejectedValueOnce(new Error('EACCES: /var/lib/weaver/workloads.json'))
      .mockResolvedValueOnce(found('logtest'))

    const res = await app.inject({ method: 'POST', url: '/api/workload/scan' })
    expect(res.statusCode).toBe(200)
    expect(res.json().discovered.sort()).toEqual(['logtest', 'my-nginx', 'web-nginx'])
  })

  it('never leaks a scan failure path into the response body', async () => {
    mockScanContainers.mockRejectedValue(new Error('EACCES: /var/lib/weaver/workloads.json'))
    const res = await app.inject({ method: 'POST', url: '/api/workload/scan' })
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toMatch(/var\/lib|EACCES/)
  })
})

describe('POST /api/workload/scan — declared runtime set', () => {
  beforeEach(() => {
    // resetAllMocks, NOT clearAllMocks. clearAllMocks clears recorded calls but LEAVES the
    // mockResolvedValueOnce queue intact, so a test that queues three `once` values and only makes
    // two calls hands its leftover to the NEXT test's first call. That is not hypothetical: it
    // masked a genuine failure in the mutation check on this very file — the allSettled guard
    // reported green in-file and red in isolation, which is the worse of the two orderings because
    // the in-file run is the one CI reads.
    vi.resetAllMocks()
    mockUserRole = 'admin'
    mockScanMicrovms.mockResolvedValue(empty())
    mockScanContainers.mockResolvedValue(empty())
  })

  // An operator who declared no runtimes gets no container exec at all — not a silent fallback to
  // the docker/podman pair. The unset-vs-empty distinction is the whole point of the option.
  it('scans no containers when the operator declared an empty list', async () => {
    const app = await buildApp(makeConfig([]))
    await app.ready()
    await app.inject({ method: 'POST', url: '/api/workload/scan' })
    expect(mockScanContainers).not.toHaveBeenCalled()
    expect(mockScanMicrovms).toHaveBeenCalledOnce()
    await app.close()
  })

  it('falls back to docker+podman when containerRuntimes is unset', async () => {
    const app = await buildApp(makeConfig(undefined))
    await app.ready()
    await app.inject({ method: 'POST', url: '/api/workload/scan' })
    expect(mockScanContainers.mock.calls.map(c => c[0])).toEqual(['docker', 'podman'])
    await app.close()
  })
})

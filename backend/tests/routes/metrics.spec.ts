// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// The route's job is two things: render the exposition, and refuse anyone who is not local.
// The second is security-bearing — /metrics lists every workload by name, and Prometheus cannot
// express the per-VM ACLs Weaver enforces everywhere else. An unauthenticated scrape endpoint is
// only defensible because of that refusal, so it is tested through the real Fastify stack rather
// than by calling the predicate directly.
import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import { metricsRoutes, EXPOSITION_CONTENT_TYPE } from '../../src/routes/metrics.js'
import { cgroupPathFor } from '../../src/services/metrics.js'

const ROOT = '/fake/cgroup'
// DERIVED from the production path builder, never restated. A fake cgroupfs keyed by a
// hand-written path can silently disagree with the real one — which is how a base path
// missing systemd's implicit `system-microvm.slice` passed every test while reading a
// directory that exists on no host.
const cg = (n: string, f: string) => `${cgroupPathFor(n, ROOT)}/${f}`

function build(overrides: Partial<Parameters<typeof metricsRoutes>[1]> = {}) {
  const fastify = Fastify()
  return fastify
    .register(metricsRoutes, {
      prefix: '/metrics',
      read: async (path: string) => {
        const files: Record<string, string> = {
          [cg('web', 'cpu.stat')]: 'usage_usec 3000000',
          [cg('web', 'memory.current')]: '2097152',
          [cg('web', 'io.stat')]: '8:0 rbytes=1024 wbytes=2048',
        }
        return path in files ? files[path]! : null
      },
      listWorkloads: async () => [{ name: 'web', vcpu: 2 }],
      cgroupRoot: ROOT,
      ...overrides,
    })
    .then(() => fastify)
}

describe('GET /metrics', () => {
  it('serves the exposition to a loopback caller', async () => {
    const fastify = await build()
    const res = await fastify.inject({ method: 'GET', url: '/metrics', remoteAddress: '127.0.0.1' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe(EXPOSITION_CONTENT_TYPE)
    expect(res.body).toContain('weaver_workload_cpu_usage_seconds_total{workload="web"} 3')
    expect(res.body).toContain('weaver_workload_memory_bytes{workload="web"} 2097152')
    expect(res.body).toContain('weaver_workload_disk_read_bytes_total{workload="web"} 1024')
    expect(res.body).toContain('weaver_workload_vcpus{workload="web"} 2')
    await fastify.close()
  })

  it('REFUSES a remote caller — the ACL boundary, not a nicety', async () => {
    const fastify = await build()
    for (const remoteAddress of ['192.168.1.50', '10.0.0.9', '::ffff:192.168.1.50']) {
      const res = await fastify.inject({ method: 'GET', url: '/metrics', remoteAddress })
      expect(res.statusCode).toBe(404)
      // And it must not leak the inventory in the refusal itself.
      expect(res.body).not.toContain('weaver_workload')
    }
    await fastify.close()
  })

  it('answers 404 rather than 403, so a remote caller learns nothing', async () => {
    // A 403 confirms the endpoint exists and that metrics are worth reaching another way.
    const fastify = await build()
    const res = await fastify.inject({ method: 'GET', url: '/metrics', remoteAddress: '8.8.8.8' })
    expect(res.statusCode).toBe(404)
    await fastify.close()
  })

  it('still serves host metrics when workload collection throws', async () => {
    // One failing source must not empty the exposition: a scrape returning nothing is
    // indistinguishable from a host with no workloads, and Prometheus records that as fact.
    const fastify = await build({
      listWorkloads: async () => { throw new Error('registry unavailable') },
      getHost: async () => ({ loadAvg1: 2.5 }),
    })
    const res = await fastify.inject({ method: 'GET', url: '/metrics', remoteAddress: '127.0.0.1' })

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('weaver_host_load1 2.5')
    await fastify.close()
  })

  it('still serves workload metrics when host collection throws', async () => {
    const fastify = await build({
      getHost: async () => { throw new Error('host probe failed') },
    })
    const res = await fastify.inject({ method: 'GET', url: '/metrics', remoteAddress: '127.0.0.1' })

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('weaver_workload_vcpus{workload="web"} 2')
    await fastify.close()
  })

  it('returns 200 with an empty body when nothing is measurable', async () => {
    // Not a 500. An empty exposition is a valid scrape result meaning "no series right now", and
    // failing the scrape would make Prometheus record a target-down instead.
    const fastify = await build({ read: async () => null, listWorkloads: async () => [] })
    const res = await fastify.inject({ method: 'GET', url: '/metrics', remoteAddress: '127.0.0.1' })

    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('')
    await fastify.close()
  })
})

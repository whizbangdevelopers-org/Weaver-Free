// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * `GET /metrics` — Prometheus scrape endpoint.
 *
 * ## Why this is loopback-only
 *
 * The exposition lists every workload on the host by name with its resource usage. Weaver enforces
 * per-VM ACLs so that a user sees only the workloads they have access to — and Prometheus has no
 * notion of them. Serving this to the network would hand any reachable client the full workload
 * inventory and silently void that ACL, which is precisely the reason the metrics API keeps a
 * server-side proxy in front of PromQL instead of letting the browser query Prometheus directly.
 *
 * Prometheus runs on the same host by design here — the exporter is in-process, and a single-host
 * install is the shape the product ships. So loopback is not a limitation to work around; it is the
 * boundary that makes an unauthenticated scrape endpoint safe at all. A remote scraper is a
 * deliberate future change that must arrive WITH a credential, not by widening this.
 *
 * It is registered as a public route so a scrape needs no token, and that is only defensible
 * BECAUSE of the address check below. The two are one decision, not two.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import {
  collectWorkloadFamilies,
  collectHostFamilies,
  renderExposition,
  type WorkloadTarget,
  type HostReadings,
  type MetricFamily,
} from '../services/prometheus-exporter.js'
import type { CgroupReader } from '../services/metrics.js'

/** Prometheus text exposition content type, version-pinned as the format requires. */
export const EXPOSITION_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8'

/**
 * Is the peer the local machine?
 *
 * Accepts IPv4 loopback, IPv6 loopback, and the IPv4-mapped-IPv6 form Node reports when a dual
 * stack socket receives a v4 connection (`::ffff:127.0.0.1`) — that last one is the shape most
 * commonly missed, and missing it breaks scraping on an ordinary dual-stack host rather than
 * failing safe.
 *
 * Deliberately does NOT consult `X-Forwarded-For`. A proxy header is attacker-controlled, so
 * trusting it here would convert a loopback check into no check at all for anyone who can set a
 * header. If Weaver is behind a reverse proxy, the proxy must not forward /metrics.
 */
export function isLoopback(address: string | undefined): boolean {
  if (!address) return false
  const addr = address.startsWith('::ffff:') ? address.slice(7) : address
  return addr === '127.0.0.1' || addr === '::1' || addr.startsWith('127.')
}

export interface MetricsRouteOptions {
  read: CgroupReader
  /** Current workloads with their vCPU allocation — the registry is the only source of the divisor. */
  listWorkloads: () => Promise<WorkloadTarget[]>
  /** Host readings; absent fields are omitted from the exposition rather than zeroed. */
  getHost?: () => Promise<HostReadings>
  cgroupRoot?: string
  /** Test seam only. Never set in production — see the loopback rationale above. */
  allowRemote?: boolean
}

export async function metricsRoutes(
  fastify: FastifyInstance,
  opts: MetricsRouteOptions,
): Promise<void> {
  fastify.get('/', async (request: FastifyRequest, reply) => {
    if (!opts.allowRemote && !isLoopback(request.ip)) {
      // 404, not 403: a scrape endpoint that announces itself to a remote caller tells an attacker
      // the host runs Weaver and that metrics exist to be reached another way. Nothing is gained by
      // confirming it.
      return reply.code(404).send({ error: 'Not found' })
    }

    const families: MetricFamily[] = []

    try {
      const workloads = await opts.listWorkloads()
      families.push(...(await collectWorkloadFamilies({
        read: opts.read,
        workloads,
        ...(opts.cgroupRoot ? { cgroupRoot: opts.cgroupRoot } : {}),
        // Registered workloads, none of them measurable. Per workload that is ordinary (stopped);
        // across ALL of them it means the base path is wrong for this host, and the previous
        // behaviour was to publish an empty exposition and say nothing — which is exactly how a
        // path missing systemd's implicit `system-microvm.slice` survived undetected.
        onNoneReadable: ({ workloads: n, samplePath }) => {
          request.log.warn(
            { workloads: n, samplePath },
            'metrics: no workload cgroup was readable — check the cgroup base path for this host'
          )
        },
      })))
    } catch (err) {
      // One failing source must not empty the whole exposition. A scrape that returns nothing looks
      // identical to a host with no workloads, and Prometheus would record that as fact.
      request.log.error({ err }, 'metrics: workload collection failed')
    }

    if (opts.getHost) {
      try {
        families.push(...collectHostFamilies(await opts.getHost()))
      } catch (err) {
        request.log.error({ err }, 'metrics: host collection failed')
      }
    }

    return reply.code(200).type(EXPOSITION_CONTENT_TYPE).send(renderExposition(families))
  })
}

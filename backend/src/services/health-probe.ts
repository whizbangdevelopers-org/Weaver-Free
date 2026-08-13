// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Service health probes — is the service INSIDE the workload actually up?
 *
 * `systemctl is-active` says the VM is running. It says nothing about whether nginx crashed inside
 * it. A workload can be green on the dashboard and serving nothing, which is the gap this closes.
 *
 * Free tier displays health status; probe CONFIGURATION is Solo and above. Read-only visibility is
 * free, mutations follow the provisioning gate — the same split the rest of the product uses.
 *
 * No dependencies: `node:net` and `node:http` built-ins only.
 *
 * SSRF IS THE WHOLE RISK HERE, AND IT IS NOT HYPOTHETICAL
 * ------------------------------------------------------
 * This module makes outbound requests to an address that arrives as workload configuration. That
 * is a server-side request forgery primitive by construction: without a restriction, a probe
 * pointed at `169.254.169.254` or a LAN admin panel turns Weaver into a scanner that runs every
 * broadcast cycle, from inside the host network, on a 2-second timer.
 *
 * So the target must be a private address, checked HERE rather than at the route. The plan puts
 * this under "Security Considerations" as a route-level validation; doing it in the probe itself is
 * strictly stronger — a probe reaching this function has already escaped whatever the route
 * checked, and the registry can hold definitions written before any route validation existed.
 * Defence at the point of egress cannot be bypassed by a new caller.
 *
 * Refusal is explicit, never a silent skip: an out-of-range target reports `unreachable`, which is
 * distinguishable from `unhealthy` (service down) and from `unknown` (not checked). A misconfigured
 * probe that read as "unhealthy" would send someone debugging a service that was never contacted.
 */
import { createConnection } from 'node:net'
import { request } from 'node:http'

/** A probe's health, as shipped to the UI. */
export type ProbeHealth = 'healthy' | 'unhealthy' | 'unknown' | 'unreachable'

export interface WorkloadServiceProbe {
  port: number
  type: 'http' | 'tcp'
  /** HTTP only — the URL to open in a browser. Must be private-range, same as the probe target. */
  url?: string
  /** Display name, e.g. "Nginx", "PostgreSQL". */
  label?: string
  health: ProbeHealth
}

/** What a caller stores; `health` is computed, never persisted. */
export type ServiceProbeSpec = Omit<WorkloadServiceProbe, 'health'>

/**
 * Pure: is this a private IPv4 address a workload could legitimately live on?
 *
 * RFC1918 plus loopback. Deliberately EXCLUDES 169.254.0.0/16 — link-local carries the cloud
 * metadata endpoint (169.254.169.254), which is the single most valuable SSRF target on any host
 * that has one, and no Weaver workload is ever reachable there.
 */
export function isPrivateIpv4(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim())
  if (!m) return false
  const [a, b, c, d] = m.slice(1).map(Number) as [number, number, number, number]
  if ([a, b, c, d].some(n => n > 255)) return false
  if (a === 127) return true // loopback
  if (a === 10) return true // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  return false
}

/**
 * Pure: may this URL be probed or offered as an "Open" link?
 *
 * http/https only, to a private literal IPv4 host. A hostname is refused even though it may resolve
 * privately: DNS is attacker-influenced and resolves at request time, so a name check is a
 * time-of-check/time-of-use gap. Refusing names costs a little convenience and closes the rebinding
 * hole outright.
 */
export function isProbeableUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  return isPrivateIpv4(u.hostname)
}

/** TCP port check — true if the port accepts a connection within the timeout. */
export function checkTcp(ip: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise(resolve => {
    let done = false
    const finish = (ok: boolean): void => {
      if (done) return
      done = true
      resolve(ok)
    }
    const socket = createConnection({ host: ip, port, timeout: timeoutMs })
    socket.on('connect', () => {
      socket.destroy()
      finish(true)
    })
    socket.on('timeout', () => {
      socket.destroy()
      finish(false)
    })
    socket.on('error', () => {
      socket.destroy()
      finish(false)
    })
  })
}

/** HTTP health check — true if GET returns < 400 within the timeout. */
export function checkHttp(url: string, timeoutMs = 2000): Promise<boolean> {
  return new Promise(resolve => {
    let done = false
    const finish = (ok: boolean): void => {
      if (done) return
      done = true
      resolve(ok)
    }
    const req = request(url, { method: 'GET', timeout: timeoutMs }, res => {
      finish(res.statusCode !== undefined && res.statusCode < 400)
      res.resume() // drain, or the socket is held open until timeout
    })
    req.on('timeout', () => {
      req.destroy()
      finish(false)
    })
    req.on('error', () => finish(false))
    req.end()
  })
}

/**
 * Run every probe for one workload, in parallel.
 *
 * A workload that is not running gets `unknown` for all probes rather than `unhealthy` — a stopped
 * service is not a failed service, and reporting it as failed would make the dashboard cry wolf
 * every time someone stops a VM on purpose.
 */
export async function runProbes(
  ip: string,
  status: string,
  probes: ServiceProbeSpec[],
): Promise<WorkloadServiceProbe[]> {
  if (status !== 'running') {
    return probes.map(p => ({ ...p, health: 'unknown' as const }))
  }

  return Promise.all(
    probes.map(async (probe): Promise<WorkloadServiceProbe> => {
      if (probe.type === 'http') {
        const url = probe.url ?? `http://${ip}:${probe.port}`
        if (!isProbeableUrl(url)) return { ...probe, health: 'unreachable' }
        return { ...probe, health: (await checkHttp(url)) ? 'healthy' : 'unhealthy' }
      }
      if (!isPrivateIpv4(ip)) return { ...probe, health: 'unreachable' }
      return { ...probe, health: (await checkTcp(ip, probe.port)) ? 'healthy' : 'unhealthy' }
    }),
  )
}

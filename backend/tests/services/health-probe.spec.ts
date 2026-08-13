// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Service health probes.
 *
 * The SSRF guard carries the weight here, and it is tested in BOTH directions on purpose. A guard
 * that refuses everything is as broken as one that refuses nothing — it would report every probe
 * `unreachable`, the feature would look dead, and the guard would be the first thing removed. So
 * every MUST-REFUSE case is paired with a MUST-ALLOW one that proves real workload addresses still
 * probe.
 */
import { describe, it, expect } from 'vitest'
import { createServer, type Server } from 'node:http'
import { createServer as createTcpServer, type Server as TcpServer } from 'node:net'
import {
  isPrivateIpv4,
  isProbeableUrl,
  checkTcp,
  checkHttp,
  runProbes,
} from '../../src/services/health-probe.js'

describe('isPrivateIpv4', () => {
  it.each([
    ['10.10.0.10', 'the default Weaver bridge range'],
    ['10.0.0.1', '10/8 lower bound'],
    ['172.16.0.1', '172.16/12 lower bound'],
    ['172.31.255.254', '172.16/12 upper bound'],
    ['192.168.1.50', 'home LAN'],
    ['127.0.0.1', 'loopback — a container published on the host'],
  ])('accepts %s (%s)', ip => {
    expect(isPrivateIpv4(ip)).toBe(true)
  })

  it.each([
    ['169.254.169.254', 'CLOUD METADATA — the highest-value SSRF target on any cloud host'],
    ['169.254.1.1', 'link-local generally'],
    ['8.8.8.8', 'public DNS'],
    ['172.15.0.1', 'just below the 172.16/12 range'],
    ['172.32.0.1', 'just above the 172.16/12 range'],
    ['11.0.0.1', 'adjacent to 10/8 but outside it'],
    ['192.169.0.1', 'adjacent to 192.168/16 but outside it'],
    ['999.1.1.1', 'octet out of range'],
    ['not-an-ip', 'not an address at all'],
    ['', 'empty'],
  ])('refuses %s (%s)', ip => {
    expect(isPrivateIpv4(ip)).toBe(false)
  })
})

describe('isProbeableUrl', () => {
  it.each([
    'http://10.10.0.10',
    'http://10.10.0.10:8080/health',
    'https://192.168.1.5:8443/',
  ])('accepts %s', url => {
    expect(isProbeableUrl(url)).toBe(true)
  })

  it.each([
    ['http://169.254.169.254/latest/meta-data/', 'metadata endpoint'],
    ['http://example.com', 'public host'],
    ['file:///etc/passwd', 'non-http scheme'],
    ['ftp://10.10.0.10', 'non-http scheme, private host'],
    ['not a url', 'unparseable'],
  ])('refuses %s (%s)', url => {
    expect(isProbeableUrl(url)).toBe(false)
  })

  it('refuses a HOSTNAME even when it would resolve privately', () => {
    // DNS resolves at request time and is attacker-influenced, so a name check is a
    // time-of-check/time-of-use gap. Refusing names closes DNS rebinding outright.
    expect(isProbeableUrl('http://localhost:8080')).toBe(false)
    expect(isProbeableUrl('http://my-vm.internal')).toBe(false)
  })
})

describe('checkTcp', () => {
  it('resolves true for a port that accepts a connection', async () => {
    const srv: TcpServer = createTcpServer(s => s.end())
    await new Promise<void>(r => srv.listen(0, '127.0.0.1', r))
    const port = (srv.address() as { port: number }).port
    await expect(checkTcp('127.0.0.1', port)).resolves.toBe(true)
    await new Promise<void>(r => srv.close(() => r()))
  })

  it('resolves false for a closed port, and does not hang', async () => {
    const srv: TcpServer = createTcpServer()
    await new Promise<void>(r => srv.listen(0, '127.0.0.1', r))
    const port = (srv.address() as { port: number }).port
    await new Promise<void>(r => srv.close(() => r())) // now nothing is listening
    await expect(checkTcp('127.0.0.1', port, 500)).resolves.toBe(false)
  })
})

describe('checkHttp', () => {
  const serve = async (status: number): Promise<{ url: string; close: () => Promise<void> }> => {
    const srv: Server = createServer((_req, res) => {
      res.statusCode = status
      res.end('x')
    })
    await new Promise<void>(r => srv.listen(0, '127.0.0.1', r))
    const port = (srv.address() as { port: number }).port
    return {
      url: `http://127.0.0.1:${port}/`,
      close: () => new Promise<void>(r => srv.close(() => r())),
    }
  }

  it.each([200, 204, 301, 399])('treats %i as healthy', async status => {
    const s = await serve(status)
    await expect(checkHttp(s.url)).resolves.toBe(true)
    await s.close()
  })

  it.each([400, 404, 500, 503])('treats %i as unhealthy', async status => {
    const s = await serve(status)
    await expect(checkHttp(s.url)).resolves.toBe(false)
    await s.close()
  })

  it('resolves false when nothing is listening', async () => {
    const s = await serve(200)
    const url = s.url
    await s.close()
    await expect(checkHttp(url, 500)).resolves.toBe(false)
  })
})

describe('runProbes', () => {
  it('reports unknown — never unhealthy — for a workload that is not running', async () => {
    // A stopped service is not a failed service. Reporting it as failed would make the dashboard
    // cry wolf every time someone stops a VM deliberately.
    const out = await runProbes('10.10.0.10', 'stopped', [{ port: 80, type: 'tcp' }])
    expect(out).toEqual([{ port: 80, type: 'tcp', health: 'unknown' }])
  })

  it.each(['failed', 'unknown', 'provisioning'])('reports unknown for status %s', async status => {
    const out = await runProbes('10.10.0.10', status, [{ port: 80, type: 'tcp' }])
    expect(out[0]!.health).toBe('unknown')
  })

  it('refuses a non-private TCP target as unreachable, distinct from unhealthy', async () => {
    const out = await runProbes('8.8.8.8', 'running', [{ port: 53, type: 'tcp' }])
    expect(out[0]!.health).toBe('unreachable')
  })

  it('refuses a metadata-endpoint HTTP probe as unreachable', async () => {
    const out = await runProbes('10.10.0.10', 'running', [
      { port: 80, type: 'http', url: 'http://169.254.169.254/latest/meta-data/' },
    ])
    expect(out[0]!.health).toBe('unreachable')
  })

  it('probes a real private HTTP service and reports healthy', async () => {
    const srv: Server = createServer((_req, res) => {
      res.statusCode = 200
      res.end('ok')
    })
    await new Promise<void>(r => srv.listen(0, '127.0.0.1', r))
    const port = (srv.address() as { port: number }).port

    const out = await runProbes('127.0.0.1', 'running', [
      { port, type: 'http', url: `http://127.0.0.1:${port}/`, label: 'Nginx' },
    ])
    expect(out[0]).toMatchObject({ health: 'healthy', label: 'Nginx', port })
    await new Promise<void>(r => srv.close(() => r()))
  })

  it('defaults the HTTP URL from the workload ip when none is given', async () => {
    const srv: Server = createServer((_req, res) => {
      res.statusCode = 200
      res.end('ok')
    })
    await new Promise<void>(r => srv.listen(0, '127.0.0.1', r))
    const port = (srv.address() as { port: number }).port

    const out = await runProbes('127.0.0.1', 'running', [{ port, type: 'http' }])
    expect(out[0]!.health).toBe('healthy')
    await new Promise<void>(r => srv.close(() => r()))
  })

  it('preserves label and url, and returns one result per probe in order', async () => {
    const out = await runProbes('8.8.8.8', 'running', [
      { port: 1, type: 'tcp', label: 'one' },
      { port: 2, type: 'tcp', label: 'two' },
    ])
    expect(out.map(p => p.label)).toEqual(['one', 'two'])
  })

  it('returns an empty array for a workload with no probes', async () => {
    await expect(runProbes('10.10.0.10', 'running', [])).resolves.toEqual([])
  })
})

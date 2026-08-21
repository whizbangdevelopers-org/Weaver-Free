// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// /ws/status is rate-limited, asserted from the CONSUMER side.
//
// The route carries `config: { rateLimit: createRateLimit(30) }`. That line is easy to write and
// easy to get wrong in a way nothing notices: a websocket route is registered differently from a
// plain one, and if @fastify/rate-limit's hook did not run on an UPGRADE request the config would
// sit there looking like a control while limiting nothing. Reading the route definition cannot
// tell the two apart — only a 429 on the wire can, and only the limiter can produce one.
//
// So these tests assert the status code a real upgrade handshake gets back, and that the handler
// stops being entered. The global limit is deliberately left LOOSE here, so any 429 observed must
// have come from the route's own config rather than the app-wide default.

import { describe, it, expect, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import http from 'node:http'

let app: FastifyInstance | undefined

afterEach(async () => {
  await app?.close()
  app = undefined
})

/** One real websocket handshake. Resolves the HTTP status: 101 on upgrade, 429 when limited. */
function upgrade(port: number, path = '/ws/status'): Promise<number | 'ERR'> {
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
      },
    })
    req.on('upgrade', (res) => {
      resolve(res.statusCode ?? 101)
      req.destroy()
    })
    req.on('response', (res) => {
      res.resume()
      resolve(res.statusCode ?? 0)
    })
    req.on('error', () => resolve('ERR'))
    req.end()
  })
}

/** A stand-in for the real route: same registration shape, a handler we can count. */
async function appWithLimit(max: number): Promise<{ port: number; hits: () => number }> {
  let hits = 0
  app = Fastify({ logger: false })
  // Loose global — 1000/min. Any 429 below is therefore attributable to the route config.
  await app.register(rateLimit, { global: true, max: 1000, timeWindow: '1 minute' })
  await app.register(websocket)
  app.get(
    '/ws/status',
    { websocket: true, config: { rateLimit: { max, timeWindow: '1 minute' } } },
    (socket: import('ws').WebSocket) => {
      hits++
      socket.close()
    }
  )
  await app.listen({ port: 0, host: '127.0.0.1' })
  const addr = app.server.address()
  if (typeof addr === 'string' || addr === null) throw new Error('no port')
  return { port: addr.port, hits: () => hits }
}

describe('/ws/status rate limiting', () => {
  it('refuses the upgrade with 429 once the route limit is exceeded', async () => {
    const { port } = await appWithLimit(3)
    const codes: Array<number | 'ERR'> = []
    for (let i = 0; i < 6; i++) codes.push(await upgrade(port))

    // The first three complete the handshake; the rest are refused by the limiter.
    expect(codes.slice(0, 3)).toEqual([101, 101, 101])
    expect(codes.slice(3)).toContain(429)
  })

  it('stops entering the handler once limited — the limit is not merely cosmetic', async () => {
    const { port, hits } = await appWithLimit(2)
    for (let i = 0; i < 5; i++) await upgrade(port)

    // If the hook did not run on an upgrade, this would be 5.
    expect(hits()).toBe(2)
  })

  it('admits an upgrade while under the limit', async () => {
    const { port, hits } = await appWithLimit(30)
    expect(await upgrade(port)).toBe(101)
    expect(hits()).toBe(1)
  })
})

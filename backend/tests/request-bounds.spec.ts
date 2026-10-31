// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * Every array and record a request can reach is bounded: GHSA-mrhx-c7xc-m3w5.
 *
 * zod collected one issue for every failing element of an array, with no early stop. Measured
 * 2026-10-23 in a sibling product on zod 3.25.76: one 1 MiB request from a signed-in caller cost
 * +621 MiB of heap, an 18 MB answer and a 231 MB log line. zod 4.6.6 stops at a length bound and only
 * there, so the fix is the version, a bound on every array a request reaches, and keys from a closed
 * set (or values that cannot fail) on every record.
 *
 * This spec is the gate on the second and third. It registers every route plugin under `src/routes`
 * and reads each route's input as JSON Schema, so a route added later is checked without being named.
 * Weaver publishes no API description for it to read, so it builds one here.
 *
 * The walker (`helpers/request-bounds.ts`) carries its corpus here, both halves, and the gate runs
 * only after it, so "nothing unbounded" cannot mean "the walker saw nothing".
 */
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import Fastify, { type FastifyPluginAsync } from 'fastify'
import websocket from '@fastify/websocket'
import { z } from 'zod'
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'

import { apiErrorHandler } from '../src/error-handler.js'
import { channelConfigSchema } from '../src/schemas/notification-config.js'
import { unboundedIn, type Unbounded } from './helpers/request-bounds.js'

const ROUTES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/routes')

/**
 * Stands in for every option a plugin takes. A route's schema is fixed when the route is registered,
 * and nothing here serves a request, so any read or call answers another stand-in. It is no thenable,
 * or awaiting one would never finish.
 */
function standIn(): unknown {
  const target = () => undefined
  return new Proxy(target, {
    get: (_t, key) => (key === 'then' ? undefined : key === Symbol.toPrimitive ? () => '' : standIn()),
    apply: () => standIn(),
    construct: () => standIn() as object,
  })
}

/** The input schemas of every route a plugin registers, by `METHOD /url part`. */
async function inputsOf(plugin: FastifyPluginAsync<never>): Promise<Array<[string, unknown]>> {
  const inputs: Array<[string, unknown]> = []
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(websocket)
  app.addHook('onRoute', (route) => {
    const schema = route.schema as Record<string, unknown> | undefined
    for (const part of ['body', 'querystring', 'params', 'headers']) {
      if (schema?.[part]) inputs.push([`${String(route.method)} ${route.url} ${part}`, schema[part]])
    }
  })
  await app.register(plugin, standIn() as never)
  await app.ready()
  await app.close()
  return inputs
}

/** Every exported `*Routes` plugin under `src/routes`, found on disk rather than named. */
async function everyRoutePlugin(): Promise<Array<[string, FastifyPluginAsync<never>]>> {
  const plugins: Array<[string, FastifyPluginAsync<never>]> = []
  const files = readdirSync(ROUTES_DIR, { recursive: true, encoding: 'utf-8' }).filter((f) => f.endsWith('.ts'))
  for (const file of files) {
    const module = (await import(pathToFileURL(join(ROUTES_DIR, file)).href)) as Record<string, unknown>
    for (const [name, value] of Object.entries(module)) {
      if (name.endsWith('Routes') && typeof value === 'function') {
        plugins.push([`${file}#${name}`, value as FastifyPluginAsync<never>])
      }
    }
  }
  return plugins
}

const unboundedInSchema = (schema: unknown, where: string): Unbounded[] =>
  unboundedIn(
    schema instanceof z.ZodType ? z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) : schema,
    where,
  )

describe('the walker: what it must catch', () => {
  it('an array with no maxItems', () => {
    const schema = { type: 'object', properties: { ids: { type: 'array', items: {} } } }
    expect(unboundedIn(schema, 'x')).toEqual([{ kind: 'array', where: 'x.ids' }])
  })

  it('an unbounded array inside a bounded one, inside a union branch', () => {
    const schema = {
      anyOf: [
        { type: 'null' },
        {
          type: 'array',
          maxItems: 4,
          items: { type: 'object', properties: { tags: { type: 'array', items: {} } } },
        },
      ],
    }
    expect(unboundedIn(schema, 'x')).toEqual([{ kind: 'array', where: 'x[].tags' }])
  })

  it('a record whose keys are open and whose values can fail', () => {
    const schema = { type: 'object', additionalProperties: { type: 'string' } }
    expect(unboundedIn(schema, 'x')).toEqual([{ kind: 'record', where: 'x' }])
  })

  it('zod schemas, read as a request reads them', () => {
    expect(unboundedInSchema(z.object({ ids: z.array(z.string()) }), 'x')).toEqual([{ kind: 'array', where: 'x.ids' }])
    expect(unboundedInSchema(z.record(z.string(), z.string()), 'x')).toEqual([{ kind: 'record', where: 'x' }])
  })
})

describe('the walker: what it must not flag', () => {
  it('a bounded array and a tuple', () => {
    const schema = {
      type: 'object',
      properties: {
        ids: { type: 'array', maxItems: 8, items: { type: 'string' } },
        pair: { type: 'array', prefixItems: [{}, {}], items: false },
      },
    }
    expect(unboundedIn(schema, 'x')).toEqual([])
  })

  it('a record keyed by a closed set, one whose values accept anything, and a counted one', () => {
    const closed = { type: 'object', propertyNames: { enum: ['a', 'b'] }, additionalProperties: { type: 'boolean' } }
    expect(unboundedIn(closed, 'x')).toEqual([])
    expect(unboundedIn({ type: 'object', additionalProperties: {} }, 'x')).toEqual([])
    expect(unboundedIn({ type: 'object', maxProperties: 16, additionalProperties: { type: 'string' } }, 'x')).toEqual([])
  })
})

describe('every route', () => {
  it('no array or record a request can reach is unbounded', async () => {
    const unbounded: Unbounded[] = []
    let inputs = 0
    for (const [name, plugin] of await everyRoutePlugin()) {
      for (const [where, schema] of await inputsOf(plugin)) {
        inputs += 1
        unbounded.push(...unboundedInSchema(schema, `${name} ${where}`))
      }
    }
    // Far fewer would mean plugins stopped registering their routes under the stand-in.
    expect(inputs).toBeGreaterThan(40)
    expect(unbounded).toEqual([])
  }, 60_000)
})

describe('a webhook channel headers record', () => {
  const channel = (headers: unknown) => ({
    type: 'webhook',
    enabled: true,
    events: ['vm:started'],
    url: 'https://example.com/hook',
    method: 'POST',
    format: 'json',
    headers,
  })

  it('takes string values, as far as its bound', () => {
    const headers = Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`x-${i}`, 'value']))
    expect(channelConfigSchema.safeParse(channel(headers)).success).toBe(true)
    expect(channelConfigSchema.safeParse(channel(undefined)).success).toBe(true)
  })

  it('answers one problem for a value that is no string, however many there are', () => {
    const headers = Object.fromEntries(Array.from({ length: 100_000 }, (_, i) => [`x-${i}`, i]))
    const parsed = channelConfigSchema.safeParse(channel(headers))
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues).toHaveLength(1)
  })

  it('refuses one header past the bound', () => {
    const headers = Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`x-${i}`, 'value']))
    expect(channelConfigSchema.safeParse(channel(headers)).success).toBe(false)
  })
})

describe('a request past its bound', () => {
  it('a 1 MiB array of failing elements past its bound answers one problem', async () => {
    const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(serializerCompiler)
    app.setErrorHandler(apiErrorHandler)
    app.post(
      '/ids',
      { schema: { body: z.object({ ids: z.array(z.string()).max(8) }) } },
      async () => ({ ok: true }),
    )
    await app.ready()
    const res = await app.inject({
      method: 'POST',
      url: '/ids',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ ids: Array.from({ length: 500_000 }, () => 0) }),
    })
    expect(res.statusCode).toBe(400)
    expect((res.json() as { details: string[] }).details).toHaveLength(1)
    await app.close()
  })
})

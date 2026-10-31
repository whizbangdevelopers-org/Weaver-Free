// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// The server's entry sets its error handler before it registers any route — found 2026-10-24.
//
// A Fastify route takes the error handler its instance has when the route is registered. index.ts
// set `apiErrorHandler` after its routes, so none of them used it: every route answered with
// Fastify's own handler, a 500 carrying the raw error in every mode and a validation failure's
// `message` stripped by `errorResponseSchema`, leaving "Bad Request". `routes/error-handler.spec.ts`
// could not see it, since it builds an app of its own and sets the handler first.
//
// The entry starts a server when it is imported, so this reads its text: the handler's line comes
// before the first `register` of a route. A paired case holds the reading to both answers.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Why the handler is not set before every route in `source`, or null when it is. */
export function handlerOrderProblem(source: string): string | null {
  const lines = source.split('\n')
  const handler = lines.findIndex(l => /^\s*\w+\.setErrorHandler\(/.test(l))
  if (handler < 0) return 'the entry sets no error handler'
  const route = lines.findIndex(l => /^\s*await \w+\.register\(\w*[Rr]outes\b/.test(l))
  if (route >= 0 && route < handler) {
    return `a route is registered on line ${route + 1}, before the error handler on line ${handler + 1}`
  }
  return null
}

describe("the entry's error handler", () => {
  it('the reading catches a route before the handler, and holds its fire on one after', () => {
    expect(
      handlerOrderProblem(
        "await fastify.register(healthRoutes, { prefix: '/api/health' })\nfastify.setErrorHandler(apiErrorHandler)\n",
      ),
    ).toMatch(/line 1, before the error handler on line 2/)
    expect(handlerOrderProblem('const fastify = Fastify()\n')).toBe('the entry sets no error handler')
    expect(
      handlerOrderProblem(
        "fastify.setErrorHandler(apiErrorHandler)\nawait fastify.register(helmet, {})\nawait fastify.register(healthRoutes, { prefix: '/api/health' })\n",
      ),
    ).toBeNull()
  })

  it('is set before any route is registered', () => {
    const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8')
    expect(handlerOrderProblem(source)).toBeNull()
  })
})

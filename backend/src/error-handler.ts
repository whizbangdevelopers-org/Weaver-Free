// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * The API error handler, extracted from index.ts so it can be tested without booting the server.
 *
 * A validation failure answers `{ error, message, details }`, and `message` and `details` reach a
 * client only through a route whose error schema declares them: every route declares its error
 * statuses with `errorResponseSchema` (`schemas/errors.ts`), which does. `tests/routes/error-handler.spec.ts`
 * pins both halves through a real route.
 *
 * ── SET BEFORE ANY ROUTE ─────────────────────────────────────────────────────────────────────
 * A Fastify route takes the error handler its instance has when the route is registered. index.ts
 * set this one after every route until 2026-10-24, so no route used it: each answered with
 * Fastify's own handler, whose `message` the error schema then stripped, leaving a person told only
 * "Bad Request". `tests/entry-order.spec.ts` keeps it first.
 *
 * ── A VALIDATION FAILURE IS ANSWERED AND LOGGED BOUNDED ──────────────────────────────────────
 * A body can fail once per element of an unbounded array, and one problem's message can name every
 * unknown key of a strict object. Answering and logging all of it made one 1 MiB request cost an
 * 18 MB answer and a 231 MB log line in a sibling product (measured 2026-10-23, with
 * GHSA-mrhx-c7xc-m3w5). So the first `MAX_VALIDATION_DETAILS` problems are answered, each cut to
 * `MAX_DETAIL_LENGTH`, with how many more; the log holds the count and those same lines, never the
 * error whole.
 *
 * ── A 500 NEVER CARRIES THE RAW ERROR ────────────────────────────────────────────────────────
 * In every mode, not only in production: a raw system error leaks paths and topology to whoever
 * reads the answer, and the log already holds it whole for the person debugging.
 */
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'

/** Generic detail used when a validation error carries no usable message. */
export const FALLBACK_VALIDATION_DETAIL = 'Invalid request data'

/** How many of a request's problems are answered and logged; the rest are counted. */
export const MAX_VALIDATION_DETAILS = 20

/** How long one answered or logged problem may be, its cut marked with an ellipsis. */
export const MAX_DETAIL_LENGTH = 500

const cut = (message: string) =>
  message.length > MAX_DETAIL_LENGTH ? `${message.slice(0, MAX_DETAIL_LENGTH - 1)}…` : message

export function apiErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  // Zod validation errors — fastify-type-provider-zod v4+ populates error.validation
  // with ZodFastifySchemaValidationError objects (each has .message and .params.issue).
  if (error.validation) {
    const messages = error.validation
      .map((v: { message?: string }) => v.message ?? '')
      .filter(Boolean)
    const first = messages.slice(0, MAX_VALIDATION_DETAILS).map(cut)
    const more = messages.length - first.length
    request.log.error({ problems: messages.length, first }, 'request failed validation')
    const details =
      first.length > 0
        ? [...first, ...(more > 0 ? [`and ${more} more`] : [])]
        : [FALLBACK_VALIDATION_DETAIL]
    // `message` carries the same bounded list as one sentence, which the screens show for a
    // validation failure in place of its bare `error` (`src/utils/error.ts`).
    return reply.status(400).send({
      error: 'Validation failed',
      message: details.join('; '),
      details,
    })
  }

  request.log.error(error)

  const statusCode = error.statusCode || 500
  const message = statusCode >= 500 ? 'Internal Server Error' : (error.message || 'Internal Server Error')
  return reply.status(statusCode).send({ error: message })
}

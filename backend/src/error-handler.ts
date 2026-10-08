// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * The API error handler, extracted from index.ts so it can be tested without booting the server.
 *
 * A validation failure answers `{ error, details }`, and `details` reaches a client only through a
 * route whose error schema declares it: every route declares its error statuses with
 * `errorResponseSchema` (`schemas/errors.ts`), which does. `tests/routes/error-handler.spec.ts`
 * pins both halves through a real route.
 */
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'

/** Generic detail used when a validation error carries no usable message. */
export const FALLBACK_VALIDATION_DETAIL = 'Invalid request data'

export function apiErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  request.log.error(error)

  // Zod validation errors — fastify-type-provider-zod v4+ populates error.validation
  // with ZodFastifySchemaValidationError objects (each has .message and .params.issue).
  if (error.validation) {
    const messages = error.validation
      .map((v: { message?: string }) => v.message ?? '')
      .filter(Boolean)
    return reply.status(400).send({
      error: 'Validation failed',
      details: messages.length > 0 ? messages : [FALLBACK_VALIDATION_DETAIL],
    })
  }

  // Default error — suppress internal details for 500s in production
  const statusCode = error.statusCode || 500
  const isProduction = process.env.NODE_ENV === 'production'
  const message = statusCode >= 500 && isProduction
    ? 'Internal Server Error'
    : (error.message || 'Internal Server Error')
  return reply.status(statusCode).send({ error: message })
}

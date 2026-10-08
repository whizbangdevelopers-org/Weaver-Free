// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

import { z } from 'zod'

/**
 * Every error body the API sends: a handler's `error`, and the `details` the error handler adds to
 * a validation failure (`src/error-handler.ts`). Every route declares its error statuses with this.
 *
 * ONE schema, imported, never retyped. A response schema is a filter as well as a description: the
 * serializer drops any field it does not declare. Thirteen retyped copies declaring `error` alone
 * stripped `details` from every 400 a route declared, VM create and clone among them, so a person
 * was told "Validation failed" and not which field. `tests/routes/error-handler.spec.ts` fails a
 * route or schema module that retypes the shape.
 */
export const errorResponseSchema = z.object({
  error: z.string(),
  details: z.array(z.string()).optional(),
})

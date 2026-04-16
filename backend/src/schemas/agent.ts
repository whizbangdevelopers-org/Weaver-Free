// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { z } from 'zod'

export const agentActionSchema = z.enum(['diagnose', 'explain', 'suggest'])

export const llmVendorSchema = z.enum(['anthropic'])

export const agentRequestSchema = z.object({
  action: agentActionSchema,
  apiKey: z.string().min(1).optional(), // BYOK: optional caller-provided API key
  vendor: llmVendorSchema.optional(),   // BYOV: optional caller-provided vendor
})

export const agentVmParamsSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Invalid VM name format'),
})

export const agentOperationParamsSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, 'Invalid VM name format'),
  operationId: z.string().uuid('Invalid operation ID'),
})

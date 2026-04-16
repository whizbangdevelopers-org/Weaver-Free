// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { z } from 'zod'
import { ROLES } from '../constants/vocabularies.js'

// User preferences (server-side, per-user)
export const userPreferencesSchema = z.object({
  hasSeenWizard: z.boolean().optional(),
})

// Response schema for a single user (no password hash exposed)
export const safeUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  role: z.enum([ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER, ROLES.AUDITOR]),
  createdAt: z.string(),
  preferences: userPreferencesSchema,
})

// GET /api/users response
export const userListResponseSchema = z.array(safeUserSchema)

// PUT /api/users/:id/role — request body
export const roleUpdateSchema = z.object({
  role: z.enum([ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER, ROLES.AUDITOR]),
})

// Route params for :id
export const userIdParamsSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
})

// Common error response
export const errorResponseSchema = z.object({
  error: z.string(),
})

// Success response for mutations
export const userMutationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
})

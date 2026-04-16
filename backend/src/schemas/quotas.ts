// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { z } from 'zod'

/** Schema for a single user's quota configuration */
export const userQuotaSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  maxVms: z.number().int().min(0).nullable(),
  maxMemoryMB: z.number().int().min(0).nullable(),
  maxVcpus: z.number().int().min(0).nullable(),
})

/** Schema for the PUT request body (userId comes from URL params) */
export const quotaUpdateSchema = z.object({
  maxVms: z.number().int().min(0).nullable(),
  maxMemoryMB: z.number().int().min(0).nullable(),
  maxVcpus: z.number().int().min(0).nullable(),
})

/** Schema for URL params */
export const quotaParamsSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
})

/** Response schema for GET quota */
export const quotaResponseSchema = z.object({
  userId: z.string(),
  maxVms: z.number().int().nullable(),
  maxMemoryMB: z.number().int().nullable(),
  maxVcpus: z.number().int().nullable(),
})

/** Response schema for quota usage (returned alongside quota limits) */
export const quotaUsageResponseSchema = z.object({
  userId: z.string(),
  maxVms: z.number().int().nullable(),
  maxMemoryMB: z.number().int().nullable(),
  maxVcpus: z.number().int().nullable(),
  currentVms: z.number().int(),
  currentMemoryMB: z.number().int(),
  currentVcpus: z.number().int(),
})

/** Error response schema */
export const quotaErrorResponseSchema = z.object({
  error: z.string(),
})

export interface UserQuota {
  userId: string
  maxVms: number | null
  maxMemoryMB: number | null
  maxVcpus: number | null
}

export interface QuotaUpdate {
  maxVms: number | null
  maxMemoryMB: number | null
  maxVcpus: number | null
}

export interface QuotaUsageResponse {
  userId: string
  maxVms: number | null
  maxMemoryMB: number | null
  maxVcpus: number | null
  currentVms: number
  currentMemoryMB: number
  currentVcpus: number
}

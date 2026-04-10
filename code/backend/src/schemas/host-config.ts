// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { z } from 'zod'

export const nixConfigSectionTypeSchema = z.enum(['microvm', 'oci-container', 'slurm', 'infrastructure'])

export const nixConfigSectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: nixConfigSectionTypeSchema,
  lineStart: z.number().int().min(1),
  lineEnd: z.number().int().min(1),
  rawNix: z.string(),
})

export const nixConfigResponseSchema = z.object({
  available: z.boolean(),
  rawContent: z.string().nullable(),
  sections: z.array(nixConfigSectionSchema),
  configPath: z.string(),
  readAt: z.string(),
  error: z.string().optional(),
})

export type NixConfigSectionType = 'microvm' | 'oci-container' | 'slurm' | 'infrastructure'

export interface NixConfigSection {
  id: string
  label: string
  type: NixConfigSectionType
  lineStart: number
  lineEnd: number
  rawNix: string
}

export interface NixConfigResponse {
  available: boolean
  rawContent: string | null
  sections: NixConfigSection[]
  configPath: string
  readAt: string
  error?: string
}

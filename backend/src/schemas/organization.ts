// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { z } from 'zod'

export const organizationIdentitySchema = z.object({
  name: z.string().max(100).optional(),
  logoUrl: z.string().max(10_000).nullable().optional(),
  contactEmail: z.string().email().max(254).nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
})

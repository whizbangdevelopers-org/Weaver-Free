// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { z } from 'zod'
import type { SectorId } from '../models/user.js'
import { VALID_SECTORS } from '../models/user.js'
import { ROLES } from '../constants/vocabularies.js'

const sectorEnum = z.enum(VALID_SECTORS as unknown as [SectorId, ...SectorId[]])

export const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username must be at most 32 characters')
    .transform(v => v.toLowerCase())
    .pipe(z.string().regex(/^[a-z][a-z0-9_-]*$/, 'Username must start with a letter and contain only lowercase letters, digits, underscores, and hyphens')),
  password: z.string()
    .min(14, 'Password must be at least 14 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  role: z.enum([ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER]).optional(),
  sector: sectorEnum.optional(),
}).refine(
  (data) => !data.password.toLowerCase().includes(data.username.toLowerCase()),
  { message: 'Password must not contain the username', path: ['password'] },
)

export const sectorSchema = z.object({
  sector: sectorEnum,
})

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').transform(v => v.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required').optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(14, 'New password must be at least 14 characters')
    .max(128, 'New password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
})

export const preferencesSchema = z.object({
  hasSeenWizard: z.boolean().optional(),
}).strict()

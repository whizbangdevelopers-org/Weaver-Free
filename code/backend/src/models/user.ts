// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { UserRole } from '../constants/vocabularies.js'
export type { UserRole }

export type SectorId =
  | 'healthcare'
  | 'defense'
  | 'financial'
  | 'pharma'
  | 'education-k12'
  | 'education-higher'
  | 'government'
  | 'manufacturing'
  | 'research'
  | 'msp'
  | 'homelab'
  | 'student'

export const VALID_SECTORS: SectorId[] = [
  'healthcare',
  'defense',
  'financial',
  'pharma',
  'education-k12',
  'education-higher',
  'government',
  'manufacturing',
  'research',
  'msp',
  'homelab',
  'student',
]

export const SECTOR_LABELS: Record<SectorId, string> = {
  'healthcare': 'Healthcare',
  'defense': 'Defense / Government Contractor',
  'financial': 'Financial Services',
  'pharma': 'Pharma / Life Sciences',
  'education-k12': 'Education (K-12)',
  'education-higher': 'Education (Higher Ed)',
  'government': 'Government / Public Sector',
  'manufacturing': 'Manufacturing / OT',
  'research': 'Research / HPC',
  'msp': 'MSP / IT Consulting',
  'homelab': 'Home Lab / Personal',
  'student': 'Student',
}

/** User preferences stored server-side (survives browser/device changes). */
export interface UserPreferences {
  hasSeenWizard?: boolean
}

export interface User {
  id: string
  username: string
  passwordHash: string
  role: UserRole
  createdAt: string
  preferences?: UserPreferences
  sector?: SectorId
}

/** User data returned to clients (no password hash) */
export interface SafeUser {
  id: string
  username: string
  role: UserRole
  createdAt: string
  preferences: UserPreferences
  sector: SectorId | null
}

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    preferences: user.preferences ?? {},
    sector: user.sector ?? null,
  }
}

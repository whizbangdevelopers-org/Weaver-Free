// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { UserRole } from '../constants/vocabularies.js'

export interface SafeUser {
  id: string
  username: string
  role: UserRole
  createdAt: string
}

export interface UserQuota {
  userId?: string
  maxVms: number | null
  maxMemoryMB: number | null
  maxVcpus: number | null
  currentVms?: number
  currentMemoryMB?: number
  currentVcpus?: number
}

export interface VmAcl {
  userId?: string
  vmNames: string[]
}

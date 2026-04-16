// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
export interface AuditEntry {
  id: string
  timestamp: string
  userId: string | null
  username: string
  action: string
  resource?: string
  details?: Record<string, unknown>
  ip?: string
  success: boolean
}

export interface AuditQueryParams {
  userId?: string
  action?: string
  resource?: string
  since?: string
  until?: string
  success?: boolean
  limit?: number
  offset?: number
}

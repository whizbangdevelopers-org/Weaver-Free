// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
export interface Notification {
  id: string
  timestamp: string
  event: string
  vmName?: string
  severity: 'info' | 'success' | 'error'
  message: string
  details?: Record<string, unknown>
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
export interface DistroEntry {
  name: string
  label: string
  description?: string
  url: string
  effectiveUrl?: string
  format: 'qcow2' | 'raw' | 'iso'
  cloudInit: boolean
  guestOs: 'linux' | 'windows'
  builtin: boolean
  hasOverride?: boolean
  category: 'builtin' | 'catalog' | 'custom'
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
export type PluginCategory = 'ai' | 'dns' | 'firewall' | 'security' | 'backup' | 'auth'

export type PluginStatus = 'active' | 'available' | 'coming-soon'

export interface PluginManifest {
  id: string
  name: string
  description: string
  category: PluginCategory
  minimumTier: string
  status: PluginStatus
  targetVersion?: string
  fabrickIncluded: boolean
  /** True when a Fabrick-tier plugin in the same category supersedes this one */
  replacedByFabrick?: boolean
}

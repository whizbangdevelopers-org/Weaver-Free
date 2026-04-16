// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
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
  /** Resolved real path if configPath is a symlink (only set on read errors) */
  resolvedPath?: string
  readAt: string
  error?: string
  /** Actionable remediation hint shown to the user when available=false */
  remediation?: string
}

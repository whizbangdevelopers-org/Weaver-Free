// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
//
// Compatibility re-export — canonical module is useEngram.ts (Layer 5 rename, 2026-05-15).
// Existing imports continue to work; migrate to useEngram when touching each file.

export * from './useEngram'
export { useEngram as useCognee } from './useEngram'

// DATASET_STRATEGIES was a static fallback for the strategy map now owned by
// the useEngramMonitor composable (fetchStrategies → /weaver/api/engram/strategies).
// Kept here only to avoid breaking imports in files not yet migrated.
import type { ProcessingStrategy } from './useEngram'
export const DATASET_STRATEGIES: Record<string, ProcessingStrategy> = {
  project_knowledge: 'embed-only',
  fom_registry:      'full-cognify',
}

// STALE_MS and DEFAULT_STALE_MS are re-exported via the wildcard above.

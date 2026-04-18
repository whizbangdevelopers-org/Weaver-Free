// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Milestone modal composable shim. Real impl in ./useMilestoneModal-data (sync-excluded).
 * On Free, demo-mode is never active; the stub returns a no-op composable.
 */

import { ref } from 'vue'

type DataModule = typeof import('./useMilestoneModal-data')
const impl = import.meta.glob<DataModule>('./useMilestoneModal-data.ts', { eager: true })
const mod: Partial<DataModule> = (impl['./useMilestoneModal-data.ts'] as DataModule | undefined) ?? {}

export const useMilestoneModal: DataModule['useMilestoneModal'] =
  mod.useMilestoneModal ?? ((() => ({
    isOpen: ref(false),
    activeMilestone: ref(null),
    dismiss: () => undefined,
  })) as unknown as DataModule['useMilestoneModal'])

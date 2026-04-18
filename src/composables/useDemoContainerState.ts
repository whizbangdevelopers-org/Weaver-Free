// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Demo container state shim. Real impl in ./useDemoContainerState-data (sync-excluded).
 */

type DataModule = typeof import('./useDemoContainerState-data')
const impl = import.meta.glob<DataModule>('./useDemoContainerState-data.ts', { eager: true })
const mod: Partial<DataModule> = (impl['./useDemoContainerState-data.ts'] as DataModule | undefined) ?? {}

// Free-safe stub — matches the real API surface via typeof.
// Body uses loose casts because the stub is never invoked on Free (isDemoMode() is false there).
export const useDemoContainerState: DataModule['useDemoContainerState'] =
  mod.useDemoContainerState ?? ((() => ({
    getStatus: (_id: string, d: unknown) => d,
    isLoading: () => false,
    startContainer: async () => undefined,
    stopContainer: async () => undefined,
    addContainer: () => undefined,
  })) as unknown as DataModule['useDemoContainerState'])

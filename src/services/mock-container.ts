// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Mock container service shim. Real impl in ./mock-container-data (sync-excluded).
 */

type MockContainerData = typeof import('./mock-container-data')
const impl = import.meta.glob<MockContainerData>('./mock-container-data.ts', { eager: true })
const mod: Partial<MockContainerData> = (impl['./mock-container-data.ts'] as MockContainerData | undefined) ?? {}

const notAvailable = () => ({ success: false, message: 'demo mode not available' } as const)

export const mockListContainers: MockContainerData['mockListContainers'] = mod.mockListContainers ?? (async () => [])
export const mockGetContainer: MockContainerData['mockGetContainer'] = mod.mockGetContainer ?? (async () => null)
export const mockStartContainer: MockContainerData['mockStartContainer'] = mod.mockStartContainer ?? (async () => notAvailable())
export const mockStopContainer: MockContainerData['mockStopContainer'] = mod.mockStopContainer ?? (async () => notAvailable())
export const getMockContainerState: MockContainerData['getMockContainerState'] = mod.getMockContainerState ?? (() => [])
export const setMockContainersForTier: MockContainerData['setMockContainersForTier'] = mod.setMockContainersForTier ?? (() => undefined)

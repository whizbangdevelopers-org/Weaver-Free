// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Mock VM service shim.
 *
 * Ships to Weaver Free. Real mock implementations live in `./mock-vm-data`
 * (sync-excluded). On Free builds, the eager glob returns empty; stubs
 * return empty/rejection results — never reached at runtime because
 * `isDemoMode()` is false on Free.
 */

type MockVmData = typeof import('./mock-vm-data')
const impl = import.meta.glob<MockVmData>('./mock-vm-data.ts', { eager: true })
const mod: Partial<MockVmData> = (impl['./mock-vm-data.ts'] as MockVmData | undefined) ?? {}

const notAvailable = () => ({ success: false, message: 'demo mode not available' } as const)

export const mockListVms: MockVmData['mockListVms'] = mod.mockListVms ?? (async () => [])
export const mockGetVm: MockVmData['mockGetVm'] = mod.mockGetVm ?? (async () => null)
export const mockStartVm: MockVmData['mockStartVm'] = mod.mockStartVm ?? (async () => notAvailable())
export const mockStopVm: MockVmData['mockStopVm'] = mod.mockStopVm ?? (async () => notAvailable())
export const mockRestartVm: MockVmData['mockRestartVm'] = mod.mockRestartVm ?? (async () => notAvailable())
export const mockCreateVm: MockVmData['mockCreateVm'] = mod.mockCreateVm ?? (async () => notAvailable())
export const mockDeleteVm: MockVmData['mockDeleteVm'] = mod.mockDeleteVm ?? (async () => notAvailable())
export const mockCloneVm: MockVmData['mockCloneVm'] = mod.mockCloneVm ?? (async () => notAvailable())
export const mockExportVm: MockVmData['mockExportVm'] = mod.mockExportVm ?? (async () => ({ success: false }))
export const mockExportAllVms: MockVmData['mockExportAllVms'] = mod.mockExportAllVms ?? (async () => ({ success: false }))
export const getMockVmState: MockVmData['getMockVmState'] = mod.getMockVmState ?? (() => [])
export const clearMockVms: MockVmData['clearMockVms'] = mod.clearMockVms ?? (() => undefined)
export const addMockVm: MockVmData['addMockVm'] = mod.addMockVm ?? (() => undefined)
export const resetMockVms: MockVmData['resetMockVms'] = mod.resetMockVms ?? (() => undefined)
export const setMockVmsForTier: MockVmData['setMockVmsForTier'] = mod.setMockVmsForTier ?? (() => undefined)
export const setMockVmsForHost: MockVmData['setMockVmsForHost'] = mod.setMockVmsForHost ?? (() => undefined)

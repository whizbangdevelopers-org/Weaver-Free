// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import type { ContainerInfo, ContainerActionResult } from 'src/types/container'
import { getDemoContainersForTier } from 'src/config/demo'
import { TIERS, STATUSES } from 'src/constants/vocabularies'

// Deep clone to allow state mutations
let containerState = JSON.parse(
  JSON.stringify(getDemoContainersForTier(TIERS.FREE))
) as ContainerInfo[]

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function mockListContainers(): Promise<ContainerInfo[]> {
  await delay(150 + Math.random() * 200)
  return JSON.parse(JSON.stringify(containerState))
}

export async function mockGetContainer(id: string): Promise<ContainerInfo | null> {
  await delay(80 + Math.random() * 120)
  const c = containerState.find(c => c.id === id || c.name === id)
  return c ? JSON.parse(JSON.stringify(c)) : null
}

export async function mockStartContainer(id: string): Promise<ContainerActionResult> {
  await delay(400 + Math.random() * 600)
  const c = containerState.find(c => c.id === id || c.name === id)
  if (!c) return { success: false, message: `Container '${id}' not found` }
  if (c.status === STATUSES.RUNNING) return { success: false, message: `Container '${c.name}' is already running` } // ContainerStatus, not WorkloadStatus
  c.status = STATUSES.RUNNING
  return { success: true, message: `Container '${c.name}' started` }
}

export async function mockStopContainer(id: string): Promise<ContainerActionResult> {
  await delay(400 + Math.random() * 600)
  const c = containerState.find(c => c.id === id || c.name === id)
  if (!c) return { success: false, message: `Container '${id}' not found` }
  if (c.status === STATUSES.STOPPED || c.status === 'exited') return { success: false, message: `Container '${c.name}' is already stopped` }
  c.status = 'exited'
  return { success: true, message: `Container '${c.name}' stopped` }
}

export function getMockContainerState(): ContainerInfo[] {
  return JSON.parse(JSON.stringify(containerState))
}

/** Reset container mock state to match a specific tier (called by tier switcher). */
export function setMockContainersForTier(tier: string): void {
  containerState = JSON.parse(JSON.stringify(getDemoContainersForTier(tier)))
}

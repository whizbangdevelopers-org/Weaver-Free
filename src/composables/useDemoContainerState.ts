// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
// Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.
import { reactive } from 'vue'
import type { ContainerStatus } from 'src/types/container'
import { STATUSES } from 'src/constants/vocabularies'

// Module-level reactive state — shared across all components
const statusOverrides = reactive<Map<string, ContainerStatus>>(new Map())
const loadingIds = reactive<Set<string>>(new Set())

export function useDemoContainerState() {
  function getStatus(id: string, defaultStatus: ContainerStatus): ContainerStatus {
    return statusOverrides.get(id) ?? defaultStatus
  }

  function isLoading(id: string): boolean {
    return loadingIds.has(id)
  }

  async function startContainer(id: string): Promise<void> {
    loadingIds.add(id)
    await new Promise(r => setTimeout(r, 600))
    statusOverrides.set(id, STATUSES.RUNNING)
    loadingIds.delete(id)
  }

  async function stopContainer(id: string): Promise<void> {
    loadingIds.add(id)
    await new Promise(r => setTimeout(r, 600))
    statusOverrides.set(id, STATUSES.STOPPED)
    loadingIds.delete(id)
  }

  function addContainer(id: string, status: ContainerStatus): void {
    statusOverrides.set(id, status)
  }

  return { getStatus, isLoading, startContainer, stopContainer, addContainer }
}

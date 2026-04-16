// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { ref } from 'vue'
import { vmApiService } from 'src/services/api'
import type { WorkloadInfo, WorkloadActionResult, VmCreateInput } from 'src/types/workload'
import { extractErrorMessage } from 'src/utils/error'
import { isDemoMode, getDemoVmsForTier, getDemoVmsForHost } from 'src/config/demo'
import { useAppStore } from 'src/stores/app'
import {
  mockCreateVm, mockDeleteVm, mockStartVm, mockStopVm, mockRestartVm,
  mockGetVm, mockListVms, mockCloneVm, mockExportVm, mockExportAllVms,
  addMockVm,
} from 'src/services/mock-vm'
import { useWorkloadStore } from 'src/stores/workload-store'

const MOCK_ACTIONS = { start: mockStartVm, stop: mockStopVm, restart: mockRestartVm } as const

export function useWorkloadApi() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchVms(): Promise<WorkloadInfo[]> {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode()) return await mockListVms()
      return await vmApiService.getAll()
    } catch (err) {
      error.value = extractErrorMessage(err, 'Failed to fetch VMs')
      return []
    } finally {
      loading.value = false
    }
  }

  async function fetchVm(name: string): Promise<WorkloadInfo | null> {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode()) return await mockGetVm(name)
      return await vmApiService.getByName(name)
    } catch (err) {
      error.value = extractErrorMessage(err, 'Failed to fetch VM')
      return null
    } finally {
      loading.value = false
    }
  }

  async function vmAction(
    name: string,
    action: 'start' | 'stop' | 'restart'
  ): Promise<WorkloadActionResult> {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode()) {
        const result = await MOCK_ACTIONS[action](name)
        // Sync updated mock state back to the store so cards reflect the new status
        if (result.success) {
          const workloadStore = useWorkloadStore()
          const updated = await mockListVms()
          if (updated.length > 0) workloadStore.updateWorkloads(updated)
        }
        return result
      }
      const result = await vmApiService[action](name)
      return result
    } catch (err) {
      const message = extractErrorMessage(err, `Failed to ${action} VM`)
      error.value = message
      return { success: false, message }
    } finally {
      loading.value = false
    }
  }

  async function setAutostart(name: string, autostart: boolean): Promise<{ success: boolean; autostart: boolean }> {
    try {
      if (isDemoMode()) return { success: true, autostart }
      return await vmApiService.setAutostart(name, autostart)
    } catch (err) {
      const message = extractErrorMessage(err, 'Failed to update autostart')
      error.value = message
      return { success: false, autostart }
    }
  }

  async function setDescription(name: string, description: string): Promise<{ success: boolean; description: string }> {
    try {
      if (isDemoMode()) return { success: true, description }
      return await vmApiService.setDescription(name, description)
    } catch (err) {
      const message = extractErrorMessage(err, 'Failed to update description')
      error.value = message
      return { success: false, description }
    }
  }

  async function setTags(name: string, tags: string[]): Promise<{ success: boolean; tags: string[] }> {
    try {
      if (isDemoMode()) return { success: true, tags }
      return await vmApiService.setTags(name, tags)
    } catch (err) {
      const message = extractErrorMessage(err, 'Failed to update tags')
      error.value = message
      return { success: false, tags }
    }
  }

  async function scanVms(): Promise<{ discovered: string[]; added: string[]; existing: string[] } | null> {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode()) {
        const appStore = useAppStore()
        const workloadStore = useWorkloadStore()
        const isFabrick = appStore.isDemoVersionAtLeast('3.0') && appStore.isFabrick
        const vms = isFabrick
          ? getDemoVmsForHost(appStore.demoSelectedHostId, appStore.effectiveTier)
          : getDemoVmsForTier(appStore.effectiveTier)
        // Fake scanning delay, then reveal workloads one by one
        await new Promise(resolve => setTimeout(resolve, 1500))
        for (const vm of vms) {
          addMockVm(vm)
          workloadStore.addWorkloadFromScan(vm)
          await new Promise(resolve => setTimeout(resolve, 380))
        }
        return { discovered: vms.map(v => v.name), added: vms.map(v => v.name), existing: [] }
      }
      return await vmApiService.scan()
    } catch (err) {
      error.value = extractErrorMessage(err, 'Failed to scan for VMs')
      return null
    } finally {
      loading.value = false
    }
  }

  async function createVm(input: VmCreateInput): Promise<WorkloadActionResult> {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode()) return await mockCreateVm(input)
      return await vmApiService.create(input)
    } catch (err) {
      const message = extractErrorMessage(err, 'Failed to create VM')
      error.value = message
      return { success: false, message }
    } finally {
      loading.value = false
    }
  }

  async function deleteVm(name: string): Promise<WorkloadActionResult> {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode()) return await mockDeleteVm(name)
      return await vmApiService.remove(name)
    } catch (err) {
      const message = extractErrorMessage(err, 'Failed to delete VM')
      error.value = message
      return { success: false, message }
    } finally {
      loading.value = false
    }
  }

  async function cloneVm(sourceName: string, targetName: string, newIp: string): Promise<WorkloadActionResult> {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode()) return await mockCloneVm(sourceName, targetName, newIp)
      return { success: false, message: 'VM clone not yet implemented' }
    } catch (err) {
      const message = extractErrorMessage(err, 'Failed to clone VM')
      error.value = message
      return { success: false, message }
    } finally {
      loading.value = false
    }
  }

  async function exportVm(name: string): Promise<{ success: boolean; data?: string; message?: string }> {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode()) return await mockExportVm(name)
      const response = await fetch(`/api/workload/${encodeURIComponent(name)}/export`)
      if (!response.ok) return { success: false, message: `Export failed: ${response.statusText}` }
      return { success: true, data: await response.text() }
    } catch (err) {
      const message = extractErrorMessage(err, 'Failed to export VM')
      error.value = message
      return { success: false, message }
    } finally {
      loading.value = false
    }
  }

  async function exportAllVms(): Promise<{ success: boolean; data?: string; message?: string }> {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode()) return await mockExportAllVms()
      const response = await fetch('/api/workload/export')
      if (!response.ok) return { success: false, message: `Export failed: ${response.statusText}` }
      return { success: true, data: await response.text() }
    } catch (err) {
      const message = extractErrorMessage(err, 'Failed to export VMs')
      error.value = message
      return { success: false, message }
    } finally {
      loading.value = false
    }
  }

  async function fetchLogs(name: string): Promise<string> {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode()) return '[demo] No provisioning logs available in demo mode.'
      const result = await vmApiService.getLogs(name)
      return result.log
    } catch (err) {
      error.value = extractErrorMessage(err, 'Failed to fetch logs')
      return ''
    } finally {
      loading.value = false
    }
  }

  return { loading, error, fetchVms, fetchVm, vmAction, createVm, deleteVm, cloneVm, exportVm, exportAllVms, fetchLogs, setAutostart, setDescription, setTags, scanVms }
}

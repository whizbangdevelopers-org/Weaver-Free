// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { ref } from 'vue'
import { vmApiService } from 'src/services/api'
import type { WorkloadInfo, WorkloadActionResult, VmCreateInput, ServiceProbeSpec } from 'src/types/workload'
import { extractErrorMessage } from 'src/utils/error'
import { isDemoMode } from 'src/config/demo-mode'
import { getDemoVmsForTier, getDemoVmsForHost } from 'src/config/demo'
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

  /**
   * Configure service probes (Solo+).
   *
   * On failure the ORIGINAL list is returned, not the attempted one — a caller that rendered the
   * attempted value on a rejected write would show the user a configuration the host does not
   * have. `previous` is what the workload carried before the attempt.
   */
  async function setServiceProbes(
    name: string,
    serviceProbes: ServiceProbeSpec[],
    previous: ServiceProbeSpec[] = [],
  ): Promise<{ success: boolean; serviceProbes: ServiceProbeSpec[]; message?: string }> {
    try {
      if (isDemoMode()) return { success: true, serviceProbes }
      return await vmApiService.setServiceProbes(name, serviceProbes)
    } catch (err) {
      // The host's own sentence, RETURNED rather than only stashed in `error`. The URL rule lives
      // at the point of egress and is not duplicated in this bundle, so the caller has nothing
      // better to say than what the host said — swallowing it would leave the dialog showing
      // "something went wrong" for a message that names the offending field.
      const message = extractErrorMessage(err, 'Failed to update service probes')
      error.value = message
      return { success: false, serviceProbes: previous, message }
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

  /**
   * Clone a VM definition — NOT its disk. The backend provisions a fresh instance from the same
   * distro; disk state is deliberately not copied. Any UI calling this must say so, or "Clone" is
   * read as a full disk clone and an empty disk comes as a surprise.
   *
   * `newIp` is optional: omit it and the backend allocates from the bridge pool.
   */
  async function cloneVm(
    sourceName: string,
    targetName: string,
    newIp?: string,
    opts: { tags?: string[]; description?: string } = {},
  ): Promise<WorkloadActionResult> {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode()) return await mockCloneVm(sourceName, targetName, newIp ?? '')
      return await vmApiService.clone(sourceName, {
        name: targetName,
        // Omit rather than send undefined — the backend treats an absent ip as "allocate one".
        ...(newIp ? { ip: newIp } : {}),
        ...(opts.tags ? { tags: opts.tags } : {}),
        ...(opts.description !== undefined ? { description: opts.description } : {}),
      })
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
      // Through the shared client, not bare fetch — see vmApiService.export for why.
      return { success: true, data: JSON.stringify(await vmApiService.export(name), null, 2) }
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
      return { success: true, data: JSON.stringify(await vmApiService.export(), null, 2) }
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
      // Workload-neutral wording: this one route serves a VM's provisioning log
      // and a container's runtime log, and both panels call through here.
      if (isDemoMode()) return '[demo] No logs available in demo mode.'
      const result = await vmApiService.getLogs(name)
      return result.log
    } catch (err) {
      error.value = extractErrorMessage(err, 'Failed to fetch logs')
      return ''
    } finally {
      loading.value = false
    }
  }

  return { loading, error, fetchVms, fetchVm, vmAction, createVm, deleteVm, cloneVm, exportVm, exportAllVms, fetchLogs, setAutostart, setDescription, setTags, setServiceProbes, scanVms }
}

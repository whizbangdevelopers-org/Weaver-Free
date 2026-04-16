// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { defineStore } from 'pinia'
import type { WorkloadInfo, ProvisioningState } from 'src/types/workload'
import { useUiStore } from 'src/stores/ui-store'
import { STATUSES } from 'src/constants/vocabularies'

// status-az: failures + stopped pinned to top (A-Z within group), running last (A-Z)
const STATUS_PIN_ORDER: Record<string, number> = {
  [STATUSES.FAILED]: 0,
  [STATUSES.STOPPED]: 1,
  [STATUSES.IDLE]: 2,
  [STATUSES.UNKNOWN]: 3,
  [STATUSES.RUNNING]: 4,
}

export const useWorkloadStore = defineStore('vm', {
  state: () => ({
    workloads: [] as WorkloadInfo[],
    selectedWorkload: null as string | null,
    lastUpdate: null as string | null,
    presetTags: [] as string[],
  }),

  getters: {
    workloadByName: (state) => (name: string) => state.workloads.find((w) => w.name === name),
    runningCount: (state) => state.workloads.filter((w) => w.status === STATUSES.RUNNING).length,
    totalCount: (state) => state.workloads.length,
    workloadsByStatus: (state) => (status: WorkloadInfo['status']) =>
      state.workloads.filter((w) => w.status === status),

    sortedWorkloads(state): WorkloadInfo[] {
      const uiStore = useUiStore()
      const pref = uiStore.sortPreference

      if (pref === 'status-az') {
        return [...state.workloads].sort((a, b) => {
          const pa = STATUS_PIN_ORDER[a.status] ?? 2
          const pb = STATUS_PIN_ORDER[b.status] ?? 2
          if (pa !== pb) return pa - pb
          return a.name.localeCompare(b.name)
        })
      }
      if (pref === 'name-asc') {
        return [...state.workloads].sort((a, b) => a.name.localeCompare(b.name))
      }
      if (pref === 'name-desc') {
        return [...state.workloads].sort((a, b) => b.name.localeCompare(a.name))
      }
      return state.workloads
    },

    filteredWorkloads(): WorkloadInfo[] {
      const uiStore = useUiStore()
      const sorted = this.sortedWorkloads
      const query = uiStore.searchQuery.toLowerCase().trim()
      const statusFilter = uiStore.filterStatus
      const tagFilter = uiStore.filterTags

      return sorted.filter((w) => {
        // Search filter: name substring match
        if (query && !w.name.toLowerCase().includes(query)) return false
        // Status filter: workload must match at least one selected status
        if (statusFilter.length > 0 && !statusFilter.includes(w.status)) return false
        // Tag filter: workload must have ALL selected tags (AND logic)
        if (tagFilter.length > 0) {
          const wTags = w.tags ?? []
          if (!tagFilter.every(t => wTags.includes(t))) return false
        }
        return true
      })
    },

    allTags(state): string[] {
      const tagSet = new Set<string>()
      for (const w of state.workloads) {
        if (w.tags) {
          for (const tag of w.tags) tagSet.add(tag)
        }
      }
      for (const tag of state.presetTags) tagSet.add(tag)
      return [...tagSet].sort()
    },

    hasActiveFilters(): boolean {
      const uiStore = useUiStore()
      return uiStore.searchQuery !== '' || uiStore.filterTags.length > 0 || uiStore.filterStatus.length > 0
    },
  },

  actions: {
    updateWorkloads(workloads: WorkloadInfo[]) {
      this.workloads = workloads
      this.lastUpdate = new Date().toISOString()
    },
    selectWorkload(name: string | null) {
      this.selectedWorkload = name
    },
    setPresetTags(tags: string[]) {
      this.presetTags = tags
    },
    updateWorkloadProvisioning(name: string, state: ProvisioningState, error?: string) {
      const w = this.workloads.find(v => v.name === name)
      if (w) {
        w.provisioningState = state
        w.provisioningError = error
      }
    },
    /** Optimistically remove a workload from the local store (e.g. after successful DELETE) */
    removeWorkload(name: string) {
      this.workloads = this.workloads.filter(v => v.name !== name)
    },
    /** Demo replay: clear all workloads so the empty state is shown */
    clearWorkloadsForDemo() {
      this.workloads = []
      this.lastUpdate = null
    },
    /** Demo replay: add a single workload during progressive scan reveal */
    addWorkloadFromScan(workload: WorkloadInfo) {
      if (!this.workloads.some(v => v.name === workload.name)) {
        this.workloads.push(workload)
      }
    },
  },
})

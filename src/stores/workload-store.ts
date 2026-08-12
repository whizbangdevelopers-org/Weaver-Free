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
    // Names removed via removeWorkload() but not yet confirmed absent by the
    // backend WebSocket. Guards against stale vm-status broadcasts re-adding
    // a just-deleted VM before the next clean broadcast arrives.
    _pendingDeletes: [] as string[],
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
      const hypervisorFilter = uiStore.filterHypervisors

      return sorted.filter((w) => {
        // Search filter: name substring match
        if (query && !w.name.toLowerCase().includes(query)) return false
        // Status filter: workload must match at least one selected status
        if (statusFilter.length > 0 && !statusFilter.includes(w.status)) return false
        // Hypervisor filter: OR logic — selecting qemu AND crosvm means "either", because a
        // workload has exactly one hypervisor and AND logic would always yield zero. Tags below
        // use AND for the opposite reason: a workload can carry several.
        if (hypervisorFilter.length > 0 && !hypervisorFilter.includes(w.hypervisor)) return false
        // Tag filter: workload must have ALL selected tags (AND logic)
        if (tagFilter.length > 0) {
          const wTags = w.tags ?? []
          if (!tagFilter.every(t => wTags.includes(t))) return false
        }
        return true
      })
    },

    /**
     * Hypervisors actually present, for the filter menu.
     *
     * Derived from the workloads rather than listed from the schema enum, the same way `allTags`
     * is. A host running only QEMU should not be offered a Firecracker option that can only ever
     * filter to nothing — an option that always yields zero results reads as a broken filter.
     */
    allHypervisors(state): string[] {
      const set = new Set<string>()
      for (const w of state.workloads) {
        if (w.hypervisor) set.add(w.hypervisor)
      }
      return [...set].sort()
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
      return uiStore.searchQuery !== ''
        || uiStore.filterTags.length > 0
        || uiStore.filterStatus.length > 0
        || uiStore.filterHypervisors.length > 0
    },
  },

  actions: {
    updateWorkloads(workloads: WorkloadInfo[]) {
      // Filter out names that were optimistically removed but haven't been
      // confirmed absent by the backend yet — prevents stale WS broadcasts
      // from re-adding a just-deleted VM (race: WS broadcast pre-computed
      // before DELETE landed on the backend).
      const filtered = this._pendingDeletes.length > 0
        ? workloads.filter(w => !this._pendingDeletes.includes(w.name))
        : workloads
      this.workloads = filtered
      this.lastUpdate = new Date().toISOString()
      // Clear names the backend now confirms are gone
      if (this._pendingDeletes.length > 0) {
        this._pendingDeletes = this._pendingDeletes.filter(
          name => workloads.some(w => w.name === name)
        )
      }
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
      if (!this._pendingDeletes.includes(name)) {
        this._pendingDeletes.push(name)
      }
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

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { defineStore } from 'pinia'

export type WeaverActiveFilter = 'all' | 'vms' | 'docker' | 'podman' | 'apptainer'

export const useUiStore = defineStore('ui', {
  state: () => ({
    sidebarOpen: true,
    autoRefresh: true,
    refreshInterval: 2000,
    dashboardView: 'grid' as 'grid' | 'list',
    sortPreference: 'status-az' as 'status-az' | 'name-asc' | 'name-desc',
    searchQuery: '',
    filterTags: [] as string[],
    filterStatus: [] as string[],
    // Hypervisor filter — VMs only. Distinct from `weaverActiveFilter`, which selects a RUNTIME
    // (vms / docker / podman / apptainer); this narrows within VMs by the hypervisor that runs
    // them (qemu, cloud-hypervisor, crosvm, kvmtool, firecracker).
    filterHypervisors: [] as string[],
    weaverActiveFilter: 'all' as WeaverActiveFilter,

    /**
     * Keyboard focus within the workload list.
     *
     * The INDEX lives here and the ORDER lives in the page, published via `setFocusableWorkloads`.
     * That split is deliberate: the page owns sorting, filtering and the VM/container interleave,
     * so any second implementation of "which workload is Nth" would be a copy that drifts. The
     * store only has to answer "which one is focused", which is what every consumer actually asks.
     *
     * -1 means nothing is focused, which is the correct initial state — a list that boots with
     * item 0 focused steals the meaning of Enter before the user has expressed any intent.
     * Not persisted: focus is ephemeral and restoring it across a reload would point at a
     * workload that may no longer exist.
     */
    focusedWorkloadIndex: -1,
    focusableWorkloads: [] as string[],
    shortcutOverlayOpen: false,
  }),

  getters: {
    /** The focused workload's name, or null. Clamped, so a stale index cannot resolve. */
    focusedWorkloadName(state): string | null {
      if (state.focusedWorkloadIndex < 0) return null
      return state.focusableWorkloads[state.focusedWorkloadIndex] ?? null
    },
  },

  actions: {
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },
    toggleAutoRefresh() {
      this.autoRefresh = !this.autoRefresh
    },
    setRefreshInterval(ms: number) {
      this.refreshInterval = ms
    },
    setDashboardView(view: 'grid' | 'list') {
      this.dashboardView = view
    },
    setSortPreference(pref: 'status-az' | 'name-asc' | 'name-desc') {
      this.sortPreference = pref
    },
    setSearchQuery(query: string) {
      this.searchQuery = query
    },
    setFilterTags(tags: string[]) {
      this.filterTags = tags
    },
    setFilterStatus(statuses: string[]) {
      this.filterStatus = statuses
    },
    setFilterHypervisors(hypervisors: string[]) {
      this.filterHypervisors = hypervisors
    },
    setWeaverActiveFilter(filter: WeaverActiveFilter) {
      this.weaverActiveFilter = filter
    },
    clearFilters() {
      this.searchQuery = ''
      this.filterTags = []
      this.filterStatus = []
      this.filterHypervisors = []
    },

    /**
     * Publish the current list order, preserving focus BY NAME rather than by position.
     *
     * The page calls this whenever its display list changes — a filter, a search keystroke, a
     * WebSocket status update that reorders by status. Holding the index across that would silently
     * move focus to a different workload, and the next `Shift+X` would stop the wrong machine.
     * Re-resolving the name is what makes the shortcut safe to hold down.
     */
    setFocusableWorkloads(names: string[]) {
      const previous = this.focusedWorkloadName
      this.focusableWorkloads = names
      if (previous === null) return
      const moved = names.indexOf(previous)
      // Dropped out of the list entirely (filtered away, deleted) → focus nothing rather than
      // whatever slid into its slot.
      this.focusedWorkloadIndex = moved
    },

    focusNextWorkload() {
      if (this.focusableWorkloads.length === 0) return
      // From "nothing focused", j selects the first item rather than the second.
      this.focusedWorkloadIndex = this.focusedWorkloadIndex < 0
        ? 0
        : Math.min(this.focusedWorkloadIndex + 1, this.focusableWorkloads.length - 1)
    },

    focusPrevWorkload() {
      if (this.focusableWorkloads.length === 0) return
      // From "nothing focused", k selects the LAST item — the mirror of j, and what a user
      // reaching upward from a fresh list expects.
      this.focusedWorkloadIndex = this.focusedWorkloadIndex < 0
        ? this.focusableWorkloads.length - 1
        : Math.max(this.focusedWorkloadIndex - 1, 0)
    },

    clearWorkloadFocus() {
      this.focusedWorkloadIndex = -1
    },

    setShortcutOverlay(open: boolean) {
      this.shortcutOverlayOpen = open
    },
  },

  persist: {
    // sortPreference intentionally excluded — Attention needed is always the right default on load
    pick: ['sidebarOpen', 'autoRefresh', 'refreshInterval', 'dashboardView', 'searchQuery', 'filterTags', 'filterStatus', 'filterHypervisors'],
  },
})

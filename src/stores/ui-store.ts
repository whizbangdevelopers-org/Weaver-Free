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
    weaverActiveFilter: 'all' as WeaverActiveFilter,
  }),

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
    setWeaverActiveFilter(filter: WeaverActiveFilter) {
      this.weaverActiveFilter = filter
    },
    clearFilters() {
      this.searchQuery = ''
      this.filterTags = []
      this.filterStatus = []
    },
  },

  persist: {
    // sortPreference intentionally excluded — Attention needed is always the right default on load
    paths: ['sidebarOpen', 'autoRefresh', 'refreshInterval', 'dashboardView', 'searchQuery', 'filterTags', 'filterStatus'],
  },
})

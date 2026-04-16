// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { defineStore } from 'pinia'
import { Dark } from 'quasar'
import { api } from 'src/boot/axios'
import { isDemoMode } from 'src/config/demo'
import type { LlmVendor } from 'src/types/agent'

export type DarkModePreference = 'auto' | 'light' | 'dark'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    llmVendor: 'anthropic' as LlmVendor,
    llmApiKey: '' as string,
    useServerKey: true as boolean,
    showHelpTooltips: true as boolean,
    hasSeenWizard: false as boolean,
    darkMode: 'auto' as DarkModePreference,
    sidebarVmSectionOpen: true as boolean,
    sidebarContainerSectionOpen: true as boolean,
    topologyVmsSide: 'left' as 'left' | 'right',
  }),

  getters: {
    hasUserKey: (state) => state.llmApiKey.length > 0,
    effectiveApiKey: (state): string | undefined =>
      state.useServerKey ? undefined : state.llmApiKey || undefined,
    effectiveVendor: (state): LlmVendor | undefined =>
      state.useServerKey ? undefined : state.llmVendor,
  },

  actions: {
    setApiKey(key: string) {
      this.llmApiKey = key
      if (key) this.useServerKey = false
    },
    clearApiKey() {
      this.llmApiKey = ''
      this.useServerKey = true
    },
    setVendor(vendor: LlmVendor) {
      this.llmVendor = vendor
    },
    toggleServerKey(use: boolean) {
      this.useServerKey = use
    },
    toggleHelpTooltips(show: boolean) {
      this.showHelpTooltips = show
    },
    dismissWizard() {
      this.hasSeenWizard = true
      // Persist to server so preference survives browser/device changes
      if (!isDemoMode()) {
        api.patch('/auth/me/preferences', { hasSeenWizard: true }).catch(() => { /* best-effort */ })
      }
    },
    resetWizard() {
      this.hasSeenWizard = false
    },
    /** Apply server-side preferences without triggering a PATCH back. */
    syncWizardFromServer(hasSeenWizard: boolean) {
      this.hasSeenWizard = hasSeenWizard
    },
    setDarkMode(mode: DarkModePreference) {
      this.darkMode = mode
      Dark.set(mode === 'auto' ? 'auto' : mode === 'dark')
    },
    cycleDarkMode() {
      const cycle: DarkModePreference[] = ['auto', 'light', 'dark']
      const idx = cycle.indexOf(this.darkMode)
      this.setDarkMode(cycle[(idx + 1) % cycle.length])
    },
  },

  persist: true,
})

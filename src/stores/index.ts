// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

export default function () {
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  return pinia
}

// Export all stores from this file for convenient imports
export { useAppStore } from './app'
export { useWorkloadStore } from './workload-store'
export { useUiStore } from './ui-store'
export { useAuthStore } from './auth-store'
export { useAgentStore } from './agent-store'
export { useSettingsStore } from './settings-store'
export { useNotificationStore } from './notification-store'
export { useNetworkStore } from './network-store'

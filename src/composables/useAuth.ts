// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth-store'

let refreshTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Auth composable — provides reactive auth state and auto-refresh timer.
 * Axios interceptors are handled in boot/axios.ts (runs earlier in lifecycle).
 */
export function useAuth() {
  const authStore = useAuthStore()
  const router = useRouter()

  const isAuthenticated = computed(() => authStore.isAuthenticated)
  const user = computed(() => authStore.user)
  const isAdmin = computed(() => authStore.isAdmin)

  /**
   * Schedule token refresh before expiry.
   * JWT access token is 30m — refresh at 25m (5 min before expiry).
   */
  function scheduleRefresh() {
    clearRefreshTimer()
    if (!authStore.token) return

    // Refresh 5 minutes before the 30-minute access token expires
    const refreshDelay = 25 * 60 * 1000
    refreshTimer = setTimeout(async () => {
      await authStore.refresh()
      scheduleRefresh()
    }, refreshDelay)
  }

  function clearRefreshTimer() {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
  }

  async function logout() {
    clearRefreshTimer()
    await authStore.logout()
    await router.push('/login')
  }

  onMounted(() => {
    if (authStore.isAuthenticated) {
      scheduleRefresh()
    }
  })

  // Watch for auth state changes to manage refresh timer
  watch(() => authStore.token, (newToken) => {
    if (newToken) {
      scheduleRefresh()
    } else {
      clearRefreshTimer()
    }
  })

  onUnmounted(() => {
    clearRefreshTimer()
  })

  return {
    isAuthenticated,
    user,
    isAdmin,
    logout,
  }
}

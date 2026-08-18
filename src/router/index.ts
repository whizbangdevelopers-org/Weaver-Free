// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { defineRouter } from '#q-app'
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory
} from 'vue-router'
import routes from './routes'
import { useAuthStore } from 'src/stores/auth-store'
import { useAppStore } from 'src/stores/app'
import { isDemoMode, isPublicDemo } from 'src/config/demo-mode'

export default defineRouter(function (/* { store, ssrContext } */) {
  // `import.meta.env.QUASAR_*`, not `process.env.*`. app-vite 2 exposed these as `process.env`;
  // v3 renamed them AND moved them onto import.meta.env (see its quasar-config-file.js →
  // `import.meta.env.QUASAR_VUE_ROUTER_MODE` / `_BASE` / `QUASAR_SERVER`).
  //
  // The v2 form did not fail loudly, which is why it survived the upgrade. In the BUILD, Vite
  // statically replaces `process.env.X` with undefined, so the ternaries fell through to
  // `createWebHashHistory(undefined)` — which happens to equal the configured `vueRouterMode:
  // 'hash'` and `publicPath: '/'`. Production was therefore correct by coincidence, not by
  // instruction. In the DEV server nothing defines `process` at all, so this module threw
  // `ReferenceError: process is not defined` at import time, the app never mounted, and every
  // UI E2E spec timed out against a blank page while the API specs passed.
  const createHistory = import.meta.env.QUASAR_SERVER
    ? createMemoryHistory
    : import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE)
  })

  Router.beforeEach(async (to) => {
    // Demo mode bypasses auth — all data is mock
    if (isDemoMode()) {
      const authStore = useAuthStore()

      // Public demo: show captcha login page before granting access
      if (isPublicDemo() && !authStore.isAuthenticated) {
        return to.path === '/login' ? true : { path: '/login' }
      }

      if (!authStore.isAuthenticated) authStore.loginAsDemo()
      const appStore = useAppStore()
      await appStore.initialize()
      // Fabrick requires Fabrick tier + v3.0 even in demo
      if (to.path === '/fabrick' && !(appStore.isFabrick && appStore.isDemoVersionAtLeast('3.0'))) {
        return { path: '/network' }
      }
      return true
    }

    const authStore = useAuthStore()

    // Public routes don't require auth
    if (to.meta.public) return true

    // Check if route or any parent route requires auth
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
    if (!requiresAuth) return true

    // Not authenticated — redirect to login
    if (!authStore.isAuthenticated) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }

    // Verify session with server on first navigation after app load.
    // The store may claim isAuthenticated from persisted state, but the
    // httpOnly cookie could be stale (e.g. after reinstall with new JWT secret).
    // fetchMe() hits /api/auth/me which fails with 401 if the cookie is invalid —
    // the axios interceptor will clear auth and we redirect to login.
    if (!authStore.sessionVerified) {
      try {
        await authStore.fetchMe()
        authStore.sessionVerified = true
      } catch {
        authStore.clearAuth()
        return { path: '/login', query: { redirect: to.fullPath } }
      }
    }

    // Ensure app state (tier, provisioning, etc.) is loaded before first page render
    const appStore = useAppStore()
    await appStore.initialize()

    // Admin-only routes
    if (to.matched.some(r => r.meta.requiresAdmin) && !authStore.isAdmin) {
      return { path: '/weaver' }
    }

    // Fabrick-only routes
    if (to.matched.some(r => r.meta.requiresFabrick) && !appStore.isFabrick) {
      return { path: '/weaver' }
    }

    return true
  })

  return Router
})

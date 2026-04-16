// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { boot } from 'quasar/wrappers'
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import type { AxiosError } from 'axios'
import type { Router } from 'vue-router'
import { isDemoMode } from 'src/config/demo'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $axios: AxiosInstance
    $api: AxiosInstance
  }
}

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,  // Send httpOnly cookies automatically (XSS-safe token transport)
})

// Router reference set during boot
let _router: Router | null = null

/**
 * Read auth user state from localStorage (written by pinia-plugin-persistedstate).
 * Tokens are now transported via httpOnly cookies — only user metadata is stored locally.
 */
function getStoredAuth(): { isAuthenticated: boolean } {
  try {
    const raw = localStorage.getItem('auth')
    if (raw) {
      const parsed = JSON.parse(raw) as { user?: unknown }
      return { isAuthenticated: !!parsed.user }
    }
  } catch {
    // ignore parse errors
  }
  return { isAuthenticated: false }
}

/**
 * Clear auth data from localStorage.
 */
function clearStoredAuth(): void {
  try {
    const raw = localStorage.getItem('auth')
    if (raw) {
      const parsed = JSON.parse(raw)
      parsed.token = null
      parsed.refreshToken = null
      parsed.user = null
      localStorage.setItem('auth', JSON.stringify(parsed))
    }
  } catch {
    // ignore
  }
}

export default boot(({ app, router }) => {
  // Make axios available as $axios and $api in Vue components
  app.config.globalProperties.$axios = axios
  app.config.globalProperties.$api = api

  _router = router

  // No request interceptor needed — httpOnly cookies are sent automatically
  // via withCredentials: true. The server reads tokens from cookies (browser)
  // or Authorization header (TUI/API clients).

  // Response interceptor: handle 401 and auto-refresh via httpOnly cookie
  api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

      // Demo mode has no backend — never clear auth or redirect on 401.
      // Stray API calls that leak past isDemoMode() guards should fail silently,
      // not nuke the demo session. This is the permanent fix for the recurring
      // "help/docs redirect to login in demo" bug.
      if (isDemoMode()) {
        return Promise.reject(error)
      }

      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url?.includes('/auth/')
      ) {
        originalRequest._retry = true

        // The refresh cookie is sent automatically by the browser
        if (getStoredAuth().isAuthenticated) {
          try {
            // POST to refresh — the httpOnly weaver_refresh cookie is sent automatically
            await axios.post('/api/auth/refresh', {}, { withCredentials: true })

            // Retry original request — new weaver_token cookie is set by the server
            return api(originalRequest)
          } catch {
            // Refresh failed — fall through to redirect
          }
        }

        // Clear auth and redirect to login
        clearStoredAuth()
        if (_router) {
          await _router.push('/login')
        }
      }

      return Promise.reject(error)
    }
  )
})

export { api }

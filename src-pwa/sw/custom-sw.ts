// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Custom Service Worker
 * Uses Workbox for caching strategies in production only.
 *
 * In dev mode the SW is a passthrough — all caching strategies (precache,
 * static, API, image) are production optimizations that actively break dev
 * when Vite's .q-cache is regenerated (fresh-install, dep updates).
 */

/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

// `import.meta.env.QUASAR_PROD` is app-vite 3's idiom; `process.env.NODE_ENV` was app-vite 2's.
//
// Unlike the router and register-sw.ts, this file was NOT broken by the v3 upgrade, and the
// difference is worth recording so nobody "fixes" it back. This module is bundled by rolldown as a
// separate entry (sourceFiles.pwaServiceWorker), and that bundle defines `process.env.NODE_ENV` —
// so the condition resolved correctly. Measured both ways on 2026-08-18: the emitted dist/pwa/sw.js
// is byte-identical (40323 bytes) and carries the api-cache / image-cache / static-cache strings
// and the injected precache manifest under either form.
//
// The router is the opposite case: Vite serves src/ to the DEV SERVER without bundling, nothing
// defines `process` there, and the module throws at import time.
//
// Two measurements of this file said "the block was eliminated" before one of them was correct.
// The first counted minified identifiers (`precacheAndRoute` does not survive minification); the
// second had a quoting bug and searched for `api-cache'` with a trailing quote. Both reported zero.
// String literals in the emitted bundle are the probe that actually works.
if (import.meta.env.QUASAR_PROD) {
  // Use with precache injection
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  precacheAndRoute(self.__WB_MANIFEST)

  // Clean up old caches
  cleanupOutdatedCaches()

  // Cache API requests with NetworkFirst strategy
  // Exclude /api/workload — VM status changes every 2 seconds via WebSocket,
  // serving stale cached data after reconnection causes confusing UI state
  registerRoute(
    ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/workload'),
    new NetworkFirst({
      cacheName: 'api-cache',
      networkTimeoutSeconds: 10,
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200]
        }),
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 // 24 hours
        })
      ]
    })
  )

  // Cache images with CacheFirst strategy
  registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'image-cache',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200]
        }),
        new ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
        })
      ]
    })
  )

  // Cache static assets with StaleWhileRevalidate
  registerRoute(
    ({ request }) =>
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'font',
    new StaleWhileRevalidate({
      cacheName: 'static-cache',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200]
        }),
        new ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
        })
      ]
    })
  )
}

// Always handle install/activate for clean lifecycle
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

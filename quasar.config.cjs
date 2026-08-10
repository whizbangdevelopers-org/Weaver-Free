// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/* global process, __dirname */

// Configuration for Quasar app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

const { readFileSync } = require('fs')
const { join } = require('path')

// Read package.json version
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'))

// ── Browser targets, derived from Baseline "Widely available" ───────────────────────────────
//
// Baseline "Widely available" = supported across Chrome/Edge/Firefox/Safari for 30 months. It is
// a ROLLING window, which is the point: the floor moves on its own instead of being a number
// somebody typed once and nobody revisited. The previous hand-written list was five years stale
// and was only noticed when it broke the build.
//
// PINNED, deliberately. An unpinned rolling window would make two builds of the same commit
// produce different output as the wall clock advances — non-determinism the release pipeline
// would surface as phantom drift. Moving the floor is a reviewed one-line change to this date.
//
// As of the pin below this resolves to: chrome121, edge121, firefox122, safari17.2, ios17.2
// (Dec 2023 – Jan 2024). Those values are safe to state here because the pin fixes them; they
// change only when the date does.
const BASELINE_WIDELY_AVAILABLE_ON = '2026-08-01'

// esbuild target names differ from Baseline's browser ids. Map only what esbuild understands;
// chrome_android / firefox_android have no distinct esbuild target and are covered by their
// desktop engines, so dropping them narrows nothing.
const ESBUILD_TARGET_NAME = {
  chrome: 'chrome',
  edge: 'edge',
  firefox: 'firefox',
  safari: 'safari',
  safari_ios: 'ios',
}

// A bad pin date needs no guard here — the library itself throws ("no browser versions
// compatible with Baseline in the future", "none of the core set were released before 2002").
// Verified both, rather than assumed; a `length === 0` check on this call would be unreachable
// dead code, which is worse than no check because it implies a failure mode that cannot occur.
const BASELINE_VERSIONS = require('baseline-browser-mapping').getCompatibleVersions({
  widelyAvailableOnDate: BASELINE_WIDELY_AVAILABLE_ON,
  includeDownstreamBrowsers: false,
})

const BASELINE_TARGETS = BASELINE_VERSIONS
  .filter((b) => ESBUILD_TARGET_NAME[b.browser])
  .map((b) => `${ESBUILD_TARGET_NAME[b.browser]}${b.version}`)
  .sort()

// THIS guard is reachable, and it is the one that matters. If upstream renames a browser id —
// `safari_ios` becoming something else, say — the filter above quietly drops it, and enough
// renames drop everything. An empty target list does not fail: esbuild reads it as "no
// constraints" and emits whatever syntax it likes, so the floor disappears with no error and
// no diff. Refuse instead of absorbing a condition that changes the answer.
if (BASELINE_TARGETS.length === 0) {
  throw new Error(
    `quasar.config.cjs: Baseline returned ${BASELINE_VERSIONS.length} browser(s) but ESBUILD_TARGET_NAME ` +
      `matched none of them (saw: ${[...new Set(BASELINE_VERSIONS.map((b) => b.browser))].join(', ')}). ` +
      'Upstream browser ids have changed. Refusing to build with an unconstrained target.',
  )
}

module.exports = function (/* ctx */) {
  return {
    // TypeScript is auto-detected in @quasar/app-vite v2

    boot: ['axios', 'v-network-graph', 'dark-mode'],

    css: ['app.scss'],

    extras: ['roboto-font', 'mdi-v7'],

    build: {
      target: {
        // DERIVED from Baseline "Widely available", never hand-written.
        //
        // The previous list was `['es2022','chrome90','firefox88','safari14']` — April–September
        // 2021, five years stale, and it rotted precisely because nothing owned it: the string
        // `safari14` appeared in exactly ONE line of this repository, with no COMPATIBILITY.md
        // entry and no auditor. It surfaced only when it stopped the build outright (esbuild
        // cannot downlevel destructuring for Safari 14, so workbox produced 77 hard errors).
        // Replacing it with a newer hand-picked number would have reset the same clock.
        //
        // `BASELINE_TARGETS` resolves the 30-month Baseline window at the PINNED date below.
        // Bumping the floor is a one-line, reviewable change to that date — not an archaeology
        // exercise. The pin is what keeps builds reproducible: an unpinned rolling window would
        // silently change output between two builds of the same commit.
        browser: BASELINE_TARGETS,
        node: 'node20'
      },

      vueRouterMode: 'hash',

      publicPath: '/',

      extendViteConf(viteConf) {
        viteConf.define = viteConf.define || {}
        viteConf.define.__APP_VERSION__ = JSON.stringify(packageJson.version)

        // Split heavy vendor chunks for better long-term caching
        viteConf.build = viteConf.build || {}
        viteConf.build.chunkSizeWarningLimit = 500
        viteConf.build.rollupOptions = {
          output: {
            manualChunks(id) {
              if (id.includes('@xterm/xterm') || id.includes('@xterm/addon-fit') || id.includes('@xterm/addon-web-links')) {
                return 'xterm'
              }
              if (id.includes('v-network-graph')) {
                return 'network-graph'
              }
            }
          }
        }
      }
    },

    devServer: {
      port: Number(process.env.QUASAR_DEV_PORT) || 9010,
      open: false,
      allowedHosts: 'all',
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.QUASAR_API_PORT || 3110}`,
          changeOrigin: true
        },
        '/ws': {
          target: `ws://localhost:${process.env.QUASAR_API_PORT || 3110}`,
          ws: true
        }
      }
    },

    framework: {
      config: {},
      iconSet: 'mdi-v7',

      plugins: ['Notify', 'Dialog', 'Dark', 'Meta']
    },

    animations: ['slideInUp', 'slideOutDown'],

    pwa: {
      workboxMode: 'InjectManifest', // Use custom service worker
      injectPwaMetaTags: true,
      swFilename: 'sw.js',
      manifestFilename: 'manifest.json',
      useCredentialsForManifestTag: false,

      manifest: {
        name: 'Weaver',
        short_name: 'Weaver',
        description: 'NixOS MicroVM Management Dashboard',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#027be3',
        icons: [
          { src: 'icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-256x256.png', sizes: '256x256', type: 'image/png' },
          { src: 'icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      },

      // Workbox options for InjectManifest mode
      injectManifestOptions: {
        // injectionPoint is automatically set
      },

      // Development mode workbox options
      workboxOptions: {
        skipWaiting: true,
        clientsClaim: true
      }
    }
  }
}

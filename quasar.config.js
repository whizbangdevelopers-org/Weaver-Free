// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/* global process */

// Configuration for Quasar app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getCompatibleVersions } from 'baseline-browser-mapping'

import { deriveViteAliases } from './quasar.aliases.js'

// ESM has no __dirname; app-vite 3 only loads quasar.config.js (ESM) or .ts — the .cjs form
// it replaced is not recognised at all, which presents as "not a Quasar project folder".
const __dirname = dirname(fileURLToPath(import.meta.url))

// Read package.json version
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'))

// ── Vite aliases, DERIVED from tsconfig paths ───────────────────────────────────────────────
//
// @quasar/app-vite 2 shipped `src`, `app`, `components`, `layouts`, `pages`, `assets`, `boot`
// and `stores` as built-in aliases. **v3 ships only `@` and `#q-app`** (see its
// `quasar-config-file.js` → `defaultAliases`). This codebase imports through `src/...` 498
// times, so after the v3 upgrade the dev server could not resolve a single store or component
// and the app failed to mount — every one of the 373 E2E specs timed out at ~16s.
//
// It was invisible everywhere else, and the reason is the whole point of deriving this:
// tsconfig.json carries its OWN copy of the same map, so `vue-tsc` stayed green, and the
// production build resolved fine too. Only the dev server — which nothing ran — disagreed.
// Two hand-maintained copies of one map, and the upgrade updated neither.
//
// So this is not a second copy: tsconfig.json is the single source and Vite's aliases are
// generated from it. The derivation itself moved to scripts/lib/tsconfig-aliases.js on
// 2026-08-18 so the three sibling repos — which took the identical app-vite 3 upgrade and
// carried the identical break — share ONE implementation rather than four hand-copied ones.
// It reads JSONC, because a tsconfig may legitimately carry comments (Gantry's does, and a
// plain JSON.parse is what broke the first attempted port of this fix).
//
// audit:vite-aliases is the guard: it loads THIS file, invokes it, and checks the alias map it
// actually hands Quasar — the consumer-side question, which a check on the derivation alone
// cannot answer.
const BUILD_ALIAS = deriveViteAliases(__dirname)

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
const BASELINE_VERSIONS = getCompatibleVersions({
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

// Plain default export rather than `defineConfig` from '#q-app/wrappers': that specifier is
// resolvable only AFTER `quasar prepare` has run, and prepare must compile this file first.
// The wrapper is a types-only convenience, so the config works identically without it.
export default function (/* ctx */) {
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

      // Generated above from tsconfig paths — app-vite 3 dropped the built-in `src`/`stores`/…
      // aliases and provides only `@` and `#q-app`.
      alias: BUILD_ALIAS,

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

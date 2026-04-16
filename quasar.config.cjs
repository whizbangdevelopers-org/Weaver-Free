// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/* global process, __dirname */

// Configuration for Quasar app
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-js

const { readFileSync } = require('fs')
const { join } = require('path')

// Read package.json version
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'))

module.exports = function (/* ctx */) {
  return {
    // TypeScript is auto-detected in @quasar/app-vite v2

    boot: ['axios', 'v-network-graph', 'dark-mode'],

    css: ['app.scss'],

    extras: ['roboto-font', 'mdi-v7'],

    build: {
      target: {
        browser: ['es2022', 'chrome90', 'firefox88', 'safari14'],
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

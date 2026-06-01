// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/* eslint-env node */
const { configure } = require('quasar/wrappers')

module.exports = configure(function (/* ctx */) {
  return {
    eslint: {
      fix: false,
      include: [],
      exclude: [],
      rawOptions: {},
      warnings: true,
      errors: true,
    },

    boot: ['v-network-graph'],

    css: ['app.scss'],

    extras: ['mdi-v7', 'roboto-font', 'material-icons'],

    build: {
      target: {
        browser: ['es2019', 'edge88', 'firefox78', 'chrome87', 'safari13.1'],
        node: 'node20',
      },
      vueRouterMode: 'history',
      typescript: {
        strict: true,
        vueShim: true,
      },
      extendViteConf(viteConf) {
        viteConf.optimizeDeps = viteConf.optimizeDeps ?? {}
        viteConf.optimizeDeps.include = [
          ...(viteConf.optimizeDeps.include ?? []),
          'd3-force',
          'd3-dispatch',
          'd3-quadtree',
          'd3-timer',
        ]
      },
    },

    devServer: {
      open: false,
      port: Number(process.env.QUASAR_ENGRAM_PORT) || 8768,
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.QUASAR_COGNEE_PORT || 8765}`,
          changeOrigin: true,
        },
        '/health': {
          target: `http://localhost:${process.env.QUASAR_COGNEE_PORT || 8765}`,
          changeOrigin: true,
        },
        '/weaver': {
          target: `http://localhost:${process.env.QUASAR_WEAVER_PORT || 3110}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/weaver/, ''),
        },
        '/engram-query': {
          target: `http://localhost:${process.env.QUASAR_ENGRAM_QUERY_PORT || 8770}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/engram-query/, ''),
        },
      },
    },

    framework: {
      config: {
        dark: 'auto',
        notify: {},
      },
      plugins: ['Notify', 'Dialog'],
    },

    animations: [],

    ssr: { pwa: false },
    pwa: {},
    cordova: {},
    capacitor: { hideSplashscreen: true },
    electron: { inspector: false, bundler: 'packager' },
    bex: { contentScripts: ['my-content-script'] },
  }
})

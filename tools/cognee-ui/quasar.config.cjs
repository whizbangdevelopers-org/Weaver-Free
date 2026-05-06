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
    },

    devServer: {
      open: false,
      port: 8766,
      proxy: {
        '/api': {
          target: 'http://localhost:8765',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://localhost:8765',
          changeOrigin: true,
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

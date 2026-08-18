// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * PWA Service Worker Registration
 * This file is imported by Quasar when in PWA mode
 */

import { register } from 'register-service-worker'
import { Notify } from 'quasar'

// Register service worker in production
// `import.meta.env.QUASAR_SERVICE_WORKER_FILE`, not `import.meta.env.QUASAR_SERVICE_WORKER_FILE`. The
// latter is the app-vite 2 form: undefined in a v3 build (so the service worker registers against
// an empty path) and fatal in the v3 dev server, where `process` does not exist at all. Verified
// against the installed package — quasar-config-file.js defines this key and templates/pwa/ts
// registers with it.
register(import.meta.env.QUASAR_SERVICE_WORKER_FILE, {
  ready(/* registration */) {
    console.log('Service worker is active.')
  },

  registered(/* registration */) {
    console.log('Service worker has been registered.')
  },

  cached(/* registration */) {
    console.log('Content has been cached for offline use.')
    Notify.create({
      message: 'App ready for offline use',
      icon: 'mdi-cloud-check',
      color: 'positive',
    })
  },

  updatefound(/* registration */) {
    console.log('New content is downloading.')
  },

  updated(/* registration */) {
    console.log('New content is available; please refresh.')
    Notify.create({
      message: 'New version available!',
      icon: 'mdi-refresh',
      color: 'primary',
      timeout: 0,
      actions: [
        {
          label: 'Refresh',
          color: 'white',
          handler: () => {
            window.location.reload()
          },
        },
        {
          label: 'Dismiss',
          color: 'white',
        },
      ],
    })
  },

  offline() {
    console.log('No internet connection found. App is running in offline mode.')
    Notify.create({
      message: 'Running offline',
      icon: 'mdi-cloud-off-outline',
      color: 'warning',
    })
  },

  error(err) {
    console.error('Error during service worker registration:', err)
  }
})

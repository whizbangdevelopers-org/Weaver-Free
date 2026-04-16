<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div v-if="renderError" class="flex flex-center" style="min-height: 100vh">
    <div class="text-center q-pa-lg">
      <q-icon name="mdi-alert-octagon" size="80px" color="negative" />
      <div class="text-h5 q-mt-md">Something went wrong</div>
      <div class="text-body1 text-grey-8 q-mt-sm q-mb-lg">
        An unexpected error occurred. Try reloading the page.
      </div>
      <pre v-if="renderError" class="text-left bg-grey-2 q-pa-md rounded-borders text-caption" style="max-width: 600px; overflow-x: auto">{{ renderError }}</pre>
      <q-btn color="primary" label="Reload Page" icon="mdi-refresh" class="q-mt-md" @click="reload" />
    </div>
  </div>
  <router-view v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { extractErrorMessage } from 'src/utils/error'

const renderError = ref<string | null>(null)

onErrorCaptured((err) => {
  renderError.value = extractErrorMessage(err, 'An unexpected error occurred')
  console.error('[ErrorBoundary]', err)
  return false
})

function reload() {
  window.location.reload()
}
</script>

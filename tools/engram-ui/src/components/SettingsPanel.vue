<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="q-pa-md">
    <div class="text-subtitle1 q-mb-md">
      <q-icon name="mdi-cog" class="q-mr-xs" />
      Settings
    </div>

    <!-- Knowledge write token (Stage B / WVR-197) — local to this browser.
         Read-only browsing/search needs no token; only Author & Review writes do
         (trust-split: open reads on the trusted segment, bearer gates writes). -->
    <div class="text-overline text-grey-7 q-mb-sm">Knowledge write token</div>
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="q-gutter-sm">
        <div class="text-caption text-grey-7">
          Bearer that authorises writes on the <strong>Author</strong> &amp; <strong>Review</strong> tabs.
          Read-only browsing and search need no token. Stored in this browser only
          (not sent anywhere else).
        </div>
        <q-input
          v-model="writeToken"
          outlined
          dense
          label="engram-query write token"
          :type="showWriteToken ? 'text' : 'password'"
          data-testid="settings-write-token"
        >
          <template #append>
            <q-btn
              flat
              dense
              round
              :icon="showWriteToken ? 'mdi-eye-off' : 'mdi-eye'"
              @click="showWriteToken = !showWriteToken"
            />
          </template>
        </q-input>
        <div class="row items-center">
          <q-btn dense color="primary" icon="mdi-key" label="Save token" @click="onSaveToken" />
          <span v-if="tokenSaved" class="text-caption text-positive q-ml-sm">
            <q-icon name="mdi-check" /> saved to this browser
          </span>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getWriteToken, setWriteToken } from '../composables/useKnowledgeEditor'

// Knowledge write token — persisted straight to localStorage (WVR-197).
const writeToken = ref(getWriteToken())
const showWriteToken = ref(false)
const tokenSaved = ref(false)
function onSaveToken() {
  setWriteToken(writeToken.value.trim())
  tokenSaved.value = true
  setTimeout(() => { tokenSaved.value = false }, 2000)
}
</script>

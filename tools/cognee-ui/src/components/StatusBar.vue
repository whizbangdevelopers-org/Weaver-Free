<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-toolbar class="bg-primary text-white">
    <q-icon name="mdi-brain" size="24px" class="q-mr-sm" />
    <q-toolbar-title>Cognee</q-toolbar-title>

    <span class="status-dot" :class="status" />

    <q-badge v-if="status === 'available'" color="positive" class="q-mr-sm">
      available
    </q-badge>
    <q-badge v-else-if="status === 'unavailable'" color="negative" class="q-mr-sm">
      unavailable
    </q-badge>
    <q-badge v-else color="warning" class="q-mr-sm">
      checking…
    </q-badge>

    <span v-if="statusDetail" class="text-caption q-mr-md text-white-7">
      {{ statusDetail.version }}
      <span v-if="statusDetail.llmBackend"> · {{ statusDetail.llmBackend }}</span>
    </span>

    <q-btn flat dense icon="mdi-upload" label="Add files" class="q-mr-xs" @click="emit('add')" />
    <q-btn flat dense icon="mdi-plus-circle-outline" label="Remember" @click="emit('remember')" />
    <q-btn flat dense round icon="mdi-refresh" class="q-ml-xs" @click="emit('refresh')" />
  </q-toolbar>
</template>

<script setup lang="ts">
import type { SidecarStatus } from '../composables/useCognee'

defineProps<{
  status: SidecarStatus
  statusDetail: { version: string; llmBackend: string } | null
}>()

const emit = defineEmits<{
  add: []
  remember: []
  refresh: []
}>()
</script>

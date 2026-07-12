<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-toolbar class="bg-primary text-white">
    <q-icon name="mdi-memory" size="24px" class="q-mr-sm" />
    <q-toolbar-title>Engram — Knowledge Governance</q-toolbar-title>

    <span class="status-dot" :class="status" />

    <q-badge v-if="status === 'available'" color="positive" class="q-mr-sm">
      engram-query online
    </q-badge>
    <q-badge v-else-if="status === 'unavailable'" color="negative" class="q-mr-sm">
      engram-query offline
    </q-badge>
    <q-badge v-else color="warning" class="q-mr-sm">
      checking…
    </q-badge>

    <q-btn flat dense round icon="mdi-cog" class="q-mr-xs" @click="emit('settings')">
      <q-tooltip>Settings</q-tooltip>
    </q-btn>
    <q-btn flat dense round icon="mdi-refresh" class="q-ml-xs" @click="emit('refresh')">
      <q-tooltip>Refresh</q-tooltip>
    </q-btn>
  </q-toolbar>
</template>

<script setup lang="ts">
defineProps<{
  status: 'checking' | 'available' | 'unavailable'
}>()

const emit = defineEmits<{
  settings: []
  refresh: []
}>()
</script>

<style scoped>
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
  display: inline-block;
}
.status-dot.available { background: var(--q-positive); }
.status-dot.unavailable { background: var(--q-negative); }
.status-dot.checking { background: var(--q-warning); }
</style>

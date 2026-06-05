<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-toolbar class="bg-primary text-white">
    <q-icon name="mdi-memory" size="24px" class="q-mr-sm" />
    <q-toolbar-title>Engram</q-toolbar-title>

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

    <q-btn flat dense round icon="mdi-cog" class="q-mr-xs" @click="emit('settings')">
      <q-tooltip>Settings</q-tooltip>
    </q-btn>
    <q-btn flat dense round icon="mdi-key-variant" class="q-mr-xs" @click="emit('keys')">
      <q-tooltip>API Keys</q-tooltip>
    </q-btn>
    <q-btn flat dense round icon="mdi-refresh" class="q-ml-xs" @click="emit('refresh')" />

    <template v-if="currentUser">
      <q-chip dense color="white" text-color="primary" class="q-ml-sm" icon="mdi-account-circle">
        {{ currentUser }}
      </q-chip>
      <q-btn flat dense round icon="mdi-account-plus" class="q-ml-xs" @click="emit('users')">
        <q-tooltip>Add user</q-tooltip>
      </q-btn>
      <q-btn flat dense round icon="mdi-logout" class="q-ml-xs" @click="emit('logout')">
        <q-tooltip>Sign out</q-tooltip>
      </q-btn>
    </template>
    <q-btn v-else flat dense icon="mdi-login" label="Sign in" class="q-ml-sm" @click="emit('login')" />
  </q-toolbar>
</template>

<script setup lang="ts">
import type { SidecarStatus } from '../composables/useEngram'

defineProps<{
  status: SidecarStatus
  statusDetail: { version: string; llmBackend: string } | null
  currentUser: string | null
}>()

const emit = defineEmits<{
  settings: []
  keys: []
  refresh: []
  login: []
  logout: []
  users: []
}>()
</script>

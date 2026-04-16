<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-btn flat round icon="mdi-bell-outline">
    <q-badge
      v-if="store.unreadCount > 0"
      color="negative"
      floating
      rounded
    >
      {{ store.unreadCount > 99 ? '99+' : store.unreadCount }}
    </q-badge>
    <q-menu v-model="showPanel" anchor="bottom right" self="top right">
      <NotificationPanel />
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useNotificationStore } from 'src/stores/notification-store'
import NotificationPanel from 'src/components/NotificationPanel.vue'

const store = useNotificationStore()
const showPanel = ref(false)
</script>

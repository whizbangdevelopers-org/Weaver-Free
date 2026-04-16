<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-badge
    :color="statusColor"
    rounded
    class="status-badge"
  >
    <q-icon :name="statusIcon" size="14px" />
    <q-tooltip>{{ statusLabel }}</q-tooltip>
  </q-badge>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WorkloadInfo } from 'src/types/workload'

const props = defineProps<{
  status: WorkloadInfo['status']
}>()

const statusColor = computed(() => {
  switch (props.status) {
    case 'running':
      return 'positive'
    case 'idle':
      return 'grey-5'
    case 'stopped':
      return 'warning'
    case 'failed':
      return 'negative'
    case 'unknown':
      return 'grey-7'
    default:
      return 'grey'
  }
})

const statusLabel = computed(() => {
  return props.status.charAt(0).toUpperCase() + props.status.slice(1)
})

const statusIcon = computed(() => {
  switch (props.status) {
    case 'running':
      return 'mdi-play-circle'
    case 'idle':
      return 'mdi-power-sleep'
    case 'stopped':
      return 'mdi-alert-circle-outline'
    case 'failed':
      return 'mdi-alert-circle'
    case 'unknown':
      return 'mdi-help-circle'
    default:
      return 'mdi-circle'
  }
})
</script>

<style scoped lang="scss">
.status-badge {
  padding: 4px 6px;
  transition: background-color 0.4s ease, color 0.4s ease;
}
</style>

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="column full-height q-pa-sm" style="min-width: 180px; max-width: 240px">
    <div class="text-overline text-grey-7 q-mb-xs q-px-xs">Datasets</div>

    <div v-if="loading" class="flex flex-center q-pa-md">
      <q-spinner-dots color="primary" size="24px" />
    </div>

    <div v-else-if="datasets.length === 0" class="text-caption text-grey-6 q-pa-xs">
      No datasets found
    </div>

    <q-scroll-area v-else class="col">
      <div
        v-for="ds in datasets"
        :key="ds.id"
        class="dataset-item q-pa-xs q-mb-xs"
        :class="{ active: activeDatasetId === ds.id }"
        @click="emit('select', ds.id)"
      >
        <q-icon
          name="mdi-database"
          size="14px"
          :color="activeDatasetId === ds.id ? 'primary' : 'grey-6'"
          class="q-mr-xs"
        />
        <span class="text-body2 ellipsis">{{ ds.name }}</span>
      </div>
    </q-scroll-area>

    <q-separator class="q-my-xs" />
    <q-btn
      flat
      dense
      size="sm"
      icon="mdi-refresh"
      label="Refresh"
      color="grey-7"
      class="full-width"
      :loading="loading"
      @click="emit('refresh')"
    />
  </div>
</template>

<script setup lang="ts">
import type { Dataset } from '../composables/useCognee'

defineProps<{
  datasets: Dataset[]
  activeDatasetId: string | null
  loading: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  refresh: []
}>()
</script>

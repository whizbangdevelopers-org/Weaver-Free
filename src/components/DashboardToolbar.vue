<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="row items-center q-gutter-sm q-mb-md wrap">
    <!-- Status filter chips -->
    <q-btn-toggle
      :model-value="uiStore.filterStatus"
      toggle-color="primary"
      no-caps
      dense
      flat
      multiple
      :options="statusOptions"
      @update:model-value="uiStore.setFilterStatus($event as string[])"
    />

    <!-- Tag filter dropdown -->
    <q-btn-dropdown
      v-if="workloadStore.allTags.length > 0"
      flat
      dense
      icon="mdi-tag-multiple"
      :label="tagFilterLabel"
      no-caps
    >
      <q-list dense style="min-width: 180px">
        <q-item
          v-for="tag in workloadStore.allTags"
          :key="tag"
          clickable
          @click="toggleTagFilter(tag)"
        >
          <q-item-section avatar>
            <q-checkbox
              :model-value="uiStore.filterTags.includes(tag)"
              dense
              @update:model-value="toggleTagFilter(tag)"
            />
          </q-item-section>
          <q-item-section>
            <q-chip dense outline size="sm" color="primary">{{ tag }}</q-chip>
          </q-item-section>
        </q-item>
        <q-separator v-if="uiStore.filterTags.length > 0" />
        <q-item v-if="uiStore.filterTags.length > 0" clickable v-close-popup @click="uiStore.setFilterTags([])">
          <q-item-section class="text-caption text-grey-8">Clear tag filter</q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>

    <!-- Clear all filters -->
    <q-btn
      v-if="workloadStore.hasActiveFilters"
      flat
      dense
      no-caps
      color="grey"
      icon="mdi-filter-off"
      label="Clear"
      @click="uiStore.clearFilters()"
    />

    <q-space />

    <!-- Filter result count -->
    <span v-if="workloadStore.hasActiveFilters" class="text-caption text-grey-8">
      {{ workloadStore.filteredWorkloads.length }} of {{ workloadStore.totalCount }} VMs
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWorkloadStore } from 'src/stores/workload-store'
import { useUiStore } from 'src/stores/ui-store'

const workloadStore = useWorkloadStore()
const uiStore = useUiStore()

const statusOptions = [
  { value: 'running', label: 'Running', icon: 'mdi-play-circle' },
  { value: 'idle', label: 'Idle', icon: 'mdi-power-sleep' },
  { value: 'stopped', label: 'Stopped', icon: 'mdi-stop-circle' },
  { value: 'failed', label: 'Failed', icon: 'mdi-alert-circle' },
]

const tagFilterLabel = computed(() => {
  if (uiStore.filterTags.length === 0) return 'Tags'
  return `Tags (${uiStore.filterTags.length})`
})

function toggleTagFilter(tag: string) {
  const current = [...uiStore.filterTags]
  const idx = current.indexOf(tag)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(tag)
  }
  uiStore.setFilterTags(current)
}
</script>

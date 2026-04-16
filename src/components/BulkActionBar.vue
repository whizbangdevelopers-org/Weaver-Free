<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <!-- Fabrick-only: bulk VM operations require Fabrick tier -->
  <q-card v-if="isFabrick && selection.hasSelection.value" flat bordered class="bulk-action-bar q-mb-md">
    <q-card-section class="row items-center q-pa-sm q-px-md q-gutter-sm no-wrap">
      <q-checkbox
        :model-value="allSelected"
        :indeterminate="someSelected && !allSelected"
        dense
        @update:model-value="onToggleAll"
      />
      <span class="text-body2 text-weight-medium">
        {{ selection.selectedCount.value }} selected
      </span>

      <q-separator vertical class="q-mx-sm" />

      <q-btn
        flat
        dense
        no-caps
        color="positive"
        icon="mdi-play"
        label="Start"
        :loading="bulkLoading"
        @click="bulkAction('start')"
      />
      <q-btn
        flat
        dense
        no-caps
        color="negative"
        icon="mdi-stop"
        label="Stop"
        :loading="bulkLoading"
        @click="confirmBulkAction('stop')"
      />
      <q-btn
        flat
        dense
        no-caps
        color="warning"
        icon="mdi-restart"
        label="Restart"
        :loading="bulkLoading"
        @click="confirmBulkAction('restart')"
      />

      <q-space />

      <q-btn
        flat
        dense
        round
        icon="mdi-close"
        @click="selection.clearSelection()"
      >
        <q-tooltip>Clear selection</q-tooltip>
      </q-btn>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useWorkloadApi } from 'src/composables/useVmApi'
import { useVmSelection } from 'src/composables/useVmSelection'
import { useWorkloadStore } from 'src/stores/workload-store'
import { useAppStore } from 'src/stores/app'
import type { WorkloadAction } from 'src/types/workload'
import { STATUSES } from 'src/constants/vocabularies'

const $q = useQuasar()
const { vmAction } = useWorkloadApi()
const selection = useVmSelection()
const workloadStore = useWorkloadStore()
const appStore = useAppStore()
const bulkLoading = ref(false)
const isFabrick = computed(() => appStore.isFabrick)

const allSelected = computed(() =>
  workloadStore.filteredWorkloads.length > 0 &&
  workloadStore.filteredWorkloads.every(vm => selection.isSelected(vm.name))
)

const someSelected = computed(() =>
  workloadStore.filteredWorkloads.some(vm => selection.isSelected(vm.name))
)

function onToggleAll(val: boolean | null) {
  if (val) {
    selection.selectAll(workloadStore.filteredWorkloads)
  } else {
    selection.clearSelection()
  }
}

function confirmBulkAction(action: WorkloadAction) {
  const count = selection.selectedCount.value
  $q.dialog({
    title: `${action.charAt(0).toUpperCase() + action.slice(1)} ${count} VMs`,
    message: `Are you sure you want to ${action} ${count} selected VM${count > 1 ? 's' : ''}?`,
    cancel: true,
    color: action === 'stop' ? 'negative' : 'warning',
  }).onOk(() => void bulkAction(action))
}

async function bulkAction(action: WorkloadAction) {
  bulkLoading.value = true
  const names = selection.getSelectedNames()
  let successCount = 0
  let failCount = 0

  for (const name of names) {
    const vm = workloadStore.workloadByName(name)
    // Skip VMs that don't make sense for the action
    if (action === 'start' && vm?.status === STATUSES.RUNNING) continue
    if (action === 'stop' && vm?.status !== STATUSES.RUNNING) continue

    const result = await vmAction(name, action)
    if (result.success) {
      successCount++
    } else {
      failCount++
    }
  }

  bulkLoading.value = false
  selection.clearSelection()

  if (successCount > 0) {
    $q.notify({
      type: 'positive',
      message: `${action.charAt(0).toUpperCase() + action.slice(1)}: ${successCount} VM${successCount > 1 ? 's' : ''} succeeded${failCount > 0 ? `, ${failCount} failed` : ''}`,
      position: 'top-right',
      timeout: 3000,
    })
  } else if (failCount > 0) {
    $q.notify({
      type: 'negative',
      message: `${action.charAt(0).toUpperCase() + action.slice(1)} failed for ${failCount} VM${failCount > 1 ? 's' : ''}`,
      position: 'top-right',
      timeout: 5000,
    })
  }
}
</script>

<style scoped lang="scss">
.bulk-action-bar {
  border-color: var(--q-primary);
  background: rgba(var(--q-primary-rgb, 25, 118, 210), 0.05);
}
</style>

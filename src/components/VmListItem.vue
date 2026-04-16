<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-item clickable v-ripple class="vm-list-item" @click="drawerStore.openVm(vm.name)">
    <q-item-section v-if="selectable" avatar @click.stop>
      <q-checkbox
        :model-value="selection.isSelected(vm.name)"
        dense
        @update:model-value="selection.toggle(vm.name)"
      />
    </q-item-section>

    <q-item-section avatar>
      <StatusBadge :status="vm.status" />
    </q-item-section>

    <q-item-section avatar>
      <q-icon :name="vmTypeIcon(vm.vmType)" :color="vmTypeColor(vm.vmType)" size="18px">
        <q-tooltip>{{ vm.vmType === 'desktop' ? 'Desktop VM (GUI passthrough)' : 'Server VM (headless)' }}</q-tooltip>
      </q-icon>
    </q-item-section>

    <q-item-section>
      <q-item-label class="text-weight-medium">
        <q-badge
          v-if="remoteHostname"
          color="deep-purple-7"
          :label="remoteHostname"
          class="q-mr-xs"
          style="font-size:9px;vertical-align:middle"
        />{{ vm.name }}
        <q-icon v-if="vm.autostart" name="mdi-play-circle-outline" size="14px" color="grey-6" class="q-ml-xs">
          <q-tooltip>Auto-starts on boot</q-tooltip>
        </q-icon>
        <span v-if="vm.description" class="text-grey-8 q-ml-sm">&mdash; {{ vm.description }}</span>
      </q-item-label>
      <q-item-label caption>
        {{ vm.mem }} MB &middot; {{ vm.vcpu }} vCPU &middot; {{ vm.ip || 'No network' }}
        <span v-if="vm.diskSize"> &middot; {{ vm.diskSize }} GB</span>
        <span v-if="vm.distro"> &middot; {{ vm.distro }}</span>
        <template v-if="vm.tags && vm.tags.length > 0">
          &middot;
          <q-chip
            v-for="tag in vm.tags.slice(0, 3)"
            :key="tag"
            dense outline size="xs" color="primary"
            class="q-ml-xs"
          >{{ tag }}</q-chip>
          <span v-if="vm.tags.length > 3" class="text-grey-8"> +{{ vm.tags.length - 3 }}</span>
        </template>
      </q-item-label>
    </q-item-section>

    <q-item-section v-if="isProvisioning" side>
      <q-spinner-dots size="20px" color="primary" />
    </q-item-section>

  </q-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from 'src/components/StatusBadge.vue'
import { useVmSelection } from 'src/composables/useVmSelection'
import { useResourceDrawerStore } from 'src/stores/resource-drawer-store'
import { vmTypeIcon, vmTypeColor } from 'src/utils/vm'
import type { WorkloadInfo } from 'src/types/workload'

const props = defineProps<{
  vm: WorkloadInfo
  selectable?: boolean
  remoteHostname?: string
}>()

const drawerStore = useResourceDrawerStore()
const selection = useVmSelection()

const isProvisioning = computed(() => {
  const state = props.vm.provisioningState
  return state === 'provisioning' || state === 'destroying'
})
</script>

<style scoped lang="scss">
.vm-list-item {
  border-left: 3px solid transparent;
  transition: background-color 0.2s ease;
}
</style>

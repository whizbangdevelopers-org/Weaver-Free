<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  Container row for the unified list view — mirrors VmListItem structure.
-->
<template>
  <q-item clickable v-ripple class="container-list-item" @click="drawerStore.openContainer(container.id)">
    <q-item-section v-if="selectable" avatar @click.stop>
      <q-checkbox
        :model-value="selection.isSelected(container.id)"
        dense
        @update:model-value="selection.toggle(container.id)"
      />
    </q-item-section>

    <q-item-section avatar>
      <StatusBadge :status="effectiveStatus === STATUSES.RUNNING ? STATUSES.RUNNING : STATUSES.STOPPED" />
    </q-item-section>

    <q-item-section avatar>
      <q-icon :name="runtimeIcon" :color="runtimeColor" size="18px">
        <q-tooltip>{{ container.runtime }}</q-tooltip>
      </q-icon>
    </q-item-section>

    <q-item-section>
      <q-item-label class="text-weight-medium">{{ container.name }}</q-item-label>
      <q-item-label caption>
        {{ container.image }}
        <template v-if="container.ports?.length">
          &middot;
          <span v-for="p in container.ports.slice(0, 2)" :key="p.hostPort" class="q-mr-xs">
            {{ p.hostPort }}→{{ p.containerPort }}
          </span>
          <span v-if="container.ports.length > 2">+{{ container.ports.length - 2 }}</span>
        </template>
      </q-item-label>
    </q-item-section>

  </q-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from 'src/components/StatusBadge.vue'
import { useDemoContainerState } from 'src/composables/useDemoContainerState'
import { useContainerSelection } from 'src/composables/useContainerSelection'
import { useResourceDrawerStore } from 'src/stores/resource-drawer-store'
import type { ContainerInfo, ContainerRuntime } from 'src/types/container'
import { STATUSES } from 'src/constants/vocabularies'

const props = defineProps<{ container: ContainerInfo; selectable?: boolean }>()

const drawerStore = useResourceDrawerStore()
const demoState = useDemoContainerState()
const selection = useContainerSelection()

const effectiveStatus = computed(() =>
  demoState.getStatus(props.container.id, props.container.status)
)

const runtimeIcon = computed((): string => {
  const rt: ContainerRuntime = props.container.runtime
  if (rt === 'docker') return 'mdi-docker'
  if (rt === 'podman') return 'mdi-cow'
  return 'mdi-layers-outline'
})

const runtimeColor = computed((): string => {
  const rt: ContainerRuntime = props.container.runtime
  if (rt === 'docker') return 'blue-7'
  if (rt === 'podman') return 'teal-7'
  return 'deep-purple-6'
})
</script>

<style scoped lang="scss">
.container-list-item {
  border-left: 3px solid transparent;
  transition: background-color 0.2s ease;
  &.container-list-item--running {
    border-left-color: var(--q-positive);
  }
}
</style>

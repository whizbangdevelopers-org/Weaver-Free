<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  Compact container card for the unified infrastructure grid.
-->
<template>
  <q-card
    class="container-card cursor-pointer"
    :class="{ 'container-card--running': effectiveStatus === STATUSES.RUNNING }"
    flat bordered
    @click="drawerStore.openContainer(container.id)"
  >
    <q-card-section class="q-pa-sm">
      <!-- Name + runtime icon + status -->
      <div class="row items-center no-wrap q-mb-xs">
        <q-icon :name="runtimeIcon" size="18px" :color="runtimeColor" class="q-mr-xs" />
        <span class="text-weight-medium text-body2 ellipsis col">{{ container.name }}</span>
        <StatusBadge :status="effectiveStatus === STATUSES.RUNNING ? STATUSES.RUNNING : STATUSES.STOPPED" size="xs" />
      </div>

      <!-- Image + bulk checkbox on same row -->
      <div class="row items-center no-wrap q-mb-xs">
        <span class="text-caption text-grey-6 ellipsis col" :title="container.image">{{ container.image }}</span>
        <q-checkbox
          v-if="selectable"
          :model-value="selection.isSelected(container.id)"
          dense
          class="q-ml-xs"
          @click.stop
          @update:model-value="selection.toggle(container.id)"
        />
      </div>

      <!-- User labels — always reserve row height for grid alignment (skip for apptainer, which uses its own label row) -->
      <div v-if="container.runtime !== 'apptainer'" class="row q-gutter-xs q-mb-xs" style="min-height: 24px">
        <template v-if="userLabels.length">
          <q-chip
            v-for="[k, v] in userLabels.slice(0, 3)"
            :key="k"
            dense outline size="xs" color="grey-7"
          >{{ k }}: {{ v }}</q-chip>
          <q-chip v-if="userLabels.length > 3" dense outline size="xs" color="grey-5">+{{ userLabels.length - 3 }}</q-chip>
        </template>
      </div>

      <!-- Apptainer highlighted labels -->
      <div v-if="container.runtime === 'apptainer' && container.labels" class="q-mt-xs">
        <q-badge
          v-for="[k, v] in Object.entries(container.labels).slice(0, 2)"
          :key="k"
          outline color="deep-purple-4"
          :label="`${k}: ${v}`"
          class="q-mr-xs"
          style="font-size: 0.6rem"
        />
      </div>

      <!-- Port badges (max 3) -->
      <div v-if="container.ports?.length" class="row q-gutter-xs q-mb-xs">
        <q-badge
          v-for="p in container.ports.slice(0, 3)"
          :key="p.hostPort"
          outline color="grey-7"
          :label="`${p.hostPort}→${p.containerPort}`"
        />
        <q-badge v-if="container.ports.length > 3" outline color="grey-5" :label="`+${container.ports.length - 3}`" />
      </div>

      <!-- CPU / MEM — always shown for consistent card height -->
      <div class="q-mt-xs">
        <span v-if="container.runtime === 'apptainer'" class="text-caption text-grey-6 text-uppercase" style="letter-spacing:0.05em;font-size:9px">Host resources</span>
        <div class="resource-row">
          <div class="resource-item">
            <span class="text-caption text-grey-8">CPU</span>
            <q-linear-progress
              :value="container.cpuPercent !== undefined ? container.cpuPercent / 100 : 0"
              :color="container.cpuPercent !== undefined && container.cpuPercent > 80 ? 'warning' : container.cpuPercent !== undefined ? 'primary' : 'grey-3'"
              size="4px" class="q-mt-xs" style="width: 60px"
            />
            <span class="text-caption">{{ container.cpuPercent !== undefined ? `${container.cpuPercent}%` : '—' }}</span>
          </div>
          <div class="resource-item">
            <span class="text-caption text-grey-8">MEM</span>
            <template v-if="container.runtime === 'apptainer'">
              <!-- Ceiling is host total RAM — expressed as % for consistency with CPU -->
              <template v-if="hostMemMb && container.memoryUsageMb !== undefined">
                <q-linear-progress
                  :value="container.memoryUsageMb / hostMemMb"
                  :color="container.memoryUsageMb / hostMemMb > 0.85 ? 'negative' : container.memoryUsageMb / hostMemMb > 0.70 ? 'warning' : 'teal'"
                  size="4px" class="q-mt-xs" style="width: 60px"
                />
                <span class="text-caption">{{ Math.round(container.memoryUsageMb / hostMemMb * 100) }}%</span>
              </template>
              <span v-else class="text-caption q-ml-xs">—</span>
            </template>
            <template v-else>
              <q-linear-progress
                :value="container.memoryUsageMb !== undefined && container.memoryLimitMb ? container.memoryUsageMb / container.memoryLimitMb : 0"
                :color="container.memoryUsageMb !== undefined && container.memoryLimitMb && container.memoryUsageMb / container.memoryLimitMb > 0.85 ? 'warning' : container.memoryUsageMb !== undefined ? 'teal' : 'grey-3'"
                size="4px" class="q-mt-xs" style="width: 60px"
              />
              <span class="text-caption">{{ container.memoryUsageMb !== undefined ? (container.memoryUsageMb >= 1024 ? `${(container.memoryUsageMb / 1024).toFixed(1)}G` : `${container.memoryUsageMb}M`) : '—' }}</span>
            </template>
          </div>
        </div>
      </div>

    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from 'src/components/StatusBadge.vue'
import { useDemoContainerState } from 'src/composables/useDemoContainerState'
import { useResourceDrawerStore } from 'src/stores/resource-drawer-store'
import { useContainerSelection } from 'src/composables/useContainerSelection'
import type { ContainerInfo, ContainerRuntime } from 'src/types/container'
import { STATUSES } from 'src/constants/vocabularies'

const props = defineProps<{ container: ContainerInfo; selectable?: boolean; hostMemMb?: number }>()

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

const SYSTEM_LABEL_PREFIXES = ['com.docker.', 'org.opencontainers.', 'io.buildah.', 'io.podman.']
const userLabels = computed((): [string, string][] => {
  if (!props.container.labels || props.container.runtime === 'apptainer') return []
  return Object.entries(props.container.labels).filter(
    ([k]) => !SYSTEM_LABEL_PREFIXES.some(p => k.startsWith(p))
  ) as [string, string][]
})
</script>

<style scoped lang="scss">
.container-card {
  transition: box-shadow 0.15s, transform 0.15s;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }
  &--running {
    border-left: 3px solid var(--q-positive);
  }
}
.resource-row {
  display: flex;
  gap: 12px;
  margin-top: 4px;
}
.resource-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>

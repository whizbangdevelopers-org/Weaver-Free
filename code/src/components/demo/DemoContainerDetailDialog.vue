<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  Detail dialog for a single demo container. Shows full container info:
  stats, port mappings, volume mounts, and labels.
  Apptainer containers show an upgrade nag for free-tier users.
-->
<template>
  <q-dialog :model-value="modelValue" max-width="560px" @update:model-value="emit('update:modelValue', $event)">
    <q-card v-if="container" style="min-width: 320px; max-width: 560px; width: 100%">

      <!-- Header -->
      <q-card-section class="row items-center no-wrap q-pb-xs">
        <q-icon :name="runtimeIcon(container.runtime)" size="24px" :color="runtimeColor(container.runtime)" class="q-mr-sm" />
        <span class="text-h6 ellipsis col">{{ container.name }}</span>
        <StatusBadge :status="effectiveStatus === STATUSES.RUNNING ? STATUSES.RUNNING : STATUSES.STOPPED" class="q-ml-sm" />
        <q-btn flat round dense icon="mdi-close" class="q-ml-sm" @click="emit('update:modelValue', false)" />
      </q-card-section>

      <!-- Image row -->
      <q-card-section class="q-pt-xs q-pb-xs">
        <div class="text-caption text-grey-6">{{ container.image }}</div>
      </q-card-section>

      <!-- Apptainer upgrade nag (free tier) — replaces full content -->
      <q-card-section v-if="container.runtime === 'apptainer' && !appStore.isWeaver" class="q-pt-sm">
        <UpgradeNag feature-name="Apptainer visibility" :required-tier="TIERS.WEAVER" />
      </q-card-section>

      <!-- Full content (weaver+, or non-Apptainer) -->
      <template v-else>

        <!-- Stats row -->
        <q-card-section
          v-if="container.cpuPercent !== undefined || container.memoryUsageMb !== undefined"
          class="q-pt-xs q-pb-xs"
        >
          <div class="resource-row">
            <div v-if="container.cpuPercent !== undefined" class="resource-item">
              <span class="text-caption text-grey">CPU</span>
              <q-linear-progress
                :value="container.cpuPercent / 100"
                :color="container.cpuPercent > 80 ? 'warning' : 'primary'"
                size="4px"
                class="q-mt-xs"
                style="width: 80px"
              />
              <span class="text-caption">{{ container.cpuPercent }}%</span>
            </div>
            <div v-if="container.memoryUsageMb !== undefined" class="resource-item">
              <span class="text-caption text-grey">MEM</span>
              <q-linear-progress
                :value="container.memoryLimitMb ? container.memoryUsageMb / container.memoryLimitMb : 0"
                :color="(container.memoryLimitMb && container.memoryUsageMb / container.memoryLimitMb > 0.85) ? 'warning' : 'teal'"
                size="4px"
                class="q-mt-xs"
                style="width: 80px"
              />
              <span class="text-caption">{{ container.memoryUsageMb }}M</span>
            </div>
          </div>
        </q-card-section>

        <!-- Port mappings -->
        <q-card-section v-if="container.ports?.length" class="q-pt-sm q-pb-xs">
          <div class="row items-center q-mb-xs">
            <q-icon name="mdi-lan-connect" size="16px" color="grey-7" class="q-mr-xs" />
            <span class="text-caption text-weight-medium text-grey-7">Port Mappings</span>
          </div>
          <q-markup-table flat bordered dense>
            <thead>
              <tr>
                <th class="text-left text-caption">Host Port</th>
                <th class="text-left text-caption">Container Port</th>
                <th class="text-left text-caption">Protocol</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in container.ports" :key="`${p.hostPort}-${p.containerPort}`">
                <td class="text-caption">{{ p.hostPort }}</td>
                <td class="text-caption">{{ p.containerPort }}</td>
                <td class="text-caption">{{ p.protocol.toUpperCase() }}</td>
              </tr>
            </tbody>
          </q-markup-table>
        </q-card-section>

        <!-- Volume mounts -->
        <q-card-section v-if="container.mounts?.length" class="q-pt-sm q-pb-xs">
          <div class="row items-center q-mb-xs">
            <q-icon name="mdi-folder-open" size="16px" color="grey-7" class="q-mr-xs" />
            <span class="text-caption text-weight-medium text-grey-7">Volume Mounts</span>
          </div>
          <q-markup-table flat bordered dense>
            <thead>
              <tr>
                <th class="text-left text-caption">Source</th>
                <th class="text-left text-caption">Destination</th>
                <th class="text-left text-caption">Mode</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, i) in container.mounts" :key="i">
                <td class="text-caption mount-path">{{ m.source }}</td>
                <td class="text-caption mount-path">{{ m.destination }}</td>
                <td class="text-caption">{{ m.readonly ? 'RO' : 'RW' }}</td>
              </tr>
            </tbody>
          </q-markup-table>
        </q-card-section>

        <!-- Labels -->
        <q-card-section v-if="hasLabels" class="q-pt-sm q-pb-xs">
          <div class="row items-center q-mb-xs">
            <q-icon name="mdi-tag-multiple" size="16px" color="grey-7" class="q-mr-xs" />
            <span class="text-caption text-weight-medium text-grey-7">Labels</span>
          </div>
          <div class="row q-gutter-xs">
            <q-badge
              v-for="[k, v] in labelEntries"
              :key="k"
              :outline="!isApptainerHighlightedLabel(k)"
              :color="isApptainerHighlightedLabel(k) ? 'deep-purple-6' : 'grey-7'"
              :label="`${k}: ${v}`"
              style="font-size: 0.65rem"
            />
          </div>
        </q-card-section>

        <!-- Runtime info row -->
        <q-card-section class="q-pt-sm q-pb-sm">
          <div class="row items-center q-gutter-sm">
            <q-badge :color="runtimeColor(container.runtime)" :label="container.runtime" />
            <span class="text-caption text-grey-6">{{ createdAgo }}</span>
          </div>
          <!-- v1.1 start/stop actions (Docker + Podman free) -->
          <div v-if="appStore.isDemoVersionAtLeast('1.1')" class="row q-gutter-sm q-mt-sm">
            <q-btn
              v-if="effectiveStatus === STATUSES.RUNNING"
              outline size="sm" color="grey-7" icon="mdi-stop" label="Stop Container"
              :loading="demoState.isLoading(container.id)"
              @click="handleStop"
            />
            <q-btn
              v-else
              outline size="sm" color="positive" icon="mdi-play" label="Start Container"
              :loading="demoState.isLoading(container.id)"
              @click="handleStart"
            />
            <q-btn outline size="sm" color="negative" icon="mdi-delete" label="Remove" @click="handleRemove" />
          </div>
        </q-card-section>

      </template>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAppStore } from 'src/stores/app'
import type { ContainerInfo, ContainerRuntime } from 'src/types/container'
import { TIERS, STATUSES } from 'src/constants/vocabularies'
import StatusBadge from 'src/components/StatusBadge.vue'
import UpgradeNag from 'src/components/nag/UpgradeNag.vue'
import { useDemoContainerState } from 'src/composables/useDemoContainerState'

const props = defineProps<{
  container: ContainerInfo | null
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const appStore = useAppStore()
const $q = useQuasar()
const demoState = useDemoContainerState()

const effectiveStatus = computed(() =>
  demoState.getStatus(props.container?.id ?? '', props.container?.status ?? STATUSES.UNKNOWN) // ContainerStatus literal
)

async function handleStart() {
  if (!props.container) return
  await demoState.startContainer(props.container.id)
  $q.notify({ type: 'positive', message: `Container '${props.container.name}' started`, position: 'top-right', timeout: 3000 })
}

async function handleStop() {
  if (!props.container) return
  await demoState.stopContainer(props.container.id)
  $q.notify({ type: 'info', message: `Container '${props.container.name}' stopped`, position: 'top-right', timeout: 3000 })
}

function handleRemove() {
  emit('update:modelValue', false)
  $q.notify({ type: 'warning', message: 'Container removed (demo)', position: 'top-right', timeout: 3000 })
}

const hasLabels = computed(() =>
  !!props.container?.labels && Object.keys(props.container.labels).length > 0
)

const labelEntries = computed(() =>
  props.container?.labels ? Object.entries(props.container.labels) : []
)

/** Apptainer-specific labels (job, user) get highlighted */
function isApptainerHighlightedLabel(key: string): boolean {
  return props.container?.runtime === 'apptainer' && (key === 'job' || key === 'user')
}

const createdAgo = computed(() => {
  if (!props.container) return ''
  const n = Math.floor((Date.now() - new Date(props.container.created).getTime()) / 86400000)
  return n === 0 ? 'today' : `${n} days ago`
})

function runtimeIcon(rt: ContainerRuntime): string {
  if (rt === 'docker') return 'mdi-docker'
  if (rt === 'podman') return 'mdi-cow'
  return 'mdi-layers-outline'
}

function runtimeColor(rt: ContainerRuntime): string {
  if (rt === 'docker') return 'blue-7'
  if (rt === 'podman') return 'teal-7'
  return 'deep-purple-6'
}
</script>

<style scoped lang="scss">
.resource-row {
  display: flex;
  gap: 16px;
}

.resource-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mount-path {
  font-family: monospace;
  font-size: 0.7rem;
  word-break: break-all;
}
</style>

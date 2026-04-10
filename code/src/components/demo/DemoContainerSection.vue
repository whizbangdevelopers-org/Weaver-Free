<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  Demo-mode container section. Shows mock container data for the private demo
  v1.1.0 preview. Will be replaced by real ContainerCard + container-store
  when v1.1.0 is implemented.
-->
<template>
  <div class="demo-container-section q-mt-lg">
    <!-- Section header -->
    <div class="row items-center q-mb-sm">
      <q-icon name="mdi-docker" size="22px" color="primary" class="q-mr-sm" />
      <span class="text-subtitle1 text-weight-medium">Containers</span>
      <q-space />
      <!-- Runtime summary badges -->
      <q-badge
        v-for="rt in runtimeSummary"
        :key="rt.runtime"
        :color="runtimeColor(rt.runtime)"
        class="q-ml-xs"
        :label="`${rt.runtime} · ${rt.count}`"
      />
      <q-badge v-if="!appStore.isWeaver && hasApptainer" outline color="grey-6" label="apptainer · Weaver Solo" class="q-ml-xs">
        <q-tooltip>Apptainer visibility requires Weaver Solo</q-tooltip>
      </q-badge>
      <q-btn
        v-if="appStore.isDemoVersionAtLeast('1.2')"
        outline size="sm" color="primary" icon="mdi-plus" label="Create"
        class="q-ml-sm"
        @click="showCreate = true"
      />
      <HelpTooltip
        text="Docker + Podman containers are free — start, stop, and create. Apptainer (HPC/research SIF runtimes) requires Weaver Solo."
        class="q-ml-xs"
      />
    </div>

    <q-separator class="q-mb-md" />

    <!-- Container rows -->
    <div class="row q-gutter-sm">
      <div
        v-for="c in visibleContainers"
        :key="c.id"
        class="col-12 col-sm-6 col-md-4 col-lg-3"
      >
        <q-card flat bordered class="container-card" style="cursor: pointer" @click="openDetail(c)">
          <q-card-section class="q-pa-sm">
            <!-- Name + runtime badge -->
            <div class="row items-center no-wrap q-mb-xs">
              <q-icon :name="runtimeIcon(c.runtime)" size="18px" :color="runtimeColor(c.runtime)" class="q-mr-xs" />
              <span class="text-weight-medium text-body2 ellipsis col">{{ c.name }}</span>
              <StatusBadge :status="effectiveStatus(c) === STATUSES.RUNNING ? STATUSES.RUNNING : STATUSES.STOPPED" size="xs" />
            </div>

            <!-- Image -->
            <div class="text-caption text-grey-6 ellipsis q-mb-xs" :title="c.image">{{ c.image }}</div>

            <!-- Ports (if any) -->
            <div v-if="c.ports?.length" class="row q-gutter-xs q-mb-xs">
              <q-badge
                v-for="p in c.ports.slice(0, 3)"
                :key="`${p.hostPort}`"
                outline
                color="grey-7"
                :label="`${p.hostPort}→${p.containerPort}`"
              />
              <q-badge v-if="(c.ports.length ?? 0) > 3" outline color="grey-5" :label="`+${c.ports.length - 3}`" />
            </div>

            <!-- Resource usage (if available) -->
            <div v-if="c.cpuPercent !== undefined || c.memoryUsageMb !== undefined" class="resource-row">
              <div v-if="c.cpuPercent !== undefined" class="resource-item">
                <span class="text-caption text-grey">CPU</span>
                <q-linear-progress
                  :value="c.cpuPercent / 100"
                  :color="c.cpuPercent > 80 ? 'warning' : 'primary'"
                  size="4px"
                  class="q-mt-xs"
                  style="width: 60px"
                />
                <span class="text-caption">{{ c.cpuPercent }}%</span>
              </div>
              <div v-if="c.memoryUsageMb !== undefined" class="resource-item">
                <span class="text-caption text-grey">MEM</span>
                <q-linear-progress
                  :value="c.memoryLimitMb ? c.memoryUsageMb / c.memoryLimitMb : 0"
                  :color="(c.memoryLimitMb && c.memoryUsageMb / c.memoryLimitMb > 0.85) ? 'warning' : 'teal'"
                  size="4px"
                  class="q-mt-xs"
                  style="width: 60px"
                />
                <span class="text-caption">{{ c.memoryUsageMb }}M</span>
              </div>
            </div>

            <!-- Apptainer labels -->
            <div v-if="c.runtime === 'apptainer' && c.labels" class="q-mt-xs">
              <q-badge
                v-for="[k, v] in Object.entries(c.labels).slice(0, 2)"
                :key="k"
                outline color="deep-purple-4"
                :label="`${k}: ${v}`"
                class="q-mr-xs"
                style="font-size: 0.6rem"
              />
            </div>

            <!-- v1.1 start/stop actions (Docker + Podman free) -->
            <div v-if="appStore.isDemoVersionAtLeast('1.1')" class="row justify-end q-gutter-xs q-mt-xs" @click.stop>
              <q-btn
                v-if="effectiveStatus(c) === STATUSES.RUNNING"
                flat dense size="xs" color="grey-7" icon="mdi-stop" label="Stop"
                :loading="demoState.isLoading(c.id)"
                @click.stop="handleStop(c)"
              />
              <q-btn
                v-else
                flat dense size="xs" color="positive" icon="mdi-play" label="Start"
                :loading="demoState.isLoading(c.id)"
                @click.stop="handleStart(c)"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <DemoCreateContainerDialog v-model="showCreate" />

    <!-- Apptainer nag removed from Free tier — HPC is irrelevant to the home lab persona.
         Apptainer containers are simply hidden on Free (filtered in visibleContainers). -->
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAppStore } from 'src/stores/app'
import { useResourceDrawerStore } from 'src/stores/resource-drawer-store'
import { getDemoContainersForTier } from 'src/config/demo'
import { TIERS, STATUSES } from 'src/constants/vocabularies'
import type { ContainerInfo, ContainerRuntime } from 'src/types/container'
import StatusBadge from 'src/components/StatusBadge.vue'
import HelpTooltip from 'src/components/HelpTooltip.vue'
import DemoCreateContainerDialog from 'src/components/demo/DemoCreateContainerDialog.vue'
import { useDemoContainerState } from 'src/composables/useDemoContainerState'

const appStore = useAppStore()
const $q = useQuasar()
const drawerStore = useResourceDrawerStore()
const demoState = useDemoContainerState()

const showCreate = ref(false)

function openDetail(c: ContainerInfo) {
  drawerStore.openContainer(c.id)
}

function effectiveStatus(c: ContainerInfo) {
  return demoState.getStatus(c.id, c.status)
}

async function handleStart(c: ContainerInfo) {
  await demoState.startContainer(c.id)
  $q.notify({ type: 'positive', message: `Container '${c.name}' started`, position: 'top-right', timeout: 3000 })
}

async function handleStop(c: ContainerInfo) {
  await demoState.stopContainer(c.id)
  $q.notify({ type: 'info', message: `Container '${c.name}' stopped`, position: 'top-right', timeout: 3000 })
}

const allContainers = computed(() => getDemoContainersForTier(appStore.effectiveTier))

const hasApptainer = computed(() =>
  getDemoContainersForTier(TIERS.WEAVER).some(c => c.runtime === 'apptainer')
)

/** Show all containers for weaver+; hide Apptainer for free */
const visibleContainers = computed(() =>
  appStore.isWeaver
    ? allContainers.value
    : allContainers.value.filter(c => c.runtime !== 'apptainer')
)

const runtimeSummary = computed(() => {
  const counts: Partial<Record<ContainerRuntime, number>> = {}
  for (const c of visibleContainers.value) {
    counts[c.runtime] = (counts[c.runtime] ?? 0) + 1
  }
  return (Object.entries(counts) as [ContainerRuntime, number][]).map(([runtime, count]) => ({ runtime, count }))
})

function runtimeIcon(rt: ContainerRuntime): string {
  if (rt === 'docker') return 'mdi-docker'
  if (rt === 'podman') return 'mdi-cow'   // closest Podman-like icon in MDI
  return 'mdi-layers-outline'              // Apptainer / SIF
}

function runtimeColor(rt: ContainerRuntime): string {
  if (rt === 'docker') return 'blue-7'
  if (rt === 'podman') return 'teal-7'
  return 'deep-purple-6'
}
</script>

<style scoped lang="scss">
.container-card {
  transition: box-shadow 0.15s;
  &:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
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

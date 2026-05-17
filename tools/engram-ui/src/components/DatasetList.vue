<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="column full-height q-pa-sm" style="min-width: 200px; max-width: 260px">
    <div class="text-overline text-grey-7 q-mb-xs q-px-xs">Datasets</div>

    <q-btn
      flat dense size="sm"
      icon="mdi-plus"
      label="New dataset"
      color="primary"
      class="q-mb-xs"
      @click="emit('create')"
    />

    <div v-if="loading" class="flex flex-center q-pa-md">
      <q-spinner-dots color="primary" size="24px" />
    </div>

    <div v-else-if="datasets.length === 0" class="text-caption text-grey-6 q-pa-xs">
      No datasets found
    </div>

    <q-scroll-area v-else class="col">
      <template v-for="group in datasetsByMode" :key="group.strategy">
        <!-- Mode section header -->
        <div class="row items-center q-px-xs q-pt-sm q-pb-xxs">
          <q-icon :name="group.meta.icon" size="13px" :color="group.meta.color" class="q-mr-xs" />
          <span class="text-caption text-weight-medium" :style="`color: var(--q-${group.meta.color}, #555)`">
            {{ group.meta.label }}
          </span>
        </div>

        <div
          v-for="ds in group.datasets"
          :key="ds.id"
          class="dataset-item q-pa-xs q-mb-xs"
          :class="{ active: activeDatasetId === ds.id }"
          @click="emit('select', ds.id)"
        >
          <!-- Name -->
          <div class="col overflow-hidden">
            <div class="text-body2 ellipsis">{{ ds.name }}</div>

            <!-- Upgrade state indicator -->
            <div class="text-caption upgrade-state row items-center" :class="upgradeStateClass(ds.name)">
              <q-icon :name="upgradeStateIcon(ds.name)" size="11px" class="q-mr-xxs flex-shrink-0" />
              <span>{{ upgradeStateLabel(ds.name) }}</span>
              <q-btn
                v-if="canUpgrade(ds.name)"
                flat dense round size="xs"
                icon="mdi-arrow-up-circle"
                class="q-ml-xxs upgrade-trigger"
                @click.stop="emit('upgrade', ds.id, ds.name)"
              >
                <q-tooltip>Upgrade strategy</q-tooltip>
              </q-btn>
            </div>
          </div>

          <!-- Delete -->
          <q-btn
            flat dense round size="xs"
            icon="mdi-delete-outline"
            color="grey-5"
            class="delete-btn flex-shrink-0"
            @click.stop="emit('delete', ds.id, ds.name)"
          >
            <q-tooltip>Delete dataset</q-tooltip>
          </q-btn>
        </div>
      </template>
    </q-scroll-area>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Dataset, ProcessingStrategy } from '../composables/useEngram'
import type { UpgradeQueueEntry } from '../composables/useEngramMonitor'

const STRATEGY_META: Record<ProcessingStrategy, { label: string; icon: string; color: string }> = {
  'embed-only':   { label: 'Embed only',   icon: 'mdi-lightning-bolt', color: 'teal'        },
  'embed+graph':  { label: 'Embed + graph', icon: 'mdi-graph-outline',  color: 'blue'        },
  'full-engram':  { label: 'Engram',        icon: 'mdi-memory',          color: 'deep-purple' },
}

const STRATEGY_ORDER: ProcessingStrategy[] = ['embed-only', 'embed+graph', 'full-engram']

const props = defineProps<{
  datasets: Dataset[]
  activeDatasetId: string | null
  loading: boolean
  strategies: Record<string, ProcessingStrategy>
  upgradeQueue: UpgradeQueueEntry[]
}>()

const emit = defineEmits<{
  select: [id: string]
  delete: [id: string, name: string]
  create: []
  upgrade: [id: string, name: string]
}>()

const datasetsByMode = computed(() =>
  STRATEGY_ORDER
    .map((strategy) => ({
      strategy,
      meta: STRATEGY_META[strategy],
      datasets: props.datasets.filter(
        (d) => (props.strategies[d.name] ?? 'full-engram') === strategy,
      ),
    }))
    .filter((group) => group.datasets.length > 0),
)

function strategyMeta(name: string) {
  return STRATEGY_META[props.strategies[name] ?? 'full-engram']
}

function activeJobFor(name: string): UpgradeQueueEntry | null {
  return props.upgradeQueue.find((e) => e.datasetName === name && (e.status === 'running' || e.status === 'queued')) ?? null
}

function upgradeStateLabel(name: string): string {
  const job = activeJobFor(name)
  if (job?.status === 'running') return 'Upgrading…'
  if (job?.status === 'queued')  return 'Queued'
  const strategy = props.strategies[name] ?? 'full-engram'
  const idx = STRATEGY_ORDER.indexOf(strategy)
  if (idx < STRATEGY_ORDER.length - 1) return '↑ Upgrade available'
  return 'Stable'
}

function upgradeStateIcon(name: string): string {
  const job = activeJobFor(name)
  if (job?.status === 'running') return 'mdi-sync'
  if (job?.status === 'queued')  return 'mdi-clock-outline'
  const strategy = props.strategies[name] ?? 'full-engram'
  const idx = STRATEGY_ORDER.indexOf(strategy)
  if (idx < STRATEGY_ORDER.length - 1) return 'mdi-arrow-up-circle-outline'
  return 'mdi-check-circle-outline'
}

function canUpgrade(name: string): boolean {
  const job = activeJobFor(name)
  if (job) return false
  const strategy = props.strategies[name] ?? 'full-engram'
  const idx = STRATEGY_ORDER.indexOf(strategy)
  return idx < STRATEGY_ORDER.length - 1
}

function upgradeStateClass(name: string): string {
  const job = activeJobFor(name)
  if (job?.status === 'running') return 'text-blue-6'
  if (job?.status === 'queued')  return 'text-orange-7'
  const strategy = props.strategies[name] ?? 'full-engram'
  const idx = STRATEGY_ORDER.indexOf(strategy)
  if (idx < STRATEGY_ORDER.length - 1) return 'text-teal-7'
  return 'text-grey-6'
}

defineExpose({ canUpgrade, upgradeStateLabel, upgradeStateIcon, upgradeStateClass, activeJobFor, strategyMeta })
</script>

<style scoped>
.dataset-item {
  display: flex;
  align-items: flex-start;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
}
.dataset-item:hover {
  background: rgba(0, 0, 0, 0.05);
}
.dataset-item.active {
  background: rgba(var(--q-primary-rgb, 33, 150, 243), 0.12);
}
.delete-btn {
  opacity: 0;
  flex-shrink: 0;
  margin-top: 2px;
}
.dataset-item:hover .delete-btn {
  opacity: 1;
}
.upgrade-state {
  line-height: 1.2;
  margin-top: 1px;
  flex-wrap: nowrap;
}
.upgrade-trigger {
  opacity: 0;
  transition: opacity 0.15s;
}
.dataset-item:hover .upgrade-trigger {
  opacity: 1;
}
.flex-shrink-0 {
  flex-shrink: 0;
}
</style>

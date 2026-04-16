<!--
  Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.

  HostListItem — Dense list row for a FabricK fleet host.
  Used in FabrickOverviewPage list view, mirroring VmListItem at the host level.
-->
<template>
  <q-item
    clickable v-ripple
    class="host-list-item"
    :class="{ 'host-list-item--active': active }"
    @click="$emit('click')"
  >
    <!-- Status / kind icon -->
    <q-item-section avatar>
      <q-icon :name="kindIcon" :color="statusColor" size="20px">
        <q-tooltip>{{ host.status }}</q-tooltip>
      </q-icon>
    </q-item-section>

    <!-- Name + meta -->
    <q-item-section>
      <q-item-label class="text-weight-medium row items-center no-wrap q-gutter-xs">
        <span>{{ host.hostname }}</span>
        <q-badge
          v-if="host.kind && host.kind !== 'local'"
          :color="kindColor"
          :label="kindLabel"
          rounded
          style="font-size:0.55rem"
        />
      </q-item-label>
      <q-item-label caption>
        {{ host.role }} · {{ host.ipAddress }} · {{ host.cpuCount }} vCPU · {{ ramGb }} GB RAM
      </q-item-label>
    </q-item-section>

    <!-- Workload counts -->
    <q-item-section side style="min-width: 160px">
      <div class="row items-center q-gutter-xs">
        <span class="text-caption text-positive text-weight-medium">{{ runningCount }}</span>
        <span class="text-caption text-grey-6">/ {{ vmCount }} running</span>
        <span v-if="idleCount > 0" class="text-caption text-grey-6">· {{ idleCount }} idle</span>
      </div>
      <div class="row items-center q-gutter-xs q-mt-xs">
        <q-chip
          v-if="failedCount > 0"
          dense size="xs"
          color="negative" text-color="white"
          icon="mdi-alert-circle"
          class="q-ma-none"
        >{{ failedCount }} failed</q-chip>
        <q-chip
          v-if="stoppedCount > 0"
          dense size="xs"
          color="warning" text-color="dark"
          icon="mdi-alert-circle-outline"
          class="q-ma-none"
        >{{ stoppedCount }} stopped</q-chip>
      </div>
    </q-item-section>

    <!-- Resource grid: 2×2 (CPU/MEM top, DISK/NET bottom) -->
    <q-item-section side style="min-width: 260px">
      <div class="res-grid">
        <div v-for="m in [
          { label: 'CPU',  val: cpuUsage  },
          { label: 'MEM',  val: memUsage  },
          { label: 'DISK', val: diskUsage },
          { label: 'NET',  val: netUsage  },
        ]" :key="m.label" class="res-metric">
          <div class="res-header">
            <span class="res-label">{{ m.label }}</span>
            <span class="res-pct" :class="`text-${metricColor(m.val)}`">{{ m.val }}%</span>
          </div>
          <q-linear-progress
            :value="m.val / 100"
            :color="metricColor(m.val)"
            rounded size="4px"
          />
        </div>
      </div>
    </q-item-section>

    <!-- View action -->
    <q-item-section side>
      <q-btn
        flat dense no-caps size="sm"
        label="View"
        icon-right="mdi-arrow-right"
        color="primary"
        @click.stop="$emit('view')"
      />
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DemoHostInfo } from 'src/config/demo'

const props = defineProps<{
  host: DemoHostInfo
  vmCount: number
  runningCount: number
  idleCount: number
  stoppedCount: number
  failedCount: number
  cpuUsage: number
  memUsage: number
  diskUsage: number
  netUsage: number
  active: boolean
}>()

defineEmits<{
  click: []
  view: []
}>()

const ramGb = computed(() => Math.round(props.host.totalMemMb / 1024))

const statusColor = computed(() => {
  if (props.host.status === 'offline')  return 'negative'
  if (props.host.status === 'degraded') return 'warning'
  return 'positive'
})

const kindIcon = computed(() => {
  if (props.host.kind === 'cloud')  return 'mdi-cloud-outline'
  if (props.host.kind === 'remote') return 'mdi-wan'
  if (props.host.kind === 'iot')    return 'mdi-chip'
  return 'mdi-server'
})

const kindColor = computed(() => {
  if (props.host.kind === 'cloud')  return 'light-blue-7'
  if (props.host.kind === 'remote') return 'amber-8'
  if (props.host.kind === 'iot')    return 'teal-6'
  return 'primary'
})

const kindLabel = computed(() => {
  if (props.host.kind === 'cloud')  return props.host.provider ? `${props.host.provider} · ${props.host.region ?? ''}`.trim().replace(/·\s*$/, '') : 'cloud'
  if (props.host.kind === 'remote') return props.host.region ?? 'remote'
  if (props.host.kind === 'iot')    return props.host.region ?? 'iot'
  return ''
})

function metricColor(pct: number): string {
  if (pct >= 90) return 'negative'
  if (pct >= 70) return 'warning'
  return 'positive'
}
</script>

<style scoped lang="scss">
.res-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 10px;
}

.res-metric-header,
.res-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 2px;
}

.res-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--q-grey-6);
  font-weight: 600;
}

.res-pct {
  font-size: 0.65rem;
  font-weight: 600;
}

.host-list-item {
  border-left: 3px solid transparent;
  transition: border-color 0.15s, background-color 0.15s;

  &--active {
    border-left-color: var(--q-primary);
    background: rgba(25, 118, 210, 0.04);

    .body--dark & {
      background: rgba(25, 118, 210, 0.12);
    }
  }
}

// Kind-specific left accents are applied inline via kindColor computed
</style>

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  Demo-mode VM resource graph. Shows deterministic time-series metrics
  (CPU, memory, disk I/O) as sparkline charts for the private demo v1.1.0 preview.
  Will be replaced by real metric polling when v1.1.0 is implemented.

  Free tier:    60 points × 1-min interval = 1h window
  Solo/FabricK: 60 points shown from 288 × 5-min interval = tail of 24h window
-->
<template>
  <q-card flat bordered class="demo-resource-graph">
    <!-- Header -->
    <q-card-section class="row items-center q-pa-sm q-px-md">
      <q-icon name="mdi-chart-line" size="20px" color="primary" class="q-mr-sm" />
      <span class="text-subtitle2 text-weight-medium">Resource Metrics</span>
      <q-space />
      <q-badge outline color="grey-6" :label="windowLabel" class="q-mr-xs" />
      <q-badge outline color="grey-7" :label="resolutionLabel" />
      <HelpTooltip
        text="CPU and memory over time. Free tier: 1-hour window (1-min resolution). Weaver Solo/FabricK: 24-hour window (5-min resolution)."
        class="q-ml-xs"
      />
    </q-card-section>

    <q-separator />

    <!-- Stopped VM placeholder -->
    <q-card-section v-if="vmStatus !== STATUSES.RUNNING" class="text-center text-grey q-pa-lg">
      <q-icon name="mdi-chart-timeline-variant" size="36px" class="q-mb-xs" />
      <div class="text-caption">Start this VM to see live metrics</div>
    </q-card-section>

    <template v-else>
      <!-- Latest value stats -->
      <q-card-section class="q-pa-sm q-px-md q-pb-xs">
        <div class="row q-gutter-sm">
          <div class="stat-chip">
            <q-icon name="mdi-cpu-64-bit" size="16px" color="primary" />
            <span class="text-body2 text-weight-medium q-ml-xs">{{ latestCpu }}%</span>
            <span class="text-caption text-grey-6 q-ml-xs">CPU</span>
          </div>
          <div class="stat-chip">
            <q-icon name="mdi-memory" size="16px" color="teal" />
            <span class="text-body2 text-weight-medium q-ml-xs">{{ latestMem }} MB</span>
            <span class="text-caption text-grey-6 q-ml-xs">Memory</span>
          </div>
          <div class="stat-chip">
            <q-icon name="mdi-harddisk" size="16px" color="grey-7" />
            <span class="text-body2 text-weight-medium q-ml-xs">↓{{ latestRead }} ↑{{ latestWrite }}</span>
            <span class="text-caption text-grey-6 q-ml-xs">MB/s disk</span>
          </div>
        </div>
      </q-card-section>

      <!-- Sparklines -->
      <q-card-section class="q-pa-sm q-px-md q-pb-md">
        <div class="row q-gutter-md">
          <!-- CPU sparkline -->
          <div class="col">
            <div class="text-caption text-grey-6 q-mb-xs">CPU %</div>
            <svg viewBox="0 0 300 50" preserveAspectRatio="none" style="width:100%;height:50px;display:block">
              <defs>
                <linearGradient id="rg-cpu-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="#1976d2" stop-opacity="0.25"/>
                  <stop offset="100%" stop-color="#1976d2" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <path :d="cpuFillPath" fill="url(#rg-cpu-fill)" />
              <path :d="cpuLinePath" fill="none" stroke="#1976d2" stroke-width="1.5" stroke-linejoin="round" />
            </svg>
          </div>
          <!-- Memory sparkline -->
          <div class="col">
            <div class="text-caption text-grey-6 q-mb-xs">Memory MB</div>
            <svg viewBox="0 0 300 50" preserveAspectRatio="none" style="width:100%;height:50px;display:block">
              <defs>
                <linearGradient id="rg-mem-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="#26a69a" stop-opacity="0.25"/>
                  <stop offset="100%" stop-color="#26a69a" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <path :d="memFillPath" fill="url(#rg-mem-fill)" />
              <path :d="memLinePath" fill="none" stroke="#26a69a" stroke-width="1.5" stroke-linejoin="round" />
            </svg>
          </div>
        </div>
      </q-card-section>
    </template>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from 'src/stores/app'
import { getDemoMetricsForVm } from 'src/config/demo'
import HelpTooltip from 'src/components/HelpTooltip.vue'
import { STATUSES } from 'src/constants/vocabularies'

const props = defineProps<{
  vmName: string
  vmStatus: string
}>()

const appStore = useAppStore()

const metrics = computed(() => getDemoMetricsForVm(props.vmName, appStore.effectiveTier))
const resolutionLabel = computed(() => metrics.value.resolution === '5m' ? '5-min intervals' : '1-min intervals')
const windowLabel = computed(() => metrics.value.resolution === '5m' ? '24h window' : '1h window')

// Cap at 60 points for visual clarity (prevents overcrowded lines on 24h data)
const visiblePoints = computed(() => {
  const pts = metrics.value.points
  return pts.slice(Math.max(0, pts.length - 60))
})

const latest = computed(() => {
  const pts = visiblePoints.value
  return pts[pts.length - 1]
})

const latestCpu = computed(() => latest.value?.cpuPercent.toFixed(1) ?? '—')
const latestMem = computed(() => latest.value?.memoryMb ?? '—')
const latestRead = computed(() => latest.value?.diskReadMbps.toFixed(1) ?? '—')
const latestWrite = computed(() => latest.value?.diskWriteMbps.toFixed(1) ?? '—')

function buildPath(values: number[], width = 300, height = 50, close = false): string {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - 2 - ((v - min) / range) * (height - 6)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const line = `M${coords.join(' L')}`
  if (!close) return line
  return `${line} L${width},${height} L0,${height} Z`
}

const cpuValues = computed(() => visiblePoints.value.map(p => p.cpuPercent))
const memValues = computed(() => visiblePoints.value.map(p => p.memoryMb))
const cpuLinePath = computed(() => buildPath(cpuValues.value))
const cpuFillPath = computed(() => buildPath(cpuValues.value, 300, 50, true))
const memLinePath = computed(() => buildPath(memValues.value))
const memFillPath = computed(() => buildPath(memValues.value, 300, 50, true))
</script>

<style scoped lang="scss">
.stat-chip {
  display: flex;
  align-items: center;
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
}

.body--dark .stat-chip {
  background: rgba(255, 255, 255, 0.06);
}
</style>

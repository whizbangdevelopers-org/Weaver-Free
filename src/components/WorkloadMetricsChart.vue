<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-card flat bordered data-testid="workload-metrics-chart">
    <q-card-section class="row items-center q-pa-sm q-px-md">
      <q-icon name="mdi-chart-line" size="20px" color="primary" class="q-mr-sm" />
      <span class="text-subtitle2 text-weight-medium">Resource Metrics</span>
      <q-space />
      <!-- The window SERVED, not the one requested. A Free request for 24h is clamped to an
           hour, and captioning it "24 hours" would be a claim the user cannot check. -->
      <q-badge outline color="grey-6" :label="windowLabel" data-testid="metrics-window-label" />
      <q-btn
        flat dense round size="sm" icon="mdi-refresh" class="q-ml-xs"
        :loading="loading" aria-label="Refresh metrics"
        @click="() => fetchMetrics()"
      />
    </q-card-section>

    <q-separator />

    <!-- Error -->
    <q-card-section v-if="error" class="text-center text-negative q-pa-lg">
      <q-icon name="mdi-alert-circle" size="32px" class="q-mb-xs" />
      <div class="text-caption">{{ error }}</div>
    </q-card-section>

    <!-- Nothing collected yet. Distinct from "collected, but unmeasurable" below: this is the
         first-30-seconds state and it resolves on its own. -->
    <q-card-section v-else-if="samples.length === 0" class="text-center text-grey-8 q-pa-lg" data-testid="metrics-empty">
      <q-icon name="mdi-chart-timeline-variant" size="36px" class="q-mb-xs" />
      <div class="text-caption">
        {{ loading ? 'Loading metrics…' : 'No metrics collected yet — samples are taken every 30 seconds.' }}
      </div>
    </q-card-section>

    <!-- Samples exist but none carries a reading: a stopped workload has no cgroup to read.
         Saying so beats an empty chart, which is indistinguishable from a stuck loading state. -->
    <q-card-section v-else-if="hasNoReadings" class="text-center text-grey-8 q-pa-lg" data-testid="metrics-no-readings">
      <q-icon name="mdi-sleep" size="36px" class="q-mb-xs" />
      <div class="text-caption">No readings in this window — the workload was not running.</div>
    </q-card-section>

    <template v-else>
      <q-card-section class="q-pa-sm q-px-md q-pb-xs">
        <div class="row q-gutter-sm">
          <div class="stat-chip">
            <q-icon name="mdi-cpu-64-bit" size="16px" color="primary" />
            <span class="text-body2 text-weight-medium q-ml-xs" data-testid="metrics-latest-cpu">{{ formatPercent(latestCpu) }}</span>
            <span class="text-caption text-grey-6 q-ml-xs">CPU</span>
          </div>
          <div class="stat-chip">
            <q-icon name="mdi-memory" size="16px" color="teal" />
            <span class="text-body2 text-weight-medium q-ml-xs" data-testid="metrics-latest-memory">{{ formatBytes(latestMemory) }}</span>
            <span class="text-caption text-grey-6 q-ml-xs">Memory</span>
          </div>
        </div>
      </q-card-section>

      <q-card-section class="q-pa-sm q-px-md q-pb-md">
        <div class="row q-gutter-md">
          <div class="col">
            <div class="text-caption text-grey-6 q-mb-xs">CPU %</div>
            <svg viewBox="0 0 300 50" preserveAspectRatio="none" class="spark">
              <defs>
                <linearGradient :id="`${uid}-cpu`" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="#1976d2" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="#1976d2" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path :d="cpu.fill" :fill="`url(#${uid}-cpu)`" />
              <path :d="cpu.line" fill="none" stroke="#1976d2" stroke-width="1.5" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="col">
            <div class="text-caption text-grey-6 q-mb-xs">Memory</div>
            <svg viewBox="0 0 300 50" preserveAspectRatio="none" class="spark">
              <defs>
                <linearGradient :id="`${uid}-mem`" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="#26a69a" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="#26a69a" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path :d="memory.fill" :fill="`url(#${uid}-mem)`" />
              <path :d="memory.line" fill="none" stroke="#26a69a" stroke-width="1.5" stroke-linejoin="round" />
            </svg>
          </div>
        </div>
        <div v-if="hasGaps" class="text-caption text-grey-6 q-mt-xs" data-testid="metrics-gap-note">
          Breaks in a line are periods with no reading, not zero usage.
        </div>
      </q-card-section>
    </template>
  </q-card>
</template>

<script setup lang="ts">
import { computed, onMounted, getCurrentInstance } from 'vue'
import { useWorkloadMetrics } from 'src/composables/useWorkloadMetrics'
import { buildSparkline, latestValue, formatBytes, formatPercent } from 'src/utils/sparkline'

const props = defineProps<{ workloadName: string }>()

const {
  samples, windowMs, loading, error,
  cpuSeries, memorySeries, hasNoReadings,
  fetchMetrics, startPolling,
} = useWorkloadMetrics(() => props.workloadName)

/**
 * Instance-unique prefix for the SVG gradient IDs.
 *
 * SVG ids are DOCUMENT-global, so two of these on one page with hardcoded ids would have the
 * second definition collide with the first — `url(#cpu-fill)` then resolves to whichever the
 * browser saw first, and both charts silently share one gradient. The component this replaced
 * used fixed ids and carried exactly that latent bug; it never surfaced only because a single
 * instance ever rendered at a time.
 */
const uid = `wmc-${getCurrentInstance()?.uid ?? 0}`

// CPU is pinned to 0-100 so two workloads' charts are visually comparable. Memory has no natural
// ceiling here — the cgroup limit is often "max" — so it scales to its own data.
const cpu = computed(() => buildSparkline(cpuSeries.value, { max: 100 }))
const memory = computed(() => buildSparkline(memorySeries.value))

const latestCpu = computed(() => latestValue(cpuSeries.value))
const latestMemory = computed(() => latestValue(memorySeries.value))

/** Any null between two readings — the note below the chart only appears when it is relevant. */
const hasGaps = computed(() => samples.value.some(s => s.cpuPercent === null || s.memoryBytes === null))

const windowLabel = computed(() => {
  const ms = windowMs.value
  if (!ms) return ''
  const hours = ms / 3_600_000
  return hours >= 1 ? `${Math.round(hours)}h window` : `${Math.round(ms / 60_000)}m window`
})

onMounted(() => startPolling())
</script>

<style scoped>
.spark {
  width: 100%;
  height: 50px;
  display: block;
}
.stat-chip {
  display: flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(128, 128, 128, 0.08);
}
</style>

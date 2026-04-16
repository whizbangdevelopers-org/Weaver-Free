<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Fleet Bridge detail panel — renders inside LoomPage when a fleet bridge
  node is clicked in logical view mode.

  Shows bridge config, endpoints with weight sliders, blue/green state,
  cordon operations, and the "replaces" badge showing what K8s component
  this primitive eliminates.

  All state is reactive mock — no backend calls.
-->
<template>
  <div class="fleet-bridge-panel column full-height">

    <!-- Panel header -->
    <div class="row items-center no-wrap q-pa-md q-pb-sm">
      <q-icon name="mdi-lan" size="22px" :color="bridgeColor" class="q-mr-sm" />
      <div class="col">
        <div class="text-h6 ellipsis">{{ bridge.label }}</div>
        <div class="text-caption text-grey-6">Fleet virtual bridge · {{ bridge.overlay.toUpperCase() }}</div>
      </div>
      <q-btn flat round dense icon="mdi-close" @click="$emit('close')" />
    </div>

    <q-separator />

    <!-- Scrollable content -->
    <div class="col scroll q-pa-md">

      <!-- Status + "replaces" badge -->
      <div class="row items-center q-gutter-sm q-mb-md">
        <q-badge :color="healthColor(bridge.health)" :label="bridge.health" />
        <q-badge outline color="deep-purple" :label="`Replaces: ${bridge.replaces}`" />
      </div>

      <!-- Blue/green deployment banner -->
      <q-card v-if="localBlueGreen" flat bordered class="q-mb-md bg-blue-1">
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-mb-xs">
            <q-icon name="mdi-swap-horizontal" size="18px" color="blue-8" class="q-mr-xs" />
            <span class="text-subtitle2 text-blue-9">Blue/Green Deployment</span>
            <q-space />
            <q-badge :color="blueGreenPhaseColor" :label="localBlueGreen.phase" />
          </div>
          <div class="text-caption q-mb-xs">
            <span class="text-weight-medium">Blue:</span> {{ localBlueGreen.blueEndpointId }} ({{ localBlueGreen.blueWeight }}%)
            <span class="q-mx-xs">→</span>
            <span class="text-weight-medium">Green:</span> {{ localBlueGreen.greenEndpointId }} ({{ localBlueGreen.greenWeight }}%)
          </div>
          <div v-if="localBlueGreen.initiatedBy" class="text-caption text-grey-7 q-mb-sm">
            <q-icon name="mdi-robot" size="14px" class="q-mr-xs" />{{ localBlueGreen.initiatedBy }}
          </div>
          <div class="row q-gutter-xs">
            <q-btn
              v-if="localBlueGreen.phase !== 'confirmed' && localBlueGreen.phase !== 'rolled-back'"
              dense unelevated size="sm" color="positive" icon="mdi-check" label="Confirm"
              @click="confirmBlueGreen"
            />
            <q-btn
              v-if="localBlueGreen.phase !== 'confirmed' && localBlueGreen.phase !== 'rolled-back'"
              dense unelevated size="sm" color="negative" icon="mdi-undo" label="Rollback"
              @click="rollbackBlueGreen"
            />
          </div>
        </q-card-section>
      </q-card>

      <!-- Configuration -->
      <q-expansion-item label="Configuration" icon="mdi-cog" default-opened header-class="text-weight-medium">
        <q-card flat bordered>
          <q-list dense separator>
            <q-item>
              <q-item-section><q-item-label caption>Overlay</q-item-label></q-item-section>
              <q-item-section side><q-item-label class="text-weight-medium">{{ bridge.overlay.toUpperCase() }} · {{ bridge.overlaySegment }}</q-item-label></q-item-section>
            </q-item>
            <q-item>
              <q-item-section><q-item-label caption>Subnet</q-item-label></q-item-section>
              <q-item-section side><q-item-label class="text-weight-medium text-mono">{{ bridge.subnet }}</q-item-label></q-item-section>
            </q-item>
            <q-item>
              <q-item-section><q-item-label caption>Workload Group</q-item-label></q-item-section>
              <q-item-section side><q-item-label class="text-weight-medium">{{ bridge.workloadGroupId }}</q-item-label></q-item-section>
            </q-item>
            <q-item>
              <q-item-section><q-item-label caption>Balance Mode</q-item-label></q-item-section>
              <q-item-section side><q-item-label class="text-weight-medium">{{ bridge.policy.balanceMode }}</q-item-label></q-item-section>
            </q-item>
            <q-item>
              <q-item-section><q-item-label caption>Default Weight Rule</q-item-label></q-item-section>
              <q-item-section side><q-item-label class="text-weight-medium">{{ bridge.policy.defaultWeightRule }}</q-item-label></q-item-section>
            </q-item>
            <q-item>
              <q-item-section><q-item-label caption>Health Check Interval</q-item-label></q-item-section>
              <q-item-section side><q-item-label class="text-weight-medium">{{ bridge.policy.healthCheckIntervalSec }}s</q-item-label></q-item-section>
            </q-item>
            <q-item>
              <q-item-section><q-item-label caption>Drain Timeout</q-item-label></q-item-section>
              <q-item-section side><q-item-label class="text-weight-medium">{{ bridge.policy.drainTimeoutSec }}s</q-item-label></q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </q-expansion-item>

      <!-- Workload Selector -->
      <q-expansion-item label="Workload Selector" icon="mdi-filter" header-class="text-weight-medium" class="q-mt-sm">
        <q-card flat bordered>
          <q-list dense separator>
            <q-item>
              <q-item-section><q-item-label caption>Template</q-item-label></q-item-section>
              <q-item-section side><q-item-label class="text-weight-medium">{{ bridge.selector.templateId ?? 'any' }}</q-item-label></q-item-section>
            </q-item>
            <q-item>
              <q-item-section><q-item-label caption>Tags</q-item-label></q-item-section>
              <q-item-section side>
                <div class="row q-gutter-xs">
                  <q-badge v-for="tag in bridge.selector.tags" :key="tag" outline color="grey-7" :label="tag" size="sm" />
                  <span v-if="!bridge.selector.tags.length" class="text-grey-8">any</span>
                </div>
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section><q-item-label caption>GPU Vendor</q-item-label></q-item-section>
              <q-item-section side><q-item-label class="text-weight-medium">{{ bridge.selector.gpuVendor ?? 'any' }}</q-item-label></q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </q-expansion-item>

      <!-- Endpoints -->
      <q-expansion-item label="Endpoints" icon="mdi-server-network" default-opened header-class="text-weight-medium" class="q-mt-sm">
        <q-card flat bordered>
          <q-list dense separator>
            <q-item v-for="ep in localEndpoints" :key="ep.id" class="q-py-sm">
              <q-item-section>
                <q-item-label class="text-weight-medium text-mono" style="font-size: 12px">{{ ep.id }}</q-item-label>
                <q-item-label caption>
                  {{ ep.localBridge }}
                  <q-badge v-if="ep.autoRegistered" outline color="grey-6" label="auto" size="xs" class="q-ml-xs" />
                  <q-badge v-if="ep.gpuVendor" outline color="deep-purple" :label="ep.gpuVendor" size="xs" class="q-ml-xs" />
                </q-item-label>
              </q-item-section>
              <q-item-section side style="min-width: 160px">
                <div class="row items-center no-wrap q-gutter-xs">
                  <q-badge :color="healthColor(ep.health)" :label="ep.health" size="sm" />
                  <q-slider
                    v-model="ep.weight"
                    :min="0" :max="100" :step="5"
                    :disable="ep.health === 'draining'"
                    color="primary"
                    label
                    :label-value="`${ep.weight}%`"
                    style="width: 80px"
                    dense
                  />
                  <q-btn
                    v-if="ep.health !== 'draining'"
                    flat dense round size="xs" icon="mdi-stop-circle-outline" color="warning"
                    @click="cordonEndpoint(ep)"
                  >
                    <q-tooltip>Cordon (drain traffic)</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-else
                    flat dense round size="xs" icon="mdi-play-circle-outline" color="positive"
                    @click="uncordonEndpoint(ep)"
                  >
                    <q-tooltip>Uncordon (restore traffic)</q-tooltip>
                  </q-btn>
                </div>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card>
      </q-expansion-item>

      <!-- API Reference -->
      <q-expansion-item label="API" icon="mdi-api" header-class="text-weight-medium" class="q-mt-sm">
        <q-card flat bordered class="q-pa-sm">
          <div class="text-caption text-grey-7 q-mb-xs">Weight API — one primitive, one endpoint</div>
          <pre class="text-mono bg-grey-2 q-pa-sm rounded-borders" style="font-size: 11px; overflow-x: auto; white-space: pre-wrap">PUT /api/bridges/{{ bridge.name }}/weights
{
  "endpoints": [{{ localEndpoints.map(ep => `\n    { "id": "${ep.id}", "weight": ${ep.weight} }`).join(',') }}
  ]
}</pre>
        </q-card>
      </q-expansion-item>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { DemoFleetBridge, DemoFleetEndpoint, DemoBlueGreenState } from 'src/config/demo'

const props = defineProps<{
  bridge: DemoFleetBridge
}>()

defineEmits<{
  close: []
}>()

// ── Colour helpers ───────────────────────────────────────────────────────────

const BRIDGE_COLORS: Record<string, string> = {
  'fb-production': 'red-9',
  'fb-cicd':       'blue-9',
  'fb-data':       'teal-8',
  'fb-edge':       'amber-8',
}

const bridgeColor = computed(() => BRIDGE_COLORS[props.bridge.name] ?? 'primary')

function healthColor(health: string): string {
  switch (health) {
    case 'healthy':   return 'positive'
    case 'degraded':  return 'warning'
    case 'unhealthy': return 'negative'
    case 'draining':  return 'grey-6'
    default:          return 'grey'
  }
}

// ── Mutable local state (reactive mock — resets when bridge changes) ────────

const localEndpoints = ref<DemoFleetEndpoint[]>([])
const localBlueGreen = ref<DemoBlueGreenState | null>(null)

watch(() => props.bridge, (fb) => {
  // Deep-clone so sliders don't mutate the source data
  localEndpoints.value = fb.endpoints.map(ep => ({ ...ep }))
  localBlueGreen.value = fb.blueGreen ? { ...fb.blueGreen } : null
}, { immediate: true })

// ── Blue/green operations ────────────────────────────────────────────────────

const blueGreenPhaseColor = computed(() => {
  if (!localBlueGreen.value) return 'grey'
  switch (localBlueGreen.value.phase) {
    case 'confirmed':   return 'positive'
    case 'rolled-back': return 'negative'
    case 'health-check': return 'warning'
    default:            return 'blue'
  }
})

function confirmBlueGreen() {
  if (!localBlueGreen.value) return
  localBlueGreen.value.phase = 'confirmed'
  localBlueGreen.value.greenWeight = localBlueGreen.value.blueWeight + localBlueGreen.value.greenWeight
  localBlueGreen.value.blueWeight = 0
  // Update endpoint weights to reflect confirmation
  const blue = localEndpoints.value.find(ep => ep.id === localBlueGreen.value!.blueEndpointId)
  const green = localEndpoints.value.find(ep => ep.id === localBlueGreen.value!.greenEndpointId)
  if (blue) { blue.weight = 0; blue.health = 'draining' }
  if (green) green.weight = localBlueGreen.value.greenWeight
}

function rollbackBlueGreen() {
  if (!localBlueGreen.value) return
  localBlueGreen.value.phase = 'rolled-back'
  localBlueGreen.value.blueWeight = localBlueGreen.value.blueWeight + localBlueGreen.value.greenWeight
  localBlueGreen.value.greenWeight = 0
  // Update endpoint weights to reflect rollback
  const blue = localEndpoints.value.find(ep => ep.id === localBlueGreen.value!.blueEndpointId)
  const green = localEndpoints.value.find(ep => ep.id === localBlueGreen.value!.greenEndpointId)
  if (blue) blue.weight = localBlueGreen.value.blueWeight
  if (green) { green.weight = 0; green.health = 'draining' }
}

// ── Cordon / uncordon ────────────────────────────────────────────────────────

function cordonEndpoint(ep: DemoFleetEndpoint) {
  ep.weight = 0
  ep.health = 'draining'
}

function uncordonEndpoint(ep: DemoFleetEndpoint) {
  ep.weight = 20  // Restore with conservative weight
  ep.health = 'healthy'
}
</script>

<style scoped>
.fleet-bridge-panel {
  min-height: 0;
}
</style>

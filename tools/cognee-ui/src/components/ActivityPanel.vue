<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="column q-pa-md" style="height: 100%">
    <div class="row items-center q-mb-md">
      <div class="text-subtitle1">
        <q-icon name="mdi-timeline-clock" class="q-mr-xs" />
        Activity
      </div>
      <q-space />
      <q-spinner-dots v-if="hasInFlight" color="primary" size="20px" class="q-mr-sm" />
      <q-btn flat dense round icon="mdi-refresh" :loading="loading" @click="emit('refresh')" />
    </div>

    <!-- Empty -->
    <div v-if="!loading && pipelineRuns.length === 0" class="flex flex-center q-pa-xl column items-center text-grey-6">
      <q-icon name="mdi-clock-outline" size="64px" color="grey-4" />
      <div class="text-caption q-mt-sm">No pipeline runs yet — add files or remember something</div>
    </div>

    <!-- Loading initial -->
    <div v-else-if="loading && pipelineRuns.length === 0" class="flex flex-center q-pa-xl">
      <q-spinner-dots color="primary" size="40px" />
    </div>

    <q-scroll-area v-else class="col">
      <q-list separator>
        <q-item
          v-for="run in pipelineRuns"
          :key="run.id"
          class="q-pa-sm run-item"
        >
          <!-- Pipeline type icon -->
          <q-item-section avatar style="min-width: 36px">
            <q-icon
              v-if="isRunning(run)"
              name="mdi-loading"
              :color="run.pipeline_name === 'cognify_pipeline' ? 'primary' : 'grey-6'"
              size="20px"
              class="spin"
            />
            <q-icon
              v-else-if="isCompleted(run)"
              name="mdi-check-circle"
              color="positive"
              size="20px"
            />
            <q-icon
              v-else-if="isErrored(run)"
              name="mdi-alert-circle"
              color="negative"
              size="20px"
            />
            <q-icon
              v-else
              name="mdi-clock-outline"
              color="warning"
              size="20px"
            />
          </q-item-section>

          <!-- Run info -->
          <q-item-section>
            <q-item-label class="text-body2">
              <span class="text-weight-medium">{{ pipelineLabel(run.pipeline_name) }}</span>
              <q-chip
                v-if="run.dataset_name"
                dense
                size="xs"
                color="grey-2"
                text-color="grey-7"
                class="q-ml-xs"
              >
                {{ run.dataset_name }}
              </q-chip>
            </q-item-label>
            <q-item-label caption>
              <span :class="statusColor(run)">{{ statusLabel(run) }}</span>
              <span v-if="run.created_at" class="text-grey-5 q-ml-xs">· {{ timeAgo(run.created_at) }}</span>
            </q-item-label>
          </q-item-section>

          <!-- Cognify action for completed add_pipeline -->
          <q-item-section side v-if="isCompleted(run) && run.pipeline_name === 'add_pipeline'">
            <q-btn
              flat
              dense
              size="sm"
              icon="mdi-brain"
              label="Cognify"
              color="primary"
              @click="emit('cognify', run.dataset_name ?? '', run.dataset_id ?? '')"
            >
              <q-tooltip>Extract knowledge graph from this dataset</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>
    </q-scroll-area>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PipelineRun } from '../composables/useCognee'

const props = defineProps<{
  pipelineRuns: PipelineRun[]
  loading: boolean
}>()

const emit = defineEmits<{
  refresh: []
  cognify: [datasetName: string, datasetId: string]
}>()

const hasInFlight = computed(() =>
  props.pipelineRuns.some(
    (r) =>
      r.status === 'DATASET_PROCESSING_INITIATED' ||
      r.status === 'DATASET_PROCESSING_STARTED',
  ),
)

function isRunning(r: PipelineRun) {
  return (
    r.status === 'DATASET_PROCESSING_INITIATED' ||
    r.status === 'DATASET_PROCESSING_STARTED'
  )
}
function isCompleted(r: PipelineRun) {
  return r.status === 'DATASET_PROCESSING_COMPLETED'
}
function isErrored(r: PipelineRun) {
  return r.status === 'DATASET_PROCESSING_ERRORED'
}

function pipelineLabel(name: string | null): string {
  if (name === 'add_pipeline') return 'Add'
  if (name === 'cognify_pipeline') return 'Cognify'
  return name ?? 'Pipeline'
}

function statusLabel(r: PipelineRun): string {
  switch (r.status) {
    case 'DATASET_PROCESSING_INITIATED': return 'Queued'
    case 'DATASET_PROCESSING_STARTED':   return 'Running…'
    case 'DATASET_PROCESSING_COMPLETED': return 'Completed'
    case 'DATASET_PROCESSING_ERRORED':   return 'Errored'
    default: return r.status ?? 'Unknown'
  }
}

function statusColor(r: PipelineRun): string {
  if (isRunning(r))   return 'text-primary'
  if (isCompleted(r)) return 'text-positive'
  if (isErrored(r))   return 'text-negative'
  return 'text-warning'
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)   return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)   return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}
</script>

<style scoped>
.run-item {
  border-left: 3px solid transparent;
  transition: border-color 0.15s;
}
.run-item:has(.text-primary) {
  border-left-color: #6510f4;
}
.run-item:has(.text-positive) {
  border-left-color: #21ba45;
}
.run-item:has(.text-negative) {
  border-left-color: #c10015;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
.spin {
  animation: spin 1s linear infinite;
}
</style>

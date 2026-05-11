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
          v-for="run in groupedRuns"
          :key="run.id"
          class="q-pa-sm run-item"
        >
          <!-- Pipeline type icon -->
          <q-item-section avatar style="min-width: 36px">
            <q-icon
              v-if="isRunning(run)"
              :name="run.pipeline_name === 'cognify_pipeline' ? 'mdi-brain' : 'mdi-file-upload-outline'"
              :color="run.pipeline_name === 'cognify_pipeline' ? 'primary' : 'teal'"
              size="20px"
              class="spin"
            />
            <q-icon
              v-else-if="isCompleted(run)"
              :name="run.pipeline_name === 'cognify_pipeline' ? 'mdi-brain' : 'mdi-file-check-outline'"
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
              v-else-if="isStale(run)"
              name="mdi-clock-alert-outline"
              color="grey-5"
              size="20px"
            >
              <q-tooltip>Job was interrupted (Engram service restarted)</q-tooltip>
            </q-icon>
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
              <q-chip
                v-if="run.pipeline_name === 'add_pipeline' && run.fileCount > 1"
                dense
                size="xs"
                color="teal-1"
                text-color="teal-8"
                icon="mdi-file-multiple-outline"
                class="q-ml-xs"
              >
                {{ run.fileCount }} files
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
import { STALE_MS, DEFAULT_STALE_MS } from '../composables/useCognee'

interface GroupedRun extends PipelineRun {
  fileCount: number
}

const props = defineProps<{
  pipelineRuns: PipelineRun[]
  loading: boolean
}>()

const emit = defineEmits<{
  refresh: []
  cognify: [datasetName: string, datasetId: string]
}>()

function isStale(r: PipelineRun): boolean {
  if (!r.created_at) return false
  const age = Date.now() - new Date(r.created_at).getTime()
  const threshold = STALE_MS[r.pipeline_name ?? ''] ?? DEFAULT_STALE_MS
  return !isNaN(age) && age >= threshold
}

const hasInFlight = computed(() =>
  props.pipelineRuns.some(
    (r) =>
      (r.status === 'DATASET_PROCESSING_INITIATED' ||
        r.status === 'DATASET_PROCESSING_STARTED') &&
      !isStale(r),
  ),
)

// Cognee emits multiple status-update rows per logical run (INITIATED→STARTED→COMPLETED).
// Step 1: deduplicate by pipeline_run_id, keeping the final/terminal status per logical run.
// Step 2: group deduplicated runs for the same add_pipeline dataset within a 60-second window.
const GROUP_WINDOW_MS = 60 * 1000

// Used in Step 2: for a group of files, surface the most-active status
// (if any file is still running, show the group as running).
const groupRank = (r: PipelineRun): number => {
  if (isRunning(r))   return 4
  if (r.status === 'DATASET_PROCESSING_INITIATED') return 3
  if (isErrored(r))   return 2
  if (isStale(r))     return 1
  return 0
}

// Used in Step 1: for sequential status events on the SAME logical run,
// terminal states win — completed/errored must not be overwritten by running.
const dedupeRank = (r: PipelineRun): number => {
  if (isCompleted(r)) return 3
  if (isErrored(r))   return 2
  if (isRunning(r))   return 1
  return 0
}

const groupedRuns = computed((): GroupedRun[] => {
  // Step 1: deduplicate by pipeline_run_id (null pipeline_run_id = treat as unique)
  const deduped: PipelineRun[] = []
  for (const run of props.pipelineRuns) {
    if (!run.pipeline_run_id) {
      deduped.push(run)
      continue
    }
    const prev = deduped.find((r) => r.pipeline_run_id === run.pipeline_run_id)
    if (prev) {
      if (dedupeRank(run) > dedupeRank(prev)) prev.status = run.status
    } else {
      deduped.push({ ...run })
    }
  }

  // Step 2: group add_pipeline runs by dataset + 60-second window
  const result: GroupedRun[] = []
  for (const run of deduped) {
    if (run.pipeline_name !== 'add_pipeline') {
      result.push({ ...run, fileCount: 1 })
      continue
    }
    const ts = run.created_at ? new Date(run.created_at).getTime() : NaN
    const existing = result.find(
      (g) =>
        g.pipeline_name === 'add_pipeline' &&
        g.dataset_id === run.dataset_id &&
        Math.abs((g.created_at ? new Date(g.created_at).getTime() : NaN) - ts) < GROUP_WINDOW_MS,
    )
    if (existing) {
      existing.fileCount++
      // Surface the most active status; anchor timestamp stays fixed
      if (groupRank(run) > groupRank(existing)) existing.status = run.status
    } else {
      result.push({ ...run, fileCount: 1 })
    }
  }
  return result
})

function isRunning(r: PipelineRun) {
  return (
    (r.status === 'DATASET_PROCESSING_INITIATED' ||
      r.status === 'DATASET_PROCESSING_STARTED') &&
    !isStale(r)
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
  if (isStale(r)) return 'Interrupted'
  const isCognify = r.pipeline_name === 'cognify_pipeline'
  switch (r.status) {
    case 'DATASET_PROCESSING_INITIATED': return isCognify ? 'Graph queued' : 'Upload queued'
    case 'DATASET_PROCESSING_STARTED':   return isCognify ? 'Building graph…' : 'Uploading…'
    case 'DATASET_PROCESSING_COMPLETED': return 'Completed'
    case 'DATASET_PROCESSING_ERRORED':   return 'Errored'
    default: return r.status ?? 'Unknown'
  }
}

function statusColor(r: PipelineRun): string {
  if (isStale(r))     return 'text-grey-5'
  if (isRunning(r))   return 'text-primary'
  if (isCompleted(r)) return 'text-positive'
  if (isErrored(r))   return 'text-negative'
  return 'text-warning'
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = new Date(iso).getTime()
  if (isNaN(ms)) return '—'
  const diff = Date.now() - ms
  if (diff < 0) return 'just now'
  const s = Math.floor(diff / 1000)
  if (s < 60)  return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
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
  animation: spin 2s linear infinite;
}
</style>

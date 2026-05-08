<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="column q-pa-md" style="height: 100%">
    <div class="row items-center q-mb-md">
      <div class="text-subtitle1">
        <q-icon name="mdi-file-multiple-outline" class="q-mr-xs" />
        Files
        <span v-if="activeDatasetName" class="text-grey-6 text-body2 q-ml-xs">
          — {{ activeDatasetName }}
        </span>
      </div>
      <q-space />
      <q-btn flat dense round icon="mdi-refresh" :loading="loading" @click="emit('refresh')" />
    </div>

    <!-- No dataset selected -->
    <div v-if="!activeDatasetId" class="flex flex-center q-pa-xl column items-center text-grey-6">
      <q-icon name="mdi-database-outline" size="64px" color="grey-4" />
      <div class="text-caption q-mt-sm">Select a dataset from the left panel to see its files</div>
    </div>

    <!-- Loading -->
    <div v-else-if="loading && datasetFiles.length === 0" class="flex flex-center q-pa-xl">
      <q-spinner-dots color="primary" size="40px" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="!loading && datasetFiles.length === 0"
      class="flex flex-center q-pa-xl column items-center text-grey-6"
    >
      <q-icon name="mdi-file-outline" size="64px" color="grey-4" />
      <div class="text-caption q-mt-sm">No files in this dataset yet — add files to get started</div>
    </div>

    <q-scroll-area v-else class="col">
      <q-list separator>
        <q-item
          v-for="file in datasetFiles"
          :key="file.id"
          class="q-pa-sm"
        >
          <q-item-section avatar style="min-width: 36px">
            <q-icon :name="fileIcon(file.extension)" size="20px" color="grey-6" />
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-body2 text-weight-medium ellipsis">
              {{ file.name }}
            </q-item-label>
            <q-item-label caption>
              <span class="text-uppercase q-mr-sm">{{ file.extension || '—' }}</span>
              <span class="text-grey-5">· {{ timeAgo(file.created_at) }}</span>
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <q-btn
              flat
              dense
              round
              icon="mdi-delete-outline"
              size="sm"
              color="grey-6"
              @click="onDelete(file)"
            >
              <q-tooltip>Remove file from dataset</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>
    </q-scroll-area>
  </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar'
import type { DataFile } from '../composables/useCognee'

const props = defineProps<{
  datasetFiles: DataFile[]
  activeDatasetId: string | null
  activeDatasetName: string | null
  loading: boolean
}>()

const emit = defineEmits<{
  refresh: []
  delete: [datasetId: string, fileId: string]
}>()

const $q = useQuasar()

function onDelete(file: DataFile) {
  $q.dialog({
    title: 'Remove file',
    message: `Remove "${file.name}" from this dataset? This cannot be undone.`,
    cancel: true,
    persistent: false,
  }).onOk(() => {
    emit('delete', file.dataset_id, file.id)
  })
}

function fileIcon(ext: string): string {
  const map: Record<string, string> = {
    pdf:  'mdi-file-pdf-box',
    md:   'mdi-language-markdown',
    txt:  'mdi-file-document-outline',
    csv:  'mdi-file-delimited-outline',
    py:   'mdi-language-python',
    ts:   'mdi-language-typescript',
    js:   'mdi-language-javascript',
    docx: 'mdi-file-word-box',
    pptx: 'mdi-file-powerpoint-box',
    png:  'mdi-file-image',
    jpg:  'mdi-file-image',
    jpeg: 'mdi-file-image',
    mp3:  'mdi-file-music',
    wav:  'mdi-file-music',
  }
  return map[ext?.toLowerCase() ?? ''] ?? 'mdi-file-outline'
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

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-dialog v-model="open" @hide="reset">
    <q-card style="min-width: 520px; max-width: 680px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="mdi-upload" class="q-mr-xs" />
          Add files
        </div>
        <q-space />
        <q-btn icon="mdi-close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <!-- Drop zone -->
        <div
          class="drop-zone q-mb-md"
          :class="{ 'drop-zone--active': isDragging }"
          @dragenter.prevent="isDragging = true"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
          @click="fileInput?.click()"
        >
          <q-icon name="mdi-file-upload-outline" size="36px" color="grey-5" />
          <div class="text-body2 text-grey-6 q-mt-xs">
            Drop files here or <span class="text-primary" style="cursor:pointer">browse</span>
          </div>
          <div class="text-caption text-grey-5 q-mt-xs">
            PDF, MD, TXT, CSV, PY, TS, JS, DOCX, PPTX, images, audio
          </div>
          <input
            ref="fileInput"
            type="file"
            multiple
            style="display: none"
            @change="onFileInput"
          />
        </div>

        <!-- Selected files -->
        <div v-if="selectedFiles.length > 0" class="q-mb-md">
          <div class="text-overline text-grey-7 q-mb-xs">
            {{ selectedFiles.length }} file{{ selectedFiles.length !== 1 ? 's' : '' }} selected
          </div>
          <q-list dense bordered separator class="rounded-borders">
            <q-item v-for="(f, i) in selectedFiles" :key="i" dense class="q-pa-xs">
              <q-item-section avatar>
                <q-icon :name="fileIcon(f.name)" size="18px" color="grey-6" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-body2 ellipsis">{{ f.name }}</q-item-label>
                <q-item-label caption>{{ formatBytes(f.size) }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn flat dense round icon="mdi-close" size="xs" @click="removeFile(i)" />
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <!-- Dataset selector -->
        <q-select
          v-model="datasetName"
          :options="datasetOptions"
          outlined
          dense
          label="Dataset"
          use-input
          hide-selected
          fill-input
          input-debounce="0"
          class="q-mb-md"
          @filter="filterDatasets"
          @new-value="onNewDataset"
        >
          <template #no-option="{ inputValue }">
            <q-item>
              <q-item-section>
                <div class="text-caption text-grey-6 q-mb-xs">No matching dataset</div>
                <q-btn
                  v-if="inputValue"
                  flat dense no-caps size="sm"
                  color="primary"
                  icon="mdi-database-plus-outline"
                  :label="`Create '${inputValue}'`"
                  @click="emit('create-with-name', inputValue)"
                />
              </q-item-section>
            </q-item>
          </template>
          <template #prepend>
            <q-icon name="mdi-database" size="16px" />
          </template>
        </q-select>

        <!-- Processing intent — derived from dataset, not a user choice -->
        <div v-if="datasetName.trim()" class="intent-block q-mt-sm">
          <div class="text-caption text-grey-6 q-mb-xs">Will process as</div>
          <div class="intent-row">
            <q-icon :name="strategyMeta.icon" :color="strategyMeta.color" size="20px" class="q-mr-sm" />
            <div>
              <div class="text-body2 text-weight-medium" :class="`text-${strategyMeta.color}`">
                {{ strategyMeta.label }}
              </div>
              <div class="text-caption text-grey-6">{{ strategyMeta.caption }}</div>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" v-close-popup />
        <q-btn
          color="primary"
          label="Add files"
          icon="mdi-upload"
          :loading="loading"
          :disable="selectedFiles.length === 0 || !datasetName.trim()"
          @click="onSubmit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Dataset, ProcessingStrategy } from '../composables/useEngram'

const STRATEGY_META: Record<ProcessingStrategy, { label: string; icon: string; color: string; caption: string }> = {
  'embed-only': {
    label: 'Embed only',
    icon: 'mdi-lightning-bolt',
    color: 'teal',
    caption: 'Files upload to Cognee. Embedding handled by the ingest script.',
  },
  'embed+graph': {
    label: 'Embed + graph',
    icon: 'mdi-graph-outline',
    color: 'blue',
    caption: 'Cognee builds vector embeddings and a relationship graph.',
  },
  'full-cognify': {
    label: 'Full cognify',
    icon: 'mdi-brain',
    color: 'deep-purple',
    caption: 'Full entity extraction pipeline. Slowest, richest output.',
  },
}

const props = defineProps<{
  modelValue: boolean
  datasets: Dataset[]
  strategies: Record<string, ProcessingStrategy>
  defaultDataset?: string
  loading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  submit: [files: File[], datasetName: string]
  'create-with-name': [name: string]
}>()

const open = ref(props.modelValue)
const selectedFiles = ref<File[]>([])
const datasetName = ref(props.defaultDataset ?? '')
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const resolvedStrategy = computed<ProcessingStrategy>(
  () => props.strategies[datasetName.value.trim()] ?? 'full-cognify'
)
const strategyMeta = computed(() => STRATEGY_META[resolvedStrategy.value])

// Filtered options for the q-select
const allDatasetNames = computed(() => props.datasets.map((d) => d.name))
const datasetOptions = ref<string[]>([])

watch(() => props.modelValue, (v) => { open.value = v })
watch(open, (v) => emit('update:modelValue', v))
watch(() => props.defaultDataset, (v) => { if (v) datasetName.value = v })
watch(() => props.datasets, () => { datasetOptions.value = allDatasetNames.value }, { immediate: true })

function filterDatasets(val: string, update: (fn: () => void) => void) {
  update(() => {
    const q = val.toLowerCase()
    datasetOptions.value = q
      ? allDatasetNames.value.filter((n) => n.toLowerCase().includes(q))
      : allDatasetNames.value
  })
}

function onNewDataset(val: string, done: (v?: string) => void) {
  // Route new names to the creation flow instead of accepting inline
  if (val.trim()) emit('create-with-name', val.trim())
  done()
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const files = Array.from(e.dataTransfer?.files ?? [])
  addFiles(files)
}

function onFileInput(e: Event) {
  const input = e.target as HTMLInputElement
  addFiles(Array.from(input.files ?? []))
  input.value = ''
}

function addFiles(files: File[]) {
  const existing = new Set(selectedFiles.value.map((f) => f.name))
  selectedFiles.value.push(...files.filter((f) => !existing.has(f.name)))
}

function removeFile(i: number) {
  selectedFiles.value.splice(i, 1)
}

function reset() {
  selectedFiles.value = []
  isDragging.value = false
}

function onSubmit() {
  if (!selectedFiles.value.length || !datasetName.value.trim()) return
  emit('submit', [...selectedFiles.value], datasetName.value.trim())
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    pdf: 'mdi-file-pdf-box',
    md: 'mdi-language-markdown',
    txt: 'mdi-file-document-outline',
    csv: 'mdi-file-delimited-outline',
    py: 'mdi-language-python',
    ts: 'mdi-language-typescript',
    js: 'mdi-language-javascript',
    docx: 'mdi-file-word-box',
    pptx: 'mdi-file-powerpoint-box',
    png: 'mdi-file-image',
    jpg: 'mdi-file-image',
    jpeg: 'mdi-file-image',
    mp3: 'mdi-file-music',
    wav: 'mdi-file-music',
  }
  return map[ext] ?? 'mdi-file-outline'
}
</script>

<style scoped>
.intent-block {
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.02);
}
.intent-row {
  display: flex;
  align-items: flex-start;
}
.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 32px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.drop-zone:hover,
.drop-zone--active {
  border-color: #6510f4;
  background: rgba(101, 16, 244, 0.04);
}
</style>

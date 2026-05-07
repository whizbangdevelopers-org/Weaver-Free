<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-layout view="hHh lpR fFf">
    <!-- Top status bar -->
    <q-header>
      <StatusBar
        :status="status"
        :statusDetail="statusDetail"
        @add="addOpen = true"
        @remember="rememberOpen = true"
        @refresh="onRefresh"
      />
    </q-header>

    <!-- Left dataset panel -->
    <q-drawer v-model="drawerOpen" show-if-above :width="220" bordered>
      <DatasetList
        :datasets="datasets"
        :activeDatasetId="activeDatasetId"
        :loading="datasetsLoading"
        @select="onSelectDataset"
        @refresh="loadDatasets"
      />
    </q-drawer>

    <!-- Main content -->
    <q-page-container>
      <q-page>
        <q-tabs
          v-model="activeTab"
          dense
          align="left"
          class="text-grey-7 bg-grey-1"
          active-color="primary"
          indicator-color="primary"
        >
          <q-tab name="recall"   icon="mdi-magnify"       label="Recall" />
          <q-tab name="graph"    icon="mdi-graph"          label="Graph" />
          <q-tab name="activity" icon="mdi-timeline-clock" label="Activity">
            <q-badge v-if="inFlightCount > 0" color="primary" floating rounded>
              {{ inFlightCount }}
            </q-badge>
          </q-tab>
          <q-tab name="files"    icon="mdi-file-multiple-outline" label="Files" />
          <q-tab name="settings" icon="mdi-cog"            label="Settings" />
          <q-tab name="keys"     icon="mdi-key-variant"    label="API Keys" />
        </q-tabs>

        <q-separator />

        <q-tab-panels v-model="activeTab" animated style="height: calc(100vh - 100px)">
          <q-tab-panel name="recall" class="q-pa-none" style="height: 100%">
            <RecallPanel
              :results="results"
              :loading="recallLoading"
              :error="recallError"
              @search="onSearch"
            />
          </q-tab-panel>

          <q-tab-panel name="graph" class="q-pa-none" style="height: 100%">
            <GraphPanel
              :graphData="graphData"
              :activeDatasetId="activeDatasetId"
              :activeDatasetName="activeDatasetName"
              :loading="graphLoading"
              :error="graphError"
              @load="onLoadGraph"
            />
          </q-tab-panel>

          <q-tab-panel name="activity" class="q-pa-none" style="height: 100%">
            <ActivityPanel
              :pipelineRuns="pipelineRuns"
              :loading="activityLoading"
              @refresh="loadActivity"
              @cognify="onCognifyDataset"
            />
          </q-tab-panel>

          <q-tab-panel name="files" class="q-pa-none" style="height: 100%">
            <DatasetFilesPanel
              :datasetFiles="datasetFiles"
              :activeDatasetId="activeDatasetId"
              :activeDatasetName="activeDatasetName"
              :loading="filesLoading"
              @refresh="onRefreshFiles"
              @delete="onDeleteFile"
            />
          </q-tab-panel>

          <q-tab-panel name="settings" class="q-pa-none" style="height: 100%">
            <SettingsPanel
              :settings="settings"
              :loading="settingsLoading"
              :error="settingsError"
              @save="onSaveSettings"
            />
          </q-tab-panel>

          <q-tab-panel name="keys" class="q-pa-none" style="height: 100%">
            <ApiKeysPanel
              :apiKeys="apiKeys"
              :loading="keysLoading"
              :error="keysError"
              @create="onCreateKey"
              @delete="onDeleteKey"
            />
          </q-tab-panel>
        </q-tab-panels>
      </q-page>
    </q-page-container>

    <!-- Add data dialog -->
    <AddDataDialog
      v-model="addOpen"
      :datasets="datasets"
      :defaultDataset="activeDatasetName ?? undefined"
      :loading="addLoading"
      @submit="onAddData"
    />

    <!-- Remember dialog -->
    <RememberDialog
      v-model="rememberOpen"
      :loading="rememberLoading"
      :defaultDataset="activeDatasetName ?? undefined"
      @submit="onRemember"
    />
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useCognee } from '../composables/useCognee'
import type { Settings, SearchType } from '../composables/useCognee'
import StatusBar from '../components/StatusBar.vue'
import DatasetList from '../components/DatasetList.vue'
import RecallPanel from '../components/RecallPanel.vue'
import RememberDialog from '../components/RememberDialog.vue'
import AddDataDialog from '../components/AddDataDialog.vue'
import GraphPanel from '../components/GraphPanel.vue'
import ActivityPanel from '../components/ActivityPanel.vue'
import SettingsPanel from '../components/SettingsPanel.vue'
import ApiKeysPanel from '../components/ApiKeysPanel.vue'
import DatasetFilesPanel from '../components/DatasetFilesPanel.vue'

const $q = useQuasar()
const {
  status,
  statusDetail,
  datasets,
  activeDatasetId,
  results,
  graphData,
  settings,
  apiKeys,
  pipelineRuns,
  datasetFiles,
  activityLoading,
  filesLoading,
  checkStatus,
  listDatasets,
  recall,
  remember,
  addData,
  cognifyDataset,
  listPipelineRuns,
  startActivityPolling,
  stopActivityPolling,
  listDatasetFiles,
  deleteDatasetFile,
  fetchGraph,
  getSettings,
  saveSettings,
  listApiKeys,
  createApiKey,
  deleteApiKey,
} = useCognee()

const drawerOpen = ref(true)
const activeTab = ref('recall')
const rememberOpen = ref(false)
const addOpen = ref(false)

const datasetsLoading = ref(false)
const recallLoading = ref(false)
const recallError = ref<string | null>(null)
const graphLoading = ref(false)
const graphError = ref<string | null>(null)
const settingsLoading = ref(false)
const settingsError = ref<string | null>(null)
const keysLoading = ref(false)
const keysError = ref<string | null>(null)
const rememberLoading = ref(false)
const addLoading = ref(false)

const activeDatasetName = computed(
  () => datasets.value.find((d) => d.id === activeDatasetId.value)?.name ?? null,
)

const inFlightCount = computed(
  () =>
    pipelineRuns.value.filter(
      (r) =>
        r.status === 'DATASET_PROCESSING_INITIATED' ||
        r.status === 'DATASET_PROCESSING_STARTED',
    ).length,
)

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  await checkStatus()
  await Promise.all([loadDatasets(), loadActivity()])
})

onUnmounted(() => {
  stopActivityPolling()
})

// ── Helpers ──────────────────────────────────────────────────────────────────

async function onRefresh() {
  await checkStatus()
  await loadDatasets()
}

async function loadDatasets() {
  datasetsLoading.value = true
  try { await listDatasets() }
  finally { datasetsLoading.value = false }
}

async function loadActivity() {
  await listPipelineRuns()
  if (inFlightCount.value > 0) startActivityPolling()
}

function onSelectDataset(id: string) {
  activeDatasetId.value = id
}

// ── Recall ───────────────────────────────────────────────────────────────────

async function onSearch(query: string, searchType: SearchType) {
  recallLoading.value = true
  recallError.value = null
  try { await recall(query, searchType) }
  catch (e) { recallError.value = e instanceof Error ? e.message : 'Search failed' }
  finally { recallLoading.value = false }
}

// ── Graph ────────────────────────────────────────────────────────────────────

async function onLoadGraph() {
  if (!activeDatasetId.value) return
  graphLoading.value = true
  graphError.value = null
  try { await fetchGraph(activeDatasetId.value) }
  catch (e) { graphError.value = e instanceof Error ? e.message : 'Graph load failed' }
  finally { graphLoading.value = false }
}

// ── Remember (text → add + cognify, synchronous) ─────────────────────────────

async function onRemember(text: string, datasetName: string) {
  rememberLoading.value = true
  try {
    await remember(text, datasetName)
    rememberOpen.value = false
    $q.notify({ type: 'positive', message: 'Remembered successfully', timeout: 2000 })
    await Promise.all([loadDatasets(), loadActivity()])
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e instanceof Error ? e.message : 'Remember failed',
      timeout: 3000,
    })
  } finally {
    rememberLoading.value = false
  }
}

// ── Add files ────────────────────────────────────────────────────────────────

async function onAddData(files: File[], datasetName: string, cognifyAfter: boolean) {
  addLoading.value = true
  try {
    await addData(files, datasetName)
    const plural = files.length !== 1 ? 's' : ''
    $q.notify({
      type: 'positive',
      message: `Added ${files.length} file${plural} to "${datasetName}"`,
      timeout: 2500,
    })
    addOpen.value = false
    await Promise.all([loadDatasets(), loadActivity()])
    if (cognifyAfter) await onCognifyDataset(datasetName, '')
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e instanceof Error ? e.message : 'Add failed',
      timeout: 3000,
    })
  } finally {
    addLoading.value = false
  }
}

// ── Cognify ──────────────────────────────────────────────────────────────────

async function onCognifyDataset(datasetName: string, datasetId: string) {
  try {
    const byId   = datasetId   ? [datasetId]   : undefined
    const byName = !datasetId && datasetName ? [datasetName] : undefined
    await cognifyDataset(byName, byId, true)
    $q.notify({ type: 'positive', message: `Cognify started for "${datasetName || datasetId}"`, timeout: 2000 })
    activeTab.value = 'activity'
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e instanceof Error ? e.message : 'Cognify failed to start',
      timeout: 3000,
    })
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

async function onSaveSettings(payload: Settings) {
  settingsError.value = null
  try {
    await saveSettings(payload)
    $q.notify({ type: 'positive', message: 'Settings saved', timeout: 2000 })
  } catch (e) {
    settingsError.value = e instanceof Error ? e.message : 'Save failed'
  }
}

// ── API Keys ─────────────────────────────────────────────────────────────────

async function onCreateKey(name: string | undefined) {
  keysError.value = null
  try {
    await createApiKey(name)
    $q.notify({ type: 'positive', message: 'API key created', timeout: 2000 })
  } catch (e) {
    keysError.value = e instanceof Error ? e.message : 'Create failed'
  }
}

async function onDeleteKey(id: string) {
  keysError.value = null
  try {
    await deleteApiKey(id)
    $q.notify({ type: 'positive', message: 'API key deleted', timeout: 2000 })
  } catch (e) {
    keysError.value = e instanceof Error ? e.message : 'Delete failed'
  }
}

// ── Files ─────────────────────────────────────────────────────────────────────

async function onRefreshFiles() {
  if (activeDatasetId.value) await listDatasetFiles(activeDatasetId.value)
}

async function onDeleteFile(datasetId: string, fileId: string) {
  try {
    await deleteDatasetFile(datasetId, fileId)
    $q.notify({ type: 'positive', message: 'File removed', timeout: 2000 })
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e instanceof Error ? e.message : 'Delete failed',
      timeout: 3000,
    })
  }
}

// ── Lazy-load tabs ───────────────────────────────────────────────────────────

watch(activeTab, async (tab) => {
  if (tab === 'files' && activeDatasetId.value) {
    await listDatasetFiles(activeDatasetId.value)
  }
  if (tab === 'settings' && !settings.value) {
    settingsLoading.value = true
    try { await getSettings() }
    finally { settingsLoading.value = false }
  }
  if (tab === 'keys' && apiKeys.value.length === 0) {
    keysLoading.value = true
    try { await listApiKeys() }
    finally { keysLoading.value = false }
  }
})

// Reload files when active dataset changes while on the files tab
watch(activeDatasetId, async (id) => {
  if (activeTab.value === 'files' && id) {
    await listDatasetFiles(id)
  }
})
</script>

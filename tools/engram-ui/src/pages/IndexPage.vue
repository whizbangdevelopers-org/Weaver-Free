<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-layout view="hHh lpR fFf">
    <!-- Top status bar -->
    <q-header>
      <StatusBar
        :status="status"
        :statusDetail="statusDetail"
        :currentUser="currentUser"
        @add="addOpen = true"
        @remember="rememberOpen = true"
        @refresh="onRefresh"
        @login="loginOpen = true"
        @logout="onLogout"
      />
    </q-header>

    <!-- Left dataset panel -->
    <q-drawer v-model="drawerOpen" show-if-above :width="220" bordered>
      <DatasetList
        :datasets="datasets"
        :activeDatasetId="activeDatasetId"
        :loading="datasetsLoading"
        :strategies="strategies"
        :upgradeQueue="upgradeQueue"
        @select="onSelectDataset"
        @refresh="loadDatasets"
        @delete="onDeleteDataset"
        @create="addOpen = true"
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
          <q-tab name="monitor"  icon="mdi-gauge"          label="Monitor" />
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
              :loadingStatus="graphStatus"
              :error="graphError"
              @load="onLoadGraph"
              @cancel="onCancelGraph"
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

          <q-tab-panel name="monitor" class="q-pa-none" style="height: 100%">
            <MonitorPanel />
          </q-tab-panel>
        </q-tab-panels>
      </q-page>
    </q-page-container>

    <!-- Add data dialog -->
    <AddDataDialog
      v-model="addOpen"
      :datasets="datasets"
      :strategies="strategies"
      :defaultDataset="activeDatasetName ?? undefined"
      :loading="addLoading"
      @submit="onAddData"
    />

    <!-- Login dialog -->
    <LoginDialog
      v-model="loginOpen"
      :loading="loginLoading"
      @submit="onLogin"
      @skip="loginOpen = false"
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
import { useCognee, STALE_MS, DEFAULT_STALE_MS } from '../composables/useCognee'
import type { Settings, SearchType, ProcessingStrategy } from '../composables/useCognee'
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
import LoginDialog from '../components/LoginDialog.vue'
import MonitorPanel from '../components/MonitorPanel.vue'
import { useEngramMonitor } from '../composables/useEngramMonitor'

const $q = useQuasar()

const { upgradeQueue, fetchQueue } = useEngramMonitor()

const {
  status,
  statusDetail,
  strategies,
  datasets,
  activeDatasetId,
  results,
  graphData,
  graphStatus,
  settings,
  apiKeys,
  pipelineRuns,
  datasetFiles,
  currentUser,
  activityLoading,
  filesLoading,
  checkStatus,
  fetchCurrentUser,
  login,
  logout,
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
  cancelGraph,
  getSettings,
  saveSettings,
  listApiKeys,
  createApiKey,
  deleteApiKey,
  deleteDataset,
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
const loginOpen = ref(false)
const loginLoading = ref(false)

const activeDatasetName = computed(
  () => datasets.value.find((d) => d.id === activeDatasetId.value)?.name ?? null,
)

function isRunStale(r: { status: string | null; pipeline_name: string | null; created_at: string | null }) {
  if (!r.created_at) return false
  const age = Date.now() - new Date(r.created_at).getTime()
  const threshold = STALE_MS[r.pipeline_name ?? ''] ?? DEFAULT_STALE_MS
  return !isNaN(age) && age >= threshold
}

const inFlightCount = computed(
  () =>
    pipelineRuns.value.filter(
      (r) =>
        (r.status === 'DATASET_PROCESSING_INITIATED' ||
          r.status === 'DATASET_PROCESSING_STARTED') &&
        !isRunStale(r),
    ).length,
)

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([checkStatus(), fetchCurrentUser()])
  await Promise.all([loadDatasets(), loadActivity(), fetchQueue()])
})

onUnmounted(() => {
  stopActivityPolling()
})

// ── Helpers ──────────────────────────────────────────────────────────────────

async function onRefresh() {
  await checkStatus()
  await Promise.all([loadDatasets(), loadActivity()])
  if (activeTab.value === 'files' && activeDatasetId.value) {
    await listDatasetFiles(activeDatasetId.value)
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

async function onLogin(email: string, password: string) {
  loginLoading.value = true
  try {
    await login(email, password)
    loginOpen.value = false
    $q.notify({ type: 'positive', message: `Signed in as ${email}`, timeout: 2000 })
    // Clear cached panel data so tabs re-fetch for the new user
    settings.value = null
    apiKeys.value = []
    graphData.value = null
    datasetFiles.value = []
    await Promise.all([loadDatasets(), loadActivity()])
    if (activeTab.value === 'files' && activeDatasetId.value) {
      await listDatasetFiles(activeDatasetId.value)
    }
    if (activeTab.value === 'settings') {
      settingsLoading.value = true
      try { await getSettings() } finally { settingsLoading.value = false }
    }
    if (activeTab.value === 'keys') {
      keysLoading.value = true
      try { await listApiKeys() } finally { keysLoading.value = false }
    }
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e instanceof Error ? e.message : 'Login failed',
      timeout: 3000,
    })
  } finally {
    loginLoading.value = false
  }
}

async function onLogout() {
  await logout()
  $q.notify({ type: 'info', message: 'Signed out', timeout: 1500 })
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

async function onDeleteDataset(id: string, name: string) {
  $q.dialog({
    title: 'Delete dataset',
    message: `Delete "${name}"? This removes the dataset and its graph nodes from the Engram sidecar. Local knowledge files are not affected.`,
    ok: { label: 'Delete', color: 'negative', flat: true },
    cancel: { label: 'Cancel', flat: true },
  }).onOk(async () => {
    try {
      await deleteDataset(id)
      $q.notify({ type: 'positive', message: `Dataset "${name}" deleted`, timeout: 2000 })
    } catch (e) {
      $q.notify({
        type: 'negative',
        message: e instanceof Error ? e.message : 'Delete failed',
        timeout: 3000,
      })
    }
  })
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

function onCancelGraph() {
  cancelGraph()
  graphLoading.value = false
  graphError.value = null
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

async function onAddData(files: File[], datasetName: string) {
  addLoading.value = true
  const strategy: ProcessingStrategy = strategies.value[datasetName] ?? 'full-cognify'
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
    if (activeTab.value === 'files' && activeDatasetId.value) {
      await listDatasetFiles(activeDatasetId.value)
    }
    if (strategy !== 'embed-only') await onCognifyDataset(datasetName, '')
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
  if (tab === 'files') {
    // Auto-select first dataset if none selected
    if (!activeDatasetId.value && datasets.value.length > 0) {
      activeDatasetId.value = datasets.value[0]!.id
    }
    if (activeDatasetId.value) await listDatasetFiles(activeDatasetId.value)
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

// Reload files when active dataset changes while on the files tab; clear stale recall results
watch(activeDatasetId, async (id) => {
  results.value = []
  recallError.value = null
  if (activeTab.value === 'files' && id) {
    await listDatasetFiles(id)
  }
})
</script>

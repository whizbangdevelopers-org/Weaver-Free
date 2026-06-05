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
        @settings="settingsOpen = true"
        @keys="keysOpen = true"
        @refresh="onRefresh"
        @login="loginOpen = true"
        @logout="onLogout"
        @users="usersOpen = true"
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
        @delete="onDeleteDataset"
        @create="openCreate"
        @upgrade="onUpgradeDataset"
      />
    </q-drawer>

    <!-- Main content -->
    <q-page-container>
      <q-page>
        <!-- Destination selector -->
        <q-tabs
          v-model="activeDest"
          dense
          align="left"
          class="text-grey-7 bg-grey-1"
          active-color="primary"
          indicator-color="primary"
        >
          <q-tab name="knowledge" icon="mdi-book-open-variant" label="Knowledge" />
          <q-tab name="workspace" icon="mdi-folder-cog-outline" label="Workspace">
            <q-badge v-if="inFlightCount > 0" color="primary" floating rounded>
              {{ inFlightCount }}
            </q-badge>
          </q-tab>
          <q-tab name="monitor" icon="mdi-gauge" label="Monitor" />
          <q-tab name="hosts"   icon="mdi-server" label="Infrastructure" />
        </q-tabs>

        <q-separator />

        <!-- Last ingestion run — global, shown once above all destinations -->
        <div class="row items-center q-px-md q-py-xs bg-grey-1 last-run-strip">
          <q-icon name="mdi-database-import" size="14px" color="grey-6" class="q-mr-xs" />
          <span class="text-caption text-grey-7 q-mr-xs">Last run:</span>
          <template v-if="monitorStatus?.lastIngestion">
            <span class="text-caption text-mono q-mr-sm">{{ monitorStatus.lastIngestion.dataset }}</span>
            <span class="text-caption text-grey-6 q-mr-sm">{{ formatRunTs(monitorStatus.lastIngestion.ts) }}</span>
            <span class="text-caption q-mr-xs">
              <span class="text-positive">{{ monitorStatus.lastIngestion.success_count }}</span>
              <span class="text-grey-6">/</span>
              <span :class="monitorStatus.lastIngestion.failure_count > 0 ? 'text-negative' : 'text-grey-6'">
                {{ monitorStatus.lastIngestion.failure_count }}
              </span>
            </span>
            <q-icon
              :name="monitorStatus.lastIngestion.improved ? 'mdi-check-circle' : 'mdi-close-circle'"
              :color="monitorStatus.lastIngestion.improved ? 'positive' : 'grey-5'"
              size="13px"
              class="q-mr-xs"
            />
            <span class="text-caption text-grey-6">{{ (monitorStatus.lastIngestion.duration_ms / 1000).toFixed(1) }}s</span>
          </template>
          <span v-else class="text-caption text-grey-5">none yet</span>
        </div>

        <q-separator />

        <q-tab-panels v-model="activeDest" animated style="height: calc(100vh - 116px)">

          <!-- ── Knowledge (Search + Browse) ─────────────────────────────────── -->
          <q-tab-panel name="knowledge" class="q-pa-none" style="height: 100%; display: flex; flex-direction: column;">
            <q-tabs
              v-model="knowledgeLens"
              dense
              align="left"
              class="text-grey-7 bg-grey-2"
              active-color="primary"
              indicator-color="primary"
            >
              <q-tab name="browse" icon="mdi-bookshelf" label="Browse" />
              <q-tab name="search" icon="mdi-magnify"  label="Search" />
            </q-tabs>
            <q-separator />
            <q-tab-panels v-model="knowledgeLens" animated style="flex: 1; overflow: hidden;">
              <q-tab-panel name="browse" class="q-pa-none" style="height: 100%">
                <RegistryPanel />
              </q-tab-panel>
              <q-tab-panel name="search" class="q-pa-none" style="height: 100%">
                <RecallPanel
                  :results="results"
                  :loading="recallLoading"
                  :error="recallError"
                  :activeDatasetName="activeDatasetName"
                  @search="onSearch"
                />
              </q-tab-panel>
            </q-tab-panels>
          </q-tab-panel>

          <!-- ── Workspace (selected dataset) ────────────────────────────────── -->
          <q-tab-panel name="workspace" class="q-pa-none" style="height: 100%; display: flex; flex-direction: column;">

            <!-- Action bar — ingest files or capture freeform text into the active dataset -->
            <div class="row items-center q-px-sm q-py-xs bg-grey-1">
              <q-btn flat dense icon="mdi-upload" label="Ingest" class="q-mr-xs" @click="addOpen = true" />
              <q-btn flat dense icon="mdi-text-box-plus-outline" label="Capture" @click="rememberOpen = true" />
              <q-space />
              <span v-if="activeDatasetName" class="text-caption text-grey-7">
                <q-icon name="mdi-database-outline" size="14px" class="q-mr-xxs" />{{ activeDatasetName }}
              </span>
            </div>

            <!-- No dataset selected -->
            <div v-if="!activeDatasetId" class="col flex flex-center column text-grey-6">
              <q-icon name="mdi-folder-open-outline" size="64px" color="grey-4" />
              <div class="text-caption q-mt-sm">Select a dataset from the left to work with it</div>
            </div>

            <template v-else>
              <!-- Engram sub-tabs -->
              <q-tabs
                v-model="workspaceTab"
                dense
                align="left"
                class="text-grey-7 bg-grey-2"
                active-color="primary"
                indicator-color="primary"
              >
                <q-tab name="files"    icon="mdi-file-multiple-outline" label="Files" />
                <q-tab name="activity" icon="mdi-timeline-clock"        label="Activity">
                  <q-badge v-if="inFlightCount > 0" color="primary" floating rounded>
                    {{ inFlightCount }}
                  </q-badge>
                </q-tab>
                <q-tab v-if="canGraph" name="graph" icon="mdi-graph-outline" label="Graph" />
              </q-tabs>

              <!-- Produced card for the active dataset -->
              <div class="q-px-sm q-pt-xs">
                <ProducedCard
                  mode="engram"
                  :chunks="engramStats?.pgvector?.chunks ?? 0"
                  :entities="engramStats?.pgvector?.entities ?? 0"
                  :summaries="engramStats?.pgvector?.summaries ?? 0"
                />
              </div>

              <q-separator />

              <q-tab-panels v-model="workspaceTab" animated style="flex: 1; overflow: hidden;">
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

                <q-tab-panel name="activity" class="q-pa-none" style="height: 100%">
                  <ActivityPanel
                    :pipelineRuns="pipelineRuns"
                    :loading="activityLoading"
                    @refresh="loadActivity"
                    @process="onProcessDataset"
                  />
                </q-tab-panel>

                <q-tab-panel v-if="canGraph" name="graph" class="q-pa-none" style="height: 100%">
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
              </q-tab-panels>
            </template>
          </q-tab-panel>

          <!-- ── Monitor (system ops) ─────────────────────────────────────────── -->
          <q-tab-panel name="monitor" class="q-pa-none" style="height: 100%">
            <MonitorPanel />
          </q-tab-panel>

          <!-- ── Infrastructure (Hosts) ──────────────────────────────────────── -->
          <q-tab-panel name="hosts" class="q-pa-none" style="height: 100%">
            <HostsPanel
              :hosts="hosts"
              :loading="hostsLoading"
              :syncing="hostsSyncing"
              :error="hostsError"
              @refresh="fetchHosts"
              @sync="onSyncHosts"
              @create="onCreateHost"
              @update="onUpdateHost"
              @delete="onDeleteHost"
            />
          </q-tab-panel>

        </q-tab-panels>
      </q-page>
    </q-page-container>

    <!-- Settings dialog -->
    <q-dialog v-model="settingsOpen">
      <q-card style="width: 700px; max-width: 95vw;">
        <q-bar class="bg-primary text-white">
          <q-icon name="mdi-cog" />
          <span class="q-ml-sm">Settings</span>
          <q-space />
          <q-btn dense flat round icon="mdi-close" v-close-popup />
        </q-bar>
        <q-card-section style="max-height: 80vh; overflow-y: auto;">
          <SettingsPanel
            :settings="settings"
            :loading="settingsLoading"
            :error="settingsError"
            @save="onSaveSettings"
          />
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- API Keys dialog -->
    <q-dialog v-model="keysOpen">
      <q-card style="width: 700px; max-width: 95vw;">
        <q-bar class="bg-primary text-white">
          <q-icon name="mdi-key-variant" />
          <span class="q-ml-sm">API Keys</span>
          <q-space />
          <q-btn dense flat round icon="mdi-close" v-close-popup />
        </q-bar>
        <q-card-section style="max-height: 80vh; overflow-y: auto;">
          <ApiKeysPanel
            :apiKeys="apiKeys"
            :loading="keysLoading"
            :error="keysError"
            @create="onCreateKey"
            @delete="onDeleteKey"
          />
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Add data dialog -->
    <AddDataDialog
      v-model="addOpen"
      :datasets="datasets"
      :strategies="strategies"
      :defaultDataset="activeDatasetName ?? undefined"
      :loading="addLoading"
      @submit="onAddData"
      @create-with-name="onAddDataCreateWithName"
    />

    <!-- Create dataset dialog -->
    <CreateDatasetDialog
      v-model="createOpen"
      :initialName="createInitialName"
      :initialStrategy="createInitialStrategy"
      :infrastructure="infrastructure"
      :infraLoading="infraLoading"
      :loading="createLoading"
      @submit="onCreateDataset"
    />

    <!-- Upgrade dataset dialog -->
    <UpgradeDatasetDialog
      v-if="upgradeDataset"
      v-model="upgradeOpen"
      :datasetName="upgradeDataset.name"
      :currentStrategy="upgradeDataset.strategy"
      :infrastructure="infrastructure"
      :loading="upgradeLoading"
      @submit="onSubmitUpgrade"
    />

    <!-- Login dialog -->
    <LoginDialog
      v-model="loginOpen"
      :loading="loginLoading"
      @submit="onLogin"
      @skip="loginOpen = false"
    />

    <!-- Add-user dialog (admin only — shown when signed in) -->
    <AddUserDialog
      ref="addUserDialogRef"
      v-model="usersOpen"
      :loading="userLoading"
      @submit="onAddUser"
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
import type { ProcessingStrategy } from '../composables/useEngram'
import { useQuasar } from 'quasar'
import { useEngram, STALE_MS, DEFAULT_STALE_MS } from '../composables/useEngram'
import type { Settings, SearchType, RecallScope } from '../composables/useEngram'
import StatusBar from '../components/StatusBar.vue'
import DatasetList from '../components/DatasetList.vue'
import RecallPanel from '../components/RecallPanel.vue'
import RegistryPanel from '../components/RegistryPanel.vue'
import RememberDialog from '../components/RememberDialog.vue'
import AddDataDialog from '../components/AddDataDialog.vue'
import GraphPanel from '../components/GraphPanel.vue'
import ActivityPanel from '../components/ActivityPanel.vue'
import SettingsPanel from '../components/SettingsPanel.vue'
import ApiKeysPanel from '../components/ApiKeysPanel.vue'
import DatasetFilesPanel from '../components/DatasetFilesPanel.vue'
import LoginDialog from '../components/LoginDialog.vue'
import AddUserDialog from '../components/AddUserDialog.vue'
import MonitorPanel from '../components/MonitorPanel.vue'
import ProducedCard from '../components/ProducedCard.vue'
import CreateDatasetDialog from '../components/CreateDatasetDialog.vue'
import UpgradeDatasetDialog from '../components/UpgradeDatasetDialog.vue'
import HostsPanel from '../components/HostsPanel.vue'
import { useEngramMonitor } from '../composables/useEngramMonitor'
import type { HostInput, HostPatch } from '../composables/useEngramMonitor'


const $q = useQuasar()

const {
  upgradeQueue,
  fetchQueue,
  strategies,
  fetchStrategies,
  infrastructure,
  infraLoading,
  fetchInfrastructure,
  createDatasetConfig,
  enqueueDatasetUpgrade,
  engramStats,
  fetchStats,
  status: monitorStatus,
  fetchStatus: fetchMonitorStatus,
  hosts,
  hostsLoading,
  hostsError,
  fetchHosts,
  createHost,
  updateHost,
  deleteHost,
  syncHostsFromInventory,
} = useEngramMonitor()

const hostsSyncing = ref(false)

const {
  status,
  statusDetail,
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
  addUser,
  listDatasets,
  recall,
  remember,
  addData,
  processDataset,
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
} = useEngram()


const drawerOpen = ref(true)
const activeDest = ref<'knowledge' | 'workspace' | 'monitor' | 'hosts'>('knowledge')
const knowledgeLens = ref<'search' | 'browse'>('browse')
const workspaceTab = ref<'files' | 'activity' | 'graph'>('files')
const settingsOpen = ref(false)
const keysOpen = ref(false)
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
const usersOpen = ref(false)
const userLoading = ref(false)
const addUserDialogRef = ref<InstanceType<typeof AddUserDialog> | null>(null)
const createOpen = ref(false)
const createLoading = ref(false)
const createInitialName = ref<string | undefined>(undefined)
const createInitialStrategy = ref<ProcessingStrategy>('full-engram')

function openCreate() {
  createInitialName.value = undefined
  createInitialStrategy.value = 'full-engram'
  createOpen.value = true
}
const upgradeOpen = ref(false)
const upgradeLoading = ref(false)
const upgradeDataset = ref<{ name: string; strategy: ProcessingStrategy } | null>(null)

const activeDatasetName = computed(
  () => datasets.value.find((d) => d.id === activeDatasetId.value)?.name ?? null,
)

// The active dataset's strategy decides which workspace capabilities are available.
// embed-only datasets have no graph; embed+graph and full-engram do.
const activeStrategy = computed<ProcessingStrategy>(() => {
  const name = activeDatasetName.value
  if (!name) return 'full-engram'
  return strategies.value[name] ?? 'full-engram'
})
const canGraph = computed(() => activeStrategy.value !== 'embed-only')

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
  await Promise.all([loadDatasets(), loadActivity(), fetchQueue(), fetchStrategies(), fetchInfrastructure(), fetchStats(), fetchMonitorStatus()])
})

onUnmounted(() => {
  stopActivityPolling()
})

// ── Helpers ──────────────────────────────────────────────────────────────────

async function onRefresh() {
  await checkStatus()
  await Promise.all([loadDatasets(), loadActivity()])
  if (activeDest.value === 'workspace' && workspaceTab.value === 'files' && activeDatasetId.value) {
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
    settings.value = null
    apiKeys.value = []
    graphData.value = null
    datasetFiles.value = []
    await Promise.all([loadDatasets(), loadActivity()])
    if (activeDest.value === 'workspace' && workspaceTab.value === 'files' && activeDatasetId.value) {
      await listDatasetFiles(activeDatasetId.value)
    }
    if (settingsOpen.value) {
      settingsLoading.value = true
      try { await getSettings() } finally { settingsLoading.value = false }
    }
    if (keysOpen.value) {
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

async function onAddUser(email: string, password: string) {
  userLoading.value = true
  try {
    await addUser(email, password)
    usersOpen.value = false
    $q.notify({ type: 'positive', message: `Added user ${email}`, timeout: 2500 })
  } catch (e) {
    // Keep the dialog open and surface cognee's message (e.g. weak password,
    // already-exists) inline so the admin can correct without retyping.
    addUserDialogRef.value?.setError(e instanceof Error ? e.message : 'Failed to add user')
  } finally {
    userLoading.value = false
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

// ── Recall ───────────────────────────────────────────────────────────────────

async function onSearch(query: string, searchType: SearchType, scope: RecallScope) {
  recallLoading.value = true
  recallError.value = null
  try { await recall(query, searchType, scope) }
  catch (e) { recallError.value = e instanceof Error ? e.message : 'Search failed' }
  finally { recallLoading.value = false }
}

// ── Remember ─────────────────────────────────────────────────────────────────

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
  const strategy = strategies.value[datasetName] ?? 'full-engram'
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
    if (activeDest.value === 'workspace' && workspaceTab.value === 'files' && activeDatasetId.value) {
      await listDatasetFiles(activeDatasetId.value)
    }
    if (strategy !== 'embed-only') await onProcessDataset(datasetName, '')
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

// ── Create dataset ───────────────────────────────────────────────────────────

function onAddDataCreateWithName(name: string) {
  addOpen.value = false
  createInitialName.value = name
  createOpen.value = true
}

async function onCreateDataset(name: string, strategy: ProcessingStrategy) {
  createLoading.value = true
  try {
    await createDatasetConfig(name, strategy)
    createOpen.value = false
    $q.notify({ type: 'positive', message: `Dataset "${name}" created`, timeout: 2000 })
    await Promise.all([loadDatasets(), fetchStrategies()])
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e instanceof Error ? e.message : 'Create failed',
      timeout: 3000,
    })
  } finally {
    createLoading.value = false
  }
}

// ── Upgrade dataset ──────────────────────────────────────────────────────────

function onUpgradeDataset(id: string, name: string) {
  const strategy = strategies.value[name] ?? 'embed-only'
  upgradeDataset.value = { name, strategy }
  upgradeOpen.value = true
  void id
}

async function onSubmitUpgrade(name: string, targetStrategy: ProcessingStrategy, method: string) {
  upgradeLoading.value = true
  try {
    const job = await enqueueDatasetUpgrade(name, targetStrategy, method)
    upgradeOpen.value = false
    const msg = job.status === 'running'
      ? `Upgrade started for "${name}"`
      : `Upgrade queued for "${name}" — will start when services are available`
    $q.notify({ type: 'positive', message: msg, timeout: 3000 })
    await Promise.all([fetchQueue(), fetchStrategies()])
  } catch (e) {
    $q.notify({
      type: 'negative',
      message: e instanceof Error ? e.message : 'Upgrade failed',
      timeout: 3000,
    })
  } finally {
    upgradeLoading.value = false
  }
}

// ── Cognify ──────────────────────────────────────────────────────────────────

async function onProcessDataset(datasetName: string, datasetId: string) {
  try {
    const byId   = datasetId   ? [datasetId]   : undefined
    const byName = !datasetId && datasetName ? [datasetName] : undefined
    await processDataset(byName, byId, true)
    $q.notify({ type: 'positive', message: `Cognify started for "${datasetName || datasetId}"`, timeout: 2000 })
    activeDest.value = 'workspace'
    workspaceTab.value = 'activity'
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

function formatRunTs(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Host handlers ─────────────────────────────────────────────────────────────
async function onCreateHost(input: HostInput) {
  try {
    await createHost(input)
    $q.notify({ type: 'positive', message: `Host "${input.hostname}" added`, timeout: 2000 })
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Create failed', timeout: 3000 })
  }
}

async function onUpdateHost(hostname: string, patch: HostPatch) {
  try {
    await updateHost(hostname, patch)
    $q.notify({ type: 'positive', message: `Host "${hostname}" updated`, timeout: 2000 })
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Update failed', timeout: 3000 })
  }
}

async function onDeleteHost(hostname: string) {
  try {
    await deleteHost(hostname)
    $q.notify({ type: 'positive', message: `Host "${hostname}" deleted`, timeout: 2000 })
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Delete failed', timeout: 3000 })
  }
}

async function onSyncHosts() {
  hostsSyncing.value = true
  try {
    const result = await syncHostsFromInventory()
    await fetchHosts()
    const msg = result.errors.length === 0
      ? `Synced ${result.synced} host${result.synced === 1 ? '' : 's'} from inventory`
      : `Synced ${result.synced}, ${result.errors.length} error(s): ${result.errors[0]}`
    $q.notify({ type: result.errors.length === 0 ? 'positive' : 'warning', message: msg, timeout: 3000 })
  } catch (e) {
    $q.notify({ type: 'negative', message: e instanceof Error ? e.message : 'Sync failed', timeout: 3000 })
  } finally {
    hostsSyncing.value = false
  }
}

// ── Lazy-load + reactivity ─────────────────────────────────────────────────────

watch(activeDest, (dest) => {
  if (dest === 'hosts' && hosts.value.length === 0) void fetchHosts()
})

// embed-only datasets have no graph tab — bounce off it if the dataset changes under us
watch(canGraph, (ok) => {
  if (!ok && workspaceTab.value === 'graph') workspaceTab.value = 'files'
})

watch(workspaceTab, async (tab) => {
  if (tab === 'files' && activeDatasetId.value) await listDatasetFiles(activeDatasetId.value)
})

watch(activeDatasetId, async (id) => {
  results.value = []
  recallError.value = null
  if (activeDest.value === 'workspace' && workspaceTab.value === 'files' && id) {
    await listDatasetFiles(id)
  }
})

watch(activeDatasetName, (name) => {
  void fetchStats(name ?? undefined)
})
</script>

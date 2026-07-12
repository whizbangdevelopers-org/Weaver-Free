<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Engram — the Knowledge Governance & Explainability console (WVR-198).

  Governance-first shell: six flat destinations organised around the governance
  loop (propose → moderate → human-promote) and its observability, NOT the
  Cognee dataset model. There is no Workspace tab, no dataset drawer, no Cognee
  auth — the console talks only to engram-query (pgvector) and the backend engram
  route. See plans/cross-version/ENGRAM-UI-PLAN.md.
-->
<template>
  <q-layout view="hHh lpR fFf">
    <!-- Top status bar — engram-query health + Settings + Refresh -->
    <q-header>
      <StatusBar
        :status="health"
        @settings="settingsOpen = true"
        @refresh="onRefresh"
      />
    </q-header>

    <q-page-container>
      <q-page>
        <!-- Destination selector — the governance loop, flat -->
        <q-tabs
          v-model="activeDest"
          dense
          align="left"
          class="text-grey-7 bg-grey-1"
          active-color="primary"
          indicator-color="primary"
        >
          <q-tab name="browse"  icon="mdi-bookshelf" label="Browse" />
          <q-tab name="search"  icon="mdi-magnify" label="Search" />
          <q-tab name="author"  icon="mdi-text-box-plus-outline" label="Author" />
          <q-tab name="review"  icon="mdi-check-decagram-outline" label="Review" />
          <q-tab name="monitor" icon="mdi-gauge" label="Monitor" />
          <q-tab name="hosts"   icon="mdi-server" label="Infrastructure" />
        </q-tabs>

        <q-separator />

        <q-tab-panels v-model="activeDest" animated style="height: calc(100vh - 86px)">

          <!-- ── Browse (the registry) ───────────────────────────────────────── -->
          <q-tab-panel name="browse" class="q-pa-none" style="height: 100%">
            <RegistryPanel />
          </q-tab-panel>

          <!-- ── Search (semantic recall over pgvector) ──────────────────────── -->
          <q-tab-panel name="search" class="q-pa-none" style="height: 100%">
            <RecallPanel
              :results="results"
              :loading="recallLoading"
              :error="recallError"
              @search="onSearch"
            />
          </q-tab-panel>

          <!-- ── Author (Stage B — create a knowledge proposal) ──────────────── -->
          <q-tab-panel name="author" class="q-pa-none" style="height: 100%">
            <KnowledgeEditorPanel @created="onProposalCreated" />
          </q-tab-panel>

          <!-- ── Review (Stage B — Level-1 human-promote approval queue) ─────── -->
          <q-tab-panel name="review" class="q-pa-none" style="height: 100%">
            <ApprovalQueuePanel ref="approvalQueueRef" />
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

    <!-- Settings dialog — write-token only -->
    <q-dialog v-model="settingsOpen">
      <q-card style="width: 560px; max-width: 95vw;">
        <q-bar class="bg-primary text-white">
          <q-icon name="mdi-cog" />
          <span class="q-ml-sm">Settings</span>
          <q-space />
          <q-btn dense flat round icon="mdi-close" v-close-popup />
        </q-bar>
        <q-card-section style="max-height: 80vh; overflow-y: auto;">
          <SettingsPanel />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import StatusBar from '../components/StatusBar.vue'
import RecallPanel from '../components/RecallPanel.vue'
import RegistryPanel from '../components/RegistryPanel.vue'
import SettingsPanel from '../components/SettingsPanel.vue'
import MonitorPanel from '../components/MonitorPanel.vue'
import HostsPanel from '../components/HostsPanel.vue'
import KnowledgeEditorPanel from '../components/KnowledgeEditorPanel.vue'
import ApprovalQueuePanel from '../components/ApprovalQueuePanel.vue'
import { useEngramMonitor } from '../composables/useEngramMonitor'
import type { HostInput, HostPatch } from '../composables/useEngramMonitor'

const $q = useQuasar()

const {
  health,
  checkHealth,
  results,
  recallLoading,
  recallError,
  searchKnowledge,
  hosts,
  hostsLoading,
  hostsError,
  fetchHosts,
  createHost,
  updateHost,
  deleteHost,
  syncHostsFromInventory,
} = useEngramMonitor()

const activeDest = ref<'browse' | 'search' | 'author' | 'review' | 'monitor' | 'hosts'>('browse')
const settingsOpen = ref(false)
const hostsSyncing = ref(false)
const approvalQueueRef = ref<InstanceType<typeof ApprovalQueuePanel> | null>(null)

// A freshly authored proposal lands in Review — refresh the queue if it's mounted.
function onProposalCreated() {
  void approvalQueueRef.value?.load()
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  void checkHealth()
})

async function onRefresh() {
  await checkHealth()
}

// ── Search ───────────────────────────────────────────────────────────────────

function onSearch(query: string) {
  void searchKnowledge(query)
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

// Infrastructure tab is lazy — load hosts on first visit.
watch(activeDest, (dest) => {
  if (dest === 'hosts' && hosts.value.length === 0) void fetchHosts()
})
</script>

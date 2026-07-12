<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Browse lens of the Knowledge destination — the global registry of ingested
  knowledge (project → domain → type → scope), with a graph view toggle and an
  entry viewer. The registry is dataset-independent (it reads /engram-query/*),
  which is why it lives here at top level rather than inside Monitor or a dataset.
-->
<template>
  <!-- No height:100% here — the Quasar .q-panel.scroll wrapper (from q-tab-panels)
       already owns scrolling. A fixed-height scroll container here + overflow-y:auto
       (which forces overflow-x:auto) broke the layout in graph view / tall content. -->
  <div class="column q-pa-md">
    <div class="row items-center q-mb-sm">
      <div class="text-subtitle1 text-weight-medium">
        <q-icon name="mdi-bookshelf" class="q-mr-xs" />
        Knowledge Registry
      </div>
      <q-space />
      <q-btn-toggle
        v-model="registryView"
        flat dense
        toggle-color="primary"
        :options="[
          { value: 'table', icon: 'mdi-format-list-bulleted' },
          { value: 'graph', icon: 'mdi-graph-outline' },
        ]"
      />
      <q-btn flat dense round icon="mdi-refresh" class="q-ml-sm" :loading="entriesLoading" @click="refresh" />
    </div>

    <q-banner v-if="entriesError" dense rounded class="bg-negative text-white q-mb-sm">{{ entriesError }}</q-banner>
    <q-banner v-if="viewNotify" dense rounded class="bg-negative text-white q-mb-sm" @click="viewNotify = null">
      <template #avatar><q-icon name="mdi-alert-circle" /></template>
      {{ viewNotify }}
    </q-banner>

    <!-- Table view -->
    <q-card v-if="registryView === 'table'" flat bordered class="q-mb-md">
      <q-card-section v-if="entriesLoading && entries.length === 0" class="text-center q-pa-md">
        <q-spinner size="24px" />
      </q-card-section>
      <q-card-section v-else-if="entries.length === 0" class="text-grey-7 text-caption">
        No entries in registry yet — run <span class="text-mono">npm run engram:ingest-knowledge</span>.
      </q-card-section>
      <div v-else class="registry-table">
        <div class="row items-center q-px-sm q-py-xs text-caption text-grey-7 bg-grey-2">
          <div style="width:40px"></div>
          <div class="col">Domain / Type</div>
          <div style="width:130px">Scope</div>
          <div class="text-right" style="width:56px">Count</div>
        </div>
        <q-separator />
        <template v-for="pg in groupedEntries" :key="pg.project">
          <!-- Project header -->
          <div
            class="row items-center q-px-sm q-py-xs bg-blue-grey-1 registry-domain-header"
            @click="toggleDomain(pg.project)"
          >
            <div style="width:40px" class="text-center">
              <q-icon
                :name="expandedDomains.has(pg.project) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                size="16px" color="grey-6"
              />
            </div>
            <div class="col text-caption text-weight-bold">
              <q-badge color="teal" outline :label="pg.project" class="q-mr-xs" />
            </div>
            <div style="width:130px"></div>
            <div class="text-right text-weight-bold text-caption" style="width:56px">{{ pg.total }}</div>
          </div>
          <!-- Domain rows under project -->
          <template v-if="expandedDomains.has(pg.project)">
            <template v-for="group in pg.domains" :key="pg.project + '/' + group.domain">
              <div
                class="row items-center q-px-sm q-py-xs bg-grey-1 registry-domain-header"
                style="padding-left: 32px"
                @click="toggleDomain(pg.project + '/' + group.domain)"
              >
                <div style="width:40px" class="text-center">
                  <q-icon
                    :name="expandedDomains.has(pg.project + '/' + group.domain) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                    size="16px" color="grey-5"
                  />
                </div>
                <div class="col text-mono text-caption text-weight-medium">{{ group.domain }}</div>
                <div style="width:130px"></div>
                <div class="text-right text-weight-bold text-caption" style="width:56px">{{ group.total }}</div>
              </div>
              <template v-if="expandedDomains.has(pg.project + '/' + group.domain)">
                <div
                  v-for="row in group.rows"
                  :key="rowKey(row)"
                  class="row items-center q-px-sm q-py-xs registry-subrow"
                  style="padding-left: 48px"
                >
                  <div style="width:40px" class="text-center">
                    <q-btn
                      flat dense round size="xs" icon="mdi-eye-outline"
                      :loading="viewingRow === rowKey(row)"
                      @click.stop="onViewRow(row)"
                    >
                      <q-tooltip>View entries</q-tooltip>
                    </q-btn>
                  </div>
                  <div class="col">
                    <q-badge :color="row.type === 'lesson' ? 'blue-7' : 'orange-8'" outline :label="row.type" />
                  </div>
                  <div style="width:130px">
                    <q-badge
                      :color="row.scope === 'transferable' ? 'positive' : row.scope === 'transient' ? 'grey-6' : 'primary'"
                      outline :label="row.scope"
                    />
                  </div>
                  <div class="text-right text-weight-medium text-caption" style="width:56px">{{ row.count }}</div>
                </div>
              </template>
            </template>
          </template>
          <q-separator />
        </template>
        <div class="row items-center q-px-sm q-py-xs text-grey-7">
          <div style="width:40px"></div>
          <div class="col text-caption">Total</div>
          <div style="width:130px" class="text-caption text-positive text-weight-medium">{{ transferableTotal }} transferable</div>
          <div class="text-right text-weight-bold text-caption" style="width:56px">{{ entriesTotal }}</div>
        </div>
      </div>
    </q-card>

    <!-- Graph view -->
    <q-card v-else flat bordered class="q-mb-md">
      <q-card-section v-if="graphLoading && !graphData" class="text-center q-pa-md">
        <q-spinner size="24px" />
      </q-card-section>
      <q-card-section v-else class="q-pa-sm">
        <registry-graph
          :nodes="graphData?.nodes ?? []"
          :edges="graphData?.edges ?? []"
        />
      </q-card-section>
    </q-card>
  </div>

  <!-- Entry viewer dialog -->
  <q-dialog v-model="viewDialogOpen" maximized>
    <q-card class="column" style="max-width:100%">
      <q-bar class="bg-grey-9 text-white">
        <span class="text-caption text-weight-medium">{{ viewDialogTitle }}</span>
        <q-space />
        <q-btn dense flat icon="mdi-close" @click="viewDialogOpen = false" />
      </q-bar>
      <q-card-section class="col overflow-auto q-pa-md">
        <pre style="font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;margin:0">{{ viewDialogContent }}</pre>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEngramMonitor } from '../composables/useEngramMonitor'
import type { EngramEntryDomainRow } from '../composables/useEngramMonitor'
import RegistryGraph from './RegistryGraph.vue'

const {
  entries,
  entriesTotal,
  entriesLoading,
  entriesError,
  graphData,
  graphLoading,
  fetchEntries,
  fetchGraphData,
  viewEntries,
} = useEngramMonitor()

const registryView = ref<'table' | 'graph'>('table')

const expandedDomains = ref<Set<string>>(new Set())
function toggleDomain(domain: string) {
  const next = new Set(expandedDomains.value)
  if (next.has(domain)) next.delete(domain)
  else next.add(domain)
  expandedDomains.value = next
}

const groupedEntries = computed(() => {
  // Two-level: project → domain → rows
  const projectMap = new Map<string, Map<string, { domain: string; total: number; rows: EngramEntryDomainRow[] }>>()
  for (const row of entries.value) {
    if (!projectMap.has(row.project)) projectMap.set(row.project, new Map())
    const domainMap = projectMap.get(row.project)!
    if (!domainMap.has(row.domain)) domainMap.set(row.domain, { domain: row.domain, total: 0, rows: [] })
    const g = domainMap.get(row.domain)!
    g.rows.push(row)
    g.total += row.count
  }
  return [...projectMap.entries()].map(([project, domainMap]) => ({
    project,
    total: [...domainMap.values()].reduce((s, g) => s + g.total, 0),
    domains: [...domainMap.values()],
  }))
})

const transferableTotal = computed(() =>
  entries.value.reduce((s, r) => s + (r.scope === 'transferable' ? r.count : 0), 0),
)

const viewingRow = ref<string | null>(null)
const viewNotify = ref<string | null>(null)
const viewDialogOpen = ref(false)
const viewDialogTitle = ref('')
const viewDialogContent = ref('')

function rowKey(row: { project: string; domain: string; type: string; scope: string }): string {
  return `${row.project}|${row.domain}|${row.type}|${row.scope}`
}

async function onViewRow(row: { project: string; domain: string; type: string; scope: string }) {
  const key = rowKey(row)
  if (viewingRow.value === key) return
  viewingRow.value = key
  viewNotify.value = null
  try {
    const res = await viewEntries(row.domain, row.type, row.scope, row.project)
    if (!res.content) {
      viewNotify.value = res.note ?? 'No entries matched'
    } else {
      viewDialogTitle.value = `${row.project} · ${row.domain} · ${row.type} · ${row.scope} (${res.entryCount} entries)`
      viewDialogContent.value = res.content
      viewDialogOpen.value = true
    }
  } catch (err) {
    viewNotify.value = err instanceof Error ? err.message : 'View failed'
  } finally {
    viewingRow.value = null
  }
}

async function refresh() {
  await Promise.all([fetchEntries(), fetchGraphData()])
}

onMounted(refresh)
</script>

<style scoped>
.text-mono {
  font-family: 'Roboto Mono', monospace;
}
.registry-domain-header {
  cursor: pointer;
}
.registry-domain-header:hover {
  background: rgba(0, 0, 0, 0.05);
}
.registry-subrow:hover {
  background: rgba(0, 0, 0, 0.04);
}
</style>

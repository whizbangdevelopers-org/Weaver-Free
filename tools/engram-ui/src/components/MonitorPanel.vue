<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div style="height: 100%; overflow-y: auto;" class="q-pa-md">

    <!-- Header -->
    <div class="row items-center q-mb-md">
      <div class="text-subtitle1 text-weight-medium">
        <q-icon name="mdi-gauge" class="q-mr-xs" />
        Engram Monitor
      </div>
      <q-space />
      <q-btn flat dense icon="mdi-refresh" label="Refresh" :loading="refreshing" @click="onRefreshAll" />
    </div>

    <!-- Error banner -->
    <q-banner v-if="statusError" dense rounded class="bg-negative text-white q-mb-md">
      {{ statusError }}
      <template #action><q-btn flat dense label="Retry" @click="onRefreshAll" /></template>
    </q-banner>

    <!-- Sub-tabs -->
    <q-tabs v-model="monitorTab" align="left" dense class="q-mb-md" active-color="primary" indicator-color="primary">
      <q-tab name="status"    icon="mdi-gauge"                label="Status" />
      <q-tab name="registry"  icon="mdi-bookshelf"            label="Knowledge Registry" />
      <q-tab name="queries"   icon="mdi-format-list-bulleted" label="Query Log" />
      <q-tab name="ingestion" icon="mdi-database-import"      label="Ingestion" />
    </q-tabs>

    <!-- ── Status ─────────────────────────────────────────────────────────── -->
    <q-tab-panels v-model="monitorTab" animated>
      <q-tab-panel name="status" class="q-pa-none">
        <div v-if="statusLoading && !status" class="text-center q-pa-xl">
          <q-spinner size="40px" />
        </div>
        <template v-else-if="status">
          <div class="row q-gutter-md q-mb-md">
            <q-card flat bordered class="col-auto">
              <q-card-section class="q-pa-md">
                <div class="text-caption text-grey-7">DB Status</div>
                <q-badge :color="status.dbExists ? 'positive' : 'grey'" :label="status.dbExists ? 'online' : 'not created'" class="q-mt-xs" />
              </q-card-section>
            </q-card>
            <q-card flat bordered class="col-auto">
              <q-card-section class="q-pa-md">
                <div class="text-caption text-grey-7">DB Size</div>
                <div class="text-body1 q-mt-xs">{{ formatBytes(status.dbSizeBytes) }}</div>
              </q-card-section>
            </q-card>
            <q-card flat bordered class="col-auto">
              <q-card-section class="q-pa-md">
                <div class="text-caption text-grey-7">Total MCP Queries</div>
                <div class="text-body1 q-mt-xs">{{ status.totalQueries.toLocaleString() }}</div>
              </q-card-section>
            </q-card>
          </div>

          <div class="text-subtitle2 q-mb-sm">Last Ingestion Run</div>
          <q-card flat bordered class="q-mb-md">
            <q-card-section v-if="!status.lastIngestion" class="text-grey-7 text-caption">
              No ingestion runs recorded yet.
            </q-card-section>
            <q-card-section v-else>
              <div class="row q-gutter-md flex-wrap">
                <div>
                  <div class="text-caption text-grey-7">Time</div>
                  <div class="text-body2">{{ formatTs(status.lastIngestion.ts) }}</div>
                </div>
                <div>
                  <div class="text-caption text-grey-7">Dataset</div>
                  <div class="text-body2 text-mono">{{ status.lastIngestion.dataset }}</div>
                </div>
                <div>
                  <div class="text-caption text-grey-7">Entries</div>
                  <div class="text-body2">{{ status.lastIngestion.entry_count }}</div>
                </div>
                <div>
                  <div class="text-caption text-grey-7">OK / Fail</div>
                  <div class="text-body2">
                    <span class="text-positive">{{ status.lastIngestion.success_count }}</span>
                    /
                    <span :class="status.lastIngestion.failure_count > 0 ? 'text-negative' : 'text-grey-7'">{{ status.lastIngestion.failure_count }}</span>
                  </div>
                </div>
                <div>
                  <div class="text-caption text-grey-7">Graph</div>
                  <q-icon
                    :name="status.lastIngestion.improved ? 'mdi-check-circle' : 'mdi-close-circle'"
                    :color="status.lastIngestion.improved ? 'positive' : 'grey-5'"
                    size="20px"
                  />
                </div>
                <div>
                  <div class="text-caption text-grey-7">Duration</div>
                  <div class="text-body2">{{ (status.lastIngestion.duration_ms / 1000).toFixed(1) }}s</div>
                </div>
              </div>
            </q-card-section>
          </q-card>

          <div class="text-subtitle2 q-mb-sm">MCP Tool Usage (90-day window)</div>
          <q-card flat bordered>
            <q-card-section v-if="status.queryCountsByTool.length === 0" class="text-grey-7 text-caption">
              No queries recorded yet.
            </q-card-section>
            <q-table
              v-else flat
              :rows="status.queryCountsByTool"
              :columns="toolStatColumns"
              row-key="tool"
              hide-pagination
              :rows-per-page-options="[0]"
            >
              <template #body-cell-tool="props">
                <q-td :props="props"><span class="text-mono text-caption">{{ props.row.tool }}</span></q-td>
              </template>
              <template #body-cell-avg_latency_ms="props">
                <q-td :props="props">{{ Math.round(props.row.avg_latency_ms) }} ms</q-td>
              </template>
              <template #body-cell-last_called="props">
                <q-td :props="props"><span class="text-caption">{{ formatTs(props.row.last_called) }}</span></q-td>
              </template>
            </q-table>
          </q-card>
        </template>
      </q-tab-panel>

      <!-- ── Knowledge Registry ────────────────────────────────────────────── -->
      <q-tab-panel name="registry" class="q-pa-none">
        <div class="row items-center q-mb-sm q-gutter-x-sm">
          <q-chip
            v-if="engramStats"
            dense square size="sm"
            :color="engramStats.strategy === 'full-cognify' ? 'blue-7' : engramStats.strategy === 'embed+graph' ? 'teal-7' : 'amber-8'"
            text-color="white"
            :label="engramStats.strategy"
          />
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
              <div class="col">Type</div>
              <div style="width:130px">Scope</div>
              <div class="text-right" style="width:56px">Count</div>
            </div>
            <q-separator />
            <template v-for="group in groupedEntries" :key="group.domain">
              <div
                class="row items-center q-px-sm q-py-xs bg-grey-1 registry-domain-header"
                @click="toggleDomain(group.domain)"
              >
                <div style="width:40px" class="text-center">
                  <q-icon
                    :name="expandedDomains.has(group.domain) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                    size="16px" color="grey-6"
                  />
                </div>
                <div class="col text-mono text-caption text-weight-medium">{{ group.domain }}</div>
                <div style="width:130px"></div>
                <div class="text-right text-weight-bold text-caption" style="width:56px">{{ group.total }}</div>
              </div>
              <template v-if="expandedDomains.has(group.domain)">
                <div
                  v-for="row in group.rows"
                  :key="rowKey(row)"
                  class="row items-center q-px-sm q-py-xs registry-subrow"
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
              <q-separator />
            </template>
            <div class="row items-center q-px-sm q-py-xs text-grey-7">
              <div style="width:40px"></div>
              <div class="col text-caption">Total</div>
              <div style="width:130px"></div>
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

        <div class="text-caption text-grey-6 q-mt-xs" v-if="engramStats">
          pgvector —
          <span v-if="engramStats.pgvector">
            chunks: {{ engramStats.pgvector.chunks.toLocaleString() }} &middot;
            summaries: {{ engramStats.pgvector.summaries.toLocaleString() }} &middot;
            entities: {{ engramStats.pgvector.entities.toLocaleString() }}
          </span>
          <span v-else>unreachable</span>
        </div>
      </q-tab-panel>

      <!-- ── Query Log ───────────────────────────────────────────────────── -->
      <q-tab-panel name="queries" class="q-pa-none">
        <q-banner v-if="queriesError" dense rounded class="bg-negative text-white q-mb-md">{{ queriesError }}</q-banner>
        <div class="row items-center q-gutter-sm q-mb-md">
          <q-select
            v-model="queryToolFilter"
            dense outlined clearable
            :options="toolOptions"
            label="Tool"
            emit-value map-options
            style="min-width: 220px"
          />
          <q-btn color="primary" dense label="Apply" icon="mdi-filter" @click="fetchQueries(0)" />
        </div>

        <q-table
          flat bordered
          :rows="queries"
          :columns="queryColumns"
          row-key="id"
          :loading="queriesLoading"
          hide-pagination
          :rows-per-page-options="[0]"
        >
          <template #body-cell-ts="props">
            <q-td :props="props"><span class="text-caption">{{ formatTs(props.row.ts) }}</span></q-td>
          </template>
          <template #body-cell-tool="props">
            <q-td :props="props"><q-badge color="blue-7" outline :label="props.row.tool" class="text-mono" /></q-td>
          </template>
          <template #body-cell-params="props">
            <q-td :props="props"><span class="text-mono text-caption">{{ summariseParams(props.row.params) }}</span></q-td>
          </template>
          <template #body-cell-result_count="props">
            <q-td :props="props" class="text-center">{{ props.row.result_count }}</q-td>
          </template>
          <template #body-cell-latency_ms="props">
            <q-td :props="props" class="text-right">{{ props.row.latency_ms }} ms</q-td>
          </template>
          <template #no-data>
            <div class="text-center q-pa-xl full-width">
              <q-icon name="mdi-database-search" size="48px" color="grey-5" />
              <div class="text-body1 q-mt-md text-grey-7">No queries recorded yet</div>
            </div>
          </template>
        </q-table>

        <div class="row items-center justify-between q-mt-sm">
          <div class="text-caption text-grey-7">
            {{ queries.length > 0 ? `${queriesOffset + 1}–${Math.min(queriesOffset + LIMIT, queriesTotal)} of ${queriesTotal}` : '' }}
          </div>
          <div class="row q-gutter-sm">
            <q-btn flat dense icon="mdi-chevron-left" :disable="queriesOffset === 0" @click="fetchQueries(queriesOffset - LIMIT)" />
            <q-btn flat dense icon="mdi-chevron-right" :disable="queriesOffset + LIMIT >= queriesTotal" @click="fetchQueries(queriesOffset + LIMIT)" />
          </div>
        </div>
      </q-tab-panel>

      <!-- ── Ingestion History ──────────────────────────────────────────── -->
      <q-tab-panel name="ingestion" class="q-pa-none">
        <q-banner v-if="runsError" dense rounded class="bg-negative text-white q-mb-md">{{ runsError }}</q-banner>
        <q-table
          flat bordered
          :rows="runs"
          :columns="runColumns"
          row-key="id"
          :loading="runsLoading"
          hide-pagination
          :rows-per-page-options="[0]"
        >
          <template #body-cell-ts="props">
            <q-td :props="props"><span class="text-caption">{{ formatTs(props.row.ts) }}</span></q-td>
          </template>
          <template #body-cell-dataset="props">
            <q-td :props="props"><span class="text-mono text-caption">{{ props.row.dataset }}</span></q-td>
          </template>
          <template #body-cell-counts="props">
            <q-td :props="props">
              <span class="text-positive">{{ props.row.success_count }}</span>
              <span class="text-grey-7"> / </span>
              <span :class="props.row.failure_count > 0 ? 'text-negative' : 'text-grey-7'">{{ props.row.failure_count }}</span>
              <span class="text-grey-7 text-caption"> of {{ props.row.entry_count }}</span>
            </q-td>
          </template>
          <template #body-cell-improved="props">
            <q-td :props="props" class="text-center">
              <q-icon
                :name="props.row.improved ? 'mdi-check-circle' : 'mdi-close-circle'"
                :color="props.row.improved ? 'positive' : 'grey-5'"
                size="18px"
              >
                <q-tooltip>{{ props.row.improved ? 'Graph promotion succeeded' : 'Skipped or failed' }}</q-tooltip>
              </q-icon>
            </q-td>
          </template>
          <template #body-cell-duration_ms="props">
            <q-td :props="props" class="text-right">{{ (props.row.duration_ms / 1000).toFixed(1) }}s</q-td>
          </template>
          <template #body-cell-flags="props">
            <q-td :props="props"><span class="text-mono text-caption">{{ summariseFlags(props.row.flags) }}</span></q-td>
          </template>
          <template #no-data>
            <div class="text-center q-pa-xl full-width">
              <q-icon name="mdi-database-import" size="48px" color="grey-5" />
              <div class="text-body1 q-mt-md text-grey-7">No ingestion runs yet</div>
              <div class="text-caption text-grey-7 q-mt-xs">
                Run <span class="text-mono">npm run engram:ingest-knowledge</span>
              </div>
            </div>
          </template>
        </q-table>

        <div class="row items-center justify-between q-mt-sm">
          <div class="text-caption text-grey-7">
            {{ runs.length > 0 ? `${runsOffset + 1}–${Math.min(runsOffset + LIMIT, runsTotal)} of ${runsTotal}` : '' }}
          </div>
          <div class="row q-gutter-sm">
            <q-btn flat dense icon="mdi-chevron-left" :disable="runsOffset === 0" @click="fetchIngestionHistory(runsOffset - LIMIT)" />
            <q-btn flat dense icon="mdi-chevron-right" :disable="runsOffset + LIMIT >= runsTotal" @click="fetchIngestionHistory(runsOffset + LIMIT)" />
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

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
import { ref, computed, watch } from 'vue'
import type { QTableColumn } from 'quasar'
import { useEngramMonitor } from '../composables/useEngramMonitor'
import type { EngramEntryDomainRow } from '../composables/useEngramMonitor'
import RegistryGraph from './RegistryGraph.vue'

const {
  status,
  statusLoading,
  statusError,
  queries,
  queriesTotal,
  queriesOffset,
  queriesLoading,
  queriesError,
  queryToolFilter,
  runs,
  runsTotal,
  runsOffset,
  runsLoading,
  runsError,
  entries,
  entriesTotal,
  entriesLoading,
  entriesError,
  engramStats,
  graphData,
  graphLoading,
  LIMIT,
  fetchQueries,
  fetchIngestionHistory,
  viewEntries,
  loadAll,
} = useEngramMonitor()

const registryView = ref<'table' | 'graph'>('table')

const viewingRow = ref<string | null>(null)
const viewNotify = ref<string | null>(null)
const viewDialogOpen = ref(false)
const viewDialogTitle = ref('')
const viewDialogContent = ref('')

function rowKey(row: { domain: string; type: string; scope: string }): string {
  return `${row.domain}|${row.type}|${row.scope}`
}

async function onViewRow(row: { domain: string; type: string; scope: string }) {
  const key = rowKey(row)
  if (viewingRow.value === key) return
  viewingRow.value = key
  viewNotify.value = null
  try {
    const res = await viewEntries(row.domain, row.type, row.scope)
    if (!res.content) {
      viewNotify.value = res.note ?? 'No entries matched'
    } else {
      viewDialogTitle.value = `${row.domain} · ${row.type} · ${row.scope} (${res.entryCount} entries)`
      viewDialogContent.value = res.content
      viewDialogOpen.value = true
    }
  } catch (err) {
    viewNotify.value = err instanceof Error ? err.message : 'View failed'
  } finally {
    viewingRow.value = null
  }
}

const monitorTab = ref<'status' | 'registry' | 'queries' | 'ingestion'>('status')
const refreshing = ref(false)

const expandedDomains = ref<Set<string>>(new Set())
function toggleDomain(domain: string) {
  const next = new Set(expandedDomains.value)
  if (next.has(domain)) next.delete(domain)
  else next.add(domain)
  expandedDomains.value = next
}

const groupedEntries = computed(() => {
  const map = new Map<string, { domain: string; total: number; rows: EngramEntryDomainRow[] }>()
  for (const row of entries.value) {
    if (!map.has(row.domain)) map.set(row.domain, { domain: row.domain, total: 0, rows: [] })
    const g = map.get(row.domain)!
    g.rows.push(row)
    g.total += row.count
  }
  return [...map.values()]
})

const toolOptions = computed(() =>
  status.value?.queryCountsByTool.map((s) => ({ label: s.tool, value: s.tool })) ?? [],
)

async function onRefreshAll() {
  refreshing.value = true
  await loadAll()
  refreshing.value = false
}

watch(monitorTab, (t) => {
  if (t === 'queries' && queries.value.length === 0) void fetchQueries(0)
  if (t === 'ingestion' && runs.value.length === 0) void fetchIngestionHistory(0)
})

void loadAll()

function formatTs(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function summariseParams(json: string): string {
  try {
    const obj = JSON.parse(json) as Record<string, unknown>
    const parts = Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    return parts.length ? parts.join(' ') : '—'
  } catch { return json }
}

function summariseFlags(json: string): string {
  try {
    const obj = JSON.parse(json) as Record<string, unknown>
    const active = Object.entries(obj).filter(([, v]) => v).map(([k]) => k)
    return active.length ? active.join(', ') : '—'
  } catch { return json }
}

const toolStatColumns: QTableColumn[] = [
  { name: 'tool',           label: 'Tool',        field: 'tool',           align: 'left'  },
  { name: 'count',          label: 'Calls',       field: 'count',          align: 'right', sortable: true },
  { name: 'avg_latency_ms', label: 'Avg Latency', field: 'avg_latency_ms', align: 'right', sortable: true },
  { name: 'last_called',    label: 'Last Called', field: 'last_called',    align: 'left'  },
]

const queryColumns: QTableColumn[] = [
  { name: 'ts',           label: 'Time',    field: 'ts',           align: 'left',   style: 'width: 170px' },
  { name: 'tool',         label: 'Tool',    field: 'tool',         align: 'left'  },
  { name: 'params',       label: 'Params',  field: 'params',       align: 'left'  },
  { name: 'result_count', label: 'Results', field: 'result_count', align: 'center', style: 'width: 80px' },
  { name: 'latency_ms',   label: 'Latency', field: 'latency_ms',   align: 'right',  style: 'width: 100px' },
]

const runColumns: QTableColumn[] = [
  { name: 'ts',          label: 'Time',      field: 'ts',          align: 'left',  style: 'width: 170px' },
  { name: 'dataset',     label: 'Dataset',   field: 'dataset',     align: 'left'  },
  { name: 'counts',      label: 'OK / Fail', field: 'success_count', align: 'left' },
  { name: 'improved',    label: 'Graph',     field: 'improved',    align: 'center', style: 'width: 72px' },
  { name: 'duration_ms', label: 'Duration',  field: 'duration_ms', align: 'right',  style: 'width: 90px' },
  { name: 'flags',       label: 'Flags',     field: 'flags',       align: 'left'  },
]
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

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page class="q-pa-md">

    <!-- Header -->
    <div class="row items-center q-mb-md">
      <div class="text-h5">
        <q-icon name="mdi-brain" class="q-mr-sm" />
        Engram
      </div>
      <q-space />
      <q-btn flat dense icon="mdi-refresh" label="Refresh" :loading="loading" @click="refreshAll">
        <q-tooltip>Refresh all Engram data</q-tooltip>
      </q-btn>
    </div>

    <!-- Error banner -->
    <q-banner v-if="error" rounded class="bg-negative text-white q-mb-md">
      <template #avatar><q-icon name="mdi-alert" /></template>
      {{ error }}
      <template #action><q-btn flat label="Retry" @click="refreshAll" /></template>
    </q-banner>

    <!-- Tabs -->
    <q-tabs v-model="tab" align="left" class="q-mb-md" dense>
      <q-tab name="status" icon="mdi-gauge" label="Status" />
      <q-tab name="hosts" icon="mdi-server" label="Hosts" />
      <q-tab name="queries" icon="mdi-format-list-bulleted" label="Query Log" />
      <q-tab name="ingestion" icon="mdi-database-import" label="Ingestion History" />
    </q-tabs>

    <!-- ── Status tab ─────────────────────────────────────────────────── -->
    <q-tab-panels v-model="tab" animated>
      <q-tab-panel name="status" class="q-pa-none">
        <div v-if="!status" class="text-center q-pa-xl text-grey-7">
          <q-spinner size="40px" />
        </div>
        <template v-else>
          <!-- DB summary row -->
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

          <!-- Last ingestion -->
          <div class="text-subtitle2 q-mb-sm">Last Ingestion Run</div>
          <q-card flat bordered class="q-mb-md">
            <q-card-section v-if="!status.lastIngestion" class="text-grey-7 text-caption">
              No ingestion runs recorded yet.
            </q-card-section>
            <q-card-section v-else>
              <div class="row q-gutter-md">
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
                  <div class="text-caption text-grey-7">Success / Fail</div>
                  <div class="text-body2">
                    <span class="text-positive">{{ status.lastIngestion.success_count }}</span>
                    /
                    <span :class="status.lastIngestion.failure_count > 0 ? 'text-negative' : 'text-grey-7'">{{ status.lastIngestion.failure_count }}</span>
                  </div>
                </div>
                <div>
                  <div class="text-caption text-grey-7">Graph Promotion</div>
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

          <!-- Query counts per tool -->
          <div class="text-subtitle2 q-mb-sm">MCP Tool Usage (90-day window)</div>
          <q-card flat bordered>
            <q-card-section v-if="status.queryCountsByTool.length === 0" class="text-grey-7 text-caption">
              No queries recorded yet.
            </q-card-section>
            <q-table
              v-else
              flat
              :rows="status.queryCountsByTool"
              :columns="toolStatColumns"
              row-key="tool"
              hide-pagination
              :rows-per-page-options="[0]"
            >
              <template #body-cell-tool="props">
                <q-td :props="props">
                  <span class="text-mono text-caption">{{ props.row.tool }}</span>
                </q-td>
              </template>
              <template #body-cell-avg_latency_ms="props">
                <q-td :props="props">{{ Math.round(props.row.avg_latency_ms) }} ms</q-td>
              </template>
              <template #body-cell-last_called="props">
                <q-td :props="props">
                  <span class="text-caption">{{ formatTs(props.row.last_called) }}</span>
                </q-td>
              </template>
            </q-table>
          </q-card>
        </template>
      </q-tab-panel>

      <!-- ── Hosts tab ─────────────────────────────────────────────────── -->
      <q-tab-panel name="hosts" class="q-pa-none">
        <div v-if="hostsLoading" class="text-center q-pa-xl text-grey-7">
          <q-spinner size="40px" />
        </div>
        <template v-else-if="hosts.length === 0">
          <div class="text-center q-pa-xl">
            <q-icon name="mdi-server-off" size="60px" color="grey-5" />
            <div class="text-h6 q-mt-md text-grey-8">No hosts in registry</div>
            <div class="text-caption text-grey-7 q-mt-sm">
              Run <span class="text-mono">python3 tools/sync_hosts.py</span> in the anvil repo to populate.
            </div>
          </div>
        </template>
        <template v-else>
          <q-table
            flat
            bordered
            :rows="hosts"
            :columns="hostColumns"
            row-key="hostname"
            hide-pagination
            :rows-per-page-options="[0]"
          >
            <template #body-cell-hostname="props">
              <q-td :props="props">
                <span class="text-mono text-weight-medium">{{ props.row.hostname }}</span>
              </q-td>
            </template>
            <template #body-cell-status="props">
              <q-td :props="props">
                <q-badge
                  :color="props.row.status === 'reachable' ? 'positive' : props.row.status === 'unreachable' ? 'warning' : 'grey'"
                  :label="props.row.status"
                />
              </q-td>
            </template>
            <template #body-cell-capacity="props">
              <q-td :props="props">
                <div class="text-caption">
                  {{ props.row.capacity.cpus }}t ·
                  {{ Math.round(props.row.capacity.memory_mb / 1024) }} GB RAM ·
                  {{ props.row.capacity.disk_gb }} GB disk
                </div>
                <div v-if="props.row.capacity.cpu_model" class="text-caption text-grey-7 text-mono" style="font-size:10px">
                  {{ props.row.capacity.cpu_model }}
                </div>
              </q-td>
            </template>
            <template #body-cell-ips="props">
              <q-td :props="props">
                <div v-for="(ip, iface) in props.row.network.ips" :key="iface" class="text-caption text-mono">
                  {{ iface }}={{ ip }}
                </div>
              </q-td>
            </template>
            <template #body-cell-last_probed="props">
              <q-td :props="props">
                <span v-if="props.row.lastProbed" class="text-caption">{{ formatTs(props.row.lastProbed) }}</span>
                <span v-else class="text-caption text-grey-5">—</span>
              </q-td>
            </template>
          </q-table>
        </template>
      </q-tab-panel>

      <!-- ── Query Log tab ──────────────────────────────────────────────── -->
      <q-tab-panel name="queries" class="q-pa-none">
        <!-- Tool filter -->
        <div class="row items-center q-gutter-sm q-mb-md">
          <q-select
            v-model="queryToolFilter"
            dense
            outlined
            :options="toolOptions"
            label="Tool"
            clearable
            style="min-width: 220px"
            emit-value
            map-options
          />
          <q-btn color="primary" dense label="Apply" icon="mdi-filter" @click="fetchQueries(0)" />
        </div>

        <q-table
          flat
          bordered
          :rows="queries"
          :columns="queryColumns"
          row-key="id"
          :loading="queriesLoading"
          hide-pagination
          :rows-per-page-options="[0]"
        >
          <template #body-cell-ts="props">
            <q-td :props="props">
              <span class="text-caption">{{ formatTs(props.row.ts) }}</span>
            </q-td>
          </template>
          <template #body-cell-tool="props">
            <q-td :props="props">
              <q-badge color="blue-7" outline :label="props.row.tool" class="text-mono" />
            </q-td>
          </template>
          <template #body-cell-params="props">
            <q-td :props="props">
              <span class="text-mono text-caption">{{ summariseParams(props.row.params) }}</span>
            </q-td>
          </template>
          <template #body-cell-result_count="props">
            <q-td :props="props" class="text-center">{{ props.row.result_count }}</q-td>
          </template>
          <template #body-cell-latency_ms="props">
            <q-td :props="props" class="text-right">{{ props.row.latency_ms }} ms</q-td>
          </template>
          <template #no-data>
            <div class="text-center q-pa-xl full-width">
              <q-icon name="mdi-database-search" size="60px" color="grey-5" />
              <div class="text-h6 q-mt-md text-grey-8">No queries recorded yet</div>
            </div>
          </template>
        </q-table>

        <!-- Pagination -->
        <div class="row items-center justify-between q-mt-sm">
          <div class="text-caption text-grey-7">
            {{ queriesOffset + 1 }}–{{ Math.min(queriesOffset + LIMIT, queriesTotal) }} of {{ queriesTotal }}
          </div>
          <div class="row items-center q-gutter-sm">
            <q-btn flat dense icon="mdi-chevron-left" :disable="queriesOffset === 0" @click="fetchQueries(queriesOffset - LIMIT)" />
            <q-btn flat dense icon="mdi-chevron-right" :disable="queriesOffset + LIMIT >= queriesTotal" @click="fetchQueries(queriesOffset + LIMIT)" />
          </div>
        </div>
      </q-tab-panel>

      <!-- ── Ingestion History tab ──────────────────────────────────────── -->
      <q-tab-panel name="ingestion" class="q-pa-none">
        <q-table
          flat
          bordered
          :rows="runs"
          :columns="runColumns"
          row-key="id"
          :loading="runsLoading"
          hide-pagination
          :rows-per-page-options="[0]"
        >
          <template #body-cell-ts="props">
            <q-td :props="props">
              <span class="text-caption">{{ formatTs(props.row.ts) }}</span>
            </q-td>
          </template>
          <template #body-cell-dataset="props">
            <q-td :props="props">
              <span class="text-mono text-caption">{{ props.row.dataset }}</span>
            </q-td>
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
                size="20px"
              >
                <q-tooltip>{{ props.row.improved ? 'Graph promotion succeeded' : 'Graph promotion skipped or failed' }}</q-tooltip>
              </q-icon>
            </q-td>
          </template>
          <template #body-cell-duration_ms="props">
            <q-td :props="props" class="text-right">{{ (props.row.duration_ms / 1000).toFixed(1) }}s</q-td>
          </template>
          <template #body-cell-flags="props">
            <q-td :props="props">
              <span class="text-mono text-caption">{{ summariseFlags(props.row.flags) }}</span>
            </q-td>
          </template>
          <template #no-data>
            <div class="text-center q-pa-xl full-width">
              <q-icon name="mdi-database-import" size="60px" color="grey-5" />
              <div class="text-h6 q-mt-md text-grey-8">No ingestion runs recorded yet</div>
              <div class="text-caption text-grey-7 q-mt-sm">Run <span class="text-mono">npm run engram:ingest-knowledge</span></div>
            </div>
          </template>
        </q-table>

        <!-- Pagination -->
        <div class="row items-center justify-between q-mt-sm">
          <div class="text-caption text-grey-7">
            {{ runsOffset + 1 }}–{{ Math.min(runsOffset + LIMIT, runsTotal) }} of {{ runsTotal }}
          </div>
          <div class="row items-center q-gutter-sm">
            <q-btn flat dense icon="mdi-chevron-left" :disable="runsOffset === 0" @click="fetchRuns(runsOffset - LIMIT)" />
            <q-btn flat dense icon="mdi-chevron-right" :disable="runsOffset + LIMIT >= runsTotal" @click="fetchRuns(runsOffset + LIMIT)" />
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { engramApiService } from 'src/services/api'
import type { EngramStatus, EngramQueryRow, EngramIngestionRow, EngramToolStat, EngramHostRecord } from 'src/services/api'
import { extractErrorMessage } from 'src/utils/error'
import { isDemoMode } from 'src/config/demo-mode'
import type { QTableColumn } from 'quasar'

const tab = ref<'status' | 'hosts' | 'queries' | 'ingestion'>('status')
const loading = ref(false)
const error = ref<string | null>(null)

const LIMIT = 50

// ── Status ────────────────────────────────────────────────────────────────────
const status = ref<EngramStatus | null>(null)

async function fetchStatus() {
  try {
    status.value = await engramApiService.getStatus()
  } catch (err) {
    error.value = extractErrorMessage(err, 'Failed to load Engram status')
  }
}

// ── Hosts ─────────────────────────────────────────────────────────────────────
const hosts = ref<EngramHostRecord[]>([])
const hostsLoading = ref(false)

async function fetchHosts() {
  hostsLoading.value = true
  try {
    const res = await engramApiService.getHosts()
    hosts.value = res.hosts
  } catch (err) {
    error.value = extractErrorMessage(err, 'Failed to load host inventory')
  } finally {
    hostsLoading.value = false
  }
}

// ── Query Log ─────────────────────────────────────────────────────────────────
const queries = ref<EngramQueryRow[]>([])
const queriesTotal = ref(0)
const queriesOffset = ref(0)
const queriesLoading = ref(false)
const queryToolFilter = ref<string | null>(null)

const toolOptions = computed(() =>
  status.value?.queryCountsByTool.map((s: EngramToolStat) => ({ label: s.tool, value: s.tool })) ?? []
)

async function fetchQueries(offset = 0) {
  queriesLoading.value = true
  queriesOffset.value = offset
  try {
    const res = await engramApiService.getQueries({
      tool: queryToolFilter.value ?? undefined,
      limit: LIMIT,
      offset,
    })
    queries.value = res.queries
    queriesTotal.value = res.total
  } catch (err) {
    error.value = extractErrorMessage(err, 'Failed to load query log')
  } finally {
    queriesLoading.value = false
  }
}

// ── Ingestion History ─────────────────────────────────────────────────────────
const runs = ref<EngramIngestionRow[]>([])
const runsTotal = ref(0)
const runsOffset = ref(0)
const runsLoading = ref(false)

async function fetchRuns(offset = 0) {
  runsLoading.value = true
  runsOffset.value = offset
  try {
    const res = await engramApiService.getIngestionHistory({ limit: LIMIT, offset })
    runs.value = res.runs
    runsTotal.value = res.total
  } catch (err) {
    error.value = extractErrorMessage(err, 'Failed to load ingestion history')
  } finally {
    runsLoading.value = false
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
async function refreshAll() {
  loading.value = true
  error.value = null
  await Promise.all([fetchStatus(), fetchHosts(), fetchQueries(0), fetchRuns(0)])
  loading.value = false
}

onMounted(() => { if (!isDemoMode()) void refreshAll() })

// Lazy-load tab data on first visit
watch(tab, (t) => {
  if (t === 'hosts'     && hosts.value.length === 0)   void fetchHosts()
  if (t === 'queries'   && queries.value.length === 0) void fetchQueries(0)
  if (t === 'ingestion' && runs.value.length === 0)    void fetchRuns(0)
})

// ── Formatters ────────────────────────────────────────────────────────────────
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
  } catch {
    return json
  }
}

function summariseFlags(json: string): string {
  try {
    const obj = JSON.parse(json) as Record<string, unknown>
    const active = Object.entries(obj).filter(([, v]) => v).map(([k]) => k)
    return active.length ? active.join(', ') : '—'
  } catch {
    return json
  }
}

// ── Column definitions ────────────────────────────────────────────────────────
const hostColumns: QTableColumn[] = [
  { name: 'hostname',    label: 'Host',       field: 'hostname',    align: 'left'  },
  { name: 'role',        label: 'Role',       field: 'role',        align: 'left'  },
  { name: 'status',      label: 'Status',     field: 'status',      align: 'left'  },
  { name: 'capacity',    label: 'Capacity',   field: 'capacity',    align: 'left'  },
  { name: 'ips',         label: 'IPs',        field: 'network',     align: 'left'  },
  { name: 'last_probed', label: 'Last Probed', field: 'lastProbed', align: 'left'  },
]

const toolStatColumns: QTableColumn[] = [
  { name: 'tool',           label: 'Tool',         field: 'tool',           align: 'left'  },
  { name: 'count',          label: 'Calls',        field: 'count',          align: 'right', sortable: true },
  { name: 'avg_latency_ms', label: 'Avg Latency',  field: 'avg_latency_ms', align: 'right', sortable: true },
  { name: 'last_called',    label: 'Last Called',  field: 'last_called',    align: 'left'  },
]

const queryColumns: QTableColumn[] = [
  { name: 'ts',           label: 'Time',         field: 'ts',           align: 'left',  style: 'width: 180px' },
  { name: 'tool',         label: 'Tool',         field: 'tool',         align: 'left'  },
  { name: 'params',       label: 'Params',       field: 'params',       align: 'left'  },
  { name: 'result_count', label: 'Results',      field: 'result_count', align: 'center', style: 'width: 80px' },
  { name: 'latency_ms',   label: 'Latency',      field: 'latency_ms',   align: 'right',  style: 'width: 100px' },
]

const runColumns: QTableColumn[] = [
  { name: 'ts',          label: 'Time',      field: 'ts',          align: 'left',  style: 'width: 180px' },
  { name: 'dataset',     label: 'Dataset',   field: 'dataset',     align: 'left'  },
  { name: 'counts',      label: 'OK / Fail', field: 'success_count', align: 'left' },
  { name: 'improved',    label: 'Graph',     field: 'improved',    align: 'center', style: 'width: 80px' },
  { name: 'duration_ms', label: 'Duration',  field: 'duration_ms', align: 'right',  style: 'width: 100px' },
  { name: 'flags',       label: 'Flags',     field: 'flags',       align: 'left'  },
]
</script>

<style scoped lang="scss">
.text-mono {
  font-family: 'Roboto Mono', monospace;
}
</style>

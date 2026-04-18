<!--
  Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.

  FabrickOverviewPage — Fleet-level aggregate view (demo v3.0+, FabricK only).

  Shows all managed hosts with health, workload counts, and resource utilization.
  Mirrors the Workbench pattern (summary strip → display bar → grid/list) at the
  host level rather than the workload level.
-->
<template>
  <q-page class="q-pa-md">

    <!-- Display bar: kind filter chips · workload health · sort · view toggle (fleet only) -->
    <div v-if="!appStore.fabrickDrillHostId" class="row items-center q-mb-sm wrap q-gutter-xs">

      <!-- Kind filter chips -->
      <q-chip clickable dense :outline="kindFilter !== 'all'" color="grey-7"
        :text-color="kindFilter === 'all' ? 'white' : 'grey-7'"
        @click="kindFilter = 'all'"
      >All ({{ DEMO_HOSTS.length }})</q-chip>

      <q-chip clickable dense icon="mdi-server" :outline="kindFilter !== 'local'" color="primary"
        :text-color="kindFilter === 'local' ? 'white' : 'primary'"
        @click="kindFilter = 'local'"
      >On-Prem ({{ localCount }})</q-chip>

      <q-chip clickable dense icon="mdi-cloud-outline" :outline="kindFilter !== 'cloud'" color="light-blue-7"
        :text-color="kindFilter === 'cloud' ? 'white' : 'light-blue-7'"
        @click="kindFilter = 'cloud'"
      >Cloud ({{ cloudCount }})</q-chip>

      <q-chip clickable dense icon="mdi-wan" :outline="kindFilter !== 'remote'" color="amber-8"
        :text-color="kindFilter === 'remote' ? 'white' : 'amber-8'"
        @click="kindFilter = 'remote'"
      >Remote ({{ remoteCount }})</q-chip>

      <q-chip clickable dense icon="mdi-chip" :outline="kindFilter !== 'iot'" color="teal-6"
        :text-color="kindFilter === 'iot' ? 'white' : 'teal-6'"
        @click="kindFilter = 'iot'"
      >IoT ({{ iotCount }})</q-chip>

      <q-separator vertical inset class="q-mx-xs" />

      <span class="text-caption text-grey-6">{{ totalVms }} workloads</span>

      <q-separator vertical inset class="q-mx-xs" />

      <div class="row items-center no-wrap q-gutter-xs">
        <q-icon name="mdi-check-circle" color="positive" size="14px" />
        <span class="text-caption text-positive text-weight-medium">{{ totalRunning }} running</span>
      </div>
      <q-separator v-if="totalIdle > 0" vertical inset class="q-mx-xs" />
      <div v-if="totalIdle > 0" class="row items-center no-wrap q-gutter-xs">
        <q-icon name="mdi-power-sleep" color="grey-6" size="14px" />
        <span class="text-caption text-grey-6">{{ totalIdle }} idle</span>
      </div>
      <q-chip v-if="totalStopped > 0" dense size="sm" color="warning" text-color="dark" icon="mdi-alert-circle-outline" class="q-ma-none">
        {{ totalStopped }} stopped
      </q-chip>
      <q-chip v-if="totalFailed > 0" dense size="sm" color="negative" text-color="white" icon="mdi-alert-circle" class="q-ma-none">
        {{ totalFailed }} failed
      </q-chip>

      <q-space />

      <!-- Sort -->
      <q-btn-dropdown flat dense icon="mdi-sort" :label="sortLabel" class="q-mr-xs">
        <q-list dense>
          <q-item
            v-for="opt in sortOptions"
            :key="opt.value"
            clickable v-close-popup
            :active="sortPref === opt.value"
            active-class="text-primary"
            @click="sortPref = opt.value"
          >
            <q-item-section avatar><q-icon :name="opt.icon" size="20px" /></q-item-section>
            <q-item-section>{{ opt.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <!-- View toggle -->
      <q-btn-toggle
        v-model="viewMode"
        flat dense toggle-color="primary"
        :options="[{ value: 'grid', slot: 'grid' }, { value: 'list', slot: 'list' }]"
      >
        <template #grid><q-icon name="mdi-view-grid" /><q-tooltip>Grid view</q-tooltip></template>
        <template #list><q-icon name="mdi-view-list" /><q-tooltip>List view</q-tooltip></template>
      </q-btn-toggle>
    </div>

    <!-- Drill-down: workloads for selected host -->
    <template v-if="appStore.fabrickDrillHostId">

      <!-- Host info strip — mirrors HostInfoStrip using Fabrick demo data -->
      <q-card v-if="drillHost" flat bordered class="q-mb-md">
        <q-card-section class="row items-center wrap q-pa-sm q-px-md q-gutter-md">

          <!-- Identity -->
          <div class="row items-center no-wrap q-gutter-sm col-auto">
            <div class="column items-center">
              <div class="text-caption text-grey-8" style="font-size:10px;line-height:1.2">Host</div>
              <q-icon name="mdi-desktop-tower" size="28px" color="teal-7" />
            </div>
            <div>
              <div class="text-weight-bold text-body2">{{ drillHost.hostname }}</div>
              <div class="text-caption text-grey-8 no-wrap">
                {{ drillHost.ipAddress }} &middot;
                <span class="text-positive">KVM</span>
              </div>
            </div>
          </div>

          <q-separator vertical inset />

          <!-- UP -->
          <div class="col-auto">
            <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
              <q-icon name="mdi-clock-outline" size="13px" color="grey-6" />
              <span class="text-caption text-grey-7">UP</span>
            </div>
            <div class="text-caption text-weight-medium text-grey-9 no-wrap">{{ formatDrillUptime(drillHost.uptimeSeconds) }}</div>
          </div>

          <!-- LOAD -->
          <div class="col-auto">
            <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
              <q-icon name="mdi-gauge" size="13px" :color="drillMetricColor(drillLoadPct)" />
              <span class="text-caption text-grey-7">LOAD</span>
            </div>
            <div class="text-caption text-weight-medium no-wrap">
              <span :class="`text-${drillMetricColor(drillLoadPct)}`">{{ drillLoad1 }}</span>
              <span class="text-grey-6"> &middot; </span>
              <span class="text-grey-9">{{ drillLoad5 }} &middot; {{ drillLoad15 }}</span>
            </div>
          </div>

          <!-- CPU -->
          <div class="col" style="min-width:110px">
            <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
              <q-icon name="mdi-chip" size="13px" :color="drillMetricColor(drillResources.cpu)" />
              <span class="text-caption text-grey-7">CPU</span>
              <span class="text-caption text-grey-9">{{ drillHost.cpuCount }} cores</span>
              <span class="text-caption text-weight-medium q-ml-auto">{{ drillResources.cpu }}%</span>
            </div>
            <q-linear-progress :value="drillResources.cpu / 100" :color="drillMetricColor(drillResources.cpu)" rounded size="5px" />
          </div>

          <!-- RAM -->
          <div class="col" style="min-width:110px">
            <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
              <q-icon name="mdi-memory" size="13px" :color="drillMetricColor(drillResources.mem)" />
              <span class="text-caption text-grey-7">RAM</span>
              <span class="text-caption text-grey-9">{{ Math.round(drillHost.totalMemMb / 1024) }} GB</span>
              <span class="text-caption text-weight-medium q-ml-auto">{{ drillResources.mem }}%</span>
            </div>
            <q-linear-progress :value="drillResources.mem / 100" :color="drillMetricColor(drillResources.mem)" rounded size="5px" />
          </div>

          <!-- DISK -->
          <div class="col" style="min-width:110px">
            <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
              <q-icon name="mdi-harddisk" size="13px" :color="drillMetricColor(drillResources.disk)" />
              <span class="text-caption text-grey-7">DISK</span>
              <span class="text-caption text-grey-9">{{ drillResources.diskGb }} GB</span>
              <span class="text-caption text-weight-medium q-ml-auto">{{ drillResources.disk }}%</span>
            </div>
            <q-linear-progress :value="drillResources.disk / 100" :color="drillMetricColor(drillResources.disk)" rounded size="5px" />
          </div>

        </q-card-section>
      </q-card>

      <!-- Filter bar — type chips + sort + view toggle (matches WeaverPage style) -->
      <div class="row items-center q-mb-sm q-gutter-xs">
        <q-chip clickable dense :outline="appStore.fabrickDrillFilter !== 'all'" color="grey-7"
          :text-color="appStore.fabrickDrillFilter === 'all' ? 'white' : 'grey-7'"
          @click="appStore.setFabrickDrillFilter('all')"
        >All ({{ drillTypeCounts.total }})</q-chip>

        <q-chip v-if="drillTypeCounts.vms > 0" clickable dense icon="mdi-cube-outline"
          :outline="appStore.fabrickDrillFilter !== 'vms'" color="primary"
          :text-color="appStore.fabrickDrillFilter === 'vms' ? 'white' : 'primary'"
          @click="appStore.setFabrickDrillFilter('vms')"
        >VMs ({{ drillTypeCounts.vms }})</q-chip>

        <q-chip v-if="drillTypeCounts.docker > 0" clickable dense icon="mdi-docker"
          :outline="appStore.fabrickDrillFilter !== 'docker'" color="blue-7"
          :text-color="appStore.fabrickDrillFilter === 'docker' ? 'white' : 'blue-7'"
          @click="appStore.setFabrickDrillFilter('docker')"
        >Docker ({{ drillTypeCounts.docker }})</q-chip>

        <q-chip v-if="drillTypeCounts.podman > 0" clickable dense icon="mdi-cow"
          :outline="appStore.fabrickDrillFilter !== 'podman'" color="teal-7"
          :text-color="appStore.fabrickDrillFilter === 'podman' ? 'white' : 'teal-7'"
          @click="appStore.setFabrickDrillFilter('podman')"
        >Podman ({{ drillTypeCounts.podman }})</q-chip>

        <q-chip v-if="drillTypeCounts.apptainer > 0" clickable dense icon="mdi-layers-outline"
          :outline="appStore.fabrickDrillFilter !== 'apptainer'" color="deep-purple-6"
          :text-color="appStore.fabrickDrillFilter === 'apptainer' ? 'white' : 'deep-purple-6'"
          @click="appStore.setFabrickDrillFilter('apptainer')"
        >Apptainer ({{ drillTypeCounts.apptainer }})</q-chip>

        <q-space />

        <q-btn-dropdown flat dense icon="mdi-sort" :label="drillSortLabel" class="q-mr-xs">
          <q-list dense>
            <q-item v-for="opt in DRILL_SORT_OPTIONS" :key="opt.value"
              clickable v-close-popup
              :active="appStore.fabrickDrillSort === opt.value"
              active-class="text-primary"
              @click="appStore.setFabrickDrillSort(opt.value)"
            >
              <q-item-section avatar><q-icon :name="opt.icon" size="20px" /></q-item-section>
              <q-item-section>{{ opt.label }}</q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>

        <q-btn-toggle v-model="drillViewMode" flat dense toggle-color="primary"
          :options="[{ value: 'grid', slot: 'grid' }, { value: 'list', slot: 'list' }]"
        >
          <template #grid><q-icon name="mdi-view-grid" /><q-tooltip>Grid view</q-tooltip></template>
          <template #list><q-icon name="mdi-view-list" /><q-tooltip>List view</q-tooltip></template>
        </q-btn-toggle>

        <!-- Host-level actions (v2.5+ Warp) -->
        <template v-if="isDemoMode() && appStore.isDemoVersionAtLeast('2.5')">
          <q-separator vertical inset class="q-mx-sm" />
          <q-btn flat dense no-caps size="sm" icon="mdi-texture" label="Save as Pattern" color="brown-7">
            <q-tooltip>Capture this host's workloads + bridges into a Warp pattern</q-tooltip>
          </q-btn>
          <q-btn flat dense no-caps size="sm" icon="mdi-content-copy" label="Clone Host" color="brown-7">
            <q-tooltip>Save as pattern + apply to a new host</q-tooltip>
          </q-btn>
        </template>
      </div>

      <div v-if="appStore.fabrickDrillView === 'grid'" class="row q-gutter-md">
        <div v-for="vm in drillWorkloads" :key="vm.name" class="col-12 col-sm-6 col-md-4 col-lg-3">
          <WorkloadCard :vm="vm" />
        </div>
      </div>
      <q-card v-else flat bordered>
        <q-list separator>
          <VmListItem v-for="vm in drillWorkloads" :key="vm.name" :vm="vm" />
        </q-list>
      </q-card>
    </template>

    <!-- Fleet view: host grid/list -->
    <template v-else>

    <!-- Grid View -->
    <div v-if="viewMode === 'grid'" class="row q-col-gutter-md">
      <div v-for="host in filteredHosts" :key="host.id" class="col-12 col-md-4">
        <q-card
          class="host-card cursor-pointer"
          :class="[
            { 'host-card--active': appStore.demoSelectedHostId === host.id },
            `host-card--${host.kind ?? 'local'}`,
          ]"
          bordered
          @click="drillInto(host.id)"
        >
          <q-card-section>
            <!-- Header -->
            <div class="row items-center no-wrap q-mb-sm">
              <q-icon :name="hostKindIcon(host)" size="20px" :color="hostKindColor(host)" class="q-mr-sm" />
              <div class="text-subtitle1 text-weight-bold">{{ host.hostname }}</div>
              <q-space />
              <!-- Kind badge (cloud/remote/IoT only) -->
              <q-badge
                v-if="host.kind && host.kind !== 'local'"
                :color="hostKindColor(host)"
                :label="hostKindLabel(host)"
                rounded
                class="q-mr-xs"
                style="font-size:0.6rem"
              />
              <q-badge
                :color="host.status === 'healthy' ? 'positive' : host.status === 'degraded' ? 'warning' : 'negative'"
                :label="host.status"
                rounded
              />
            </div>

            <div class="text-caption text-grey-6">{{ host.role }}</div>
            <div class="text-caption text-grey-7 q-mb-md">
              {{ host.ipAddress }} · {{ host.cpuCount }} vCPU · {{ Math.round(host.totalMemMb / 1024) }} GB RAM · {{ getVmCount(host.id) }} workloads
            </div>

            <!-- Workload stats: Running · Stopped · Failed — always shown -->
            <div class="row q-col-gutter-sm q-mb-md">
              <div class="col-4">
                <div class="stat-box">
                  <div class="stat-value" :class="getRunningCount(host.id) > 0 ? 'text-positive' : 'text-grey-7'">
                    {{ getRunningCount(host.id) }}
                  </div>
                  <div class="stat-label">Running</div>
                </div>
              </div>
              <div class="col-4">
                <div class="stat-box">
                  <div class="stat-value" :class="getIdleCount(host.id) > 0 ? 'text-grey-6' : 'text-grey-7'">
                    {{ getIdleCount(host.id) }}
                  </div>
                  <div class="stat-label">Idle</div>
                </div>
              </div>
              <div class="col-4">
                <div class="stat-box">
                  <div class="stat-value" :class="getFailedCount(host.id) > 0 ? 'text-negative' : 'text-grey-7'">
                    {{ getFailedCount(host.id) }}
                  </div>
                  <div class="stat-label">Failed</div>
                </div>
              </div>
            </div>

            <!-- Cross-host connections — always rendered for consistent card height -->
            <div class="row items-center q-mb-sm" style="min-height:24px">
              <template v-if="connectionCount(host.id) > 0">
                <q-icon name="mdi-vector-link" color="deep-purple-4" size="14px" class="q-mr-xs" />
                <span class="text-caption text-grey-6">
                  {{ connectionCount(host.id) }} cross-host service{{ connectionCount(host.id) !== 1 ? 's' : '' }}
                </span>
                <q-space />
                <q-btn
                  flat dense no-caps size="xs"
                  color="deep-purple-4"
                  icon="mdi-spider-web"
                  label="Loom"
                  @click.stop="router.push('/loom')"
                />
              </template>
            </div>

            <!-- Host actions (v2.5+ Warp) -->
            <div v-if="isDemoMode() && appStore.isDemoVersionAtLeast('2.5')" class="row justify-end q-mb-sm">
              <q-btn flat dense round size="sm" icon="mdi-dots-vertical" color="grey-6" @click.stop>
                <q-menu>
                  <q-list dense>
                    <q-item clickable v-close-popup @click.stop>
                      <q-item-section avatar><q-icon name="mdi-texture" size="18px" color="brown-7" /></q-item-section>
                      <q-item-section>Save as Pattern</q-item-section>
                      <q-item-section side><q-badge outline color="grey-6" label="→ Warp" /></q-item-section>
                    </q-item>
                    <q-item clickable v-close-popup @click.stop>
                      <q-item-section avatar><q-icon name="mdi-content-copy" size="18px" color="brown-7" /></q-item-section>
                      <q-item-section>Clone Host</q-item-section>
                      <q-item-section side><q-badge outline color="grey-6" label="pattern + apply" /></q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>

            <!-- Resource bars: 2×2 grid (CPU/MEM top, DISK/NET bottom) -->
            <div class="resource-grid">
              <div v-for="m in [
                { label: 'CPU',  val: cpuUsage(host.id)  },
                { label: 'MEM',  val: memUsage(host.id)  },
                { label: 'DISK', val: diskUsage(host.id) },
                { label: 'NET',  val: netUsage(host.id)  },
              ]" :key="m.label" class="res-metric">
                <div class="res-metric-header">
                  <span class="res-label">{{ m.label }}</span>
                  <span class="res-pct" :class="`text-${metricColor(m.val)}`">{{ m.val }}%</span>
                </div>
                <q-linear-progress
                  :value="m.val / 100"
                  :color="metricColor(m.val)"
                  track-color="grey-3"
                  rounded size="5px"
                />
              </div>
            </div>
          </q-card-section>

        </q-card>
      </div>
    </div>

    <!-- List View -->
    <q-card v-else flat bordered>
      <q-list separator>
        <HostListItem
          v-for="host in filteredHosts"
          :key="host.id"
          :host="host"
          :vm-count="getVmCount(host.id)"
          :running-count="getRunningCount(host.id)"
          :idle-count="getIdleCount(host.id)"
          :stopped-count="getStoppedCount(host.id)"
          :failed-count="getFailedCount(host.id)"
          :cpu-usage="cpuUsage(host.id)"
          :mem-usage="memUsage(host.id)"
          :disk-usage="diskUsage(host.id)"
          :net-usage="netUsage(host.id)"
          :active="appStore.demoSelectedHostId === host.id"
          @click="selectHost(host.id)"
          @view="drillInto(host.id)"
        />
      </q-list>
    </q-card>

    </template><!-- end fleet view -->

    <!-- Demo version feature previews (v2.3: discovery/migration, v2.5: fleet templates) -->
    <DemoVersionFeatures v-if="isDemoMode()" section="fabrick" />

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from 'src/stores/app'
import { useUiStore } from 'src/stores/ui-store'
import { DEMO_HOSTS, getDemoVmsForHost, DEMO_HOST_RESOURCES, DEMO_WORKLOAD_CONNECTIONS } from 'src/config/demo'
import type { DemoHostInfo } from 'src/config/demo'
import HostListItem from 'src/components/fabrick/HostListItem.vue'
import WorkloadCard from 'src/components/WorkloadCard.vue'
import VmListItem from 'src/components/VmListItem.vue'
import { STATUSES } from 'src/constants/vocabularies'
import { isDemoMode } from 'src/config/demo-mode'
import DemoVersionFeatures from 'src/components/demo/DemoVersionFeatures.vue'

const appStore = useAppStore()
const uiStore = useUiStore()
const router = useRouter()


// ── Workload counts ───────────────────────────────────────────────────────────

const totalVms = computed(() =>
  DEMO_HOSTS.reduce((sum, h) => sum + getDemoVmsForHost(h.id, appStore.effectiveTier).length, 0)
)

function getVmCount(hostId: string): number {
  return getDemoVmsForHost(hostId, appStore.effectiveTier).length
}

function getRunningCount(hostId: string): number {
  return getDemoVmsForHost(hostId, appStore.effectiveTier).filter(v => v.status === STATUSES.RUNNING).length
}

function getIdleCount(hostId: string): number {
  return getDemoVmsForHost(hostId, appStore.effectiveTier).filter(v => v.status === STATUSES.IDLE).length
}

function getStoppedCount(hostId: string): number {
  return getDemoVmsForHost(hostId, appStore.effectiveTier).filter(v => v.status === STATUSES.STOPPED).length
}

function getFailedCount(hostId: string): number {
  return getDemoVmsForHost(hostId, appStore.effectiveTier).filter(v => v.status === STATUSES.FAILED).length
}

const totalRunning = computed(() =>
  DEMO_HOSTS.reduce((sum, h) => sum + getRunningCount(h.id), 0)
)
const totalIdle = computed(() =>
  DEMO_HOSTS.reduce((sum, h) => sum + getIdleCount(h.id), 0)
)
const totalStopped = computed(() =>
  DEMO_HOSTS.reduce((sum, h) => sum + getStoppedCount(h.id), 0)
)
const totalFailed = computed(() =>
  DEMO_HOSTS.reduce((sum, h) => sum + getFailedCount(h.id), 0)
)

// ── Resource mocks ────────────────────────────────────────────────────────────

function cpuUsage(hostId: string):  number { return DEMO_HOST_RESOURCES[hostId]?.cpu  ?? 30 }
function memUsage(hostId: string):  number { return DEMO_HOST_RESOURCES[hostId]?.mem  ?? 50 }
function diskUsage(hostId: string): number { return DEMO_HOST_RESOURCES[hostId]?.disk ?? 30 }
function netUsage(hostId: string):  number { return DEMO_HOST_RESOURCES[hostId]?.net  ?? 20 }

function connectionCount(hostId: string): number {
  return DEMO_WORKLOAD_CONNECTIONS.filter(c => c.fromHost === hostId || c.toHost === hostId).length
}

function attentionScore(hostId: string): number {
  return Math.max(cpuUsage(hostId), memUsage(hostId), diskUsage(hostId), netUsage(hostId))
}

const STATUS_PRIORITY: Record<string, number> = { offline: 2, degraded: 1, healthy: 0 }

function metricColor(pct: number): string {
  if (pct >= 90) return 'negative'
  if (pct >= 70) return 'warning'
  return 'positive'
}

// ── Fleet kind counts ─────────────────────────────────────────────────────────

const localCount  = computed(() => DEMO_HOSTS.filter(h => !h.kind || h.kind === 'local').length)
const cloudCount  = computed(() => DEMO_HOSTS.filter(h => h.kind === 'cloud').length)
const remoteCount = computed(() => DEMO_HOSTS.filter(h => h.kind === 'remote').length)
const iotCount    = computed(() => DEMO_HOSTS.filter(h => h.kind === 'iot').length)

// ── Kind helpers ──────────────────────────────────────────────────────────────

function hostKindIcon(host: DemoHostInfo): string {
  if (host.kind === 'cloud')  return 'mdi-cloud-outline'
  if (host.kind === 'remote') return 'mdi-wan'
  if (host.kind === 'iot')    return 'mdi-chip'
  return 'mdi-server'
}

function hostKindColor(host: DemoHostInfo): string {
  if (host.kind === 'cloud')  return 'light-blue-7'
  if (host.kind === 'remote') return 'amber-8'
  if (host.kind === 'iot')    return 'teal-6'
  return 'primary'
}

function hostKindLabel(host: DemoHostInfo): string {
  if (host.kind === 'cloud')  return host.provider ? `${host.provider} · ${host.region ?? ''}`.trim().replace(/·\s*$/, '') : 'cloud'
  if (host.kind === 'remote') return host.region ?? 'remote'
  if (host.kind === 'iot')    return host.region ?? 'iot'
  return ''
}

// ── Filter + sort ─────────────────────────────────────────────────────────────

type KindFilter = 'all' | 'local' | 'cloud' | 'remote' | 'iot'
const kindFilter = ref<KindFilter>('all')

type SortPref = 'attention' | 'name-asc' | 'name-desc'
const sortPref = ref<SortPref>('attention')

const sortOptions: { value: SortPref; label: string; icon: string }[] = [
  { value: 'attention',  label: 'Attention needed', icon: 'mdi-alert-circle-outline' },
  { value: 'name-asc',   label: 'Name (A–Z)',       icon: 'mdi-sort-alphabetical-ascending' },
  { value: 'name-desc',  label: 'Name (Z–A)',       icon: 'mdi-sort-alphabetical-descending' },
]

const sortLabel = computed(() => sortOptions.find(o => o.value === sortPref.value)?.label ?? 'Sort')

const filteredHosts = computed(() => {
  let hosts = [...DEMO_HOSTS]

  // Kind filter
  if (kindFilter.value !== 'all') {
    hosts = hosts.filter(h =>
      kindFilter.value === 'local'
        ? !h.kind || h.kind === 'local'
        : h.kind === kindFilter.value
    )
  }

  // Search — matches hostname, role, IP, provider, region, or any workload name
  const q = uiStore.searchQuery.toLowerCase().trim()
  if (q) {
    hosts = hosts.filter(h => {
      if (
        h.hostname.toLowerCase().includes(q) ||
        h.role.toLowerCase().includes(q) ||
        h.ipAddress.includes(q) ||
        (h.provider ?? '').toLowerCase().includes(q) ||
        (h.region ?? '').toLowerCase().includes(q)
      ) return true
      return getDemoVmsForHost(h.id, appStore.effectiveTier)
        .some(vm => vm.name.toLowerCase().includes(q) || (vm.description ?? '').toLowerCase().includes(q))
    })
  }

  if (sortPref.value === 'attention') {
    hosts.sort((a, b) => {
      const statusDiff = (STATUS_PRIORITY[b.status] ?? 0) - (STATUS_PRIORITY[a.status] ?? 0)
      if (statusDiff !== 0) return statusDiff
      return attentionScore(b.id) - attentionScore(a.id)
    })
  }
  if (sortPref.value === 'name-asc')  hosts.sort((a, b) => a.hostname.localeCompare(b.hostname))
  if (sortPref.value === 'name-desc') hosts.sort((a, b) => b.hostname.localeCompare(a.hostname))
  return hosts
})

// ── View mode ─────────────────────────────────────────────────────────────────

const viewMode = ref<'grid' | 'list'>('grid')

// ── Drill-down ────────────────────────────────────────────────────────────────

const drillHost = computed(() =>
  DEMO_HOSTS.find(h => h.id === appStore.fabrickDrillHostId) ?? null
)

const drillResources = computed(() =>
  DEMO_HOST_RESOURCES[appStore.fabrickDrillHostId ?? ''] ?? { cpu: 30, mem: 50, disk: 30, net: 20, diskGb: 500 }
)

const drillLoad1  = computed(() => drillHost.value ? Math.round((drillResources.value.cpu / 100) * drillHost.value.cpuCount * 10) / 10 : 0)
const drillLoad5  = computed(() => drillHost.value ? Math.round((drillResources.value.cpu / 100) * drillHost.value.cpuCount * 8.5) / 10 : 0)
const drillLoad15 = computed(() => drillHost.value ? Math.round((drillResources.value.cpu / 100) * drillHost.value.cpuCount * 7.1) / 10 : 0)
const drillLoadPct = computed(() => drillHost.value?.cpuCount ? Math.min(100, Math.round((drillLoad1.value / drillHost.value.cpuCount) * 100)) : 0)

function drillMetricColor(pct: number): string {
  if (pct >= 90) return 'negative'
  if (pct >= 70) return 'warning'
  return 'positive'
}

function formatDrillUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const drillAllVms = computed(() => {
  const id = appStore.fabrickDrillHostId
  if (!id) return []
  return getDemoVmsForHost(id, appStore.effectiveTier)
})

const DRILL_SORT_OPTIONS = [
  { value: 'attention' as const, label: 'Attention needed', icon: 'mdi-alert-circle-outline' },
  { value: 'name-asc'  as const, label: 'Name (A–Z)',       icon: 'mdi-sort-alphabetical-ascending' },
  { value: 'name-desc' as const, label: 'Name (Z–A)',       icon: 'mdi-sort-alphabetical-descending' },
]

const drillSortLabel = computed(() =>
  DRILL_SORT_OPTIONS.find(o => o.value === appStore.fabrickDrillSort)?.label ?? 'Sort'
)

const drillViewMode = computed({
  get: () => appStore.fabrickDrillView,
  set: (v) => appStore.setFabrickDrillView(v),
})

const DRILL_CONTAINER_RUNTIMES = ['docker', 'podman', 'apptainer'] as const

const drillTypeCounts = computed(() => {
  const wls = drillAllVms.value
  return {
    total:     wls.length,
    vms:       wls.filter(w => !(DRILL_CONTAINER_RUNTIMES as readonly string[]).includes(w.runtime ?? '')).length,
    docker:    wls.filter(w => w.runtime === 'docker').length,
    podman:    wls.filter(w => w.runtime === 'podman').length,
    apptainer: wls.filter(w => w.runtime === 'apptainer').length,
  }
})

const drillWorkloads = computed(() => {
  let vms = [...drillAllVms.value]
  const f = appStore.fabrickDrillFilter
  if (f === 'vms')       vms = vms.filter(w => !(DRILL_CONTAINER_RUNTIMES as readonly string[]).includes(w.runtime ?? ''))
  else if (f !== 'all')  vms = vms.filter(w => w.runtime === f)
  const pref = appStore.fabrickDrillSort
  const PRIO: Record<string, number> = { failed: 0, stopped: 1, idle: 2, unknown: 3, running: 4 }
  if (pref === 'attention') vms.sort((a, b) => (PRIO[a.status] ?? 3) - (PRIO[b.status] ?? 3) || a.name.localeCompare(b.name))
  else if (pref === 'name-asc')  vms.sort((a, b) => a.name.localeCompare(b.name))
  else if (pref === 'name-desc') vms.sort((a, b) => b.name.localeCompare(a.name))
  return vms
})

// ── Navigation ────────────────────────────────────────────────────────────────

function selectHost(hostId: string) {
  appStore.setDemoHost(hostId)
}

function drillInto(hostId: string) {
  appStore.setDemoHost(hostId)
  appStore.setFabrickDrill(hostId)
}

</script>

<style scoped lang="scss">
.host-card {
  transition: box-shadow 0.15s, border-color 0.15s;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }

  &--active {
    border-color: var(--q-primary) !important;
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.25);
  }

  // Cloud hosts — light-blue dashed border (Decision #80)
  &--cloud {
    border-style: dashed;
    border-color: var(--q-light-blue-7, #0288d1);
  }

  // Remote hosts — amber left accent
  &--remote {
    border-left: 3px solid var(--q-amber-8, #f57f17);
  }

  // IoT / edge — teal left accent
  &--iot {
    border-left: 3px solid var(--q-teal-6, #00897b);
  }
}

.stat-box {
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 8px 12px;
  text-align: center;

  .body--dark & {
    background: rgba(255, 255, 255, 0.06);
  }
}

.stat-value {
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--q-grey-6);
  margin-top: 2px;
}

.resource-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 10px;
}

.res-metric-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 3px;
}

.res-label {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--q-grey-6);
  font-weight: 600;
}

.res-pct {
  font-size: 0.7rem;
  font-weight: 600;
}
</style>

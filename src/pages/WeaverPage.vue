<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page class="q-pa-md">
    <!-- In demo mode, hide content behind the first-run wizard for a clean "blank canvas" start -->
    <div v-show="!demoWizardActive">
    <!-- Host Info -->
    <HostInfoStrip class="q-mb-md" />

    <!-- Host warnings (KVM missing, low RAM, aarch64 emulation) -->
    <q-banner
      v-for="w in hostWarnings"
      :key="w.message"
      dense
      rounded
      :class="w.level === 'warning' ? 'bg-warning text-dark q-mb-sm' : 'bg-blue-1 text-blue-9 q-mb-sm'"
    >
      <template #avatar>
        <q-icon :name="w.level === 'warning' ? 'mdi-alert' : 'mdi-information'" />
      </template>
      {{ w.message }}
    </q-banner>

    <!-- Example VM cleanup hint: shown once the user has their own VMs alongside the example -->
    <q-banner
      v-if="showExampleVmHint"
      dense
      rounded
      class="bg-amber-1 text-amber-9 q-mb-sm"
    >
      <template #avatar>
        <q-icon name="mdi-lightbulb-outline" color="amber-8" />
      </template>
      <div class="row items-center no-wrap">
        <div class="col">
          <span class="text-weight-medium">example-cirros</span> is still running.
          Now that you have your own workloads, you can delete it — open the VM and click Delete.
        </div>
        <q-btn
          flat dense
          label="Dismiss"
          size="sm"
          color="amber-9"
          class="q-ml-sm"
          @click="dismissExampleVmHint"
        />
      </div>
    </q-banner>

    <!-- Workload controls: type filter · sort · view -->
    <div class="row items-center q-mb-sm q-gutter-xs">
      <template v-if="hasContainers">
        <q-chip clickable dense :outline="activeFilter !== 'all'" color="primary"
          :text-color="activeFilter === 'all' ? 'white' : 'primary'"
          @click="uiStore.setWeaverActiveFilter('all')"
        >All ({{ totalWorkloadCount }})</q-chip>

        <q-chip clickable dense icon="mdi-cube-outline" :outline="activeFilter !== 'vms'" color="primary"
          :text-color="activeFilter === 'vms' ? 'white' : 'primary'"
          @click="uiStore.setWeaverActiveFilter('vms')"
        >VMs ({{ workloadStore.totalCount }})</q-chip>

        <q-chip v-if="runtimeCounts.docker > 0" clickable dense icon="mdi-docker"
          :outline="activeFilter !== 'docker'" color="blue-7"
          :text-color="activeFilter === 'docker' ? 'white' : 'blue-7'"
          @click="uiStore.setWeaverActiveFilter('docker')"
        >Docker ({{ runtimeCounts.docker }})</q-chip>

        <q-chip v-if="runtimeCounts.podman > 0" clickable dense icon="mdi-cow"
          :outline="activeFilter !== 'podman'" color="teal-7"
          :text-color="activeFilter === 'podman' ? 'white' : 'teal-7'"
          @click="uiStore.setWeaverActiveFilter('podman')"
        >Podman ({{ runtimeCounts.podman }})</q-chip>

        <q-chip v-if="runtimeCounts.apptainer > 0 && appStore.isWeaver" clickable dense icon="mdi-layers-outline"
          :outline="activeFilter !== 'apptainer'" color="deep-purple-6"
          :text-color="activeFilter === 'apptainer' ? 'white' : 'deep-purple-6'"
          @click="uiStore.setWeaverActiveFilter('apptainer')"
        >Apptainer ({{ runtimeCounts.apptainer }})</q-chip>
      </template>

      <q-space />

      <q-btn-dropdown flat dense icon="mdi-sort" :label="sortLabel" class="q-mr-xs">
        <q-list dense>
          <q-item
            v-for="opt in sortOptions" :key="opt.value"
            clickable v-close-popup
            :active="uiStore.sortPreference === opt.value"
            active-class="text-primary"
            @click="uiStore.setSortPreference(opt.value)"
          >
            <q-item-section avatar><q-icon :name="opt.icon" size="20px" /></q-item-section>
            <q-item-section>{{ opt.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>

      <q-btn-toggle
        v-model="viewMode"
        flat dense toggle-color="primary" class="q-mr-xs"
        :options="[{ value: 'grid', slot: 'grid' }, { value: 'list', slot: 'list' }]"
      >
        <template #grid><q-icon name="mdi-view-grid" /><q-tooltip>Grid view</q-tooltip></template>
        <template #list><q-icon name="mdi-view-list" /><q-tooltip>List view</q-tooltip></template>
      </q-btn-toggle>
    </div>

    <!-- VM bulk actions — VMs filter active (or no containers) -->
    <template v-if="(activeFilter === 'vms' || !hasContainers) && vmBulkEnabled">
      <DashboardToolbar v-if="workloadStore.totalCount > 0" />
      <BulkActionBar />
    </template>

    <!-- Container bulk actions preview — demo v1.3+, any container filter active -->
    <div
      v-if="isContainerFilter && isDemoMode() && appStore.isDemoVersionAtLeast('1.3')"
      class="row items-center q-gutter-xs q-mb-sm"
    >
      <q-space />
      <q-btn flat dense no-caps size="sm" icon="mdi-stop" label="Stop selected" color="grey-7" disable />
      <q-btn flat dense no-caps size="sm" icon="mdi-restart" label="Restart selected" color="grey-7" disable />
      <q-btn flat dense no-caps size="sm" icon="mdi-delete-outline" label="Remove selected" color="negative" disable />
    </div>

    <!-- Loading skeleton state -->
    <div v-if="!connected && workloadStore.totalCount === 0">
      <div class="text-caption text-grey-8 q-mb-md">
        <q-spinner-dots size="16px" color="primary" class="q-mr-sm" />
        Connecting to server...
      </div>
      <div class="row q-gutter-md">
        <div v-for="n in 4" :key="n" class="col-12 col-sm-6 col-md-4 col-lg-3">
          <q-card>
            <q-card-section>
              <q-skeleton type="text" width="60%" class="q-mb-sm" />
              <q-skeleton type="QBadge" width="70px" />
            </q-card-section>
            <q-separator />
            <q-card-section>
              <q-skeleton type="text" class="q-mb-xs" />
              <q-skeleton type="text" width="80%" class="q-mb-xs" />
              <q-skeleton type="text" width="50%" class="q-mb-xs" />
              <q-skeleton type="text" width="65%" />
            </q-card-section>
            <q-separator />
            <q-card-actions align="right">
              <q-skeleton type="QBtn" />
              <q-skeleton type="QBtn" />
            </q-card-actions>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Empty state (no VMs and no containers) -->
    <div
      v-else-if="connected && workloadStore.totalCount === 0 && !hasContainers"
      class="text-center q-pa-xl"
    >
      <q-icon name="mdi-server-off" size="80px" color="grey-5" />
      <div class="text-h6 q-mt-md text-grey-8">No Virtual Machines Found</div>
      <div class="text-body2 text-grey-8 q-mt-sm" style="max-width: 400px; margin: 0 auto">
        No virtual machines are registered. Scan your system to discover
        existing MicroVM services, or register a VM manually.
      </div>
      <div class="q-mt-lg q-gutter-sm">
        <q-btn
          color="primary"
          icon="mdi-radar"
          label="Scan for Workloads"
          :loading="scanning"
          @click="runScan"
        />
        <q-btn
          v-if="authStore.canManageVms && canProvision && appStore.isWeaver"
          color="primary"
          icon="mdi-plus"
          label="Create VM"
          @click="showCreateDialog"
        />
        <q-btn
          v-else-if="authStore.canManageVms"
          color="primary"
          icon="mdi-server-plus"
          label="Register VM"
          @click="showRegisterDialog"
        />
      </div>
      <div v-if="scanResult" class="q-mt-md text-caption">
        <span v-if="scanResult.added.length > 0" class="text-positive">
          Found {{ scanResult.added.length }} new VM(s)
        </span>
        <span v-else class="text-grey-8">
          No microvm@* services detected on this host
        </span>
      </div>
    </div>

    <!-- No filter results -->
    <div
      v-else-if="displayVms.length === 0 && filteredContainers.length === 0 && (workloadStore.hasActiveFilters || uiStore.searchQuery)"
      class="text-center q-pa-xl"
    >
      <q-icon name="mdi-filter-off" size="60px" color="grey-5" />
      <div class="text-h6 q-mt-md text-grey-8">No VMs match filters</div>
      <div class="text-caption text-grey-8 q-mt-sm">
        Try adjusting your search or filter criteria.
      </div>
      <q-btn flat color="primary" label="Clear filters" class="q-mt-md" @click="uiStore.clearFilters()" />
    </div>

    <!-- Grid View -->
    <div v-else-if="effectiveView === 'grid'" class="row q-gutter-md">
      <template v-for="item in unifiedWorkloads" :key="item.kind === 'remote' ? `remote:${item.remoteHostname}:${item.vm.name}` : item.kind === 'vm' ? item.vm.name : item.container.id">
        <div v-if="item.kind === 'vm'" class="col-12 col-sm-6 col-md-4 col-lg-3">
          <WorkloadCard :vm="item.vm" :selectable="vmBulkEnabled && (activeFilter === 'vms' || !hasContainers)" />
        </div>
        <div v-else-if="item.kind === 'remote'" class="col-12 col-sm-6 col-md-4 col-lg-3">
          <WorkloadCard :vm="item.vm" :remote-hostname="item.remoteHostname" />
        </div>
        <div v-else class="col-12 col-sm-6 col-md-4 col-lg-3">
          <ContainerCard :container="item.container" :selectable="isContainerFilter" :host-mem-mb="basicHost?.totalMemMb" />
        </div>
      </template>
    </div>

    <!-- List View -->
    <template v-else>
      <q-card flat bordered>
        <q-list separator>
          <template v-for="item in unifiedWorkloads" :key="item.kind === 'remote' ? `remote:${item.remoteHostname}:${item.vm.name}` : item.kind === 'vm' ? item.vm.name : item.container.id">
            <VmListItem
              v-if="item.kind === 'vm'"
              :vm="item.vm"
              :selectable="vmBulkEnabled && (activeFilter === 'vms' || !hasContainers)"
            />
            <VmListItem
              v-else-if="item.kind === 'remote'"
              :vm="item.vm"
              :remote-hostname="item.remoteHostname"
            />
            <ContainerListItem
              v-else
              :container="item.container"
              :selectable="isContainerFilter"
            />
          </template>
        </q-list>
      </q-card>
    </template>

    <!-- Container Visibility nag (demo, pre-v1.1) — hidden in public demo (Decision #135) -->
    <VersionNag
      v-if="isDemoMode() && !isPublicDemo() && !appStore.isDemoVersionAtLeast('1.1')"
      version="1.1"
      title="Container Visibility"
      description="Docker + Podman (free) · Apptainer for HPC/research (Weaver)"
      class="q-mt-lg"
    />

    <!-- Apptainer nag removed from Free tier — HPC is irrelevant to the home lab persona.
         Apptainer containers are simply hidden on Free (filtered in visibleContainers). -->

    <!-- Demo version feature previews -->
    <template v-if="isDemoMode()">
      <DemoVersionFeatures section="weaver" />
      <DemoVersionFeatures section="weaver-team" />
    </template>

    <!-- Public demo: cumulative release summary (Decision #135) -->
    <DemoReleaseSummary v-if="isDemoMode()" />

    </div><!-- /demoWizardActive -->

    <!-- Register Existing VM dialog (v-model driven) -->
    <AddVmDialog v-model="showRegister" />

    <!-- Getting Started Wizard -->
    <GettingStartedDialog v-model="showWizard" />

  </q-page>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { useWorkloadStatus } from 'src/composables/useVmStatus'
import { useHostInfo } from 'src/composables/useHostInfo'
import { useWorkloadApi } from 'src/composables/useVmApi'
import { useWorkloadStore } from 'src/stores/workload-store'
import { useUiStore } from 'src/stores/ui-store'
import { useSettingsStore } from 'src/stores/settings-store'
import WorkloadCard from 'src/components/WorkloadCard.vue'
import VmListItem from 'src/components/VmListItem.vue'
import ContainerCard from 'src/components/ContainerCard.vue'
import ContainerListItem from 'src/components/ContainerListItem.vue'
import HostInfoStrip from 'src/components/HostInfoStrip.vue'
import DashboardToolbar from 'src/components/DashboardToolbar.vue'
import BulkActionBar from 'src/components/BulkActionBar.vue'
import CreateVmDialog from 'src/components/CreateVmDialog.vue'
import AddVmDialog from 'src/components/AddVmDialog.vue'
import GettingStartedDialog from 'src/components/GettingStartedDialog.vue'
import VersionNag from 'src/components/demo/VersionNag.vue'
import DemoVersionFeatures from 'src/components/demo/DemoVersionFeatures.vue'
import DemoReleaseSummary from 'src/components/demo/DemoReleaseSummary.vue'
import { useAuthStore } from 'src/stores/auth-store'
import { useAppStore } from 'src/stores/app'
import { isDemoMode, isPublicDemo, getDemoContainersForTier, DEMO_WORKLOAD_CONNECTIONS, DEMO_HOSTS, getDemoVmsForHost } from 'src/config/demo'
import { api } from 'src/boot/axios'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const workloadStore = useWorkloadStore()
const uiStore = useUiStore()
const settingsStore = useSettingsStore()
const authStore = useAuthStore()
const appStore = useAppStore()
const { scanVms } = useWorkloadApi()
const { vms, connected } = useWorkloadStatus()
const { warnings: hostWarnings, basicHost } = useHostInfo()
const showWizard = ref(false)

/** In demo mode, hide page content while the wizard is active for a clean "blank canvas" start. */
const demoWizardActive = computed(() => isDemoMode() && showWizard.value)

const canProvision = computed(() => appStore.provisioningEnabled)

// Example VM cleanup hint: show when the user has example-cirros + at least
// one non-example VM. Dismissible — stored in localStorage so it stays hidden.
const EXAMPLE_VM_HINT_KEY = 'weaver.exampleVmHint.dismissed'
const exampleVmHintDismissed = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(EXAMPLE_VM_HINT_KEY) === 'true',
)
const showExampleVmHint = computed(() => {
  if (exampleVmHintDismissed.value) return false
  const hasExample = vms.value.some(vm => vm.name === 'example-cirros')
  const hasOtherVm = vms.value.some(vm => vm.name !== 'example-cirros')
  return hasExample && hasOtherVm
})
function dismissExampleVmHint() {
  exampleVmHintDismissed.value = true
  try { localStorage.setItem(EXAMPLE_VM_HINT_KEY, 'true') } catch { /* ignore */ }
}

onMounted(async () => {
  if (isDemoMode()) return // defaults set in app store initialize()
  try {
    const { data } = await api.get<{ provisioningEnabled: boolean; bridgeGateway: string | null }>('/health')
    appStore.provisioningEnabled = data.provisioningEnabled ?? false
    appStore.bridgeGateway = data.bridgeGateway ?? null
  } catch { /* health already loaded elsewhere */ }
})

const showRegister = ref(false)

function showCreateDialog() {
  $q.dialog({ component: CreateVmDialog })
}

// Open Create VM dialog when navigated with ?action=create (keyboard shortcut 'n')
watch(() => route.query.action, (action) => {
  if (action === 'create') {
    showCreateDialog()
    void router.replace({ path: '/weaver', query: {} })
  }
}, { immediate: true })

function showRegisterDialog() {
  showRegister.value = true
}

const scanning = ref(false)
const scanResult = ref<{ discovered: string[]; added: string[]; existing: string[] } | null>(null)

async function runScan() {
  scanning.value = true
  scanResult.value = await scanVms()
  scanning.value = false
}

type SortPref = 'status-az' | 'name-asc' | 'name-desc'
const sortOptions: { value: SortPref; label: string; icon: string }[] = [
  { value: 'status-az', label: 'Attention needed', icon: 'mdi-alert-circle-outline' },
  { value: 'name-asc',  label: 'Name (A–Z)',       icon: 'mdi-sort-alphabetical-ascending' },
  { value: 'name-desc', label: 'Name (Z–A)',       icon: 'mdi-sort-alphabetical-descending' },
]

const viewMode = computed({
  get: () => uiStore.dashboardView,
  set: (val: 'grid' | 'list') => uiStore.setDashboardView(val),
})

const effectiveView = computed(() => uiStore.dashboardView)

const sortLabel = computed(() => sortOptions.find(o => o.value === uiStore.sortPreference)?.label ?? 'Sort')

const runtimeCounts = computed(() => ({
  docker:    visibleContainers.value.filter(c => c.runtime === 'docker').length,
  podman:    visibleContainers.value.filter(c => c.runtime === 'podman').length,
  apptainer: visibleContainers.value.filter(c => c.runtime === 'apptainer').length,
}))

const totalWorkloadCount = computed(() => workloadStore.totalCount + visibleContainers.value.length)

const CONTAINER_RUNTIMES = ['docker', 'podman', 'apptainer'] as const

function mapToContainerInfo(w: WorkloadInfo): ContainerInfo {
  const statusMap: Record<string, ContainerInfo['status']> = {
    [STATUSES.RUNNING]: STATUSES.RUNNING, [STATUSES.IDLE]: STATUSES.STOPPED, [STATUSES.STOPPED]: 'exited', [STATUSES.FAILED]: 'exited', [STATUSES.UNKNOWN]: STATUSES.UNKNOWN,
  }
  return {
    id: w.containerId ?? w.name,
    name: w.name,
    image: w.image ?? '',
    runtime: w.runtime as ContainerRuntime,
    status: statusMap[w.status] ?? STATUSES.UNKNOWN,
    created: '',
  }
}

const hasContainers = computed(() => {
  if (isDemoMode()) return appStore.isDemoVersionAtLeast('1.1')
  // Real backend: show container section when any workload has a container runtime
  return workloadStore.workloads.some(w => (CONTAINER_RUNTIMES as readonly string[]).includes(w.runtime ?? ''))
})

// Bulk VM ops are Fabrick-gated; in demo they only appear once containers
// exist (v1.1) so the tab-scoped design makes sense.
const vmBulkEnabled = computed(
  () => appStore.isFabrick && (!isDemoMode() || appStore.isDemoVersionAtLeast('1.1'))
)

const visibleContainers = computed(() => {
  if (!hasContainers.value) return []
  if (isDemoMode()) {
    const all = getDemoContainersForTier(appStore.effectiveTier)
    return appStore.isWeaver ? all : all.filter(c => c.runtime !== 'apptainer')
  }
  // Real backend: map WorkloadInfo containers to ContainerInfo shape
  return workloadStore.workloads
    .filter(w => (CONTAINER_RUNTIMES as readonly string[]).includes(w.runtime ?? ''))
    .map(mapToContainerInfo)
})

// ── Remote workloads (Fabrick + demo v3.0+) ────────────────────────────────

const remoteWorkloads = computed<Array<{ vm: WorkloadInfo; remoteHostname: string }>>(() => {
  if (!isDemoMode() || !appStore.isFabrick || !appStore.isDemoVersionAtLeast('3.0')) return []
  const hostId = appStore.demoSelectedHostId
  const seen = new Set<string>()
  const result: Array<{ vm: WorkloadInfo; remoteHostname: string }> = []
  for (const c of DEMO_WORKLOAD_CONNECTIONS) {
    let remoteHostId: string
    let remoteWorkload: string
    if (c.fromHost === hostId) {
      remoteHostId = c.toHost; remoteWorkload = c.toWorkload
    } else if (c.toHost === hostId) {
      remoteHostId = c.fromHost; remoteWorkload = c.fromWorkload
    } else {
      continue
    }
    const key = `${remoteHostId}:${remoteWorkload}`
    if (seen.has(key)) continue
    seen.add(key)
    const vm = getDemoVmsForHost(remoteHostId, appStore.effectiveTier).find(v => v.name === remoteWorkload)
    if (!vm) continue
    const rHost = DEMO_HOSTS.find(h => h.id === remoteHostId)
    result.push({ vm, remoteHostname: rHost?.hostname ?? remoteHostId })
  }
  return result
})

// Unified workload filter — driven by toolbar in MainLayout
type WorkloadFilter = 'all' | 'vms' | 'docker' | 'podman' | 'apptainer'
const activeFilter = computed(() => uiStore.weaverActiveFilter as WorkloadFilter)

const isContainerFilter = computed(
  () => activeFilter.value === 'docker' || activeFilter.value === 'podman' || activeFilter.value === 'apptainer'
)

// VMs to display — hidden when a container runtime filter is active.
// In non-demo mode, container workloads render via ContainerCard — exclude them here.
const displayVms = computed(() => {
  if (isContainerFilter.value) return []
  const all = workloadStore.filteredWorkloads
  if (!isDemoMode() && hasContainers.value) {
    return all.filter(w => !(CONTAINER_RUNTIMES as readonly string[]).includes(w.runtime ?? ''))
  }
  return all
})

// Unified status priority — mirrors Fabrick's attention model, includes idle in the alert zone.
// Lower number = sorts first (more urgent).
function workloadStatusPrio(status: string): number {
  if (status === STATUSES.FAILED || status === 'exited') return 0  // fault — show first
  if (status === STATUSES.STOPPED) return 1                        // anomalous stop — needs attention
  if (status === STATUSES.IDLE)    return 2                        // intentional stop — still worth noticing
  if (status === STATUSES.UNKNOWN) return 3                        // indeterminate
  if (status === 'paused')  return 3                        // reserved: hypervisor snapshot state
  return 4                                                  // running
}

// Resource pressure score — Fabrick-style secondary sort key.
// Higher = sorts earlier within same status group.
// Only containers expose per-workload CPU metrics; VMs fall back to 0.
// Threshold: only CPU above 10% is treated as significant pressure — below that,
// idle containers sort A-Z alongside VMs rather than always preceding them.
const PRESSURE_THRESHOLD = 10
function resourcePressure(item: WorkloadItem): number {
  if (item.kind === 'container') {
    const cpu = item.container.cpuPercent ?? 0
    return cpu > PRESSURE_THRESHOLD ? cpu : 0
  }
  return 0
}

import type { WorkloadInfo } from 'src/types/workload'
import type { ContainerInfo, ContainerRuntime } from 'src/types/container'
import { STATUSES } from 'src/constants/vocabularies'
type WorkloadItem =
  | { kind: 'vm';        vm: WorkloadInfo;        name: string; statusPrio: number }
  | { kind: 'container'; container: ContainerInfo; name: string; statusPrio: number }
  | { kind: 'remote';    vm: WorkloadInfo; remoteHostname: string; name: string; statusPrio: number }

// Unified interleaved + sorted list for both grid and list views
const unifiedWorkloads = computed(() => {
  const items: WorkloadItem[] = [
    ...displayVms.value.map(vm => ({
      kind: 'vm' as const, vm, name: vm.name,
      statusPrio: workloadStatusPrio(vm.status),
    })),
    ...filteredContainers.value.map(c => ({
      kind: 'container' as const, container: c, name: c.name,
      statusPrio: workloadStatusPrio(c.status),
    })),
    // Remote workloads join the same sorted stream — hidden when a container filter is active
    ...(!isContainerFilter.value ? remoteWorkloads.value.map(r => ({
      kind: 'remote' as const, vm: r.vm, remoteHostname: r.remoteHostname,
      name: r.vm.name, statusPrio: workloadStatusPrio(r.vm.status),
    })) : []),
  ]
  const pref = uiStore.sortPreference
  if (pref === 'status-az') {
    return [...items].sort((a, b) => {
      if (a.statusPrio !== b.statusPrio) return a.statusPrio - b.statusPrio
      const pd = resourcePressure(b) - resourcePressure(a)  // higher pressure first
      return pd !== 0 ? pd : a.name.localeCompare(b.name)
    })
  }
  if (pref === 'name-asc') return [...items].sort((a, b) => a.name.localeCompare(b.name))
  if (pref === 'name-desc') return [...items].sort((a, b) => b.name.localeCompare(a.name))
  return items
})

// Containers to display — hidden on VMs filter, narrowed by runtime filter
const filteredContainers = computed(() => {
  if (activeFilter.value === 'vms') return []
  if (!hasContainers.value) return []
  const q = uiStore.searchQuery.toLowerCase().trim()
  let list = q
    ? visibleContainers.value.filter(c => c.name.toLowerCase().includes(q) || c.image.toLowerCase().includes(q))
    : [...visibleContainers.value]

  // Runtime filter
  if (isContainerFilter.value) {
    list = list.filter(c => c.runtime === activeFilter.value)
  }

  const pref = uiStore.sortPreference
  if (pref === 'status-az') {
    list = list.sort((a, b) => {
      const pa = workloadStatusPrio(a.status)
      const pb = workloadStatusPrio(b.status)
      if (pa !== pb) return pa - pb
      const pd = (b.cpuPercent ?? 0) - (a.cpuPercent ?? 0)
      return pd !== 0 ? pd : a.name.localeCompare(b.name)
    })
  } else if (pref === 'name-asc') {
    list = list.sort((a, b) => a.name.localeCompare(b.name))
  } else if (pref === 'name-desc') {
    list = list.sort((a, b) => b.name.localeCompare(a.name))
  }
  return list
})

// Sync WebSocket data to Pinia store
watch(vms, (newVms) => {
  if (newVms.length > 0) {
    workloadStore.updateWorkloads(newVms)
  }
})

// Show Getting Started wizard on first visit (user hasn't dismissed it yet)
watch(connected, (isConnected) => {
  if (isConnected && !settingsStore.hasSeenWizard) {
    showWizard.value = true
  }
})

// Demo replay: open onboarding wizard when triggered from demo toolbar
function onDemoReplayOnboarding() {
  showWizard.value = true
}

// Signal milestone modal after wizard closes (private demo flow: blank canvas → wizard → v1.0 modal)
watch(showWizard, (open, wasOpen) => {
  if (isDemoMode() && wasOpen && !open) {
    window.dispatchEvent(new CustomEvent('demo:onboarding-complete'))
  }
})

onMounted(() => {
  if (isDemoMode()) {
    window.addEventListener('demo:replay-onboarding', onDemoReplayOnboarding)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('demo:replay-onboarding', onDemoReplayOnboarding)
})
</script>


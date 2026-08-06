<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  Container detail panel — renders inside the ResourceDetailDrawer.
  Accepts a containerId prop and resolves it against the unified workload store
  (WVR-72) on a real backend, or the mock catalogue in demo mode.
-->
<template>
  <div class="container-detail-panel column full-height">

    <!-- Panel header -->
    <div class="row items-center no-wrap q-pa-md q-pb-sm">
      <q-icon :name="runtimeIcon(container?.runtime ?? 'docker')" size="22px" :color="runtimeColor(container?.runtime ?? 'docker')" class="q-mr-sm" />
      <div class="col">
        <div class="text-h6 ellipsis">{{ container?.name ?? containerId }}</div>
        <div class="row items-center q-gutter-xs q-mt-xs">
          <StatusBadge v-if="container" :status="effectiveStatus === STATUSES.RUNNING ? STATUSES.RUNNING : STATUSES.STOPPED" />
          <q-badge v-if="container" :color="runtimeColor(container.runtime)" :label="container.runtime" />
        </div>
      </div>
      <q-btn flat round dense icon="mdi-close" @click="drawerStore.close()" />
    </div>

    <q-separator />

    <!-- Not found -->
    <div v-if="!container" class="col flex flex-center column text-center q-pa-lg">
      <q-icon name="mdi-docker" size="48px" color="grey-5" />
      <div class="text-body2 text-grey-8 q-mt-sm">Container "{{ containerId }}" not found</div>
    </div>

    <!-- Main content (scrollable) -->
    <div v-else class="col scroll q-pa-md">

      <!-- Image row -->
      <div class="text-caption text-grey-6 q-mb-md">{{ container.image }}</div>

      <!-- Apptainer upgrade nag (free tier, weaver required) -->
      <q-card-section v-if="container.runtime === 'apptainer' && !appStore.isSolo" class="q-pa-none q-mb-md">
        <UpgradeNag feature-name="Apptainer visibility" :required-tier="TIERS.SOLO" />
      </q-card-section>

      <!-- Full content (weaver+ or non-Apptainer) -->
      <template v-else>

        <!-- Actions -->
        <div class="row q-gutter-xs q-mb-md wrap">
          <template v-if="appStore.isDemoVersionAtLeast('1.2') && authStore.canManageContainers">
            <q-btn
              v-if="effectiveStatus === STATUSES.RUNNING"
              outline size="sm" color="grey-7" icon="mdi-stop" label="Stop"
              :loading="demoState.isLoading(containerId)"
              @click="handleStop"
            />
            <q-btn
              v-else
              outline size="sm" color="positive" icon="mdi-play" label="Start"
              :loading="demoState.isLoading(containerId)"
              @click="handleStart"
            />
          </template>
          <q-btn
            v-if="appStore.isDemoVersionAtLeast('1.2') && authStore.canDeleteContainers"
            outline size="sm" color="negative" icon="mdi-delete" label="Remove"
            @click="handleRemove"
          />
          <q-space />
          <q-btn size="sm" color="info" icon="mdi-stethoscope" label="Diagnose" :loading="agentLoading" @click="startAgentAction('diagnose')" />
          <q-btn flat size="sm" color="info" icon="mdi-information" label="Explain" :loading="agentLoading" @click="startAgentAction('explain')" />
          <q-btn flat size="sm" color="info" icon="mdi-lightbulb" label="Suggest" :loading="agentLoading" @click="startAgentAction('suggest')" />
        </div>

        <!-- Stats row -->
        <div
          v-if="container.cpuPercent !== undefined || container.memoryUsageMb !== undefined"
          class="row q-gutter-sm q-mb-md"
        >
          <q-card v-if="container.cpuPercent !== undefined" flat bordered class="col-auto">
            <q-card-section class="q-pa-sm" style="min-width: 100px">
              <div class="text-caption text-grey-8">CPU</div>
              <q-linear-progress
                :value="container.cpuPercent / 100"
                :color="container.cpuPercent > 80 ? 'warning' : 'primary'"
                size="4px"
                class="q-mt-xs q-mb-xs"
              />
              <div class="text-caption text-weight-medium">{{ container.cpuPercent }}%</div>
            </q-card-section>
          </q-card>
          <q-card v-if="container.memoryUsageMb !== undefined" flat bordered class="col-auto">
            <q-card-section class="q-pa-sm" style="min-width: 100px">
              <div class="text-caption text-grey-8">Memory</div>
              <q-linear-progress
                :value="container.memoryLimitMb ? container.memoryUsageMb / container.memoryLimitMb : 0"
                :color="(container.memoryLimitMb && container.memoryUsageMb / container.memoryLimitMb > 0.85) ? 'warning' : 'teal'"
                size="4px"
                class="q-mt-xs q-mb-xs"
              />
              <div class="text-caption text-weight-medium">{{ container.memoryUsageMb }}M</div>
            </q-card-section>
          </q-card>
          <q-card flat bordered class="col-auto">
            <q-card-section class="q-pa-sm" style="min-width: 80px">
              <div class="text-caption text-grey-8">Created</div>
              <div class="text-caption text-weight-medium">{{ createdAgo }}</div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Tabs -->
        <q-card flat bordered>
          <q-tabs
            v-model="activeTab"
            dense class="text-grey-8"
            active-color="primary" indicator-color="primary"
            align="left" narrow-indicator
          >
            <q-tab name="ports" label="Ports" icon="mdi-lan-connect" />
            <q-tab name="mounts" label="Mounts" icon="mdi-folder-open" />
            <q-tab name="labels" label="Labels" icon="mdi-tag-multiple" />
            <q-tab name="logs" label="Logs" icon="mdi-text-box" data-testid="container-logs-tab" />
            <q-tab name="ai" label="AI" icon="mdi-robot" />
          </q-tabs>
          <q-separator />
          <q-tab-panels v-model="activeTab" animated>

            <!-- Port Mappings -->
            <q-tab-panel name="ports">
              <div v-if="container.ports?.length">
                <q-markup-table flat bordered dense>
                  <thead>
                    <tr>
                      <th class="text-left text-caption">Host Port</th>
                      <th class="text-left text-caption">Container Port</th>
                      <th class="text-left text-caption">Protocol</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in container.ports" :key="`${p.hostPort}-${p.containerPort}`">
                      <td class="text-caption">{{ p.hostPort }}</td>
                      <td class="text-caption">{{ p.containerPort }}</td>
                      <td class="text-caption">{{ p.protocol.toUpperCase() }}</td>
                    </tr>
                  </tbody>
                </q-markup-table>
              </div>
              <div v-else class="text-center text-grey-8 q-pa-md">
                <q-icon name="mdi-lan-disconnect" size="36px" class="q-mb-sm" />
                <div class="text-caption">No port mappings configured.</div>
              </div>
            </q-tab-panel>

            <!-- Volume Mounts -->
            <q-tab-panel name="mounts">
              <div v-if="container.mounts?.length">
                <q-markup-table flat bordered dense>
                  <thead>
                    <tr>
                      <th class="text-left text-caption">Source</th>
                      <th class="text-left text-caption">Destination</th>
                      <th class="text-left text-caption">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(m, i) in container.mounts" :key="i">
                      <td class="text-caption mount-path">{{ m.source }}</td>
                      <td class="text-caption mount-path">{{ m.destination }}</td>
                      <td class="text-caption">{{ m.readonly ? 'RO' : 'RW' }}</td>
                    </tr>
                  </tbody>
                </q-markup-table>
              </div>
              <div v-else class="text-center text-grey-8 q-pa-md">
                <q-icon name="mdi-folder-off" size="36px" class="q-mb-sm" />
                <div class="text-caption">No volume mounts configured.</div>
              </div>
            </q-tab-panel>

            <!-- Labels -->
            <q-tab-panel name="labels">
              <div v-if="hasLabels" class="row q-gutter-xs">
                <q-badge
                  v-for="[k, v] in labelEntries"
                  :key="k"
                  :outline="!isApptainerHighlightedLabel(k)"
                  :color="isApptainerHighlightedLabel(k) ? 'deep-purple-6' : 'grey-7'"
                  :label="`${k}: ${v}`"
                  style="font-size: 0.65rem"
                />
              </div>
              <div v-else class="text-center text-grey-8 q-pa-md">
                <q-icon name="mdi-tag-off" size="36px" class="q-mb-sm" />
                <div class="text-caption">No labels defined.</div>
              </div>
            </q-tab-panel>

            <!-- Runtime Logs — on-demand fetch, never a poll -->
            <q-tab-panel name="logs">
              <div class="row items-center q-mb-sm">
                <div class="text-subtitle2">Runtime Logs</div>
                <q-space />
                <q-btn
                  flat dense size="sm" icon="mdi-refresh" label="Refresh"
                  data-testid="container-logs-refresh"
                  :loading="logsLoading"
                  @click="loadLogs"
                />
              </div>
              <div class="log-block rounded-borders q-pa-sm" data-testid="container-logs-output">
                <div v-if="logsLoading" class="text-grey-6 text-mono">Loading...</div>
                <div
                  v-else-if="logsContent"
                  class="text-grey-7 text-mono"
                  style="white-space: pre-wrap; font-size: 12px;"
                >{{ logsContent }}</div>
                <div v-else class="text-grey-6 text-mono">No runtime logs available.</div>
              </div>
            </q-tab-panel>

            <!-- AI History -->
            <q-tab-panel name="ai">
              <div class="text-subtitle2 q-mb-sm">AI Analysis History</div>
              <div v-if="containerOperations.length === 0" class="text-center text-grey-8 q-pa-md">
                <q-icon name="mdi-robot" size="36px" class="q-mb-sm" />
                <div class="text-caption">No AI analysis run yet.</div>
              </div>
              <q-list v-else dense separator>
                <q-item
                  v-for="op in containerOperations"
                  :key="op.operationId"
                  clickable
                  @click="viewOperation(op.operationId)"
                >
                  <q-item-section avatar>
                    <q-icon
                      :name="op.action === 'diagnose' ? 'mdi-stethoscope' : op.action === 'explain' ? 'mdi-information' : 'mdi-lightbulb'"
                      :color="op.status === 'complete' ? 'positive' : op.status === 'error' ? 'negative' : 'info'"
                      size="20px"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ op.action.charAt(0).toUpperCase() + op.action.slice(1) }}</q-item-label>
                    <q-item-label caption>{{ op.startedAt }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-badge :color="op.status === 'complete' ? 'positive' : op.status === 'error' ? 'negative' : 'info'" :label="op.status" rounded />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-tab-panel>

          </q-tab-panels>
        </q-card>

      </template>
    </div>

    <!-- Agent Dialog -->
    <AgentDialog v-model="agentDialogOpen" :resource-id="containerId" :action="currentAgentAction" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import StatusBadge from 'src/components/StatusBadge.vue'
import AgentDialog from 'src/components/AgentDialog.vue'
import UpgradeNag from 'src/components/nag/UpgradeNag.vue'
import { useAgent } from 'src/composables/useAgent'
import { useAgentStream } from 'src/composables/useAgentStream'
import { useDemoContainerState } from 'src/composables/useDemoContainerState'
import { useAgentStore } from 'src/stores/agent-store'
import { useAuthStore } from 'src/stores/auth-store'
import { useAppStore } from 'src/stores/app'
import { useResourceDrawerStore } from 'src/stores/resource-drawer-store'
import { useWorkloadStore } from 'src/stores/workload-store'
import { useWorkloadApi } from 'src/composables/useVmApi'
import { getDemoContainersForTier } from 'src/config/demo'
import { isDemoMode } from 'src/config/demo-mode'
import { isContainerRuntime, mapToContainerInfo } from 'src/utils/container'
import type { ContainerInfo, ContainerRuntime } from 'src/types/container'
import type { AgentAction } from 'src/types/agent'
import { TIERS, STATUSES } from 'src/constants/vocabularies'

const props = defineProps<{ containerId: string }>()

const $q = useQuasar()
const appStore = useAppStore()
const authStore = useAuthStore()
const agentStore = useAgentStore()
const drawerStore = useResourceDrawerStore()
const workloadStore = useWorkloadStore()
const demoState = useDemoContainerState()
const { runAgent, loading: agentLoading } = useAgent()
const { fetchLogs } = useWorkloadApi()
useAgentStream()

const activeTab = ref('ports')
const agentDialogOpen = ref(false)
const currentAgentAction = ref<AgentAction>('diagnose')
const logsContent = ref('')
const logsLoading = ref(false)

// Demo mode reads the mock catalogue; a real backend reads the unified workload
// store (WVR-72) through the shared container projection.
//
// This used to read demo data UNCONDITIONALLY, which made the panel dead on a
// real backend: `getDemoContainersForTier` degrades to `() => []` once
// demo-data.ts is stripped from the build, and even on a Dev build a real
// container's id never appears in the mock catalogue — so every real container
// opened this panel and got "not found". Same shape as the TagManagement defect
// this slice's spec calls out: a component idling against demo data, wrong in
// production, invisible in demo.
const container = computed<ContainerInfo | null>(() => {
  const matches = (c: ContainerInfo) => c.id === props.containerId || c.name === props.containerId

  if (isDemoMode()) {
    return getDemoContainersForTier(appStore.effectiveTier).find(matches) ?? null
  }

  const workload = workloadStore.workloads
    .filter(w => isContainerRuntime(w.runtime))
    .map(mapToContainerInfo)
    .find(matches)
  return workload ?? null
})

const effectiveStatus = computed(() =>
  demoState.getStatus(props.containerId, container.value?.status ?? STATUSES.UNKNOWN) // ContainerStatus literal
)

const hasLabels = computed(() =>
  !!container.value?.labels && Object.keys(container.value.labels).length > 0
)

const labelEntries = computed(() =>
  container.value?.labels ? Object.entries(container.value.labels) : []
)

const containerOperations = computed(() =>
  agentStore.operationsForVm(props.containerId)
)

const createdAgo = computed(() => {
  if (!container.value) return ''
  // The unified workload model carries no creation timestamp, so a real
  // container's `created` is '' — guard the parse rather than render "NaN days
  // ago".
  const createdMs = new Date(container.value.created).getTime()
  if (Number.isNaN(createdMs)) return 'unknown'
  const days = Math.floor((Date.now() - createdMs) / 86400000)
  return days === 0 ? 'today' : `${days} days ago`
})

// Reset tab and drop the previous container's logs when switching containers.
watch(() => props.containerId, () => {
  activeTab.value = 'ports'
  logsContent.value = ''
})

// Fetch on demand, NEVER on a timer.
//
// `GET /api/workload/:name/logs` shells out (`docker logs`, or an Apptainer
// instance lookup plus two file reads) and carries a 10/min per-route limit for
// that reason — see G-backend-2026-06-02-01KYSBXCJ6TK3E22T062RD230G, which the
// route's own comment names as the paired obligation on this UI. So: once when
// the operator opens the tab and has no logs yet, and thereafter only when they
// press Refresh. No interval, no watcher on status, no refetch on WebSocket
// broadcast.
watch(activeTab, (tab) => {
  if (tab === 'logs' && !logsContent.value) void loadLogs()
})

async function loadLogs() {
  if (!container.value) return
  logsLoading.value = true
  try {
    logsContent.value = await fetchLogs(container.value.name)
  } catch {
    logsContent.value = ''
  } finally {
    logsLoading.value = false
  }
}

function runtimeIcon(rt: ContainerRuntime): string {
  if (rt === 'docker') return 'mdi-docker'
  if (rt === 'podman') return 'mdi-cow'
  return 'mdi-layers-outline'
}

function runtimeColor(rt: ContainerRuntime): string {
  if (rt === 'docker') return 'blue-7'
  if (rt === 'podman') return 'teal-7'
  return 'deep-purple-6'
}

function isApptainerHighlightedLabel(key: string): boolean {
  return container.value?.runtime === 'apptainer' && (key === 'job' || key === 'user')
}

async function handleStart() {
  await demoState.startContainer(props.containerId)
  $q.notify({ type: 'positive', message: `Container '${container.value?.name}' started`, position: 'top-right', timeout: 3000 })
}

async function handleStop() {
  await demoState.stopContainer(props.containerId)
  $q.notify({ type: 'info', message: `Container '${container.value?.name}' stopped`, position: 'top-right', timeout: 3000 })
}

function handleRemove() {
  drawerStore.close()
  $q.notify({ type: 'warning', message: 'Container removed (demo)', position: 'top-right', timeout: 3000 })
}

async function startAgentAction(action: AgentAction) {
  currentAgentAction.value = action
  agentDialogOpen.value = true
  const operationId = await runAgent(props.containerId, action, undefined, 'container')
  if (!operationId) {
    $q.notify({ type: 'negative', message: 'Failed to start AI agent', position: 'top-right', timeout: 5000 })
  }
}

function viewOperation(operationId: string) {
  const op = agentStore.operations[operationId]
  if (op) {
    agentStore.activeOperationId = operationId
    currentAgentAction.value = op.action
    agentDialogOpen.value = true
  }
}
</script>

<style scoped lang="scss">
.container-detail-panel {
  overflow: hidden;
}

.mount-path {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.7rem;
  word-break: break-all;
}

// Matches VmDetailPanel's logs surface — a bounded, scrollable block with an
// explicit max-height. A q-scroll-area would collapse to 0 here (no
// deterministic height on an ancestor); see the Quasar note in
// .claude/rules/frontend.md.
.log-block {
  background: #1e1e1e;
  min-height: 120px;
  max-height: 300px;
  overflow-y: auto;
}

.body--light .log-block {
  background: #263238;
}
</style>

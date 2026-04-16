<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  VM detail panel — renders inside the ResourceDetailDrawer.
  Mirrors VmDetailPage content without page-level chrome.
-->
<template>
  <div class="vm-detail-panel column full-height">

    <!-- Panel header -->
    <div class="row items-center no-wrap q-pa-md q-pb-sm">
      <q-icon :name="vmTypeIcon(vm?.vmType)" :color="vmTypeColor(vm?.vmType)" size="22px" class="q-mr-sm" />
      <div class="col">
        <div class="text-h6 ellipsis">{{ vmName }}</div>
        <div class="row items-center q-gutter-xs q-mt-xs">
          <StatusBadge v-if="vm" :status="vm.status" />
          <q-badge v-if="vm?.autostart" color="teal" rounded label="autostart" />
          <q-badge v-if="vm?.provisioningState === PROVISIONING.PROVISIONING" color="blue" rounded>
            <q-spinner-dots size="12px" class="q-mr-xs" />Provisioning
          </q-badge>
          <q-badge v-else-if="vm?.provisioningState === PROVISIONING.PROVISION_FAILED" color="negative" rounded>
            <q-icon name="mdi-alert-circle" size="14px" class="q-mr-xs" />Failed
          </q-badge>
        </div>
      </div>
      <q-btn flat round dense icon="mdi-close" @click="drawerStore.close()" />
    </div>

    <q-separator />

    <!-- Loading / Error / Not found -->
    <div v-if="loading" class="col flex flex-center">
      <q-spinner-dots size="40px" color="primary" />
    </div>
    <div v-else-if="error" class="col flex flex-center column text-center q-pa-lg">
      <q-icon name="mdi-alert-circle" size="48px" color="negative" />
      <div class="text-body2 text-negative q-mt-sm">{{ error }}</div>
      <q-btn flat color="primary" label="Retry" class="q-mt-sm" @click="loadVm" />
    </div>
    <div v-else-if="!vm" class="col flex flex-center column text-center q-pa-lg">
      <q-icon name="mdi-server-off" size="48px" color="grey-5" />
      <div class="text-body2 text-grey-8 q-mt-sm">VM "{{ vmName }}" not found</div>
    </div>

    <!-- Main content (scrollable) -->
    <div v-else class="col scroll q-pa-md">

      <!-- Description (click-to-edit) -->
      <div class="q-mb-sm">
        <q-input
          v-if="editingDescription"
          v-model="descriptionInput"
          dense outlined autofocus
          placeholder="Add a description..."
          maxlength="500"
          @keyup.enter="saveDescription"
          @keyup.escape="cancelDescription"
          @blur="saveDescription"
        />
        <div
          v-else
          class="text-caption cursor-pointer"
          :class="vm.description ? 'text-grey-7' : 'text-grey-7'"
          @click="startEditDescription"
        >
          {{ vm.description || 'Add a description...' }}
          <q-icon name="mdi-pencil" size="12px" class="q-ml-xs" />
        </div>
      </div>

      <!-- Tags -->
      <div v-if="authStore.canManageVms" class="q-mb-sm">
        <TagEditor :tags="vm.tags ?? []" @update:tags="saveTags" />
      </div>
      <div v-else-if="vm.tags?.length" class="row q-gutter-xs q-mb-sm">
        <q-chip v-for="tag in vm.tags" :key="tag" dense outline size="xs" color="primary">{{ tag }}</q-chip>
      </div>

      <!-- Actions -->
      <div class="row q-gutter-xs q-mb-md wrap">
        <q-btn
          v-if="authStore.canManageVms && isActionable && vm.status !== STATUSES.RUNNING"
          outline size="sm" color="positive" icon="mdi-play" label="Start"
          :loading="actionLoading" @click="handleAction('start')"
        />
        <q-btn
          v-if="authStore.canManageVms && isActionable && vm.status === STATUSES.RUNNING"
          outline size="sm" color="negative" icon="mdi-stop" label="Stop"
          :loading="actionLoading" @click="handleAction('stop')"
        />
        <q-btn
          v-if="authStore.canManageVms && isActionable && vm.status === STATUSES.RUNNING"
          outline size="sm" color="warning" icon="mdi-restart" label="Restart"
          :loading="actionLoading" @click="handleAction('restart')"
        />
        <q-btn
          v-if="authStore.canDeleteVms && appStore.isWeaver"
          outline size="sm" color="negative" icon="mdi-delete" label="Delete"
          :loading="deleteLoading" @click="handleDelete"
        />
        <q-btn
          v-if="isDemoMode() && appStore.isDemoVersionAtLeast('1.1') && appStore.isWeaver"
          outline size="sm" color="secondary" icon="mdi-content-copy" label="Clone"
          :loading="cloneLoading" @click="handleClone"
        />
        <q-space />
        <q-btn size="sm" color="info" icon="mdi-stethoscope" label="Diagnose" :loading="agentLoading" @click="startAgentAction('diagnose')" />
        <q-btn flat size="sm" color="info" icon="mdi-information" label="Explain" :loading="agentLoading" @click="startAgentAction('explain')" />
        <q-btn flat size="sm" color="info" icon="mdi-lightbulb" label="Suggest" :loading="agentLoading" @click="startAgentAction('suggest')" />
      </div>

      <!-- Compact stats row -->
      <div class="row q-gutter-sm q-mb-md">
        <q-card flat bordered class="col-auto">
          <q-card-section class="q-pa-sm text-center" style="min-width: 70px">
            <div class="text-caption text-grey-8">IP</div>
            <div class="text-caption text-weight-medium">{{ vm.ip || '—' }}</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="col-auto">
          <q-card-section class="q-pa-sm text-center" style="min-width: 70px">
            <div class="text-caption text-grey-8">Memory</div>
            <div class="text-caption text-weight-medium">{{ vm.mem }} MB</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="col-auto">
          <q-card-section class="q-pa-sm text-center" style="min-width: 50px">
            <div class="text-caption text-grey-8">vCPU</div>
            <div class="text-caption text-weight-medium">{{ vm.vcpu }}</div>
          </q-card-section>
        </q-card>
        <q-card v-if="vm.diskSize" flat bordered class="col-auto">
          <q-card-section class="q-pa-sm text-center" style="min-width: 60px">
            <div class="text-caption text-grey-8">Disk</div>
            <div class="text-caption text-weight-medium">{{ vm.diskSize }} GB</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="col-auto">
          <q-card-section class="q-pa-sm text-center" style="min-width: 80px">
            <div class="text-caption text-grey-8">Hypervisor</div>
            <div class="text-caption text-weight-medium">{{ vm.hypervisor }}</div>
          </q-card-section>
        </q-card>
        <q-card v-if="vm.uptime" flat bordered class="col-auto">
          <q-card-section class="q-pa-sm text-center" style="min-width: 70px">
            <div class="text-caption text-grey-8">Uptime</div>
            <div class="text-caption text-weight-medium">{{ formatUptime(vm.uptime) || vm.uptime }}</div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Resource metrics (demo v1.1+) -->
      <template v-if="isDemoMode()">
        <VersionNag
          v-if="!appStore.isDemoVersionAtLeast('1.1')"
          version="1.1"
          title="Resource Metrics"
          description="CPU, memory, and disk I/O charts"
          class="q-mb-md"
        />
        <DemoResourceGraph v-else :vm-name="vm.name" :vm-status="vm.status" class="q-mb-md" />
      </template>

      <!-- Tabs -->
      <q-card flat bordered>
        <q-tabs
          v-model="activeTab"
          dense class="text-grey-8"
          active-color="primary" indicator-color="primary"
          align="left" narrow-indicator
        >
          <q-tab name="config" label="Config" icon="mdi-cog" />
          <q-tab name="networking" label="Network" icon="mdi-lan" />
          <q-tab name="logs" label="Logs" icon="mdi-text-box" />
          <q-tab name="console" label="Console" icon="mdi-console" />
          <q-tab name="ai" label="AI" icon="mdi-robot" />
        </q-tabs>
        <q-separator />
        <q-tab-panels v-model="activeTab" animated>

          <!-- Config -->
          <q-tab-panel name="config">
            <q-list dense separator>
              <q-item>
                <q-item-section><q-item-label caption>Hypervisor</q-item-label></q-item-section>
                <q-item-section side><q-item-label class="text-weight-medium">{{ vm.hypervisor }}</q-item-label></q-item-section>
              </q-item>
              <q-item>
                <q-item-section><q-item-label caption>Memory</q-item-label></q-item-section>
                <q-item-section side><q-item-label class="text-weight-medium">{{ vm.mem }} MB</q-item-label></q-item-section>
              </q-item>
              <q-item>
                <q-item-section><q-item-label caption>vCPUs</q-item-label></q-item-section>
                <q-item-section side><q-item-label class="text-weight-medium">{{ vm.vcpu }}</q-item-label></q-item-section>
              </q-item>
              <q-item v-if="vm.diskSize">
                <q-item-section><q-item-label caption>Disk</q-item-label></q-item-section>
                <q-item-section side><q-item-label class="text-weight-medium">{{ vm.diskSize }} GB</q-item-label></q-item-section>
              </q-item>
              <q-item v-if="vm.distro">
                <q-item-section><q-item-label caption>Distribution</q-item-label></q-item-section>
                <q-item-section side><q-item-label class="text-weight-medium">{{ vm.distro }}</q-item-label></q-item-section>
              </q-item>
              <q-item v-if="authStore.canManageVms">
                <q-item-section>
                  <q-item-label caption>Auto-start</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle :model-value="vm.autostart ?? false" :loading="autostartLoading" @update:model-value="toggleAutostart" />
                </q-item-section>
              </q-item>
            </q-list>

            <!-- AI Provider override (Fabrick admin) -->
            <template v-if="authStore.isAdmin && appStore.isFabrick">
              <q-separator class="q-my-sm" />
              <div class="row items-center q-mb-xs">
                <div class="text-caption text-grey-7">AI Provider Override</div>
                <q-badge outline color="amber-9" label="FabricK" class="q-ml-sm" size="xs" />
              </div>
              <q-select
                v-model="vmAiProvider"
                :options="vmAiProviderOptions"
                emit-value map-options
                dense outlined
                hint="Overrides the user's BYOK preference for this workload"
              />
            </template>
          </q-tab-panel>

          <!-- Networking -->
          <q-tab-panel name="networking">
            <div class="row items-center q-mb-sm">
              <div class="text-subtitle2">Network</div>
              <q-space />
              <q-btn flat size="sm" color="primary" icon="mdi-lan" label="Topology" to="/network" @click="drawerStore.close()" />
            </div>
            <q-list dense separator>
              <q-item>
                <q-item-section><q-item-label caption>IP Address</q-item-label></q-item-section>
                <q-item-section side><q-item-label class="text-weight-medium text-mono">{{ vm.ip || 'Not assigned' }}</q-item-label></q-item-section>
              </q-item>
              <q-item v-if="vm.macAddress">
                <q-item-section><q-item-label caption>MAC Address</q-item-label></q-item-section>
                <q-item-section side><q-item-label class="text-weight-medium text-mono">{{ vm.macAddress }}</q-item-label></q-item-section>
              </q-item>
              <q-item v-if="vm.tapInterface">
                <q-item-section><q-item-label caption>TAP Interface</q-item-label></q-item-section>
                <q-item-section side><q-item-label class="text-weight-medium text-mono">{{ vm.tapInterface }}</q-item-label></q-item-section>
              </q-item>
            </q-list>
          </q-tab-panel>

          <!-- Logs -->
          <q-tab-panel name="logs">
            <div class="row items-center q-mb-sm">
              <div class="text-subtitle2">Provisioning Logs</div>
              <q-space />
              <q-btn flat dense size="sm" icon="mdi-refresh" label="Refresh" :loading="logsLoading" @click="loadLogs" />
            </div>
            <div class="log-block rounded-borders q-pa-sm">
              <div v-if="logsLoading" class="text-grey-6 text-mono">Loading...</div>
              <div v-else-if="logsContent" class="text-grey-7 text-mono" style="white-space: pre-wrap; font-size: 12px;">{{ logsContent }}</div>
              <div v-else class="text-grey-6 text-mono">No provisioning logs available.</div>
            </div>
          </q-tab-panel>

          <!-- Console -->
          <q-tab-panel name="console">
            <div v-if="vm.status === STATUSES.RUNNING">
              <SerialConsole v-if="appStore.isWeaver" :vm-name="vmName" :active="activeTab === 'console'" />
              <VmConsole v-else :vm-name="vmName" :active="activeTab === 'console'" />
            </div>
            <div v-else class="text-center text-grey-8 q-pa-md">
              <q-icon name="mdi-console" size="36px" class="q-mb-sm" />
              <div class="text-caption">Console available when VM is running.</div>
            </div>
          </q-tab-panel>

          <!-- AI History -->
          <q-tab-panel name="ai">
            <div class="text-subtitle2 q-mb-sm">AI Analysis History</div>
            <div v-if="vmOperations.length === 0" class="text-center text-grey-8 q-pa-md">
              <q-icon name="mdi-robot" size="36px" class="q-mb-sm" />
              <div class="text-caption">No AI analysis run yet.</div>
            </div>
            <q-list v-else dense separator>
              <q-item
                v-for="op in vmOperations"
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
    </div>

    <!-- Agent Dialog -->
    <AgentDialog v-model="agentDialogOpen" :resource-id="vmName" :action="currentAgentAction" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed, defineAsyncComponent } from 'vue'
import { useQuasar } from 'quasar'
import StatusBadge from 'src/components/StatusBadge.vue'
import AgentDialog from 'src/components/AgentDialog.vue'
import TagEditor from 'src/components/TagEditor.vue'
import HelpTooltip from 'src/components/HelpTooltip.vue'
import VersionNag from 'src/components/demo/VersionNag.vue'
import DemoResourceGraph from 'src/components/demo/DemoResourceGraph.vue'
import { useWorkloadApi } from 'src/composables/useVmApi'
import { useWorkloadStatus } from 'src/composables/useVmStatus'
import { useAgent } from 'src/composables/useAgent'
import { useAgentStream } from 'src/composables/useAgentStream'
import { useWorkloadStore } from 'src/stores/workload-store'
import { useAgentStore } from 'src/stores/agent-store'
import { useAuthStore } from 'src/stores/auth-store'
import { useAppStore } from 'src/stores/app'
import { useResourceDrawerStore } from 'src/stores/resource-drawer-store'
import { formatUptime } from 'src/utils/format'
import { vmTypeIcon, vmTypeColor } from 'src/utils/vm'
import { extractErrorMessage } from 'src/utils/error'
import { isDemoMode } from 'src/config/demo'
import type { WorkloadInfo, WorkloadAction } from 'src/types/workload'
import type { AgentAction } from 'src/types/agent'
import { STATUSES, PROVISIONING } from 'src/constants/vocabularies'

const VmConsole = defineAsyncComponent(() => import('src/components/VmConsole.vue'))
const SerialConsole = defineAsyncComponent(() => import('src/components/SerialConsole.vue'))

// suppress unused warning — used in template
void HelpTooltip

const props = defineProps<{ vmName: string }>()

const $q = useQuasar()
const workloadStore = useWorkloadStore()
const authStore = useAuthStore()
const appStore = useAppStore()
const agentStore = useAgentStore()
const drawerStore = useResourceDrawerStore()
const { fetchVm, vmAction, deleteVm, cloneVm, fetchLogs, setAutostart, setDescription, setTags, loading, error } = useWorkloadApi()
const { vms: wsVms } = useWorkloadStatus()
const { runAgent, loading: agentLoading } = useAgent()
useAgentStream()

const vm = ref<WorkloadInfo | null>(null)
const activeTab = ref('config')
const actionLoading = ref(false)
const agentDialogOpen = ref(false)
const currentAgentAction = ref<AgentAction>('diagnose')
const editingDescription = ref(false)
const descriptionInput = ref('')
const autostartLoading = ref(false)
const deleteLoading = ref(false)
const cloneLoading = ref(false)
const logsContent = ref('')
const logsLoading = ref(false)

const isActionable = computed(() => {
  const state = vm.value?.provisioningState
  return !state || state === PROVISIONING.PROVISIONED
})

// --- Per-workload AI provider override (Fabrick admin) ---
const vmAiProviderOptions = [
  { label: 'Default (user preference)', value: 'default' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'ZenCoder', value: 'zencoder' },
  { label: 'Local LLM (air-gap)', value: 'local' },
]
const vmAiProvider = ref('default')

const storeVm = computed(() => workloadStore.workloadByName(props.vmName))
const vmOperations = computed(() => agentStore.operationsForVm(props.vmName))

watch(wsVms, (newVms) => { if (newVms.length > 0) workloadStore.updateWorkloads(newVms) })
watch(storeVm, (newVm) => { if (newVm) vm.value = newVm })
watch(activeTab, (tab) => { if (tab === 'logs' && !logsContent.value) void loadLogs() })

// Reload when the drawer opens a different VM
watch(() => props.vmName, () => {
  vm.value = storeVm.value ?? null
  if (!vm.value) void loadVm()
  logsContent.value = ''
  activeTab.value = 'config'
})

async function loadVm() {
  const result = await fetchVm(props.vmName)
  if (result) vm.value = result
}

async function loadLogs() {
  logsLoading.value = true
  try {
    logsContent.value = await fetchLogs(props.vmName)
  } catch {
    logsContent.value = ''
  } finally {
    logsLoading.value = false
    error.value = null
  }
}

function startEditDescription() {
  if (!authStore.canManageVms) return
  descriptionInput.value = vm.value?.description ?? ''
  editingDescription.value = true
}
function cancelDescription() { editingDescription.value = false }
async function saveDescription() {
  editingDescription.value = false
  if (!vm.value) return
  const newDesc = descriptionInput.value.trim()
  if (newDesc === (vm.value.description ?? '')) return
  const result = await setDescription(props.vmName, newDesc)
  if (result.success && vm.value) vm.value = { ...vm.value, description: newDesc || undefined }
}

async function saveTags(tags: string[]) {
  if (!vm.value) return
  const result = await setTags(props.vmName, tags)
  if (result.success && vm.value) vm.value = { ...vm.value, tags: result.tags.length > 0 ? result.tags : undefined }
}

async function toggleAutostart(value: boolean | null) {
  if (!vm.value) return
  autostartLoading.value = true
  try {
    const result = await setAutostart(props.vmName, !!value)
    if (result.success && vm.value) vm.value = { ...vm.value, autostart: result.autostart }
  } finally {
    autostartLoading.value = false
  }
}

async function handleAction(action: WorkloadAction) {
  actionLoading.value = true
  try {
    const result = await vmAction(props.vmName, action)
    if (result.success) {
      $q.notify({ type: 'positive', message: result.message || `VM ${props.vmName} ${action} successful`, position: 'top-right', timeout: 3000 })
      await loadVm()
    } else {
      $q.notify({ type: 'negative', message: result.message || `Failed to ${action} VM`, position: 'top-right', timeout: 5000 })
    }
  } catch (err) {
    $q.notify({ type: 'negative', message: extractErrorMessage(err, `Failed to ${action} VM`), position: 'top-right', timeout: 5000 })
  } finally {
    actionLoading.value = false
  }
}

function handleDelete() {
  $q.dialog({
    title: 'Delete VM',
    message: `Delete <strong>${props.vmName}</strong>? This cannot be undone.`,
    html: true, cancel: true, color: 'negative',
    ok: { label: 'Delete', color: 'negative' },
  }).onOk(async () => {
    deleteLoading.value = true
    try {
      const result = await deleteVm(props.vmName)
      if (result.success) {
        workloadStore.removeWorkload(props.vmName)
        drawerStore.close()
        $q.notify({ type: 'positive', message: result.message || `VM ${props.vmName} deleted`, position: 'top-right', timeout: 3000 })
      } else {
        $q.notify({ type: 'negative', message: result.message || 'Delete failed', position: 'top-right', timeout: 5000 })
      }
    } finally {
      deleteLoading.value = false
    }
  })
}

async function handleClone() {
  if (!vm.value) return
  $q.dialog({
    title: 'Clone VM',
    message: `Clone <strong>${props.vmName}</strong>`,
    html: true,
    prompt: { model: `${props.vmName}-clone`, type: 'text', label: 'New VM name' },
    cancel: true, color: 'secondary',
  }).onOk(async (cloneName: string) => {
    const newName = cloneName.trim()
    if (!newName) return
    cloneLoading.value = true
    try {
      const baseIp = vm.value?.ip ?? '10.10.0.99'
      const parts = baseIp.split('.')
      const demoIp = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.${(parseInt(parts[3] ?? '0') + 10) % 256}` : '10.10.0.99'
      const result = await cloneVm(props.vmName, newName, demoIp)
      if (result.success) {
        $q.notify({ type: 'positive', message: result.message || `VM cloned to ${newName}`, position: 'top-right', timeout: 3000 })
        drawerStore.close()
      } else {
        $q.notify({ type: 'negative', message: result.message || 'Clone failed', position: 'top-right', timeout: 5000 })
      }
    } finally {
      cloneLoading.value = false
    }
  })
}

async function startAgentAction(action: AgentAction) {
  currentAgentAction.value = action
  agentDialogOpen.value = true
  const operationId = await runAgent(props.vmName, action)
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

onMounted(() => {
  workloadStore.selectWorkload(props.vmName)
  vm.value = storeVm.value ?? null
  if (!vm.value) void loadVm()
})
</script>

<style scoped lang="scss">
.vm-detail-panel {
  overflow: hidden;
}
.text-mono {
  font-family: 'Roboto Mono', monospace;
}
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

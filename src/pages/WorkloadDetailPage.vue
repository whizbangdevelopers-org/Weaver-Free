<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page class="q-pa-md">
    <!-- Back navigation -->
    <q-btn
      flat
      dense
      icon="mdi-arrow-left"
      label="Back to Weaver"
      class="q-mb-md"
      @click="router.push('/weaver')"
    />

    <!-- Loading state -->
    <div v-if="loading" class="text-center q-pa-xl">
      <q-spinner-dots size="50px" color="primary" />
      <div class="text-h6 q-mt-md text-grey-8">Loading VM details...</div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center q-pa-xl">
      <q-icon name="mdi-alert-circle" size="80px" color="negative" />
      <div class="text-h6 q-mt-md text-negative">{{ error }}</div>
      <q-btn
        color="primary"
        label="Retry"
        class="q-mt-md"
        @click="loadVm"
      />
    </div>

    <!-- VM Detail -->
    <div v-else-if="vm">
      <!-- Header -->
      <div class="q-mb-lg">
        <div class="row items-center">
          <div class="col">
            <div class="text-h4 text-weight-bold">{{ vm.name }}</div>
            <!-- Click-to-edit description -->
            <div class="q-mt-xs">
              <q-input
                v-if="editingDescription"
                v-model="descriptionInput"
                dense
                outlined
                autofocus
                placeholder="Add a description..."
                maxlength="500"
                counter
                class="description-input"
                style="max-width: 500px"
                @keyup.enter="saveDescription"
                @keyup.escape="cancelDescription"
                @blur="saveDescription"
              />
              <div
                v-else
                class="text-body2 cursor-pointer description-display"
                :class="vm.description ? 'text-grey-8' : 'text-grey-7'"
                @click="startEditDescription"
              >
                {{ vm.description || 'Add a description...' }}
                <q-icon name="mdi-pencil" size="14px" class="q-ml-xs" />
              </div>
            </div>
            <!-- Tags -->
            <div v-if="authStore.canManageVms" class="q-mt-sm" style="max-width: 500px">
              <TagEditor :tags="vm.tags ?? []" @update:tags="saveTags" />
            </div>
            <div v-else-if="vm.tags && vm.tags.length > 0" class="row q-gutter-xs q-mt-sm">
              <q-chip v-for="tag in vm.tags" :key="tag" dense outline size="sm" color="primary">{{ tag }}</q-chip>
            </div>
            <div class="row items-center q-gutter-sm q-mt-xs">
              <StatusBadge :status="vm.status" />
              <q-badge v-if="vm.provisioningState === PROVISIONING.PROVISIONING" color="blue" rounded>
                <q-spinner-dots size="12px" class="q-mr-xs" />
                Provisioning
              </q-badge>
              <q-badge v-else-if="vm.provisioningState === PROVISIONING.PROVISION_FAILED" color="negative" rounded>
                <q-icon name="mdi-alert-circle" size="14px" class="q-mr-xs" />
                Failed
              </q-badge>
              <q-badge v-else-if="vm.provisioningState === PROVISIONING.DESTROYING" color="orange" rounded>
                <q-spinner-dots size="12px" class="q-mr-xs" />
                Destroying
              </q-badge>
              <q-badge v-else-if="vm.provisioningState === PROVISIONING.REGISTERED" color="grey" rounded>
                Registered
              </q-badge>
            </div>
          </div>
        </div>
        <div class="row items-center q-mt-sm q-gutter-sm wrap">
          <q-btn
            v-if="authStore.canManageVms && isActionable && vm.status !== STATUSES.RUNNING"
            outline
            color="positive"
            icon="mdi-play"
            label="Start"
            :loading="actionLoading"
            @click="handleAction('start')"
          />
          <q-btn
            v-if="authStore.canManageVms && isActionable && vm.status === STATUSES.RUNNING"
            outline
            color="negative"
            icon="mdi-stop"
            label="Stop"
            :loading="actionLoading"
            @click="handleAction('stop')"
          />
          <q-btn
            v-if="authStore.canManageVms && isActionable && vm.status === STATUSES.RUNNING"
            outline
            color="warning"
            icon="mdi-restart"
            label="Restart"
            :loading="actionLoading"
            @click="handleAction('restart')"
          />
          <q-btn
            v-if="authStore.canDeleteVms && appStore.isWeaver"
            outline
            color="negative"
            icon="mdi-delete"
            label="Delete"
            :loading="deleteLoading"
            @click="handleDelete"
          />
          <q-btn
            v-if="isDemoMode() && appStore.isDemoVersionAtLeast('1.1') && appStore.isWeaver"
            outline
            color="secondary"
            icon="mdi-content-copy"
            label="Clone"
            :loading="cloneLoading"
            @click="handleClone"
          />
          <!-- Migrate button — Fabrick v2.3+ (cold), v3.0+ (live) -->
          <q-btn
            v-if="isDemoMode() && appStore.isDemoVersionAtLeast('2.3') && appStore.isFabrick"
            outline
            :color="migrationEligible ? 'deep-purple' : 'grey-5'"
            icon="mdi-truck-fast"
            :label="appStore.isDemoVersionAtLeast('3.0') ? 'Live Migrate' : 'Migrate'"
            :disable="!migrationEligible"
            @click="showMigrateDialog = true"
          >
            <q-tooltip>{{ migrationTooltip }}</q-tooltip>
          </q-btn>
          <q-space />
          <q-btn
            color="info"
            icon="mdi-stethoscope"
            label="Diagnose"
            :loading="agentLoading"
            @click="startAgentAction('diagnose')"
          />
          <q-btn
            flat
            color="info"
            icon="mdi-information"
            label="Explain"
            :loading="agentLoading"
            @click="startAgentAction('explain')"
          />
          <q-btn
            flat
            color="info"
            icon="mdi-lightbulb"
            label="Suggest"
            :loading="agentLoading"
            @click="startAgentAction('suggest')"
          />
          <HelpTooltip text="AI-powered analysis: Diagnose issues, Explain configuration, or get optimization Suggestions. Requires an API key or uses mock mode." />
        </div>
      </div>

      <!-- Info Cards -->
      <div class="row q-gutter-md q-mb-lg">
        <q-card class="col-12 col-sm-auto">
          <q-card-section class="row items-center q-pa-sm q-px-md">
            <q-icon name="mdi-ip-network" size="28px" color="primary" class="q-mr-sm" />
            <div>
              <div class="text-caption text-grey-8">IP Address</div>
              <div class="text-subtitle1 text-weight-medium">{{ vm.ip || 'No network configured' }}</div>
            </div>
          </q-card-section>
        </q-card>

        <q-card class="col-12 col-sm-auto">
          <q-card-section class="row items-center q-pa-sm q-px-md">
            <q-icon name="mdi-memory" size="28px" color="secondary" class="q-mr-sm" />
            <div>
              <div class="text-caption text-grey-8">Memory</div>
              <div class="text-subtitle1 text-weight-medium">{{ vm.mem }} MB</div>
            </div>
          </q-card-section>
        </q-card>

        <q-card class="col-12 col-sm-auto">
          <q-card-section class="row items-center q-pa-sm q-px-md">
            <q-icon name="mdi-chip" size="28px" color="accent" class="q-mr-sm" />
            <div>
              <div class="text-caption text-grey-8">vCPUs</div>
              <div class="text-subtitle1 text-weight-medium">{{ vm.vcpu }}</div>
            </div>
          </q-card-section>
        </q-card>

        <q-card v-if="vm.diskSize" class="col-12 col-sm-auto">
          <q-card-section class="row items-center q-pa-sm q-px-md">
            <q-icon name="mdi-harddisk" size="28px" color="deep-purple" class="q-mr-sm" />
            <div>
              <div class="text-caption text-grey-8">Disk Size</div>
              <div class="text-subtitle1 text-weight-medium">{{ vm.diskSize }} GB</div>
            </div>
          </q-card-section>
        </q-card>

        <q-card class="col-12 col-sm-auto">
          <q-card-section class="row items-center q-pa-sm q-px-md">
            <q-icon name="mdi-server" size="28px" color="info" class="q-mr-sm" />
            <div>
              <div class="text-caption text-grey-8">Hypervisor</div>
              <div class="text-subtitle1 text-weight-medium">{{ vm.hypervisor }}</div>
            </div>
          </q-card-section>
        </q-card>

        <q-card v-if="vm.distro" class="col-12 col-sm-auto">
          <q-card-section class="row items-center q-pa-sm q-px-md">
            <q-icon name="mdi-linux" size="28px" color="teal" class="q-mr-sm" />
            <div>
              <div class="text-caption text-grey-8">Distribution</div>
              <div class="text-subtitle1 text-weight-medium">{{ vm.distro }}</div>
            </div>
          </q-card-section>
        </q-card>

        <q-card v-if="vm.uptime" class="col-12 col-sm-auto">
          <q-card-section class="row items-center q-pa-sm q-px-md">
            <q-icon name="mdi-clock-outline" size="28px" color="positive" class="q-mr-sm" />
            <div>
              <div class="text-caption text-grey-8">Uptime</div>
              <div class="text-subtitle1 text-weight-medium">{{ formatUptime(vm.uptime) || vm.uptime }}</div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Resource Metrics (v1.1.0+, demo only) -->
      <template v-if="isDemoMode()">
        <VersionNag
          v-if="!appStore.isDemoVersionAtLeast('1.1')"
          version="1.1"
          title="Resource Metrics"
          description="CPU, memory, and disk I/O charts with configurable time windows"
          class="q-mb-lg"
        />
        <DemoResourceGraph
          v-else
          :vm-name="vm.name"
          :vm-status="vm.status"
          class="q-mb-lg"
        />
      </template>

      <!-- Tabs -->
      <q-card>
        <div class="row items-center">
          <q-tabs
            v-model="activeTab"
            dense
            class="text-grey-8 col"
            active-color="primary"
            indicator-color="primary"
            align="left"
            narrow-indicator
          >
            <q-tab name="config" label="Configuration" icon="mdi-cog" />
            <q-tab name="networking" label="Networking" icon="mdi-lan" />
            <q-tab name="logs" label="Logs" icon="mdi-text-box" />
            <q-tab name="console" label="Console" icon="mdi-console" />
            <q-tab name="ai" label="AI Analysis" icon="mdi-robot" />
          </q-tabs>
          <HelpTooltip text="Configuration: VM settings. Networking: IP and connectivity. Logs: Provisioning output. Console: Serial terminal (running VMs only). AI Analysis: Past AI diagnostics." />
        </div>

        <q-separator />

        <q-tab-panels v-model="activeTab" animated>
          <!-- Configuration Tab -->
          <q-tab-panel name="config">
            <div class="text-h6 q-mb-md">VM Configuration</div>
            <q-list bordered separator class="rounded-borders">
              <q-item>
                <q-item-section>
                  <q-item-label>Name</q-item-label>
                  <q-item-label caption>VM identifier</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-item-label class="text-weight-medium">{{ vm.name }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label>Hypervisor</q-item-label>
                  <q-item-label caption>Virtualization backend</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-item-label class="text-weight-medium">{{ vm.hypervisor }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label>Memory</q-item-label>
                  <q-item-label caption>Allocated RAM</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-item-label class="text-weight-medium">{{ vm.mem }} MB</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label>vCPUs</q-item-label>
                  <q-item-label caption>Virtual CPU count</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-item-label class="text-weight-medium">{{ vm.vcpu }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item v-if="vm.diskSize">
                <q-item-section>
                  <q-item-label>Disk Size</q-item-label>
                  <q-item-label caption>Allocated storage</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-item-label class="text-weight-medium">{{ vm.diskSize }} GB</q-item-label>
                </q-item-section>
              </q-item>
              <q-item v-if="vm.distro">
                <q-item-section>
                  <q-item-label>Distribution</q-item-label>
                  <q-item-label caption>Linux distribution</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-item-label class="text-weight-medium">{{ vm.distro }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label>Status</q-item-label>
                  <q-item-label caption>Current state</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <StatusBadge :status="vm.status" />
                </q-item-section>
              </q-item>
              <q-item v-if="authStore.canManageVms">
                <q-item-section>
                  <q-item-label>Auto-start</q-item-label>
                  <q-item-label caption>Start automatically when Weaver service starts</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    :model-value="vm.autostart ?? false"
                    :loading="autostartLoading"
                    @update:model-value="toggleAutostart"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-tab-panel>

          <!-- Networking Tab -->
          <q-tab-panel name="networking">
            <div class="row items-center q-mb-md">
              <div class="text-h6">Network Configuration</div>
              <q-space />
              <q-btn
                flat
                color="primary"
                icon="mdi-lan"
                label="View on Network Map"
                to="/network"
              />
            </div>
            <q-list bordered separator class="rounded-borders">
              <q-item>
                <q-item-section>
                  <q-item-label>IP Address</q-item-label>
                  <q-item-label caption>Assigned network address</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-item-label class="text-weight-medium">
                    {{ vm.ip || 'Not assigned' }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item v-if="vm.macAddress">
                <q-item-section>
                  <q-item-label>MAC Address</q-item-label>
                  <q-item-label caption>Hardware address</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-item-label class="text-weight-medium text-mono">
                    {{ vm.macAddress }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item v-if="vm.tapInterface">
                <q-item-section>
                  <q-item-label>TAP Interface</q-item-label>
                  <q-item-label caption>Host-side network interface</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-item-label class="text-weight-medium text-mono">
                    {{ vm.tapInterface }}
                  </q-item-label>
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-item-label>Status</q-item-label>
                  <q-item-label caption>Network connectivity</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge
                    :color="vm.ip ? 'positive' : 'grey'"
                    :label="vm.ip ? 'Connected' : 'No network'"
                    rounded
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-tab-panel>

          <!-- Provisioning Logs Tab -->
          <q-tab-panel name="logs">
            <div class="row items-center q-mb-md">
              <div class="text-h6">Provisioning Logs</div>
              <q-space />
              <q-btn
                flat
                dense
                icon="mdi-refresh"
                label="Refresh"
                :loading="logsLoading"
                @click="loadLogs"
              />
            </div>
            <div class="log-placeholder rounded-borders q-pa-md">
              <div v-if="logsLoading" class="text-grey-6 text-mono">
                Loading logs...
              </div>
              <div v-else-if="logsContent" class="text-grey-7 text-mono" style="white-space: pre-wrap;">{{ logsContent }}</div>
              <div v-else class="text-grey-6 text-mono">
                No provisioning logs available.
              </div>
            </div>
          </q-tab-panel>

          <!-- Console Tab -->
          <q-tab-panel name="console">
            <div class="text-h6 q-mb-md">Serial Console</div>
            <div v-if="vm && vm.status === STATUSES.RUNNING">
              <SerialConsole v-if="appStore.isWeaver" :vm-name="name" :active="activeTab === 'console'" />
              <VmConsole v-else :vm-name="name" :active="activeTab === 'console'" />
            </div>
            <div v-else class="text-center text-grey-8 q-pa-lg">
              <q-icon name="mdi-console" size="48px" class="q-mb-md" />
              <div>Console is only available when the VM is running.</div>
              <div class="text-caption q-mt-sm">Start the VM to access its serial console.</div>
            </div>
          </q-tab-panel>

          <!-- AI Analysis Tab -->
          <q-tab-panel name="ai">
            <div class="text-h6 q-mb-md">AI Analysis History</div>
            <div v-if="vmOperations.length === 0" class="text-center text-grey-8 q-pa-lg">
              <q-icon name="mdi-robot" size="48px" class="q-mb-md" />
              <div>No AI analysis has been run for this VM yet.</div>
              <div class="text-caption q-mt-sm">
                Use the Diagnose, Explain, or Suggest buttons above to get started.
              </div>
            </div>
            <q-list v-else bordered separator class="rounded-borders">
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
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ op.action.charAt(0).toUpperCase() + op.action.slice(1) }}</q-item-label>
                  <q-item-label caption>{{ op.startedAt }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge
                    :color="op.status === 'complete' ? 'positive' : op.status === 'error' ? 'negative' : 'info'"
                    :label="op.status"
                    rounded
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-tab-panel>
        </q-tab-panels>
      </q-card>

      <!-- Demo version feature previews (v1.5: secrets, v2.0: disks, v2.1: snapshots) -->
      <DemoVersionFeatures v-if="isDemoMode()" section="workload-detail" />
    </div>

    <!-- Not found state -->
    <div v-else class="text-center q-pa-xl">
      <q-icon name="mdi-server-off" size="80px" color="grey-5" />
      <div class="text-h6 q-mt-md text-grey-8">VM not found</div>
      <div class="text-caption text-grey-8 q-mt-sm">
        The VM "{{ name }}" could not be found.
      </div>
      <q-btn
        color="primary"
        label="Back to Weaver"
        class="q-mt-md"
        @click="router.push('/weaver')"
      />
    </div>

    <!-- Agent Dialog -->
    <AgentDialog
      v-model="agentDialogOpen"
      :resource-id="name"
      :action="currentAgentAction"
    />

    <!-- Migrate Dialog (demo v2.3+ Fabrick) -->
    <q-dialog v-model="showMigrateDialog" max-width="440px">
      <q-card style="min-width: 360px">
        <q-card-section class="row items-center q-pb-xs">
          <q-icon name="mdi-truck-fast" size="22px" color="deep-purple" class="q-mr-sm" />
          <span class="text-h6">{{ appStore.isDemoVersionAtLeast('3.0') ? 'Live Migrate' : 'Cold Migrate' }}</span>
          <q-space />
          <q-btn flat round dense icon="mdi-close" @click="showMigrateDialog = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="q-gutter-md">
          <div class="text-body2">
            Move <strong>{{ name }}</strong> from
            <q-badge color="primary" :label="appStore.demoSelectedHostId" /> to:
          </div>
          <q-select
            :model-value="'titan'"
            outlined dense
            label="Target host"
            :options="['crucible', 'vault', 'titan', 'nexus', 'sentinel', 'atlas']"
          />
          <q-banner v-if="!appStore.isDemoVersionAtLeast('3.0')" dense rounded class="bg-amber-1 text-amber-9">
            <template #avatar><q-icon name="mdi-alert" /></template>
            Cold migration will stop the workload during transfer. Estimated downtime: ~30 seconds.
          </q-banner>
          <q-banner v-else dense rounded class="bg-green-1 text-green-9">
            <template #avatar><q-icon name="mdi-check-circle" /></template>
            Live migration — zero downtime. Memory state transfers while workload runs.
          </q-banner>
        </q-card-section>
        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn flat label="Cancel" color="grey-7" @click="showMigrateDialog = false" />
          <q-btn unelevated :label="appStore.isDemoVersionAtLeast('3.0') ? 'Live Migrate' : 'Migrate'" color="deep-purple" icon="mdi-truck-fast" @click="showMigrateDialog = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import StatusBadge from 'src/components/StatusBadge.vue'
import AgentDialog from 'src/components/AgentDialog.vue'
const VmConsole = defineAsyncComponent(() => import('src/components/VmConsole.vue'))
const SerialConsole = defineAsyncComponent(() => import('src/components/SerialConsole.vue'))
import TagEditor from 'src/components/TagEditor.vue'
import { useWorkloadApi } from 'src/composables/useVmApi'
import { useWorkloadStatus } from 'src/composables/useVmStatus'
import { useAgent } from 'src/composables/useAgent'
import { useAgentStream } from 'src/composables/useAgentStream'
import { useWorkloadStore } from 'src/stores/workload-store'
import { useAgentStore } from 'src/stores/agent-store'
import { formatUptime } from 'src/utils/format'
import type { WorkloadInfo, WorkloadAction } from 'src/types/workload'
import type { AgentAction } from 'src/types/agent'
import { useAuthStore } from 'src/stores/auth-store'
import { useAppStore } from 'src/stores/app'
import HelpTooltip from 'src/components/HelpTooltip.vue'
import { extractErrorMessage } from 'src/utils/error'
import { isDemoMode } from 'src/config/demo-mode'
import DemoResourceGraph from 'src/components/demo/DemoResourceGraph.vue'
import DemoVersionFeatures from 'src/components/demo/DemoVersionFeatures.vue'
import VersionNag from 'src/components/demo/VersionNag.vue'
import { STATUSES, PROVISIONING } from 'src/constants/vocabularies'

const props = defineProps<{
  name: string
}>()

const router = useRouter()
const route = useRoute()
const $q = useQuasar()
const workloadStore = useWorkloadStore()
const authStore = useAuthStore()
const appStore = useAppStore()
const agentStore = useAgentStore()
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
const showMigrateDialog = ref(false)

// Migration eligibility — GPU-pinned VMs can only migrate to hosts with matching GPUs
const migrationEligible = computed(() => {
  if (!isDemoMode() || !appStore.isFabrick || !appStore.isDemoVersionAtLeast('2.3')) return false
  const v = vm.value
  if (!v) return false
  // Simulate: VMs with 'critical' tag or GPU passthrough are blocked
  if (v.tags?.includes('gpu-pinned')) return false
  return true
})

const migrationTooltip = computed(() => {
  if (!migrationEligible.value) {
    const v = vm.value
    if (v?.tags?.includes('gpu-pinned')) return 'GPU 0000:01:00.0 not available on any other node'
    return 'Workload is not eligible for migration'
  }
  return appStore.isDemoVersionAtLeast('3.0')
    ? 'Live migrate to another host (zero downtime)'
    : 'Cold migrate: stop → transfer → start on target host'
})

const logsContent = ref('')
const logsLoading = ref(false)

const isActionable = computed(() => {
  const state = vm.value?.provisioningState
  return !state || state === PROVISIONING.PROVISIONED
})

// Real-time workload from the store (updated via WebSocket)
const storeVm = computed(() => workloadStore.workloadByName(props.name))

// Sync WebSocket data to store
watch(wsVms, (newVms) => {
  if (newVms.length > 0) {
    workloadStore.updateWorkloads(newVms)
  }
})

// Update local VM from store when WebSocket pushes updates
watch(storeVm, (newVm) => {
  if (newVm) {
    vm.value = newVm
  }
})

async function loadVm() {
  const result = await fetchVm(props.name)
  if (result) {
    vm.value = result
  }
}

function startEditDescription() {
  if (!authStore.canManageVms) return
  descriptionInput.value = vm.value?.description ?? ''
  editingDescription.value = true
}

function cancelDescription() {
  editingDescription.value = false
}

async function saveDescription() {
  editingDescription.value = false
  if (!vm.value) return
  const newDesc = descriptionInput.value.trim()
  if (newDesc === (vm.value.description ?? '')) return
  const result = await setDescription(props.name, newDesc)
  if (result.success && vm.value) {
    vm.value = { ...vm.value, description: newDesc || undefined }
  }
}

async function saveTags(tags: string[]) {
  if (!vm.value) return
  const result = await setTags(props.name, tags)
  if (result.success && vm.value) {
    vm.value = { ...vm.value, tags: result.tags.length > 0 ? result.tags : undefined }
  }
}

async function toggleAutostart(value: boolean | null) {
  if (!vm.value) return
  autostartLoading.value = true
  try {
    const result = await setAutostart(props.name, !!value)
    if (result.success && vm.value) {
      vm.value = { ...vm.value, autostart: result.autostart }
    }
  } finally {
    autostartLoading.value = false
  }
}

async function handleAction(action: WorkloadAction) {
  actionLoading.value = true
  try {
    const result = await vmAction(props.name, action)
    if (result.success) {
      $q.notify({
        type: 'positive',
        message: result.message || `VM ${props.name} ${action} successful`,
        position: 'top-right',
        timeout: 3000,
      })
      // Refresh VM details after action
      await loadVm()
    } else {
      $q.notify({
        type: 'negative',
        message: result.message || `Failed to ${action} VM ${props.name}`,
        position: 'top-right',
        timeout: 5000,
      })
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: extractErrorMessage(err, `Failed to ${action} VM ${props.name}`),
      position: 'top-right',
      timeout: 5000,
    })
  } finally {
    actionLoading.value = false
  }
}

function handleDelete() {
  $q.dialog({
    title: 'Delete VM',
    message: `Are you sure you want to delete <strong>${props.name}</strong>?<br><br>` +
      'This will stop the VM, remove its disk image, and untrack it. This cannot be undone.',
    html: true,
    cancel: true,
    color: 'negative',
    ok: { label: 'Delete', color: 'negative' },
  }).onOk(async () => {
    deleteLoading.value = true
    try {
      const result = await deleteVm(props.name)
      if (result.success) {
        workloadStore.removeWorkload(props.name)
        $q.notify({
          type: 'positive',
          message: result.message || `VM ${props.name} deleted`,
          position: 'top-right',
          timeout: 3000,
        })
        void router.push('/weaver')
      } else {
        $q.notify({
          type: 'negative',
          message: result.message || `Failed to delete VM ${props.name}`,
          position: 'top-right',
          timeout: 5000,
        })
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
    message: `Create a copy of <strong>${props.name}</strong>.<br>The clone will be stopped and assigned a new IP.`,
    html: true,
    prompt: {
      model: `${props.name}-clone`,
      type: 'text',
      label: 'New VM name',
    },
    cancel: true,
    color: 'secondary',
  }).onOk(async (cloneName: string) => {
    const newName = cloneName.trim()
    if (!newName) return
    cloneLoading.value = true
    try {
      // Auto-derive a demo IP in the same subnet
      const baseIp = vm.value?.ip ?? '10.10.0.99'
      const parts = baseIp.split('.')
      const demoIp = parts.length === 4
        ? `${parts[0]}.${parts[1]}.${parts[2]}.${(parseInt(parts[3] ?? '0') + 10) % 256}`
        : '10.10.0.99'
      const result = await cloneVm(props.name, newName, demoIp)
      if (result.success) {
        $q.notify({
          type: 'positive',
          message: result.message || `VM cloned to ${newName}`,
          position: 'top-right',
          timeout: 3000,
        })
        void router.push('/weaver')
      } else {
        $q.notify({
          type: 'negative',
          message: result.message || 'Clone failed',
          position: 'top-right',
          timeout: 5000,
        })
      }
    } finally {
      cloneLoading.value = false
    }
  })
}

async function loadLogs() {
  logsLoading.value = true
  try {
    const result = await fetchLogs(props.name)
    logsContent.value = result
  } catch {
    logsContent.value = ''
  } finally {
    logsLoading.value = false
    // fetchLogs sets the shared error/loading refs from useVmApi — clear error
    // so a log fetch failure doesn't replace the entire page with an error state
    error.value = null
  }
}

// Auto-load logs when switching to logs tab
watch(activeTab, (tab) => {
  if (tab === 'logs' && !logsContent.value) {
    void loadLogs()
  }
})

// Agent operations for this VM
const vmOperations = computed(() => agentStore.operationsForVm(props.name))

async function startAgentAction(action: AgentAction) {
  currentAgentAction.value = action
  agentDialogOpen.value = true
  const operationId = await runAgent(props.name, action)
  if (!operationId) {
    $q.notify({
      type: 'negative',
      message: 'Failed to start AI agent',
      position: 'top-right',
      timeout: 5000,
    })
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
  workloadStore.selectWorkload(props.name)
  // Try store first, then fetch from API
  if (storeVm.value) {
    vm.value = storeVm.value
  } else {
    void loadVm()
  }

  // Auto-open diagnose dialog if navigated with ?diagnose=true
  if (route.query.diagnose === 'true') {
    void startAgentAction('diagnose')
    // Clean up query param
    void router.replace({ path: route.path, query: {} })
  }
})
</script>

<style scoped lang="scss">
.text-mono {
  font-family: 'Roboto Mono', monospace;
}

.description-display {
  &:hover {
    text-decoration: underline;
  }
}

.description-input {
  max-width: 500px;
}

.log-placeholder {
  background: #1e1e1e;
  min-height: 200px;
  max-height: 500px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.5;
}

.body--light .log-placeholder {
  background: #263238;
}
</style>

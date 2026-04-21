<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-card
    class="vm-card cursor-pointer"
    :class="[`vm-card--${vm.status}`, remoteHostname ? 'vm-card--remote' : '']"
    @click="navigateToDetail"
  >
    <q-card-section class="q-pa-sm">
      <!-- Name row: type icon + name + autostart + status -->
      <div class="row items-center no-wrap q-mb-xs">
        <q-icon
          :name="vmTypeIcon(vm.vmType)"
          :color="vmTypeColor(vm.vmType)"
          size="18px"
          class="q-mr-xs"
        >
          <q-tooltip>{{ vm.vmType === 'desktop' ? 'Desktop VM (GUI passthrough)' : 'Server VM (headless)' }}</q-tooltip>
        </q-icon>
        <span class="text-weight-medium text-body2 ellipsis col">
          <q-badge
            v-if="remoteHostname"
            color="deep-purple-7"
            :label="remoteHostname"
            class="q-mr-xs"
            style="font-size:9px;vertical-align:middle"
          />{{ vm.name }}
          <q-badge
            v-if="isExampleVm"
            outline
            color="amber-8"
            label="example"
            class="q-ml-xs"
            style="font-size:9px;vertical-align:middle"
          >
            <q-tooltip>Auto-provisioned example VM — safe to delete once you have your own VMs.</q-tooltip>
          </q-badge>
        </span>
        <div class="row items-center no-wrap q-gutter-xs q-ml-xs">
          <!-- Migration eligibility indicator (Fabrick v2.3+ demo) -->
          <q-icon
            v-if="showMigrationIndicator"
            :name="isMigratable ? 'mdi-truck-check' : 'mdi-truck-remove'"
            :color="isMigratable ? 'deep-purple-4' : 'grey-4'"
            size="16px"
          >
            <q-tooltip>{{ isMigratable ? (isLiveMigrate ? 'Live migration available' : 'Cold migration available') : 'Not migratable — GPU-pinned or local storage only' }}</q-tooltip>
          </q-icon>
          <q-icon
            v-if="vm.autostart"
            name="mdi-play-circle-outline"
            size="16px"
            color="grey-6"
          >
            <q-tooltip>Auto-starts on boot</q-tooltip>
          </q-icon>
          <StatusBadge :status="vm.status" />
        </div>
      </div>
      <!-- Description + bulk checkbox on same row -->
      <div v-if="vm.description || selectable" class="row items-center no-wrap q-mb-xs">
        <span class="text-caption text-grey-8 ellipsis col">{{ vm.description }}</span>
        <q-checkbox
          v-if="selectable"
          :model-value="selection.isSelected(vm.name)"
          dense
          class="q-ml-xs"
          @click.stop
          @update:model-value="selection.toggle(vm.name)"
        />
      </div>
      <!-- Tags, IP — flush left -->
      <div v-if="vm.tags && vm.tags.length > 0" class="row q-gutter-xs q-mb-xs">
        <q-chip
          v-for="tag in visibleTags"
          :key="tag"
          dense outline size="xs" color="primary"
          clickable @click.stop
        >{{ tag }}</q-chip>
        <q-chip v-if="overflowCount > 0" dense outline size="xs" color="grey">+{{ overflowCount }}</q-chip>
      </div>
      <div v-if="vm.ip" class="row items-center no-wrap q-mb-xs">
        <q-icon name="mdi-ip-network" size="12px" color="primary" class="q-mr-xs" />
        <span class="text-caption text-grey-7 text-mono">{{ vm.ip }}</span>
      </div>

      <!-- Provisioning state banners -->
      <q-banner v-if="isProvisioning" dense rounded class="bg-blue-1 text-primary q-mb-xs">
        <template #avatar>
          <q-spinner-dots size="20px" color="primary" />
        </template>
        {{ vm.provisioningState === 'destroying' ? 'Destroying...' : 'Provisioning...' }}
      </q-banner>
      <q-banner v-else-if="isProvisionFailed" dense rounded class="bg-red-1 text-negative q-mb-xs">
        <template #avatar>
          <q-icon name="mdi-alert-circle" color="negative" />
        </template>
        {{ vm.provisioningError || 'Provisioning failed' }}
        <template v-if="isImageUrlError" #action>
          <q-btn flat dense color="primary" label="Fix in Settings" icon="mdi-cog" @click.stop="goToSettings" />
        </template>
      </q-banner>

      <!-- Stats -->
      <div class="row items-center q-gutter-sm text-caption">
        <div class="row items-center no-wrap">
          <q-icon name="mdi-chip" size="14px" color="accent" class="q-mr-xs" />
          <span class="text-grey-7">{{ vm.vcpu }} vCPU</span>
        </div>
        <div class="row items-center no-wrap">
          <q-icon name="mdi-memory" size="14px" color="secondary" class="q-mr-xs" />
          <span class="text-grey-7">{{ vm.mem }} MB</span>
        </div>
        <div class="row items-center no-wrap">
          <q-icon name="mdi-server" size="14px" color="grey-6" class="q-mr-xs" />
          <span class="text-grey-7">{{ formatHypervisor(vm.hypervisor) }}</span>
        </div>
      </div>

      <!-- Utilization gauges — only when liveMetrics populated.
           Demo data populates this for running VMs so public-demo visitors see
           each VM as "alive" at a glance. Prod VMs have liveMetrics undefined
           until v1.1 Resource Metrics ships; this block stays empty and costs
           nothing there. -->
      <div v-if="vm.liveMetrics" class="q-mt-xs utilization-gauges">
        <div class="row items-center no-wrap q-gutter-xs util-row">
          <q-icon name="mdi-chip" size="11px" :color="utilColor(vm.liveMetrics.cpuPercent)" />
          <span class="text-caption text-grey-7">CPU</span>
          <q-linear-progress
            :value="vm.liveMetrics.cpuPercent / 100"
            :color="utilColor(vm.liveMetrics.cpuPercent)"
            rounded size="4px"
            class="col util-bar"
          />
          <span class="text-caption text-grey-8 util-pct">{{ vm.liveMetrics.cpuPercent }}%</span>
        </div>
        <div class="row items-center no-wrap q-gutter-xs q-mt-xs util-row">
          <q-icon name="mdi-memory" size="11px" :color="utilColor(memPercent)" />
          <span class="text-caption text-grey-7">MEM</span>
          <q-linear-progress
            :value="memPercent / 100"
            :color="utilColor(memPercent)"
            rounded size="4px"
            class="col util-bar"
          />
          <span class="text-caption text-grey-8 util-pct">{{ memPercent }}%</span>
        </div>
      </div>
    </q-card-section>

  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import StatusBadge from 'src/components/StatusBadge.vue'
import { useVmSelection } from 'src/composables/useVmSelection'
import { useResourceDrawerStore } from 'src/stores/resource-drawer-store'
import { useAppStore } from 'src/stores/app'
import { isDemoMode } from 'src/config/demo-mode'
import { vmTypeIcon, vmTypeColor } from 'src/utils/vm'
import type { WorkloadInfo } from 'src/types/workload'

function formatHypervisor(hv: string): string {
  const short: Record<string, string> = { 'cloud-hypervisor': 'cloud' }
  return short[hv] ?? hv
}

function utilColor(pct: number): string {
  if (pct >= 90) return 'negative'
  if (pct >= 70) return 'warning'
  return 'positive'
}

const MAX_VISIBLE_TAGS = 3

const props = defineProps<{
  vm: WorkloadInfo
  selectable?: boolean
  remoteHostname?: string
}>()

const memPercent = computed(() => {
  if (!props.vm.liveMetrics || !props.vm.mem) return 0
  return Math.min(100, Math.round((props.vm.liveMetrics.memUsedMb / props.vm.mem) * 100))
})

const router = useRouter()
const drawerStore = useResourceDrawerStore()
const selection = useVmSelection()

const isExampleVm = computed(() => props.vm.name === 'example-cirros')
const visibleTags = computed(() => (props.vm.tags ?? []).slice(0, MAX_VISIBLE_TAGS))
const overflowCount = computed(() => Math.max(0, (props.vm.tags?.length ?? 0) - MAX_VISIBLE_TAGS))

const isProvisioning = computed(() => {
  const state = props.vm.provisioningState
  return state === 'provisioning' || state === 'destroying'
})

const isProvisionFailed = computed(() => props.vm.provisioningState === 'provision-failed')

const isImageUrlError = computed(() => {
  if (!isProvisionFailed.value || !props.vm.provisioningError) return false
  return /HTTP [45]\d\d|download|image/i.test(props.vm.provisioningError)
})

// Migration eligibility (demo Fabrick v2.3+)
const appStore = useAppStore()
const showMigrationIndicator = computed(() =>
  isDemoMode() && appStore.isFabrick && appStore.isDemoVersionAtLeast('2.3')
)
const isMigratable = computed(() => {
  if (!showMigrationIndicator.value) return false
  // GPU-pinned or critical-tagged workloads can't migrate
  return !props.vm.tags?.includes('gpu-pinned')
})
const isLiveMigrate = computed(() => appStore.isDemoVersionAtLeast('3.0'))

function navigateToDetail() {
  drawerStore.openVm(props.vm.name)
}

function goToSettings() {
  void router.push('/settings')
}

</script>

<style scoped lang="scss">
.text-mono {
  font-family: 'Roboto Mono', monospace;
}
.vm-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.4s ease;
  min-width: 280px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  &--running {
    border-left: 3px solid var(--q-positive);
  }

  &--idle {
    border-left: 3px solid #9e9e9e;
  }

  &--stopped {
    border-left: 3px solid var(--q-warning);
  }

  &--failed {
    border-left: 3px solid var(--q-negative);
  }

  &--unknown {
    border-left: 3px solid #616161;
  }

  &--remote {
    border-left-style: dashed;
    opacity: 0.88;
  }
}

.utilization-gauges {
  // Compact utilization rows — CPU and memory bars under the static stats
  .util-row {
    min-height: 14px;
  }
  .util-bar {
    margin: 0 4px;
  }
  .util-pct {
    min-width: 32px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
}
</style>

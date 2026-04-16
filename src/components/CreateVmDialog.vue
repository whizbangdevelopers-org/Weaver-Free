<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" persistent>
    <q-card style="width: 500px; max-width: 90vw">
      <q-card-section class="row items-center">
        <q-icon name="mdi-server-plus" size="28px" color="primary" class="q-mr-md" />
        <div class="text-h6">Create VM</div>
        <q-space />
        <q-btn flat round dense icon="mdi-close" @click="onDialogCancel" />
      </q-card-section>

      <q-separator />

      <!-- Bridge not configured banner -->
      <q-card-section v-if="!appStore.bridgeGateway" class="q-pb-none">
        <q-banner rounded class="bg-orange-1 text-orange-9">
          <template #avatar>
            <q-icon name="mdi-bridge" color="orange" />
          </template>
          <div class="text-caption">
            <strong>Bridge network not configured</strong>
            <div class="q-mt-xs">
              A bridge network is required to assign VM IP addresses.
              Set <code>BRIDGE_GATEWAY</code> in the server environment or configure a bridge in Network Management.
            </div>
          </div>
        </q-banner>
      </q-card-section>

      <!-- Quota usage banner (Fabrick tier only) -->
      <q-card-section v-if="quotaUsage" class="q-pb-none">
        <q-banner rounded :class="quotaBannerClass">
          <template #avatar>
            <q-icon name="mdi-gauge" :color="quotaLevel === 'exceeded' ? 'negative' : quotaLevel === 'warning' ? 'orange' : 'blue'" />
          </template>
          <div class="text-caption">
            <strong>Resource Quotas</strong>
            <span v-if="quotaLevel === 'exceeded'" class="text-weight-bold"> — Limit reached</span>
            <div class="row q-gutter-md q-mt-xs">
              <span v-if="quotaUsage.maxVms !== null" :class="{ 'text-weight-bold': quotaUsage.currentVms >= quotaUsage.maxVms }">
                VMs: {{ quotaUsage.currentVms }} / {{ quotaUsage.maxVms }}
              </span>
              <span v-if="quotaUsage.maxMemoryMB !== null" :class="{ 'text-weight-bold': quotaUsage.currentMemoryMB >= quotaUsage.maxMemoryMB }">
                Memory: {{ quotaUsage.currentMemoryMB }} / {{ quotaUsage.maxMemoryMB }} MB
              </span>
              <span v-if="quotaUsage.maxVcpus !== null" :class="{ 'text-weight-bold': quotaUsage.currentVcpus >= quotaUsage.maxVcpus }">
                vCPUs: {{ quotaUsage.currentVcpus }} / {{ quotaUsage.maxVcpus }}
              </span>
            </div>
          </div>
        </q-banner>
      </q-card-section>

      <q-card-section>
        <q-form @submit="onSubmit" class="q-gutter-md">
          <div class="field-wrap">
            <q-input
              v-model="form.name"
              label="VM Name *"
              outlined
              dense
              :rules="[
                (val: string) => !!val || 'Required',
                (val: string) => /^[a-z][a-z0-9-]*$/.test(val) || 'Lowercase letters, digits, hyphens only. Must start with a letter.',
                (val: string) => val.length >= 2 || 'At least 2 characters',
                nameNotInUse(workloadStore.workloads),
              ]"
              lazy-rules
              placeholder="my-web-server"
              hint="e.g. test-arch, dev-ubuntu"
              @update:model-value="(v: string | number | null) => form.name = String(v ?? '').toLowerCase()"
            />
            <HelpTooltip class="field-help" text="Unique identifier for the VM. Use lowercase letters, digits, and hyphens." />
          </div>

          <q-input
            v-model="form.description"
            label="Description"
            outlined
            dense
            maxlength="500"
            counter
            placeholder="Optional notes about this VM"
          />

          <div class="field-wrap">
            <q-input
              v-model="form.ip"
              label="IP Address *"
              outlined
              dense
              :rules="[
                (val: string) => !!val || 'Required',
                isHostIPv4,
                ipOnBridgeSubnet(appStore.bridgeGateway),
                ipNotInUse(workloadStore.workloads),
              ]"
              lazy-rules
              :hint="bridgeSubnetHint"
              @keypress="onlyIPv4Chars"
            />
            <HelpTooltip class="field-help" text="Static IP address for the VM on the MicroVM bridge network (e.g. 10.10.0.x)." />
          </div>

          <div class="field-wrap">
            <q-input
              v-model.number="form.mem"
              label="Memory (MB) *"
              type="number"
              outlined
              dense
              :rules="[(val: number) => val >= 64 || 'Minimum 64 MB']"
              lazy-rules
            />
            <HelpTooltip class="field-help" text="RAM allocated to the VM in megabytes. Minimum 64 MB. Typical: 256-512 MB for servers, 1024+ for desktops." />
          </div>

          <div class="field-wrap">
            <q-input
              v-model.number="form.vcpu"
              label="vCPUs *"
              type="number"
              outlined
              dense
              :rules="[(val: number) => val >= 1 || 'Minimum 1 vCPU']"
              lazy-rules
            />
            <HelpTooltip class="field-help" text="Number of virtual CPU cores. 1 is sufficient for most lightweight VMs." />
          </div>

          <div class="field-wrap">
            <q-input
              v-model.number="form.diskSize"
              label="Disk Size (GB)"
              type="number"
              outlined
              dense
              :rules="[(val: number) => val >= 5 || 'Minimum 5 GB', (val: number) => val <= 500 || 'Maximum 500 GB']"
              lazy-rules
            />
            <HelpTooltip class="field-help" text="Disk space allocated to the VM in gigabytes. Default 10 GB. Range: 5-500 GB." />
          </div>

          <div class="field-wrap">
            <q-select
              v-model="form.distro"
              label="Distribution"
              outlined
              dense
              clearable
              :options="distroOptions"
              :option-disable="(opt: DistroOption) => !!opt.disable"
              emit-value
              map-options
            >
              <template #option="{ opt, itemProps }">
                <q-item v-if="opt.header" dense class="q-px-md" style="min-height: 28px">
                  <q-item-section class="text-caption text-weight-bold text-grey-7">
                    {{ opt.label }}
                  </q-item-section>
                </q-item>
                <q-item v-else v-bind="itemProps">
                  <q-item-section>
                    <q-item-label>
                      {{ opt.label }}
                      <q-badge v-if="opt.guestOs === 'windows'" outline color="orange" label="Windows" class="q-ml-xs" style="font-size: 10px" />
                      <q-badge v-if="opt.cloudInit" outline color="blue" label="cloud-init" class="q-ml-xs" style="font-size: 10px" />
                      <q-badge v-if="opt.license" outline color="grey-6" :label="opt.license" class="q-ml-xs" style="font-size: 10px" />
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <HelpTooltip class="field-help" text="Cloud distros (Arch, Ubuntu, etc.) use QEMU with cloud-init. Add custom distros in Settings." />
          </div>

          <!-- Ad-hoc image fields (shown when "Other" is selected) -->
          <template v-if="form.distro === 'other'">
            <div class="field-wrap">
              <q-input
                v-model="form.imageUrl"
                label="Image URL *"
                outlined
                dense
                :rules="[
                  (val: string) => !!val || 'Required when using Other distro',
                  (val: string) => /^(https?|file):\/\/.+/.test(val) || 'Must be http://, https://, or file:// URL',
                ]"
                lazy-rules
                placeholder="https://example.com/my-image.qcow2"
              />
              <HelpTooltip class="field-help" text="Direct URL to a qcow2, raw, or ISO disk image. Supports http://, https://, and file:// protocols." />
            </div>

            <div class="field-wrap">
              <q-select
                v-model="form.imageFormat"
                label="Image Format *"
                outlined
                dense
                :options="[
                  { label: 'QCOW2 (cloud image)', value: 'qcow2' },
                  { label: 'Raw disk image', value: 'raw' },
                  { label: 'ISO (installer)', value: 'iso' },
                ]"
                emit-value
                map-options
              />
              <HelpTooltip class="field-help" text="QCOW2 is standard for cloud images. ISO is for OS installers requiring manual VNC installation." />
            </div>

            <q-toggle
              v-if="form.imageFormat !== 'iso'"
              v-model="form.cloudInit"
              :label="form.cloudInit ? 'Cloud-init enabled (auto-configure networking)' : 'Cloud-init disabled (manual configuration via VNC)'"
            />
          </template>

          <div class="field-wrap">
            <q-select
              v-model="form.hypervisor"
              label="Hypervisor *"
              outlined
              dense
              :options="effectiveHypervisorOptions"
              emit-value
              map-options
              :disable="isNonNixosDistro"
              :hint="isNonNixosDistro ? 'Non-NixOS distros require QEMU' : undefined"
            />
            <HelpTooltip class="field-help" text="QEMU supports all distros and desktop mode. Other hypervisors are NixOS-only and more lightweight." />
          </div>

          <div class="field-wrap">
            <div class="row items-center no-wrap">
              <q-toggle
                v-model="desktopMode"
                :label="desktopMode ? 'Desktop (graphical VNC console)' : 'Server (serial console)'"
                :disable="form.hypervisor !== 'qemu' || isWindowsDistro"
              >
                <q-tooltip v-if="isWindowsDistro">
                  Desktop mode is required for Windows guests
                </q-tooltip>
                <q-tooltip v-else-if="form.hypervisor !== 'qemu'">
                  Desktop mode requires QEMU hypervisor
                </q-tooltip>
              </q-toggle>
              <div v-if="!desktopMode && !isWindowsDistro" class="text-caption text-grey-7 q-ml-sm" style="white-space: nowrap;">
                <q-icon name="mdi-information-outline" size="xs" class="q-mr-xs" />
                Lightweight text-only console
              </div>
            </div>
            <HelpTooltip class="field-help" text="Server mode uses a lightweight serial console. Desktop mode provides a graphical VNC console (VGA output) — recommended with 1024+ MB RAM." />
          </div>

          <div class="field-wrap">
            <q-toggle
              v-model="form.autostart"
              label="Auto-start on boot"
            />
            <HelpTooltip class="field-help" text="VM will automatically start when the Weaver service starts (e.g., after host reboot)." />
          </div>

          <div v-if="isWindowsDistro && form.mem < 2048" class="row items-center no-wrap bg-orange-1 text-orange-9 q-pa-xs q-pl-sm q-mt-xs rounded-borders">
            <q-icon name="mdi-alert" size="sm" class="q-mr-sm" />
            <span class="text-body2">Windows typically requires at least 2048 MB RAM.</span>
          </div>
          <div v-else-if="desktopMode && !isWindowsDistro && form.mem < 1024" class="row items-center no-wrap bg-blue-1 text-blue-9 q-pa-xs q-pl-sm q-mt-xs rounded-borders">
            <q-icon name="mdi-information-outline" size="sm" class="q-mr-sm" />
            <span class="text-body2">Desktop mode recommended with 1024+ MB RAM.</span>
          </div>

          <q-card-actions align="right" class="q-pt-md">
            <q-btn flat label="Cancel" @click="onDialogCancel" />
            <q-btn
              color="primary"
              label="Create VM"
              type="submit"
              :loading="loading"
              :disable="quotaLevel === 'exceeded' || !appStore.bridgeGateway"
              icon="mdi-plus"
            />
          </q-card-actions>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { reactive, computed, watch, ref, onMounted } from 'vue'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { useWorkloadApi } from 'src/composables/useVmApi'
import { distroApiService, type DistroEntry } from 'src/services/api'
import type { VmCreateInput } from 'src/types/workload'
import { isHostIPv4, ipNotInUse, ipOnBridgeSubnet, nameNotInUse, onlyIPv4Chars } from 'src/utils/validation'
import { useWorkloadStore } from 'src/stores/workload-store'
import { useAppStore } from 'src/stores/app'
import { useAuthStore } from 'src/stores/auth-store'
import { isDemoMode } from 'src/config/demo'
import { getMockVmState } from 'src/services/mock-vm'
import { api } from 'src/boot/axios'
import HelpTooltip from 'src/components/HelpTooltip.vue'

defineEmits([...useDialogPluginComponent.emits])
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
void dialogRef // bound via template ref="dialogRef" (vue-tsc doesn't track template refs from composables)
const $q = useQuasar()
const workloadStore = useWorkloadStore()
const appStore = useAppStore()
const authStore = useAuthStore()
const { createVm, loading } = useWorkloadApi()

// Quota usage (Fabrick tier only)
interface QuotaUsageData {
  maxVms: number | null
  maxMemoryMB: number | null
  maxVcpus: number | null
  currentVms: number
  currentMemoryMB: number
  currentVcpus: number
}
const quotaUsage = ref<QuotaUsageData | null>(null)

/** 'ok' | 'warning' (>75%) | 'exceeded' (any limit hit) */
const quotaLevel = computed<'ok' | 'warning' | 'exceeded'>(() => {
  const q = quotaUsage.value
  if (!q) return 'ok'
  // Exceeded: any hard limit reached
  if ((q.maxVms !== null && q.currentVms >= q.maxVms) ||
      (q.maxMemoryMB !== null && q.currentMemoryMB >= q.maxMemoryMB) ||
      (q.maxVcpus !== null && q.currentVcpus >= q.maxVcpus)) return 'exceeded'
  // Warning: any resource above 75%
  if ((q.maxVms !== null && q.currentVms / q.maxVms > 0.75) ||
      (q.maxMemoryMB !== null && q.currentMemoryMB / q.maxMemoryMB > 0.75) ||
      (q.maxVcpus !== null && q.currentVcpus / q.maxVcpus > 0.75)) return 'warning'
  return 'ok'
})

const quotaBannerClass = computed(() => {
  switch (quotaLevel.value) {
    case 'exceeded': return 'bg-red-1 text-red-9'
    case 'warning': return 'bg-orange-1 text-orange-9'
    default: return 'bg-blue-1 text-blue-9'
  }
})

const bridgeSubnetHint = computed(() => {
  const gw = appStore.bridgeGateway
  if (!gw) return 'e.g. 10.10.0.40'
  const prefix = gw.split('.').slice(0, 3).join('.')
  return `Must be in ${prefix}.x subnet (gateway: ${gw})`
})

// Fallback built-in cloud distro names (used if API not available)
const BUILTIN_CLOUD_DISTROS = ['arch', 'fedora', 'ubuntu', 'debian', 'alpine']

const hypervisorOptions = [
  { label: 'QEMU', value: 'qemu' },
  { label: 'Cloud Hypervisor', value: 'cloud-hypervisor' },
  { label: 'crosvm', value: 'crosvm' },
  { label: 'kvmtool', value: 'kvmtool' },
  { label: 'Firecracker', value: 'firecracker' },
]

// Fallback distro options (before API loads)
const STATIC_DISTRO_OPTIONS = [
  { label: 'NixOS', value: 'nixos' },
  { label: 'Arch Linux', value: 'arch' },
  { label: 'Fedora', value: 'fedora' },
  { label: 'Ubuntu', value: 'ubuntu' },
  { label: 'Debian', value: 'debian' },
  { label: 'Alpine', value: 'alpine' },
  { label: 'Other', value: 'other' },
]

const apiDistros = ref<DistroEntry[]>([])
const cloudDistroNames = ref<string[]>(BUILTIN_CLOUD_DISTROS)

interface DistroOption {
  label: string
  value: string
  header?: boolean
  disable?: boolean
  cloudInit?: boolean
  guestOs?: 'linux' | 'windows'
  license?: string
}

const distroOptions = computed<DistroOption[]>(() => {
  if (apiDistros.value.length === 0) return STATIC_DISTRO_OPTIONS

  const options: DistroOption[] = []

  // Built-in cloud distros
  const builtins = apiDistros.value.filter(d => d.category === 'builtin')
  if (builtins.length) {
    options.push({ label: '— Built-in Cloud —', value: '__hdr_builtin', header: true, disable: true })
    for (const d of builtins) options.push({ label: d.label, value: d.name, cloudInit: d.cloudInit, guestOs: d.guestOs, license: d.license })
  }

  // Catalog distros
  const catalog = apiDistros.value.filter(d => d.category === 'catalog')
  if (catalog.length) {
    options.push({ label: '— Catalog —', value: '__hdr_catalog', header: true, disable: true })
    for (const d of catalog) options.push({ label: d.label, value: d.name, cloudInit: d.cloudInit, guestOs: d.guestOs, license: d.license })
  }

  // Custom distros
  const custom = apiDistros.value.filter(d => d.category === 'custom')
  if (custom.length) {
    options.push({ label: '— Custom —', value: '__hdr_custom', header: true, disable: true })
    for (const d of custom) options.push({ label: d.label, value: d.name, cloudInit: d.cloudInit, guestOs: d.guestOs, license: d.license })
  }

  // Other (always last)
  options.push({ label: '— Other —', value: '__hdr_other', header: true, disable: true })
  options.push({ label: 'Other', value: 'other' })

  return options
})

onMounted(async () => {
  if (!isDemoMode()) {
    try {
      apiDistros.value = await distroApiService.getAll()
      cloudDistroNames.value = apiDistros.value.map(d => d.name)
    } catch {
      // Use static fallback
    }

    // Fetch quota usage on Fabrick tier when user is authenticated
    if (appStore.isFabrick && authStore.user?.id) {
      try {
        const { data } = await api.get(`/users/${authStore.user.id}/quotas`)
        // Only show banner if at least one limit is configured
        if (data.maxVms !== null || data.maxMemoryMB !== null || data.maxVcpus !== null) {
          quotaUsage.value = data as QuotaUsageData
        }
      } catch {
        // Quota not available (non-admin, or feature not enabled) — silent ignore
      }
    }
  } else {
    const noUrl = { url: '', effectiveUrl: '', format: 'qcow2' as const, builtin: false, hasOverride: false }
    apiDistros.value = [
      { name: 'nixos',        label: 'NixOS',             ...noUrl, cloudInit: false, guestOs: 'linux',   builtin: true,  category: 'builtin' },
      { name: 'ubuntu-24.04', label: 'Ubuntu 24.04 LTS',  ...noUrl, cloudInit: true,  guestOs: 'linux',   builtin: true,  category: 'builtin' },
      { name: 'rocky-9',      label: 'Rocky Linux 9',     ...noUrl, cloudInit: true,  guestOs: 'linux',   builtin: true,  category: 'builtin' },
      { name: 'alma-9',       label: 'AlmaLinux 9',       ...noUrl, cloudInit: true,  guestOs: 'linux',   category: 'catalog' },
      { name: 'windows-11',   label: 'Windows 11',        ...noUrl, cloudInit: false, guestOs: 'windows', category: 'catalog' },
    ]
    cloudDistroNames.value = apiDistros.value.map(d => d.name)
    if (appStore.isFabrick) {
      quotaUsage.value = { maxVms: 20, maxMemoryMB: 32768, maxVcpus: 64, currentVms: 12, currentMemoryMB: 25600, currentVcpus: 40 }
    }
  }
})

const form = reactive<VmCreateInput>({
  name: '',
  ip: '',
  mem: 512,
  vcpu: 1,
  hypervisor: 'qemu',
  diskSize: 10,
  distro: undefined,
  vmType: undefined,
  autostart: false,
  description: undefined,
  imageUrl: undefined,
  imageFormat: undefined,
  cloudInit: undefined,
})

const desktopMode = computed({
  get: () => form.vmType === 'desktop',
  set: (val: boolean) => { form.vmType = val ? 'desktop' : undefined },
})

/** True when a non-NixOS distro is selected (locks hypervisor to QEMU) */
const isNonNixosDistro = computed(() => {
  if (!form.distro || form.distro === 'nixos') return false
  return true
})

const isWindowsDistro = computed(() => {
  if (!form.distro) return false
  const entry = apiDistros.value.find(d => d.name === form.distro)
  return entry?.guestOs === 'windows'
})

const effectiveHypervisorOptions = computed(() => {
  if (isNonNixosDistro.value) {
    return [{ label: 'QEMU', value: 'qemu' }]
  }
  return hypervisorOptions.filter(o => o.value !== 'firecracker')
})

// Force QEMU when any non-NixOS distro is selected; force desktop for Windows
watch(() => form.distro, (newDistro, oldDistro) => {
  if (isNonNixosDistro.value) {
    form.hypervisor = 'qemu'
  } else if (form.hypervisor === 'firecracker') {
    form.hypervisor = 'qemu'
  }
  if (isWindowsDistro.value) {
    form.vmType = 'desktop'
  }
  // Set defaults when switching to "Other"
  if (newDistro === 'other') {
    form.imageFormat = form.imageFormat ?? 'qcow2'
    form.cloudInit = form.cloudInit ?? true
  }
  // Clear ad-hoc fields when switching away from "Other"
  if (oldDistro === 'other' && newDistro !== 'other') {
    form.imageUrl = undefined
    form.imageFormat = undefined
    form.cloudInit = undefined
  }
})

// Reset desktop mode when switching away from QEMU
watch(() => form.hypervisor, (hv) => {
  if (hv !== 'qemu') {
    form.vmType = undefined
  }
})

// Auto-set cloudInit based on imageFormat (ISO never uses cloud-init)
watch(() => form.imageFormat, (fmt) => {
  if (form.distro === 'other') {
    form.cloudInit = fmt !== 'iso'
  }
})

async function onSubmit() {
  const payload = { ...form }
  // Strip ad-hoc fields when not using "Other" distro
  if (payload.distro !== 'other') {
    delete payload.imageUrl
    delete payload.imageFormat
    delete payload.cloudInit
  }
  const result = await createVm(payload)
  if (result.success) {
    if (isDemoMode()) workloadStore.updateWorkloads(getMockVmState())
    $q.notify({
      type: 'positive',
      message: result.message,
      position: 'top-right',
      timeout: 3000,
    })
    onDialogOK()
  } else {
    $q.notify({
      type: 'negative',
      message: result.message,
      position: 'top-right',
      timeout: 5000,
    })
  }
}
</script>

<style scoped>
.field-wrap {
  position: relative;
}
.field-help {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
}
</style>

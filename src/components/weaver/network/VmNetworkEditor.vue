<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div>
    <div class="row items-center q-mb-sm">
      <div class="text-h6">VM Network Configuration</div>
      <q-space />
      <q-select
        v-model="selectedVm"
        :options="vmOptions"
        label="Select VM"
        emit-value
        map-options
        dense
        outlined
        style="min-width: 220px"
      />
    </div>

    <template v-if="selectedVm">
      <div class="row q-col-gutter-sm">
        <div class="col-12 col-sm-6">
          <q-input
            v-model="vmConfig.ip"
            label="IP Address"
            dense
            outlined
            ref="ipRef"
            :rules="[isValidIPv4]"
            lazy-rules
            @keypress="onlyIPv4Chars"
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-input
            v-model="vmConfig.bridge"
            label="Bridge"
            dense
            outlined
            ref="bridgeRef"
            :rules="[v => !v || /^[a-zA-Z][a-zA-Z0-9-]*$/.test(v) || 'Invalid bridge name']"
            lazy-rules
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-input
            v-model="vmConfig.gateway"
            label="Gateway"
            dense
            outlined
            ref="gatewayRef"
            :rules="[isValidIPv4]"
            lazy-rules
            @keypress="onlyIPv4Chars"
          />
        </div>
        <div class="col-12 col-sm-6">
          <q-input
            v-model="vmConfig.dns"
            label="DNS Server"
            dense
            outlined
            ref="dnsRef"
            :rules="[isValidIPv4]"
            lazy-rules
            @keypress="onlyIPv4Chars"
          />
        </div>
      </div>
      <div class="row items-center q-mt-sm">
        <span class="text-caption text-grey-8">Changes require a VM restart to take effect.</span>
        <q-space />
        <q-btn color="primary" label="Save" dense :loading="saving" @click="validateAndSave" />
      </div>
    </template>

    <div v-else class="text-caption text-grey-8 q-mt-sm">
      Select a VM to edit its network configuration.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useQuasar, type QInput } from 'quasar'
import { useWorkloadStore } from 'src/stores/workload-store'
import { networkApiService } from 'src/services/api'
import { isValidIPv4, onlyIPv4Chars } from 'src/utils/validation'
import { extractErrorMessage } from 'src/utils/error'
import { isDemoMode } from 'src/config/demo'

const $q = useQuasar()
const workloadStore = useWorkloadStore()
const selectedVm = ref<string | null>(null)
const vmConfig = ref({ ip: '', bridge: '', gateway: '', dns: '' })
const saving = ref(false)

const ipRef = ref<QInput | null>(null)
const bridgeRef = ref<QInput | null>(null)
const gatewayRef = ref<QInput | null>(null)
const dnsRef = ref<QInput | null>(null)

const vmOptions = computed(() =>
  workloadStore.workloads.map(vm => ({ label: `${vm.name} (${vm.ip})`, value: vm.name }))
)

watch(selectedVm, async (name) => {
  if (!name) return
  if (isDemoMode()) {
    const vm = workloadStore.workloadByName(name)
    const bridge = vm?.bridge ?? ''
    const BRIDGE_DEFAULTS: Record<string, { gateway: string; dns: string }> = {
      'br-microvm': { gateway: '10.10.0.1',   dns: '1.1.1.1' },
      'br-prod':    { gateway: '10.10.0.1',   dns: '1.1.1.1' },
      'br-dev':     { gateway: '10.10.1.1',   dns: '8.8.8.8' },
      'br-edge':    { gateway: '10.10.1.1',   dns: '1.1.1.1' },
      'br-app':     { gateway: '10.10.2.1',   dns: '10.10.100.10' },
      'br-data':    { gateway: '10.10.3.1',   dns: '10.10.100.10' },
      'br-mgmt':    { gateway: '10.10.100.1', dns: '1.1.1.1' },
      'br-staging': { gateway: '10.10.10.1',  dns: '8.8.8.8' },
    }
    const defaults = BRIDGE_DEFAULTS[bridge] ?? { gateway: '', dns: '' }
    vmConfig.value = {
      ip: vm?.ip ?? '',
      bridge,
      gateway: defaults.gateway,
      dns: defaults.dns,
    }
    return
  }
  try {
    const config = await networkApiService.getVmNetworkConfig(name)
    vmConfig.value = {
      ip: config.ip ?? '',
      bridge: config.bridge ?? '',
      gateway: config.gateway ?? '',
      dns: config.dns ?? '',
    }
  } catch {
    // No saved config — prefill from VM data
    const vm = workloadStore.workloadByName(name)
    vmConfig.value = {
      ip: vm?.ip ?? '',
      bridge: '',
      gateway: '',
      dns: '',
    }
  }
})

async function validateAndSave() {
  const fields = [ipRef.value, bridgeRef.value, gatewayRef.value, dnsRef.value]
  fields.forEach(f => f?.validate())
  if (fields.some(f => f?.hasError)) return
  await save()
}

async function save() {
  if (!selectedVm.value) return
  saving.value = true
  try {
    if (isDemoMode()) {
      $q.notify({ type: 'positive', message: 'Network config saved', position: 'top-right' })
      return
    }
    const result = await networkApiService.setVmNetworkConfig(selectedVm.value, vmConfig.value)
    $q.notify({ type: 'positive', message: result.message, position: 'top-right' })
  } catch (err) {
    $q.notify({ type: 'negative', message: extractErrorMessage(err, 'Failed to save network config'), position: 'top-right' })
  } finally {
    saving.value = false
  }
}
</script>

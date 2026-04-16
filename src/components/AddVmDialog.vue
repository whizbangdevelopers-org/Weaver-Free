<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card style="width: 450px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-none">
        <q-icon name="mdi-server-plus" size="24px" color="primary" class="q-mr-sm" />
        <div class="text-h6">Register Existing VM</div>
        <q-space />
        <q-btn flat round dense icon="mdi-close" @click="close" />
      </q-card-section>

      <q-card-section>
        <div class="text-caption text-grey-8 q-mb-md">
          Track an existing systemd-managed VM (e.g. microvm@name.service) without provisioning.
          For advanced users who manage VMs outside Weaver.
        </div>

        <q-form @submit.prevent="submit" class="q-gutter-sm">
          <q-input
            v-model="form.name"
            outlined
            dense
            label="VM Name *"
            placeholder="my-web-server"
            hint="Lowercase letters, numbers, and hyphens (e.g. my-web-server)"
            :rules="[
              (v: string) => !!v || 'Name is required',
              (v: string) => /^[a-z][a-z0-9-]*$/.test(v) || 'Must start with a letter, only lowercase alphanumeric and hyphens',
              nameNotInUse(workloadStore.workloads),
            ]"
            lazy-rules
          />

          <q-input
            v-model="form.ip"
            outlined
            dense
            label="IP Address"
            hint="Optional (e.g. 10.10.0.10)"
            :rules="[isHostIPv4, ipOnBridgeSubnet(appStore.bridgeGateway), ipNotInUse(workloadStore.workloads)]"
            lazy-rules
            @keypress="onlyIPv4Chars"
          />

          <div class="row q-gutter-sm">
            <q-input
              v-model.number="form.mem"
              outlined
              dense
              label="Memory (MB)"
              type="number"
              class="col"
              :rules="[(v: number) => v >= 0 || 'Must be positive']"
              lazy-rules
            />
            <q-input
              v-model.number="form.vcpu"
              outlined
              dense
              label="vCPUs"
              type="number"
              class="col"
              :rules="[(v: number) => v >= 0 || 'Must be positive']"
              lazy-rules
            />
          </div>

          <q-select
            v-model="form.hypervisor"
            outlined
            dense
            label="Hypervisor"
            :options="hypervisorOptions"
            emit-value
            map-options
          />

          <div class="row justify-end q-mt-md q-gutter-sm">
            <q-btn flat label="Cancel" @click="close" />
            <q-btn
              color="primary"
              label="Register"
              icon="mdi-plus"
              type="submit"
              :loading="loading"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useQuasar } from 'quasar'
import { useWorkloadApi } from 'src/composables/useVmApi'
import { extractErrorMessage } from 'src/utils/error'
import { isHostIPv4, ipNotInUse, ipOnBridgeSubnet, nameNotInUse, onlyIPv4Chars } from 'src/utils/validation'
import { useWorkloadStore } from 'src/stores/workload-store'
import { useAppStore } from 'src/stores/app'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [name: string]
}>()

const $q = useQuasar()
const workloadStore = useWorkloadStore()
const appStore = useAppStore()
const { createVm } = useWorkloadApi()
const loading = ref(false)

const hypervisorOptions = [
  { label: 'QEMU', value: 'qemu' },
  { label: 'Cloud Hypervisor', value: 'cloud-hypervisor' },
  { label: 'Firecracker', value: 'firecracker' },
  { label: 'crosvm', value: 'crosvm' },
  { label: 'kvmtool', value: 'kvmtool' },
]

const form = reactive({
  name: '',
  ip: '',
  mem: 512,
  vcpu: 1,
  hypervisor: 'qemu',
})

function close() {
  emit('update:modelValue', false)
}

function resetForm() {
  form.name = ''
  form.ip = ''
  form.mem = 512
  form.vcpu = 1
  form.hypervisor = 'qemu'
}

async function submit() {
  loading.value = true
  try {
    const result = await createVm({
      name: form.name,
      ip: form.ip || '',
      mem: form.mem,
      vcpu: form.vcpu,
      hypervisor: form.hypervisor,
    })
    if (result.success) {
      $q.notify({
        type: 'positive',
        message: result.message || `VM ${form.name} added`,
        position: 'top-right',
        timeout: 3000,
      })
      emit('created', form.name)
      resetForm()
      close()
    } else {
      $q.notify({
        type: 'negative',
        message: result.message || `Failed to add VM ${form.name}`,
        position: 'top-right',
        timeout: 5000,
      })
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: extractErrorMessage(err, `Failed to add VM ${form.name}`),
      position: 'top-right',
      timeout: 5000,
    })
  } finally {
    loading.value = false
  }
}
</script>

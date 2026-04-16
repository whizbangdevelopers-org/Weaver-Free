<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  Demo-mode create container dialog. Simulates the container creation workflow
  (v1.2+ Weaver Solo). No real container is created — demonstrates the UX flow.
-->
<template>
  <q-dialog :model-value="modelValue" max-width="480px" @update:model-value="emit('update:modelValue', $event)">
    <q-card style="min-width: 320px; max-width: 480px; width: 100%">

      <!-- Header -->
      <q-card-section class="row items-center q-pb-xs">
        <q-icon name="mdi-plus-box-outline" size="22px" color="primary" class="q-mr-sm" />
        <span class="text-h6">Create Container</span>
        <q-space />
        <q-btn flat round dense icon="mdi-close" @click="handleCancel" />
      </q-card-section>

      <q-separator />

      <!-- Form -->
      <q-card-section class="q-gutter-md">
        <q-input
          v-model="form.name"
          label="Container name"
          placeholder="my-container"
          outlined dense
          :error="nameError"
          error-message="Name is required"
        />
        <q-input
          v-model="form.image"
          label="Image reference"
          placeholder="nginx:alpine or docker.io/postgres:16"
          outlined dense
          :error="imageError"
          error-message="Image is required"
        />
        <q-select
          v-model="form.runtime"
          label="Runtime"
          outlined dense
          :options="runtimeOptions"
          emit-value
          map-options
        />
        <q-input
          v-model="form.ports"
          label="Port bindings (optional)"
          placeholder="80:80, 443:443 — host:container"
          outlined dense
        />

        <!-- Resource limits (v1.2 feature) -->
        <q-separator />
        <div class="text-subtitle2 text-grey-8">Resource Limits</div>
        <div class="row q-gutter-sm">
          <q-input
            v-model.number="form.cpuLimit"
            label="CPU cores"
            type="number"
            outlined dense
            class="col"
            :min="0.25"
            :max="16"
            :step="0.25"
            hint="0.25–16 cores"
          />
          <q-input
            v-model.number="form.memoryLimitMb"
            label="Memory (MB)"
            type="number"
            outlined dense
            class="col"
            :min="64"
            :max="32768"
            :step="64"
            hint="64–32768 MB"
          />
        </div>

        <!-- GPU passthrough (Weaver+) -->
        <div class="row items-center q-gutter-sm">
          <q-toggle v-model="form.gpuPassthrough" label="GPU passthrough" :disable="!appStore.isWeaver" />
          <q-badge v-if="!appStore.isWeaver" outline color="amber-9" label="Weaver Solo" />
        </div>
        <q-select
          v-if="form.gpuPassthrough"
          v-model="form.gpuDevice"
          label="GPU device"
          outlined dense
          :options="gpuDeviceOptions"
          emit-value
          map-options
          hint="VFIO-PCI passthrough — exclusive to this container"
        />

        <!-- Volume mounts -->
        <q-separator />
        <div class="text-subtitle2 text-grey-8">Volume Mounts</div>
        <div v-for="(vol, i) in form.volumes" :key="i" class="row q-gutter-xs items-center">
          <q-input v-model="vol.host" label="Host path" outlined dense class="col" placeholder="/data/my-app" />
          <q-icon name="mdi-arrow-right" color="grey" />
          <q-input v-model="vol.container" label="Container path" outlined dense class="col" placeholder="/app/data" />
          <q-btn flat dense icon="mdi-close" color="grey" size="sm" @click="form.volumes.splice(i, 1)" />
        </div>
        <q-btn flat dense size="sm" icon="mdi-plus" label="Add mount" color="primary" @click="form.volumes.push({ host: '', container: '' })" />
      </q-card-section>

      <!-- Actions -->
      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn flat label="Cancel" color="grey-7" @click="handleCancel" />
        <q-btn
          unelevated label="Create" color="primary" icon="mdi-plus"
          :loading="creating"
          @click="handleCreate"
        />
      </q-card-actions>

    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAppStore } from 'src/stores/app'
import { useDemoContainerState } from 'src/composables/useDemoContainerState'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const $q = useQuasar()
const appStore = useAppStore()
const demoState = useDemoContainerState()

const creating = ref(false)
const submitted = ref(false)

const form = ref({
  name: '',
  image: '',
  runtime: 'docker' as string,
  ports: '',
  cpuLimit: 1,
  memoryLimitMb: 512,
  gpuPassthrough: false,
  gpuDevice: '',
  volumes: [] as Array<{ host: string; container: string }>,
})

const nameError = computed(() => submitted.value && !form.value.name.trim())
const imageError = computed(() => submitted.value && !form.value.image.trim())

const runtimeOptions = computed(() => {
  const opts = [
    { label: 'Docker', value: 'docker' },
    { label: 'Podman', value: 'podman' },
  ]
  if (appStore.isWeaver) {
    opts.push({ label: 'Apptainer (SIF)', value: 'apptainer' })
  }
  return opts
})

const gpuDeviceOptions = [
  { label: 'NVIDIA RTX 4090 (0000:01:00.0)', value: 'pci_0000_01_00_0' },
  { label: 'NVIDIA A100 (0000:41:00.0)', value: 'pci_0000_41_00_0' },
  { label: 'AMD Radeon RX 7900 (0000:03:00.0)', value: 'pci_0000_03_00_0' },
]

async function handleCreate() {
  submitted.value = true
  if (!form.value.name.trim() || !form.value.image.trim()) return

  creating.value = true
  await new Promise(r => setTimeout(r, 800))

  const generatedId = 'demo-' + Date.now().toString(36)
  demoState.addContainer(generatedId, 'running')

  $q.notify({
    type: 'positive',
    message: `Container '${form.value.name}' created`,
    position: 'top-right',
    timeout: 3000,
  })

  creating.value = false
  closeAndReset()
}

function handleCancel() {
  closeAndReset()
}

function closeAndReset() {
  emit('update:modelValue', false)
  form.value = { name: '', image: '', runtime: 'docker', ports: '', cpuLimit: 1, memoryLimitMb: 512, gpuPassthrough: false, gpuDevice: '', volumes: [] }
  submitted.value = false
}
</script>

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div>
    <div class="row items-center q-mb-md">
      <div class="text-h6">Bridges</div>
      <q-space />
      <q-btn color="primary" icon="mdi-plus" label="Create Bridge" @click="showCreate = true" />
    </div>

    <q-table
      :rows="mergedBridges"
      :columns="columns"
      row-key="name"
      flat
      bordered
      :loading="loading"
      hide-pagination
    >
      <template #body-cell-name="props">
        <q-td :props="props">
          {{ props.row.name }}
          <q-badge v-if="props.row.autoDetected" outline color="grey" label="auto-detected" class="q-ml-xs" />
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props" auto-width>
          <q-btn
            v-if="!props.row.autoDetected"
            flat
            dense
            icon="mdi-delete"
            color="negative"
            @click="confirmDelete(props.row.name)"
          >
            <q-tooltip>Delete bridge</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- Create Bridge Dialog -->
    <q-dialog v-model="showCreate">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Create Bridge</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="form.name"
            label="Bridge Name"
            hint="e.g. br-lab"
            class="q-mb-sm"
            :rules="[v => !!v || 'Required', v => /^[a-zA-Z][a-zA-Z0-9-]*$/.test(v) || 'Must start with a letter, only letters/digits/hyphens', v => v.length <= 16 || 'Max 16 characters']"
            lazy-rules
            ref="nameRef"
          />
          <q-input
            v-model="form.subnet"
            label="Subnet (CIDR)"
            hint="e.g. 10.20.0.0/24"
            class="q-mb-sm"
            :rules="[v => !!v || 'Required', v => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(v) || 'Must be CIDR notation (e.g. 10.20.0.0/24)']"
            lazy-rules
            ref="subnetRef"
          />
          <q-input
            v-model="form.gateway"
            label="Gateway"
            hint="e.g. 10.20.0.1"
            :rules="[v => !!v || 'Required', isValidIPv4]"
            lazy-rules
            ref="gatewayRef"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Create" :loading="creating" @click="validate" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar, type QInput } from 'quasar'
import { networkApiService } from 'src/services/api'
import type { BridgeInfo } from 'src/types/network'
import { extractErrorMessage } from 'src/utils/error'
import { isValidIPv4 } from 'src/utils/validation'
import { isDemoMode } from 'src/config/demo'

interface MergedBridge extends BridgeInfo {
  autoDetected?: boolean
}

const props = defineProps<{
  topologyBridges?: BridgeInfo[]
}>()

const $q = useQuasar()
const bridges = ref<BridgeInfo[]>([])
const loading = ref(false)

const mergedBridges = computed<MergedBridge[]>(() => {
  const stored = bridges.value
  const storedNames = new Set(stored.map(b => b.name))
  const autoDetected: MergedBridge[] = (props.topologyBridges ?? [])
    .filter(b => !storedNames.has(b.name))
    .map(b => ({ ...b, autoDetected: true }))
  return [...stored, ...autoDetected]
})
const creating = ref(false)
const showCreate = ref(false)
const form = ref({ name: '', subnet: '', gateway: '' })
const nameRef = ref<QInput | null>(null)
const subnetRef = ref<QInput | null>(null)
const gatewayRef = ref<QInput | null>(null)

const columns = [
  { name: 'name', label: 'Name', field: 'name', align: 'left' as const },
  { name: 'subnet', label: 'Subnet', field: 'subnet', align: 'left' as const },
  { name: 'gateway', label: 'Gateway', field: 'gateway', align: 'left' as const },
  { name: 'actions', label: '', field: 'name', align: 'right' as const },
]

async function fetchBridges() {
  if (isDemoMode()) {
    bridges.value = []
    return
  }
  loading.value = true
  try {
    const result = await networkApiService.getBridges()
    bridges.value = result.bridges
  } catch (err) {
    $q.notify({ type: 'negative', message: extractErrorMessage(err, 'Failed to load bridges'), position: 'top-right' })
  } finally {
    loading.value = false
  }
}

async function validate() {
  const fields = [nameRef.value, subnetRef.value, gatewayRef.value]
  fields.forEach(f => f?.validate())
  if (fields.some(f => f?.hasError)) return
  await create()
}

async function create() {
  creating.value = true
  try {
    if (isDemoMode()) {
      bridges.value = [...bridges.value, { name: form.value.name, subnet: form.value.subnet, gateway: form.value.gateway }]
      $q.notify({ type: 'positive', message: `Bridge "${form.value.name}" created`, position: 'top-right' })
      showCreate.value = false
      form.value = { name: '', subnet: '', gateway: '' }
      return
    }
    const result = await networkApiService.createBridge(form.value)
    if (result.success) {
      $q.notify({ type: 'positive', message: result.message, position: 'top-right' })
      showCreate.value = false
      form.value = { name: '', subnet: '', gateway: '' }
      await fetchBridges()
    } else {
      $q.notify({ type: 'negative', message: result.message, position: 'top-right' })
    }
  } catch (err) {
    $q.notify({ type: 'negative', message: extractErrorMessage(err, 'Failed to create bridge'), position: 'top-right' })
  } finally {
    creating.value = false
  }
}

function confirmDelete(name: string) {
  $q.dialog({
    title: 'Delete Bridge',
    message: `Are you sure you want to delete bridge "${name}"?`,
    cancel: true,
    color: 'negative',
  }).onOk(async () => {
    try {
      if (isDemoMode()) {
        bridges.value = bridges.value.filter(b => b.name !== name)
        $q.notify({ type: 'positive', message: `Bridge "${name}" deleted`, position: 'top-right' })
        return
      }
      const result = await networkApiService.deleteBridge(name)
      if (result.success) {
        $q.notify({ type: 'positive', message: result.message, position: 'top-right' })
        await fetchBridges()
      } else {
        $q.notify({ type: 'negative', message: result.message, position: 'top-right' })
      }
    } catch (err) {
      $q.notify({ type: 'negative', message: extractErrorMessage(err, 'Failed to delete bridge'), position: 'top-right' })
    }
  })
}

onMounted(() => { void fetchBridges() })
</script>

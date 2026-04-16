<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div>
    <div class="row items-center q-mb-md">
      <div class="text-h6">Firewall Rules</div>
      <q-space />
      <q-btn color="primary" icon="mdi-plus" label="Add Rule" @click="showAdd = true" />
    </div>

    <q-table
      :rows="rules"
      :columns="columns"
      row-key="id"
      flat
      bordered
      :loading="loading"
      hide-pagination
    >
      <template #body-cell-action="props">
        <q-td :props="props">
          <q-badge :color="props.row.action === 'allow' ? 'positive' : 'negative'" :label="props.row.action" />
        </q-td>
      </template>
      <template #body-cell-actions="props">
        <q-td :props="props" auto-width>
          <q-btn flat dense icon="mdi-delete" color="negative" @click="confirmDelete(props.row.id)">
            <q-tooltip>Delete rule</q-tooltip>
          </q-btn>
        </q-td>
      </template>
      <template #no-data>
        <div class="text-center text-grey-8 q-pa-md">
          No firewall rules configured.
        </div>
      </template>
    </q-table>

    <!-- Add Rule Dialog -->
    <q-dialog v-model="showAdd">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Add Firewall Rule</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="form.source"
            label="Source (VM name or IP)"
            class="q-mb-sm"
            :rules="[v => !!v || 'Required', v => !v.includes('.') || isValidIPv4(v)]"
            lazy-rules
            ref="sourceRef"
          />
          <q-input
            v-model="form.destination"
            label="Destination (VM name or IP)"
            class="q-mb-sm"
            :rules="[v => !!v || 'Required', v => !v.includes('.') || isValidIPv4(v)]"
            lazy-rules
            ref="destRef"
          />
          <div class="row q-gutter-sm q-mb-sm">
            <q-input
              v-model.number="form.port"
              label="Port"
              type="number"
              class="col"
              :rules="[v => (v >= 1 && v <= 65535) || 'Must be 1–65535']"
              lazy-rules
              ref="portRef"
            />
            <q-select v-model="form.protocol" :options="['tcp', 'udp']" label="Protocol" class="col" />
          </div>
          <q-select v-model="form.action" :options="['allow', 'deny']" label="Action" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" label="Add" :loading="adding" @click="validateAndAdd" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuasar, type QInput } from 'quasar'
import { networkApiService } from 'src/services/api'
import type { FirewallRule } from 'src/types/network'
import { extractErrorMessage } from 'src/utils/error'
import { isValidIPv4 } from 'src/utils/validation'
import { isDemoMode } from 'src/config/demo'

const $q = useQuasar()
const rules = ref<FirewallRule[]>([])
const loading = ref(false)
const adding = ref(false)
const showAdd = ref(false)
const sourceRef = ref<QInput | null>(null)
const destRef = ref<QInput | null>(null)
const portRef = ref<QInput | null>(null)

const form = ref({
  source: '',
  destination: '',
  port: 80,
  protocol: 'tcp' as 'tcp' | 'udp',
  action: 'allow' as 'allow' | 'deny',
})

const columns = [
  { name: 'source', label: 'Source', field: 'source', align: 'left' as const },
  { name: 'destination', label: 'Destination', field: 'destination', align: 'left' as const },
  { name: 'port', label: 'Port', field: 'port', align: 'left' as const },
  { name: 'protocol', label: 'Protocol', field: 'protocol', align: 'left' as const },
  { name: 'action', label: 'Action', field: 'action', align: 'left' as const },
  { name: 'actions', label: '', field: 'id', align: 'right' as const },
]

let demoIdCounter = 0

async function fetchRules() {
  if (isDemoMode()) {
    rules.value = [
      { id: 'demo-r1', source: 'web-nginx',  destination: 'app-server',  port: 80,   protocol: 'tcp', action: 'allow' },
      { id: 'demo-r2', source: 'web-nginx',  destination: 'app-server',  port: 443,  protocol: 'tcp', action: 'allow' },
      { id: 'demo-r3', source: 'app-server', destination: 'db-postgres', port: 5432, protocol: 'tcp', action: 'allow' },
      { id: 'demo-r4', source: '*',          destination: 'bastion-01',  port: 22,   protocol: 'tcp', action: 'allow' },
    ]
    return
  }
  loading.value = true
  try {
    const result = await networkApiService.getFirewallRules()
    rules.value = result.rules
  } catch (err) {
    $q.notify({ type: 'negative', message: extractErrorMessage(err, 'Failed to load firewall rules'), position: 'top-right' })
  } finally {
    loading.value = false
  }
}

async function validateAndAdd() {
  const fields = [sourceRef.value, destRef.value, portRef.value]
  fields.forEach(f => f?.validate())
  if (fields.some(f => f?.hasError)) return
  await addRule()
}

async function addRule() {
  adding.value = true
  try {
    if (isDemoMode()) {
      rules.value = [...rules.value, { id: `demo-${++demoIdCounter}`, ...form.value }]
      $q.notify({ type: 'positive', message: 'Rule added', position: 'top-right' })
      showAdd.value = false
      form.value = { source: '', destination: '', port: 80, protocol: 'tcp', action: 'allow' }
      return
    }
    const result = await networkApiService.addFirewallRule(form.value)
    if (result.success) {
      $q.notify({ type: 'positive', message: 'Rule added', position: 'top-right' })
      showAdd.value = false
      form.value = { source: '', destination: '', port: 80, protocol: 'tcp', action: 'allow' }
      await fetchRules()
    }
  } catch (err) {
    $q.notify({ type: 'negative', message: extractErrorMessage(err, 'Failed to add rule'), position: 'top-right' })
  } finally {
    adding.value = false
  }
}

function confirmDelete(id: string) {
  $q.dialog({
    title: 'Delete Rule',
    message: 'Are you sure you want to delete this firewall rule?',
    cancel: true,
    color: 'negative',
  }).onOk(async () => {
    try {
      if (isDemoMode()) {
        rules.value = rules.value.filter(r => r.id !== id)
        $q.notify({ type: 'positive', message: 'Rule deleted', position: 'top-right' })
        return
      }
      const result = await networkApiService.deleteFirewallRule(id)
      if (result.success) {
        $q.notify({ type: 'positive', message: 'Rule deleted', position: 'top-right' })
        await fetchRules()
      }
    } catch (err) {
      $q.notify({ type: 'negative', message: extractErrorMessage(err, 'Failed to delete rule'), position: 'top-right' })
    }
  })
}

onMounted(() => { void fetchRules() })
</script>

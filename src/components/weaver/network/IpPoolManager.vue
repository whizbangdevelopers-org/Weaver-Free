<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div>
    <div class="row items-center q-mb-sm">
      <div class="text-h6">IP Pool Configuration</div>
      <q-space />
      <q-select
        v-model="selectedBridge"
        :options="bridgeOptions"
        label="Bridge"
        emit-value
        map-options
        dense
        outlined
        style="min-width: 220px"
      />
    </div>

    <template v-if="selectedBridge">
      <div class="row q-col-gutter-sm items-start">
        <div class="col-12 col-sm-5">
          <q-input
            v-model="pool.start"
            label="Start IP"
            dense
            outlined
            ref="startRef"
            :rules="[required, isHostIPv4]"
            lazy-rules
            @keypress="onlyIPv4Chars"
          />
        </div>
        <div class="col-12 col-sm-5">
          <q-input
            v-model="pool.end"
            label="End IP"
            dense
            outlined
            ref="endRef"
            :rules="[required, isHostIPv4, endAfterStart]"
            lazy-rules
            @keypress="onlyIPv4Chars"
          />
        </div>
        <div class="col-12 col-sm-2">
          <q-btn color="primary" label="Save" dense :loading="saving" @click="validateAndSave" class="full-width" />
        </div>
      </div>

      <div v-if="pool.allocated.length > 0" class="q-mt-sm">
        <div class="text-caption text-grey-7 q-mb-xs">Allocated ({{ pool.allocated.length }})</div>
        <q-chip v-for="ip in pool.allocated" :key="ip" size="sm" color="grey-3" text-color="dark" dense>
          {{ ip }}
        </q-chip>
      </div>
      <div v-else class="text-caption text-grey-8 q-mt-xs">
        No IPs allocated yet.
      </div>
    </template>

    <div v-else class="text-caption text-grey-8 q-mt-sm">
      Select a bridge to configure its IP pool.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useQuasar, type QInput } from 'quasar'
import { networkApiService } from 'src/services/api'
import { isHostIPv4, onlyIPv4Chars, isValidIPv4 } from 'src/utils/validation'
import { extractErrorMessage } from 'src/utils/error'
import { isDemoMode } from 'src/config/demo'

const props = defineProps<{
  bridges: { name: string; subnet: string; gateway: string }[]
}>()

const $q = useQuasar()
const selectedBridge = ref<string | null>(null)
const pool = ref({ start: '', end: '', allocated: [] as string[] })
const saving = ref(false)

const startRef = ref<QInput | null>(null)
const endRef = ref<QInput | null>(null)

const bridgeOptions = ref<{ label: string; value: string }[]>([])

function required(val: string): true | string {
  return !!val || 'Required'
}

function ipToNum(ip: string): number {
  const p = ip.split('.').map(Number)
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0
}

function endAfterStart(val: string): true | string {
  if (!val || !pool.value.start) return true
  if (isValidIPv4(val) !== true || isValidIPv4(pool.value.start) !== true) return true
  if (ipToNum(val) < ipToNum(pool.value.start)) return 'Must be ≥ start IP'
  return true
}

watch(() => props.bridges, (b) => {
  bridgeOptions.value = b.map(br => ({ label: `${br.name} (${br.subnet})`, value: br.name }))
}, { immediate: true })

watch(selectedBridge, async (bridge) => {
  if (!bridge) return
  if (isDemoMode()) {
    const DEMO_POOLS: Record<string, { start: string; end: string; allocated: string[] }> = {
      'br-microvm': { start: '10.10.0.100', end: '10.10.0.200', allocated: ['10.10.0.10', '10.10.0.11', '10.10.0.12'] },
      'br-prod':    { start: '10.10.0.100', end: '10.10.0.200', allocated: ['10.10.0.10', '10.10.0.11'] },
      'br-data':    { start: '10.10.2.100', end: '10.10.2.200', allocated: ['10.10.2.10'] },
      'br-dev':     { start: '10.10.1.100', end: '10.10.1.200', allocated: ['10.10.1.20', '10.10.1.40', '10.10.1.50'] },
      'br-edge':    { start: '10.10.1.100', end: '10.10.1.200', allocated: ['10.10.1.10', '10.10.1.11'] },
      'br-app':     { start: '10.10.2.100', end: '10.10.2.200', allocated: ['10.10.2.5', '10.10.2.6', '10.10.2.10', '10.10.2.11'] },
      'br-mgmt':    { start: '10.10.100.100', end: '10.10.100.200', allocated: ['10.10.100.10', '10.10.100.11'] },
      'br-staging': { start: '10.10.10.100', end: '10.10.10.200', allocated: ['10.10.10.10', '10.10.10.11'] },
    }
    pool.value = DEMO_POOLS[bridge] ?? { start: '', end: '', allocated: [] }
    return
  }
  try {
    const data = await networkApiService.getIpPool(bridge)
    pool.value = { start: data.start, end: data.end, allocated: data.allocated }
  } catch {
    pool.value = { start: '', end: '', allocated: [] }
  }
})

async function validateAndSave() {
  const fields = [startRef.value, endRef.value]
  fields.forEach(f => f?.validate())
  if (fields.some(f => f?.hasError)) return
  await save()
}

async function save() {
  if (!selectedBridge.value) return
  saving.value = true
  try {
    if (isDemoMode()) {
      $q.notify({ type: 'positive', message: 'IP pool saved', position: 'top-right' })
      return
    }
    const result = await networkApiService.setIpPool(selectedBridge.value, {
      start: pool.value.start,
      end: pool.value.end,
      allocated: pool.value.allocated,
    })
    if (result.success) {
      $q.notify({ type: 'positive', message: 'IP pool saved', position: 'top-right' })
    }
  } catch (err) {
    $q.notify({ type: 'negative', message: extractErrorMessage(err, 'Failed to save IP pool'), position: 'top-right' })
  } finally {
    saving.value = false
  }
}
</script>

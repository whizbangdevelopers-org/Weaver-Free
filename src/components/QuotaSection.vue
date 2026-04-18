<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-card flat bordered class="q-mb-md">
    <q-card-section>
      <div class="row items-center q-mb-md">
        <q-icon name="mdi-gauge" size="24px" color="primary" class="q-mr-sm" />
        <div class="text-subtitle1 text-weight-medium">Resource Quotas</div>
        <q-space />
        <q-badge v-if="!hasAnyLimit" outline color="grey" label="Unlimited" />
      </div>

      <q-banner v-if="loadError" rounded class="bg-red-1 text-red-9 q-mb-md">
        <template #avatar>
          <q-icon name="mdi-alert-circle" color="red" />
        </template>
        {{ loadError }}
      </q-banner>

      <div v-if="loading" class="text-center q-pa-md">
        <q-spinner color="primary" size="32px" />
        <div class="text-caption q-mt-sm">Loading quotas...</div>
      </div>

      <template v-else>
        <q-form @submit.prevent="save">
        <div class="q-gutter-md">
          <!-- Max VMs -->
          <div class="row items-center q-gutter-sm">
            <q-toggle
              :model-value="form.maxVms !== null"
              @update:model-value="(v: boolean) => toggleLimit('maxVms', v, 10)"
              dense
            />
            <div class="col">
              <q-input
                v-model.number="form.maxVms"
                label="Max VMs"
                type="number"
                outlined
                dense
                :disable="form.maxVms === null"
                :rules="form.maxVms !== null ? [(v: number) => v >= 0 || 'Must be 0 or greater'] : []"
                lazy-rules
                :hint="usageHint('VMs', usage?.currentVms, form.maxVms)"
              />
            </div>
          </div>

          <!-- Max Memory -->
          <div class="row items-center q-gutter-sm">
            <q-toggle
              :model-value="form.maxMemoryMB !== null"
              @update:model-value="(v: boolean) => toggleLimit('maxMemoryMB', v, 4096)"
              dense
            />
            <div class="col">
              <q-input
                v-model.number="form.maxMemoryMB"
                label="Max Total Memory (MB)"
                type="number"
                outlined
                dense
                :disable="form.maxMemoryMB === null"
                :rules="form.maxMemoryMB !== null ? [(v: number) => v >= 0 || 'Must be 0 or greater'] : []"
                lazy-rules
                :hint="usageHint('MB', usage?.currentMemoryMB, form.maxMemoryMB)"
              />
            </div>
          </div>

          <!-- Max vCPUs -->
          <div class="row items-center q-gutter-sm">
            <q-toggle
              :model-value="form.maxVcpus !== null"
              @update:model-value="(v: boolean) => toggleLimit('maxVcpus', v, 8)"
              dense
            />
            <div class="col">
              <q-input
                v-model.number="form.maxVcpus"
                label="Max Total vCPUs"
                type="number"
                outlined
                dense
                :disable="form.maxVcpus === null"
                :rules="form.maxVcpus !== null ? [(v: number) => v >= 0 || 'Must be 0 or greater'] : []"
                lazy-rules
                :hint="usageHint('vCPUs', usage?.currentVcpus, form.maxVcpus)"
              />
            </div>
          </div>
        </div>

        <q-card-actions align="right" class="q-pt-md">
          <q-btn
            flat
            label="Reset to Unlimited"
            color="grey"
            :disable="!hasAnyLimit || saving"
            @click="resetToUnlimited"
          />
          <q-btn
            color="primary"
            label="Save Quotas"
            :loading="saving"
            :disable="!dirty"
            icon="mdi-content-save"
            type="submit"
          />
        </q-card-actions>
        </q-form>
      </template>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'src/boot/axios'
import { isDemoMode } from 'src/config/demo-mode'

interface QuotaForm {
  maxVms: number | null
  maxMemoryMB: number | null
  maxVcpus: number | null
}

interface QuotaUsage {
  currentVms: number
  currentMemoryMB: number
  currentVcpus: number
}

const props = defineProps<{
  userId: string
}>()

const $q = useQuasar()
const loading = ref(false)
const saving = ref(false)
const loadError = ref<string | null>(null)

const form = reactive<QuotaForm>({
  maxVms: null,
  maxMemoryMB: null,
  maxVcpus: null,
})

/** Snapshot of the last-saved state, for dirty detection */
const saved = ref<QuotaForm>({ maxVms: null, maxMemoryMB: null, maxVcpus: null })

const usage = ref<QuotaUsage | null>(null)

const hasAnyLimit = computed(() =>
  form.maxVms !== null || form.maxMemoryMB !== null || form.maxVcpus !== null
)

const dirty = computed(() =>
  form.maxVms !== saved.value.maxVms ||
  form.maxMemoryMB !== saved.value.maxMemoryMB ||
  form.maxVcpus !== saved.value.maxVcpus
)

function usageHint(label: string, current: number | undefined, limit: number | null): string {
  if (limit === null) return 'Unlimited'
  if (current === undefined) return `Limit: ${limit} ${label}`
  return `${current} of ${limit} ${label} used`
}

function toggleLimit(field: keyof QuotaForm, enabled: boolean, defaultVal: number) {
  form[field] = enabled ? defaultVal : null
}

function resetToUnlimited() {
  form.maxVms = null
  form.maxMemoryMB = null
  form.maxVcpus = null
}

async function loadQuotas() {
  loading.value = true
  loadError.value = null
  try {
    if (isDemoMode()) {
      const data = { maxVms: 10, maxMemoryMB: 16384, maxVcpus: 16, currentVms: 3, currentMemoryMB: 4096, currentVcpus: 6 }
      form.maxVms = data.maxVms
      form.maxMemoryMB = data.maxMemoryMB
      form.maxVcpus = data.maxVcpus
      saved.value = { maxVms: data.maxVms, maxMemoryMB: data.maxMemoryMB, maxVcpus: data.maxVcpus }
      usage.value = { currentVms: data.currentVms, currentMemoryMB: data.currentMemoryMB, currentVcpus: data.currentVcpus }
      loading.value = false
      return
    }
    const { data } = await api.get(`/users/${props.userId}/quotas`)
    form.maxVms = data.maxVms
    form.maxMemoryMB = data.maxMemoryMB
    form.maxVcpus = data.maxVcpus
    saved.value = { maxVms: data.maxVms, maxMemoryMB: data.maxMemoryMB, maxVcpus: data.maxVcpus }
    usage.value = {
      currentVms: data.currentVms,
      currentMemoryMB: data.currentMemoryMB,
      currentVcpus: data.currentVcpus,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load quotas'
    loadError.value = msg
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  try {
    if (!isDemoMode()) await api.put(`/users/${props.userId}/quotas`, {
      maxVms: form.maxVms,
      maxMemoryMB: form.maxMemoryMB,
      maxVcpus: form.maxVcpus,
    })
    saved.value = { ...form }
    $q.notify({ type: 'positive', message: 'Quotas updated', position: 'top-right', timeout: 3000 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save quotas'
    $q.notify({ type: 'negative', message: msg, position: 'top-right', timeout: 5000 })
  } finally {
    saving.value = false
  }
}

// Reload when userId changes
watch(() => props.userId, () => {
  if (props.userId) void loadQuotas()
})

onMounted(() => {
  if (props.userId) void loadQuotas()
})
</script>

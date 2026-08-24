<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Service-probe configuration — Solo and above.

  The tier split for this feature is asymmetric and both halves are deliberate: SEEING health is
  Free (it rides the existing vm-status broadcast and costs nothing to serve), CONFIGURING a probe
  is Solo, because it is a mutation and follows the provisioning gate. So this component is only
  ever mounted behind `appStore.isSolo`; it does not gate itself, for the same reason the Clone
  button does not — one gate, at the call site, matching the route's own `requireTier(SOLO)`.

  Validation here is deliberately WEAKER than the route's, and that is the point. Ports, duplicates
  and label length are checked inline so the user sees which row is wrong before a round trip. The
  URL rule is NOT re-implemented: it is an SSRF control that lives at the point of egress
  (`health-probe.ts`'s `isProbeableUrl`, reachable from no browser bundle), and a second copy here
  would be a security predicate with no authority, free to drift from the one that matters. So the
  URL field gets a shape hint only, and a rejected URL surfaces the HOST's own sentence.
-->
<template>
  <q-dialog v-model="open">
    <q-card style="min-width: 420px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-subtitle1">Service Health Probes</div>
        <q-space />
        <q-btn v-close-popup flat dense round icon="mdi-close" />
      </q-card-section>

      <q-card-section class="q-pt-sm">
        <div class="text-caption text-grey-7 q-mb-sm">
          Weaver checks each port every broadcast cycle and reports whether the service inside
          <span class="text-weight-medium">{{ vmName }}</span> answers. Up to {{ MAX_PROBES }} probes.
        </div>

        <!-- A plain scrolling div, not q-scroll-area: inside an auto-height dialog card a
             q-scroll-area collapses to zero height and hides every row. -->
        <div style="max-height: 46vh; overflow: auto">
          <div v-if="rows.length === 0" class="text-caption text-grey-6 q-py-md text-center">
            No probes configured. Add one to see service health on the card and in this panel.
          </div>

          <div v-for="(row, i) in rows" :key="row.key" class="q-mb-sm probe-row">
            <div class="row items-start q-col-gutter-xs">
              <div class="col-3">
                <q-input
                  v-model.number="row.port"
                  dense outline type="number" label="Port"
                  :error="!!rowErrors[i]?.port" :error-message="rowErrors[i]?.port"
                  :data-testid="`probe-port-${i}`"
                />
              </div>
              <div class="col-3">
                <q-select
                  v-model="row.type"
                  dense outline :options="['tcp', 'http']" label="Type"
                  :data-testid="`probe-type-${i}`"
                />
              </div>
              <div class="col">
                <q-input
                  v-model="row.label"
                  dense outline label="Label (optional)"
                  :error="!!rowErrors[i]?.label" :error-message="rowErrors[i]?.label"
                  :data-testid="`probe-label-${i}`"
                />
              </div>
              <div class="col-auto">
                <q-btn flat dense round icon="mdi-delete" color="negative" :data-testid="`probe-remove-${i}`" @click="rows.splice(i, 1)" />
              </div>
            </div>
            <div v-if="row.type === 'http'" class="row q-mt-xs">
              <div class="col">
                <q-input
                  v-model="row.url"
                  dense outline label="URL (optional)"
                  :placeholder="`http://${vmIp || '10.0.0.1'}:${row.port || 80}`"
                  :error="!!rowErrors[i]?.url" :error-message="rowErrors[i]?.url"
                  :data-testid="`probe-url-${i}`"
                >
                  <template #hint>
                    Leave blank to probe http://{{ vmIp || 'the workload IP' }}:{{ row.port || '…' }}. Private addresses only.
                  </template>
                </q-input>
              </div>
            </div>
          </div>
        </div>

        <q-btn
          flat dense no-caps color="primary" icon="mdi-plus" label="Add probe"
          class="q-mt-sm" :disable="rows.length >= MAX_PROBES"
          data-testid="probe-add" @click="addRow"
        />

        <q-banner v-if="formError" dense rounded class="bg-red-1 text-negative q-mt-sm">
          {{ formError }}
        </q-banner>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn v-close-popup flat label="Cancel" />
        <q-btn
          color="primary" label="Save" :loading="saving" :disable="hasErrors"
          data-testid="probe-save" @click="save"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useWorkloadApi } from 'src/composables/useVmApi'
import type { ServiceProbeSpec } from 'src/types/workload'

const MAX_PROBES = 10

interface ProbeRow {
  /** Stable v-for key. Port is NOT usable as one: it is the field being edited, so a keystroke
      that changes it would remount the row and drop focus mid-type. */
  key: number
  port: number | null
  type: 'tcp' | 'http'
  url: string
  label: string
}

const props = defineProps<{
  modelValue: boolean
  vmName: string
  vmIp?: string
  probes?: ServiceProbeSpec[]
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  saved: [ServiceProbeSpec[]]
}>()

const $q = useQuasar()
const { setServiceProbes } = useWorkloadApi()

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const rows = ref<ProbeRow[]>([])
const saving = ref(false)
const formError = ref('')
let nextKey = 0

function toRows(probes: ServiceProbeSpec[] | undefined): ProbeRow[] {
  return (probes ?? []).map(p => ({
    key: nextKey++,
    port: p.port,
    type: p.type,
    url: p.url ?? '',
    label: p.label ?? '',
  }))
}

// Re-seed whenever the dialog OPENS, not on mount: the panel keeps this component alive across
// opens, so seeding once would show the first workload's probes forever.
watch(open, isOpen => {
  if (isOpen) {
    rows.value = toRows(props.probes)
    formError.value = ''
  }
})

function addRow(): void {
  if (rows.value.length >= MAX_PROBES) return
  rows.value.push({ key: nextKey++, port: null, type: 'tcp', url: '', label: '' })
}

/** Per-row field errors, mirroring the route's schema so the user sees WHICH row is wrong. */
const rowErrors = computed(() => rows.value.map((row, i) => {
  const errs: { port?: string; url?: string; label?: string } = {}
  if (row.port === null || !Number.isInteger(row.port) || row.port < 1 || row.port > 65535) {
    errs.port = 'Port must be 1–65535'
  } else if (rows.value.findIndex(r => r.port === row.port) !== i) {
    // One probe per port — two probes on 8080 render as two rows for one service, and the route
    // rejects the payload outright, so say so here rather than after a round trip.
    errs.port = 'Already probed'
  }
  // Shape only — NOT the SSRF rule, which the host owns. This catches a typo before a round trip
  // without pretending to be the authority; anything shaped like a URL goes to the host to judge.
  if (row.type === 'http' && row.url.trim() !== '' && !/^https?:\/\/\S+$/.test(row.url.trim())) {
    errs.url = 'Must start with http:// or https://'
  }
  if (row.label.length > 40) errs.label = 'At most 40 characters'
  return errs
}))

const hasErrors = computed(() => rowErrors.value.some(e => Object.keys(e).length > 0))

function toSpecs(): ServiceProbeSpec[] {
  return rows.value.map(row => ({
    port: row.port as number,
    type: row.type,
    ...(row.type === 'http' && row.url.trim() ? { url: row.url.trim() } : {}),
    ...(row.label.trim() ? { label: row.label.trim() } : {}),
  }))
}

async function save(): Promise<void> {
  if (hasErrors.value) return
  saving.value = true
  formError.value = ''
  const specs = toSpecs()
  const result = await setServiceProbes(props.vmName, specs, props.probes ?? [])
  saving.value = false
  if (!result.success) {
    formError.value = result.message ?? 'Could not save probes. The host rejected the change.'
    return
  }
  $q.notify({ type: 'positive', message: `Saved ${specs.length} probe${specs.length === 1 ? '' : 's'}` })
  emit('saved', result.serviceProbes)
  open.value = false
}
</script>

<style scoped lang="scss">
.probe-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding-bottom: 6px;
}
.probe-row:last-child {
  border-bottom: none;
}
</style>

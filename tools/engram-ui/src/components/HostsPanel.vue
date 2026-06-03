<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="column q-pa-md" style="height: 100%; overflow: auto">

    <!-- Header -->
    <div class="row items-center q-mb-md">
      <div class="text-subtitle1">
        <q-icon name="mdi-server" class="q-mr-xs" />
        Infrastructure
      </div>
      <q-space />
      <q-btn flat dense icon="mdi-plus" label="Add" class="q-mr-xs" @click="openAdd" />
      <q-btn flat dense icon="mdi-sync" label="Sync" class="q-mr-xs" :loading="syncing" @click="emit('sync')" />
      <q-btn flat dense round icon="mdi-refresh" :loading="loading" @click="emit('refresh')" />
    </div>

    <q-banner v-if="error" rounded class="bg-negative text-white q-mb-md" dense>
      {{ error }}
    </q-banner>

    <!-- Empty -->
    <div v-if="!loading && hosts.length === 0" class="flex flex-center q-pa-xl column items-center text-grey-6">
      <q-icon name="mdi-server-off" size="64px" color="grey-4" />
      <div class="text-caption q-mt-sm">No hosts in registry</div>
      <div class="text-caption text-grey-5">Run <span class="text-mono">npm run sync:hosts</span> in anvil, or click Add</div>
    </div>

    <!-- Loading -->
    <div v-else-if="loading && hosts.length === 0" class="flex flex-center q-pa-xl">
      <q-spinner-dots color="primary" size="40px" />
    </div>

    <!-- Table -->
    <q-table
      v-else
      flat
      bordered
      dense
      :rows="hosts"
      :columns="columns"
      row-key="hostname"
      hide-pagination
      :rows-per-page-options="[0]"
    >
      <template #body-cell-hostname="props">
        <q-td :props="props">
          <span class="text-mono text-weight-medium">{{ props.row.hostname }}</span>
        </q-td>
      </template>

      <template #body-cell-status="props">
        <q-td :props="props">
          <q-badge
            :color="statusColor(props.row.status)"
            :label="props.row.status"
          />
        </q-td>
      </template>

      <template #body-cell-capacity="props">
        <q-td :props="props">
          <div class="text-caption">
            {{ props.row.capacity.cpus }}t ·
            {{ ramGb(props.row.capacity.memory_mb) }} GB ·
            {{ props.row.capacity.disk_gb }} GB
          </div>
          <div v-if="props.row.capacity.cpu_model" class="text-caption text-grey-6 text-mono" style="font-size:10px">
            {{ props.row.capacity.cpu_model }}
          </div>
        </q-td>
      </template>

      <template #body-cell-ips="props">
        <q-td :props="props">
          <div v-for="(ip, iface) in props.row.network.ips" :key="iface" class="text-caption text-mono">
            {{ iface }}={{ ip }}
          </div>
        </q-td>
      </template>

      <template #body-cell-last_sync="props">
        <q-td :props="props">
          <span v-if="props.row.lastUpdated" class="text-caption">{{ fmtTs(props.row.lastUpdated) }}</span>
          <span v-else class="text-caption text-grey-5">—</span>
        </q-td>
      </template>

      <template #body-cell-actions="props">
        <q-td :props="props" class="text-right">
          <q-btn flat dense round icon="mdi-pencil" size="sm" @click="openEdit(props.row)">
            <q-tooltip>Edit</q-tooltip>
          </q-btn>
          <q-btn flat dense round icon="mdi-delete" size="sm" color="negative" @click="confirmDelete(props.row)">
            <q-tooltip>Delete</q-tooltip>
          </q-btn>
        </q-td>
      </template>
    </q-table>

    <!-- Add / Edit dialog -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="width: 560px; max-width: 95vw">
        <q-bar class="bg-primary text-white">
          <q-icon name="mdi-server" />
          <span class="q-ml-sm">{{ editTarget ? `Edit ${editTarget.hostname}` : 'Add Host' }}</span>
          <q-space />
          <q-btn dense flat round icon="mdi-close" v-close-popup />
        </q-bar>

        <q-card-section class="q-gutter-sm">
          <q-input
            v-model="form.hostname"
            label="Hostname"
            dense outlined
            :readonly="!!editTarget"
            :hint="editTarget ? 'Hostname cannot be changed' : ''"
          />
          <div class="row q-gutter-sm">
            <q-select
              v-model="form.role"
              :options="roleOptions"
              label="Role"
              dense outlined emit-value map-options
              class="col"
            />
            <q-input v-model="form.os"   label="OS"   dense outlined class="col" />
            <q-input v-model="form.arch" label="Arch" dense outlined class="col" />
          </div>

          <div class="text-caption text-grey-7 q-mt-sm">Capacity</div>
          <div class="row q-gutter-sm">
            <q-input v-model.number="form.capacity.cpus"      label="Threads" type="number" dense outlined class="col" />
            <q-input v-model.number="form.capacity.memory_gb" label="RAM (GB)" type="number" dense outlined class="col" />
            <q-input v-model.number="form.capacity.disk_gb"   label="Disk (GB)" type="number" dense outlined class="col" />
          </div>
          <q-input v-model="form.capacity.cpu_model" label="CPU Model" dense outlined />

          <div class="text-caption text-grey-7 q-mt-sm">IPs (JSON object, e.g. {"trust":"192.168.0.8"})</div>
          <q-input v-model="form.ipsJson" label="IPs" dense outlined type="textarea" autogrow :error="!!ipsJsonError" :error-message="ipsJsonError ?? undefined" />

          <div class="text-caption text-grey-7">Facts (JSON object, freeform)</div>
          <q-input v-model="form.factsJson" label="Facts" dense outlined type="textarea" autogrow :error="!!factsJsonError" :error-message="factsJsonError ?? undefined" />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="primary" :label="editTarget ? 'Save' : 'Add'" :loading="saving" @click="submitForm" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Delete confirm dialog -->
    <q-dialog v-model="deleteOpen">
      <q-card>
        <q-card-section>
          <div class="text-subtitle1">Delete <span class="text-mono">{{ deleteTarget?.hostname }}</span>?</div>
          <div class="text-caption text-grey-7 q-mt-xs">This removes the host from the registry. The machine itself is unaffected.</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn color="negative" label="Delete" :loading="deleting" @click="submitDelete" />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { HostRecord, HostInput, HostPatch } from '../composables/useEngramMonitor'

defineProps<{
  hosts:   HostRecord[]
  loading: boolean
  syncing: boolean
  error:   string | null
}>()

const emit = defineEmits<{
  refresh: []
  sync:    []
  create:  [input: HostInput]
  update:  [hostname: string, patch: HostPatch]
  delete:  [hostname: string]
}>()

const roleOptions = [
  { label: 'primary-dev',   value: 'primary-dev'   },
  { label: 'hypervisor',    value: 'hypervisor'     },
  { label: 'load-test',     value: 'load-test'      },
  { label: 'ai-inference',  value: 'ai-inference'   },
  { label: 'other',         value: 'other'          },
]

const columns = [
  { name: 'hostname',    label: 'Host',        field: 'hostname',   align: 'left'   as const },
  { name: 'role',        label: 'Role',        field: 'role',       align: 'left'   as const },
  { name: 'status',      label: 'Status',      field: 'status',     align: 'left'   as const },
  { name: 'capacity',    label: 'Capacity',    field: 'capacity',   align: 'left'   as const },
  { name: 'ips',         label: 'IPs',         field: 'network',    align: 'left'   as const },
  { name: 'last_sync',   label: 'Last Sync',   field: 'lastUpdated', align: 'left'   as const },
  { name: 'actions',     label: '',            field: 'hostname',   align: 'right'  as const },
]

// ── Dialog state ──────────────────────────────────────────────────────────────
const dialogOpen  = ref(false)
const editTarget  = ref<HostRecord | null>(null)
const saving      = ref(false)
const deleteOpen  = ref(false)
const deleteTarget = ref<HostRecord | null>(null)
const deleting    = ref(false)

const blankForm = () => ({
  hostname: '',
  role: 'other',
  os: 'nixos',
  arch: 'x86_64',
  capacity: { cpus: 0, cpu_model: '', memory_gb: 0, disk_gb: 0 },
  ipsJson: '{}',
  factsJson: '{}',
})

const form = ref(blankForm())

const ipsJsonError = computed(() => {
  try { JSON.parse(form.value.ipsJson); return null }
  catch { return 'Invalid JSON' }
})
const factsJsonError = computed(() => {
  try { JSON.parse(form.value.factsJson); return null }
  catch { return 'Invalid JSON' }
})

function openAdd() {
  editTarget.value = null
  form.value = blankForm()
  dialogOpen.value = true
}

function openEdit(host: HostRecord) {
  editTarget.value = host
  form.value = {
    hostname: host.hostname,
    role:     host.role,
    os:       host.os,
    arch:     host.arch,
    capacity: {
      cpus:      host.capacity.cpus,
      cpu_model: host.capacity.cpu_model,
      memory_gb: Math.round((host.capacity.memory_mb ?? 0) / 1024),
      disk_gb:   host.capacity.disk_gb,
    },
    ipsJson:  JSON.stringify(host.network.ips ?? {}, null, 2),
    factsJson: JSON.stringify(host.facts, null, 2),
  }
  dialogOpen.value = true
}

function confirmDelete(host: HostRecord) {
  deleteTarget.value = host
  deleteOpen.value = true
}

async function submitForm() {
  if (ipsJsonError.value || factsJsonError.value) return
  saving.value = true
  try {
    const ips   = JSON.parse(form.value.ipsJson)   as Record<string, string>
    const facts = JSON.parse(form.value.factsJson) as Record<string, unknown>
    const capacity = {
      cpus:      form.value.capacity.cpus,
      cpu_model: form.value.capacity.cpu_model,
      memory_mb: form.value.capacity.memory_gb * 1024,
      disk_gb:   form.value.capacity.disk_gb,
    }
    if (editTarget.value) {
      const patch: HostPatch = {
        role: form.value.role, os: form.value.os, arch: form.value.arch,
        capacity,
        network: { ips, bridges: editTarget.value.network.bridges ?? {} },
        facts,
      }
      emit('update', editTarget.value.hostname, patch)
    } else {
      const input: HostInput = {
        hostname: form.value.hostname,
        role: form.value.role, os: form.value.os, arch: form.value.arch,
        status: 'unknown',
        capacity,
        network: { ips, bridges: {} },
        facts,
      }
      emit('create', input)
    }
    dialogOpen.value = false
  } finally {
    saving.value = false
  }
}

async function submitDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    emit('delete', deleteTarget.value.hostname)
    deleteOpen.value = false
  } finally {
    deleting.value = false
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────
function statusColor(s: string) {
  if (s === 'reachable') return 'positive'
  if (s === 'unreachable') return 'warning'
  return 'grey'
}

function ramGb(mb: number) {
  return mb ? Math.round(mb / 1024) : 0
}

function fmtTs(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

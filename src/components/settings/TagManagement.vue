<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-card flat bordered>
    <q-expansion-item icon="mdi-tag-multiple" label="Tag Management" caption="Preset tags and workload tag counts" header-class="text-h6">
    <q-card-section>
      <div class="text-body2 text-grey-8 q-mb-md">
        Preset tags appear as suggestions when tagging workloads. Tags in use are shown with their workload counts.
      </div>

      <!-- Loading state -->
      <div v-if="loadingPresets" class="text-center q-pa-md">
        <q-spinner color="primary" size="24px" />
      </div>

      <template v-else>
        <!-- Empty state -->
        <div v-if="combinedTags.length === 0" class="text-grey-8 text-center q-pa-md">
          <q-icon name="mdi-tag-off" size="32px" class="q-mb-sm" /><br>
          No tags defined. Add preset tags below or tag workloads on their detail pages.
        </div>

        <!-- Tag list -->
        <q-list v-else separator>
          <q-item v-for="tag in combinedTags" :key="tag.name" class="q-py-sm">
            <q-item-section>
              <q-item-label class="row items-center q-gutter-xs">
                <q-chip dense outline size="sm" color="primary">{{ tag.name }}</q-chip>
                <q-badge v-if="tag.vmCount > 0" color="grey" :label="`${tag.vmCount} VM${tag.vmCount !== 1 ? 's' : ''}`" />
                <!-- containerCount comes from partitionTagCounts(), which splits workloads on the
                     runtime field. It renders whenever a TAGGED workload has a container runtime.
                     In the demo that is currently never: demo containers are still a separate
                     ContainerInfo[] (getDemoContainersForTier) and ContainerInfo has no tags field,
                     so they are not in workloadStore.workloads at all. Merging them into the
                     workload list is gap 1 of agents/v1.1.0/container-visibility.md, not this one.
                     This badge previously showed counts invented by a hand-maintained array in this
                     component that had to "stay in sync with FREE_CONTAINERS" — the counts were not
                     derived from anything. Showing nothing true beats showing something false. -->
                <q-badge v-if="tag.containerCount > 0" color="teal" :label="`${tag.containerCount} container${tag.containerCount !== 1 ? 's' : ''}`" />
                <q-badge v-if="tag.isPreset && tag.vmCount === 0 && tag.containerCount === 0" outline color="blue-grey" label="preset" />
              </q-item-label>
              <q-item-label v-if="tag.vmNames.length > 0 || tag.containerNames.length > 0" caption>
                {{ [...tag.vmNames, ...tag.containerNames].join(', ') }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-btn
                  v-if="tag.vmCount > 0"
                  flat dense
                  icon="mdi-pencil"
                  size="sm"
                  :loading="renamingTag === tag.name"
                  @click="startRename(tag)"
                >
                  <q-tooltip>Rename tag across all workloads</q-tooltip>
                </q-btn>
                <q-btn
                  flat dense
                  icon="mdi-delete"
                  color="negative"
                  size="sm"
                  :loading="deletingTag === tag.name"
                  @click="confirmDelete(tag)"
                >
                  <q-tooltip v-if="tag.vmCount > 0 || tag.containerCount > 0">Delete tag from all workloads{{ tag.isPreset ? ' and presets' : '' }}</q-tooltip>
                  <q-tooltip v-else>Remove preset tag</q-tooltip>
                </q-btn>
              </div>
            </q-item-section>
          </q-item>
        </q-list>

        <!-- Add preset tag input -->
        <q-form @submit.prevent="addPresetTag" class="row items-center q-gutter-sm q-mt-md">
          <q-input
            v-model="newPresetTag"
            dense
            outlined
            placeholder="Add preset tag..."
            class="col"
            :rules="[presetTagRule]"
            lazy-rules
          />
          <q-btn
            flat
            dense
            icon="mdi-plus"
            color="primary"
            label="Add"
            :disable="!isValidNewPreset"
            :loading="savingPresets"
            type="submit"
          />
        </q-form>
      </template>
    </q-card-section>
    </q-expansion-item>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useWorkloadStore } from 'src/stores/workload-store'
import { useWorkloadApi } from 'src/composables/useVmApi'
import { presetTagApiService } from 'src/services/api'
import { isDemoMode } from 'src/config/demo-mode'
import { partitionTagCounts } from 'src/utils/tag-counts'

const TAG_PATTERN = /^[a-z0-9][a-z0-9-]*$/

// Combined tag info for display (Decision WVR-60).
// Partitioned by runtime: containers are 'docker'|'podman'|'apptainer';
// everything else (including absent runtime) is a VM.
interface CombinedTag {
  name: string
  vmCount: number
  vmNames: string[]
  containerCount: number
  containerNames: string[]
  isPreset: boolean
}

const $q = useQuasar()
const workloadStore = useWorkloadStore()
const { fetchVms, setTags } = useWorkloadApi()

const renamingTag = ref<string | null>(null)
const deletingTag = ref<string | null>(null)
const loadingPresets = ref(false)
const savingPresets = ref(false)
const newPresetTag = ref('')
const presetTags = ref<string[]>([])

/** Merge workload tags (partitioned by runtime) + preset tags into a single sorted list */
const combinedTags = computed<CombinedTag[]>(() => {
  // Partition workloads by runtime into VMs and containers
  const partitioned = partitionTagCounts(workloadStore.workloads)

  // Build a map from partitioned data
  const tagMap = new Map<string, { vmCount: number; vmNames: string[]; containerCount: number; containerNames: string[] }>()
  for (const p of partitioned) {
    tagMap.set(p.tag, {
      vmCount: p.vmCount,
      vmNames: p.vmNames,
      containerCount: p.containerCount,
      containerNames: p.containerNames,
    })
  }

  // Ensure presets appear even if unused on any workload
  const presetSet = new Set(presetTags.value)
  for (const tag of presetTags.value) {
    if (!tagMap.has(tag)) tagMap.set(tag, { vmCount: 0, vmNames: [], containerCount: 0, containerNames: [] })
  }

  return [...tagMap.entries()]
    .map(([name, info]) => ({ name, ...info, isPreset: presetSet.has(name) }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const isValidNewPreset = computed(() => {
  const tag = normalizeTag(newPresetTag.value)
  if (!tag || tag.length > 30) return false
  if (!TAG_PATTERN.test(tag)) return false
  if (combinedTags.value.some(t => t.name === tag)) return false
  return true
})

function normalizeTag(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, '-')
}

function presetTagRule(v: string): boolean | string {
  const tag = normalizeTag(v)
  if (!tag) return true
  if (tag.length > 30) return 'Max 30 characters'
  if (!TAG_PATTERN.test(tag)) return 'Lowercase alphanumeric and hyphens only'
  if (combinedTags.value.some(t => t.name === tag)) return 'Tag already exists'
  return true
}

async function loadPresets() {
  // The public/private demos are static SPAs with no backend, and PresetTagApiService — unlike
  // ConfigApiService and friends — carries no isDemoMode() branch of its own, so this is the only
  // thing standing between the demo and a live GET /api/tags that cannot resolve.
  if (isDemoMode()) {
    presetTags.value = ['env-prod', 'env-dev', 'web', 'database', 'monitoring']
    workloadStore.setPresetTags(presetTags.value)
    return
  }
  loadingPresets.value = true
  try {
    presetTags.value = await presetTagApiService.getAll()
    workloadStore.setPresetTags(presetTags.value)
  } catch {
    // Preset tags not available — non-fatal
  } finally {
    loadingPresets.value = false
  }
}

async function savePresets(tags: string[]) {
  // Same reason as loadPresets: no backend in the demo, so persist to the store only.
  if (isDemoMode()) {
    presetTags.value = tags
    workloadStore.setPresetTags(tags)
    return
  }
  savingPresets.value = true
  try {
    presetTags.value = await presetTagApiService.set(tags)
    workloadStore.setPresetTags(presetTags.value)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save preset tags'
    $q.notify({ type: 'negative', message: msg, position: 'top-right', timeout: 5000 })
  } finally {
    savingPresets.value = false
  }
}

async function addPresetTag() {
  const tag = normalizeTag(newPresetTag.value)
  if (!tag || !isValidNewPreset.value) return
  await savePresets([...presetTags.value, tag])
  newPresetTag.value = ''
  $q.notify({ type: 'positive', message: `Preset tag "${tag}" added`, position: 'top-right', timeout: 3000 })
}

async function refreshVms() {
  const vms = await fetchVms()
  if (vms.length > 0) workloadStore.updateWorkloads(vms)
}

onMounted(async () => {
  if (workloadStore.workloads.length === 0) await refreshVms()
  await loadPresets()
})

function startRename(tag: CombinedTag) {
  const workloadCount = tag.vmCount + tag.containerCount
  $q.dialog({
    title: 'Rename Tag',
    message: workloadCount > 0
      ? `Rename "${tag.name}" across ${workloadCount} workload${workloadCount !== 1 ? 's' : ''}:`
      : `Rename preset tag "${tag.name}":`,
    prompt: {
      model: tag.name,
      type: 'text',
      isValid: (val: string) => {
        const normalized = normalizeTag(val)
        if (!normalized || normalized.length > 30) return false
        if (!TAG_PATTERN.test(normalized)) return false
        if (normalized !== tag.name && combinedTags.value.some(t => t.name === normalized)) return false
        return true
      },
    },
    cancel: true,
    persistent: false,
    color: 'primary',
  }).onOk((newName: string) => {
    const normalized = normalizeTag(newName)
    if (normalized === tag.name) return
    void executeRename(tag, normalized)
  })
}

async function executeRename(tag: CombinedTag, newName: string) {
  renamingTag.value = tag.name
  let successCount = 0
  let failCount = 0

  // Rename on VMs (containers: handled via unified workload model — Decision WVR-60)
  for (const vmName of tag.vmNames) {
    const vm = workloadStore.workloadByName(vmName)
    if (!vm) continue
    const newTags = [...new Set((vm.tags ?? []).map(t => (t === tag.name ? newName : t)))]
    const result = await setTags(vmName, newTags)
    if (result.success) successCount++
    else failCount++
  }

  if (tag.isPreset) {
    const updated = presetTags.value.map(t => (t === tag.name ? newName : t))
    await savePresets(updated)
  }

  await refreshVms()

  if (failCount === 0) {
    $q.notify({ type: 'positive', message: `Renamed "${tag.name}" to "${newName}"`, position: 'top-right', timeout: 3000 })
  } else {
    $q.notify({ type: 'warning', message: `Renamed on ${successCount} workload(s), failed on ${failCount}`, position: 'top-right', timeout: 5000 })
  }
  renamingTag.value = null
}

function confirmDelete(tag: CombinedTag) {
  const workloadCount = tag.vmCount + tag.containerCount
  const parts = []
  if (workloadCount > 0) parts.push(`${workloadCount} workload${workloadCount !== 1 ? 's' : ''}`)
  if (tag.isPreset) parts.push('presets')

  $q.dialog({
    title: 'Delete Tag',
    message: `Remove tag "${tag.name}" from ${parts.join(' and ')}?`,
    cancel: true,
    persistent: false,
    color: 'negative',
  }).onOk(() => void executeDelete(tag))
}

async function executeDelete(tag: CombinedTag) {
  deletingTag.value = tag.name
  let successCount = 0
  let failCount = 0

  // Remove from VMs (containers: handled via unified workload model — Decision WVR-60)
  for (const vmName of tag.vmNames) {
    const vm = workloadStore.workloadByName(vmName)
    if (!vm) continue
    const newTags = (vm.tags ?? []).filter(t => t !== tag.name)
    const result = await setTags(vmName, newTags)
    if (result.success) successCount++
    else failCount++
  }

  if (tag.isPreset) {
    const updated = presetTags.value.filter(t => t !== tag.name)
    await savePresets(updated)
  }

  await refreshVms()

  if (failCount === 0) {
    $q.notify({ type: 'positive', message: `Deleted "${tag.name}"`, position: 'top-right', timeout: 3000 })
  } else {
    $q.notify({ type: 'warning', message: `Deleted from ${successCount} workload(s), failed on ${failCount}`, position: 'top-right', timeout: 5000 })
  }
  deletingTag.value = null
}
</script>

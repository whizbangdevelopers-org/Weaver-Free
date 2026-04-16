<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Warp — fleet host configuration patterns (Decision #125).
  Defines what each host type should look like: workloads, bridges, GPU, snapshots.
  FabricK v2.5+ only.
-->
<template>
  <q-page class="q-pa-md">

    <!-- Header -->
    <div class="row items-center q-mb-md">
      <q-icon name="mdi-texture" size="32px" color="brown-7" class="q-mr-sm" />
      <div class="text-h4">Warp</div>
      <q-badge outline color="grey-6" label="v2.5.0" class="q-ml-sm" />
      <q-space />
      <q-btn flat dense icon="mdi-radar" label="Scan for Hosts" color="brown-7" class="q-mr-sm" :loading="hostScanning" @click="scanForHosts" />
      <q-btn outline color="brown-7" icon="mdi-server-plus" label="Provision New Host" class="q-mr-sm" @click="showProvision = true" />
      <q-btn color="primary" icon="mdi-plus" label="New Pattern" @click="showCreate = true" />
    </div>

    <!-- Scan results -->
    <q-banner v-if="scanResults" dense rounded class="bg-green-1 text-green-9 q-mb-md">
      <template #avatar><q-icon name="mdi-radar" color="green" /></template>
      <div class="text-body2 q-mb-sm">{{ scanResults.summary }}</div>
      <div v-if="scanResults.hosts.length" class="row q-gutter-sm">
        <q-card v-for="h in scanResults.hosts" :key="h.ip" flat bordered style="min-width:220px">
          <q-card-section class="q-pa-sm row items-center q-gutter-sm">
            <q-icon :name="h.hasWeaver ? 'mdi-server' : 'mdi-server-off'" :color="h.hasWeaver ? 'positive' : 'grey'" size="20px" />
            <div class="col">
              <div class="text-body2 text-weight-medium">{{ h.ip }}</div>
              <div class="text-caption text-grey-8">{{ h.hasWeaver ? 'Weaver detected' : 'Bare metal' }}</div>
            </div>
            <q-btn v-if="h.hasWeaver" flat dense size="sm" color="primary" label="Enroll" />
            <q-btn v-else flat dense size="sm" color="brown-7" label="Provision" @click="showProvision = true" />
          </q-card-section>
        </q-card>
      </div>
    </q-banner>

    <!-- Category filter chips -->
    <div class="row items-center q-gutter-xs q-mb-md">
      <q-chip
        v-for="cat in categories" :key="cat.value"
        clickable dense
        :outline="activeCategory !== cat.value"
        :color="activeCategory === cat.value ? 'brown-7' : 'grey-4'"
        :text-color="activeCategory === cat.value ? 'white' : 'grey-8'"
        @click="activeCategory = cat.value"
      >{{ cat.label }} ({{ cat.count }})</q-chip>
    </div>

    <!-- Pattern cards -->
    <div class="row q-col-gutter-md">
      <div v-for="p in filteredPatterns" :key="p.id" class="col-12 col-sm-6 col-md-4">
        <q-card flat bordered class="warp-card cursor-pointer" @click="selectedPattern = p.id">
          <q-card-section>
            <!-- Header -->
            <div class="row items-center q-mb-sm">
              <q-icon name="mdi-texture" size="22px" color="brown-7" class="q-mr-sm" />
              <span class="text-subtitle1 text-weight-bold col">{{ p.name }}</span>
              <q-badge outline color="grey-6" :label="`v${p.version}`" />
            </div>

            <!-- Description -->
            <div class="text-caption text-grey-7 q-mb-sm">{{ p.description }}</div>

            <!-- Workloads -->
            <div class="row items-center q-gutter-xs q-mb-xs">
              <q-icon name="mdi-cube-outline" size="14px" color="grey" />
              <span class="text-caption">{{ p.workloads.length }} workloads:</span>
              <span class="text-caption text-grey-8">{{ p.workloads.join(', ') }}</span>
            </div>

            <!-- Bridges -->
            <div class="row items-center q-gutter-xs q-mb-xs">
              <q-icon name="mdi-lan" size="14px" color="grey" />
              <span class="text-caption">{{ p.bridges.length }} bridges: {{ p.bridges.join(', ') }}</span>
            </div>

            <!-- GPU (if any) -->
            <div v-if="p.gpu" class="row items-center q-gutter-xs q-mb-xs">
              <q-icon name="mdi-expansion-card" size="14px" color="deep-purple" />
              <span class="text-caption">{{ p.gpu }}</span>
            </div>

            <!-- Snapshot policy -->
            <div class="row items-center q-gutter-xs q-mb-sm">
              <q-icon name="mdi-camera" size="14px" color="grey" />
              <span class="text-caption">Snapshot: {{ p.snapshotPolicy }}</span>
            </div>

            <q-separator class="q-mb-sm" />

            <!-- Applied hosts -->
            <div class="row items-center q-gutter-xs q-mb-xs">
              <q-icon name="mdi-server" size="14px" color="grey" />
              <span class="text-caption text-weight-medium">Applied to {{ p.hosts.length }} hosts:</span>
              <span class="text-caption text-grey-8">{{ p.hosts.map(h => h.name).join(', ') }}</span>
            </div>

            <!-- Sync / drift status -->
            <div class="row items-center q-gutter-xs">
              <q-icon
                :name="p.driftCount > 0 ? 'mdi-alert-circle' : 'mdi-check-circle'"
                :color="p.driftCount > 0 ? 'warning' : 'positive'"
                size="16px"
              />
              <span :class="p.driftCount > 0 ? 'text-caption text-warning' : 'text-caption text-positive'">
                {{ p.driftCount > 0 ? `${p.driftCount} host drifted` : 'In sync' }}
              </span>
            </div>

            <!-- Blue/green active -->
            <div v-if="p.blueGreen" class="row items-center q-gutter-xs q-mt-xs">
              <q-icon name="mdi-swap-horizontal" size="16px" color="blue" />
              <span class="text-caption text-blue">Blue/green: v{{ p.blueGreen.from }} → v{{ p.blueGreen.to }}: {{ p.blueGreen.weight }}%</span>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Pattern detail dialog -->
    <q-dialog v-model="showDetail" max-width="700px">
      <q-card v-if="detailPattern" style="min-width: 600px">
        <q-card-section class="row items-center q-pb-xs">
          <q-icon name="mdi-texture" size="22px" color="brown-7" class="q-mr-sm" />
          <span class="text-h6">{{ detailPattern.name }}</span>
          <q-badge outline color="grey-6" :label="`v${detailPattern.version}`" class="q-ml-sm" />
          <q-space />
          <q-btn flat round dense icon="mdi-close" @click="selectedPattern = null" />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <div class="row q-gutter-lg">
            <!-- Left: definition -->
            <div class="col">
              <div class="text-subtitle2 text-weight-bold q-mb-sm">Versions</div>
              <q-list dense separator>
                <q-item v-for="ver in detailPattern.versions" :key="ver.v">
                  <q-item-section>
                    <q-item-label>v{{ ver.v }} <q-badge v-if="ver.v === detailPattern.version" color="primary" label="current" class="q-ml-xs" /></q-item-label>
                    <q-item-label caption>{{ ver.date }} · {{ ver.change }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>

              <div class="text-subtitle2 text-weight-bold q-mt-md q-mb-sm">Workloads (v{{ detailPattern.version }})</div>
              <q-list dense>
                <q-item v-for="wl in detailPattern.workloads" :key="wl">
                  <q-item-section avatar><q-icon name="mdi-cube-outline" size="16px" /></q-item-section>
                  <q-item-section>{{ wl }}</q-item-section>
                </q-item>
              </q-list>

              <div class="text-subtitle2 text-weight-bold q-mt-md q-mb-sm">Bridges</div>
              <q-chip v-for="b in detailPattern.bridges" :key="b" outline color="primary" size="sm" :label="b" />

              <div v-if="detailPattern.gpu" class="q-mt-md">
                <div class="text-subtitle2 text-weight-bold q-mb-sm">GPU</div>
                <span class="text-body2">{{ detailPattern.gpu }}</span>
              </div>
            </div>

            <!-- Right: live state -->
            <div class="col">
              <div class="text-subtitle2 text-weight-bold q-mb-sm">Applied Hosts</div>
              <q-list dense separator>
                <q-item v-for="h in detailPattern.hosts" :key="h.name">
                  <q-item-section>
                    <q-item-label>{{ h.name }}</q-item-label>
                    <q-item-label caption>v{{ h.version }} · {{ h.weight ? h.weight + '%' : '100%' }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-icon :name="h.synced ? 'mdi-check-circle' : 'mdi-alert-circle'" :color="h.synced ? 'positive' : 'warning'" size="18px" />
                  </q-item-section>
                </q-item>
              </q-list>

              <template v-if="detailPattern.blueGreen">
                <div class="text-subtitle2 text-weight-bold q-mt-md q-mb-sm">Blue/Green</div>
                <div class="row items-center q-gutter-sm">
                  <q-badge color="blue" :label="`v${detailPattern.blueGreen.from}`" />
                  <q-icon name="mdi-arrow-right" />
                  <q-linear-progress :value="detailPattern.blueGreen.weight / 100" color="blue" track-color="green" style="width:120px" />
                  <q-icon name="mdi-arrow-right" />
                  <q-badge color="green" :label="`v${detailPattern.blueGreen.to}`" />
                </div>
                <div class="row q-gutter-sm q-mt-sm">
                  <q-btn flat dense size="sm" label="Shift to 100%" color="primary" />
                  <q-btn flat dense size="sm" label="Rollback" color="negative" />
                </div>
              </template>

              <div class="text-subtitle2 text-weight-bold q-mt-md q-mb-sm">Snapshots</div>
              <q-list dense>
                <q-item v-for="s in detailPattern.snapshots" :key="s.label">
                  <q-item-section avatar><q-icon name="mdi-camera" size="16px" color="grey" /></q-item-section>
                  <q-item-section>
                    <q-item-label>{{ s.label }}</q-item-label>
                    <q-item-label caption>{{ s.date }} · {{ s.size }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>
          </div>
        </q-card-section>
        <q-separator />
        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn flat label="Edit Pattern" icon="mdi-pencil" color="grey-7" />
          <q-btn flat label="Clone" icon="mdi-content-copy" color="grey-7" />
          <q-btn unelevated label="Push to Host..." icon="mdi-upload" color="primary" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Create pattern dialog -->
    <q-dialog v-model="showCreate" max-width="480px">
      <q-card style="min-width: 380px">
        <q-card-section class="row items-center q-pb-xs">
          <q-icon name="mdi-texture" size="22px" color="brown-7" class="q-mr-sm" />
          <span class="text-h6">New Warp Pattern</span>
          <q-space />
          <q-btn flat round dense icon="mdi-close" @click="showCreate = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="q-gutter-md">
          <q-input v-model="newPattern.name" label="Pattern name" outlined dense placeholder="e.g. edge-inference" />
          <q-input v-model="newPattern.description" label="Description" outlined dense placeholder="Edge inference node with GPU" />
          <q-select v-model="newPattern.category" label="Category" outlined dense :options="['Production', 'Edge', 'CI', 'Data', 'Custom']" />
          <q-input v-model="newPattern.snapshotPolicy" label="Snapshot policy" outlined dense placeholder="nightly" />
        </q-card-section>
        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn flat label="Cancel" color="grey-7" @click="showCreate = false" />
          <q-btn unelevated label="Create" color="primary" icon="mdi-plus" @click="showCreate = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Provision New Host dialog -->
    <q-dialog v-model="showProvision" max-width="480px">
      <q-card style="min-width: 400px">
        <q-card-section class="row items-center q-pb-xs">
          <q-icon name="mdi-server-plus" size="22px" color="brown-7" class="q-mr-sm" />
          <span class="text-h6">Provision New Host</span>
          <q-space />
          <q-btn flat round dense icon="mdi-close" @click="showProvision = false" />
        </q-card-section>
        <q-separator />
        <q-card-section class="q-gutter-md">
          <q-select
            v-model="provisionForm.pattern"
            label="Warp pattern"
            outlined dense
            :options="patterns.map(p => ({ label: `${p.name} v${p.version}`, value: p.id }))"
            emit-value map-options
          />
          <q-input v-model="provisionForm.target" label="Target IP / hostname" outlined dense placeholder="10.0.0.50 or edge-node-04.local" />
          <q-input v-model="provisionForm.sshKey" label="SSH key path" outlined dense placeholder="~/.ssh/id_ed25519" />
          <q-separator />
          <div class="q-gutter-sm">
            <q-toggle v-model="provisionForm.disko" label="Wipe disk (disko)" />
            <q-toggle v-model="provisionForm.impermanence" label="Impermanence (boot-clean resilience)" />
          </div>
          <q-banner dense rounded class="bg-blue-1 text-blue-9">
            <template #avatar><q-icon name="mdi-information" /></template>
            nixos-anywhere will SSH to the target, format the disk, install NixOS, deploy the pattern's workloads and bridges, and register the host with FabricK automatically.
          </q-banner>
        </q-card-section>
        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn flat label="Cancel" color="grey-7" @click="showProvision = false" />
          <q-btn unelevated label="Provision" color="brown-7" icon="mdi-server-plus" @click="showProvision = false" />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const showCreate = ref(false)
const showProvision = ref(false)
const hostScanning = ref(false)

interface ScanHost { ip: string; hasWeaver: boolean }
const scanResults = ref<{ summary: string; hosts: ScanHost[] } | null>(null)

async function scanForHosts() {
  hostScanning.value = true
  await new Promise(r => setTimeout(r, 1500))
  hostScanning.value = false
  scanResults.value = {
    summary: 'Scan complete: 15 hosts found (12 already enrolled, 3 new discovered)',
    hosts: [
      { ip: '10.0.0.50', hasWeaver: true },
      { ip: '10.0.0.51', hasWeaver: false },
      { ip: '10.0.0.52', hasWeaver: false },
    ],
  }
}

const provisionForm = ref({
  pattern: '',
  target: '',
  sshKey: '~/.ssh/id_ed25519',
  disko: true,
  impermanence: false,
})
const selectedPattern = ref<string | null>(null)
const activeCategory = ref('all')

const showDetail = computed({
  get: () => selectedPattern.value !== null,
  set: (v: boolean) => { if (!v) selectedPattern.value = null },
})

const newPattern = ref({ name: '', description: '', category: 'Custom', snapshotPolicy: 'nightly' })

interface WarpHost { name: string; version: number; weight?: number; synced: boolean }
interface WarpVersion { v: number; date: string; change: string }
interface WarpSnapshot { label: string; date: string; size: string }

interface WarpPattern {
  id: string
  name: string
  description: string
  category: string
  version: number
  workloads: string[]
  bridges: string[]
  gpu: string | null
  snapshotPolicy: string
  hosts: WarpHost[]
  driftCount: number
  blueGreen: { from: number; to: number; weight: number } | null
  versions: WarpVersion[]
  snapshots: WarpSnapshot[]
}

const patterns: WarpPattern[] = [
  {
    id: 'prod-web', name: 'production-web', description: 'Production web tier — LB, app servers, frontend',
    category: 'Production', version: 3,
    workloads: ['nginx', 'app-server-01', 'app-server-02', 'svc-payments', 'svc-orders', 'lb-haproxy'],
    bridges: ['br-edge', 'br-app', 'br-mgmt'], gpu: null, snapshotPolicy: 'nightly',
    hosts: [
      { name: 'king', version: 3, synced: true },
      { name: 'titan', version: 3, synced: true },
      { name: 'atlas', version: 3, synced: false },
    ],
    driftCount: 1, blueGreen: null,
    versions: [
      { v: 3, date: '2026-03-28', change: 'Added svc-payments, upgraded nginx' },
      { v: 2, date: '2026-03-15', change: 'Added app-server-02 (blue/green capacity)' },
      { v: 1, date: '2026-03-01', change: 'Initial production web pattern' },
    ],
    snapshots: [
      { label: 'v3 nightly', date: '2026-03-30 02:00', size: '8.2 GB' },
      { label: 'v2 final', date: '2026-03-27 02:00', size: '7.1 GB' },
    ],
  },
  {
    id: 'prod-data', name: 'production-data', description: 'Database tier — primary + replica + cache',
    category: 'Production', version: 2,
    workloads: ['postgres-primary', 'postgres-replica', 'redis-cache'],
    bridges: ['br-data', 'br-mgmt'], gpu: null, snapshotPolicy: 'hourly',
    hosts: [
      { name: 'king', version: 2, synced: true },
      { name: 'vault', version: 2, synced: true },
    ],
    driftCount: 0, blueGreen: null,
    versions: [
      { v: 2, date: '2026-03-20', change: 'Added redis-cache, hourly snapshots' },
      { v: 1, date: '2026-03-05', change: 'Initial data tier' },
    ],
    snapshots: [
      { label: 'v2 hourly', date: '2026-03-31 09:00', size: '12.4 GB' },
      { label: 'v2 hourly', date: '2026-03-31 08:00', size: '12.3 GB' },
    ],
  },
  {
    id: 'edge-gw', name: 'edge-gateway', description: 'Edge node — VPN gateway + routing',
    category: 'Edge', version: 1,
    workloads: ['vpn-gateway', 'routing-agent'],
    bridges: ['br-edge'], gpu: null, snapshotPolicy: 'daily',
    hosts: [
      { name: 'atlas', version: 1, synced: true },
      { name: 'sentinel', version: 1, synced: true },
      { name: 'beacon', version: 1, synced: true },
    ],
    driftCount: 0, blueGreen: null,
    versions: [{ v: 1, date: '2026-03-10', change: 'Initial edge gateway pattern' }],
    snapshots: [{ label: 'v1 daily', date: '2026-03-30 02:00', size: '1.8 GB' }],
  },
  {
    id: 'edge-inf', name: 'edge-inference', description: 'Edge AI inference — model server + cache + metrics',
    category: 'Edge', version: 2,
    workloads: ['inference-server', 'model-cache', 'inference-metrics'],
    bridges: ['br-inference'], gpu: '1x H100 (VFIO)', snapshotPolicy: 'on-deploy',
    hosts: [
      { name: 'titan', version: 2, weight: 70, synced: true },
      { name: 'crucible', version: 2, synced: true },
    ],
    driftCount: 0,
    blueGreen: { from: 1, to: 2, weight: 70 },
    versions: [
      { v: 2, date: '2026-03-28', change: 'Added model-cache, upgraded GPU A100→H100' },
      { v: 1, date: '2026-03-15', change: 'Initial edge inference pattern' },
    ],
    snapshots: [
      { label: 'v2 mem+disk', date: '2026-03-28', size: '4.2 GB' },
      { label: 'v1 mem+disk', date: '2026-03-15', size: '3.8 GB' },
    ],
  },
  {
    id: 'ci', name: 'ci-runner', description: 'CI/CD build host — ephemeral agents + artifact cache',
    category: 'CI', version: 1,
    workloads: ['build-agent', 'artifact-cache'],
    bridges: ['br-dev'], gpu: null, snapshotPolicy: 'none',
    hosts: [
      { name: 'crucible', version: 1, synced: true },
      { name: 'nexus', version: 1, synced: true },
    ],
    driftCount: 0, blueGreen: null,
    versions: [{ v: 1, date: '2026-03-12', change: 'Initial CI runner pattern' }],
    snapshots: [],
  },
]

const categories = computed(() => {
  const cats = ['all', ...new Set(patterns.map(p => p.category))]
  return cats.map(c => ({
    value: c,
    label: c === 'all' ? 'All' : c,
    count: c === 'all' ? patterns.length : patterns.filter(p => p.category === c).length,
  }))
})

const filteredPatterns = computed(() =>
  activeCategory.value === 'all' ? patterns : patterns.filter(p => p.category === activeCategory.value)
)

const detailPattern = computed(() => patterns.find(p => p.id === selectedPattern.value) ?? null)
</script>

<style scoped>
.warp-card {
  transition: box-shadow 0.15s ease;
}
.warp-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}
</style>

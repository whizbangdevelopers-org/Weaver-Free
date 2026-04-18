<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Shed — unified workload creation (Decision #92) -->
<!-- Version-gated: content appears as demo version progresses v1.0→v3.3. -->

<template>
  <q-page class="q-pa-md">

    <!-- Header -->
    <q-card flat bordered class="q-mb-md">
      <q-card-section class="row items-center q-pa-sm q-px-md">
        <div>
          <div class="text-subtitle1 text-weight-bold">Shed</div>
          <div class="text-caption text-grey-6">
            {{ headerSubtitle }}
          </div>
        </div>
        <q-space />
        <q-input
          v-if="showTemplates"
          v-model="search"
          dense
          outlined
          placeholder="Search catalog..."
          style="width: 240px"
          clearable
        >
          <template #prepend>
            <q-icon name="mdi-magnify" size="18px" />
          </template>
        </q-input>
      </q-card-section>

      <q-separator />

      <q-tabs
        v-model="activeTab"
        dense
        align="left"
        class="q-px-sm text-grey-7"
        active-color="primary"
        indicator-color="primary"
      >
        <q-tab name="custom" label="Custom" />
        <q-tab v-if="showTemplates" name="templates" label="Templates" />
        <q-tab v-if="showMigrate" name="migrate" label="Migrate" />
      </q-tabs>
    </q-card>

    <!-- Free-tier browse notice -->
    <q-banner v-if="showTemplates && !appStore.isWeaver" dense rounded class="bg-amber-1 text-amber-9 q-mb-md">
      <template #avatar>
        <q-icon name="mdi-lock-outline" color="amber-9" />
      </template>
      Browse the catalog below. Upgrade to Weaver to deploy templates and create workloads.
      <template #action>
        <q-btn flat dense label="Upgrade" color="amber-9" />
      </template>
    </q-banner>

    <!-- Tab panels -->
    <q-tab-panels v-model="activeTab" animated keep-alive>

      <!-- Custom workload -->
      <q-tab-panel name="custom" class="q-pa-none">
        <div class="row q-col-gutter-md">

          <!-- Register Existing VM — always available -->
          <div class="col-12 col-sm-6 col-md-4">
            <q-card flat bordered class="shed-card">
              <q-card-section class="row items-center no-wrap q-pb-xs">
                <q-icon name="mdi-server-plus" color="primary" size="28px" class="q-mr-sm" />
                <div class="text-subtitle2 text-weight-bold">Register Existing VM</div>
              </q-card-section>
              <q-card-section class="q-pt-xs q-pb-sm">
                <div class="text-caption text-grey-7">Track an existing systemd-managed MicroVM (e.g. microvm@name.service) without provisioning.</div>
              </q-card-section>
              <q-separator />
              <q-card-actions class="q-pa-sm">
                <q-btn flat dense color="primary" label="Register" icon="mdi-plus" size="sm" @click="showRegister = true" />
              </q-card-actions>
            </q-card>
          </div>

          <!-- Custom MicroVM — available from v1.0 via CreateVmDialog -->
          <div class="col-12 col-sm-6 col-md-4">
            <q-card flat bordered class="shed-card">
              <q-card-section class="row items-center no-wrap q-pb-xs">
                <q-icon name="mdi-cube-outline" color="primary" size="28px" class="q-mr-sm" />
                <div class="text-subtitle2 text-weight-bold">Custom MicroVM</div>
              </q-card-section>
              <q-card-section class="q-pt-xs q-pb-sm">
                <div class="text-caption text-grey-7">Configure a hardware-isolated VM from scratch — choose distro, resources, and cloud-init.</div>
              </q-card-section>
              <q-separator />
              <q-card-actions class="q-pa-sm">
                <q-btn
                  flat dense color="primary" label="Create" icon="mdi-plus" size="sm"
                  @click="openCreateVmDialog"
                />
              </q-card-actions>
            </q-card>
          </div>

          <!-- Container — v1.1+ visible, v1.2+ enables Create -->
          <div v-if="atLeast('1.1')" class="col-12 col-sm-6 col-md-4">
            <q-card flat bordered class="shed-card">
              <q-card-section class="row items-center no-wrap q-pb-xs">
                <q-icon name="mdi-docker" color="blue-7" size="28px" class="q-mr-sm" />
                <div class="text-subtitle2 text-weight-bold">Container</div>
                <q-badge v-if="!atLeast('1.2')" outline color="grey-6" label="register only" class="q-ml-sm" />
              </q-card-section>
              <q-card-section class="q-pt-xs q-pb-sm">
                <div class="text-caption text-grey-7">
                  {{ atLeast('1.2')
                    ? 'Create or register a Docker, Podman, or Apptainer container. Namespace-isolated, managed alongside your MicroVMs.'
                    : 'Register an existing Docker or Podman container. Full creation available in v1.2.'
                  }}
                </div>
              </q-card-section>
              <q-separator />
              <q-card-actions class="q-pa-sm">
                <q-btn flat dense color="primary" :label="atLeast('1.2') ? 'Create' : 'Register'" icon="mdi-plus" size="sm" />
              </q-card-actions>
            </q-card>
          </div>

          <!-- GPU Workload — v1.2+ (Weaver) -->
          <div v-if="atLeast('1.2') && appStore.isWeaver" class="col-12 col-sm-6 col-md-4">
            <q-card flat bordered class="shed-card">
              <q-card-section class="row items-center no-wrap q-pb-xs">
                <q-icon name="mdi-expansion-card" color="deep-purple" size="28px" class="q-mr-sm" />
                <div class="text-subtitle2 text-weight-bold">GPU Workload</div>
                <q-badge color="amber-9" label="Weaver Solo" class="q-ml-sm" />
              </q-card-section>
              <q-card-section class="q-pt-xs q-pb-sm">
                <div class="text-caption text-grey-7">VFIO-PCI passthrough — VM or container with dedicated GPU. NVIDIA, AMD, Intel.</div>
              </q-card-section>
              <q-separator />
              <q-card-actions class="q-pa-sm">
                <q-btn flat dense color="deep-purple" label="Create" icon="mdi-plus" size="sm" />
              </q-card-actions>
            </q-card>
          </div>

        </div>

        <!-- Version nags for upcoming Custom features -->
        <VersionNag v-if="isDemo && !atLeast('1.1')" version="1.1" title="Container Registration" description="Register existing Docker and Podman containers" class="q-mt-md" />
      </q-tab-panel>

      <!-- Templates — v2.0+ (workload catalog only; fleet templates live in Warp) -->
      <q-tab-panel v-if="showTemplates" name="templates" class="q-pa-none">
        <div class="row q-col-gutter-md">
          <div
            v-for="tmpl in filteredTemplates"
            :key="tmpl.id"
            class="col-12 col-sm-6 col-md-4 col-lg-3"
          >
            <q-card flat bordered class="shed-card full-height">
              <q-card-section class="row items-center no-wrap q-pb-xs">
                <q-icon :name="tmpl.icon" :color="tmpl.color" size="28px" class="q-mr-sm" />
                <div class="col">
                  <div class="text-subtitle2 text-weight-bold">{{ tmpl.name }}</div>
                  <q-badge
                    :color="tmpl.tier === TIERS.FREE ? 'grey-4' : 'amber-2'"
                    :text-color="tmpl.tier === TIERS.FREE ? 'grey-7' : 'amber-9'"
                    class="text-caption"
                  >
                    {{ TIER_LABELS[tmpl.tier as TierName] || tmpl.tier }}
                  </q-badge>
                  <q-badge v-if="tmpl.wave === 2" outline color="grey-5" label="v2.1" class="q-ml-xs text-caption" />
                </div>
                <q-icon v-if="!appStore.isWeaver && tmpl.tier !== TIERS.FREE" name="mdi-lock" color="grey-4" size="18px" />
              </q-card-section>

              <q-card-section class="q-pt-xs q-pb-sm">
                <div class="text-caption text-grey-7">{{ tmpl.description }}</div>
              </q-card-section>

              <q-separator />

              <q-card-actions class="q-pa-sm">
                <q-btn
                  v-if="appStore.isWeaver || tmpl.tier === TIERS.FREE"
                  flat dense color="primary" label="Deploy" icon="mdi-rocket-launch-outline" size="sm"
                />
                <q-btn
                  v-else
                  flat dense color="grey-5" label="Deploy" icon="mdi-lock" size="sm" disable
                />
                <q-space />
                <q-btn flat dense round icon="mdi-information-outline" size="sm" color="grey-5">
                  <q-tooltip>{{ tmpl.detail }}</q-tooltip>
                </q-btn>
              </q-card-actions>
            </q-card>
          </div>
        </div>
      </q-tab-panel>

      <!-- Migrate — v1.6+ -->
      <q-tab-panel v-if="showMigrate" name="migrate" class="q-pa-none">

        <!-- Import/Export — v1.6 -->
        <q-card flat bordered class="q-mb-md">
          <q-card-section>
            <div class="row items-center q-mb-md">
              <q-icon name="mdi-import" size="24px" class="q-mr-sm" />
              <span class="text-subtitle2 text-weight-bold">Import / Export</span>
              <q-badge outline color="grey-6" label="v1.6.0" class="q-ml-sm" />
            </div>
            <div class="row q-gutter-md">
              <q-card flat bordered class="col" style="min-width:200px">
                <q-card-section class="text-center q-pa-md">
                  <q-icon name="mdi-application-import" size="36px" color="primary" />
                  <div class="text-subtitle2 q-mt-sm">Import</div>
                  <div class="text-caption text-grey-8">Proxmox · Docker Compose · libvirt XML · Dockerfile</div>
                  <q-btn flat size="sm" color="primary" label="Choose file..." class="q-mt-sm" />
                </q-card-section>
              </q-card>
              <q-card flat bordered class="col" style="min-width:200px">
                <q-card-section class="text-center q-pa-md">
                  <q-icon name="mdi-application-export" size="36px" color="teal" />
                  <div class="text-subtitle2 q-mt-sm">Export</div>
                  <div class="text-caption text-grey-8">NixOS config · JSON manifest · tar.gz bundle</div>
                  <q-btn flat size="sm" color="teal" label="Select workloads..." class="q-mt-sm" />
                </q-card-section>
              </q-card>
            </div>
          </q-card-section>
        </q-card>

        <!-- Container migration analysis -->
        <q-card flat bordered>
          <q-card-section>
            <div class="text-subtitle2 text-weight-bold q-mb-xs">Migrate from Docker / Podman</div>
            <div class="text-caption text-grey-7">
              Weaver identifies which running containers are good candidates for MicroVM migration —
              security-sensitive workloads that benefit from a hardware isolation boundary.
            </div>
            <q-markup-table v-if="atLeast('2.0')" flat dense bordered class="q-mt-md">
              <thead>
                <tr><th class="text-left">Container</th><th class="text-left">Runtime</th><th class="text-left">Recommendation</th><th class="text-left">Action</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>redis-cache</td><td><q-badge color="blue-7" label="docker" /></td>
                  <td><q-badge color="positive" label="Good candidate" /> — stateless, no volumes</td>
                  <td><q-btn flat dense size="xs" label="Convert" color="primary" /></td>
                </tr>
                <tr>
                  <td>postgres-main</td><td><q-badge color="teal-7" label="podman" /></td>
                  <td><q-badge color="warning" label="Review" /> — persistent volumes need migration</td>
                  <td><q-btn flat dense size="xs" label="Review" color="grey-7" /></td>
                </tr>
              </tbody>
            </q-markup-table>
            <div v-else class="row items-center text-grey-6 q-mt-sm">
              <q-icon name="mdi-information-outline" class="q-mr-sm" />
              <span class="text-caption">Migration analysis runs against live containers. Full analysis in v2.0.</span>
            </div>
          </q-card-section>
        </q-card>
      </q-tab-panel>

    </q-tab-panels>

    <!-- Register Existing VM dialog -->
    <AddVmDialog v-model="showRegister" />

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAppStore } from 'stores/app'
import { isDemoMode } from 'src/config/demo-mode'
import AddVmDialog from 'src/components/AddVmDialog.vue'
import CreateVmDialog from 'src/components/CreateVmDialog.vue'
import VersionNag from 'src/components/demo/VersionNag.vue'
import { TIERS, TIER_LABELS, type TierName } from 'src/constants/vocabularies'

const appStore = useAppStore()
const $q = useQuasar()

function openCreateVmDialog() {
  $q.dialog({ component: CreateVmDialog })
}

const isDemo = isDemoMode()
const search = ref('')
const activeTab = ref('custom')
const showRegister = ref(false)

function atLeast(v: string): boolean {
  return isDemo && appStore.isDemoVersionAtLeast(v)
}

const showTemplates = computed(() => atLeast('2.0'))
const showMigrate = computed(() => atLeast('1.6'))

const headerSubtitle = computed(() => {
  if (showTemplates.value) return 'Deploy from a template, create a custom workload, register a container, or migrate from Docker'
  if (showMigrate.value) return 'Create a custom workload, register a container, or migrate from Docker'
  if (atLeast('1.1')) return 'Register a VM or container'
  return 'Register an existing VM'
})

// When templates tab becomes available, switch to it
// (investor sees the hero content immediately)

interface ShedTemplate {
  id: string
  name: string
  description: string
  detail: string
  icon: string
  color: string
  tier: TierName
  wave: 1 | 2
}

// Wave 1 catalog — v2.0.0 (Decision #46, #68)
// Wave 2 catalog — v2.1.0
const templates: ShedTemplate[] = [
  // Wave 1
  { id: 'nextcloud', name: 'Nextcloud', description: 'File sync, calendar, contacts, and collaboration. Drop-in Google Workspace replacement.', detail: 'Composed template: nginx + PostgreSQL + Valkey. One click deploys the full stack.', icon: 'mdi-cloud-outline', color: 'blue-7', tier: TIERS.SOLO, wave: 1 },
  { id: 'forgejo', name: 'Forgejo', description: 'Self-hosted Git. Full GitHub-compatible API, CI runners, issue tracker, and web UI.', detail: '"Deploy GitHub in 30 seconds." Lightweight, MIT-licensed Git forge.', icon: 'mdi-source-branch', color: 'orange-8', tier: TIERS.SOLO, wave: 1 },
  { id: 'authentik', name: 'Authentik', description: 'Identity hub for your homelab. One Authentik VM gives every app SSO.', detail: 'Run one Authentik VM. Every application gets SSO.', icon: 'mdi-shield-account', color: 'indigo-6', tier: TIERS.SOLO, wave: 1 },
  { id: 'pihole', name: 'Pi-hole', description: 'Network-wide ad, tracker, and malware blocking for every device on your LAN.', detail: 'Pi-hole = all-device network DNS; dns extensions = VM fleet service discovery.', icon: 'mdi-shield-outline', color: 'red-6', tier: TIERS.SOLO, wave: 1 },
  { id: 'media-stack', name: 'Media Stack', description: 'Jellyfin + Navidrome + Immich + Audiobookshelf. Complete self-hosted media library.', detail: 'Composed template. Single-click replacement for Plex, Google Photos, and Spotify.', icon: 'mdi-play-box-multiple', color: 'deep-purple-6', tier: TIERS.SOLO, wave: 1 },
  { id: 'home-assistant', name: 'Home Assistant', description: 'Open-source home automation hub. Integrates with 3,000+ devices and services.', detail: 'Isolated from the host — HA crashes never touch your other workloads.', icon: 'mdi-home-automation', color: 'teal-6', tier: TIERS.SOLO, wave: 1 },
  { id: 'postgresql', name: 'PostgreSQL', description: 'Production-grade relational database. Dependency of Nextcloud and other composed templates.', detail: 'Standalone template. Weaver manages the VM lifecycle; you manage the schema.', icon: 'mdi-database', color: 'blue-grey-7', tier: TIERS.SOLO, wave: 1 },
  { id: 'nginx', name: 'nginx', description: 'Reverse proxy and load balancer. Route traffic to any workload on your host.', detail: 'Replaces the K8s ingress controller use case for single-host deployments.', icon: 'mdi-web', color: 'green-7', tier: TIERS.SOLO, wave: 1 },
  { id: 'valkey', name: 'Valkey', description: 'High-performance key-value store. BSD-licensed Linux Foundation fork of Redis 7.2.', detail: 'Valkey only — Redis is SSPL and blocked by the license audit gate.', icon: 'mdi-lightning-bolt', color: 'amber-8', tier: TIERS.FREE, wave: 1 },
  // Wave 2 (v2.1)
  { id: 'prometheus', name: 'Prometheus + Grafana', description: 'Metrics collection and visualization stack. Monitor all your workloads.', detail: 'Composed template: Prometheus + Grafana + node_exporter.', icon: 'mdi-chart-line', color: 'orange-6', tier: TIERS.SOLO, wave: 2 },
  { id: 'vaultwarden', name: 'Vaultwarden', description: 'Self-hosted Bitwarden-compatible password manager. Zero cloud dependency.', detail: 'Lightweight Rust implementation. Full Bitwarden client compatibility.', icon: 'mdi-lock', color: 'blue-8', tier: TIERS.SOLO, wave: 2 },
  { id: 'node-red', name: 'Node-RED', description: 'Flow-based automation and IoT integration. Wire together APIs, services, and devices.', detail: 'Low-code event processing. Pairs well with Home Assistant and MQTT.', icon: 'mdi-resistor-nodes', color: 'red-8', tier: TIERS.SOLO, wave: 2 },
  { id: 'haproxy', name: 'HAProxy', description: 'High-availability load balancer with health checking and SSL termination.', detail: 'Production-grade load balancing for high-availability workloads.', icon: 'mdi-scale-balance', color: 'green-8', tier: TIERS.SOLO, wave: 2 },
]

const filteredTemplates = computed(() => {
  // Only show Wave 1 at v2.0, Wave 1+2 at v2.1+
  const maxWave = atLeast('2.1') ? 2 : 1
  const byWave = templates.filter(t => t.wave <= maxWave)
  const q = search.value.toLowerCase().trim()
  if (!q) return byWave
  return byWave.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
})

</script>

<style scoped>
.shed-card {
  transition: box-shadow 0.15s ease;
}
.shed-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}
</style>

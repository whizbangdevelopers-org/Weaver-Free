<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="mobile-overlay" @click.self="$emit('close')">
    <div class="mobile-container">
      <!-- Phone frame -->
      <div class="phone-frame">
        <!-- Notch -->
        <div class="phone-notch" />

        <!-- Status bar -->
        <div class="phone-statusbar">
          <span class="statusbar-time">9:41</span>
          <span class="statusbar-icons">
            <q-icon name="mdi-signal" size="11px" />
            <q-icon name="mdi-wifi" size="11px" />
            <q-icon name="mdi-battery" size="11px" />
          </span>
        </div>

        <!-- Fabrick top bar (Fabrick tier only) -->
        <div v-if="appStore.isFabrick && atLeast('3.0')" class="phone-fabrick-bar">
          <div class="row items-center justify-between">
            <div class="row items-center no-wrap">
              <q-icon name="mdi-apps" size="14px" color="white" class="q-mr-xs" />
              <span class="fabrick-title">FabricK</span>
            </div>
            <div class="row items-center q-gutter-xs">
              <q-icon name="mdi-bell-outline" size="14px" color="white" />
              <q-icon name="mdi-account-circle" size="14px" color="white" />
            </div>
          </div>
        </div>

        <!-- Weaver sub-bar (always shown — primary bar on non-Fabrick, sub-bar on Fabrick) -->
        <div class="phone-weaver-bar">
          <div class="row items-center justify-between">
            <div class="row items-center no-wrap">
              <q-icon name="mdi-loom" size="14px" color="white" class="q-mr-xs" />
              <span class="weaver-title">Weaver</span>
              <q-badge v-if="appStore.isWeaver && !appStore.isFabrick" color="white" text-color="primary" class="tier-badge q-ml-sm">
                {{ appStore.demoWeaverSubTier === 'team' ? 'Team' : 'Solo' }}
              </q-badge>
            </div>
            <div class="row items-center q-gutter-xs">
              <template v-if="!appStore.isFabrick || !atLeast('3.0')">
                <q-icon name="mdi-bell-outline" size="14px" color="white" />
              </template>
              <q-icon name="mdi-spider-web" size="14px" color="white" />
            </div>
          </div>
        </div>

        <!-- Scrollable content area -->
        <div class="phone-content">
          <!-- Tab: Workloads -->
          <template v-if="activeTab === 'workloads'">
            <!-- VM workloads -->
            <div class="section-label">WORKLOADS</div>
            <div v-for="vm in vms" :key="vm.name" class="workload-row">
              <q-icon
                :name="statusIcon(vm.status)"
                :color="statusColor(vm.status)"
                size="14px"
                class="q-mr-sm row-icon"
              />
              <div class="row-body">
                <div class="row-name">{{ vm.name }}</div>
                <div class="row-meta">{{ vm.ip }} · {{ formatMem(vm.mem) }} · {{ vm.vcpu }}v</div>
              </div>
            </div>

            <!-- Containers (v1.1+) -->
            <template v-if="atLeast('1.1')">
              <div class="section-label q-mt-sm">CONTAINERS</div>
              <div v-for="c in containers" :key="c.name" class="workload-row">
                <q-icon name="mdi-docker" color="blue-6" size="14px" class="q-mr-sm row-icon" />
                <div class="row-body">
                  <div class="row-name">{{ c.name }}</div>
                  <div class="row-meta">{{ c.runtime }} · {{ c.status }}</div>
                </div>
              </div>
            </template>

            <!-- Peer hosts (v2.2+ Team) -->
            <template v-if="atLeast('2.2') && appStore.demoWeaverSubTier === 'team'">
              <div class="section-label q-mt-sm">PEER HOSTS</div>
              <div class="workload-row">
                <q-icon name="mdi-server" color="purple" size="14px" class="q-mr-sm row-icon" />
                <div class="row-body">
                  <div class="row-name">lab-node-02</div>
                  <div class="row-meta">3 VMs · online</div>
                </div>
              </div>
              <div class="workload-row">
                <q-icon name="mdi-server" color="purple" size="14px" class="q-mr-sm row-icon" />
                <div class="row-body">
                  <div class="row-name">lab-node-03</div>
                  <div class="row-meta">2 VMs · online</div>
                </div>
              </div>
            </template>

            <!-- Fleet summary (v3.0+ Fabrick) -->
            <template v-if="atLeast('3.0') && appStore.isFabrick">
              <div class="section-label q-mt-sm">FLEET</div>
              <div class="fleet-summary">
                <div class="fleet-stat">
                  <span class="fleet-stat-value">{{ fleetHosts.length }}</span>
                  <span class="fleet-stat-label">HOSTS</span>
                </div>
                <div class="fleet-stat">
                  <span class="fleet-stat-value">{{ fleetTotalVms }}</span>
                  <span class="fleet-stat-label">VMS</span>
                </div>
                <div class="fleet-stat">
                  <span class="fleet-stat-value text-warning">{{ fleetAlerts }}</span>
                  <span class="fleet-stat-label">ALERTS</span>
                </div>
              </div>
            </template>
          </template>

          <!-- Tab: Strands (local topology) — Free vs Solo presentation -->
          <template v-if="activeTab === 'strands'">
            <!-- Solo/Weaver: managed bridges with IP pools -->
            <template v-if="appStore.isWeaver">
              <div class="section-label">MANAGED BRIDGES</div>
              <div class="strands-mini">
                <div v-for="br in soloBridges" :key="br.name" class="q-mb-sm">
                  <div class="strands-bridge">
                    <q-icon name="mdi-bridge" size="16px" color="primary" class="q-mr-xs" />
                    <span class="text-weight-medium" style="font-size: 0.75rem">{{ br.name }}</span>
                    <q-badge color="positive" label="managed" class="q-ml-auto" style="font-size: 0.55rem" />
                  </div>
                  <div class="strands-detail">
                    <span class="text-grey-6" style="font-size: 0.6rem">{{ br.subnet }} · Pool: {{ br.pool }}</span>
                  </div>
                  <div v-for="vm in br.vms" :key="vm.name" class="strands-node">
                    <div class="strands-connector" />
                    <q-icon :name="statusIcon(vm.status)" :color="statusColor(vm.status)" size="12px" class="q-mr-xs" />
                    <span style="font-size: 0.7rem">{{ vm.name }}</span>
                    <span class="text-grey-7 q-ml-auto" style="font-size: 0.6rem">{{ vm.ip }}</span>
                  </div>
                </div>
              </div>
              <div class="section-label q-mt-sm">FIREWALL</div>
              <div class="settings-row">
                <q-icon name="mdi-shield-check" size="16px" class="q-mr-sm" color="positive" />
                <span style="font-size: 0.7rem">3 profiles active</span>
                <q-badge color="positive" label="enforced" class="q-ml-auto" style="font-size: 0.55rem" />
              </div>
            </template>

            <!-- Free: read-only auto-detected topology -->
            <template v-else>
              <div class="section-label">LOCAL TOPOLOGY</div>
              <div class="strands-mini">
                <div class="strands-bridge">
                  <q-icon name="mdi-bridge" size="16px" color="primary" class="q-mr-xs" />
                  <span class="text-weight-medium" style="font-size: 0.75rem">br-microvm</span>
                  <q-badge color="grey-5" label="detected" class="q-ml-auto" style="font-size: 0.55rem" />
                </div>
                <div v-for="vm in vms.slice(0, 5)" :key="vm.name" class="strands-node">
                  <div class="strands-connector" />
                  <q-icon :name="statusIcon(vm.status)" :color="statusColor(vm.status)" size="12px" class="q-mr-xs" />
                  <span style="font-size: 0.7rem">{{ vm.name }}</span>
                  <span class="text-grey-7 q-ml-auto" style="font-size: 0.6rem">{{ vm.ip }}</span>
                </div>
              </div>
            </template>
          </template>

          <!-- Tab: Alerts -->
          <template v-if="activeTab === 'alerts'">
            <div class="section-label">RECENT</div>
            <div v-for="n in notifications" :key="n.id" class="notif-row">
              <q-icon :name="n.icon" :color="n.color" size="14px" class="q-mr-sm row-icon" />
              <div class="row-body">
                <div class="row-name">{{ n.title }}</div>
                <div class="row-meta">{{ n.time }}</div>
              </div>
            </div>
          </template>

          <!-- Tab: Settings -->
          <template v-if="activeTab === 'settings'">
            <div class="section-label">QUICK SETTINGS</div>
            <div class="settings-row">
              <q-icon name="mdi-fingerprint" size="16px" class="q-mr-sm" color="grey-7" />
              <span>Biometric Auth</span>
              <q-toggle :model-value="true" dense class="q-ml-auto" disable />
            </div>
            <div class="settings-row">
              <q-icon name="mdi-bell-ring" size="16px" class="q-mr-sm" color="grey-7" />
              <span>Push Notifications</span>
              <q-toggle :model-value="true" dense class="q-ml-auto" disable />
            </div>
            <div v-if="appStore.isWeaver" class="settings-row">
              <q-icon name="mdi-console" size="16px" class="q-mr-sm" color="grey-7" />
              <span>Serial Console</span>
              <q-toggle :model-value="false" dense class="q-ml-auto" disable />
            </div>
            <div v-if="atLeast('1.3')" class="settings-row">
              <q-icon name="mdi-vpn" size="16px" class="q-mr-sm" color="grey-7" />
              <span>{{ appStore.isFabrick ? 'WireGuard' : 'Tailscale' }} Tunnel</span>
              <q-badge color="positive" label="Active" class="q-ml-auto" />
            </div>
          </template>
        </div>

        <!-- Bottom tab bar -->
        <div class="phone-tabbar">
          <div
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-item"
            :class="{ 'tab-item--active': activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            <q-icon :name="tab.icon" size="18px" />
            <span class="tab-label">{{ tab.label }}</span>
          </div>
        </div>

        <!-- Home indicator -->
        <div class="phone-home-indicator" />
      </div>

      <!-- Feature list alongside phone -->
      <div class="feature-panel">
        <div class="feature-title">
          <q-icon name="mdi-cellphone" size="22px" class="q-mr-sm" />
          Mobile App
          <q-badge outline color="grey-6" label="v1.3.0" class="q-ml-sm" />
        </div>
        <div class="feature-subtitle">Quasar Capacitor · iOS + Android</div>

        <div class="feature-list">
          <div class="feature-item"><q-icon name="mdi-view-dashboard" size="16px" color="primary" class="q-mr-sm" />Workload management</div>
          <div class="feature-item"><q-icon name="mdi-play-pause" size="16px" color="primary" class="q-mr-sm" />Start / stop / restart</div>
          <div class="feature-item"><q-icon name="mdi-bell-ring" size="16px" color="primary" class="q-mr-sm" />Push notifications</div>
          <div class="feature-item"><q-icon name="mdi-fingerprint" size="16px" color="primary" class="q-mr-sm" />Biometric auth</div>
          <div v-if="appStore.isWeaver" class="feature-item"><q-icon name="mdi-console" size="16px" color="primary" class="q-mr-sm" />Serial console (read-only)</div>
          <div v-if="atLeast('1.1')" class="feature-item"><q-icon name="mdi-docker" size="16px" color="primary" class="q-mr-sm" />Container visibility</div>
          <div v-if="atLeast('2.2') && appStore.demoWeaverSubTier === 'team'" class="feature-item"><q-icon name="mdi-server-network" size="16px" color="primary" class="q-mr-sm" />Peer host monitoring</div>
          <div v-if="atLeast('3.0') && appStore.isFabrick" class="feature-item"><q-icon name="mdi-lan" size="16px" color="primary" class="q-mr-sm" />Fleet overview</div>
          <div v-if="atLeast('2.5') && appStore.isFabrick" class="feature-item"><q-icon name="mdi-harddisk" size="16px" color="primary" class="q-mr-sm" />Fleet storage + templates</div>
          <div v-if="atLeast('3.1') && appStore.isFabrick" class="feature-item"><q-icon name="mdi-access-point" size="16px" color="primary" class="q-mr-sm" />Edge fleet monitoring</div>
          <div v-if="atLeast('3.2') && appStore.isFabrick" class="feature-item"><q-icon name="mdi-credit-card-clock" size="16px" color="primary" class="q-mr-sm" />Billing &amp; pool balance</div>
          <div v-if="atLeast('3.3') && appStore.isFabrick" class="feature-item"><q-icon name="mdi-folder-account" size="16px" color="primary" class="q-mr-sm" />Workload groups + compliance</div>
        </div>

        <div class="close-hint">Click outside or press Esc to close</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from 'src/stores/app'
import { getDemoVmsForTier, getDemoContainersForTier, DEMO_HOSTS } from 'src/config/demo'
import { TIERS } from 'src/constants/vocabularies'
import type { WorkloadInfo } from 'src/types/workload'

defineEmits<{ close: [] }>()

const route = useRoute()
const appStore = useAppStore()

// Auto-select tab based on current route when mobile preview opens
const initialTab = route.path === '/network' ? 'strands' as const : 'workloads' as const
const activeTab = ref<'workloads' | 'strands' | 'alerts' | 'settings'>(initialTab)

// ── Real demo data ───────────────────────────────────────────────────────
const vms = computed<WorkloadInfo[]>(() =>
  JSON.parse(JSON.stringify(getDemoVmsForTier(appStore.effectiveTier))) as WorkloadInfo[],
)

const containers = computed(() => {
  const all = getDemoContainersForTier(appStore.effectiveTier)
  // Show first few for compact mobile view
  return all.slice(0, 4).map(c => ({
    name: c.name,
    runtime: c.runtime,
    status: c.status,
  }))
})

const fleetHosts = computed(() => DEMO_HOSTS)
const fleetTotalVms = computed(() => {
  // Sum across hosts — approximate from the Fabrick VM set
  const vmCount = getDemoVmsForTier(TIERS.FABRICK).length
  // Fleet has multiple hosts, scale up realistically
  return vmCount * Math.ceil(fleetHosts.value.length / 3)
})
const fleetAlerts = 3

// Solo-tier managed bridges with assigned VMs
const soloBridges = computed(() => {
  const soloVms = getDemoVmsForTier(TIERS.SOLO)
  return [
    { name: 'br-prod', subnet: '10.10.1.0/24', pool: '10.10.1.10–50', vms: soloVms.filter(v => v.ip?.startsWith('10.10.1.')) },
    { name: 'br-data', subnet: '10.10.2.0/24', pool: '10.10.2.10–30', vms: soloVms.filter(v => v.ip?.startsWith('10.10.2.')) },
    { name: 'br-dev', subnet: '10.10.3.0/24', pool: '10.10.3.10–30', vms: soloVms.filter(v => v.ip?.startsWith('10.10.3.')) },
  ].filter(b => b.vms.length > 0 || true) // show all bridges even if no VMs match the subnet filter
})

const tabs = [
  { key: 'workloads' as const, icon: 'mdi-view-dashboard', label: 'Workloads' },
  { key: 'strands' as const, icon: 'mdi-lan', label: 'Strands' },
  { key: 'alerts' as const, icon: 'mdi-bell', label: 'Alerts' },
  { key: 'settings' as const, icon: 'mdi-cog', label: 'Settings' },
]

const notifications = [
  { id: 1, title: 'lb-haproxy-01 restarted', icon: 'mdi-restart', color: 'warning', time: '2 min ago' },
  { id: 2, title: 'db-primary high CPU (92%)', icon: 'mdi-alert', color: 'negative', time: '15 min ago' },
  { id: 3, title: 'ci-runner → nexus migrated', icon: 'mdi-truck-fast', color: 'positive', time: '1 hr ago' },
  { id: 4, title: 'Backup completed (vault)', icon: 'mdi-cloud-check', color: 'positive', time: '3 hr ago' },
]

// ── Helpers ──────────────────────────────────────────────────────────────
function atLeast(v: string): boolean {
  return appStore.isDemoVersionAtLeast(v)
}

function statusIcon(status: string): string {
  switch (status) {
    case 'running': return 'mdi-check-circle'
    case 'stopped': return 'mdi-minus-circle'
    case 'failed': return 'mdi-alert-circle'
    default: return 'mdi-help-circle'
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'running': return 'positive'
    case 'stopped': return 'grey'
    case 'failed': return 'negative'
    default: return 'warning'
  }
}

function formatMem(mb: number): string {
  if (mb < 1024) return `${mb}MB`
  const gb = mb / 1024
  return gb < 10 ? `${gb.toFixed(1)}GB` : `${Math.round(gb)}GB`
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    ;(document.querySelector('.mobile-overlay') as HTMLElement)?.click()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<style scoped lang="scss">
.mobile-overlay {
  position: fixed;
  inset: 0;
  z-index: 8000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px 24px;
  backdrop-filter: blur(6px);
}

.mobile-container {
  display: flex;
  align-items: center;
  gap: 40px;
  background: #e3f2fd;
  border: 1px solid #90caf9;
  border-radius: 16px;
  padding: 32px 40px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

// ── Phone frame ──────────────────────────────────────────────────────────
.phone-frame {
  width: 280px;
  min-height: 560px;
  background: #000;
  border-radius: 36px;
  padding: 8px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.phone-notch {
  width: 80px;
  height: 22px;
  background: #000;
  border-radius: 0 0 14px 14px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.phone-statusbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px 4px;
  font-size: 11px;
  font-weight: 600;
  color: #333;
  background: #fff;
  margin-top: -18px;
  padding-top: 20px;
  border-radius: 28px 28px 0 0;
}

.statusbar-icons {
  display: flex;
  gap: 3px;
  color: #333;
}

// ── Dual toolbar (Fabrick blue + Weaver orange) ─────────────────────────
.phone-fabrick-bar {
  background: #2E5CC8;
  color: #fff;
  padding: 8px 12px;
  font-size: 12px;
}

.fabrick-title {
  font-weight: 700;
  font-size: 13px;
}

.phone-weaver-bar {
  background: #FF6B35;
  color: #fff;
  padding: 7px 12px;
  font-size: 12px;
}

.weaver-title {
  font-weight: 700;
  font-size: 13px;
}

.tier-badge {
  font-size: 8px;
  padding: 1px 5px;
}

// ── Content area ─────────────────────────────────────────────────────────
.phone-content {
  flex: 1;
  background: #fff;
  padding: 8px 10px;
  overflow-y: auto;
  font-size: 12px;
  max-height: 380px;
}

.section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #888;
  padding: 6px 2px 3px;
}

// ── Workload / container rows ────────────────────────────────────────────
.workload-row {
  display: flex;
  align-items: flex-start;
  padding: 5px 4px;
  border-bottom: 1px solid #f0f0f0;
}

.row-icon {
  margin-top: 2px;
  flex-shrink: 0;
}

.row-body {
  min-width: 0;
}

.row-name {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  line-height: 1.3;
}

.row-meta {
  font-size: 10px;
  color: #999;
  line-height: 1.3;
}

// ── Notification rows ────────────────────────────────────────────────────
.notif-row {
  display: flex;
  align-items: flex-start;
  padding: 7px 4px;
  border-bottom: 1px solid #f0f0f0;
}

// ── Settings rows ────────────────────────────────────────────────────────
.settings-row {
  display: flex;
  align-items: center;
  padding: 8px 4px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 12px;
}

// ── Strands topology ─────────────────────────────────────────────────────
.strands-mini {
  padding: 4px 0;
}

.strands-bridge {
  display: flex;
  align-items: center;
  padding: 6px 4px;
  background: rgba(255, 107, 53, 0.06);
  border-radius: 4px;
  margin-bottom: 2px;
}

.strands-detail {
  padding: 2px 4px 2px 24px;
}

.strands-node {
  display: flex;
  align-items: center;
  padding: 4px 4px 4px 20px;
  position: relative;
}

.strands-connector {
  position: absolute;
  left: 10px;
  top: 0;
  bottom: 50%;
  width: 8px;
  border-left: 1px solid #ddd;
  border-bottom: 1px solid #ddd;
}

// ── Fleet summary ────────────────────────────────────────────────────────
.fleet-summary {
  display: flex;
  justify-content: space-around;
  padding: 10px 0;
}

.fleet-stat {
  text-align: center;
}

.fleet-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #FF6B35;
}

.fleet-stat-label {
  font-size: 9px;
  color: #888;
  letter-spacing: 0.04em;
}

// ── Tab bar ──────────────────────────────────────────────────────────────
.phone-tabbar {
  display: flex;
  justify-content: space-around;
  background: #fafafa;
  border-top: 1px solid #e0e0e0;
  padding: 6px 0 2px;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  color: #999;
  transition: color 0.15s;

  &--active {
    color: #FF6B35;
  }
}

.tab-label {
  font-size: 9px;
  margin-top: 1px;
}

.phone-home-indicator {
  width: 100px;
  height: 4px;
  background: #ccc;
  border-radius: 2px;
  margin: 6px auto 4px;
}

// ── Feature panel ────────────────────────────────────────────────────────
.feature-panel {
  max-width: 280px;
}

.feature-title {
  display: flex;
  align-items: center;
  font-size: 20px;
  font-weight: 700;
  color: #1a237e;
}

.feature-subtitle {
  font-size: 13px;
  color: #546e7a;
  margin: 4px 0 20px;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.feature-item {
  display: flex;
  align-items: center;
  color: #37474f;
  font-size: 14px;
}

.close-hint {
  margin-top: 32px;
  font-size: 12px;
  color: #78909c;
  font-style: italic;
}

// ── Responsive: stack vertically on small screens ────────────────────────
@media (max-width: 680px) {
  .mobile-container {
    flex-direction: column;
    gap: 20px;
  }

  .feature-panel {
    text-align: center;

    .feature-list {
      align-items: center;
    }
  }
}
</style>

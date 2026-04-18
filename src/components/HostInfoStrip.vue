<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-card v-if="host" flat bordered class="host-strip">
    <q-card-section class="row items-center wrap q-pa-sm q-px-md q-gutter-md">

      <!-- Identity -->
      <div class="row items-center no-wrap q-gutter-sm col-auto">
        <div class="column items-center">
          <div class="text-caption text-grey-8" style="font-size: 10px; line-height: 1.2">Host</div>
          <q-icon name="mdi-desktop-tower" size="28px" color="teal-7" />
        </div>
        <div>
          <div class="text-weight-bold text-body2 row items-center no-wrap q-gutter-xs">
            <span>{{ host.hostname }}</span>
            <router-link v-if="doctorStatus" to="/settings" class="no-decoration">
              <q-icon
                name="mdi-circle"
                :color="doctorStatus"
                size="8px"
              >
                <q-tooltip>System health: click to view diagnostics in Settings</q-tooltip>
              </q-icon>
            </router-link>
          </div>
          <div class="text-caption text-grey-8 no-wrap">
            <template v-if="host.ipAddress">{{ host.ipAddress }} &middot; </template>
            <span :class="host.kvmAvailable ? 'text-positive' : 'text-warning'">
              {{ host.kvmAvailable ? 'KVM' : 'No KVM' }}
            </span>
          </div>
        </div>
      </div>

      <q-separator vertical inset />

      <!-- Metrics -->
      <template v-if="live">
        <div class="col-auto metric-col">
          <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
            <q-icon name="mdi-clock-outline" size="13px" color="grey-6" />
            <span class="text-caption text-grey-7">UP</span>
          </div>
          <div class="text-caption text-weight-medium text-grey-9 no-wrap">{{ formatUptime(host.uptimeSeconds) }}</div>
        </div>

        <div class="col-auto metric-col">
          <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
            <q-icon name="mdi-gauge" size="13px" :color="metricColor(loadPct)" />
            <span class="text-caption text-grey-7">LOAD</span>
            <q-tooltip>1m · 5m · 15m avg. Healthy when &lt; {{ host.cpuCount }} (core count)</q-tooltip>
          </div>
          <div class="text-caption text-weight-medium no-wrap">
            <span :class="`text-${metricColor(loadPct)}`">{{ live.loadAvg1 }}</span>
            <span class="text-grey-6"> &middot; </span>
            <span class="text-grey-9">{{ live.loadAvg5 }} &middot; {{ live.loadAvg15 }}</span>
          </div>
        </div>

        <div class="col metric-col">
          <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
            <q-icon name="mdi-chip" size="13px" :color="metricColor(live.cpuUsagePercent)" />
            <span class="text-caption text-grey-7">CPU</span>
            <span class="text-caption text-grey-9">{{ host.cpuCount }} cores</span>
            <span class="text-caption text-weight-medium q-ml-auto">{{ live.cpuUsagePercent }}%</span>
          </div>
          <q-linear-progress
            :value="live.cpuUsagePercent / 100"
            :color="metricColor(live.cpuUsagePercent)"
            rounded size="5px"
          />
        </div>

        <div class="col metric-col">
          <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
            <q-icon name="mdi-memory" size="13px" :color="metricColor(ramUsedPercent)" />
            <span class="text-caption text-grey-7">RAM</span>
            <span class="text-caption text-grey-9">{{ totalRamGb }} GB</span>
            <span class="text-caption text-weight-medium q-ml-auto">{{ ramUsedPercent }}%</span>
          </div>
          <q-linear-progress
            :value="ramUsedPercent / 100"
            :color="metricColor(ramUsedPercent)"
            rounded size="5px"
          />
        </div>

        <div class="col metric-col">
          <div class="row items-center no-wrap q-gutter-xs q-mb-xs">
            <q-icon name="mdi-harddisk" size="13px" :color="metricColor(live.rootDiskUsedPercent)" />
            <span class="text-caption text-grey-7">DISK</span>
            <span class="text-caption text-grey-9">{{ live.rootDiskTotalGb }} GB</span>
            <span class="text-caption text-weight-medium q-ml-auto">{{ live.rootDiskUsedPercent }}%</span>
          </div>
          <q-linear-progress
            :value="live.rootDiskUsedPercent / 100"
            :color="metricColor(live.rootDiskUsedPercent)"
            rounded size="5px"
          />
        </div>
      </template>

      <div v-else class="col text-caption text-grey-8 q-pl-sm">
        <q-spinner-dots size="14px" color="grey-5" class="q-mr-xs" />
        Loading metrics...
      </div>

    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from 'src/stores/app'
import { useAuthStore } from 'src/stores/auth-store'
import { api } from 'src/boot/axios'
import { isDemoMode } from 'src/config/demo-mode'
import { doctorApiService } from 'src/services/api'
import type { HostBasicInfo } from 'src/types/host'

const appStore = useAppStore()
const authStore = useAuthStore()
const host = computed(() => appStore.host)
const live = computed(() => host.value?.liveMetrics ?? null)

// Doctor health indicator — run once on mount for admins
const doctorStatus = ref<'positive' | 'warning' | 'negative' | null>(null)

async function fetchDoctorStatus() {
  if (!authStore.isAdmin) return
  if (isDemoMode()) {
    doctorStatus.value = 'warning' // Demo always shows yellow (IOMMU warn)
    return
  }
  try {
    const result = await doctorApiService.runDiagnostics()
    doctorStatus.value = result.summary.result === 'pass' ? 'positive'
      : result.summary.result === 'warn' ? 'warning'
      : 'negative'
  } catch {
    // Silent — indicator just doesn't show
  }
}


const totalRamGb = computed(() => Math.round((host.value?.totalMemMb ?? 0) / 1024))
const loadPct = computed(() => {
  if (!live.value || !host.value?.cpuCount) return 0
  return Math.min(100, Math.round((live.value.loadAvg1 / host.value.cpuCount) * 100))
})
const ramUsedPercent = computed(() => {
  if (!host.value?.totalMemMb) return 0
  const usedMb = host.value.totalMemMb - (live.value?.freeMemMb ?? host.value.totalMemMb)
  return Math.min(100, Math.round((usedMb / host.value.totalMemMb) * 100))
})

function metricColor(pct: number): string {
  if (pct >= 90) return 'negative'
  if (pct >= 70) return 'warning'
  return 'positive'
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// Poll /health every 5 s to refresh live metrics (skipped in demo — static values)
let pollTimer: ReturnType<typeof setInterval> | null = null

async function refreshMetrics() {
  try {
    const { data } = await api.get<{ host?: HostBasicInfo }>('/health')
    if (data.host?.liveMetrics && appStore.host) {
      appStore.host = { ...appStore.host, liveMetrics: data.host.liveMetrics }
    }
  } catch { /* silent — strip degrades gracefully */ }
}

onMounted(() => {
  if (!isDemoMode()) {
    void refreshMetrics()
    pollTimer = setInterval(() => void refreshMetrics(), 5_000)
  }
  void fetchDoctorStatus()
})

onBeforeUnmount(() => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
})
</script>

<style scoped lang="scss">
.host-strip {
  min-height: 56px;
}
.metric-col {
  min-width: 110px;
}
</style>

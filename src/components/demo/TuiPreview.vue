<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="tui-overlay" @click.self="$emit('close')">
    <div class="tui-terminal">
      <!-- Status bar -->
      <div class="tui-statusbar">
        <span class="tui-bold">Weaver</span>
        <span class="tui-right">
          <span class="tui-green">&#x25CF; connected</span>
          <span class="tui-gap" />
          <span class="tui-cyan">tier:  {{ appStore.effectiveTier }}  </span>
          <span class="tui-gap" />
          <span class="tui-dim">{{ vms.length }} VMs</span>
          <span class="tui-gap" />
          <span class="tui-yellow">[DEMO]</span>
        </span>
      </div>

      <!-- Demo banner -->
      <div class="tui-demobanner">
        <span class="tui-demobadge">&nbsp;DEMO MODE&nbsp;</span>
        <span class="tui-cyan tui-bold">&nbsp;&nbsp;{{ appStore.effectiveTier }}&nbsp;&nbsp;</span>
        <span class="tui-dim">|&nbsp;</span>
        <span class="tui-magenta tui-bold">v{{ appStore.demoVersion }}</span>
        <span class="tui-dim">&nbsp;{{ currentHeadline }}&nbsp;</span>
        <span class="tui-dim">|&nbsp;</span>
        <span class="tui-dim">[Tab] tier  [←/→] version</span>
      </div>

      <!-- VM list header -->
      <div class="tui-vmheader tui-dim tui-bold">
        {{ pad('NAME', 18) }}{{ pad('STATUS', 12) }}{{ pad('IP', 16) }}{{ pad('MEM', 8) }}{{ pad('CPU', 5) }}{{ pad('UPTIME', 10) }}{{ pad('DISTRO', 16) }}
      </div>

      <!-- VM rows -->
      <div
        v-for="(vm, idx) in vms"
        :key="vm.name"
        class="tui-vmrow"
        :class="{ 'tui-selected': idx === selectedIdx }"
      >
        <span v-if="idx === selectedIdx" class="tui-cyan tui-bold">&gt; </span>
        <span v-else>&nbsp;&nbsp;</span>
        <span :class="idx === selectedIdx ? 'tui-cyan tui-bold' : ''">{{ pad(vm.name, 18) }}</span>
        <span :class="statusClass(vm.status)">{{ pad(vm.status, 12) }}</span>
        <span>{{ pad(vm.ip, 16) }}</span>
        <span>{{ pad(formatMem(vm.mem), 8) }}</span>
        <span>{{ pad(vm.vcpu + 'v', 5) }}</span>
        <span class="tui-dim">{{ pad(formatUptime(vm.uptime), 10) }}</span>
        <span class="tui-dim">{{ pad(vm.distro || '', 16) }}</span>
      </div>

      <!-- Key legend -->
      <div class="tui-legend tui-dim">
        [s]tart [S]top [r]estart [d]etail [a]gent [n]ew [/]search [t]filter [f]scan [?]help [L]ogout [q]uit
      </div>
      <div v-if="appStore.isWeaver" class="tui-legend tui-dim">
        [N]etwork [D]istros [T]emplates [H]ost [I]nfo [,]settings <template v-if="appStore.isFabrick">[u]sers [A]udit</template>
      </div>

      <!-- Version-gated feature indicators -->
      <div class="tui-features q-mt-xs">
        <div v-if="atLeast('1.1')" class="tui-cyan">  ● Containers: docker 3 · podman 2{{ atLeast('1.2') ? ' · [C]reate' : ' (read-only)' }}</div>
        <div v-if="atLeast('1.3')" class="tui-cyan">  ● Remote: {{ appStore.isWeaver ? 'WireGuard' : 'Tailscale' }} tunnel active · Mobile connected</div>
        <div v-if="atLeast('1.4')" class="tui-cyan">  ● Cross-resource AI: diagnostics span VMs + containers + networking</div>
        <div v-if="atLeast('1.5')" class="tui-cyan">  ● Secrets: 3 managed · injected into 4 workloads</div>
        <div v-if="atLeast('1.6')" class="tui-cyan">  ● Migration: import/export (Proxmox, Docker Compose, libvirt)</div>
        <div v-if="atLeast('2.0')" class="tui-magenta">  ● Storage: disk management · OS templates</div>
        <div v-if="atLeast('2.1')" class="tui-magenta">  ● Snapshots: 3 saved · clone-to-template</div>
        <div v-if="atLeast('2.2')" class="tui-magenta">  ● Team: 3 peer hosts · blue/green deployment</div>
        <div v-if="atLeast('2.3')" class="tui-yellow">  ● Fleet: 15 nodes · cold migration</div>
        <div v-if="atLeast('2.4')" class="tui-magenta">  ● Backup: 2 jobs · NFS + local</div>
        <div v-if="atLeast('2.5')" class="tui-yellow">  ● Storage Fabrick: CoW pools · fleet templates · quotas</div>
        <div v-if="atLeast('2.6')" class="tui-yellow">  ● Backup+: S3, restic, borg · file-level restore</div>
        <div v-if="atLeast('3.0')" class="tui-yellow">  ● Fabrick: HA · live migration · fleet events</div>
        <div v-if="atLeast('3.1')" class="tui-yellow">  ● Edge Fleet: IoT + cloud burst · GPU inventory</div>
        <div v-if="atLeast('3.2')" class="tui-yellow">  ● Billing: node-day pools · invoices · GPU scheduling</div>
        <div v-if="atLeast('3.3')" class="tui-yellow">  ● Groups: 4 workload groups · IdP sync · compliance</div>
        <div v-if="nextVersion" class="tui-dim">  ○ Coming in v{{ nextVersion.version }}: {{ nextVersion.headline }}</div>
      </div>

      <!-- Close hint -->
      <div class="tui-close-hint tui-dim">
        Click outside or press Esc to close
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAppStore } from 'src/stores/app'
import { getDemoVmsForTier, DEMO_VERSIONS } from 'src/config/demo'
import type { WorkloadInfo } from 'src/types/workload'

defineEmits<{ close: [] }>()

const appStore = useAppStore()
const selectedIdx = ref(0)

const vms = computed<WorkloadInfo[]>(() =>
  JSON.parse(JSON.stringify(getDemoVmsForTier(appStore.effectiveTier))) as WorkloadInfo[],
)

const currentHeadline = computed(() =>
  DEMO_VERSIONS.find(v => v.version === appStore.demoVersion)?.headline ?? ''
)

function atLeast(v: string): boolean {
  return appStore.isDemoVersionAtLeast(v)
}

const nextVersion = computed(() =>
  DEMO_VERSIONS.find(v => !appStore.isDemoVersionAtLeast(v.version))
)

function pad(str: string, width: number): string {
  return str.length >= width ? str.slice(0, width) : str + ' '.repeat(width - str.length)
}

function statusClass(status: string): string {
  switch (status) {
    case 'running': return 'tui-green'
    case 'idle': return 'tui-dim'
    case 'stopped': return 'tui-dim'
    case 'failed': return 'tui-red'
    default: return 'tui-yellow'
  }
}

function formatMem(mb: number): string {
  if (mb < 1024) return `${mb}MB`
  const gb = mb / 1024
  return gb < 10 ? `${gb.toFixed(1)}GB` : `${Math.round(gb)}GB`
}

function formatUptime(uptime: string | null): string {
  if (!uptime) return '-'
  const ms = Date.now() - new Date(uptime).getTime()
  const hours = Math.floor(ms / 3_600_000)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    ;(document.querySelector('.tui-overlay') as HTMLElement)?.click()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<style scoped lang="scss">
.tui-overlay {
  position: fixed;
  inset: 0;
  z-index: 8000;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px 24px; // leave room for toolbar
}

.tui-terminal {
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.5;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #444;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  max-width: 960px;
  width: 100%;
  max-height: calc(100vh - 96px);
  overflow-y: auto;
  white-space: pre;
}

.tui-statusbar {
  border: 1px solid #666;
  padding: 4px 8px;
  margin-bottom: 4px;
  display: flex;
  justify-content: space-between;
}

.tui-right {
  display: flex;
  gap: 0;
}

.tui-gap {
  width: 16px;
  display: inline-block;
}

.tui-demobanner {
  padding: 2px 8px;
  margin-bottom: 8px;
}

.tui-demobadge {
  background: #ca8a04;
  color: #000;
  font-weight: bold;
  padding: 0 4px;
}

.tui-vmheader {
  padding: 0 8px;
  margin-bottom: 2px;
}

.tui-vmrow {
  padding: 0 4px;
  line-height: 1.6;
}

.tui-selected {
  background: rgba(0, 200, 255, 0.05);
}

.tui-legend {
  margin-top: 8px;
  padding: 0 8px;
}

.tui-close-hint {
  margin-top: 12px;
  padding: 0 8px;
  text-align: center;
  font-style: italic;
}

// Colors matching terminal ANSI palette
.tui-bold { font-weight: bold; }
.tui-dim { color: #888; }
.tui-green { color: #4ec966; }
.tui-red { color: #f44747; }
.tui-yellow { color: #e5c07b; }
.tui-cyan { color: #56b6c2; }
.tui-magenta { color: #c678dd; }
.tui-underline { text-decoration: underline; }
</style>

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Dual-mode version switcher (Decision #135):
  - Private demo: compact stepper through DEMO_VERSIONS with auto-tier gating
  - Public demo: tab bar — scrollable version tabs with arrows + pinned funnel tabs
-->
<template>
  <!-- ═══ PUBLIC DEMO: tab bar ══════════════════════════════════════════ -->
  <div v-if="isPublic" class="public-tabbar row items-center no-wrap">
    <!-- Left arrow -->
    <q-btn
      flat dense
      icon="mdi-chevron-left"
      color="grey-7"
      class="tab-arrow"
      :disabled="publicCurrentIndex <= 0"
      @click="goToStep(publicCurrentIndex - 1)"
    />

    <!-- Scrollable version tabs -->
    <div ref="versionScroller" class="version-scroller row items-center no-wrap">
      <button
        v-for="s in versionSteps"
        :key="s.id"
        :class="['tab-item', { 'tab-item--active': s.id === publicCurrent.id && publicCurrent.type === 'version' }]"
        @click="goToStep(publicSteps.findIndex(ps => ps.id === s.id))"
      >v{{ s.id }}
        <q-tooltip anchor="bottom middle" self="top middle" :offset="[0, 4]">
          <div class="text-weight-bold">v{{ s.id }}</div>
          <div class="text-caption text-grey-4">{{ s.subtitle }}</div>
        </q-tooltip>
      </button>
    </div>

    <!-- Right arrow -->
    <q-btn
      flat dense
      icon="mdi-chevron-right"
      color="grey-7"
      class="tab-arrow"
      :disabled="publicCurrentIndex >= publicSteps.length - 1"
      @click="goToStep(publicCurrentIndex + 1)"
    />

    <!-- Divider -->
    <div class="tabbar-divider" />

    <!-- Pinned funnel tabs — always visible -->
    <button
      v-for="s in funnelSteps"
      :key="s.id"
      :class="['tab-item', 'tab-item--funnel', { 'tab-item--active': s.id === publicCurrent.id && publicCurrent.type !== 'version' }]"
      @click="goToStep(publicSteps.findIndex(ps => ps.id === s.id))"
    >{{ s.label }}
        <q-tooltip anchor="bottom middle" self="top middle" :offset="[0, 4]">
          <div class="text-weight-bold">{{ s.label }}</div>
          <div class="text-caption text-grey-4">{{ s.subtitle }}</div>
        </q-tooltip>
      </button>
  </div>

  <!-- ═══ PRIVATE DEMO: compact stepper (unchanged) ═════════════════════ -->
  <div v-else class="demo-version-switcher column items-center no-wrap q-mr-sm">
    <div class="row items-center no-wrap">
      <q-btn
        flat dense
        icon="mdi-chevron-left"
        color="grey-8"
        class="arrow-btn"
        :disabled="privateCurrentIndex === 0"
        @click="stepPrivate(-1)"
      />

      <div class="version-number">
        <span class="v-prefix">v&nbsp;</span>{{ privateCurrent.version }}
      </div>

      <q-btn
        flat dense
        icon="mdi-chevron-right"
        color="grey-8"
        class="arrow-btn"
        :disabled="privateCurrentIndex === DEMO_VERSIONS.length - 1"
        @click="stepPrivate(1)"
      />
    </div>

    <div :class="['version-status', privateStatusClass]">{{ privateStatusLabel }}</div>
    <div v-if="privateCurrent.tierCeiling" :class="['tier-ceiling', `tier-ceiling--${privateCurrent.tierCeiling}`]">
      {{ privateCurrent.tierCeiling === TIERS.FREE ? 'Weaver Free ✓' : 'Solo/Team ✓' }}
    </div>

    <q-tooltip anchor="bottom middle" self="top middle" :offset="[0, 8]">
      <div class="text-weight-bold">{{ privateCurrent.label }}</div>
      <div class="text-caption text-grey-4">{{ privateCurrent.headline }}</div>
    </q-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from 'src/stores/app'
import {
  DEMO_VERSIONS,
  isPublicDemo,
  getPublicDemoSteps,
  weeksUntilRelease,
} from 'src/config/demo'
import type { PublicDemoStep } from 'src/config/demo'
import { TIERS } from 'src/constants/vocabularies'

const appStore = useAppStore()
const router = useRouter()
const route = useRoute()

const isPublic = computed(() => isPublicDemo())

// ---------------------------------------------------------------------------
// Public demo: funnel steps + tab bar
// ---------------------------------------------------------------------------
const publicSteps = computed(() => getPublicDemoSteps())
const versionSteps = computed(() => publicSteps.value.filter(s => s.type === 'version'))
const funnelSteps = computed(() => publicSteps.value.filter(s => s.type !== 'version'))

const versionScroller = ref<HTMLElement | null>(null)

const publicCurrentIndex = computed(() => {
  const path = route.path
  const funnelIdx = publicSteps.value.findIndex(s => s.route && path.startsWith(s.route))
  if (funnelIdx >= 0) return funnelIdx
  return publicSteps.value.findIndex(s => s.type === 'version' && s.id === appStore.demoVersion)
})

const publicCurrent = computed((): PublicDemoStep =>
  publicSteps.value[publicCurrentIndex.value] ?? publicSteps.value[0]!
)

function goToStep(idx: number) {
  const step = publicSteps.value[idx]
  if (!step) return

  if (step.type === 'version') {
    appStore.setDemoVersion(step.id)
    if (route.path.startsWith('/explore/')) {
      void router.push('/weaver')
    }
    void nextTick(() => {
      const scroller = versionScroller.value
      if (!scroller) return
      const active = scroller.querySelector('.tab-item--active') as HTMLElement | null
      active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    })
  } else if (step.route) {
    void router.push(step.route)
  }
}

// ---------------------------------------------------------------------------
// Private demo: version steps (unchanged logic)
// ---------------------------------------------------------------------------
const privateCurrentIndex = computed(() =>
  DEMO_VERSIONS.findIndex(v => v.version === appStore.demoVersion)
)

const privateCurrent = computed(() => DEMO_VERSIONS[privateCurrentIndex.value] ?? DEMO_VERSIONS[0]!)

const privateStatusLabel = computed(() => {
  const v = privateCurrent.value
  if (v.status === 'released') return 'Released'
  const wks = weeksUntilRelease(v.targetDate)
  if (wks <= 0) return 'In Progress'
  return `+${wks} wks`
})

const privateStatusClass = computed(() => {
  const v = privateCurrent.value
  if (v.status === 'released') return 'status-released'
  if (v.status === 'in-progress') return 'status-active'
  return 'status-planned'
})

function stepPrivate(dir: -1 | 1) {
  const next = DEMO_VERSIONS[privateCurrentIndex.value + dir]
  if (!next) return
  appStore.setDemoVersion(next.version)
  // Auto-promote/demote tier to match version boundaries:
  //   Free: v1.0–v1.3 | Solo: v1.4–v2.1 | Team: v2.2–v2.6 | FabricK: v3.0+
  const ver = parseFloat(next.version)
  if (ver >= 3.0) {
    appStore.setDemoTier(TIERS.FABRICK)
  } else if (ver >= 2.2) {
    appStore.setDemoTier(TIERS.WEAVER)
    appStore.setDemoWeaverSubTier('team')
  } else if (ver >= 1.4) {
    appStore.setDemoTier(TIERS.WEAVER)
    appStore.setDemoWeaverSubTier('solo')
  } else {
    appStore.setDemoTier(TIERS.FREE)
  }
}
</script>

<style scoped lang="scss">
// ── Public demo: tab bar ─────────────────────────────────────────────────
.public-tabbar {
  background: #f8fafc;
  padding: 0 6px;
  min-height: 50px;
  border-right: 1px solid #e2e8f0;
  gap: 0;
}

.version-scroller {
  overflow-x: auto;
  max-width: 280px;
  gap: 0;
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar { display: none; }
}

.tab-arrow {
  width: 28px;
  height: 32px;
  min-height: 32px !important;
  padding: 0 !important;
  flex-shrink: 0;
  color: #1e293b !important;
  opacity: 0.85;

  &:hover { opacity: 1; }
  &[disabled] { opacity: 0.25; }
}

.tab-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  transition: color 0.15s ease, border-color 0.15s ease;
  position: relative;

  &:hover {
    color: #7AB800;
  }

  &--active {
    color: #7AB800;
    border-bottom-color: #7AB800;
  }
}

.tabbar-divider {
  width: 1px;
  height: 28px;
  background: #e2e8f0;
  margin: 0 4px;
  flex-shrink: 0;
}

// ── Private demo: compact stepper (unchanged) ────────────────────────────
.demo-version-switcher {
  background: #f8fafc;
  padding: 2px 6px;
  min-height: 50px;
  border-right: 1px solid #e2e8f0;
}

.arrow-btn {
  width: 20px;
  height: 22px;
  min-height: 22px !important;
  padding: 0 !important;
  opacity: 0.85;
  flex-shrink: 0;

  &:hover { opacity: 1; }
  &[disabled] { opacity: 0.3; }
}

.version-number {
  font-size: 1.1rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
  white-space: nowrap;
  padding: 0 2px;
  min-width: 42px;
  text-align: center;

  .v-prefix {
    font-size: 0.65rem;
    font-weight: 400;
    opacity: 0.45;
  }
}

.version-status {
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  line-height: 1;
  user-select: none;
}

.status-released { color: #16a34a; }
.status-active   { color: #d97706; }
.status-planned  { color: #94a3b8; }

.tier-ceiling {
  font-size: 0.52rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
  line-height: 1;
  margin-top: 1px;
  padding: 1px 4px;
  border-radius: 3px;
}

.tier-ceiling--free   { background: rgba(22, 163, 74, 0.12); color: #16a34a; }
.tier-ceiling--weaver { background: rgba(217, 119, 6, 0.12); color: #d97706; }
</style>

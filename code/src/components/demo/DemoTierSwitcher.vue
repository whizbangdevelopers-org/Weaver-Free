<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="demo-tier-switcher row items-center no-wrap">
    <!-- Tier buttons hidden in public demo — funnel lives in the version switcher (Decision #135) -->
    <template v-if="!isPublic">
      <span class="text-grey-9 text-no-wrap q-mr-sm gt-xs">Tier:</span>
      <q-btn
        v-for="opt in visibleTierOptions"
        :key="opt.key"
        :color="isTierActive(opt) ? undefined : 'grey-6'"
        :text-color="isTierActive(opt) ? undefined : 'grey-9'"
        :outline="!isTierActive(opt)"
        :disable="isTierDisabled(opt.tier)"
        dense
        unelevated
        no-caps
        :class="['tier-btn', { 'tier-btn--disabled': isTierDisabled(opt.tier), 'bg-wbd': isTierActive(opt) }]"
        @click="selectTier(opt)"
      >
        <template v-if="$q.screen.xs">{{ opt.abbrev }}</template>
        <div v-else class="column items-center">
          <span>{{ opt.label }}</span>
          <span class="tier-stage-label">{{ opt.stage }}</span>
        </div>
        <q-tooltip anchor="bottom middle" self="top middle" :offset="[0, 8]">
          <template v-if="isTierDisabled(opt.tier)">
            <div class="text-weight-bold">
              {{ opt.tier === TIERS.FREE ? 'Weaver Free — feature-complete at v1.3' : 'Weaver Solo/Team — feature-complete at v2.0' }}
            </div>
            <div class="text-caption text-grey-4">
              {{ opt.tier === TIERS.FREE ? 'No new Weaver Free features from v1.4 onward' : 'No new Weaver features from v3.0 onward' }}
            </div>
          </template>
          <template v-else>
            <div class="text-weight-bold">{{ opt.label }}</div>
            <div class="text-caption text-grey-4 q-mb-xs">{{ opt.persona }}</div>
            <div v-for="f in opt.features" :key="f" class="tier-tooltip-feature">
              {{ f }}
            </div>
          </template>
        </q-tooltip>
      </q-btn>
    </template>

    <span class="text-grey-9 text-no-wrap q-mx-sm gt-xs">View:</span>

    <q-btn
      :color="showTui ? undefined : 'grey-6'"
      :text-color="showTui ? undefined : 'grey-9'"
      :outline="!showTui"
      dense
      unelevated
      no-caps
      :class="{ 'bg-wbd': showTui }"
      :icon="showTui ? 'mdi-monitor' : 'mdi-console'"
      :label="showTui ? 'Web UX' : 'TUI'"
      class="tui-btn"
      @click="$emit('toggleTui')"
    >
      <q-tooltip>{{ showTui ? 'Switch to Web UX' : 'Preview TUI client' }}</q-tooltip>
    </q-btn>

    <q-btn
      v-if="appStore.isDemoVersionAtLeast('1.3')"
      :color="showMobile ? undefined : 'grey-6'"
      :text-color="showMobile ? undefined : 'grey-9'"
      :outline="!showMobile"
      dense
      unelevated
      no-caps
      :class="['tui-btn', { 'bg-wbd': showMobile }]"
      :icon="showMobile ? 'mdi-monitor' : 'mdi-cellphone'"
      :label="showMobile ? 'Web UX' : 'Mobile'"
      @click="$emit('toggleMobile')"
    >
      <q-tooltip>{{ showMobile ? 'Switch to Web UX' : 'Preview mobile app' }}</q-tooltip>
    </q-btn>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useAppStore, type Tier } from 'src/stores/app'
import { DEMO_TIER_STAGES, isPublicDemo } from 'src/config/demo'
import { TIERS } from 'src/constants/vocabularies'
import { PRICING } from 'src/constants/pricing'

defineProps<{ showTui: boolean; showMobile: boolean }>()
defineEmits<{ (e: 'toggleTui'): void; (e: 'toggleMobile'): void }>()

const $q = useQuasar()
const router = useRouter()
const appStore = useAppStore()

const isPublic = computed(() => isPublicDemo())

// Public demo funnel routes — tier buttons navigate here instead of switching tiers (Decision #135)
const PUBLIC_FUNNEL_ROUTES: Record<string, string> = {
  free: '/weaver',
  solo: '/explore/solo',
  team: '/explore/team',
  fabrick: '/explore/fabrick',
}

// ── Tier button definitions ──────────────────────────────────────────────────
// Pre-v2.2: Free | Solo | Fabrick (3 buttons)
// v2.2+:    Free | Solo | Team | Fabrick (4 buttons — Team appears)

interface TierOption {
  key: string
  label: string
  abbrev: string
  tier: Tier
  subTier: 'solo' | 'team' | null
  stage: string
  persona: string
  features: string[]
}

const FREE_OPT: TierOption = {
  key: 'free', label: 'Weaver Free', abbrev: 'WF',
  tier: TIERS.FREE as Tier, subTier: null,
  stage: DEMO_TIER_STAGES.free,
  persona: PRICING.free.persona,
  features: [
    'Weaver page + workload cards',
    'Start / stop / restart',
    'Scan + register existing VMs',
    'Strands topology (read-only)',
    'Serial console',
    'Container visibility (Docker + Podman)',
    'AI agent (BYOK, 5/min)',
    'Config export (JSON)',
    'Notification bell',
    'TUI client',
  ],
}

const SOLO_OPT: TierOption = {
  key: 'solo', label: 'Weaver Solo', abbrev: 'WS',
  tier: TIERS.WEAVER as Tier, subTier: 'solo',
  stage: DEMO_TIER_STAGES.weaver,
  persona: PRICING.solo.persona,
  features: [
    'Everything in Weaver Free, plus:',
    'Live Provisioning (create / delete VMs)',
    'Serial console (real xterm.js)',
    'AI server-provided key (10/min)',
    'Firewall + TLS',
    'Distro management',
    'Network bridges + IP pools + manual weights',
    'Push notification channels',
    'Detailed host info',
    'No K8s cluster required — bridge replaces CNI + ingress',
  ],
}

const TEAM_OPT: TierOption = {
  key: 'team', label: 'Weaver Team', abbrev: 'WT',
  tier: TIERS.WEAVER as Tier, subTier: 'team',
  stage: DEMO_TIER_STAGES.weaver,
  persona: PRICING.team.persona,
  features: [
    'Everything in Weaver Solo, plus:',
    'Multi-user (4 paying + 1 viewer)',
    'Role-gated workload detail',
    'Smart Bridges — automated blue/green (v2.2+)',
    'Workload groups + AI policy (v2.2+)',
    'Auditor role (v2.2+)',
    'Peer federation — 2 remote hosts (v2.2+)',
    'No platform team — replaces Argo Rollouts + service mesh',
  ],
}

const FABRICK_FEATURES_BASE = [
  'Per-VM access control (RBAC)',
  'Bulk VM operations',
  'Resource quotas',
  'Audit log',
  'Fleet virtual bridges (v3.0+)',
  'Workload groups + compliance (v3.3+)',
  'AI fleet routing (30/min)',
  'Full K8s stack replacement — $20K/yr replaces $500K+/yr',
]

/** Always 4 buttons — Team is a product SKU from day one, not a feature gate.
 *  Fabrick tooltip adjusts: pre-v2.2 "Everything in Solo", v2.2+ "Everything in Team". */
const visibleTierOptions = computed<TierOption[]>(() => {
  const teamDifferentiated = appStore.isDemoVersionAtLeast('2.2')
  const fabrickOpt: TierOption = {
    key: 'fabrick', label: 'FabricK', abbrev: 'F',
    tier: TIERS.FABRICK as Tier, subTier: null,
    stage: DEMO_TIER_STAGES.fabrick,
    persona: PRICING.fabrick.persona,
    features: [
      teamDifferentiated ? 'Everything in Weaver Team, plus:' : 'Everything in Weaver Solo, plus:',
      ...FABRICK_FEATURES_BASE,
    ],
  }
  return [FREE_OPT, SOLO_OPT, TEAM_OPT, fabrickOpt]
})

function isTierActive(opt: TierOption): boolean {
  // Public demo: active state based on current route (Decision #135)
  if (isPublic.value) {
    const route = PUBLIC_FUNNEL_ROUTES[opt.key]
    if (!route) return false
    return router.currentRoute.value.path.startsWith(route === '/weaver' ? '/weaver' : route)
      && !(opt.key === 'free' && router.currentRoute.value.path.startsWith('/explore/'))
  }
  if (opt.tier !== appStore.effectiveTier) return false
  // For weaver tier, match the sub-tier too
  if (opt.subTier) return appStore.demoWeaverSubTier === opt.subTier
  return true
}

function isTierDisabled(tier: Tier): boolean {
  // Public demo: tier buttons are never disabled — they navigate to funnel pages
  if (isPublic.value) return false
  if (tier === TIERS.FREE && appStore.isDemoVersionAtLeast('1.4')) return true
  if (tier === TIERS.WEAVER && appStore.isDemoVersionAtLeast('3.0')) return true
  return false
}

// Highest milestone version for each tier — clicking a tier button jumps here
// Uses milestone versions (not absolute ceilings) so the modal fires on arrival
const TIER_CEILING_VERSIONS: Record<string, string> = {
  free: '1.3',
  solo: '2.0',
  team: '2.2',
  fabrick: '3.3',
}

function selectTier(opt: TierOption) {
  // Public demo: navigate to funnel pages instead of switching tiers (Decision #135)
  if (isPublic.value) {
    const route = PUBLIC_FUNNEL_ROUTES[opt.key]
    if (route) void router.push(route)
    return
  }
  if (isTierDisabled(opt.tier)) return
  appStore.setDemoTier(opt.tier)
  if (opt.subTier) appStore.setDemoWeaverSubTier(opt.subTier)
  // Jump version to the tier ceiling so the investor sees the full tier
  const ceilingVersion = TIER_CEILING_VERSIONS[opt.key]
  if (ceilingVersion) appStore.setDemoVersion(ceilingVersion)
}
</script>

<style scoped lang="scss">
.demo-tier-switcher {
  background: #f8fafc;
  padding: 4px 14px;
  min-height: 50px;
  font-size: 0.875rem;
  display: inline-flex;
  align-items: center;
}

.tier-btn {
  margin: 0 3px;
  border-radius: 6px !important;
  min-width: 150px;
  justify-content: center;
}

@media (max-width: 599px) {
  .tier-btn {
    min-width: 36px;
    padding: 0 8px !important;
  }
}

.tier-btn--disabled {
  opacity: 0.35 !important;
  cursor: not-allowed !important;
}

.tier-stage-label {
  font-size: 0.6rem;
  opacity: 0.8;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tui-btn {
  margin-left: 3px;
  border-radius: 6px !important;
  padding: 8px !important;
}

.tier-tooltip-feature {
  padding: 1px 0;
  font-size: 0.8rem;

  &::before {
    content: '\2022\00a0';
  }
}
</style>

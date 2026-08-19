<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <q-icon name="mdi-puzzle" size="md" color="primary" class="q-mr-sm" />
      <div class="text-h5">Integrated Extensions</div>
      <q-space />
      <q-badge :color="currentTierBadgeColor" :label="appStore.effectiveTier" class="text-capitalize q-px-sm" />
    </div>

    <div class="text-body2 text-grey-7 q-mb-lg">
      Every capability ships as an Integrated Extension. Weaver Solo/Team and FabricK unlock additional extensions.
    </div>

    <!-- Category sections -->
    <div v-for="cat in categories" v-show="(pluginsByCategory.get(cat.id) ?? []).length > 0" :key="cat.id" class="q-mb-lg">
      <div class="row items-center q-mb-sm">
        <q-icon :name="cat.icon" size="sm" :color="cat.color" class="q-mr-sm" />
        <div class="text-subtitle1 text-weight-bold">{{ cat.label }}</div>
        <q-badge
          class="q-ml-sm"
          :label="`${(pluginsByCategory.get(cat.id) ?? []).length} extension${(pluginsByCategory.get(cat.id) ?? []).length !== 1 ? 's' : ''}`"
          color="grey-4"
          text-color="grey-8"
        />
      </div>

      <div class="row q-col-gutter-md">
        <div
          v-for="plugin in (pluginsByCategory.get(cat.id) ?? [])"
          :key="plugin.id"
          class="col-12 col-sm-6 col-md-4"
        >
          <q-card flat bordered class="extension-card full-height">
            <q-card-section>
              <div class="row items-center no-wrap q-mb-xs">
                <div class="text-subtitle2 text-weight-bold ellipsis">{{ plugin.name }}</div>
                <q-space />
                <q-badge
                  v-if="isPrivateDemo"
                  :color="tierBadgeColor(plugin.minimumTier)"
                  :label="tierBadgeLabel(plugin.minimumTier)"
                  rounded
                  class="q-mr-xs"
                />
                <q-badge
                  :color="statusColor(plugin.status)"
                  :text-color="plugin.status === 'available' ? 'grey-8' : 'white'"
                  :label="statusLabel(plugin.status)"
                  rounded
                />
              </div>

              <div class="text-body2 text-grey-7 q-mb-sm" style="min-height: 40px">
                {{ plugin.description }}
              </div>

              <div class="row items-center text-caption text-grey-6">
                <q-icon name="mdi-shield-check" size="xs" class="q-mr-xs" />
                <span class="text-capitalize">{{ plugin.minimumTier }}+</span>
                <q-space />
                <span v-if="plugin.targetVersion" class="text-grey-7">
                  {{ plugin.targetVersion }}
                </span>
                <q-icon
                  v-if="plugin.fabrickIncluded"
                  name="mdi-domain"
                  size="xs"
                  color="grey-5"
                  class="q-ml-sm"
                >
                  <q-tooltip>Included with FabricK</q-tooltip>
                </q-icon>
              </div>
            </q-card-section>

            <!-- Lock overlay for unavailable extensions -->
            <div
              v-if="plugin.status === 'available'"
              class="extension-lock-overlay absolute-full column flex-center"
            >
              <q-icon name="mdi-lock" size="md" color="grey-5" />
              <div class="text-caption text-grey-6 q-mt-xs">
                Requires {{ plugin.minimumTier }}
              </div>
            </div>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from 'src/stores/app'
import { TIERS, TIER_LABELS, TIER_ORDER, type TierName } from 'src/constants/vocabularies'
import { isDemoMode, isPublicDemo } from 'src/config/demo-mode'
import type { PluginManifest, PluginCategory } from 'src/types/plugin'

const appStore = useAppStore()

const isPrivateDemo = computed(() => isDemoMode() && !isPublicDemo())

const categories: { id: PluginCategory; label: string; icon: string; color: string }[] = [
  { id: 'ai', label: 'AI Providers', icon: 'mdi-robot', color: 'purple' },
  { id: 'dns', label: 'DNS', icon: 'mdi-dns', color: 'blue' },
  { id: 'firewall', label: 'Firewall', icon: 'mdi-shield-lock', color: 'red' },
  { id: 'security', label: 'Security & Hardening', icon: 'mdi-security', color: 'orange' },
  { id: 'auth', label: 'Authentication', icon: 'mdi-account-key', color: 'teal' },
  { id: 'backup', label: 'Backup & Recovery', icon: 'mdi-backup-restore', color: 'green' },
]

// See MainLayout.vue — ranking comes from TIER_ORDER, not a hand-typed copy.
const tierRank = (tier: string): number => TIER_ORDER[tier as TierName] ?? 0

const pluginsByCategory = computed(() => {
  const tierLevel = tierRank(appStore.effectiveTier)
  const map = new Map<string, PluginManifest[]>()
  for (const cat of categories) {
    map.set(
      cat.id,
      appStore.availablePlugins
        .filter(p =>
          p.category === cat.id &&
          tierRank(p.minimumTier) <= tierLevel &&
          !(p.replacedByFabrick && tierLevel >= TIER_ORDER.fabrick)
        )
        .sort((a, b) => tierRank(a.minimumTier) - tierRank(b.minimumTier))
    )
  }
  return map
})

// Keyed by the TIERS constants, never by their values written out — a literal key is a copy that
// goes stale the next time a value moves, which is exactly how the last tier rename reached the UI.
const TIER_COLORS: Record<string, string> = {
  [TIERS.DEMO]: 'grey',
  [TIERS.FREE]: 'positive',
  [TIERS.SOLO]: 'amber-8',
  [TIERS.TEAM]: 'amber-9',
  [TIERS.FABRICK]: 'purple',
}

const currentTierBadgeColor = computed(() => TIER_COLORS[appStore.effectiveTier] ?? 'grey')

function tierBadgeColor(tier: string): string {
  return TIER_COLORS[tier] ?? 'grey'
}

// TIER_LABELS, not a capitalised value: it carries the brand mark ("FabricK", "Weaver Solo"),
// which `tier.charAt(0).toUpperCase()` could never produce.
function tierBadgeLabel(tier: string): string {
  return TIER_LABELS[tier as TierName] ?? tier
}

function statusColor(status: PluginManifest['status']): string {
  switch (status) {
    case 'active': return 'positive'
    case 'available': return 'grey-3'
    case 'coming-soon': return 'amber-8'
    default: return 'grey'
  }
}

function statusLabel(status: PluginManifest['status']): string {
  switch (status) {
    case 'active': return 'Active'
    case 'available': return 'Locked'
    case 'coming-soon': return 'Coming Soon'
    default: return status
  }
}
</script>

<style scoped lang="scss">
.extension-card {
  position: relative;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }
}

.extension-lock-overlay {
  background: rgba(255, 255, 255, 0.75);
  border-radius: inherit;
  pointer-events: none;
}

.body--dark .extension-lock-overlay {
  background: rgba(30, 30, 30, 0.75);
}
</style>

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  TierGate — renders slot content when the current tier meets the requirement,
  UpgradeNag automatically when it does not. The nag is structurally impossible
  to forget: there is no v-else branch to omit.

  Usage:
    <TierGate :required-tier="TIERS.SOLO" feature-name="Live Provisioning">
      <q-btn @click="doThing">Create</q-btn>
    </TierGate>
-->
<template>
  <slot v-if="allowed" />
  <UpgradeNag
    v-else
    :feature-name="featureName"
    :feature-description="featureDescription"
    :required-tier="requiredTier"
    :features="features"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from 'src/stores/app'
import UpgradeNag from 'src/components/nag/UpgradeNag.vue'
import { TIERS, TIER_ORDER, type TierName } from 'src/constants/vocabularies'

const props = withDefaults(defineProps<{
  requiredTier?: TierName
  featureName: string
  featureDescription?: string
  features?: string[]
}>(), {
  requiredTier: TIERS.SOLO,
})

const appStore = useAppStore()
const allowed = computed(() => TIER_ORDER[appStore.effectiveTier] >= TIER_ORDER[props.requiredTier])
</script>

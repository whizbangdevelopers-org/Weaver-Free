<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-card v-if="!publicDemo" flat bordered class="upgrade-nag q-pa-md">
    <q-card-section class="text-center q-pa-lg">
      <q-icon :name="tierIcon" size="48px" :color="tierColor" />
      <div class="text-h6 q-mt-md">{{ featureName }}</div>
      <div class="text-body2 text-grey-7 q-mt-sm">
        {{ featureDescription || defaultDescription }}
      </div>
      <div v-if="features && features.length" class="q-mt-md text-left" style="display: inline-block">
        <div v-for="f in features" :key="f" class="text-body2 q-mb-xs">
          <q-icon name="mdi-check" color="positive" size="xs" class="q-mr-xs" />
          {{ f }}
        </div>
      </div>
      <div class="q-mt-lg">
        <q-btn
          :color="tierColor"
          :label="ctaLabel"
          no-caps
          unelevated
          :href="ctaHref"
          target="_blank"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { isPublicDemo } from 'src/config/demo'
import { TIERS, type TierName } from 'src/constants/vocabularies'

const props = withDefaults(defineProps<{
  featureName: string
  featureDescription?: string
  requiredTier?: TierName
  features?: string[]
}>(), {
  requiredTier: TIERS.WEAVER,
})

const publicDemo = isPublicDemo()

const tierIcon = computed(() =>
  publicDemo
    ? (props.requiredTier === TIERS.FABRICK ? 'mdi-domain' : 'mdi-clock-outline')
    : (props.requiredTier === TIERS.FABRICK ? 'mdi-domain' : 'mdi-star'),
)

const tierColor = computed(() =>
  props.requiredTier === TIERS.FABRICK ? 'deep-purple' : 'amber-8',
)

const defaultDescription = computed(() => {
  if (publicDemo) {
    return props.requiredTier === TIERS.FABRICK
      ? `${props.featureName} is coming in the FabricK edition.`
      : `${props.featureName} is coming soon in the Weaver edition.`
  }
  return `This feature requires a ${props.requiredTier} license.`
})

const ctaHref = computed(() =>
  publicDemo
    ? 'https://github.com/whizbangdevelopers-org/Weaver-Free/discussions'
    : 'https://weaver-demo.github.io/pricing',
)

const ctaLabel = computed(() => {
  if (publicDemo) {
    return props.requiredTier === TIERS.FABRICK ? 'Request Early Access' : 'Join the Beta'
  }
  return props.requiredTier === TIERS.FABRICK ? 'Upgrade to FabricK' : 'Upgrade to Weaver'
})
</script>

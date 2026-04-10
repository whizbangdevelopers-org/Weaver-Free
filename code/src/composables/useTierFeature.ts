// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { defineComponent, h, computed, watch, ref, type Component } from 'vue'
import { useAppStore, type Tier } from 'src/stores/app'
import UpgradeNag from 'src/components/nag/UpgradeNag.vue'
import { TIERS } from 'src/constants/vocabularies'

const TIER_ORDER: Record<Tier, number> = {
  [TIERS.DEMO]: 0,
  [TIERS.FREE]: 1,
  [TIERS.WEAVER]: 2,
  [TIERS.FABRICK]: 3,
}

interface TierFeatureOptions {
  /** Minimum tier required to access this feature */
  minimumTier: typeof TIERS.WEAVER | typeof TIERS.FABRICK
  /** Dynamic import for the tier-gated component */
  loader: () => Promise<{ default: Component }>
  /** Display name shown in the upgrade nag */
  featureName: string
  /** Description shown in the upgrade nag */
  featureDescription?: string
  /** Feature bullet points shown in the upgrade nag */
  features?: string[]
}

/**
 * Returns a reactive component that either loads the tier-gated feature
 * or falls back to an UpgradeNag when:
 * 1. The current tier is insufficient (runtime check), OR
 * 2. The component file doesn't exist (directory excluded in free repo)
 *
 * Unlike defineAsyncComponent, this re-evaluates when the tier changes,
 * so late-arriving health data correctly upgrades from nag to the gated component.
 */
export function useTierFeature(opts: TierFeatureOptions): Component {
  return defineComponent({
    name: 'TierGate',
    inheritAttrs: false,
    setup(_props, { attrs }) {
      const appStore = useAppStore()
      let premiumComponent: Component | null = null
      const loadFailed = ref(false)
      const loaded = ref(false)

      const hasTier = computed(() => TIER_ORDER[appStore.effectiveTier] >= TIER_ORDER[opts.minimumTier])

      // Load gated component when tier becomes sufficient
      watch(hasTier, async (has) => {
        if (has && !premiumComponent && !loadFailed.value) {
          try {
            const mod = await opts.loader()
            premiumComponent = mod.default
            loaded.value = true
          } catch {
            // File doesn't exist in this edition (directory excluded)
            loadFailed.value = true
          }
        }
      }, { immediate: true })

      return () => {
        if (hasTier.value && loaded.value && premiumComponent) {
          return h(premiumComponent, attrs)
        }
        if (hasTier.value && !loaded.value && !loadFailed.value) {
          return null // loading
        }
        return h(UpgradeNag, {
          featureName: opts.featureName,
          featureDescription: opts.featureDescription,
          requiredTier: opts.minimumTier,
          features: opts.features,
        })
      }
    },
  })
}

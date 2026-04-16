import { useState, useEffect, useRef } from 'react'
import type { ComponentType } from 'react'
import { TIER_ORDER, type TierViewConfig } from '../config/tier-views.js'
import { TIERS } from '../constants/vocabularies.js'

// Module-level caches persist across hook instances
const componentCache = new Map<string, ComponentType<any>>()
const failedCache = new Set<string>()

export interface TierViewResult {
  Component: ComponentType<any> | null
  loading: boolean
  isNag: boolean
  nagMeta: {
    featureName: string
    featureDescription: string
    requiredTier: typeof TIERS.SOLO | typeof TIERS.FABRICK
    features: string[]
  }
}

export function useTierView(viewKey: string, config: TierViewConfig, currentTier: string): TierViewResult {
  const [Component, setComponent] = useState<ComponentType<any> | null>(
    () => componentCache.get(viewKey) ?? null
  )
  const [loading, setLoading] = useState(false)
  const attempted = useRef(false)

  const currentLevel = TIER_ORDER[currentTier] ?? 0
  const requiredLevel = TIER_ORDER[config.minimumTier] ?? 99
  const tierSufficient = currentLevel >= requiredLevel

  useEffect(() => {
    // Don't attempt import if tier is insufficient, already cached, or already failed
    if (!tierSufficient || componentCache.has(viewKey) || failedCache.has(viewKey) || attempted.current) {
      return
    }
    attempted.current = true
    setLoading(true)

    config.loader()
      .then((mod) => {
        const comp = (mod as Record<string, ComponentType<any>>)[config.exportName]
        if (comp) {
          componentCache.set(viewKey, comp)
          setComponent(() => comp)
        } else {
          failedCache.add(viewKey)
        }
      })
      .catch(() => {
        failedCache.add(viewKey)
      })
      .finally(() => setLoading(false))
  }, [tierSufficient, viewKey, config])

  const isNag = !tierSufficient || failedCache.has(viewKey)

  return {
    Component: isNag ? null : Component,
    loading,
    isNag,
    nagMeta: {
      featureName: config.featureName,
      featureDescription: config.featureDescription,
      requiredTier: config.minimumTier as typeof TIERS.SOLO | typeof TIERS.FABRICK,
      features: config.features,
    },
  }
}

/** Reset caches — for testing only */
export function _resetTierViewCache(): void {
  componentCache.clear()
  failedCache.clear()
}

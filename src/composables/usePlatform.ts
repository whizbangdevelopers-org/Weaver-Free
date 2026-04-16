// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { computed } from 'vue'
import { Platform } from 'quasar'

/**
 * Composable for detecting the current platform and capabilities
 */
export function usePlatform() {
  const isElectron = computed(() => {
    return (
      typeof window !== 'undefined' &&
      typeof window.process === 'object' &&
      (window.process as NodeJS.Process & { type?: string }).type === 'renderer'
    )
  })

  const isCapacitor = computed(() => {
    return typeof window !== 'undefined' && !!(window as Window & { Capacitor?: unknown }).Capacitor
  })

  const isPWA = computed(() => {
    return (
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
    )
  })

  const isWeb = computed(() => {
    return !isElectron.value && !isCapacitor.value
  })

  const isMobile = computed(() => {
    return Platform.is.mobile || isCapacitor.value
  })

  const isDesktop = computed(() => {
    return Platform.is.desktop || isElectron.value
  })

  const platformName = computed(() => {
    if (isElectron.value) return 'electron'
    if (isCapacitor.value) return Platform.is.ios ? 'ios' : 'android'
    if (isPWA.value) return 'pwa'
    return 'web'
  })

  return {
    isElectron,
    isCapacitor,
    isPWA,
    isWeb,
    isMobile,
    isDesktop,
    platformName
  }
}

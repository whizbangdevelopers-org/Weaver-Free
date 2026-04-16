// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useAppStore } from 'src/stores/app'
import { isPublicDemo, MILESTONE_BY_VERSION, type VersionMilestone } from 'src/config/demo'

/**
 * Watches demo version changes and fires a modal at milestone versions.
 * Private demo only — never fires in public demo.
 *
 * v1.0 modal fires after the onboarding wizard completes (not on mount),
 * so the investor sees: blank canvas → wizard → product appears → v1.0 modal.
 * All other milestones fire on version change via the version switcher.
 *
 * Tracks dismissed milestones per session so back-and-forth navigation
 * doesn't re-fire modals the investor has already seen.
 */
export function useMilestoneModal() {
  const appStore = useAppStore()
  const isOpen = ref(false)
  const activeMilestone = ref<VersionMilestone | null>(null)
  const dismissedVersions = new Set<string>()

  function showIfMilestone(version: string) {
    if (isPublicDemo()) return
    const milestone = MILESTONE_BY_VERSION.get(version)
    if (milestone && !dismissedVersions.has(version)) {
      activeMilestone.value = milestone
      isOpen.value = true
    }
  }

  // v1.0: fire after onboarding wizard completes (dispatched by WeaverPage)
  function onOnboardingComplete() {
    showIfMilestone(appStore.demoVersion)
  }

  onMounted(() => {
    window.addEventListener('demo:onboarding-complete', onOnboardingComplete)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('demo:onboarding-complete', onOnboardingComplete)
  })

  // All other milestones: fire on version change — close current modal first
  watch(() => appStore.demoVersion, (newVersion) => {
    if (isOpen.value) dismiss()
    showIfMilestone(newVersion)
  })

  function dismiss() {
    if (activeMilestone.value) dismissedVersions.add(activeMilestone.value.version)
    isOpen.value = false
  }

  return { isOpen, activeMilestone, dismiss }
}

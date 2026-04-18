<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  Version gate placeholder — shown in the private demo when a feature is not
  yet available in the selected demo version. Mirrors UpgradeNag (tier gate)
  but for roadmap versioning instead of tier access.

  Hidden entirely in public demo mode (Decision #135) — no roadmap leaks.
-->
<template>
  <q-card v-if="!isPublic" flat bordered class="version-nag-card">
    <q-card-section class="row items-center no-wrap q-pa-md q-gutter-x-md">
      <q-icon name="mdi-clock-outline" size="32px" color="grey-5" />

      <div class="col">
        <div class="row items-center q-gutter-x-sm">
          <span class="text-subtitle2 text-grey-8">{{ title }}</span>
          <q-badge outline color="grey-6" :label="versionLabel" />
          <q-badge :color="weeksColor" :label="weeksLabel" />
        </div>
        <div v-if="description" class="text-caption text-grey-6 q-mt-xs">{{ description }}</div>
      </div>

      <div class="text-caption text-grey-7 text-right text-no-wrap">
        {{ versionInfo?.headline }}
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { isPublicDemo } from 'src/config/demo-mode'
import { DEMO_VERSIONS, weeksUntilRelease } from 'src/config/demo'

const isPublic = computed(() => isPublicDemo())

const props = defineProps<{
  /** Target version string, e.g. '1.1' */
  version: string
  /** Feature name, e.g. 'Container Visibility' */
  title: string
  /** Optional one-line description */
  description?: string
}>()

const versionInfo = computed(() =>
  DEMO_VERSIONS.find(v => v.version === props.version)
)

const versionLabel = computed(() => versionInfo.value?.label ?? `v${props.version}.0`)

const weeksLabel = computed(() => {
  if (!versionInfo.value) return '?'
  if (versionInfo.value.status === 'released') return 'Released'
  const wks = weeksUntilRelease(versionInfo.value.targetDate)
  return wks <= 0 ? 'In Progress' : `+${wks} wks`
})

const weeksColor = computed(() => {
  if (!versionInfo.value) return 'grey'
  if (versionInfo.value.status === 'released') return 'positive'
  if (versionInfo.value.status === 'in-progress') return 'amber-8'
  return 'grey-6'
})
</script>

<style scoped lang="scss">
.version-nag-card {
  background: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 12px,
    rgba(0, 0, 0, 0.018) 12px,
    rgba(0, 0, 0, 0.018) 24px
  );
  border-color: #e0e0e0 !important;
}
</style>

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Public demo release summary (Decision #135).
  Shows cumulative feature highlights as the prospect steps through Free versions.
  Tells the "we ship consistently" story without leaking roadmap details.
  Only shown in public demo mode.
-->
<template>
  <div v-if="isPublic && visibleReleases.length > 0" class="release-summary q-mt-xl">
    <div class="text-subtitle1 text-weight-bold q-mb-md row items-center">
      <q-icon name="mdi-timeline-check" size="sm" class="q-mr-sm text-grey-7" />
      What's in Weaver Free
    </div>

    <div v-for="rel in visibleReleases" :key="rel.version" class="release-block q-mb-md">
      <div class="release-header row items-center q-mb-xs">
        <q-badge
          :color="rel.version === currentVersion ? 'light-green-8' : 'grey-5'"
          :label="'v' + rel.version"
          class="q-mr-sm"
        />
        <span class="text-weight-bold text-body2">{{ rel.headline }}</span>
        <q-badge
          v-if="rel.version === currentVersion"
          color="light-green-8"
          label="current"
          outline
          class="q-ml-sm"
          style="font-size: 0.6rem"
        />
      </div>
      <div v-for="feature in rel.features" :key="feature" class="release-feature">
        <q-icon name="mdi-check" color="positive" size="xs" class="q-mr-xs" />
        <span class="text-body2 text-grey-8">{{ feature }}</span>
      </div>
    </div>

    <!-- FM CTA at the bottom of the release story -->
    <q-card flat bordered class="bg-grey-1 q-mt-md">
      <q-card-section class="row items-center q-pa-md">
        <q-icon name="mdi-hammer-wrench" size="sm" color="grey-7" class="q-mr-sm" />
        <div class="col">
          <div class="text-body2 text-weight-medium">We're actively building Weaver</div>
          <div class="text-caption text-grey-6">New features ship regularly. Become a Founding Member to shape what comes next.</div>
        </div>
        <q-btn
          unelevated
          color="light-green-8"
          text-color="white"
          label="Learn More"
          :href="PUBLIC_DEMO_LINKS.fmProgram"
          target="_blank"
          no-caps
          size="sm"
          class="q-ml-md"
        />
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from 'src/stores/app'
import {
  isPublicDemo,
  DEMO_VERSIONS,
  PUBLIC_DEMO_LINKS,
  PUBLIC_DEMO_RELEASE_HIGHLIGHTS,
} from 'src/config/demo'

const appStore = useAppStore()
const isPublic = computed(() => isPublicDemo())
const currentVersion = computed(() => appStore.demoVersion)

const visibleReleases = computed(() => {
  const current = parseFloat(appStore.demoVersion)
  return DEMO_VERSIONS
    .filter(v => parseFloat(v.version) <= current && parseFloat(v.version) <= 1.3)
    .filter(v => PUBLIC_DEMO_RELEASE_HIGHLIGHTS[v.version])
    .map(v => ({
      version: v.version,
      headline: v.headline,
      features: PUBLIC_DEMO_RELEASE_HIGHLIGHTS[v.version]!,
    }))
})
</script>

<style scoped lang="scss">
.release-summary {
  max-width: 640px;
}

.release-block {
  padding-left: 12px;
  border-left: 2px solid #e2e8f0;
}

.release-header {
  margin-left: -13px;
  padding-left: 12px;
}

.release-feature {
  display: flex;
  align-items: center;
  padding: 2px 0;
}
</style>

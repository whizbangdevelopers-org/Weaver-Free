<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div v-if="isDemo" class="demo-banner row items-center no-wrap q-px-md">
    <span class="text-white text-weight-bold">Demo Mode</span>
    <span v-show="isPublic" class="text-white q-mx-sm">|</span>
    <a
      v-show="isPublic"
      :href="PUBLIC_DEMO_LINKS.fmProgram"
      target="_blank"
      rel="noopener noreferrer"
      class="text-white text-weight-bold demo-banner__link"
    >
      Become a Founding Member
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { isDemoMode as checkDemoMode, isPublicDemo, PUBLIC_DEMO_LINKS } from 'src/config/demo'

const isDemo = computed(() => checkDemoMode())
const isPublic = computed(() => isPublicDemo())
</script>

<style scoped lang="scss">
.demo-banner {
  background-color: #f59e0b;
  font-size: 0.875rem;
  white-space: nowrap;
}

.demo-banner__link {
  text-decoration: underline;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.85;
  }
}
</style>

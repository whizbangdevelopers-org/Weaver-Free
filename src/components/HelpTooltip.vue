<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <span v-if="settingsStore.showHelpTooltips" class="help-tooltip-trigger">
    <q-icon
      name="mdi-help-circle-outline"
      size="16px"
      class="cursor-pointer text-grey-6 q-ml-xs"
    />
    <q-tooltip
      anchor="top middle"
      self="bottom middle"
      :offset="[0, 8]"
      max-width="280px"
      class="text-body2"
    >
      {{ text }}
    </q-tooltip>
  </span>
</template>

<script setup lang="ts">
import { useSettingsStore } from 'src/stores/settings-store'

defineProps<{
  text: string
}>()

const settingsStore = useSettingsStore()
</script>

<style scoped>
.help-tooltip-trigger {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}
</style>

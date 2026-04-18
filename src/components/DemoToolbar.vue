<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  DemoToolbar — private demo control bar (not shown in public demo).

  Contains all demo controls in a single unified bar:
    Version Switcher | Tier Switcher | TUI toggle | Mobile toggle | Replay
-->
<template>
  <div class="demo-toolbar">
    <button class="demo-toolbar__label" @click="handleReset">
      <q-icon name="mdi-bullhorn" size="1.6em" class="q-mr-sm" />{{ demoLabel }}
    </button>
    <div class="demo-toolbar__controls row items-stretch no-wrap">
      <DemoVersionSwitcher />
      <DemoTierSwitcher :show-tui="showTui" :show-mobile="showMobile" @toggle-tui="$emit('toggleTui')" @toggle-mobile="$emit('toggleMobile')" />
    </div>
    <div />
  </div>

  <DemoArchitectureInsight
    v-model="milestoneModal.isOpen.value"
    :milestone="milestoneModal.activeMilestone.value"
    @update:model-value="milestoneModal.dismiss()"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from 'src/stores/app'
import { useSettingsStore } from 'src/stores/settings-store'
import { useWorkloadStore } from 'src/stores/workload-store'
import { isPublicDemo } from 'src/config/demo-mode'
import { useMilestoneModal } from 'src/composables/useMilestoneModal'
import DemoVersionSwitcher from './demo/DemoVersionSwitcher.vue'
import DemoTierSwitcher from './demo/DemoTierSwitcher.vue'
import DemoArchitectureInsight from './demo/DemoArchitectureInsight.vue'

defineProps<{ showTui: boolean; showMobile: boolean }>()
defineEmits<{ (e: 'toggleTui'): void; (e: 'toggleMobile'): void }>()

const router = useRouter()
const appStore = useAppStore()
const settingsStore = useSettingsStore()
const workloadStore = useWorkloadStore()
const milestoneModal = useMilestoneModal()
const demoLabel = computed(() => isPublicDemo() ? 'Public Demo' : 'Private Demo')

function handleReset() {
  appStore.resetDemo()
  settingsStore.resetWizard()
  workloadStore.clearWorkloadsForDemo()
  void router.push('/weaver').then(() => {
    window.dispatchEvent(new CustomEvent('demo:replay-onboarding'))
  })
}
</script>

<style scoped lang="scss">
.demo-toolbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  background: #f8fafc;
  border-bottom: 1px solid #000;
  width: 100%;
  min-height: 50px;
  overflow-x: auto;
}

.demo-toolbar__controls {
  grid-column: 2;
}

.demo-toolbar__label {
  font-size: 1.25rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #7AB800;
  padding: 0 10px;
  white-space: nowrap;
  border-right: 1px solid #e2e8f0;
  align-self: stretch;
  display: flex;
  align-items: center;
  background: none;
  border-top: none;
  border-bottom: none;
  border-left: none;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    color: #6aa300;
    background: rgba(122, 184, 0, 0.06);
  }
}
</style>

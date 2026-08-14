<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  CATCH — the exact shape that shipped in WeaverPage.vue and rendered the whole
  page blank while audit:eager-eval-tdz reported PASS.

  `watch(..., { immediate: true })` evaluates `unifiedItems` during <script setup>,
  and that computed's body reads `filteredItems`, which is declared BELOW. The
  TDZ error is thrown on the transitive dependency, not on the watched source —
  so a checker that only inspects the first argument's own declaration order
  sees nothing wrong.

  expect: violation on `filteredItems`
-->
<template>
  <div>{{ unifiedItems.length }}</div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useUiStore } from 'stores/ui-store'

const uiStore = useUiStore()
const vms = computed(() => ['a', 'b'])

const unifiedItems = computed(() => [...vms.value, ...filteredItems.value])

watch(
  unifiedItems,
  (items) => uiStore.setFocusableWorkloads(items),
  { immediate: true, deep: false },
)

const filteredItems = computed(() => ['c'])
</script>

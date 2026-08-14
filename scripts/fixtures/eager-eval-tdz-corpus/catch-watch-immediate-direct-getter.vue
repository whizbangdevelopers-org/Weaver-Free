<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  CATCH — `watch` with an inline getter source rather than a ref. Same hazard,
  different syntax: the getter runs immediately and reads a const declared below.

  expect: violation on `laterValue`
-->
<template>
  <div>{{ laterValue }}</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const seen = ref(0)

watch(
  () => laterValue.value,
  (v) => { seen.value = v },
  { immediate: true },
)

const laterValue = computed(() => 42)
</script>

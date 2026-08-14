<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  IGNORE — every legitimate shape, in one file. This half matters more than the
  CATCH half: a rule that flags the sanctioned pattern gets switched off, after
  which it catches nothing at all.

  1. `watch` with NO immediate — lazy, so declaration order is irrelevant even
     though `lazyLater` is declared below.
  2. `watch` with `immediate: false` — explicitly lazy.
  3. `watch` with `immediate: true` where every transitive dependency is declared
     ABOVE. This is the CORRECT form and the fix applied to WeaverPage.vue; if the
     auditor flags it, the fix looks like the bug.
  4. A `watch(..., { immediate: true })` nested inside `onMounted` — runs after
     setup completes, so no TDZ regardless of order.

  expect: no violations
-->
<template>
  <div>{{ orderedItems.length }}</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

const sink = ref<string[]>([])

// (1) lazy — no immediate option at all
watch(
  () => lazyLater.value,
  (v) => { sink.value = [String(v)] },
)

// (2) explicitly lazy
watch(
  () => lazyLater.value,
  (v) => { sink.value = [String(v)] },
  { immediate: false },
)

const lazyLater = computed(() => 1)

// (3) the CORRECT eager form — dependency declared above the call
const baseItems = computed(() => ['a'])
const orderedItems = computed(() => [...baseItems.value].sort())

watch(
  orderedItems,
  (items) => { sink.value = items },
  { immediate: true, deep: false },
)

// (4) nested in a lifecycle hook — not setup-time
onMounted(() => {
  watch(
    () => nestedLater.value,
    (v) => { sink.value = [String(v)] },
    { immediate: true },
  )
})

const nestedLater = computed(() => 2)
</script>

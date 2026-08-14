<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  CATCH — the two triggers that already worked before `watch` was added. They are
  in the corpus so a future edit cannot fix `watch` by breaking these.

  expect: violations on `pageTitle` (useMeta) and `tally` (watchEffect)
-->
<template>
  <div>{{ pageTitle }}{{ tally }}</div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useMeta } from 'quasar'

const out = ref('')

useMeta(() => ({ title: pageTitle.value }))

watchEffect(() => { out.value = String(tally.value) })

const pageTitle = computed(() => 'Weaver')
const tally = computed(() => 7)
</script>

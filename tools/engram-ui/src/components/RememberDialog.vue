<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-dialog v-model="open" @hide="reset">
    <q-card style="min-width: 480px; max-width: 640px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="mdi-memory" class="q-mr-xs" />
          Remember
        </div>
        <q-space />
        <q-btn icon="mdi-close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="datasetName"
          outlined
          dense
          label="Dataset name"
          placeholder="e.g. host_foundry_patterns"
          class="q-mb-md"
        />
        <q-input
          v-model="text"
          outlined
          type="textarea"
          label="Content to remember"
          placeholder="Enter text to store in the knowledge graph…"
          rows="6"
          autogrow
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" v-close-popup />
        <q-btn
          color="primary"
          label="Remember"
          icon="mdi-memory"
          :loading="loading"
          :disable="!text.trim() || !datasetName.trim()"
          @click="onSubmit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  modelValue: boolean
  loading: boolean
  defaultDataset?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  submit: [text: string, datasetName: string]
}>()

const open = ref(props.modelValue)
const text = ref('')
const datasetName = ref(props.defaultDataset ?? '')

import { watch } from 'vue'
watch(() => props.modelValue, (v) => { open.value = v })
watch(open, (v) => emit('update:modelValue', v))
watch(() => props.defaultDataset, (v) => { if (v) datasetName.value = v })

function reset() {
  text.value = ''
}

async function onSubmit() {
  if (!text.value.trim() || !datasetName.value.trim()) return
  emit('submit', text.value.trim(), datasetName.value.trim())
}
</script>

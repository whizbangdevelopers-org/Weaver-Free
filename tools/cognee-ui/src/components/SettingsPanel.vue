<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="column q-pa-md" style="height: 100%">
    <div class="text-subtitle1 q-mb-md">
      <q-icon name="mdi-cog" class="q-mr-xs" />
      Settings
    </div>

    <!-- Error -->
    <q-banner v-if="error" rounded class="bg-negative text-white q-mb-md">
      <template #avatar><q-icon name="mdi-alert" /></template>
      {{ error }}
    </q-banner>

    <!-- Loading -->
    <div v-if="loading && !form.llm.provider" class="flex flex-center q-pa-xl">
      <q-spinner-dots color="primary" size="40px" />
    </div>

    <q-scroll-area v-else class="col">
      <!-- LLM Settings -->
      <div class="text-overline text-grey-7 q-mb-sm">LLM Provider</div>
      <q-card flat bordered class="q-mb-md">
        <q-card-section class="q-gutter-sm">
          <q-select
            v-model="form.llm.provider"
            :options="llmProviders"
            outlined
            dense
            label="Provider"
          />
          <q-input
            v-model="form.llm.model"
            outlined
            dense
            label="Model"
            placeholder="e.g. claude-3-5-haiku-20241022"
          />
          <q-input
            v-model="form.llm.api_key"
            outlined
            dense
            label="API Key"
            :type="showLlmKey ? 'text' : 'password'"
            placeholder="sk-..."
          >
            <template #append>
              <q-btn
                flat
                dense
                round
                :icon="showLlmKey ? 'mdi-eye-off' : 'mdi-eye'"
                @click="showLlmKey = !showLlmKey"
              />
            </template>
          </q-input>
        </q-card-section>
      </q-card>

      <!-- Vector DB Settings -->
      <div class="text-overline text-grey-7 q-mb-sm">Vector Database</div>
      <q-card flat bordered class="q-mb-md">
        <q-card-section class="q-gutter-sm">
          <q-select
            v-model="form.vector_db.provider"
            :options="vectorDbProviders"
            outlined
            dense
            label="Provider"
          />
          <q-input
            v-model="form.vector_db.url"
            outlined
            dense
            label="URL"
            placeholder="e.g. http://localhost:6333"
          />
          <q-input
            v-model="form.vector_db.api_key"
            outlined
            dense
            label="API Key (optional)"
            :type="showVectorKey ? 'text' : 'password'"
          >
            <template #append>
              <q-btn
                flat
                dense
                round
                :icon="showVectorKey ? 'mdi-eye-off' : 'mdi-eye'"
                @click="showVectorKey = !showVectorKey"
              />
            </template>
          </q-input>
        </q-card-section>
      </q-card>

      <div class="row justify-end q-gutter-sm">
        <q-btn flat label="Reset" icon="mdi-refresh" @click="onReset" />
        <q-btn
          color="primary"
          label="Save"
          icon="mdi-content-save"
          :loading="saving"
          @click="onSave"
        />
      </div>
    </q-scroll-area>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Settings } from '../composables/useCognee'

const props = defineProps<{
  settings: Settings | null
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  save: [payload: Settings]
}>()

const saving = ref(false)
const showLlmKey = ref(false)
const showVectorKey = ref(false)

const llmProviders = ['anthropic', 'openai', 'ollama', 'gemini', 'mistral', 'groq']
const vectorDbProviders = ['lancedb', 'chromadb', 'pgvector', 'weaviate', 'qdrant']

const emptyForm = (): Settings => ({
  llm: { provider: '', model: '', api_key: '' },
  vector_db: { provider: 'lancedb', url: '', api_key: '' },
})

const form = ref<Settings>(emptyForm())

watch(
  () => props.settings,
  (s) => {
    if (s) {
      form.value = {
        llm: { ...s.llm },
        vector_db: { ...s.vector_db },
      }
    }
  },
  { immediate: true },
)

function onReset() {
  if (props.settings) {
    form.value = {
      llm: { ...props.settings.llm },
      vector_db: { ...props.settings.vector_db },
    }
  }
}

async function onSave() {
  saving.value = true
  try {
    emit('save', { ...form.value })
  } finally {
    saving.value = false
  }
}
</script>

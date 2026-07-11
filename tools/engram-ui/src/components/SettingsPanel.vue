<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="q-pa-md">
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

    <!-- Plain div, not q-scroll-area: the enclosing dialog q-card-section already caps
         height + scrolls. A q-scroll-area here inherits an auto/0 height and collapses,
         hiding all cards (only the subtitle showed). -->
    <div v-else>
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

      <!-- Knowledge write token (Stage B / WVR-197) — local to this browser -->
      <div class="text-overline text-grey-7 q-mb-sm">Knowledge write token</div>
      <q-card flat bordered class="q-mb-md">
        <q-card-section class="q-gutter-sm">
          <div class="text-caption text-grey-7">
            Bearer that authorises writes on the <strong>Author</strong> &amp; <strong>Review</strong> tabs.
            Read-only browsing needs no token. Stored in this browser only (not sent anywhere else).
          </div>
          <q-input
            v-model="writeToken"
            outlined
            dense
            label="engram-query write token"
            :type="showWriteToken ? 'text' : 'password'"
            data-testid="settings-write-token"
          >
            <template #append>
              <q-btn
                flat
                dense
                round
                :icon="showWriteToken ? 'mdi-eye-off' : 'mdi-eye'"
                @click="showWriteToken = !showWriteToken"
              />
            </template>
          </q-input>
          <div class="row items-center">
            <q-btn dense color="primary" icon="mdi-key" label="Save token" @click="onSaveToken" />
            <span v-if="tokenSaved" class="text-caption text-positive q-ml-sm">
              <q-icon name="mdi-check" /> saved to this browser
            </span>
          </div>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Settings } from '../composables/useCognee'
import { getWriteToken, setWriteToken } from '../composables/useKnowledgeEditor'

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

// Knowledge write token — persisted straight to localStorage, independent of the
// Cognee settings Save flow (WVR-197).
const writeToken = ref(getWriteToken())
const showWriteToken = ref(false)
const tokenSaved = ref(false)
function onSaveToken() {
  setWriteToken(writeToken.value.trim())
  tokenSaved.value = true
  setTimeout(() => { tokenSaved.value = false }, 2000)
}

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

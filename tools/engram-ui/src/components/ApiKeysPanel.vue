<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="column q-pa-md" style="height: 100%">
    <div class="row items-center q-mb-md">
      <div class="text-subtitle1">
        <q-icon name="mdi-key-variant" class="q-mr-xs" />
        API Keys
      </div>
      <q-space />
      <q-btn
        color="primary"
        dense
        icon="mdi-plus"
        label="New key"
        :loading="creating"
        @click="onCreateKey"
      />
    </div>

    <!-- Error -->
    <q-banner v-if="error" rounded class="bg-negative text-white q-mb-md">
      <template #avatar><q-icon name="mdi-alert" /></template>
      {{ error }}
    </q-banner>

    <!-- Loading -->
    <div v-if="loading && apiKeys.length === 0" class="flex flex-center q-pa-xl">
      <q-spinner-dots color="primary" size="40px" />
    </div>

    <!-- Empty -->
    <div v-else-if="!loading && apiKeys.length === 0" class="flex flex-center q-pa-xl column items-center text-grey-6">
      <q-icon name="mdi-key-remove" size="64px" color="grey-4" />
      <div class="text-caption q-mt-sm">No API keys — create one to authenticate external tools</div>
    </div>

    <!-- Keys list -->
    <q-scroll-area v-else class="col">
      <q-list separator>
        <q-item v-for="k in apiKeys" :key="k.id" class="q-pa-sm">
          <q-item-section>
            <q-item-label class="text-body2 text-weight-medium">
              {{ k.name || k.label || '(unnamed)' }}
            </q-item-label>
            <q-item-label caption>
              <span class="key-value">{{ k.key }}</span>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="row q-gutter-xs">
              <q-btn
                flat
                dense
                round
                icon="mdi-content-copy"
                size="sm"
                color="grey-6"
                @click="copyKey(k.key)"
              >
                <q-tooltip>Copy key</q-tooltip>
              </q-btn>
              <q-btn
                flat
                dense
                round
                icon="mdi-delete"
                size="sm"
                color="negative"
                :loading="deleting === k.id"
                @click="onDeleteKey(k.id)"
              >
                <q-tooltip>Delete key</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-scroll-area>

    <!-- New key dialog -->
    <q-dialog v-model="showNewKeyDialog">
      <q-card style="min-width: 360px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">New API Key</div>
          <q-space />
          <q-btn icon="mdi-close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="newKeyName"
            outlined
            dense
            label="Key name (optional)"
            placeholder="e.g. claude-code-mcp"
            autofocus
            @keyup.enter="onConfirmCreate"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn
            color="primary"
            label="Create"
            icon="mdi-key-plus"
            :loading="creating"
            @click="onConfirmCreate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import type { ApiKey } from '../composables/useEngram'

defineProps<{
  apiKeys: ApiKey[]
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  create: [name: string | undefined]
  delete: [id: string]
}>()

const $q = useQuasar()
const creating = ref(false)
const deleting = ref<string | null>(null)
const showNewKeyDialog = ref(false)
const newKeyName = ref('')

function onCreateKey() {
  newKeyName.value = ''
  showNewKeyDialog.value = true
}

async function onConfirmCreate() {
  creating.value = true
  try {
    emit('create', newKeyName.value.trim() || undefined)
    showNewKeyDialog.value = false
  } finally {
    creating.value = false
  }
}

async function onDeleteKey(id: string) {
  $q.dialog({
    title: 'Delete API key',
    message: 'This key will stop working immediately. Continue?',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    deleting.value = id
    try {
      emit('delete', id)
    } finally {
      deleting.value = null
    }
  })
}

function copyKey(key: string) {
  navigator.clipboard.writeText(key).then(() => {
    $q.notify({ type: 'positive', message: 'Copied to clipboard', timeout: 1500 })
  })
}
</script>

<style scoped>
.key-value {
  font-family: monospace;
  font-size: 0.75rem;
  color: #666;
}
</style>

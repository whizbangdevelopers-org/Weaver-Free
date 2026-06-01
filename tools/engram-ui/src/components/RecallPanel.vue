<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="column q-pa-md" style="height: 100%">
    <!-- Query input row -->
    <div class="row q-gutter-sm q-mb-md items-start">
      <q-input
        v-model="query"
        outlined
        dense
        placeholder="Enter a recall query…"
        class="col"
        @keyup.enter="onSearch"
      >
        <template #prepend>
          <q-icon name="mdi-magnify" size="18px" />
        </template>
      </q-input>

      <q-select
        v-model="searchType"
        :options="searchTypes"
        outlined
        dense
        style="min-width: 160px"
      />

      <q-btn
        color="primary"
        label="Search"
        icon="mdi-magnify"
        :loading="loading"
        @click="onSearch"
      />
    </div>

    <!-- Error -->
    <q-banner v-if="error" rounded class="bg-negative text-white q-mb-md">
      <template #avatar><q-icon name="mdi-alert" /></template>
      {{ error }}
    </q-banner>

    <!-- Loading overlay -->
    <div v-if="loading && results.length === 0" class="flex flex-center q-pa-xl">
      <q-spinner-dots color="primary" size="40px" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading && queried && results.length === 0" class="flex flex-center q-pa-xl column items-center">
      <q-icon name="mdi-database-search-outline" size="64px" color="grey-5" />
      <div class="text-h6 text-grey-7 q-mt-sm">No results</div>
      <div class="text-caption text-grey-6">Try a different query or search type</div>
    </div>

    <!-- Results -->
    <q-scroll-area v-else-if="results.length > 0" class="col">
      <div class="text-caption text-grey-7 q-mb-sm">
        {{ results.length }} result{{ results.length !== 1 ? 's' : '' }}
      </div>
      <q-card
        v-for="(r, i) in results"
        :key="i"
        flat
        bordered
        class="result-card q-mb-sm"
      >
        <q-card-section class="q-pa-sm">
          <div class="row items-start">
            <div class="col text-body2" style="white-space: pre-wrap; word-break: break-word">
              {{ r.text }}
            </div>
            <q-badge color="primary" class="q-ml-sm" style="flex-shrink: 0">
              {{ r.score.toFixed(2) }}
            </q-badge>
          </div>
          <div v-if="r.metadata?.project" class="row q-gutter-xs q-mt-xs">
            <q-badge outline color="teal" class="text-caption">
              {{ r.metadata.project }}
            </q-badge>
            <q-badge v-if="r.metadata?.entry_id" outline color="blue-grey" class="text-caption">
              {{ r.metadata.entry_id }}
            </q-badge>
            <q-badge v-if="r.metadata?.chunk_type && r.metadata.chunk_type !== 'knowledge_entry'" outline color="purple" class="text-caption">
              {{ r.metadata.chunk_type }}
            </q-badge>
          </div>
        </q-card-section>
      </q-card>
    </q-scroll-area>

    <!-- Initial state -->
    <div v-else class="flex flex-center q-pa-xl column items-center text-grey-6">
      <q-icon name="mdi-brain" size="64px" color="grey-4" />
      <div class="text-caption q-mt-sm">Enter a query to search the knowledge graph</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { RecallResult, SearchType } from '../composables/useCognee'

const props = defineProps<{
  results: RecallResult[]
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  search: [query: string, searchType: SearchType]
}>()

const query = ref('')
const searchType = ref<SearchType>('CHUNKS')
const queried = ref(false)
const searchTypes: SearchType[] = ['CHUNKS', 'GRAPH_COMPLETION', 'SUMMARIES', 'KNOWLEDGE']

function onSearch() {
  if (!query.value.trim()) return
  queried.value = true
  emit('search', query.value.trim(), searchType.value)
}
</script>

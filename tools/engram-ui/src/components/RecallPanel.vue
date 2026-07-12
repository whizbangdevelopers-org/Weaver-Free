<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Search lens — semantic recall over the served pgvector store via
  /engram-query/search. Knowledge search always spans the full registry
  (there is no dataset model in the governance console), so there is no search-type
  or scope selector — just a query box.
-->
<template>
  <div class="column q-pa-md" style="height: 100%">
    <!-- Query input row -->
    <div class="row q-gutter-sm items-start">
      <q-input
        v-model="query"
        outlined
        dense
        placeholder="Search the knowledge registry…"
        class="col"
        data-testid="recall-query"
        @keyup.enter="onSearch"
      >
        <template #prepend>
          <q-icon name="mdi-magnify" size="18px" />
        </template>
      </q-input>

      <q-btn
        color="primary"
        label="Search"
        icon="mdi-magnify"
        :loading="loading"
        @click="onSearch"
      />
    </div>

    <!-- Recent queries -->
    <div class="row items-center q-gutter-sm q-mt-sm q-mb-md">
      <span class="text-caption text-grey-6">Semantic recall spans the full registry</span>

      <q-space />

      <template v-if="recent.length > 0">
        <span class="text-caption text-grey-6 q-mr-xs">Recent:</span>
        <q-chip
          v-for="q in recent"
          :key="q"
          dense
          clickable
          size="sm"
          color="grey-2"
          text-color="grey-8"
          @click="runRecent(q)"
        >
          {{ q }}
        </q-chip>
      </template>
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
      <div class="text-caption text-grey-6">Try a different query</div>
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
          <div class="row items-start no-wrap">
            <div class="col text-body2 result-text" :class="{ clamped: !expanded.has(i) && isLong(r.text) }">
              {{ r.text }}
            </div>
            <div class="column items-end q-ml-sm" style="flex-shrink: 0">
              <q-badge color="primary">{{ r.score.toFixed(2) }}</q-badge>
              <div class="row q-mt-xs">
                <q-btn flat dense round size="xs" icon="mdi-content-copy" @click="copyText(r.text)">
                  <q-tooltip>Copy</q-tooltip>
                </q-btn>
              </div>
            </div>
          </div>

          <div v-if="isLong(r.text)" class="q-mt-xs">
            <q-btn flat dense size="xs" no-caps color="primary" :label="expanded.has(i) ? 'Show less' : 'Show full'" @click="toggleExpand(i)" />
          </div>

          <div v-if="sourceLabel(r) || r.metadata?.entry_id || r.metadata?.chunk_type" class="row q-gutter-xs q-mt-xs">
            <q-badge v-if="sourceLabel(r)" outline color="teal" class="text-caption">
              <q-icon name="mdi-database-outline" size="11px" class="q-mr-xxs" />
              {{ sourceLabel(r) }}
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
      <div class="text-caption q-mt-sm">Enter a query to recall from memory</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import type { RecallResult } from '../composables/useEngramMonitor'

defineProps<{
  results: RecallResult[]
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  search: [query: string]
}>()

const $q = useQuasar()

const query = ref('')
const queried = ref(false)
const expanded = ref<Set<number>>(new Set())

const RECENT_KEY = 'engram_recent_queries'
const recent = ref<string[]>(loadRecent())

function isLong(text: string): boolean {
  return text.length > 320
}

function toggleExpand(i: number) {
  const next = new Set(expanded.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  expanded.value = next
}

function sourceLabel(r: RecallResult): string | null {
  const meta = r.metadata
  if (!meta) return null
  const ds = meta.dataset ?? meta.dataset_name ?? meta.project
  return typeof ds === 'string' ? ds : null
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    $q.notify({ type: 'positive', message: 'Copied', timeout: 1200 })
  } catch {
    $q.notify({ type: 'negative', message: 'Copy failed', timeout: 1500 })
  }
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function pushRecent(q: string) {
  const next = [q, ...recent.value.filter((x) => x !== q)].slice(0, 8)
  recent.value = next
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* ignore */ }
}

function runRecent(q: string) {
  query.value = q
  onSearch()
}

function onSearch() {
  const q = query.value.trim()
  if (!q) return
  queried.value = true
  expanded.value = new Set()
  pushRecent(q)
  emit('search', q)
}
</script>

<style scoped>
.result-text {
  white-space: pre-wrap;
  word-break: break-word;
}
.result-text.clamped {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

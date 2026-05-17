<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-card flat bordered class="produced-card q-mb-sm">
    <q-card-section class="q-pa-sm">
      <div class="text-overline text-grey-6 q-mb-xs produced-label">Produced</div>
      <div class="row q-gutter-md flex-wrap">

        <div>
          <div class="text-caption text-grey-6">Chunks</div>
          <div class="text-body2 text-weight-medium">{{ fmt(props.chunks) }}</div>
        </div>

        <!-- knowledge: avg/entry + embedding latency -->
        <template v-if="props.mode === 'knowledge'">
          <div>
            <div class="text-caption text-grey-6">Avg / entry</div>
            <div class="text-body2">
              {{ props.avgPerEntry != null ? props.avgPerEntry.toFixed(1) : '—' }}
            </div>
          </div>
          <div>
            <div class="text-caption text-grey-6">Embedding latency</div>
            <div class="text-body2">
              <template v-if="props.embeddingLatencyMs != null">
                {{ props.embeddingLatencyMs }} ms
                <span v-if="props.embeddingHeadroomPer15s != null" class="text-caption text-grey-6">
                  · ~{{ props.embeddingHeadroomPer15s }}/15s
                </span>
              </template>
              <span v-else class="text-grey-5">—</span>
            </div>
          </div>
        </template>

        <!-- graph only: nodes / edges -->
        <template v-if="props.mode === 'graph'">
          <div>
            <div class="text-caption text-grey-6">Nodes / Edges</div>
            <div class="text-body2">{{ fmt(props.nodes) }} / {{ fmt(props.edges) }}</div>
          </div>
        </template>

        <!-- graph only: promotion rate -->
        <template v-if="props.mode === 'graph'">
          <div>
            <div class="text-caption text-grey-6">Promotion rate</div>
            <div class="text-body2">
              <span v-if="props.promotionRate != null">{{ props.promotionRate }}%</span>
              <span v-else class="text-grey-5">—</span>
            </div>
          </div>
        </template>

        <!-- cognee: entities + summaries -->
        <template v-if="props.mode === 'engram'">
          <div>
            <div class="text-caption text-grey-6">Entities</div>
            <div class="text-body2">{{ fmt(props.entities) }}</div>
          </div>
          <div>
            <div class="text-caption text-grey-6">Summaries</div>
            <div class="text-body2">{{ fmt(props.summaries) }}</div>
          </div>
        </template>

      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
const props = defineProps<{
  mode: 'knowledge' | 'graph' | 'engram'
  chunks?: number | null
  avgPerEntry?: number | null
  embeddingLatencyMs?: number | null
  embeddingHeadroomPer15s?: number | null
  nodes?: number | null
  edges?: number | null
  promotionRate?: number | null
  entities?: number | null
  summaries?: number | null
}>()

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString()
}
</script>

<style scoped>
.produced-card {
  background: rgba(0, 0, 0, 0.02);
}
.produced-label {
  font-size: 10px;
  letter-spacing: 0.08em;
}
</style>

<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="column q-pa-md" style="height: 100%">
    <div class="row items-center q-mb-md">
      <div class="text-subtitle1 q-mr-md">
        <q-icon name="mdi-graph" class="q-mr-xs" />
        Knowledge Graph
      </div>
      <q-chip v-if="activeDatasetName" dense color="primary" text-color="white" icon="mdi-database">
        {{ activeDatasetName }}
      </q-chip>
      <q-space />
      <q-btn
        flat
        dense
        icon="mdi-refresh"
        label="Load graph"
        :loading="loading"
        :disable="!activeDatasetId"
        @click="emit('load')"
      />
    </div>

    <!-- Error -->
    <q-banner v-if="error" rounded class="bg-negative text-white q-mb-md">
      <template #avatar><q-icon name="mdi-alert" /></template>
      {{ error }}
    </q-banner>

    <!-- No dataset selected -->
    <div v-if="!activeDatasetId" class="flex flex-center col column items-center text-grey-6">
      <q-icon name="mdi-database-arrow-left" size="64px" color="grey-4" />
      <div class="text-caption q-mt-sm">Select a dataset from the left panel to view its graph</div>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="flex flex-center col">
      <q-spinner-dots color="primary" size="40px" />
    </div>

    <!-- Empty graph -->
    <div v-else-if="graphData && graphData.nodes.length === 0" class="flex flex-center col column items-center text-grey-6">
      <q-icon name="mdi-graph-outline" size="64px" color="grey-4" />
      <div class="text-caption q-mt-sm">No graph data yet — run a cognify to extract entities</div>
    </div>

    <!-- Graph -->
    <div v-else-if="graphData" class="col" style="position: relative; min-height: 400px">
      <!-- Legend -->
      <div class="row q-gutter-xs q-mb-sm flex-wrap">
        <q-badge
          v-for="(color, type) in nodeColors"
          :key="type"
          :style="`background: ${color}`"
          class="text-white"
        >
          {{ type }}
        </q-badge>
      </div>

      <v-network-graph
        :nodes="vNodes"
        :edges="vEdges"
        :layouts="layouts"
        :configs="configs"
        style="width: 100%; height: calc(100% - 36px)"
      />

      <div class="text-caption text-grey-6 q-mt-xs">
        {{ graphData.nodes.length }} nodes · {{ graphData.edges.length }} edges
      </div>
    </div>

    <!-- Initial -->
    <div v-else class="flex flex-center col column items-center text-grey-6">
      <q-icon name="mdi-graph" size="64px" color="grey-4" />
      <div class="text-caption q-mt-sm">Click "Load graph" to fetch the knowledge graph</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { defineConfigs } from 'v-network-graph'
import type { GraphData } from '../composables/useCognee'

const props = defineProps<{
  graphData: GraphData | null
  activeDatasetId: string | null
  activeDatasetName: string | null
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  load: []
}>()

// Node type → color mapping (from cognee source)
const nodeColors: Record<string, string> = {
  Entity: '#6510F4',
  EntityType: '#A550FF',
  DocumentChunk: '#0DFF00',
  TextSummary: '#6510F4',
  TableRow: '#A550FF',
  TableType: '#6510F4',
}
const defaultNodeColor = '#7c3aed'

function nodeColor(type: string): string {
  return nodeColors[type] ?? defaultNodeColor
}

// Convert cognee GraphNode[] → v-network-graph nodes map
const vNodes = computed(() => {
  if (!props.graphData) return {}
  return Object.fromEntries(
    props.graphData.nodes.map((n) => [
      n.id,
      {
        name: n.label || n.id,
        color: nodeColor(n.type),
        type: n.type,
      },
    ]),
  )
})

// Convert cognee GraphEdge[] → v-network-graph edges map
const vEdges = computed(() => {
  if (!props.graphData) return {}
  return Object.fromEntries(
    props.graphData.edges.map((e, i) => [
      `e${i}`,
      { source: e.source, target: e.target, label: e.label },
    ]),
  )
})

const layouts = computed(() => ({ nodes: {} }))

type ColorNode = { color: string }

const configs = defineConfigs<ColorNode>({
  node: {
    normal: {
      color: (n) => n.color,
      radius: 16,
    },
    label: {
      visible: true,
      fontSize: 11,
      color: '#333',
    },
    hover: {
      color: (n) => n.color,
    },
  },
  edge: {
    normal: {
      color: '#aaa',
      width: 1.5,
    },
    label: {
      fontSize: 10,
    },
  },
  view: {
    autoPanAndZoomOnLoad: 'fit-content',
  },
})
</script>

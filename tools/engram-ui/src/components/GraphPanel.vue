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
        v-if="loading"
        flat
        dense
        icon="mdi-close"
        label="Cancel"
        color="grey-6"
        @click="emit('cancel')"
      />
      <q-btn
        v-else
        flat
        dense
        icon="mdi-refresh"
        label="Load graph"
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
    <div v-else-if="loading" class="flex flex-center col column items-center q-gutter-sm">
      <q-spinner-dots color="primary" size="40px" />
      <div v-if="loadingStatus" class="text-caption text-grey-6">{{ loadingStatus }}</div>
    </div>

    <!-- Empty graph -->
    <div v-else-if="graphData && graphData.nodes.length === 0" class="flex flex-center col column items-center text-grey-6">
      <q-icon name="mdi-graph-outline" size="64px" color="grey-4" />
      <div class="text-caption q-mt-sm">No graph data yet — run a cognify to extract entities</div>
    </div>

    <!-- Graph -->
    <div v-else-if="graphData" class="col column" style="position: relative; min-height: 400px">
      <!-- Stats + legend row -->
      <div class="row items-center q-mb-xs q-gutter-xs flex-wrap">
        <span class="text-caption text-grey-6 q-mr-xs">
          {{ graphData.nodes.length }} nodes · {{ graphData.edges.length }} edges
          <span v-if="truncated" class="text-warning"> · showing first {{ NODE_LIMIT }}</span>
        </span>
        <q-badge
          v-for="(color, type) in activeNodeColors"
          :key="type"
          :style="`background: ${color}`"
          class="text-white"
        >{{ type }}</q-badge>
      </div>

      <q-banner v-if="truncated" dense rounded class="bg-warning text-white q-mb-xs text-caption">
        Graph has {{ graphData.nodes.length }} nodes — showing first {{ NODE_LIMIT }} for performance.
      </q-banner>

      <v-network-graph
        class="col"
        :nodes="vNodes"
        :edges="vEdges"
        :layouts="layouts"
        :configs="configs"
      />
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
import { ForceLayout } from 'v-network-graph/lib/force-layout'
import type { GraphData } from '../composables/useCognee'

const props = defineProps<{
  graphData: GraphData | null
  activeDatasetId: string | null
  activeDatasetName: string | null
  loading: boolean
  loadingStatus: string | null
  error: string | null
}>()

const emit = defineEmits<{
  load: []
  cancel: []
}>()

const NODE_LIMIT = 500

// Node type → color (from cognee source)
const nodeColors: Record<string, string> = {
  Entity:        '#6510F4',
  EntityType:    '#A550FF',
  DocumentChunk: '#21ba45',
  TextSummary:   '#FF9800',
  TableRow:      '#00BCD4',
  TableType:     '#E91E63',
}
const defaultNodeColor = '#7c3aed'

function nodeColor(type: string): string {
  return nodeColors[type] ?? defaultNodeColor
}

// Truncated node list — cap at NODE_LIMIT to protect the browser
const cappedNodes = computed(() => {
  if (!props.graphData) return []
  return props.graphData.nodes.slice(0, NODE_LIMIT)
})

const truncated = computed(() =>
  !!props.graphData && props.graphData.nodes.length > NODE_LIMIT,
)

const cappedNodeIds = computed(() => new Set(cappedNodes.value.map((n) => n.id)))

// Only include edges where both endpoints are in the capped node set
const cappedEdges = computed(() => {
  if (!props.graphData) return []
  return props.graphData.edges.filter(
    (e) => cappedNodeIds.value.has(e.source) && cappedNodeIds.value.has(e.target),
  )
})

const vNodes = computed(() =>
  Object.fromEntries(
    cappedNodes.value.map((n) => [
      n.id,
      { name: n.label || n.id, color: nodeColor(n.type), type: n.type },
    ]),
  ),
)

const vEdges = computed(() =>
  Object.fromEntries(
    cappedEdges.value.map((e, i) => [
      `e${i}`,
      { source: e.source, target: e.target, label: e.label },
    ]),
  ),
)

// Only show legend colors for types actually present in the capped set
const activeNodeColors = computed(() => {
  const types = new Set(cappedNodes.value.map((n) => n.type))
  return Object.fromEntries(
    Object.entries(nodeColors).filter(([t]) => types.has(t)),
  )
})

const layouts = computed(() => ({ nodes: {} }))

type ColorNode = { color: string }

const configs = defineConfigs<ColorNode>({
  node: {
    normal: { color: (n) => n.color, radius: 12 },
    label: { visible: true, fontSize: 10, color: '#444' },
    hover: { color: (n) => n.color },
  },
  edge: {
    normal: { color: '#bbb', width: 1 },
    label: { fontSize: 9, color: '#888' },
  },
  view: {
    autoPanAndZoomOnLoad: 'fit-content',
    layoutHandler: new ForceLayout({
      positionFixedByDrag: true,
      positionFixedByClickWithAltKey: true,
      createSimulation: (d3, nodes, edges) => {
        const forceLink = d3.forceLink<typeof nodes[number], typeof edges[number]>(edges)
          .id((d: { id: string }) => d.id)
          .distance(60)
        return d3
          .forceSimulation(nodes)
          .force('edge', forceLink)
          .force('charge', d3.forceManyBody().strength(-80))
          .force('center', d3.forceCenter())
          .force('collide', d3.forceCollide(20))
          .alphaMin(0.01)
      },
    }),
  },
})
</script>

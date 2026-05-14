<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="column" :style="isFullscreen ? 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;background:#fff' : 'height:500px;position:relative'">

    <!-- Empty state -->
    <div v-if="nodes.length === 0" class="flex flex-center col column items-center text-grey-6">
      <q-icon name="mdi-graph-outline" size="48px" color="grey-4" />
      <div class="text-caption q-mt-sm">No entries in registry yet</div>
    </div>

    <template v-else>
      <!-- Legend row -->
      <div class="row items-center q-mb-xs q-gutter-x-sm flex-wrap">

        <!-- Fill = domain -->
        <span class="text-caption text-grey-5" style="white-space:nowrap">fill = domain:</span>
        <span
          v-for="[domain, color] in domainLegend"
          :key="domain"
          class="row items-center q-gutter-x-xs text-caption"
        >
          <span :style="`display:inline-block;width:10px;height:10px;border-radius:50%;background:${color}`" />
          <span>{{ domain }}</span>
        </span>

        <q-separator vertical class="q-mx-xs" />

        <!-- Shape + border = type -->
        <span class="text-caption text-grey-5" style="white-space:nowrap">shape · border = type:</span>
        <span class="row items-center q-gutter-x-xs text-caption">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#bdbdbd;border:2px solid #0d47a1" />
          <span>lesson</span>
        </span>
        <span class="row items-center q-gutter-x-xs text-caption">
          <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#bdbdbd;border:2px solid #bf360c" />
          <span>gotcha</span>
        </span>

        <q-separator vertical class="q-mx-xs" />
        <span class="text-caption text-grey-6">
          {{ nodes.length }} entries · {{ edges.length }} related links
        </span>

        <q-space />
        <q-btn
          :icon="isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'"
          flat dense round size="sm"
          :color="isFullscreen ? 'grey-4' : 'grey-6'"
          @click="isFullscreen = !isFullscreen"
        />

      </div>

      <!-- Graph -->
      <v-network-graph
        class="col"
        :nodes="vNodes"
        :edges="vEdges"
        :configs="configs"
        :event-handlers="eventHandlers"
      >
        <template #override-node="{ nodeId, scale, config, ...slotProps }">
          <component
            :is="nodeShape(nodeId)"
            v-bind="slotProps"
            :x="-config.radius * scale"
            :y="-config.radius * scale"
            :width="config.radius * 2 * scale"
            :height="config.radius * 2 * scale"
            :r="config.radius * scale"
            :cx="0"
            :cy="0"
            :fill="nodeColor(nodeId)"
            :stroke="nodeBorder(nodeId)"
            stroke-width="2"
          />
        </template>
      </v-network-graph>

      <!-- Tooltip -->
      <q-tooltip
        v-if="hovered"
        :target="false"
        anchor="top middle"
        self="bottom middle"
        :style="`position:fixed;left:${tooltipX}px;top:${tooltipY}px;pointer-events:none;`"
        class="bg-grey-9 text-white text-caption"
        :offset="[0, 8]"
      >
        <div class="text-weight-medium">{{ hovered.title }}</div>
        <div class="text-grey-4">{{ hovered.domain }} · {{ hovered.type }} · {{ hovered.scope }}</div>
      </q-tooltip>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { defineConfigs } from 'v-network-graph'
import { ForceLayout } from 'v-network-graph/lib/force-layout'
import type { EngramGraphNode, EngramGraphEdge } from '../composables/useEngramMonitor'

const props = defineProps<{
  nodes: EngramGraphNode[]
  edges: EngramGraphEdge[]
}>()

// ── Fullscreen toggle ─────────────────────────────────────────────────────────
const isFullscreen = ref(false)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFullscreen.value) isFullscreen.value = false
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// ── Domain color palette ──────────────────────────────────────────────────────
// Deterministic: sorted domain name → index → color. Adding new domains
// gets a new color automatically from the rotation.
const PALETTE = [
  '#42a5f5', // blue
  '#66bb6a', // green
  '#ef5350', // red
  '#ab47bc', // purple
  '#26c6da', // cyan
  '#ffa726', // orange
  '#8d6e63', // brown
  '#26a69a', // teal
  '#ec407a', // pink
  '#78909c', // blue-grey
  '#d4e157', // lime
  '#5c6bc0', // indigo
  '#ff7043', // deep-orange
]

const sortedDomains = computed(() => {
  const domains = [...new Set(props.nodes.map((n) => n.domain))].sort()
  return domains
})

function domainColorFor(domain: string): string {
  const idx = sortedDomains.value.indexOf(domain)
  return PALETTE[idx % PALETTE.length] ?? '#90a4ae'
}

const domainLegend = computed((): [string, string][] =>
  sortedDomains.value.map((d) => [d, domainColorFor(d)]),
)

// ── v-network-graph data ──────────────────────────────────────────────────────
const nodeById = computed<Map<string, EngramGraphNode>>(() => {
  const m = new Map<string, EngramGraphNode>()
  for (const n of props.nodes) m.set(n.id, n)
  return m
})

const vNodes = computed<Record<string, { name: string }>>(() => {
  const out: Record<string, { name: string }> = {}
  for (const n of props.nodes) out[n.id] = { name: n.title }
  return out
})

const vEdges = computed<Record<string, { source: string; target: string }>>(() => {
  const out: Record<string, { source: string; target: string }> = {}
  props.edges.forEach((e, i) => { out[`e${i}`] = { source: e.source, target: e.target } })
  return out
})

// ── Node appearance helpers ───────────────────────────────────────────────────
function nodeColor(nodeId: string): string {
  const n = nodeById.value.get(nodeId)
  return n ? domainColorFor(n.domain) : '#90a4ae'
}

function nodeBorder(nodeId: string): string {
  const n = nodeById.value.get(nodeId)
  if (!n) return '#546e7a'
  // Lessons get a lighter border, gotchas get a darker accent
  return n.type === 'gotcha' ? '#bf360c' : '#0d47a1'
}

function nodeShape(nodeId: string): string {
  const n = nodeById.value.get(nodeId)
  // SVG shape: lessons = circle, gotchas = rect
  return n?.type === 'gotcha' ? 'rect' : 'circle'
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const hovered = ref<EngramGraphNode | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)

const eventHandlers = {
  'node:pointerover': ({ node, event }: { node: string; event: PointerEvent }) => {
    hovered.value = nodeById.value.get(node) ?? null
    tooltipX.value = event.clientX
    tooltipY.value = event.clientY - 40
  },
  'node:pointerout': () => { hovered.value = null },
}

// ── v-network-graph config ────────────────────────────────────────────────────
const configs = defineConfigs({
  view: {
    layoutHandler: new ForceLayout({
      positionFixedByDrag: true,
      positionFixedByClickWithAltKey: true,
      createSimulation: (d3, nodes, edges) => {
        const forceLink = d3.forceLink<{ id: string }, { source: string; target: string }>(edges).id((n) => n.id).distance(80)
        return d3
          .forceSimulation(nodes)
          .force('link', forceLink)
          .force('charge', d3.forceManyBody().strength(-200))
          .force('center', d3.forceCenter().strength(0.05))
          .alphaMin(0.001)
      },
    }),
    scalingObjects: true,
    minZoomLevel: 0.2,
    maxZoomLevel: 4,
  },
  node: {
    normal: {
      radius: (n: { name: string }) => {
        // Use a fixed radius for now — shape distinguishes type
        void n
        return 10
      },
      color: '#90a4ae',  // overridden in #override-node slot
    },
    hover: { radius: 13 },
    label: {
      visible: true,
      fontSize: 9,
      margin: 4,
      direction: 'south',
    },
    selectable: true,
  },
  edge: {
    normal: {
      color: '#90a4ae',
      width: 1.5,
    },
    arrow: {
      target: { type: 'arrow', width: 4, height: 4 },
    },
  },
})
</script>

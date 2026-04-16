<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<!--
  Copyright (c) 2026 WhizBang Developers LLC. All rights reserved.

  LoomPage — Fleet topology view (demo v3.0+, FabricK only).

  Two view modes (toggle available at v3.0+ FabricK):

  PHYSICAL (default) — Option C layout: three horizontal section bands.
    On-Prem  — two rows of 5, centred
    Cloud    — single row, centred
    Remote & IoT — single row, centred
    Edge types:
      Solid grey   — host-to-host WireGuard tunnels (DEMO_HOST_CONNECTIONS)
      Dashed amber — cross-host workload services   (DEMO_WORKLOAD_CONNECTIONS)
    Workload sub-nodes appear below hosts that participate in cross-host connections.

  LOGICAL (v3.0+ only) — Fleet virtual bridge view (internal decision).
    Fleet bridges as hub nodes (centre column), host nodes radiating out.
    Edges show host participation with aggregate weight labels.
    The primitive that replaces K8s CNI + Ingress + MetalLB + Argo Rollouts.
    AI operates these bridges — weights, blue/green, cordon, scale.

  Clicking a host navigates to FabricK and selects that host.
-->
<template>
  <q-page class="q-pa-md">

    <!-- Graph — teleported to <body> in fullscreen to escape layout stacking context -->
    <Teleport to="body" :disabled="!isFullscreen">
      <div :class="isFullscreen ? 'loom-fs-overlay' : ''">
        <q-card flat class="loom-card" :class="{ 'loom-card-fs': isFullscreen }">

          <!-- Fullscreen toolbar (replaces page header while expanded) -->
          <q-card-section v-if="isFullscreen" class="row items-center q-pa-sm q-px-md loom-fs-bar">
            <div>
              <div class="text-subtitle1 text-weight-bold">Loom</div>
              <div class="text-caption text-grey-6">
                {{ viewMode === 'logical'
                  ? 'Fleet virtual bridges — AI-operated routing across the fleet'
                  : 'Fleet topology — host tunnels and cross-host workload services' }}
              </div>
            </div>
            <q-space />
            <!-- View toggle (fullscreen) -->
            <q-btn-toggle
              v-if="hasFleetBridges"
              v-model="viewMode"
              no-caps dense unelevated
              toggle-color="primary"
              :options="[
                { label: 'Tunnels', value: 'physical' },
                { label: 'Fleet Bridges', value: 'logical' },
              ]"
              class="q-mr-md"
              size="sm"
            />
            <!-- Physical legend -->
            <div v-if="viewMode === 'physical'" class="row items-center q-gutter-md q-mr-sm">
              <div class="row items-center" style="gap:6px">
                <svg width="32" height="10"><line x1="0" y1="5" x2="32" y2="5" stroke="#9E9E9E" stroke-width="2"/></svg>
                <span class="text-caption text-grey-7">Host tunnel</span>
              </div>
              <div class="row items-center" style="gap:6px">
                <svg width="32" height="10"><line x1="0" y1="5" x2="32" y2="5" stroke="#FF6B35" stroke-width="2" stroke-dasharray="6 3"/></svg>
                <span class="text-caption text-grey-7">Cross-host service</span>
              </div>
            </div>
            <!-- Logical legend -->
            <div v-else class="row items-center q-gutter-md q-mr-sm">
              <div class="row items-center" style="gap:6px">
                <svg width="32" height="10"><line x1="0" y1="5" x2="32" y2="5" stroke="#C62828" stroke-width="3"/></svg>
                <span class="text-caption text-grey-7">Weighted endpoint</span>
              </div>
              <div class="row items-center" style="gap:6px">
                <svg width="32" height="10"><line x1="0" y1="5" x2="32" y2="5" stroke="#9E9E9E" stroke-width="2" stroke-dasharray="6 4"/></svg>
                <span class="text-caption text-grey-7">Cordoned</span>
              </div>
              <div class="row items-center" style="gap:6px">
                <q-icon name="mdi-robot" size="14px" color="grey-7" />
                <span class="text-caption text-grey-7">AI-operated</span>
              </div>
            </div>
            <q-btn flat dense no-caps icon="mdi-arrow-expand-all" label="Reset view" size="sm" color="grey-7" @click="fitGraph" class="q-mr-sm" />
            <q-btn flat dense round icon="mdi-fullscreen-exit" color="grey-7" @click="toggleFullscreen">
              <q-tooltip>Exit fullscreen</q-tooltip>
            </q-btn>
          </q-card-section>
          <q-separator v-if="isFullscreen" />

          <q-card-section class="q-pa-none loom-graph-wrap">
            <!-- Graph controls overlay (normal mode only) -->
            <div v-if="!isFullscreen" class="loom-graph-controls">
              <q-btn-toggle
                v-if="hasFleetBridges"
                v-model="viewMode"
                no-caps dense unelevated
                toggle-color="primary"
                :options="[
                  { label: 'Tunnels', value: 'physical' },
                  { label: 'Fleet Bridges', value: 'logical' },
                ]"
                class="q-mr-sm"
                size="sm"
              />
              <q-btn flat dense round icon="mdi-arrow-expand-all" size="sm" color="grey-6" @click="fitGraph">
                <q-tooltip>Reset view</q-tooltip>
              </q-btn>
              <q-btn flat dense round icon="mdi-fullscreen" size="sm" color="grey-6" @click="toggleFullscreen">
                <q-tooltip>Fullscreen</q-tooltip>
              </q-btn>
            </div>

            <v-network-graph
              ref="graphRef"
              :nodes="activeNodes"
              :edges="activeEdges"
              :layouts="activeLayouts"
              :configs="graphConfigs"
              :event-handlers="eventHandlers"
              class="loom-graph"
            >
              <!--
                edge-overlay must always be provided so v-network-graph keeps
                hasEdgeOverlaySlot=true; rendering is controlled per edge type.
              -->
              <template #edge-overlay="{ position, edge }">
                <!-- Host-to-host tunnel: solid grey elbow (host = 130×50 → halfW=65, halfH=25) -->
                <template v-if="isHostHostEdge(edge)">
                  <path
                    :d="elbowPath(position.source, position.target, 8, 65, 25, 65, 25)"
                    stroke="#3355bb"
                    stroke-width="6"
                    :stroke-opacity="isEdgeHighlighted(edge) ? 0.28 : 0"
                    vector-effect="non-scaling-stroke"
                    fill="none"
                    class="loom-edge-hl"
                  />
                  <path
                    :d="elbowPath(position.source, position.target, 8, 65, 25, 65, 25)"
                    :stroke="Dark.isActive ? '#757575' : '#9E9E9E'"
                    stroke-width="2"
                    vector-effect="non-scaling-stroke"
                    fill="none"
                  />
                </template>
                <!-- Cross-host workload service: dashed amber elbow (pill = 104×26 → halfW=52, halfH=13) -->
                <template v-else-if="isCrossWorkloadEdge(edge)">
                  <path
                    :d="elbowPath(position.source, position.target, 8, 52, 13, 52, 13)"
                    stroke="#3355bb"
                    stroke-width="6"
                    :stroke-opacity="isEdgeHighlighted(edge) ? 0.28 : 0"
                    vector-effect="non-scaling-stroke"
                    fill="none"
                    class="loom-edge-hl"
                  />
                  <path
                    :d="elbowPath(position.source, position.target, 8, 52, 13, 52, 13)"
                    stroke="#FF6B35"
                    stroke-width="2"
                    stroke-dasharray="6 3"
                    vector-effect="non-scaling-stroke"
                    fill="none"
                  />
                  <polygon
                    :points="elbowArrowHead(position.source, position.target, 52, 13)"
                    fill="#FF6B35"
                  />
                </template>
                <!-- Fleet bridge → host edge: coloured line with weight label -->
                <template v-else-if="isFbEdge(edge)">
                  <line
                    :x1="position.source.x" :y1="position.source.y"
                    :x2="position.target.x" :y2="position.target.y"
                    :stroke="fbEdgeColor(edge)"
                    :stroke-width="fbEdgeWidth(edge)"
                    :stroke-dasharray="isFbEdgeCordoned(edge) ? '6 4' : 'none'"
                    :stroke-opacity="isFbEdgeCordoned(edge) ? 0.4 : 0.8"
                    vector-effect="non-scaling-stroke"
                  />
                  <!-- Weight label at midpoint -->
                  <text
                    :x="(position.source.x + position.target.x) / 2"
                    :y="(position.source.y + position.target.y) / 2 - 8"
                    text-anchor="middle"
                    :fill="Dark.isActive ? '#e0e0e0' : '#424242'"
                    font-size="11"
                    font-weight="bold"
                  >{{ fbEdgeLabel(edge) }}</text>
                </template>
              </template>
            </v-network-graph>
          </q-card-section>

        </q-card>
      </div>
    </Teleport>

    <!-- Fleet bridge detail drawer (logical view only) -->
    <q-drawer
      v-model="fbDrawerOpen"
      side="right"
      overlay
      bordered
      :width="$q.screen.lt.sm ? $q.screen.width : 480"
      :breakpoint="600"
      style="z-index: 2000"
      @hide="selectedFleetBridge = null"
    >
      <FleetBridgePanel
        v-if="selectedFleetBridge"
        :bridge="selectedFleetBridge"
        @close="selectedFleetBridge = null"
      />
    </q-drawer>

  </q-page>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { Dark, useQuasar } from 'quasar'
import { defineConfigs } from 'v-network-graph'
import type { Node, Edge, Edges, NodeEvent } from 'v-network-graph'
import { useRouter } from 'vue-router'
import { useAppStore } from 'src/stores/app'
import { useUiStore } from 'src/stores/ui-store'
import {
  DEMO_HOSTS,
  DEMO_HOST_CONNECTIONS,
  DEMO_WORKLOAD_CONNECTIONS,
  DEMO_FLEET_BRIDGES,
  getDemoVmsForHost,
} from 'src/config/demo'
import type { DemoFleetBridge } from 'src/config/demo'
import { STATUSES } from 'src/constants/vocabularies'
import FleetBridgePanel from 'src/components/fabrick/FleetBridgePanel.vue'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoomNode extends Node {
  _id: string
}

// ── Store / router ────────────────────────────────────────────────────────────

const $q       = useQuasar()
const appStore = useAppStore()
const uiStore  = useUiStore()
const router   = useRouter()

// ── View mode (physical vs logical) ──────────────────────────────────────────

type LoomViewMode = 'physical' | 'logical'
const viewMode = ref<LoomViewMode>('physical')

/** Fleet bridges are available at v3.0+ Fabrick only. */
const hasFleetBridges = computed(() =>
  appStore.isDemoVersionAtLeast('3.0') && appStore.isFabrick
)

// Reset to physical when tier/version changes away from fleet bridge support
watch(hasFleetBridges, (v) => { if (!v) viewMode.value = 'physical' })

// ── Graph ref ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const graphRef = ref<any>(null)
function fitGraph() { graphRef.value?.fitToContents?.() }

const isFullscreen = ref(false)
function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  void nextTick(() => fitGraph())
}

// ── Search ────────────────────────────────────────────────────────────────────

function panToNode(nodeId: string) {
  const pos = graphLayouts.value.nodes[nodeId]
  if (!pos || !graphRef.value) return
  const sizes = graphRef.value.getSizes?.() as { width: number; height: number } | undefined
  if (!sizes) return
  graphRef.value.panTo({
    x: -pos.x * currentZoom.value + sizes.width  / 2,
    y: -pos.y * currentZoom.value + sizes.height / 2,
  })
}

watch(() => uiStore.searchQuery, (q) => {
  if (!q) { selectedNodeId.value = null; return }
  const lower = q.toLowerCase()
  // Match host hostname first, then workload pill names
  const match = Object.entries(graphNodes.value).find(([, node]) =>
    node.name?.toLowerCase().includes(lower)
  )
  if (match) {
    selectedNodeId.value = match[0]
    void nextTick(() => panToNode(match[0]))
  } else {
    selectedNodeId.value = null
  }
})

onUnmounted(() => uiStore.setSearchQuery(''))

// ── Node / edge ID helpers ────────────────────────────────────────────────────

const HOST_PFX = 'host:'
const WL_PFX   = 'wl:'

function hostId(id: string)             { return HOST_PFX + id }
function wlId(host: string, wl: string) { return `${WL_PFX}${host}:${wl}` }

function isHostNode(id: string) { return id.startsWith(HOST_PFX) }
function isWlNode(id: string)   { return id.startsWith(WL_PFX)   }

function nodeKey(node: Node): string { return (node as LoomNode)._id ?? '' }

// ── Edge type helpers ─────────────────────────────────────────────────────────

function isHostHostEdge(edge: Edge): boolean {
  return isHostNode(edge.source) && isHostNode(edge.target)
}
function isCrossWorkloadEdge(edge: Edge): boolean {
  return isWlNode(edge.source) && isWlNode(edge.target)
}

// ── Node hover + zoom tracking (for edge highlight) ──────────────────────────

const selectedNodeId = ref<string | null>(null)
const currentZoom    = ref(1)

function isEdgeHighlighted(edge: Edge): boolean {
  if (!selectedNodeId.value) return false
  return edge.source === selectedNodeId.value || edge.target === selectedNodeId.value
}

// ── Workload status ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  [STATUSES.RUNNING]: '#21BA45',
  [STATUSES.IDLE]:    '#9E9E9E',
  [STATUSES.STOPPED]: '#607D8B',
  [STATUSES.FAILED]:  '#C10015',
  [STATUSES.UNKNOWN]: '#9E9E9E',
}

/** Workloads that appear in cross-host connections are active by definition. */
const activeWorkloads = new Set(
  DEMO_WORKLOAD_CONNECTIONS.flatMap(c => [
    `${c.fromHost}:${c.fromWorkload}`,
    `${c.toHost}:${c.toWorkload}`,
  ])
)

function workloadStatus(host: string, wl: string): string {
  if (activeWorkloads.has(`${host}:${wl}`)) return STATUSES.RUNNING
  return getDemoVmsForHost(host, appStore.effectiveTier).find(v => v.name === wl)?.status ?? STATUSES.UNKNOWN
}

// ── Visible workload sub-nodes ────────────────────────────────────────────────

const visibleWorkloads = computed(() => {
  const set = new Set<string>()
  for (const c of DEMO_WORKLOAD_CONNECTIONS) {
    set.add(`${c.fromHost}:${c.fromWorkload}`)
    set.add(`${c.toHost}:${c.toWorkload}`)
  }
  return set
})

// ── Graph nodes ───────────────────────────────────────────────────────────────

const graphNodes = computed<Record<string, LoomNode>>(() => {
  const out: Record<string, LoomNode> = {}

  for (const h of DEMO_HOSTS) {
    const vmCount = getDemoVmsForHost(h.id, appStore.effectiveTier).length
    const key = hostId(h.id)
    out[key] = { _id: key, name: `${h.hostname}\n${vmCount} workloads` }
  }

  for (const hw of visibleWorkloads.value) {
    const sep  = hw.indexOf(':')
    const host = hw.slice(0, sep)
    const wl   = hw.slice(sep + 1)
    const key  = wlId(host, wl)
    out[key] = { _id: key, name: wl }
  }

  return out
})

// ── Graph edges ───────────────────────────────────────────────────────────────

const graphEdges = computed<Edges>(() => {
  const out: Edges = {}

  // Host-to-host WireGuard tunnels
  for (const c of DEMO_HOST_CONNECTIONS) {
    out[`he:${c.source}:${c.target}`] = { source: hostId(c.source), target: hostId(c.target) }
  }

  // Cross-host workload service edges
  for (let i = 0; i < DEMO_WORKLOAD_CONNECTIONS.length; i++) {
    const c = DEMO_WORKLOAD_CONNECTIONS[i]!
    out[`xe:${i}`] = { source: wlId(c.fromHost, c.fromWorkload), target: wlId(c.toHost, c.toWorkload) }
  }

  return out
})

// ── Layout ─────────────────────────────────────────────────────────────────────
// Three horizontal section bands, each group centred on x=0.
//
//   On-Prem  — rows at y=0 and y=270  (hosts with no kind field)
//   Cloud    — single row at y=540    (kind === 'cloud')
//   Remote & IoT — single row at y=810 (kind === 'remote' | 'iot')
//
// Workload sub-nodes sit WL_DY pixels below their host, spread horizontally.

const WL_DY       =  88   // px from host centre to first pill centre
const WL_STEP     =  36   // px between pill centres (26px height + 10px gap)
const WL_H        =  26   // pill height (keep in sync with node config)
const X_STEP      = 260   // px between hosts
const ONPREM_ROWS = 270   // px between on-prem row 0 and row 1
const SECTION_GAP =  80   // px between bottom of deepest sub-node and next section's host centre

/**
 * Returns the y-coordinate of the bottom edge of the deepest sub-node for
 * a host at `baseY` with `count` visible workload pills.
 */
function sectionFloor(baseY: number, count: number): number {
  // Always reserve at least one pill-row of space so section floors align
  const effective = Math.max(count, 1)
  return baseY + WL_DY + (effective - 1) * WL_STEP + WL_H / 2
}

/** Host centre positions keyed by bare host id. Sections are spaced adaptively. */
const hostPositions = computed<Record<string, { x: number; y: number }>>(() => {
  const pos: Record<string, { x: number; y: number }> = {}

  // Count visible workload sub-nodes per host
  const wlCount = new Map<string, number>()
  for (const hw of visibleWorkloads.value) {
    const host = hw.slice(0, hw.indexOf(':'))
    wlCount.set(host, (wlCount.get(host) ?? 0) + 1)
  }

  const onPrem   = DEMO_HOSTS.filter(h => !h.kind)
  const cloud    = DEMO_HOSTS.filter(h => h.kind === 'cloud')
  const external = DEMO_HOSTS.filter(h => h.kind === 'remote' || h.kind === 'iot')

  // ── On-prem: rows of 5, each row centred ─────────────────────────────────
  onPrem.forEach((h, i) => {
    const row    = Math.floor(i / 5)
    const col    = i % 5
    const rowLen = Math.min(5, onPrem.length - row * 5)
    pos[h.id] = { x: (col - (rowLen - 1) / 2) * X_STEP, y: row * ONPREM_ROWS }
  })

  // Deepest pixel across all on-prem hosts
  const onPremFloor = onPrem.reduce((max, h) => {
    return Math.max(max, sectionFloor(pos[h.id]!.y, wlCount.get(h.id) ?? 0))
  }, 0)

  // ── Cloud ─────────────────────────────────────────────────────────────────
  const cloudY = onPremFloor + SECTION_GAP
  cloud.forEach((h, i) => {
    pos[h.id] = { x: (i - (cloud.length - 1) / 2) * X_STEP, y: cloudY }
  })

  const cloudFloor = cloud.length > 0
    ? cloud.reduce((max, h) => Math.max(max, sectionFloor(cloudY, wlCount.get(h.id) ?? 0)), 0)
    : cloudY + 25

  // ── Remote & IoT ──────────────────────────────────────────────────────────
  const remoteY = cloudFloor + SECTION_GAP
  external.forEach((h, i) => {
    pos[h.id] = { x: (i - (external.length - 1) / 2) * X_STEP, y: remoteY }
  })

  return pos
})

const graphLayouts = computed(() => {
  const pos: Record<string, { x: number; y: number }> = {}

  // Host positions
  for (const [id, p] of Object.entries(hostPositions.value)) {
    pos[hostId(id)] = p
  }

  // Workload sub-nodes — grouped by host, spread horizontally below
  const wlByHost = new Map<string, string[]>()
  for (const hw of visibleWorkloads.value) {
    const sep  = hw.indexOf(':')
    const host = hw.slice(0, sep)
    const wl   = hw.slice(sep + 1)
    if (!wlByHost.has(host)) wlByHost.set(host, [])
    wlByHost.get(host)!.push(wl)
  }

  for (const [host, wls] of wlByHost) {
    const hPos = hostPositions.value[host]
    if (!hPos) continue
    // Stack pills vertically below the host — avoids horizontal crowding entirely
    wls.forEach((wl, i) => {
      pos[wlId(host, wl)] = { x: hPos.x, y: hPos.y + WL_DY + i * WL_STEP }
    })
  }

  return { nodes: pos }
})

// ── Logical view (fleet virtual bridges) ─────────────────────────────────────
// Fleet bridge nodes as hubs, host nodes radiating outward.
// Edges carry aggregate weight labels.

const FB_PFX = 'fb:'

function fbId(name: string) { return FB_PFX + name }
function isFbNode(id: string) { return id.startsWith(FB_PFX) }

/** Colour per fleet bridge — maps to workload group colour from GroupsPage. */
const FB_COLORS: Record<string, string> = {
  'fb-production': '#C62828',   // red-9 (Production)
  'fb-cicd':       '#1565C0',   // blue-9 (CI/CD)
  'fb-data':       '#00796B',   // teal-8 (Data Platform)
  'fb-edge':       '#FF8F00',   // amber-8 (Edge Fleet)
}

/** Hosts that participate in at least one fleet bridge endpoint. */
const fleetHosts = computed(() => {
  const ids = new Set<string>()
  for (const fb of DEMO_FLEET_BRIDGES) {
    for (const ep of fb.endpoints) ids.add(ep.hostId)
  }
  return DEMO_HOSTS.filter(h => ids.has(h.id))
})

/** Aggregate weight per (bridge, host) — sum of all endpoint weights on that host. */
function hostWeightOnBridge(fb: DemoFleetBridge, hostId: string): number {
  return fb.endpoints
    .filter(ep => ep.hostId === hostId)
    .reduce((sum, ep) => sum + ep.weight, 0)
}

/** Whether all endpoints for a host on a bridge are draining (cordoned). */
function isHostCordonedOnBridge(fb: DemoFleetBridge, hId: string): boolean {
  const eps = fb.endpoints.filter(ep => ep.hostId === hId)
  return eps.length > 0 && eps.every(ep => ep.health === 'draining')
}

const logicalNodes = computed<Record<string, LoomNode>>(() => {
  const out: Record<string, LoomNode> = {}

  // Fleet bridge hub nodes
  for (const fb of DEMO_FLEET_BRIDGES) {
    const key = fbId(fb.name)
    const epCount = fb.endpoints.length
    const overlay = fb.overlay === 'vxlan' ? 'VXLAN' : 'WireGuard'
    out[key] = {
      _id: key,
      name: `${fb.label}\n${epCount} endpoints · ${overlay}`,
    }
  }

  // Host nodes (only those participating in fleet bridges)
  for (const h of fleetHosts.value) {
    const key = hostId(h.id)
    const vmCount = getDemoVmsForHost(h.id, appStore.effectiveTier).length
    out[key] = { _id: key, name: `${h.hostname}\n${vmCount} workloads` }
  }

  return out
})

const logicalEdges = computed<Edges>(() => {
  const out: Edges = {}

  for (const fb of DEMO_FLEET_BRIDGES) {
    // Collect unique hosts that have endpoints on this bridge
    const hosts = new Set(fb.endpoints.map(ep => ep.hostId))
    for (const hId of hosts) {
      const weight = hostWeightOnBridge(fb, hId)
      const cordoned = isHostCordonedOnBridge(fb, hId)
      // Store edge with metadata in the key for rendering
      const edgeKey = `fb-edge:${fb.name}:${hId}`
      out[edgeKey] = {
        source: fbId(fb.name),
        target: hostId(hId),
        label: cordoned ? 'cordoned' : `w:${weight}`,
      }
    }
  }

  return out
})

/**
 * Logical layout: fleet bridges in a centre column, hosts arranged in an arc
 * to the right, grouped by kind (on-prem / cloud / remote+iot).
 */
const logicalLayouts = computed(() => {
  const pos: Record<string, { x: number; y: number }> = {}

  // Fleet bridge column — centred vertically, stacked at x=0
  const fbSpacing = 180
  const fbStartY = -(DEMO_FLEET_BRIDGES.length - 1) * fbSpacing / 2
  DEMO_FLEET_BRIDGES.forEach((fb, i) => {
    pos[fbId(fb.name)] = { x: 0, y: fbStartY + i * fbSpacing }
  })

  // Host column — to the right, stacked vertically, centred
  const hostSpacing = 100
  const hosts = fleetHosts.value
  const hostStartY = -(hosts.length - 1) * hostSpacing / 2
  hosts.forEach((h, i) => {
    pos[hostId(h.id)] = { x: 500, y: hostStartY + i * hostSpacing }
  })

  return { nodes: pos }
})

// ── Combined graph data (switches between physical and logical) ──────────────

const activeNodes   = computed(() => viewMode.value === 'logical' ? logicalNodes.value : graphNodes.value)
const activeEdges   = computed(() => viewMode.value === 'logical' ? logicalEdges.value : graphEdges.value)
const activeLayouts = computed(() => viewMode.value === 'logical' ? logicalLayouts.value : graphLayouts.value)

// Refit graph when view mode changes
watch(viewMode, () => void nextTick(() => fitGraph()))

// ── Logical edge type helpers ────────────────────────────────────────────────

function isFbEdge(edge: Edge): boolean {
  return isFbNode(edge.source)
}

/** Parse an fb-edge key like "fb-edge:fb-production:king" → { bridgeName, hostId }. */
function parseFbEdgeKey(edge: Edge): { bridge: DemoFleetBridge | undefined; hId: string } {
  // source is "fb:fb-production", target is "host:king"
  const bridgeName = edge.source.slice(FB_PFX.length)
  const hId = edge.target.slice(HOST_PFX.length)
  return { bridge: DEMO_FLEET_BRIDGES.find(fb => fb.name === bridgeName), hId }
}

function isFbEdgeCordoned(edge: Edge): boolean {
  const { bridge, hId } = parseFbEdgeKey(edge)
  return bridge ? isHostCordonedOnBridge(bridge, hId) : false
}

function fbEdgeColor(edge: Edge): string {
  const { bridge } = parseFbEdgeKey(edge)
  if (!bridge) return '#9E9E9E'
  if (isFbEdgeCordoned(edge)) return '#9E9E9E'
  return FB_COLORS[bridge.name] ?? '#FF6B35'
}

function fbEdgeWidth(edge: Edge): number {
  const { bridge, hId } = parseFbEdgeKey(edge)
  if (!bridge) return 2
  // Scale width by weight proportion (min 2, max 6)
  const weight = hostWeightOnBridge(bridge, hId)
  const maxWeight = Math.max(...bridge.endpoints.map(ep => ep.weight), 1)
  return Math.max(2, Math.round((weight / maxWeight) * 6))
}

function fbEdgeLabel(edge: Edge): string {
  const { bridge, hId } = parseFbEdgeKey(edge)
  if (!bridge) return ''
  if (isHostCordonedOnBridge(bridge, hId)) return '⊘ cordoned'
  const weight = hostWeightOnBridge(bridge, hId)
  return `${weight}%`
}

// ── Node color (shared between normal + hover) ────────────────────────────────

function nodeColor(n: Node): string {
  const id = nodeKey(n)

  // Fleet bridge hub nodes
  if (isFbNode(id)) {
    const fbName = id.slice(FB_PFX.length)
    return FB_COLORS[fbName] ?? '#FF6B35'
  }

  if (isHostNode(id)) {
    const bare = id.slice(HOST_PFX.length)
    const host = DEMO_HOSTS.find(h => h.id === bare)
    if (host?.status === 'degraded') return '#B45309'
    if (host?.status === 'offline')  return '#991B1B'
    // Matches hostKindColor() in FabrickOverviewPage
    switch (host?.kind) {
      case 'cloud':  return '#0288D1'  // light-blue-7
      case 'remote': return '#FF8F00'  // amber-8
      case 'iot':    return '#00897B'  // teal-6
      default:       return '#FF6B35'  // primary (Weaver amber)
    }
  }
  // Workload sub-node
  const rest = id.slice(WL_PFX.length)
  const sep  = rest.indexOf(':')
  return STATUS_COLORS[workloadStatus(rest.slice(0, sep), rest.slice(sep + 1))] ?? '#9E9E9E'
}

// ── Graph configs ─────────────────────────────────────────────────────────────

const graphConfigs = computed(() => defineConfigs({
  view: {
    autoPanAndZoomOnLoad: 'fit-content' as const,
    fitContentMargin: '60px',
  },
  node: {
    normal: {
      type:         () => 'rect' as const,
      radius:       () => 0,
      width:        (n: Node) => {
        const id = nodeKey(n)
        if (isFbNode(id)) return 180
        return isHostNode(id) ? 130 : 104
      },
      height:       (n: Node) => {
        const id = nodeKey(n)
        if (isFbNode(id)) return 56
        return isHostNode(id) ? 50 : 26
      },
      borderRadius: (n: Node) => {
        const id = nodeKey(n)
        if (isFbNode(id)) return 12
        return isHostNode(id) ? 10 : 13
      },
      color: nodeColor,
      strokeWidth: (n: Node) => {
        const id = nodeKey(n)
        if (id === selectedNodeId.value) return 2
        if (id === hostId(appStore.demoSelectedHostId)) return 3
        // Fleet bridge health indicator
        if (isFbNode(id)) {
          const fbName = id.slice(FB_PFX.length)
          const fb = DEMO_FLEET_BRIDGES.find(f => f.name === fbName)
          if (fb?.health === 'degraded') return 2
        }
        return 0
      },
      strokeColor: (n: Node) => {
        const id = nodeKey(n)
        if (id === selectedNodeId.value) return '#ffffff'
        if (isFbNode(id)) {
          const fbName = id.slice(FB_PFX.length)
          const fb = DEMO_FLEET_BRIDGES.find(f => f.name === fbName)
          if (fb?.health === 'degraded') return '#FF8F00'
        }
        return '#1976D2'
      },
    },
    hover: {
      // Keep node color unchanged — feedback is through edge highlights only.
      color: nodeColor,
    },
    label: {
      fontSize:  (n: Node) => {
        const id = nodeKey(n)
        if (isFbNode(id)) return 11
        return isHostNode(id) ? 11 : 10
      },
      color:     () => '#ffffff',
      direction: () => 'center' as const,
    },
    draggable: true,
  },
  edge: {
    // Keep built-in edge strokes invisible — we draw everything in #edge-overlay.
    // Suppress hover color too; highlights are driven by node hover instead.
    normal: { color: () => 'transparent', width: 2 },
    hover:  { color: () => 'transparent' },
    marker: { target: { type: () => 'none' as const } },
  },
}))

// ── SVG path helpers ──────────────────────────────────────────────────────────

/**
 * Orthogonal elbow with rounded corners.
 * Routes vertical-first when |dy| >= |dx| (cross-section edges),
 * horizontal-first when |dx| > |dy| (same-row edges).
 * sHalfW/sHalfH and tHalfW/tHalfH offset the start/end to the node boundary
 * so the path never passes through the node body.
 */
function elbowPath(
  s: { x: number; y: number },
  t: { x: number; y: number },
  r = 8,
  sHalfW = 0, sHalfH = 0,
  tHalfW = 0, tHalfH = 0,
): string {
  const dx0 = t.x - s.x
  const dy0 = t.y - s.y

  // Offset start/end to node boundary along the dominant axis
  let ns = s, nt = t
  if (sHalfW > 0 || sHalfH > 0 || tHalfW > 0 || tHalfH > 0) {
    if (Math.abs(dx0) >= Math.abs(dy0) && Math.abs(dx0) > 0) {
      const sx = Math.sign(dx0)
      ns = { x: s.x + sx * sHalfW, y: s.y }
      nt = { x: t.x - sx * tHalfW, y: t.y }
    } else if (Math.abs(dy0) > 0) {
      const sy = Math.sign(dy0)
      ns = { x: s.x, y: s.y + sy * sHalfH }
      nt = { x: t.x, y: t.y - sy * tHalfH }
    }
  }

  const dx = nt.x - ns.x
  const dy = nt.y - ns.y
  if (Math.abs(dx) < 1 || Math.abs(dy) < 1) return `M ${ns.x} ${ns.y} L ${nt.x} ${nt.y}`

  const rad = Math.min(r, Math.abs(dx) / 2, Math.abs(dy) / 2)

  if (Math.abs(dy) >= Math.abs(dx)) {
    // Vertical-first: exit top/bottom, cross at midY, enter top/bottom
    const midY = (ns.y + nt.y) / 2
    const sx   = dx > 0 ? 1 : -1
    const sy1  = midY >= ns.y ? 1 : -1
    const sy2  = nt.y  >= midY ? 1 : -1
    return [
      `M ${ns.x} ${ns.y}`,
      `L ${ns.x} ${midY - sy1 * rad}`,
      `Q ${ns.x} ${midY} ${ns.x + sx * rad} ${midY}`,
      `L ${nt.x - sx * rad} ${midY}`,
      `Q ${nt.x} ${midY} ${nt.x} ${midY + sy2 * rad}`,
      `L ${nt.x} ${nt.y}`,
    ].join(' ')
  } else {
    // Horizontal-first: exit left/right, cross at midX, enter left/right
    const midX = (ns.x + nt.x) / 2
    const sx1  = midX >= ns.x ? 1 : -1
    const sx2  = nt.x  >= midX ? 1 : -1
    const sy   = dy > 0 ? 1 : -1
    return [
      `M ${ns.x} ${ns.y}`,
      `L ${midX - sx1 * rad} ${ns.y}`,
      `Q ${midX} ${ns.y} ${midX} ${ns.y + sy * rad}`,
      `L ${midX} ${nt.y - sy * rad}`,
      `Q ${midX} ${nt.y} ${midX + sx2 * rad} ${nt.y}`,
      `L ${nt.x} ${nt.y}`,
    ].join(' ')
  }
}

/**
 * Arrowhead aligned with the final segment of the elbow.
 * tHalfW/tHalfH offset the tip to the node boundary (match elbowPath offsets).
 */
function elbowArrowHead(
  s: { x: number; y: number },
  t: { x: number; y: number },
  tHalfW = 0, tHalfH = 0,
): string {
  const dx0 = t.x - s.x
  const dy0 = t.y - s.y

  // Offset tip to node boundary
  let tip = t
  if (Math.abs(dx0) >= Math.abs(dy0) && Math.abs(dx0) > 0) {
    tip = { x: t.x - Math.sign(dx0) * tHalfW, y: t.y }
  } else if (Math.abs(dy0) > 0) {
    tip = { x: t.x, y: t.y - Math.sign(dy0) * tHalfH }
  }

  const dx   = dx0
  const dy   = dy0
  const size = 7, perp = size * 0.6

  if (Math.abs(dy) >= Math.abs(dx)) {
    // Final segment is vertical
    const midY = (s.y + t.y) / 2
    const len  = Math.abs(tip.y - midY)
    if (len < 1) return ''
    const ny = (tip.y - midY) / len
    return [
      `${tip.x - perp},${tip.y - ny * size}`,
      `${tip.x + perp},${tip.y - ny * size}`,
      `${tip.x},${tip.y}`,
    ].join(' ')
  } else {
    // Final segment is horizontal
    const midX = (s.x + t.x) / 2
    const len  = Math.abs(tip.x - midX)
    if (len < 1) return ''
    const nx = (tip.x - midX) / len
    return [
      `${tip.x - nx * size},${tip.y - perp}`,
      `${tip.x - nx * size},${tip.y + perp}`,
      `${tip.x},${tip.y}`,
    ].join(' ')
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────

/** Currently selected fleet bridge (for future drawer integration). */
const selectedFleetBridge = ref<DemoFleetBridge | null>(null)

const fbDrawerOpen = computed({
  get: () => selectedFleetBridge.value !== null,
  set: (val) => { if (!val) selectedFleetBridge.value = null },
})

const eventHandlers = {
  'view:zoom': (zoom: number) => {
    currentZoom.value = zoom
  },
  'node:click': ({ node }: NodeEvent<MouseEvent>) => {
    // Toggle selection — click same node again to deselect
    selectedNodeId.value = selectedNodeId.value === node ? null : node

    // Fleet bridge node click — select for detail drawer
    if (isFbNode(node)) {
      const fbName = node.slice(FB_PFX.length)
      selectedFleetBridge.value = DEMO_FLEET_BRIDGES.find(fb => fb.name === fbName) ?? null
    } else {
      selectedFleetBridge.value = null
    }
  },
  'node:dblclick': ({ node }: NodeEvent<MouseEvent>) => {
    // Fleet bridge nodes don't navigate on double-click
    if (isFbNode(node)) return

    let bareHostId: string | null = null
    if (isHostNode(node)) {
      bareHostId = node.slice(HOST_PFX.length)
    } else if (isWlNode(node)) {
      const rest = node.slice(WL_PFX.length)
      bareHostId = rest.slice(0, rest.indexOf(':'))
    }
    if (bareHostId) {
      appStore.setDemoHost(bareHostId)
      appStore.setFabrickDrill(bareHostId)
      void router.push('/fabrick')
    }
  },
  'view:click': () => {
    selectedNodeId.value = null
    selectedFleetBridge.value = null
  },
}
</script>

<style scoped>
/* ── Edge highlight (node-hover, zoom-gated) ─────────────────────────────────── */
/* stroke-opacity transitions between 0 and 0.28 — driven by isEdgeHighlighted() */
.loom-edge-hl {
  transition: stroke-opacity 0.45s ease;
}

/* ── Normal mode ─────────────────────────────────────────────────────────────── */
.loom-graph {
  width: 100%;
  height: calc(100vh - 120px);
  min-height: 500px;
}

@media (max-width: 599px) {
  .loom-graph { height: calc(100vh - 120px); min-height: 400px; }
}

.loom-graph-wrap {
  position: relative;
}


.loom-graph-controls {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  display: flex;
  gap: 2px;
}

/* ── Fullscreen mode — teleported to <body>, escapes layout stacking context ── */
.loom-fs-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  background: #ffffff;
}

.loom-card { width: 100%; }

.loom-card-fs {
  display: flex;
  flex-direction: column;
  border-radius: 0 !important;
}

.loom-card-fs .loom-graph-wrap {
  flex: 1;
  min-height: 0;
}

.loom-card-fs .loom-graph {
  height: 100%;
}

.loom-fs-bar {
  flex-shrink: 0;
}
</style>

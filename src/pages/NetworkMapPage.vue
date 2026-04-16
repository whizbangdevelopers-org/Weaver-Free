<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <q-page class="q-pa-md">
    <!-- Loading state -->
    <div v-if="loading" class="text-center q-pa-xl">
      <q-spinner-dots size="40px" color="primary" />
      <div class="text-caption text-grey-8 q-mt-sm">Loading network topology...</div>
    </div>

    <!-- Error state -->
    <q-banner v-else-if="error" type="warning" class="q-mb-md" rounded>
      <template #avatar>
        <q-icon name="mdi-alert" color="warning" />
      </template>
      {{ error }}
      <template #action>
        <q-btn flat label="Retry" @click="refresh" />
      </template>
    </q-banner>

    <!-- Empty state -->
    <div v-else-if="nodes.length === 0" class="text-center q-pa-xl">
      <q-icon name="mdi-lan-disconnect" size="80px" color="grey-5" />
      <div class="text-h6 q-mt-md text-grey-8">No VMs on Network</div>
      <div class="text-caption text-grey-8 q-mt-sm">
        Register a VM to see it appear on the network map.
      </div>
    </div>

    <!-- Graph -->
    <q-card v-else flat bordered>
      <q-card-section class="q-pa-none" style="position: relative">
        <div class="graph-label">
          <div class="text-subtitle1 text-dark">
            <q-icon name="mdi-lan" size="20px" class="q-mr-xs" />
            Network Topology
          </div>
          <!-- Legend: route line -->
          <div v-if="isDemoMode() && appStore.isWeaver" class="row items-center q-mt-xs" style="gap: 6px">
            <svg width="28" height="10" style="flex-shrink: 0">
              <line x1="0" y1="5" x2="28" y2="5" :stroke="ROUTE_COLOR" stroke-width="3" stroke-dasharray="6 3" />
            </svg>
            <span class="text-caption text-grey-7">Cross-bridge route</span>
          </div>
          <div v-if="isDemoMode() && appStore.isFabrick && appStore.isDemoVersionAtLeast('3.0') && remoteNodes.length > 0" class="row items-center q-mt-xs" style="gap: 6px">
            <svg width="28" height="10" style="flex-shrink: 0">
              <line x1="0" y1="5" x2="28" y2="5" :stroke="REMOTE_COLOR" stroke-width="2" stroke-dasharray="5 4" />
            </svg>
            <span class="text-caption text-grey-7">Remote Fabrick service</span>
          </div>
        </div>
        <v-network-graph
          :nodes="graphNodes"
          :edges="graphEdges"
          :layouts="graphLayouts"
          :configs="graphConfigs"
          :event-handlers="eventHandlers"
          class="network-graph"
        >
          <!-- Orthogonal elbow edges (all tiers) -->
          <!-- Slot must always be provided so v-network-graph keeps hasEdgeOverlaySlot=true;
               rendering is controlled inside to avoid the slot toggling on/off with tier switches -->
          <template #edge-overlay="{ position, edge }">
            <path
              :d="elbowPath(position.source, position.target, isRouteEdgeData(edge) || isRemoteEdge(edge) ? 'route' : 'infra')"
              :stroke="edgeOverlayColor(edge)"
              :stroke-width="isRouteEdgeData(edge) ? 3 : 2"
              :stroke-dasharray="isRouteEdgeData(edge) ? '6 3' : isRemoteEdge(edge) ? '5 4' : 'none'"
              stroke-linejoin="round"
              fill="none"
            />
            <!-- Directional arrowhead for route and remote edges -->
            <polygon
              v-if="isRouteEdgeData(edge) || isRemoteEdge(edge)"
              :points="arrowheadPoints(position.target)"
              :fill="isRouteEdgeData(edge) ? ROUTE_COLOR : REMOTE_COLOR"
            />
          </template>
        </v-network-graph>
      </q-card-section>
    </q-card>

    <!-- v1.2 teaser for older demo versions -->
    <template v-if="isDemoMode() && !appStore.isDemoVersionAtLeast('1.2')">
      <VersionNag
        version="1.2"
        title="Weaver Topology"
        description="docker0 and podman0 bridge clusters with container nodes — your full network fabric in one map"
        class="q-mt-md"
      />
    </template>

    <!-- Firewall Templates nag (v1.2.0+, demo only) -->
    <template v-if="isDemoMode() && !appStore.isDemoVersionAtLeast('1.2')">
      <VersionNag
        version="1.2"
        title="Firewall Templates"
        description="Profile-based egress rules and nftables zone management — control traffic per bridge, per VM group"
        class="q-mt-sm"
      />
    </template>

    <!-- Demo version feature previews (v1.2+: firewall presets) -->
    <DemoVersionFeatures v-if="isDemoMode()" section="network" />

    <!-- Weaver Management Tabs -->
    <component :is="NetworkMgmtPanel" :bridges="managedBridges" class="q-mt-lg" />
  </q-page>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Dark } from 'quasar'
import { defineConfigs } from 'v-network-graph'
import type { Node, Edge, Edges, NodeEvent } from 'v-network-graph'
import { useNetworkTopology } from 'src/composables/useNetworkTopology'
import { useHostInfo } from 'src/composables/useHostInfo'
import { useTierFeature } from 'src/composables/useTierFeature'
import { useAppStore } from 'stores/app'
import { useSettingsStore } from 'stores/settings-store'
import { isDemoMode, ENTERPRISE_ROUTES, PREMIUM_ROUTES, DEMO_WORKLOAD_CONNECTIONS, DEMO_HOSTS, DEMO_FLEET_BRIDGES, getDemoVmsForHost } from 'src/config/demo'
import { computeElbowPath } from 'src/utils/elbow-routing'
import VersionNag from 'src/components/demo/VersionNag.vue'
import DemoVersionFeatures from 'src/components/demo/DemoVersionFeatures.vue'
import { useResourceDrawerStore } from 'src/stores/resource-drawer-store'
import { useRouter } from 'vue-router'
import type { NetworkNode } from 'src/types/network'
import { STATUSES, TIERS } from 'src/constants/vocabularies'

const drawerStore = useResourceDrawerStore()
const router = useRouter()
const {
  bridges,
  nodes,
  selectedNode,
  loading,
  error,
  selectNode,
  refresh,
} = useNetworkTopology()
const { basicHost } = useHostInfo()
const appStore = useAppStore()
const settingsStore = useSettingsStore()

const NetworkMgmtPanel = useTierFeature({
  minimumTier: TIERS.SOLO,
  loader: () => import('src/components/weaver/NetworkMgmtPanel.vue'),
  featureName: 'Network Management',
  featureDescription: 'Configure bridges, IP pools, firewall rules, and VM networking.',
  features: ['Bridge management', 'IP pool allocation', 'Firewall rules', 'VM network config'],
})

const managedBridges = computed(() =>
  bridges.value.map((b) => ({ name: b.name, subnet: b.subnet, gateway: b.gateway })),
)

const STATUS_COLORS: Record<string, string> = {
  [STATUSES.RUNNING]: '#21BA45',
  [STATUSES.STOPPED]: '#9E9E9E',
  [STATUSES.FAILED]: '#C10015',
  [STATUSES.UNKNOWN]: '#F2C037',
}

const OS_ICONS: Record<string, string> = {
  linux: '\u{1F427}',
  windows: '\u{1FA9F}',
}

/**
 * Find the fleet bridge that has an endpoint using a given local bridge name
 * on the currently selected host (Fabrick v3.0+ only).
 */
function fleetBridgeForLocal(localBridgeName: string): { fbName: string; weight: number } | null {
  if (!isDemoMode() || !appStore.isFabrick || !appStore.isDemoVersionAtLeast('3.0')) return null
  const hostId = appStore.demoSelectedHostId
  for (const fb of DEMO_FLEET_BRIDGES) {
    const eps = fb.endpoints.filter(ep => ep.hostId === hostId && ep.localBridge === localBridgeName)
    if (eps.length > 0) {
      const weight = eps.reduce((sum, ep) => sum + ep.weight, 0)
      return { fbName: fb.name, weight }
    }
  }
  return null
}

const BRIDGE_PREFIX = '_br:'
const CONTAINER_BRIDGE_PREFIX = '_cbr:'
const CONTAINER_NODE_PREFIX = '_ctn:'
const HOST_ID = '_host'
const ROUTE_PREFIX = '_route:'
const REMOTE_NODE_PREFIX = '_rem:'
const REMOTE_COLOR = '#7C3AED'

interface GraphNode extends Node {
  _id: string
}

function isHostNode(id: string): boolean {
  return id === HOST_ID
}

function isBridgeNode(id: string): boolean {
  return id.startsWith(BRIDGE_PREFIX)
}

function isContainerBridgeNode(id: string): boolean {
  return id.startsWith(CONTAINER_BRIDGE_PREFIX)
}

function isContainerNode(id: string): boolean {
  return id.startsWith(CONTAINER_NODE_PREFIX)
}

function isInfraNode(id: string): boolean {
  return isHostNode(id) || isBridgeNode(id) || isContainerBridgeNode(id)
}

function isRemoteNode(id: string): boolean {
  return id.startsWith(REMOTE_NODE_PREFIX)
}

function isRemoteEdge(edge: Edge): boolean {
  return isRemoteNode(edge.source) || isRemoteNode(edge.target)
}


const hostLabel = computed(() => {
  const name = basicHost.value?.hostname ?? 'Host'
  const ip = basicHost.value?.ipAddress ?? bridges.value[0]?.gateway
  return ip ? `${name}\n${ip}` : name
})

const vmBridges = computed(() => bridges.value.filter((b) => b.type !== 'container'))
const containerBridges = computed(() => bridges.value.filter((b) => b.type === 'container'))
const vmNodes = computed(() => nodes.value.filter((n) => n.nodeType !== 'container'))
const containerNodes = computed(() => nodes.value.filter((n) => n.nodeType === 'container'))

interface RemoteNodeInfo { key: string; hostId: string; hostname: string; workload: string; status: string }

const remoteNodes = computed<RemoteNodeInfo[]>(() => {
  if (!isDemoMode() || !appStore.isFabrick || !appStore.isDemoVersionAtLeast('3.0')) return []
  const hostId = appStore.demoSelectedHostId
  const seen = new Set<string>()
  const result: RemoteNodeInfo[] = []
  for (const c of DEMO_WORKLOAD_CONNECTIONS) {
    let remHostId: string, remWl: string
    if (c.fromHost === hostId)      { remHostId = c.toHost;   remWl = c.toWorkload   }
    else if (c.toHost === hostId)   { remHostId = c.fromHost; remWl = c.fromWorkload }
    else continue
    const key = `${remHostId}:${remWl}`
    if (seen.has(key)) continue
    seen.add(key)
    const h = DEMO_HOSTS.find(h => h.id === remHostId)
    const status = getDemoVmsForHost(remHostId, appStore.effectiveTier).find(v => v.name === remWl)?.status ?? STATUSES.UNKNOWN
    result.push({ key, hostId: remHostId, hostname: h?.hostname ?? remHostId, workload: remWl, status })
  }
  return result
})

const graphNodes = computed<Record<string, GraphNode>>(() => {
  const result: Record<string, GraphNode> = {
    [HOST_ID]: { _id: HOST_ID, name: hostLabel.value },
  }
  // VM bridge nodes
  for (const br of vmBridges.value) {
    const key = BRIDGE_PREFIX + br.name
    const fb = fleetBridgeForLocal(br.name)
    const fbSuffix = fb ? `\n⇡ ${fb.fbName} (${fb.weight}%)` : ''
    const defaultSuffix = br.name === 'br-microvm' ? '\nDefault bridge' : ''
    result[key] = { _id: key, name: `${br.name}\n${br.subnet}${defaultSuffix}${fbSuffix}` }
  }
  // VM nodes
  for (const node of vmNodes.value) {
    const osIcon = node.guestOs ? OS_ICONS[node.guestOs] ?? '' : ''
    result[node.name] = {
      _id: node.name,
      name: `${osIcon ? osIcon + ' ' : ''}${node.name}\n${node.ip}`,
    }
  }
  // Container bridge nodes
  for (const br of containerBridges.value) {
    const key = CONTAINER_BRIDGE_PREFIX + br.name
    const icon = br.runtime === 'docker' ? '\u{1F433}' : '\u{1F404}'
    result[key] = { _id: key, name: `${icon} ${br.name}\n${br.subnet}` }
  }
  // Container nodes
  for (const node of containerNodes.value) {
    const ports = node.servicePorts?.join(' ') ?? ''
    result[CONTAINER_NODE_PREFIX + node.name] = {
      _id: CONTAINER_NODE_PREFIX + node.name,
      name: `${node.name}${ports ? '\n' + ports : ''}`,
    }
  }
  // Remote workload nodes (Fabrick + demo v3.0+)
  for (const rn of remoteNodes.value) {
    const id = REMOTE_NODE_PREFIX + rn.key
    result[id] = { _id: id, name: `${rn.hostname}\n${rn.workload}` }
  }
  return result
})

const graphEdges = computed<Edges>(() => {
  const result: Edges = {}
  // Host → VM Bridge edges
  for (const br of vmBridges.value) {
    result[`edge-host-${br.name}`] = {
      source: HOST_ID,
      target: BRIDGE_PREFIX + br.name,
    }
  }
  // VM Bridge → VM edges
  for (const node of vmNodes.value) {
    const bridgeName = node.bridge ?? vmBridges.value[0]?.name ?? 'bridge'
    result[`edge-${node.name}`] = {
      source: BRIDGE_PREFIX + bridgeName,
      target: node.name,
    }
  }
  // Host → Container Bridge edges
  for (const br of containerBridges.value) {
    result[`edge-host-${br.name}`] = {
      source: HOST_ID,
      target: CONTAINER_BRIDGE_PREFIX + br.name,
    }
  }
  // Container Bridge → Container Node edges
  for (const node of containerNodes.value) {
    result[`edge-ctn-${node.name}`] = {
      source: CONTAINER_BRIDGE_PREFIX + (node.bridge ?? 'docker0'),
      target: CONTAINER_NODE_PREFIX + node.name,
    }
  }
  // Cross-bridge routing edges (demo data — production routes come from plugins)
  if (isDemoMode() && appStore.isWeaver) {
    const routes = appStore.effectiveTier === TIERS.FABRICK ? ENTERPRISE_ROUTES : PREMIUM_ROUTES
    const vmNames = new Set(vmNodes.value.map((n) => n.name))
    for (const route of routes) {
      if (vmNames.has(route.source) && vmNames.has(route.target)) {
        result[ROUTE_PREFIX + `${route.source}-${route.target}`] = {
          source: route.source,
          target: route.target,
        }
      }
    }
  }
  // Remote workload connections (Fabrick + demo v3.0+)
  if (isDemoMode() && appStore.isFabrick && appStore.isDemoVersionAtLeast('3.0')) {
    const hostId = appStore.demoSelectedHostId
    const vmNames = new Set(vmNodes.value.map((n) => n.name))
    for (const c of DEMO_WORKLOAD_CONNECTIONS) {
      let localWl: string, remHostId: string, remWl: string
      if (c.fromHost === hostId)    { localWl = c.fromWorkload; remHostId = c.toHost;   remWl = c.toWorkload   }
      else if (c.toHost === hostId) { localWl = c.toWorkload;   remHostId = c.fromHost; remWl = c.fromWorkload }
      else continue
      if (!vmNames.has(localWl)) continue
      const remKey = `${remHostId}:${remWl}`
      result[`_remconn:${localWl}-${remKey}`] = { source: localWl, target: REMOTE_NODE_PREFIX + remKey }
    }
  }
  return result
})

const graphLayouts = computed(() => {
  const positions: Record<string, { x: number; y: number }> = {}
  const LAYER_GAP = 160
  const VM_SPACING = 100
  const BRIDGE_GAP = 60

  // Group VMs by bridge
  const vmsByBridge = new Map<string, typeof vmNodes.value>()
  for (const br of vmBridges.value) {
    vmsByBridge.set(br.name, [])
  }
  for (const node of vmNodes.value) {
    const brName = node.bridge ?? vmBridges.value[0]?.name ?? 'bridge'
    const list = vmsByBridge.get(brName)
    if (list) list.push(node)
    else vmsByBridge.set(brName, [node])
  }

  // Calculate width each VM bridge group needs
  const MIN_GROUP_WIDTH = 160
  const vmBridgeOrder = [...vmsByBridge.keys()]
  const vmGroupWidths = vmBridgeOrder.map(
    (brName) => Math.max(MIN_GROUP_WIDTH, vmsByBridge.get(brName)!.length * VM_SPACING),
  )
  const vmTotalWidth =
    vmGroupWidths.reduce((s, w) => s + w, 0) +
    Math.max(0, vmBridgeOrder.length - 1) * BRIDGE_GAP

  // Group container nodes by bridge
  const containersByBridge = new Map<string, typeof containerNodes.value>()
  for (const br of containerBridges.value) {
    containersByBridge.set(br.name, [])
  }
  for (const node of containerNodes.value) {
    const brName = node.bridge ?? 'docker0'
    const list = containersByBridge.get(brName)
    if (list) list.push(node)
    else containersByBridge.set(brName, [node])
  }

  const ctnBridgeOrder = [...containersByBridge.keys()]
  const ctnGroupWidths = ctnBridgeOrder.map(
    (brName) => Math.max(MIN_GROUP_WIDTH, containersByBridge.get(brName)!.length * VM_SPACING),
  )
  const ctnTotalWidth =
    ctnGroupWidths.reduce((s, w) => s + w, 0) +
    Math.max(0, ctnBridgeOrder.length - 1) * BRIDGE_GAP

  const totalWidth = Math.max(vmTotalWidth + ctnTotalWidth + (ctnBridgeOrder.length > 0 ? BRIDGE_GAP * 2 : 0), MIN_GROUP_WIDTH)

  const vmsLeft = settingsStore.topologyVmsSide === 'left'

  function placeVmGroups(startX: number): number {
    let x = startX
    for (let i = 0; i < vmBridgeOrder.length; i++) {
      const brName = vmBridgeOrder[i]!
      const width = vmGroupWidths[i]!
      const bridgeX = x + width / 2
      positions[BRIDGE_PREFIX + brName] = { x: bridgeX, y: LAYER_GAP }
      const vms = vmsByBridge.get(brName)!
      const vmStartX = bridgeX - ((vms.length - 1) * VM_SPACING) / 2
      for (let j = 0; j < vms.length; j++) {
        positions[vms[j]!.name] = { x: vmStartX + j * VM_SPACING, y: LAYER_GAP * 2 }
      }
      x += width + BRIDGE_GAP
    }
    return x
  }

  function placeCtnGroups(startX: number): number {
    let x = startX
    for (let i = 0; i < ctnBridgeOrder.length; i++) {
      const brName = ctnBridgeOrder[i]!
      const width = ctnGroupWidths[i]!
      const bridgeX = x + width / 2
      positions[CONTAINER_BRIDGE_PREFIX + brName] = { x: bridgeX, y: LAYER_GAP }
      const ctns = containersByBridge.get(brName)!
      const ctnStartX = bridgeX - ((ctns.length - 1) * VM_SPACING) / 2
      for (let j = 0; j < ctns.length; j++) {
        positions[CONTAINER_NODE_PREFIX + ctns[j]!.name] = {
          x: ctnStartX + j * VM_SPACING,
          y: LAYER_GAP * 2,
        }
      }
      x += width + BRIDGE_GAP
    }
    return x
  }

  let x = -totalWidth / 2
  if (vmsLeft) {
    x = placeVmGroups(x)
    if (ctnBridgeOrder.length > 0) {
      x += BRIDGE_GAP
      placeCtnGroups(x)
    }
  } else {
    if (ctnBridgeOrder.length > 0) {
      x = placeCtnGroups(x)
      x += BRIDGE_GAP
    }
    placeVmGroups(x)
  }

  // Host centered at top
  positions[HOST_ID] = { x: 0, y: 0 }

  // Remote nodes — row below local VMs
  const rns = remoteNodes.value
  if (rns.length > 0) {
    const remStartX = -((rns.length - 1) * VM_SPACING) / 2
    for (let i = 0; i < rns.length; i++) {
      positions[REMOTE_NODE_PREFIX + rns[i]!.key] = {
        x: remStartX + i * VM_SPACING,
        y: LAYER_GAP * 3.5,
      }
    }
  }

  return { nodes: positions }
})

function nodeId(node: Node): string {
  return (node as GraphNode)._id ?? ''
}

/** Route edges connect local VM→VM (neither side is infra or remote) */
function isRouteEdgeData(edge: Edge): boolean {
  return !isInfraNode(edge.source) && !isInfraNode(edge.target)
    && !isContainerNode(edge.source) && !isContainerNode(edge.target)
    && !isRemoteNode(edge.source) && !isRemoteNode(edge.target)
}

const ROUTE_COLOR = '#FF6B35' // product amber — cross-bridge traffic

/** Elbow routing is always on — orthogonal edges across all tiers. */

/** Alias for template — avoids name collision with the imported function. */
const elbowPath = computeElbowPath

function edgeOverlayColor(edge: Edge): string {
  if (isRouteEdgeData(edge)) return ROUTE_COLOR
  if (isRemoteEdge(edge)) return REMOTE_COLOR
  return Dark.isActive ? '#616161' : '#bdbdbd'
}

function arrowheadPoints(target: { x: number; y: number }): string {
  const size = 6
  const { x, y } = target
  return `${x - size},${y - size * 1.5} ${x + size},${y - size * 1.5} ${x},${y}`
}

const graphConfigs = computed(() =>
  defineConfigs({
    view: {
      autoPanAndZoomOnLoad: 'fit-content' as const,
      fitContentMargin: '40px',
    },
    node: {
      normal: {
        type: (node: Node) => (isInfraNode(nodeId(node)) ? 'rect' : 'circle'),
        radius: 16,
        width: (node: Node) => {
          const id = nodeId(node)
          if (isHostNode(id)) return 120
          if (isBridgeNode(id)) return 140
          if (isContainerBridgeNode(id)) return 140
          return 32
        },
        height: (node: Node) => {
          const id = nodeId(node)
          if (isHostNode(id)) return 50
          if (isBridgeNode(id)) return 44
          if (isContainerBridgeNode(id)) return 44
          return 32
        },
        borderRadius: (node: Node) => {
          const id = nodeId(node)
          if (isHostNode(id)) return 10
          if (isBridgeNode(id)) return 8
          if (isContainerBridgeNode(id)) return 8
          return 16
        },
        color: (node: Node) => {
          const id = nodeId(node)
          if (isHostNode(id)) return '#0D47A1'
          if (isBridgeNode(id)) return '#1976D2'
          if (isContainerBridgeNode(id)) return '#00796B'
          if (isRemoteNode(id)) {
            const rn = remoteNodes.value.find(r => REMOTE_NODE_PREFIX + r.key === id)
            return STATUS_COLORS[rn?.status ?? STATUSES.UNKNOWN] ?? '#9E9E9E'
          }
          if (isContainerNode(id)) {
            const name = id.slice(CONTAINER_NODE_PREFIX.length)
            const n = containerNodes.value.find((nd) => nd.name === name)
            return n?.status === STATUSES.RUNNING ? '#80CBC4' : '#B0BEC5'
          }
          const n = nodes.value.find((nd) => nd.name === id)
          return n ? (STATUS_COLORS[n.status] ?? '#9E9E9E') : '#9E9E9E'
        },
        strokeWidth: (node: Node) => {
          const id = nodeId(node)
          if (isContainerNode(id)) return id === CONTAINER_NODE_PREFIX + selectedNode.value ? 3 : 0
          return id === selectedNode.value ? 3 : 0
        },
        strokeColor: '#1976D2',
      },
      label: {
        fontSize: (node: Node) => {
          const id = nodeId(node)
          if (isInfraNode(id)) return 10
          if (isContainerNode(id)) return 9
          return 11
        },
        color: (node: Node) => {
          const id = nodeId(node)
          if (isInfraNode(id)) return '#ffffff'
          if (isContainerNode(id)) return Dark.isActive ? '#cfd8dc' : '#37474F'
          return Dark.isActive ? '#e0e0e0' : '#555'
        },
        direction: (node: Node) => (isInfraNode(nodeId(node)) ? 'center' : 'south'),
      },
      draggable: true,
    },
    edge: {
      normal: {
        color: () => 'transparent',  // elbow overlay handles rendering
        width: (edge: Edge) => isRouteEdgeData(edge) ? 1.5 : 2,
        dasharray: (edge: Edge) => isRouteEdgeData(edge) ? '6 3' : 0,
        animate: false,
        animationSpeed: 50,
      },
      marker: {
        target: {
          type: () => 'none',  // elbow overlay handles arrowheads
          width: 5,
          height: 5,
          margin: -1,
          offset: 0,
          units: 'strokeWidth',
          color: null,
        },
      },
    },
  }),
)

const eventHandlers = {
  'node:click': ({ node }: NodeEvent<MouseEvent>) => {
    if (isInfraNode(node)) {
      // Build a synthetic NetworkNode for infra nodes
      const syntheticNode: NetworkNode = buildInfraNode(node)
      drawerStore.openNetworkNode(syntheticNode)
      return
    }
    if (isContainerNode(node)) {
      const name = node.slice(CONTAINER_NODE_PREFIX.length)
      const networkNode = nodes.value.find(n => n.name === name && n.nodeType === 'container')
      if (networkNode) drawerStore.openNetworkNode(networkNode)
      return
    }
    if (isRemoteNode(node)) {
      // Navigate to Fabrick and select the remote host
      const key = node.slice(REMOTE_NODE_PREFIX.length)  // e.g. 'vault:auth-server'
      const remHostId = key.slice(0, key.indexOf(':'))
      appStore.setDemoHost(remHostId)
      void router.push('/fabrick')
      return
    }
    // VM node
    drawerStore.openVm(node)
    selectNode(node === selectedNode.value ? null : node)
  },
  'node:dblclick': ({ node }: NodeEvent<MouseEvent>) => {
    if (isInfraNode(node) || isContainerNode(node) || isRemoteNode(node)) return
    // VM double-click: also open drawer (single-click already does it)
    drawerStore.openVm(node)
  },
}

function buildInfraNode(id: string): NetworkNode {
  if (isHostNode(id)) {
    return {
      name: 'Host',
      ip: basicHost.value?.ipAddress ?? bridges.value[0]?.gateway ?? '',
      status: STATUSES.RUNNING,
      hypervisor: '',
    }
  }
  if (isBridgeNode(id)) {
    const bridgeName = id.slice(BRIDGE_PREFIX.length)
    const bridge = bridges.value.find(b => b.name === bridgeName)
    return {
      name: bridgeName,
      ip: bridge?.gateway ?? '',
      bridge: bridge?.subnet,
      status: STATUSES.RUNNING,
      hypervisor: '',
    }
  }
  // Container bridge
  const bridgeName = id.slice(CONTAINER_BRIDGE_PREFIX.length)
  const bridge = bridges.value.find(b => b.name === bridgeName)
  return {
    name: bridgeName,
    ip: bridge?.gateway ?? '',
    bridge: bridge?.subnet,
    status: STATUSES.RUNNING,
    hypervisor: '',
    containerRuntime: bridge?.runtime,
  }
}
</script>

<style scoped>
.network-graph {
  width: 100%;
  height: 520px;
}

.graph-label {
  position: absolute;
  top: 8px;
  left: 10px;
  z-index: 1;
  pointer-events: none;
}

@media (max-width: 599px) {
  .network-graph {
    height: 400px;
  }
}
</style>

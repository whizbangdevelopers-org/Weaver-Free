// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { networkApiService } from 'src/services/api'
import { useNetworkStore } from 'src/stores/network-store'
import { useAppStore } from 'src/stores/app'
import { acquireWs, onWsMessage, onWsConnect, onWsDisconnect, isWsConnected } from 'src/services/ws'
import type { WorkloadInfo } from 'src/types/workload'
import type { BridgeInfo, NetworkNode } from 'src/types/network'
import { extractErrorMessage } from 'src/utils/error'
import { isDemoMode } from 'src/config/demo-mode'
import { getDemoVmsForHost, getDemoContainersForTier } from 'src/config/demo'
import { STATUSES } from 'src/constants/vocabularies'

export function useNetworkTopology() {
  const store = useNetworkStore()
  const appStore = useAppStore()
  const loading = ref(true)
  const error = ref<string | null>(null)
  const connected = ref(false)

  let releaseWs: (() => void) | null = null
  let removeMessageHandler: (() => void) | null = null
  let removeConnectHandler: (() => void) | null = null
  let removeDisconnectHandler: (() => void) | null = null

  async function fetchTopology() {
    try {
      loading.value = true
      error.value = null

      if (isDemoMode()) {
        const vms = getDemoVmsForHost(appStore.demoSelectedHostId, appStore.effectiveTier)

        // Derive bridges from VM bridge assignments
        const bridgeMap = new Map<string, BridgeInfo>()
        for (const vm of vms) {
          const brName = vm.bridge ?? 'br-microvm'
          if (!bridgeMap.has(brName)) {
            const parts = vm.ip.split('.')
            bridgeMap.set(brName, {
              name: brName,
              gateway: `${parts[0]}.${parts[1]}.${parts[2]}.1`,
              subnet: `${parts[0]}.${parts[1]}.${parts[2]}.0/24`,
            })
          }
        }

        const nodes: NetworkNode[] = vms.map((vm) => ({
          name: vm.name,
          ip: vm.ip,
          status: vm.status,
          hypervisor: vm.hypervisor,
          distro: vm.distro,
          bridge: vm.bridge,
          mem: vm.mem,
          vcpu: vm.vcpu,
          uptime: vm.uptime,
          description: vm.description,
          tags: vm.tags,
          autostart: vm.autostart,
          vmType: vm.vmType,
        }))

        // v1.2: Container bridge clusters (docker0/podman0)
        if (appStore.isDemoVersionAtLeast('1.2')) {
          const containers = getDemoContainersForTier(appStore.effectiveTier)
          const hostContainers = containers.filter(
            (c) => c.runtime === 'docker' || c.runtime === 'podman',
          )
          const dockerContainers = hostContainers.filter((c) => c.runtime === 'docker')
          const podmanContainers = hostContainers.filter((c) => c.runtime === 'podman')

          if (dockerContainers.length > 0) {
            bridgeMap.set('docker0', {
              name: 'docker0',
              gateway: '172.17.0.1',
              subnet: '172.17.0.0/16',
              type: 'container',
              runtime: 'docker',
            })
          }
          if (podmanContainers.length > 0) {
            bridgeMap.set('podman0', {
              name: 'podman0',
              gateway: '10.88.0.1',
              subnet: '10.88.0.0/16',
              type: 'container',
              runtime: 'podman',
            })
          }

          let dockerIpCounter = 2
          let podmanIpCounter = 2
          for (const c of dockerContainers) {
            const ip = `172.17.0.${dockerIpCounter++}`
            const servicePorts = (c.ports ?? [])
              .slice(0, 3)
              .map((p) => (p.protocol === 'udp' ? `:${p.hostPort}/udp` : `:${p.hostPort}`))
            nodes.push({
              name: c.name,
              ip,
              status: c.status === STATUSES.RUNNING ? STATUSES.RUNNING : STATUSES.STOPPED,
              hypervisor: 'container',
              bridge: 'docker0',
              nodeType: 'container',
              containerRuntime: 'docker',
              servicePorts,
            })
          }
          for (const c of podmanContainers) {
            const ip = `10.88.0.${podmanIpCounter++}`
            const servicePorts = (c.ports ?? [])
              .slice(0, 3)
              .map((p) => (p.protocol === 'udp' ? `:${p.hostPort}/udp` : `:${p.hostPort}`))
            nodes.push({
              name: c.name,
              ip,
              status: c.status === STATUSES.RUNNING ? STATUSES.RUNNING : STATUSES.STOPPED,
              hypervisor: 'container',
              bridge: 'podman0',
              nodeType: 'container',
              containerRuntime: 'podman',
              servicePorts,
            })
          }
        }

        store.setBridges(Array.from(bridgeMap.values()))
        store.updateNodes(nodes)
        connected.value = true
        return
      }

      const topology = await networkApiService.getTopology()
      store.setBridges(topology.bridges)
      store.updateNodes(topology.nodes)
    } catch (err) {
      error.value = extractErrorMessage(err, 'Failed to load topology')
    } finally {
      loading.value = false
    }
  }

  function handleMessage(msg: Record<string, unknown>) {
    if (msg.type === 'vm-status') {
      const vms = msg.data as WorkloadInfo[]
      const nodes: NetworkNode[] = vms.map((vm) => ({
        name: vm.name,
        ip: vm.ip,
        status: vm.status,
        hypervisor: vm.hypervisor,
        distro: vm.distro,
        bridge: vm.bridge,
        mem: vm.mem,
        vcpu: vm.vcpu,
        uptime: vm.uptime,
        description: vm.description,
        tags: vm.tags,
        autostart: vm.autostart,
      }))
      store.updateNodes(nodes)
    }
  }

  // Re-derive topology when tier, version, or selected host switches in demo mode
  if (isDemoMode()) {
    watch(() => [appStore.effectiveTier, appStore.demoVersion, appStore.demoSelectedHostId], () => {
      void fetchTopology()
    })
  }

  onMounted(async () => {
    if (isDemoMode()) {
      connected.value = true
      await fetchTopology()
      return
    }
    connected.value = isWsConnected()
    removeMessageHandler = onWsMessage(handleMessage)
    removeConnectHandler = onWsConnect(() => { connected.value = true })
    removeDisconnectHandler = onWsDisconnect(() => { connected.value = false })
    releaseWs = acquireWs()
    await fetchTopology()
  })

  onUnmounted(() => {
    removeMessageHandler?.()
    removeConnectHandler?.()
    removeDisconnectHandler?.()
    releaseWs?.()
  })

  return {
    bridges: computed(() => store.bridges),
    nodes: computed(() => store.nodes),
    selectedNode: computed(() => store.selectedNode),
    isWeaver: computed(() => appStore.isWeaver),
    loading,
    error,
    connected,
    selectNode: (name: string | null) => store.selectNode(name),
    refresh: fetchTopology,
  }
}

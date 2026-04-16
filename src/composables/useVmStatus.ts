// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue'
import type { WorkloadInfo } from 'src/types/workload'
import { acquireWs, onWsMessage, onWsConnect, onWsDisconnect, isWsConnected } from 'src/services/ws'
import { isDemoMode, getDemoVmsForTier, getDemoVmsForHost } from 'src/config/demo'
import { useAppStore } from 'src/stores/app'

function loadDemoVms(appStore: ReturnType<typeof useAppStore>, vms: Ref<WorkloadInfo[]>, connected: Ref<boolean>, lastUpdate: Ref<string | null>) {
  const isFabrick = appStore.isDemoVersionAtLeast('3.0') && appStore.isFabrick
  const data = isFabrick
    ? getDemoVmsForHost(appStore.demoSelectedHostId, appStore.effectiveTier)
    : getDemoVmsForTier(appStore.effectiveTier)
  vms.value = JSON.parse(JSON.stringify(data)) as WorkloadInfo[]
  connected.value = true
  lastUpdate.value = new Date().toISOString()
}

export function useWorkloadStatus() {
  const vms = ref<WorkloadInfo[]>([])
  const connected = ref(false)
  const lastUpdate = ref<string | null>(null)

  // Demo mode: use per-host VMs in Fabrick mode, tier VMs otherwise.
  // Reacts to tier switches and host selection changes.
  if (isDemoMode()) {
    const appStore = useAppStore()

    onMounted(() => {
      loadDemoVms(appStore, vms, connected, lastUpdate)
    })

    watch(
      () => [appStore.effectiveTier, appStore.demoSelectedHostId] as const,
      () => { loadDemoVms(appStore, vms, connected, lastUpdate) }
    )

    return { vms, connected, lastUpdate }
  }

  let releaseWs: (() => void) | null = null
  let removeMessageHandler: (() => void) | null = null
  let removeConnectHandler: (() => void) | null = null
  let removeDisconnectHandler: (() => void) | null = null

  function handleMessage(msg: Record<string, unknown>) {
    if (msg.type === 'vm-status') {
      vms.value = msg.data as WorkloadInfo[]
      lastUpdate.value = msg.timestamp as string
    } else if (msg.type === 'vm-provisioning') {
      const provEvent = msg.data as {
        name: string
        state: string
        progress?: string
        error?: string
      }
      const vm = vms.value.find(v => v.name === provEvent.name)
      if (vm) {
        vm.provisioningState = provEvent.state as WorkloadInfo['provisioningState']
        vm.provisioningError = provEvent.error
      }
    }
  }

  onMounted(() => {
    connected.value = isWsConnected()
    removeMessageHandler = onWsMessage(handleMessage)
    removeConnectHandler = onWsConnect(() => { connected.value = true })
    removeDisconnectHandler = onWsDisconnect(() => { connected.value = false })
    releaseWs = acquireWs()
  })

  onUnmounted(() => {
    removeMessageHandler?.()
    removeConnectHandler?.()
    removeDisconnectHandler?.()
    releaseWs?.()
  })

  return { vms, connected, lastUpdate }
}

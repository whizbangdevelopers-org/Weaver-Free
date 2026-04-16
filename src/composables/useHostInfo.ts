// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { ref, computed } from 'vue'
import { hostApiService } from 'src/services/api'
import { useAppStore } from 'src/stores/app'
import { extractErrorMessage } from 'src/utils/error'
import { isDemoMode } from 'src/config/demo'
import type { HostDetailedInfo } from 'src/types/host'

export function useHostInfo() {
  const appStore = useAppStore()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const detailed = ref<HostDetailedInfo | null>(null)

  async function fetchDetailed() {
    loading.value = true
    error.value = null
    try {
      if (isDemoMode()) {
        detailed.value = {
          nixosVersion: '25.11.20260203.e576e3c (Xantusia)',
          cpuTopology: { sockets: 1, coresPerSocket: 4, threadsPerCore: 2, virtualizationType: 'VT-x', l1dCache: '128 KiB (4 instances)', l1iCache: '128 KiB (4 instances)', l2Cache: '1 MiB (4 instances)', l3Cache: '10 MiB (1 instance)' },
          diskUsage: [
            { filesystem: '/dev/sdb2', mountPoint: '/', sizeHuman: '915G', usedHuman: '547G', availHuman: '322G', usePercent: 63 },
            { filesystem: '/dev/sdb2', mountPoint: '/nix/store', sizeHuman: '915G', usedHuman: '547G', availHuman: '322G', usePercent: 63 },
          ],
          networkInterfaces: [
            { name: 'enp10s2f0', state: 'UP', macAddress: '6c:b3:11:9d:16:4c' },
            { name: 'enp10s2f1', state: 'UP', macAddress: '6c:b3:11:9d:16:4d' },
            { name: 'enp0s25', state: 'DOWN', macAddress: '48:4d:7e:db:c3:21' },
          ],
          liveMetrics: { freeMemMb: 1053, loadAvg1: 13.29, loadAvg5: 12.89, loadAvg15: 9.14 },
        } as HostDetailedInfo
        return
      }
      detailed.value = await hostApiService.getDetailed()
    } catch (err) {
      error.value = extractErrorMessage(err, 'Failed to load host details')
    } finally {
      loading.value = false
    }
  }

  const warnings = computed(() => {
    const host = appStore.host
    if (!host) return []
    const w: { level: 'warning' | 'info'; message: string }[] = []
    if (!host.kvmAvailable) {
      w.push({ level: 'warning', message: 'KVM not detected \u2014 VMs will run without hardware acceleration' })
    }
    if (host.arch === 'aarch64') {
      w.push({ level: 'info', message: 'aarch64 host \u2014 x86_64 VM images will be emulated (slower)' })
    }
    if (host.totalMemMb < 4096) {
      const maxVms = Math.max(1, Math.floor(host.totalMemMb / 2048))
      w.push({
        level: 'warning',
        message: `${Math.round(host.totalMemMb / 1024)} GB RAM \u2014 recommend no more than ${maxVms} concurrent VM(s)`,
      })
    }
    return w
  })

  return {
    basicHost: computed(() => appStore.host),
    detailed,
    loading,
    error,
    warnings,
    fetchDetailed,
  }
}

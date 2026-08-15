// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { ref, computed, onBeforeUnmount } from 'vue'
import { workloadMetricsService } from 'src/services/api'
import { isDemoMode } from 'src/config/demo-mode'
import { getDemoWorkloadMetrics } from 'src/config/demo'
import { useAppStore } from 'src/stores/app'
import { extractErrorMessage } from 'src/utils/error'
import type { MetricSample, WorkloadMetrics } from 'src/types/metrics'

/**
 * Resource metrics for one workload.
 *
 * Polls on an interval while a chart is mounted, and stops the moment it unmounts. The backend
 * samples cgroups every 30s, so anything faster than that returns the same buffer and only costs
 * a round trip — the refresh below deliberately matches the collection interval rather than the
 * 2s status broadcast.
 */
export function useWorkloadMetrics(name: () => string) {
  const appStore = useAppStore()
  const samples = ref<MetricSample[]>([])
  const windowMs = ref(0)
  const intervalMs = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  /**
   * Where the backend got the history — `'none'` when the host has no metrics store.
   *
   * Defaults to `'prometheus'` rather than `'none'`, because an older backend and a demo build
   * both omit the field, and treating an omission as "no store" would show every one of them a
   * configuration warning for a feature that is working.
   */
  const historySource = ref<'prometheus' | 'none'>('prometheus')
  let timer: ReturnType<typeof setInterval> | null = null

  async function fetchMetrics(window?: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const data: WorkloadMetrics = isDemoMode()
        ? getDemoWorkloadMetrics(name(), appStore.effectiveTier)
        : await workloadMetricsService.fetchFor(name(), window)
      samples.value = data.samples
      windowMs.value = data.windowMs
      intervalMs.value = data.intervalMs
      historySource.value = data.historySource ?? 'prometheus'
    } catch (err) {
      error.value = extractErrorMessage(err, 'Failed to load metrics')
    } finally {
      loading.value = false
    }
  }

  function startPolling(window?: string): void {
    if (timer) return
    void fetchMetrics(window)
    // Matches the backend's collection interval. Polling faster re-fetches an unchanged buffer.
    timer = setInterval(() => void fetchMetrics(window), 30_000)
  }

  function stopPolling(): void {
    if (timer) clearInterval(timer)
    timer = null
  }

  // A chart that keeps polling after its page is gone is a slow leak of requests that nothing
  // renders, and it survives navigation because the interval outlives the component.
  onBeforeUnmount(stopPolling)

  const cpuSeries = computed(() => samples.value.map(s => s.cpuPercent))
  const memorySeries = computed(() => samples.value.map(s => s.memoryBytes))
  const diskReadSeries = computed(() => samples.value.map(s => s.diskReadBps))
  const diskWriteSeries = computed(() => samples.value.map(s => s.diskWriteBps))

  /**
   * True when the window contains samples but none carries a usable reading.
   *
   * Distinct from "no samples at all": a stopped workload produces timestamped samples with null
   * values, and the UI should say "no data for this period" rather than render an empty chart
   * that looks like a loading state which never resolves.
   *
   * Deliberately judged on CPU and memory only, NOT on disk. A cgroup can legitimately have no
   * `io.stat` — the io controller is not enabled on every host — so a running workload with real
   * CPU and memory readings would otherwise be declared "not running" wherever disk accounting is
   * simply unavailable.
   */
  const hasNoReadings = computed(
    () => samples.value.length > 0 && samples.value.every(s => s.cpuPercent === null && s.memoryBytes === null),
  )

  /**
   * The host has no metrics store, so there is no history and there never will be until an
   * operator turns one on.
   *
   * This is a THIRD kind of empty and it has to outrank the other two in the template. Before the
   * in-process ring buffer was retired, an empty series meant "nothing sampled yet" and resolved
   * on its own within 30 seconds; the chart says exactly that. On a host with
   * `services.weaver.metrics.enable = false` it now never resolves, so that message becomes a
   * promise the product cannot keep — the reader waits, then concludes the feature is broken.
   */
  const hasNoHistoryStore = computed(() => historySource.value === 'none')

  return {
    samples, windowMs, intervalMs, loading, error, historySource,
    cpuSeries, memorySeries, diskReadSeries, diskWriteSeries, hasNoReadings, hasNoHistoryStore,
    fetchMetrics, startPolling, stopPolling,
  }
}

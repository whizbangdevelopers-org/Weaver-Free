// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Presentation for service-probe health — ONE place, so the card, the detail panel and anything
 * added later cannot disagree about what red means.
 *
 * Pure, no Vue import: this is the seam the tests exercise, and the components only bind to it.
 */
import type { ProbeHealth, WorkloadServiceProbe } from 'src/types/workload'

/** Quasar colour token per health state. */
export function probeHealthColor(health: ProbeHealth): string {
  switch (health) {
    case 'healthy': return 'positive'
    case 'unhealthy': return 'negative'
    // `unreachable` is a CONFIGURATION fault (the backend refused to probe the target), not a
    // service outage. Warning rather than negative, so the operator looks at the probe and not at
    // a service that was never contacted.
    case 'unreachable': return 'warning'
    default: return 'grey-5'
  }
}

/** Material Design Icon name per health state. */
export function probeHealthIcon(health: ProbeHealth): string {
  switch (health) {
    case 'healthy': return 'mdi-check-circle'
    case 'unhealthy': return 'mdi-close-circle'
    case 'unreachable': return 'mdi-alert-circle'
    default: return 'mdi-help-circle'
  }
}

/** One-word label. `unreachable` says why, because the word alone reads like a service problem. */
export function probeHealthLabel(health: ProbeHealth): string {
  return health === 'unreachable' ? 'not probed' : health
}

/**
 * Roll several probes into one badge.
 *
 * The ordering is a severity ladder, and each rung is deliberate:
 *
 * - **any `unhealthy` → unhealthy.** One dead service on a workload is the headline; averaging it
 *   away behind three healthy ones is how a card stays green while the thing it exists to serve is
 *   down.
 * - **else any `unreachable` → unreachable.** A misconfigured probe outranks "unknown" because it
 *   is actionable: something is wrong with the configuration, right now.
 * - **else all `healthy` → healthy.** ALL, not most — the badge is a claim about the workload.
 * - **else unknown** (stopped, or not yet probed).
 *
 * No probes at all returns `unknown`; callers render nothing in that case rather than a grey badge
 * that would imply a probe exists and could not be evaluated.
 */
export function aggregateProbeHealth(probes: readonly WorkloadServiceProbe[] | undefined): ProbeHealth {
  if (!probes || probes.length === 0) return 'unknown'
  if (probes.some(p => p.health === 'unhealthy')) return 'unhealthy'
  if (probes.some(p => p.health === 'unreachable')) return 'unreachable'
  if (probes.every(p => p.health === 'healthy')) return 'healthy'
  return 'unknown'
}

/** "2/3 healthy" — the count a badge shows next to the aggregate icon. */
export function probeHealthSummary(probes: readonly WorkloadServiceProbe[] | undefined): string {
  if (!probes || probes.length === 0) return 'no probes'
  const healthy = probes.filter(p => p.health === 'healthy').length
  return `${healthy}/${probes.length} healthy`
}

/**
 * The URL the "Open" button uses, or undefined when there is nothing safe to open.
 *
 * Two conditions, and the second is the one worth stating: a probe is only offered as a link when
 * it is CURRENTLY healthy. Offering a link to a service known to be down sends the user to a
 * browser error page to discover what the dashboard already knew.
 */
export function primaryServiceUrl(probes: readonly WorkloadServiceProbe[] | undefined): string | undefined {
  return probes?.find(p => p.type === 'http' && p.url && p.health === 'healthy')?.url
}

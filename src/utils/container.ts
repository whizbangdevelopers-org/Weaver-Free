// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Container projection of the unified workload model.
 *
 * Under WVR-72 the backend returns one `WorkloadInfo[]` covering VMs and
 * containers alike; the container-shaped views (cards, list items, the detail
 * panel) want a `ContainerInfo`. That projection lived only inside
 * `WeaverPage.vue`, so any other consumer had to either import a page or copy
 * it — and `ContainerDetailPanel.vue` did neither, reading demo data
 * unconditionally and therefore rendering "not found" for every real
 * container. One shared projection, per `single-source-generated.md`.
 */
import { STATUSES } from 'src/constants/vocabularies'
import type { ContainerInfo, ContainerRuntime } from 'src/types/container'
import type { WorkloadInfo } from 'src/types/workload'

export const CONTAINER_RUNTIMES = ['docker', 'podman', 'apptainer'] as const

export function isContainerRuntime(runtime: string | undefined): runtime is ContainerRuntime {
  return (CONTAINER_RUNTIMES as readonly string[]).includes(runtime ?? '')
}

/**
 * WorkloadInfo -> ContainerInfo. Fields the workload model does not carry
 * (ports, mounts, labels, live cpu/mem) stay undefined so the consuming view
 * renders its empty state rather than inventing a value.
 */
export function mapToContainerInfo(w: WorkloadInfo): ContainerInfo {
  const statusMap: Record<string, ContainerInfo['status']> = {
    [STATUSES.RUNNING]: STATUSES.RUNNING,
    [STATUSES.IDLE]: STATUSES.STOPPED,
    [STATUSES.STOPPED]: 'exited',
    [STATUSES.FAILED]: 'exited',
    [STATUSES.UNKNOWN]: STATUSES.UNKNOWN,
  }
  return {
    id: w.containerId ?? w.name,
    name: w.name,
    image: w.image ?? '',
    runtime: w.runtime as ContainerRuntime,
    status: statusMap[w.status] ?? STATUSES.UNKNOWN,
    created: '',
    // WVR-208 phase A — carried through, not recomputed. Dropping these here is what would make
    // the container drawer (the surface where divergence actually appears, since the gap is
    // Docker/Podman/Apptainer) silently unable to show it.
    bridge: w.bridge,
    networkDivergent: w.networkDivergent,
  }
}

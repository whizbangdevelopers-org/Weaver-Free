// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.

/**
 * Partition workload tags by runtime into VMs and containers.
 *
 * Under the unified workload model, containers are already in
 * workloadStore.workloads with runtime 'docker'|'podman'|'apptainer'.
 * Everything else (including absent runtime) is a VM.
 *
 * @returns sorted by tag name for deterministic output
 */
export function partitionTagCounts(
  workloads: { name: string; runtime?: string; tags?: string[] }[]
): { tag: string; vmCount: number; vmNames: string[]; containerCount: number; containerNames: string[] }[] {
  const CONTAINER_RUNTIMES = new Set(['docker', 'podman', 'apptainer'])

  // Map: tag -> { vmNames, containerNames }
  const tagMap = new Map<string, { vmNames: string[]; containerNames: string[] }>()

  for (const workload of workloads) {
    const tags = workload.tags ?? []
    // Skip workloads with no tags (never create empty-string tag)
    if (tags.length === 0) continue

    const isContainer = CONTAINER_RUNTIMES.has(workload.runtime ?? '')

    for (const tag of tags) {
      const entry = tagMap.get(tag)
      if (entry) {
        if (isContainer) {
          entry.containerNames.push(workload.name)
        } else {
          entry.vmNames.push(workload.name)
        }
      } else {
        tagMap.set(tag, {
          vmNames: isContainer ? [] : [workload.name],
          containerNames: isContainer ? [workload.name] : [],
        })
      }
    }
  }

  // Convert to sorted array
  return [...tagMap.entries()]
    .map(([tag, { vmNames, containerNames }]) => ({
      tag,
      vmCount: vmNames.length,
      vmNames,
      containerCount: containerNames.length,
      containerNames,
    }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { ref, computed } from 'vue'
import type { ContainerInfo } from 'src/types/container'

const selectedContainers = ref(new Set<string>())

export function useContainerSelection() {
  const selectedCount = computed(() => selectedContainers.value.size)
  const hasSelection = computed(() => selectedContainers.value.size > 0)

  function isSelected(id: string): boolean {
    return selectedContainers.value.has(id)
  }

  function toggle(id: string) {
    const next = new Set(selectedContainers.value)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    selectedContainers.value = next
  }

  function selectAll(containers: ContainerInfo[]) {
    selectedContainers.value = new Set(containers.map(c => c.id))
  }

  function clearSelection() {
    selectedContainers.value = new Set()
  }

  function getSelectedIds(): string[] {
    return [...selectedContainers.value]
  }

  return {
    selectedContainers,
    selectedCount,
    hasSelection,
    isSelected,
    toggle,
    selectAll,
    clearSelection,
    getSelectedIds,
  }
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { ref, computed } from 'vue'
import type { WorkloadInfo } from 'src/types/workload'

const selectedVms = ref(new Set<string>())

export function useVmSelection() {
  const selectedCount = computed(() => selectedVms.value.size)
  const hasSelection = computed(() => selectedVms.value.size > 0)

  function isSelected(name: string): boolean {
    return selectedVms.value.has(name)
  }

  function toggle(name: string) {
    const next = new Set(selectedVms.value)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
    }
    selectedVms.value = next
  }

  function selectAll(vms: WorkloadInfo[]) {
    selectedVms.value = new Set(vms.map(vm => vm.name))
  }

  function clearSelection() {
    selectedVms.value = new Set()
  }

  function selectByTag(vms: WorkloadInfo[], tag: string) {
    const matching = vms.filter(vm => vm.tags?.includes(tag)).map(vm => vm.name)
    selectedVms.value = new Set(matching)
  }

  function getSelectedNames(): string[] {
    return [...selectedVms.value]
  }

  return {
    selectedVms,
    selectedCount,
    hasSelection,
    isSelected,
    toggle,
    selectAll,
    clearSelection,
    selectByTag,
    getSelectedNames,
  }
}

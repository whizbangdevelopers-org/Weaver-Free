// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { defineStore } from 'pinia'
import type { NetworkNode } from 'src/types/network'

export type DrawerResourceType = 'vm' | 'container' | 'network-node'

export interface DrawerState {
  isOpen: boolean
  resourceType: DrawerResourceType | null
  resourceId: string | null
  networkNode: NetworkNode | null
}

export const useResourceDrawerStore = defineStore('resourceDrawer', {
  state: (): DrawerState => ({
    isOpen: false,
    resourceType: null,
    resourceId: null,
    networkNode: null,
  }),

  actions: {
    openVm(name: string) {
      this.resourceType = 'vm'
      this.resourceId = name
      this.networkNode = null
      this.isOpen = true
    },

    openContainer(id: string) {
      this.resourceType = 'container'
      this.resourceId = id
      this.networkNode = null
      this.isOpen = true
    },

    openNetworkNode(node: NetworkNode) {
      this.resourceType = 'network-node'
      this.resourceId = node.name
      this.networkNode = node
      this.isOpen = true
    },

    close() {
      this.isOpen = false
    },
  },
})

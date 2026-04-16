// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { defineStore } from 'pinia'
import type { BridgeInfo, NetworkNode } from 'src/types/network'
import { STATUSES } from 'src/constants/vocabularies'

export const useNetworkStore = defineStore('network', {
  state: () => ({
    bridges: [] as BridgeInfo[],
    nodes: [] as NetworkNode[],
    selectedNode: null as string | null,
  }),

  getters: {
    primaryBridge: (state) => state.bridges[0] ?? null,
    nodeByName: (state) => (name: string) =>
      state.nodes.find((n) => n.name === name),
    runningNodes: (state) =>
      state.nodes.filter((n) => n.status === STATUSES.RUNNING),
    bridgeByName: (state) => (name: string) =>
      state.bridges.find((b) => b.name === name),
  },

  actions: {
    setBridges(bridges: BridgeInfo[]) {
      this.bridges = bridges
    },
    updateNodes(nodes: NetworkNode[]) {
      this.nodes = nodes
    },
    selectNode(name: string | null) {
      this.selectedNode = name
    },
  },
})

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { defineStore } from 'pinia'
import type { AgentOperation, AgentAction } from 'src/types/agent'
import { STATUSES } from 'src/constants/vocabularies'

export const useAgentStore = defineStore('agent', {
  state: () => ({
    operations: {} as Record<string, AgentOperation>,
    activeOperationId: null as string | null,
  }),

  getters: {
    activeOperation: (state) =>
      state.activeOperationId ? state.operations[state.activeOperationId] : null,
    operationsForVm: (state) => (vmName: string) =>
      Object.values(state.operations).filter((op) => op.vmName === vmName),
    hasActiveOperation: (state) =>
      state.activeOperationId !== null &&
      state.operations[state.activeOperationId]?.status === STATUSES.RUNNING, // agent lifecycle status, not WorkloadStatus
  },

  actions: {
    startOperation(operationId: string, vmName: string, action: AgentAction) {
      this.operations[operationId] = {
        operationId,
        vmName,
        action,
        status: STATUSES.RUNNING, // agent lifecycle status, not WorkloadStatus
        tokens: '',
        startedAt: new Date().toISOString(),
      }
      this.activeOperationId = operationId
    },

    appendToken(operationId: string, token: string) {
      const op = this.operations[operationId]
      if (op) {
        op.tokens += token
      }
    },

    completeOperation(operationId: string, fullText: string) {
      const op = this.operations[operationId]
      if (op) {
        op.status = 'complete'
        op.tokens = fullText
        op.completedAt = new Date().toISOString()
      }
    },

    failOperation(operationId: string, error: string) {
      const op = this.operations[operationId]
      if (op) {
        op.status = 'error'
        op.error = error
        op.completedAt = new Date().toISOString()
      }
    },

    clearOperation(operationId: string) {
      delete this.operations[operationId]
      if (this.activeOperationId === operationId) {
        this.activeOperationId = null
      }
    },
  },
})

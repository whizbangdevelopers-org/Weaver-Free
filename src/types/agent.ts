// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
// Agent action types
import { STATUSES } from 'src/constants/vocabularies'

export type AgentAction = 'diagnose' | 'explain' | 'suggest'

// LLM vendor for BYOV support
export type LlmVendor = 'anthropic'

// Response when agent operation is initiated
export interface AgentOperationStarted {
  operationId: string
  vmName: string
  action: AgentAction
  status: 'started'
}

// WebSocket message types for agent streaming
export interface AgentTokenMessage {
  type: 'agent-token'
  operationId: string
  token: string
}

export interface AgentCompleteMessage {
  type: 'agent-complete'
  operationId: string
  fullText: string
}

export interface AgentErrorMessage {
  type: 'agent-error'
  operationId: string
  error: string
}

export type AgentWsMessage =
  | AgentTokenMessage
  | AgentCompleteMessage
  | AgentErrorMessage

// Agent operation status — distinct from WorkloadStatus (these are agent lifecycle states)
// State of an agent operation
export interface AgentOperation {
  operationId: string
  vmName: string
  action: AgentAction
  status: typeof STATUSES.RUNNING | 'complete' | 'error' // agent lifecycle status, not WorkloadStatus
  tokens: string
  error?: string
  startedAt: string
  completedAt?: string
}

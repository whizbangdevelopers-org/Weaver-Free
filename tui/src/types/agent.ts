// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { STATUSES } from '../constants/vocabularies.js'

export type AgentAction = 'diagnose' | 'explain' | 'suggest'

export type LlmVendor = 'anthropic'

export interface AgentOperationStarted {
  operationId: string
  vmName: string
  action: AgentAction
  status: 'started'
}

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

export interface AgentOperation {
  operationId: string
  vmName: string
  action: AgentAction
  status: typeof STATUSES.RUNNING | 'complete' | 'error' // agent lifecycle status
  tokens: string
  error?: string
  startedAt: string
  completedAt?: string
}

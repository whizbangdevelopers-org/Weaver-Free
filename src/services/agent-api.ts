// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { ApiService } from 'src/services/api'
import type { AgentAction, AgentOperationStarted, LlmVendor } from 'src/types/agent'

export class AgentApiService extends ApiService {
  constructor() {
    super('')
  }

  async startAgent(
    resourceId: string,
    action: AgentAction,
    options?: { apiKey?: string; vendor?: LlmVendor },
    _resourceType: 'vm' | 'container' = 'vm'
  ): Promise<AgentOperationStarted> {
    return this.post<AgentOperationStarted>(`/workload/${resourceId}/agent`, {
      action,
      ...options,
    })
  }
}

export const agentApiService = new AgentApiService()

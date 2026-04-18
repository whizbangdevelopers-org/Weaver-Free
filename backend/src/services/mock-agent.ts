// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Mock agent service shim (backend).
 *
 * Ships to Weaver Free. Real impl in `./mock-agent-data.ts` is sync-excluded.
 * Static import of the data file would break the Free build since the file
 * is absent; instead we dynamically import on demand and fall back to a
 * clean error if the module is missing.
 *
 * `runMockAgent` is only called when the LLM provider is unavailable (no
 * API key, no configured vendor). On Free the dynamic import throws, the
 * catch broadcasts a clean error, and the client shows "Configure an LLM
 * provider" rather than a crash.
 */

import type { AgentWsMessage } from './agent.js'

type AgentAction = 'diagnose' | 'explain' | 'suggest'
type BroadcastFn = (msg: AgentWsMessage) => void

export async function runMockAgent(
  operationId: string,
  vmName: string,
  action: AgentAction,
  broadcast: BroadcastFn
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - mock-agent-data.ts is sync-excluded from Free repo
    const mod = await import('./mock-agent-data.js')
    return mod.runMockAgent(operationId, vmName, action, broadcast)
  } catch {
    broadcast({
      type: 'agent-error',
      operationId,
      error: 'Mock agent not available in this build. Configure an LLM provider.',
    } as AgentWsMessage)
  }
}

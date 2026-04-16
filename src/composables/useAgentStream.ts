// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { onMounted, onUnmounted } from 'vue'
import { useAgentStore } from 'src/stores/agent-store'
import type { AgentTokenMessage, AgentCompleteMessage, AgentErrorMessage } from 'src/types/agent'
import { acquireWs, onWsMessage } from 'src/services/ws'

export function useAgentStream() {
  const agentStore = useAgentStore()

  let releaseWs: (() => void) | null = null
  let removeMessageHandler: (() => void) | null = null

  function handleMessage(msg: Record<string, unknown>) {
    if (msg.type === 'agent-token') {
      const data = msg as unknown as AgentTokenMessage
      agentStore.appendToken(data.operationId, data.token)
    } else if (msg.type === 'agent-complete') {
      const data = msg as unknown as AgentCompleteMessage
      agentStore.completeOperation(data.operationId, data.fullText)
    } else if (msg.type === 'agent-error') {
      const data = msg as unknown as AgentErrorMessage
      agentStore.failOperation(data.operationId, data.error)
    }
  }

  onMounted(() => {
    removeMessageHandler = onWsMessage(handleMessage)
    releaseWs = acquireWs()
  })

  onUnmounted(() => {
    removeMessageHandler?.()
    releaseWs?.()
  })
}

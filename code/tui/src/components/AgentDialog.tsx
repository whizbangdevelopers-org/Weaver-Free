import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import type { AgentAction, AgentWsMessage } from '../types/agent.js'
import type { TuiApiClient } from '../client/api.js'
import type { TuiWsClient } from '../client/ws.js'

interface AgentDialogProps {
  vmName: string
  api: TuiApiClient
  wsClient: TuiWsClient
  onBack: () => void
}

type Phase = 'select-action' | 'byok-prompt' | 'streaming' | 'complete' | 'error'

const ACTIONS: { key: string; action: AgentAction; label: string }[] = [
  { key: '1', action: 'diagnose', label: 'Diagnose — analyze VM health and issues' },
  { key: '2', action: 'explain', label: 'Explain — describe VM configuration and setup' },
  { key: '3', action: 'suggest', label: 'Suggest — recommend improvements' },
]

export function AgentDialog({ vmName, api, wsClient, onBack }: AgentDialogProps) {
  const [phase, setPhase] = useState<Phase>('select-action')
  const [selectedAction, setSelectedAction] = useState<AgentAction | null>(null)
  const [operationId, setOperationId] = useState<string | null>(null)
  const [tokens, setTokens] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showByok, setShowByok] = useState(false)

  // Subscribe to agent WS messages
  useEffect(() => {
    if (!operationId) return

    const unsub = wsClient.onAgentMessage((msg: AgentWsMessage) => {
      if (msg.operationId !== operationId) return

      if (msg.type === 'agent-token') {
        setTokens(t => t + msg.token)
      } else if (msg.type === 'agent-complete') {
        setTokens(msg.fullText)
        setPhase('complete')
      } else if (msg.type === 'agent-error') {
        setError(msg.error)
        setPhase('error')
      }
    })

    return unsub
  }, [operationId, wsClient])

  const startAgent = useCallback(async (action: AgentAction) => {
    setSelectedAction(action)
    setPhase('streaming')
    setTokens('')
    setError(null)

    const result = await api.startAgent(vmName, action, apiKey || undefined)
    if (result.status === 202 || result.status === 200) {
      const data = result.data as { operationId: string }
      setOperationId(data.operationId)
    } else {
      const data = result.data as { error?: string }
      setError(data.error ?? 'Failed to start agent')
      setPhase('error')
    }
  }, [api, vmName, apiKey])

  useInput((input, key) => {
    if (key.escape || input === 'b') {
      if (phase === 'streaming') return // Don't leave during streaming
      onBack()
      return
    }

    if (phase === 'select-action') {
      const match = ACTIONS.find(a => a.key === input)
      if (match) {
        void startAgent(match.action)
        return
      }
      if (input === 'k') {
        setShowByok(true)
        setPhase('byok-prompt')
        return
      }
    }

    if (phase === 'byok-prompt') {
      if (key.return) {
        setPhase('select-action')
        return
      }
      if (key.backspace || key.delete) {
        setApiKey(k => k.slice(0, -1))
        return
      }
      if (input && !key.ctrl && !key.meta) {
        setApiKey(k => k + input)
        return
      }
    }
  })

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>AI Agent — {vmName}</Text>

      {phase === 'select-action' && (
        <Box flexDirection="column" marginTop={1}>
          <Text>Select an action:</Text>
          {ACTIONS.map(a => (
            <Text key={a.key}>  [{a.key}] {a.label}</Text>
          ))}
          <Box marginTop={1}>
            <Text dimColor>
              [k] Set API key{showByok && apiKey ? ` (set: ${apiKey.slice(0, 8)}...)` : ''} [b]ack
            </Text>
          </Box>
        </Box>
      )}

      {phase === 'byok-prompt' && (
        <Box flexDirection="column" marginTop={1}>
          <Text>Enter your Anthropic API key (Enter to confirm):</Text>
          <Text color="cyan">Key: {apiKey ? apiKey.slice(0, 8) + '...' : ''}█</Text>
        </Box>
      )}

      {phase === 'streaming' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow">
            {selectedAction} in progress...
          </Text>
          <Box marginTop={1}>
            <Text>{tokens || 'Waiting for response...'}</Text>
          </Box>
        </Box>
      )}

      {phase === 'complete' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="green">Agent complete ({selectedAction})</Text>
          <Box marginTop={1}>
            <Text>{tokens}</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>[b]ack</Text>
          </Box>
        </Box>
      )}

      {phase === 'error' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red">Agent error: {error}</Text>
          <Box marginTop={1}>
            <Text dimColor>[b]ack</Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}

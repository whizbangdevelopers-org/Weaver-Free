// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { resolve } from 'node:path'
import { safeReadFile } from '../utils/file-reader.js'

interface WsMessageType {
  type: string
  direction: 'server→client' | 'client→server'
  payload: Record<string, string>
  producer: string
  consumer: string
  notes?: string
}

interface WsCloseCode {
  code: number
  meaning: string
}

interface WsConventionsResult {
  endpoint: string
  authMethod: string
  messageTypes: WsMessageType[]
  closeCodes: WsCloseCode[]
  multiplexingPattern: string
  aclFilteringPattern: string
  clientComposables: Array<{ composable: string; filters: string }>
  rateLimitPattern: string
  warnings: string[]
}

export async function getWebSocketConventions(projectRoot: string): Promise<WsConventionsResult> {
  const warnings: string[] = []

  // Verify ws.ts exists and detect any additional message types
  const wsPath = resolve(projectRoot, 'backend/src/routes/ws.ts')
  const wsContent = await safeReadFile(wsPath)
  if (!wsContent) {
    warnings.push('Could not read backend/src/routes/ws.ts')
  }

  // Scan for type: '...' strings to catch any undocumented message types
  const detectedTypes = new Set<string>()
  if (wsContent) {
    const typeRegex = /type:\s*['"](\w[\w-]*)['"](?!\s*,\s*(?:string|boolean|number))/g
    let m: RegExpExecArray | null
    while ((m = typeRegex.exec(wsContent)) !== null) {
      detectedTypes.add(m[1])
    }
  }

  const messageTypes: WsMessageType[] = [
    {
      type: 'vm-status',
      direction: 'server→client',
      payload: {
        type: '"vm-status"',
        data: 'VmInfo[]  — full array of all VMs (or ACL-filtered subset)',
        timestamp: 'ISO 8601 string',
      },
      producer: 'backend/src/routes/ws.ts — broadcast loop every 2s',
      consumer: 'src/composables/useVmStatus.ts — filters msg.type === "vm-status"',
      notes: 'Fabrick tier with ACL: non-admin users with ACL entries receive filtered data. ACL payload is cached per userId to avoid re-serialization.',
    },
    {
      type: 'vm-provisioning',
      direction: 'server→client',
      payload: {
        type: '"vm-provisioning"',
        data: 'ProvisioningEvent — { vmName, state, message?, progress? }',
        timestamp: 'ISO 8601 string',
      },
      producer: 'backend/src/routes/ws.ts — relayed from provisioningEvents EventEmitter',
      consumer: 'src/composables/useVmStatus.ts or provisioning composable',
      notes: 'Per-client relay: each WS connection registers its own provisioningEvents listener. Provisioning is async (202 HTTP) — progress arrives here.',
    },
    {
      type: 'notification',
      direction: 'server→client',
      payload: {
        type: '"notification"',
        event: 'NotificationEvent — { vmName?, eventType, message, severity }',
        timestamp: 'ISO 8601 string',
      },
      producer: 'backend/src/routes/ws.ts — broadcastNotification() called from NotificationService',
      consumer: 'Frontend notification store / toast composable',
      notes: 'Broadcast to ALL connected clients (no ACL filtering on notifications).',
    },
    {
      type: 'agent-token',
      direction: 'server→client',
      payload: {
        type: '"agent-token"',
        operationId: 'UUID string',
        token: 'string — one streaming text chunk (~25 chars)',
      },
      producer: 'backend/src/routes/agent.ts — streamed from LlmProvider',
      consumer: 'src/composables/useAgentStream.ts — filters msg.type === "agent-token"',
      notes: 'Multiplexed on same /ws/status endpoint. Chunk size ~25 chars with 30-80ms delay mimics real Claude streaming.',
    },
    {
      type: 'agent-complete',
      direction: 'server→client',
      payload: {
        type: '"agent-complete"',
        operationId: 'UUID string',
        fullText: 'string — complete agent response',
      },
      producer: 'backend/src/routes/agent.ts',
      consumer: 'src/composables/useAgentStream.ts',
    },
    {
      type: 'agent-error',
      direction: 'server→client',
      payload: {
        type: '"agent-error"',
        operationId: 'UUID string',
        error: 'string — error message',
      },
      producer: 'backend/src/routes/agent.ts',
      consumer: 'src/composables/useAgentStream.ts',
    },
    {
      type: 'error',
      direction: 'server→client',
      payload: {
        type: '"error"',
        error: 'string — error message',
      },
      producer: 'backend/src/routes/ws.ts — auth failure or session revocation',
      consumer: 'Frontend WebSocket composable',
      notes: 'Sent before close when session is revoked (code 4402) or auth fails (code 4401).',
    },
  ]

  // Check for any detected types not in our documented list
  const documentedTypes = new Set(messageTypes.map(t => t.type))
  for (const detected of detectedTypes) {
    if (!documentedTypes.has(detected) && detected !== 'text') {
      warnings.push(`Detected undocumented WS message type in ws.ts: "${detected}"`)
    }
  }

  const closeCodes: WsCloseCode[] = [
    { code: 4401, meaning: 'Authentication required — token missing or invalid' },
    { code: 4402, meaning: 'Session replaced — user logged in from another location (single-session enforcement)' },
  ]

  return {
    endpoint: '/ws/status',
    authMethod: [
      'Token passed as query parameter: /ws/status?token=<jwt>',
      'verifyWsToken() validates the token. Missing/invalid → sends error message + closes with 4401.',
      'Browsers cannot set Authorization headers on WebSocket connections — query param is the standard pattern here.',
    ].join(' '),
    messageTypes,
    closeCodes,
    multiplexingPattern: [
      'All message types share /ws/status. There is no separate endpoint per feature.',
      'Consumer composables filter by msg.type:',
      '  useVmStatus: msg.type === "vm-status" | "vm-provisioning"',
      '  useAgentStream: msg.type === "agent-token" | "agent-complete" | "agent-error"',
      'To add a new message type: (1) emit it in the backend, (2) create a composable that filters for it.',
      'Do NOT create a new WebSocket endpoint — multiplex on /ws/status.',
    ].join('\n'),
    aclFilteringPattern: [
      'Fabrick tier only (config.tier === "fabrick" && aclStore exists).',
      'Admin users always receive the full VM list.',
      'Non-admin users with an ACL entry receive aclStore.filterVms(userId, vms).',
      'ACL payloads are cached per userId within each broadcast cycle to avoid repeated JSON.stringify.',
      'All non-ACL clients share a single pre-serialized payload (fullPayload).',
    ].join(' '),
    clientComposables: [
      {
        composable: 'src/composables/useVmStatus.ts',
        filters: 'msg.type === "vm-status" for VM list updates; "vm-provisioning" for provisioning progress',
      },
      {
        composable: 'src/composables/useAgentStream.ts',
        filters: '"agent-token" (chunk), "agent-complete" (done), "agent-error" (failed) — all keyed by operationId',
      },
    ],
    rateLimitPattern: [
      'One active agent operation per VM enforced via in-memory Map<string, string> (vmName → operationId).',
      '30-minute TTL safety net clears stale entries.',
      'Database/Redis would be overkill at this scale.',
      'If a VM already has an active operationId, POST /api/workload/:name/agent returns 409.',
    ].join(' '),
    warnings,
  }
}

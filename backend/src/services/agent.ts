// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { getVmStatus, getWorkloadDefinitions, getConfig } from './microvm.js'
import { runMockAgent } from './mock-agent.js'
import { resolveProvider, getDefaultModel, type LlmVendor } from './llm-provider.js'
import { STATUSES, type WorkloadStatus } from '../constants/vocabularies.js'

const execFileAsync = promisify(execFile)

// --- Types ---

type AgentAction = 'diagnose' | 'explain' | 'suggest'

export interface AgentWsMessage {
  type: 'agent-token' | 'agent-complete' | 'agent-error'
  operationId: string
  token?: string
  fullText?: string
  error?: string
}

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

interface VmContext {
  vmName: string
  vmDefinition: { ip: string; mem: number; vcpu: number; hypervisor: string }
  systemctlStatus: string
  journalLogs: string
  currentStatus: WorkloadStatus
}

type BroadcastFn = (msg: AgentWsMessage) => void

// --- Configuration ---

const MAX_OPERATIONS = 50
const OPERATION_TTL_MS = 30 * 60 * 1000 // 30 minutes

// --- Operation Store (in-memory) ---

const operations = new Map<string, AgentOperation>()
const activeByVm = new Map<string, string>() // vmName -> operationId

// Periodic cleanup of expired operations (prevents unbounded memory growth
// when no new operations are started for extended periods)
setInterval(cleanupOldOperations, 5 * 60 * 1000).unref()

function cleanupOldOperations() {
  const now = Date.now()
  for (const [id, op] of operations) {
    const started = new Date(op.startedAt).getTime()
    if (now - started > OPERATION_TTL_MS) {
      operations.delete(id)
      if (activeByVm.get(op.vmName) === id) {
        activeByVm.delete(op.vmName)
      }
    }
  }
  // Enforce max count by removing oldest first
  if (operations.size > MAX_OPERATIONS) {
    const sorted = [...operations.entries()]
      .sort((a, b) => new Date(a[1].startedAt).getTime() - new Date(b[1].startedAt).getTime())
    while (operations.size > MAX_OPERATIONS) {
      const [id, op] = sorted.shift()!
      operations.delete(id)
      if (activeByVm.get(op.vmName) === id) {
        activeByVm.delete(op.vmName)
      }
    }
  }
}

export function getOperation(id: string): AgentOperation | undefined {
  return operations.get(id)
}

export function hasActiveOperation(vmName: string): boolean {
  const activeId = activeByVm.get(vmName)
  if (!activeId) return false
  const op = operations.get(activeId)
  return op?.status === STATUSES.RUNNING
}

// --- Context Gathering ---

export async function gatherVmContext(vmName: string): Promise<VmContext> {
  const defs = await getWorkloadDefinitions()
  const def = defs[vmName]
  if (!def) throw new Error(`VM '${vmName}' not found`)

  const currentStatus = await getVmStatus(vmName)

  // Gather systemctl status (full output) — use configured binary paths
  const cfg = getConfig()
  const systemctlBin = cfg?.systemctlBin ?? 'systemctl'
  let systemctlStatus = ''
  try {
    const { stdout } = await execFileAsync(systemctlBin, [
      'status', `microvm@${vmName}.service`, '--no-pager',
    ])
    systemctlStatus = stdout
  } catch (err: unknown) {
    // systemctl status returns exit code 3 for stopped/inactive services
    const execErr = err as { stdout?: string }
    systemctlStatus = execErr.stdout || 'Unable to retrieve systemctl status'
  }

  // Gather recent journal logs
  let journalLogs = ''
  try {
    const { stdout } = await execFileAsync('journalctl', [
      '-u', `microvm@${vmName}.service`, '--no-pager', '-n', '50',
    ])
    journalLogs = stdout
  } catch {
    journalLogs = 'Unable to retrieve journal logs'
  }

  return {
    vmName,
    vmDefinition: { ip: def.ip, mem: def.mem, vcpu: def.vcpu, hypervisor: def.hypervisor },
    systemctlStatus,
    journalLogs,
    currentStatus,
  }
}

// --- Prompt Building ---

export function buildPrompt(action: AgentAction, context: VmContext): string {
  const base = `You are a NixOS MicroVM diagnostic assistant. Analyze the following VM information and provide actionable insights. Be concise and specific.

VM: ${context.vmName}
Current Status: ${context.currentStatus}
Config: IP=${context.vmDefinition.ip}, Memory=${context.vmDefinition.mem}MB, vCPUs=${context.vmDefinition.vcpu}, Hypervisor=${context.vmDefinition.hypervisor}

systemctl status output:
\`\`\`
${context.systemctlStatus}
\`\`\`

Recent journal logs (last 50 lines):
\`\`\`
${context.journalLogs}
\`\`\`
`

  switch (action) {
    case 'diagnose':
      return base + '\nDiagnose this VM. Identify any issues, their severity (info/warning/error/critical), root cause analysis, and specific remediation steps. Reference systemd/NixOS specifics where relevant.'
    case 'explain':
      return base + '\nExplain this VM\'s current configuration and operational status in clear terms. What is it doing? Is it healthy? What role does it likely serve based on its name and resource allocation?'
    case 'suggest':
      return base + '\nSuggest optimizations for this VM. Consider memory sizing, CPU allocation, NixOS configuration improvements, monitoring recommendations, and security hardening relevant to its role.'
  }
}

// --- Agent Execution ---

export interface RunAgentOptions {
  vmName: string
  action: AgentAction
  broadcast: BroadcastFn
  apiKey?: string   // BYOK: optional caller-provided API key
  vendor?: LlmVendor // BYOV: optional caller-provided vendor
}

export async function runAgent(opts: RunAgentOptions): Promise<string> {
  const { vmName, action, broadcast, apiKey, vendor } = opts
  cleanupOldOperations()

  const operationId = randomUUID()
  const op: AgentOperation = {
    operationId,
    vmName,
    action,
    status: STATUSES.RUNNING,
    tokens: '',
    startedAt: new Date().toISOString(),
  }
  operations.set(operationId, op)
  activeByVm.set(vmName, operationId)

  const provider = resolveProvider(vendor, apiKey)

  if (!provider) {
    // No provider available — use mock mode
    runMockAgent(operationId, vmName, action, broadcast)
      .then(() => {
        op.status = 'complete'
        op.completedAt = new Date().toISOString()
      })
      .catch((err) => {
        op.status = 'error'
        op.error = err instanceof Error ? err.message : 'Mock agent error'
        op.completedAt = new Date().toISOString()
      })
    return operationId
  }

  // LLM execution — fire-and-forget
  const resolvedVendor = vendor || (process.env.AGENT_VENDOR as LlmVendor) || 'anthropic'
  const model = getDefaultModel(resolvedVendor)

  ;(async () => {
    try {
      const context = await gatherVmContext(vmName)
      const prompt = buildPrompt(action, context)

      for await (const token of provider.stream({ model, maxTokens: 1024, prompt })) {
        op.tokens += token
        broadcast({ type: 'agent-token', operationId, token })
      }

      op.status = 'complete'
      op.completedAt = new Date().toISOString()
      broadcast({ type: 'agent-complete', operationId, fullText: op.tokens })
    } catch (err) {
      op.status = 'error'
      op.error = err instanceof Error ? err.message : 'Unknown error'
      op.completedAt = new Date().toISOString()
      broadcast({ type: 'agent-error', operationId, error: op.error })
    } finally {
      if (activeByVm.get(vmName) === operationId) {
        activeByVm.delete(vmName)
      }
    }
  })()

  return operationId
}

// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import WebSocket from 'ws'
import type { VmInfo } from '../types/vm.js'
import type { AgentWsMessage } from '../types/agent.js'

type VmStatusHandler = (vms: VmInfo[]) => void
type AgentHandler = (msg: AgentWsMessage) => void
type ConnectionHandler = () => void

const MAX_RECONNECT_ATTEMPTS = 20
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30000

export class TuiWsClient {
  private host: string
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private token: string | null = null
  private shouldReconnect = false

  private vmStatusHandlers = new Set<VmStatusHandler>()
  private agentHandlers = new Set<AgentHandler>()
  private connectHandlers = new Set<ConnectionHandler>()
  private disconnectHandlers = new Set<ConnectionHandler>()
  private authExpiredHandlers = new Set<ConnectionHandler>()
  private sessionKickedHandlers = new Set<ConnectionHandler>()

  constructor(host: string) {
    this.host = host
  }

  connect(token: string): void {
    this.token = token
    this.shouldReconnect = true
    this.reconnectAttempt = 0
    this.openConnection()
  }

  disconnect(): void {
    this.shouldReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempt = 0
    if (this.ws) {
      this.ws.removeAllListeners()
      this.ws.close()
      this.ws = null
    }
  }

  private getWsUrl(): string {
    const protocol = this.host.startsWith('https') ? 'wss:' : 'ws:'
    const hostPart = this.host.replace(/^https?:\/\//, '')
    const base = `${protocol}//${hostPart}/ws/status`
    if (this.token) {
      return `${base}?token=${encodeURIComponent(this.token)}`
    }
    return base
  }

  private openConnection(): void {
    if (this.ws) return

    this.ws = new WebSocket(this.getWsUrl())

    this.ws.on('open', () => {
      this.reconnectAttempt = 0
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }
      this.connectHandlers.forEach(fn => fn())
    })

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>
        if (msg.type === 'vm-status' && Array.isArray(msg.data)) {
          this.vmStatusHandlers.forEach(fn => fn(msg.data as VmInfo[]))
        } else if (
          msg.type === 'agent-token' ||
          msg.type === 'agent-complete' ||
          msg.type === 'agent-error'
        ) {
          this.agentHandlers.forEach(fn => fn(msg as unknown as AgentWsMessage))
        }
      } catch {
        // ignore parse errors
      }
    })

    this.ws.on('close', (code) => {
      this.ws = null
      this.disconnectHandlers.forEach(fn => fn())

      // 4401 = auth expired — don't reconnect
      if (code === 4401) {
        this.shouldReconnect = false
        this.authExpiredHandlers.forEach(fn => fn())
        return
      }

      // 4402 = session replaced (logged in from another location) — don't reconnect
      if (code === 4402) {
        this.shouldReconnect = false
        this.sessionKickedHandlers.forEach(fn => fn())
        return
      }

      if (this.shouldReconnect) {
        this.scheduleReconnect()
      }
    })

    this.ws.on('error', () => {
      this.ws?.close()
    })
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) return

    const delay = Math.min(BASE_DELAY_MS * Math.pow(2, this.reconnectAttempt), MAX_DELAY_MS)
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.shouldReconnect) this.openConnection()
    }, delay)
  }

  // Event subscriptions — return unsubscribe functions
  onVmStatus(handler: VmStatusHandler): () => void {
    this.vmStatusHandlers.add(handler)
    return () => this.vmStatusHandlers.delete(handler)
  }

  onAgentMessage(handler: AgentHandler): () => void {
    this.agentHandlers.add(handler)
    return () => this.agentHandlers.delete(handler)
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.add(handler)
    return () => this.connectHandlers.delete(handler)
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.add(handler)
    return () => this.disconnectHandlers.delete(handler)
  }

  onAuthExpired(handler: ConnectionHandler): () => void {
    this.authExpiredHandlers.add(handler)
    return () => this.authExpiredHandlers.delete(handler)
  }

  onSessionKicked(handler: ConnectionHandler): () => void {
    this.sessionKickedHandlers.add(handler)
    return () => this.sessionKickedHandlers.delete(handler)
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

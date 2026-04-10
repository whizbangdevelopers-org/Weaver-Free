// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Shared WebSocket singleton for /ws/status.
 *
 * One connection is shared by all consumers (useVmStatus, useAgentStream, etc.).
 * Reconnects with exponential backoff and a maximum retry count.
 */

type MessageHandler = (msg: Record<string, unknown>) => void

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0
const MAX_RECONNECT_ATTEMPTS = 20
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 30000

const listeners = new Set<MessageHandler>()
const connectListeners = new Set<() => void>()
const disconnectListeners = new Set<() => void>()
const sessionKickedListeners = new Set<() => void>()

let _connected = false
let refCount = 0

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const baseUrl = `${protocol}//${window.location.host}/ws/status`

  // Attach auth token as query parameter for WebSocket auth
  try {
    const authData = localStorage.getItem('auth')
    if (authData) {
      const parsed = JSON.parse(authData) as { token?: string }
      if (parsed.token) {
        return `${baseUrl}?token=${encodeURIComponent(parsed.token)}`
      }
    }
  } catch {
    // Ignore parse errors — connect without token
  }

  return baseUrl
}

function scheduleReconnect() {
  if (reconnectTimer) return
  if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) return

  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, reconnectAttempt), MAX_DELAY_MS)
  reconnectAttempt++
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (refCount > 0) openConnection()
  }, delay)
}

function openConnection() {
  if (ws) return // already connected or connecting

  ws = new WebSocket(getWsUrl())

  ws.onopen = () => {
    _connected = true
    reconnectAttempt = 0
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    connectListeners.forEach((fn) => fn())
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as Record<string, unknown>
      listeners.forEach((fn) => fn(msg))
    } catch {
      // ignore parse errors
    }
  }

  ws.onclose = (event: CloseEvent) => {
    _connected = false
    ws = null
    disconnectListeners.forEach((fn) => fn())

    // 4402 = session replaced (logged in from another location) — don't reconnect
    if (event.code === 4402) {
      sessionKickedListeners.forEach((fn) => fn())
      return
    }

    if (refCount > 0) scheduleReconnect()
  }

  ws.onerror = () => {
    ws?.close()
  }
}

function closeConnection() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectAttempt = 0
  if (ws) {
    ws.onclose = null
    ws.close()
    ws = null
  }
  if (_connected) {
    _connected = false
    disconnectListeners.forEach((fn) => fn())
  }
}

/**
 * Acquire a reference to the shared WebSocket.
 * Opens the connection if this is the first consumer.
 * Returns a release function to call on unmount.
 */
export function acquireWs(): () => void {
  refCount++
  if (refCount === 1) openConnection()

  let released = false
  return () => {
    if (released) return
    released = true
    refCount--
    if (refCount <= 0) {
      refCount = 0
      closeConnection()
    }
  }
}

export function onWsMessage(handler: MessageHandler): () => void {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

export function onWsConnect(handler: () => void): () => void {
  connectListeners.add(handler)
  return () => connectListeners.delete(handler)
}

export function onWsDisconnect(handler: () => void): () => void {
  disconnectListeners.add(handler)
  return () => disconnectListeners.delete(handler)
}

export function onSessionKicked(handler: () => void): () => void {
  sessionKickedListeners.add(handler)
  return () => sessionKickedListeners.delete(handler)
}

export function isWsConnected(): boolean {
  return _connected
}

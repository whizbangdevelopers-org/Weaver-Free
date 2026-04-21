// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
/**
 * Shared WebSocket singleton for /ws/status.
 *
 * One connection is shared by all consumers (useVmStatus, useAgentStream, etc.).
 * Reconnects with exponential backoff and a maximum retry count.
 *
 * Demo-mode behavior: skips the connection entirely. Demo builds have no
 * backend, so attempting to connect would immediately fail, disconnectListeners
 * would fire, and the "WebSocket Offline" chip in MainLayout would flash red
 * within ~1s of page load — which is both incorrect (the demo IS working) and
 * a confusing trust signal for visitors. isDemoMode() shortcuts acquireWs()
 * so `_connected` stays false and listeners stay idle; MainLayout's initial
 * `ref(isDemoMode || isWsConnected())` seeds the chip to green and nothing
 * later flips it.
 */

import { isDemoMode } from 'src/config/demo-mode'

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
  // Auth token is sent via httpOnly cookie (browser auto-attaches on WS upgrade).
  // No need to read from localStorage — that's for non-browser clients only.
  return `${protocol}//${window.location.host}/ws/status`
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
  // Demo mode has no backend to connect to. Skip the open entirely so we
  // never emit an onclose event that would flip UI chips to "Offline".
  if (isDemoMode()) {
    return () => {
      /* no-op release — no resources acquired */
    }
  }

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

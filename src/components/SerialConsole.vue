<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="serial-console-wrapper">
    <!-- Mobile touch toolbar -->
    <div v-if="isMobile" class="console-toolbar row items-center q-pa-xs q-gutter-xs">
      <q-btn-group flat>
        <q-btn dense flat size="sm" icon="mdi-content-paste" label="Paste" @click="handlePaste">
          <q-tooltip>Paste from clipboard</q-tooltip>
        </q-btn>
        <q-btn dense flat size="sm" label="Ctrl+C" @click="sendControl('\x03')">
          <q-tooltip>Send interrupt signal</q-tooltip>
        </q-btn>
        <q-btn dense flat size="sm" label="Ctrl+D" @click="sendControl('\x04')">
          <q-tooltip>Send EOF</q-tooltip>
        </q-btn>
        <q-btn dense flat size="sm" icon="mdi-keyboard-tab" label="Tab" @click="sendControl('\t')">
          <q-tooltip>Send Tab key</q-tooltip>
        </q-btn>
      </q-btn-group>
    </div>
    <div ref="terminalRef" class="serial-console" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { Platform } from 'quasar'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

const props = defineProps<{
  vmName: string
  active: boolean
}>()

const isMobile = Platform.is.mobile ?? false

const terminalRef = ref<HTMLElement | null>(null)
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let ws: WebSocket | null = null
let resizeObserver: ResizeObserver | null = null

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/console/${props.vmName}`
}

function sendControl(char: string) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(char)
  }
}

async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText()
    if (text && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(text)
    }
  } catch {
    // Clipboard access denied or unavailable
  }
}

function connect() {
  if (ws) return

  ws = new WebSocket(getWsUrl())
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    terminal?.writeln('\r\n\x1b[32mConnected to console.\x1b[0m\r\n')
  }

  ws.onmessage = (event) => {
    if (!terminal) return
    if (event.data instanceof ArrayBuffer) {
      terminal.write(new Uint8Array(event.data))
    } else {
      // Could be a JSON error message
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.error) {
          terminal.writeln(`\r\n\x1b[31m${msg.error}\x1b[0m`)
          return
        }
      } catch {
        // Not JSON, treat as text
      }
      terminal.write(event.data as string)
    }
  }

  ws.onclose = () => {
    terminal?.writeln('\r\n\x1b[33mDisconnected from console.\x1b[0m')
    ws = null
  }

  ws.onerror = () => {
    terminal?.writeln('\r\n\x1b[31mConsole connection error.\x1b[0m')
    ws = null
  }
}

function disconnect() {
  if (ws) {
    ws.close()
    ws = null
  }
}

function initTerminal() {
  if (!terminalRef.value || terminal) return

  terminal = new Terminal({
    cursorBlink: true,
    fontSize: isMobile ? 16 : 14,
    fontFamily: "'Roboto Mono', 'Courier New', monospace",
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
    },
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())

  terminal.open(terminalRef.value)
  fitAddon.fit()

  // Forward terminal input to WebSocket
  terminal.onData((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })

  // Auto-resize on container size change
  resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit()
  })
  resizeObserver.observe(terminalRef.value)

  terminal.writeln('Serial Console')
  terminal.writeln('Waiting for connection...\r\n')
}

watch(() => props.active, (isActive) => {
  if (isActive) {
    if (!terminal) {
      // Need a tick for the DOM to be visible before opening xterm
      setTimeout(() => {
        initTerminal()
        connect()
      }, 50)
    } else {
      fitAddon?.fit()
      connect()
    }
  } else {
    disconnect()
  }
})

onMounted(() => {
  if (props.active) {
    initTerminal()
    connect()
  }
})

onBeforeUnmount(() => {
  disconnect()
  resizeObserver?.disconnect()
  terminal?.dispose()
  terminal = null
  fitAddon = null
})
</script>

<style scoped>
.serial-console-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.console-toolbar {
  background: #2d2d2d;
  border-radius: 4px 4px 0 0;
  color: #d4d4d4;
}

.serial-console {
  width: 100%;
  min-height: 400px;
  height: 100%;
  flex: 1;
  background: #1e1e1e;
  border-radius: 4px;
  padding: 4px;
}

@media (max-width: 599px) {
  .serial-console {
    min-height: 300px;
    border-radius: 0 0 4px 4px;
  }
}
</style>

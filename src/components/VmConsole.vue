<!-- Copyright (c) 2026 whizBANG Developers LLC. All rights reserved. -->
<!-- Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE. -->
<template>
  <div class="vm-console-wrapper">
    <!-- Mobile touch toolbar -->
    <div v-if="isMobile" class="console-toolbar row items-center q-pa-xs q-gutter-xs">
      <q-btn-group flat>
        <q-btn dense flat size="sm" label="Ctrl+C" @click="handleCtrlC">
          <q-tooltip>Send interrupt signal</q-tooltip>
        </q-btn>
        <q-btn dense flat size="sm" label="Ctrl+D" @click="handleCtrlD">
          <q-tooltip>Send EOF</q-tooltip>
        </q-btn>
        <q-btn dense flat size="sm" icon="mdi-keyboard-tab" label="Tab" @click="handleTab">
          <q-tooltip>Send Tab key</q-tooltip>
        </q-btn>
      </q-btn-group>
    </div>
    <div ref="terminalRef" class="vm-console" />
  </div>
</template>

<script setup lang="ts">
/**
 * VmConsole — Mock serial console for demo/development mode.
 *
 * Renders an xterm.js terminal that shows a simulated Linux boot sequence,
 * then drops into a fake shell prompt that echoes typed text and returns
 * canned responses for common commands.
 *
 * When a real console WebSocket endpoint is available (Weaver Solo+),
 * the SerialConsole component should be used instead.
 *
 * TODO [v1-license]: Gate real vs mock console by tier. Free/demo users get
 * VmConsole; Weaver Solo/Fabrick users get SerialConsole with live WebSocket.
 */
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
let resizeObserver: ResizeObserver | null = null
let lineTimeout: ReturnType<typeof setTimeout> | null = null
let inputBuffer = ''
let booted = false

// --- Boot sequence simulation ---

const BOOT_LINES = [
  '[    0.000000] Linux version 6.6.30-microvm (gcc 13.2.0) #1 SMP PREEMPT_DYNAMIC',
  '[    0.000000] Command line: console=ttyS0 root=/dev/vda1 rw',
  '[    0.001234] x86/fpu: Supporting XSAVE feature 0x001: \'x87 floating point registers\'',
  '[    0.003456] BIOS-provided physical RAM map:',
  '[    0.003789]  BIOS-e820: [mem 0x0000000000000000-0x000000000009fbff] usable',
  '[    0.012000] Booting paravirtualized kernel on KVM',
  '[    0.018000] clocksource: kvm-clock: mask: 0xffffffffffffffff',
  '[    0.045000] smpboot: CPU0: AMD EPYC Processor (family: 0x17, model: 0x31)',
  '[    0.089000] Memory: 494720K/524288K available (16384K kernel code)',
  '[    0.102000] NET: Registered PF_INET protocol family',
  '[    0.145000] virtio_blk virtio0: [vda] 20971520 512-byte logical blocks (10.7 GB)',
  '[    0.178000] virtio_net virtio1: MAC address randomized',
  '[    0.210000] EXT4-fs (vda1): mounted filesystem with ordered data mode',
  '[    0.245000] systemd[1]: Detected virtualization kvm.',
  '[    0.289000] systemd[1]: Set hostname to <HOST>.',
  '[    0.450000] systemd[1]: Reached target Network.',
  '[    0.512000] systemd[1]: Started OpenSSH Daemon.',
  '[    0.567000] systemd[1]: Reached target Multi-User System.',
  '',
  '<HOST> login: root (automatic login)',
  '',
  '\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m',
  '\x1b[33m  Simulated Console\x1b[0m',
  '\x1b[2m  Upgrade to Weaver Solo for live serial access to your VMs.\x1b[0m',
  '\x1b[2m  https://weaver-dev.github.io/pricing\x1b[0m',
  '\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m',
  '',
]

// --- Canned command responses ---

function getCannedResponse(cmd: string, vmName: string): string | null {
  const hostname = vmName
  const trimmed = cmd.trim()

  if (trimmed === '' || trimmed === '\r') return null

  const responses: Record<string, string> = {
    'ls': 'bin  boot  dev  etc  home  lib  lib64  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var',
    'ls -la': `total 68
drwxr-xr-x  18 root root 4096 Jan 15 00:00 .
drwxr-xr-x  18 root root 4096 Jan 15 00:00 ..
drwxr-xr-x   2 root root 4096 Jan 15 00:00 bin
drwxr-xr-x   3 root root 4096 Jan 15 00:00 boot
drwxr-xr-x   5 root root  380 Jan 15 00:00 dev
drwxr-xr-x  42 root root 4096 Jan 15 00:00 etc
drwxr-xr-x   2 root root 4096 Jan 15 00:00 home
drwxr-xr-x   7 root root 4096 Jan 15 00:00 lib
drwxr-xr-x   2 root root 4096 Jan 15 00:00 lib64
drwxr-xr-x   2 root root 4096 Jan 15 00:00 mnt
drwxr-xr-x   2 root root 4096 Jan 15 00:00 opt
dr-xr-xr-x 128 root root    0 Jan 15 00:00 proc
drwx------   3 root root 4096 Jan 15 00:00 root
drwxr-xr-x  11 root root  340 Jan 15 00:00 run
drwxr-xr-x   2 root root 4096 Jan 15 00:00 sbin
drwxr-xr-x   2 root root 4096 Jan 15 00:00 srv
dr-xr-xr-x  13 root root    0 Jan 15 00:00 sys
drwxrwxrwt   2 root root 4096 Jan 15 00:00 tmp
drwxr-xr-x  10 root root 4096 Jan 15 00:00 usr
drwxr-xr-x  12 root root 4096 Jan 15 00:00 var`,
    'pwd': '/root',
    'whoami': 'root',
    'id': 'uid=0(root) gid=0(root) groups=0(root)',
    'hostname': hostname,
    'uname': 'Linux',
    'uname -a': `Linux ${hostname} 6.6.30-microvm #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux`,
    'uname -r': '6.6.30-microvm',
    'cat /etc/os-release': `NAME="NixOS"
VERSION="24.05 (Uakari)"
ID=nixos
VERSION_ID="24.05"
PRETTY_NAME="NixOS 24.05 (Uakari)"
HOME_URL="https://nixos.org/"`,
    'uptime': ' 00:05:23 up 0 min,  1 user,  load average: 0.08, 0.03, 0.01',
    'free -m': `              total        used        free      shared  buff/cache   available
Mem:            512          87         312           2         112         401
Swap:             0           0           0`,
    'free': `              total        used        free      shared  buff/cache   available
Mem:         524288       89088      319488        2048      115712      410624
Swap:             0           0           0`,
    'df -h': `Filesystem      Size  Used Avail Use% Mounted on
/dev/vda1       9.8G  1.2G  8.1G  13% /
devtmpfs        247M     0  247M   0% /dev
tmpfs           256M     0  256M   0% /dev/shm
tmpfs           103M  480K  102M   1% /run`,
    'ip addr': `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default
    link/ether 02:00:00:00:00:01 brd ff:ff:ff:ff:ff:ff
    inet 10.10.0.10/24 brd 10.10.0.255 scope global eth0
       valid_lft forever preferred_lft forever`,
    'ip a': `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    inet 10.10.0.10/24 scope global eth0`,
    'ps aux': `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.1  1.2  16960  6144 ?        Ss   00:00   0:01 /sbin/init
root        42  0.0  0.4   8384  2048 ?        Ss   00:00   0:00 /usr/sbin/sshd
root        58  0.0  0.3   5760  1536 ttyS0    Ss   00:00   0:00 -bash
root        71  0.0  0.2   7168  1024 ttyS0    R+   00:05   0:00 ps aux`,
    'date': new Date().toUTCString(),
    'echo hello': 'hello',
    'cat /proc/cpuinfo': `processor\t: 0
vendor_id\t: AuthenticAMD
model name\t: AMD EPYC Processor
cpu MHz\t\t: 2495.000
cache size\t: 512 KB
flags\t\t: fpu vme de pse tsc msr pae mce cx8 apic sep mtrr pge mca cmov`,
    'cat /proc/meminfo': `MemTotal:         524288 kB
MemFree:          319488 kB
MemAvailable:     410624 kB
Buffers:           16384 kB
Cached:            99328 kB`,
    'systemctl status': `● ${hostname}
    State: running
     Jobs: 0 queued
   Failed: 0 units
    Since: Mon 2026-01-15 00:00:00 UTC; 5min ago`,
    'dmesg | tail': `[    0.450000] systemd[1]: Reached target Network.
[    0.512000] systemd[1]: Started OpenSSH Daemon.
[    0.567000] systemd[1]: Reached target Multi-User System.`,
    'clear': '\x1b[2J\x1b[H',
    'exit': 'logout',
    'help': `GNU bash, version 5.2.26
Type 'help' for this help, 'man <command>' for command manuals.
Common commands: ls, cd, cat, echo, ps, free, df, uname, ip, systemctl`,
  }

  // Exact match
  if (trimmed in responses) return responses[trimmed]

  // echo with arguments
  if (trimmed.startsWith('echo ')) {
    return trimmed.slice(5)
  }

  // cd (always succeeds silently)
  if (trimmed === 'cd' || trimmed.startsWith('cd ')) {
    return ''
  }

  // cat with unknown file
  if (trimmed.startsWith('cat ')) {
    const file = trimmed.slice(4).trim()
    if (file in responses) return responses[`cat ${file}`] ?? null
    return `cat: ${file}: No such file or directory`
  }

  // Solo-only commands
  const gatedCommands = ['ssh ', 'scp ', 'systemctl restart', 'systemctl start', 'systemctl stop', 'reboot', 'shutdown', 'poweroff', 'nixos-rebuild']
  for (const pc of gatedCommands) {
    if (trimmed === pc || trimmed.startsWith(pc + ' ') || trimmed.startsWith(pc)) {
      return '\x1b[33mThis command requires live serial access (Weaver Solo).\x1b[0m\n\x1b[2mUpgrade at: https://weaver-dev.github.io/pricing\x1b[0m'
    }
  }

  return `-bash: ${trimmed.split(' ')[0]}: command not found`
}

// --- Terminal initialization ---

function writePrompt() {
  if (terminal) {
    terminal.write(`\x1b[2m[sim]\x1b[0m \x1b[32mroot@${props.vmName}\x1b[0m:\x1b[34m~\x1b[0m# `)
  }
}

function runBootSequence() {
  if (!terminal) return

  let index = 0
  booted = false

  function writeLine() {
    if (!terminal || index >= BOOT_LINES.length) {
      booted = true
      writePrompt()
      return
    }

    const line = BOOT_LINES[index].replace(/<HOST>/g, props.vmName)
    terminal.writeln(line)
    index++

    // Vary timing to simulate real boot (faster for simple lines)
    const delay = line === '' ? 50 : 40 + Math.random() * 60
    lineTimeout = setTimeout(writeLine, delay)
  }

  writeLine()
}

function handleInput(data: string) {
  if (!terminal || !booted) return

  for (const char of data) {
    if (char === '\r' || char === '\n') {
      // Enter pressed — process command
      terminal.writeln('')
      const response = getCannedResponse(inputBuffer, props.vmName)
      if (response !== null && response !== '') {
        if (inputBuffer.trim() === 'clear') {
          terminal.write(response)
        } else if (inputBuffer.trim() === 'exit') {
          terminal.writeln(response)
          terminal.writeln('')
          terminal.writeln('\x1b[33mSession closed.\x1b[0m')
          booted = false
          return
        } else {
          terminal.writeln(response)
        }
      }
      inputBuffer = ''
      writePrompt()
    } else if (char === '\x7f' || char === '\b') {
      // Backspace
      if (inputBuffer.length > 0) {
        inputBuffer = inputBuffer.slice(0, -1)
        terminal.write('\b \b')
      }
    } else if (char === '\x03') {
      // Ctrl+C
      terminal.writeln('^C')
      inputBuffer = ''
      writePrompt()
    } else if (char === '\x04') {
      // Ctrl+D
      if (inputBuffer === '') {
        terminal.writeln('logout')
        terminal.writeln('')
        terminal.writeln('\x1b[33mSession closed.\x1b[0m')
        booted = false
      }
    } else if (char === '\t') {
      // Tab — no completion, just ignore
    } else if (char >= ' ') {
      // Regular printable character
      inputBuffer += char
      terminal.write(char)
    }
  }
}

function handleCtrlC() {
  handleInput('\x03')
}

function handleCtrlD() {
  handleInput('\x04')
}

function handleTab() {
  handleInput('\t')
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

  // Forward terminal input to local handler
  terminal.onData((data) => {
    handleInput(data)
  })

  // Auto-resize on container size change
  resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit()
  })
  resizeObserver.observe(terminalRef.value)

  // Start boot sequence
  runBootSequence()
}

function cleanup() {
  if (lineTimeout) {
    clearTimeout(lineTimeout)
    lineTimeout = null
  }
  resizeObserver?.disconnect()
  terminal?.dispose()
  terminal = null
  fitAddon = null
  inputBuffer = ''
  booted = false
}

watch(() => props.active, (isActive) => {
  if (isActive) {
    if (!terminal) {
      // Need a tick for the DOM to be visible before opening xterm
      setTimeout(() => {
        initTerminal()
      }, 50)
    } else {
      fitAddon?.fit()
    }
  }
})

onMounted(() => {
  if (props.active) {
    initTerminal()
  }
})

onBeforeUnmount(() => {
  cleanup()
})
</script>

<style scoped>
.vm-console-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.console-toolbar {
  background: #2d2d2d;
  border-radius: 4px 4px 0 0;
  color: #d4d4d4;
}

.vm-console {
  width: 100%;
  min-height: 400px;
  height: 100%;
  flex: 1;
  background: #1e1e1e;
  border-radius: 4px;
  padding: 4px;
}

@media (max-width: 599px) {
  .vm-console {
    min-height: 300px;
    border-radius: 0 0 4px 4px;
  }
}
</style>

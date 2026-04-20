import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, useInput } from 'ink'

interface VmConsoleProps {
  vmName: string
  onBack: () => void
}

// --- Abbreviated boot sequence (5-8 lines for terminal context) ---

const BOOT_LINES = [
  '[    0.000000] Linux version 6.6.30-microvm (gcc 13.2.0) #1 SMP PREEMPT_DYNAMIC',
  '[    0.001234] Booting paravirtualized kernel on KVM',
  '[    0.045000] Memory: 494720K/524288K available (16384K kernel code)',
  '[    0.145000] virtio_blk virtio0: [vda] 20971520 512-byte logical blocks (10.7 GB)',
  '[    0.245000] systemd[1]: Detected virtualization kvm.',
  '[    0.289000] systemd[1]: Set hostname to <HOST>.',
  '[    0.512000] systemd[1]: Started OpenSSH Daemon.',
  '[    0.567000] systemd[1]: Reached target Multi-User System.',
]

const MOTD = [
  '',
  '━━ Simulated Console ━━',
  '  Upgrade to Weaver Solo for live serial access to your VMs.',
  '  Learn more: https://weaver-dev.github.io/pricing',
  '',
]

const MAX_OUTPUT_LINES = 20

// --- Solo-only commands that need live serial access ---

const PREMIUM_COMMANDS = new Set([
  'ssh', 'scp', 'systemctl restart', 'systemctl start', 'systemctl stop',
  'reboot', 'shutdown', 'poweroff', 'halt', 'init',
])

function isPremiumCommand(cmd: string): boolean {
  const trimmed = cmd.trim()
  for (const pc of PREMIUM_COMMANDS) {
    if (trimmed === pc || trimmed.startsWith(pc + ' ')) return true
  }
  return false
}

// --- Canned command responses (ported from VmConsole.vue) ---

function getCannedResponse(cmd: string, vmName: string): string | null {
  const trimmed = cmd.trim()
  if (trimmed === '' || trimmed === '\r') return null

  // Solo-gated commands
  if (isPremiumCommand(trimmed)) {
    return 'This command requires live serial access (Weaver Solo)'
  }

  const responses: Record<string, string> = {
    'ls': 'bin  boot  dev  etc  home  lib  lib64  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var',
    'ls -la': `total 68
drwxr-xr-x  18 root root 4096 Jan 15 00:00 .
drwxr-xr-x  18 root root 4096 Jan 15 00:00 ..
drwxr-xr-x   2 root root 4096 Jan 15 00:00 bin
drwxr-xr-x   3 root root 4096 Jan 15 00:00 boot
drwxr-xr-x   5 root root  380 Jan 15 00:00 dev
drwxr-xr-x  42 root root 4096 Jan 15 00:00 etc
drwxr-xr-x   2 root root 4096 Jan 15 00:00 home`,
    'pwd': '/root',
    'whoami': 'root',
    'id': 'uid=0(root) gid=0(root) groups=0(root)',
    'hostname': vmName,
    'uname': 'Linux',
    'uname -a': `Linux ${vmName} 6.6.30-microvm #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux`,
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
tmpfs           256M     0  256M   0% /dev/shm`,
    'ip addr': `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500
    inet 10.10.0.10/24 scope global eth0`,
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
    'cat /proc/cpuinfo': `processor       : 0
vendor_id       : AuthenticAMD
model name      : AMD EPYC Processor
cpu MHz         : 2495.000
cache size      : 512 KB`,
    'cat /proc/meminfo': `MemTotal:         524288 kB
MemFree:          319488 kB
MemAvailable:     410624 kB
Buffers:           16384 kB
Cached:            99328 kB`,
    'systemctl status': `* ${vmName}
    State: running
     Jobs: 0 queued
   Failed: 0 units
    Since: Mon 2026-01-15 00:00:00 UTC; 5min ago`,
    'dmesg | tail': `[    0.450000] systemd[1]: Reached target Network.
[    0.512000] systemd[1]: Started OpenSSH Daemon.
[    0.567000] systemd[1]: Reached target Multi-User System.`,
    'clear': '__CLEAR__',
    'exit': '__EXIT__',
    'help': `GNU bash, version 5.2.26
Type 'help' for this help, 'man <command>' for command manuals.
Common commands: ls, cd, cat, echo, ps, free, df, uname, ip, systemctl`,
  }

  // Exact match
  if (trimmed in responses) return responses[trimmed]!

  // echo with arguments
  if (trimmed.startsWith('echo ')) return trimmed.slice(5)

  // cd (always succeeds silently)
  if (trimmed === 'cd' || trimmed.startsWith('cd ')) return ''

  // cat with unknown file
  if (trimmed.startsWith('cat ')) {
    const fullKey = trimmed
    if (fullKey in responses) return responses[fullKey]!
    const file = trimmed.slice(4).trim()
    return `cat: ${file}: No such file or directory`
  }

  return `-bash: ${trimmed.split(' ')[0]}: command not found`
}

export function VmConsole({ vmName, onBack }: VmConsoleProps) {
  const [outputLines, setOutputLines] = useState<string[]>([])
  const [inputBuffer, setInputBuffer] = useState('')
  const [booted, setBooted] = useState(false)
  const bootIndexRef = useRef(0)

  // Boot sequence: push lines one by one on mount
  useEffect(() => {
    bootIndexRef.current = 0
    const allBootLines = BOOT_LINES.map(l => l.replace(/<HOST>/g, vmName))

    const interval = setInterval(() => {
      const idx = bootIndexRef.current
      if (idx < allBootLines.length) {
        setOutputLines(prev => [...prev, allBootLines[idx]!])
        bootIndexRef.current++
      } else if (idx < allBootLines.length + MOTD.length) {
        const motdIdx = idx - allBootLines.length
        setOutputLines(prev => [...prev, MOTD[motdIdx]!])
        bootIndexRef.current++
      } else {
        clearInterval(interval)
        // Add login line then mark booted
        setOutputLines(prev => [
          ...prev,
          `${vmName} login: root (automatic login)`,
          '',
        ])
        setBooted(true)
      }
    }, 80)

    return () => clearInterval(interval)
  }, [vmName])

  // Process a command
  const executeCommand = (cmd: string) => {
    const prompt = `[simulated] root@${vmName}:~# ${cmd}`
    const response = getCannedResponse(cmd, vmName)

    if (response === '__CLEAR__') {
      setOutputLines([])
      return
    }

    if (response === '__EXIT__') {
      setOutputLines(prev => [...prev, prompt, 'logout', '', 'Session closed.'])
      onBack()
      return
    }

    const newLines = [prompt]
    if (response !== null && response !== '') {
      // Split multiline responses into individual lines
      newLines.push(...response.split('\n'))
    }
    setOutputLines(prev => [...prev, ...newLines])
  }

  useInput((input, key) => {
    if (!booted) return

    // Ctrl+D: exit console
    if (key.ctrl && input === 'd') {
      setOutputLines(prev => [...prev, `[simulated] root@${vmName}:~# `, 'logout', '', 'Session closed.'])
      onBack()
      return
    }

    // Ctrl+C: cancel current input
    if (key.ctrl && input === 'c') {
      setOutputLines(prev => [...prev, `[simulated] root@${vmName}:~# ${inputBuffer}^C`])
      setInputBuffer('')
      return
    }

    // Enter: execute command
    if (key.return) {
      executeCommand(inputBuffer)
      setInputBuffer('')
      return
    }

    // Backspace
    if (key.backspace || key.delete) {
      setInputBuffer(prev => prev.slice(0, -1))
      return
    }

    // Escape: exit console (same as Ctrl+D)
    if (key.escape) {
      onBack()
      return
    }

    // Tab: ignore
    if (key.tab) return

    // Regular printable character — filter control sequences
    if (input && input.length === 1 && input >= ' ' && !key.ctrl && !key.meta) {
      setInputBuffer(prev => prev + input)
    }
  })

  // Show last MAX_OUTPUT_LINES lines
  const visibleLines = outputLines.slice(-MAX_OUTPUT_LINES)
  const hasMore = outputLines.length > MAX_OUTPUT_LINES

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Console: {vmName}</Text>
        <Text dimColor>  (simulated mock console)</Text>
      </Box>

      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        {hasMore && (
          <Text dimColor>[{'\u2191'}] {outputLines.length - MAX_OUTPUT_LINES} more lines above</Text>
        )}
        {visibleLines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
        {booted && (
          <Text>
            <Text color="green">[simulated] root@{vmName}</Text>
            <Text>:</Text>
            <Text color="blue">~</Text>
            <Text># {inputBuffer}</Text>
            <Text color="gray">{'\u2588'}</Text>
          </Text>
        )}
        {!booted && outputLines.length > 0 && (
          <Text color="yellow">Booting...</Text>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          Type commands | Ctrl+C cancel | Ctrl+D/Esc exit console
        </Text>
      </Box>
    </Box>
  )
}

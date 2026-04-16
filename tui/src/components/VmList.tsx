import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { VmInfo } from '../types/vm.js'
import { STATUSES } from '../constants/vocabularies.js'
import { isDemoVersionAtLeast, DEMO_VERSIONS } from '../demo/mock.js'

interface VmListProps {
  vms: VmInfo[]
  onAction: (vmName: string, action: 'start' | 'stop' | 'restart') => Promise<void>
  onSelect: (vmName: string) => void
  onAgent: (vmName: string) => void
  onCreateVm?: () => void
  onScan?: () => Promise<unknown>
  onHelp?: () => void
  onNetwork?: () => void
  onDistros?: () => void
  onTemplates?: () => void
  onHostInfo?: () => void
  onNotifications?: () => void
  onSettings?: () => void
  onUsers?: () => void
  onAudit?: () => void
  onFleetBridges?: () => void
  onQuit: () => void
  onLogout: () => void
  /** Demo mode version for version-gated features */
  version?: string
  /** Whether demo mode is active */
  isDemo?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  [STATUSES.RUNNING]: 'green',
  [STATUSES.IDLE]: 'gray',
  [STATUSES.STOPPED]: 'gray',
  [STATUSES.FAILED]: 'red',
  [STATUSES.UNKNOWN]: 'yellow',
}

const STATUS_CYCLE: (string | null)[] = [null, STATUSES.RUNNING, STATUSES.IDLE, STATUSES.STOPPED, STATUSES.FAILED]

function formatUptime(uptimeIso: string | null): string {
  if (!uptimeIso) return '-'
  const ms = Date.now() - new Date(uptimeIso).getTime()
  if (ms < 0) return '-'
  const seconds = Math.floor(ms / 1000)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatMem(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)}GB`
  return `${mb}MB`
}

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

export function VmList({ vms, onAction, onSelect, onAgent, onCreateVm, onScan, onHelp, onNetwork, onDistros, onTemplates, onHostInfo, onNotifications, onSettings, onUsers, onAudit, onFleetBridges, onQuit, onLogout, version, isDemo }: VmListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [scanMessage, setScanMessage] = useState<string | null>(null)

  const sorted = [...vms].sort((a, b) => a.name.localeCompare(b.name))

  // Apply filters
  const filtered = sorted.filter(vm => {
    if (searchQuery && !vm.name.includes(searchQuery)) return false
    if (statusFilter && vm.status !== statusFilter) return false
    return true
  })

  useInput((input, key) => {
    // Search mode: capture characters for query
    if (searchMode) {
      if (key.escape) {
        setSearchMode(false)
        setSearchQuery('')
        return
      }
      if (key.return) {
        setSearchMode(false)
        return
      }
      if (key.backspace || key.delete) {
        setSearchQuery(q => q.slice(0, -1))
        return
      }
      if (input && !key.ctrl && !key.meta) {
        setSearchQuery(q => q + input)
        setSelectedIndex(0) // Reset selection when query changes
      }
      return
    }

    if (key.escape) {
      // Clear active filter/search, don't quit
      if (statusFilter) { setStatusFilter(null); return }
      return
    }

    if (input === 'q') {
      onQuit()
      return
    }

    if (input === 'L') {
      onLogout()
      return
    }

    if (input === 'n' && onCreateVm) {
      onCreateVm()
      return
    }

    if (input === '/' ) {
      setSearchMode(true)
      return
    }

    if (input === 't') {
      setStatusFilter(current => {
        const idx = STATUS_CYCLE.indexOf(current)
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]!
        setSelectedIndex(0) // Reset selection when filter changes
        return next
      })
      return
    }

    if (input === 'f' && onScan) {
      void onScan().then((result) => {
        const r = result as { status: number; data: { discovered?: string[]; added?: string[] } } | undefined
        if (r && r.status === 200 && r.data) {
          const disc = r.data.discovered?.length ?? 0
          const added = r.data.added?.length ?? 0
          setScanMessage(`Scan: ${disc} discovered, ${added} added`)
          setTimeout(() => setScanMessage(null), 3000)
        }
      })
      return
    }

    if (input === '?' && onHelp) {
      onHelp()
      return
    }

    // Weaver Solo keybindings
    if (input === 'N' && onNetwork) { onNetwork(); return }
    if (input === 'D' && onDistros) { onDistros(); return }
    if (input === 'T' && onTemplates) { onTemplates(); return }
    if (input === 'H' && onHostInfo) { onHostInfo(); return }
    if (input === 'I' && onNotifications) { onNotifications(); return }
    if (input === ',' && onSettings) { onSettings(); return }

    // Fabrick keybindings
    if (input === 'u' && onUsers) { onUsers(); return }
    if (input === 'A' && onAudit) { onAudit(); return }
    if (input === 'F' && onFleetBridges) { onFleetBridges(); return }

    if (filtered.length === 0) return

    if (key.upArrow || input === 'k') {
      setSelectedIndex(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex(i => Math.min(filtered.length - 1, i + 1))
      return
    }

    const vm = filtered[selectedIndex]
    if (!vm) return

    if (input === 'd' || key.return) {
      onSelect(vm.name)
      return
    }

    if (input === 'a') {
      onAgent(vm.name)
      return
    }

    if (input === 's' && (vm.status === STATUSES.STOPPED || vm.status === STATUSES.IDLE)) {
      setPendingAction(vm.name)
      void onAction(vm.name, 'start').finally(() => setPendingAction(null))
      return
    }
    if (input === 'S' && vm.status === STATUSES.RUNNING) {
      setPendingAction(vm.name)
      void onAction(vm.name, 'stop').finally(() => setPendingAction(null))
      return
    }
    if (input === 'r' && vm.status === STATUSES.RUNNING) {
      setPendingAction(vm.name)
      void onAction(vm.name, 'restart').finally(() => setPendingAction(null))
      return
    }
  })

  if (sorted.length === 0 && !searchQuery && !statusFilter) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text dimColor>No VMs found. Waiting for data...</Text>
        <Text dimColor>Press q to quit</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box>
        <Text bold dimColor>
          {'  '}{pad('NAME', 18)}{pad('STATUS', 12)}{pad('IP', 16)}{pad('MEM', 8)}{pad('CPU', 5)}{pad('UPTIME', 10)}{pad('DISTRO', 16)}
        </Text>
      </Box>

      {/* VM rows */}
      {filtered.map((vm, i) => {
        const selected = i === selectedIndex
        const loading = pendingAction === vm.name

        return (
          <Box key={vm.name}>
            <Text color={selected ? 'cyan' : undefined} bold={selected}>
              {selected ? '> ' : '  '}
              {pad(vm.name, 18)}
            </Text>
            <Text color={STATUS_COLORS[vm.status] ?? 'white'}>
              {pad(loading ? '...' : vm.status, 12)}
            </Text>
            <Text>{pad(vm.ip || '-', 16)}</Text>
            <Text>{pad(formatMem(vm.mem), 8)}</Text>
            <Text>{pad(`${vm.vcpu}v`, 5)}</Text>
            <Text dimColor>{pad(formatUptime(vm.uptime), 10)}</Text>
            <Text dimColor>{pad(vm.distro ?? '-', 16)}</Text>
          </Box>
        )
      })}

      {filtered.length === 0 && (
        <Box paddingX={2}>
          <Text dimColor>No VMs match filter</Text>
        </Box>
      )}

      {/* Filter bar */}
      {(searchQuery || statusFilter || searchMode) && (
        <Box marginTop={1} gap={1}>
          <Text>
            {searchMode ? <Text color="cyan">Search: {searchQuery}█</Text> : searchQuery ? <Text>Search: {searchQuery}</Text> : null}
            {statusFilter && <Text> Filter: {statusFilter}</Text>}
            <Text dimColor> ({filtered.length} of {sorted.length})</Text>
          </Text>
        </Box>
      )}

      {scanMessage && (
        <Box marginTop={1}>
          <Text color="green">{scanMessage}</Text>
        </Box>
      )}

      {/* Key legend */}
      <Box marginTop={1} gap={1} flexDirection="column">
        <Text dimColor>
          [s]tart [S]top [r]estart [d]etail [a]gent [n]ew [/]search [t]filter{onScan ? ' [f]scan' : ''}{onHelp ? ' [?]help' : ''} [L]ogout [q]uit
        </Text>
        {(onNetwork || onDistros || onTemplates || onHostInfo || onNotifications || onSettings) && (
          <Text dimColor>
            {onNetwork ? '[N]etwork ' : ''}{onDistros ? '[D]istros ' : ''}{onTemplates ? '[T]emplates ' : ''}{onHostInfo ? '[H]ost ' : ''}{onNotifications ? '[I]nfo ' : ''}{onSettings ? '[,]settings ' : ''}{onUsers ? '[u]sers ' : ''}{onAudit ? '[A]udit ' : ''}{onFleetBridges ? '[F]leet bridges' : ''}
          </Text>
        )}
      </Box>

      {/* Version-gated feature indicators (demo mode only) */}
      {isDemo && version && (
        <Box marginTop={1} flexDirection="column">
          {isDemoVersionAtLeast('1.1') && <Text color="cyan">  ● Containers: docker 3 · podman 2{isDemoVersionAtLeast('1.2') ? ' · [C]reate' : ' (read-only)'}</Text>}
          {isDemoVersionAtLeast('1.3') && <Text color="cyan">  ● Remote: {isDemoVersionAtLeast('1.3') ? 'WireGuard tunnel active' : ''} · Mobile app connected</Text>}
          {isDemoVersionAtLeast('1.4') && <Text color="cyan">  ● Cross-resource AI: diagnostics span VMs + containers + networking</Text>}
          {isDemoVersionAtLeast('1.5') && <Text color="cyan">  ● Secrets: 3 managed · injected into 4 workloads</Text>}
          {isDemoVersionAtLeast('1.6') && <Text color="cyan">  ● Migration: import/export ready (Proxmox, Docker Compose, libvirt)</Text>}
          {isDemoVersionAtLeast('2.0') && <Text color="magenta">  ● Storage: disk management · OS templates</Text>}
          {isDemoVersionAtLeast('2.1') && <Text color="magenta">  ● Snapshots: 3 saved · clone-to-template</Text>}
          {isDemoVersionAtLeast('2.2') && <Text color="magenta">  ● Team: 3 peer hosts · blue/green deployment</Text>}
          {isDemoVersionAtLeast('2.3') && <Text color="yellow">  ● Fleet: 15 nodes enrolled · cold migration ready</Text>}
          {isDemoVersionAtLeast('2.4') && <Text color="magenta">  ● Backup: 2 jobs active · NFS + local targets</Text>}
          {isDemoVersionAtLeast('2.6') && <Text color="yellow">  ● Backup+: S3, restic, borg · file-level restore · encryption</Text>}
          {isDemoVersionAtLeast('3.0') && <Text color="yellow">  ● FabricK: HA clustering · live migration · fleet events</Text>}
          {isDemoVersionAtLeast('3.3') && <Text color="yellow">  ● Groups: 4 workload groups · IdP sync · compliance audit</Text>}
          {/* Next version teaser */}
          {(() => {
            const nextVer = DEMO_VERSIONS.find(v => !isDemoVersionAtLeast(v.version))
            return nextVer ? (
              <Text dimColor>  ○ Coming in v{nextVer.version}: {nextVer.headline}</Text>
            ) : null
          })()}
        </Box>
      )}
    </Box>
  )
}

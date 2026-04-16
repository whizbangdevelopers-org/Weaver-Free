import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { VmInfo } from '../types/vm.js'
import type { TuiApiClient } from '../client/api.js'
import { STATUSES } from '../constants/vocabularies.js'
import { VmConsole } from './VmConsole.js'
import { VmLogs } from './VmLogs.js'

interface VmDetailProps {
  vm: VmInfo | null
  api: TuiApiClient
  onBack: () => void
  onAction: (vmName: string, action: 'start' | 'stop' | 'restart') => Promise<void>
  onAgent: () => void
  onDelete?: (vmName: string) => Promise<void>
}

type SubView = 'none' | 'console' | 'logs'

function formatUptime(uptimeIso: string | null): string {
  if (!uptimeIso) return '-'
  const ms = Date.now() - new Date(uptimeIso).getTime()
  if (ms < 0) return '-'
  const seconds = Math.floor(ms / 1000)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box>
      <Box width={20}>
        <Text dimColor>{label}:</Text>
      </Box>
      <Text color={color}>{value}</Text>
    </Box>
  )
}

const STATUS_COLORS: Record<string, string> = {
  [STATUSES.RUNNING]: 'green',
  [STATUSES.IDLE]: 'gray',
  [STATUSES.STOPPED]: 'gray',
  [STATUSES.FAILED]: 'red',
  [STATUSES.UNKNOWN]: 'yellow',
}

export function VmDetail({ vm, api, onBack, onAction, onAgent, onDelete }: VmDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [subView, setSubView] = useState<SubView>('none')

  useInput((input, key) => {
    // Don't handle input when a sub-view is active — sub-views own input
    if (subView !== 'none') return

    // Delete confirmation mode
    if (confirmDelete) {
      if (input === 'y' && vm && onDelete) {
        setConfirmDelete(false)
        void onDelete(vm.name)
      } else {
        setConfirmDelete(false)
      }
      return
    }

    if (key.escape || input === 'b') {
      onBack()
      return
    }
    if (!vm) return

    if (input === 'a') {
      onAgent()
      return
    }
    if (input === 'c') {
      setSubView('console')
      return
    }
    if (input === 'l') {
      setSubView('logs')
      return
    }
    if (input === 'x' && onDelete) {
      setConfirmDelete(true)
      return
    }
    if (input === 's' && (vm.status === STATUSES.STOPPED || vm.status === STATUSES.IDLE)) {
      void onAction(vm.name, 'start')
      return
    }
    if (input === 'S' && vm.status === STATUSES.RUNNING) {
      void onAction(vm.name, 'stop')
      return
    }
    if (input === 'r' && vm.status === STATUSES.RUNNING) {
      void onAction(vm.name, 'restart')
      return
    }
  })

  if (!vm) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text color="red">VM not found. Press b to go back.</Text>
      </Box>
    )
  }

  // Sub-view: Console
  if (subView === 'console') {
    return (
      <VmConsole
        vmName={vm.name}
        onBack={() => setSubView('none')}
      />
    )
  }

  // Sub-view: Logs
  if (subView === 'logs') {
    return (
      <VmLogs
        vmName={vm.name}
        api={api}
        onBack={() => setSubView('none')}
      />
    )
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>VM Detail: {vm.name}</Text>
      <Box marginTop={1} flexDirection="column">
        <Row label="Status" value={vm.status} color={STATUS_COLORS[vm.status]} />
        <Row label="IP" value={vm.ip || '-'} />
        <Row label="Memory" value={vm.mem >= 1024 ? `${(vm.mem / 1024).toFixed(1)} GB` : `${vm.mem} MB`} />
        <Row label="vCPUs" value={String(vm.vcpu)} />
        <Row label="Hypervisor" value={vm.hypervisor} />
        <Row label="Uptime" value={formatUptime(vm.uptime)} />
        {vm.distro && <Row label="Distro" value={vm.distro} />}
        {vm.bridge && <Row label="Bridge" value={vm.bridge} />}
        {vm.macAddress && <Row label="MAC" value={vm.macAddress} />}
        {vm.diskSize && <Row label="Disk" value={`${vm.diskSize} GB`} />}
        {vm.description && <Row label="Description" value={vm.description} />}
        {vm.tags && vm.tags.length > 0 && <Row label="Tags" value={vm.tags.join(', ')} />}
        {vm.autostart !== undefined && <Row label="Autostart" value={vm.autostart ? 'yes' : 'no'} />}
        {vm.provisioningState && <Row label="Provisioning" value={vm.provisioningState} />}
        {vm.provisioningError && <Row label="Prov. Error" value={vm.provisioningError} color="red" />}
      </Box>

      {confirmDelete && (
        <Box marginTop={1}>
          <Text color="red" bold>Delete VM: {vm.name}? [y] confirm [n/Esc] cancel</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          [s]tart [S]top [r]estart [a]gent [c]onsole [l]ogs{onDelete ? ' [x]delete' : ''} [b]ack
        </Text>
      </Box>
    </Box>
  )
}

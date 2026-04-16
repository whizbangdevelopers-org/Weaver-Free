import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TuiApiClient } from '../../client/api.js'
import { TIERS } from '../../constants/vocabularies.js'
import { TIER_ORDER } from '../../config/tier-views.js'

interface HostDetailViewProps {
  api: TuiApiClient
  tier: string
  onBack: () => void
}

interface BasicHost {
  hostname?: string
  ipAddress?: string
  arch?: string
  cpuModel?: string
  cpuCount?: number
  totalMemMb?: number
  kernelVersion?: string
  uptimeSeconds?: number
  kvmAvailable?: boolean
}

interface DetailedHost {
  nixosVersion?: string
  cpuTopology?: {
    sockets: number; coresPerSocket: number; threadsPerCore: number
    virtualizationType?: string
    l1dCache?: string; l1iCache?: string; l2Cache?: string; l3Cache?: string
  }
  diskUsage?: {
    filesystem: string; sizeHuman: string; usedHuman: string
    availHuman: string; usePercent: number; mountPoint: string
  }[]
  networkInterfaces?: { name: string; state: string; macAddress: string | null }[]
  liveMetrics?: {
    freeMemMb: number; loadAvg1: number; loadAvg5: number; loadAvg15: number
  }
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box>
      <Box width={24}><Text dimColor>{label}:</Text></Box>
      <Text color={color}>{value}</Text>
    </Box>
  )
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function HostDetailView({ api, tier, onBack }: HostDetailViewProps) {
  const [basic, setBasic] = useState<BasicHost | null>(null)
  const [detailed, setDetailed] = useState<DetailedHost | null>(null)
  const [loading, setLoading] = useState(true)

  const isPremium = (TIER_ORDER[tier] ?? 0) >= (TIER_ORDER[TIERS.SOLO] ?? 99)

  useEffect(() => {
    // Always fetch basic info from health (all tiers)
    void api.getHealth().then(result => {
      if (result.status === 200) {
        const host = result.data.host as BasicHost | null
        if (host) setBasic(host)
      }
      setLoading(false)
    })

    // Fetch detailed info only for premium+
    if (isPremium) {
      void api.getHostInfo().then(result => {
        if (result.status === 200) {
          setDetailed(result.data as DetailedHost)
        }
      })
    }
  }, [api, isPremium])

  useInput((input, key) => {
    if (key.escape || input === 'b') onBack()
  })

  if (loading) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text color="yellow">Loading host info...</Text>
      </Box>
    )
  }

  if (!basic) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold color="yellow">Host info unavailable</Text>
        <Box marginTop={1}>
          <Text dimColor>Could not reach the backend health endpoint.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Esc or b to go back</Text>
        </Box>
      </Box>
    )
  }

  const cpu = detailed?.cpuTopology
  const metrics = detailed?.liveMetrics

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>Host Detail</Text>

      {/* Basic info — all tiers */}
      <Box marginTop={1} flexDirection="column">
        <Text bold underline>System</Text>
        {basic.hostname && <Row label="Hostname" value={basic.hostname} />}
        {basic.ipAddress && <Row label="IP Address" value={basic.ipAddress} />}
        {basic.arch && <Row label="Architecture" value={basic.arch} />}
        {basic.cpuModel && <Row label="CPU" value={`${basic.cpuModel} (${basic.cpuCount ?? '?'})`} />}
        {basic.totalMemMb != null && <Row label="Total Memory" value={`${(basic.totalMemMb / 1024).toFixed(1)} GB`} />}
        {basic.kernelVersion && <Row label="Kernel" value={basic.kernelVersion} />}
        {basic.uptimeSeconds != null && <Row label="Uptime" value={formatUptime(basic.uptimeSeconds)} />}
        {basic.kvmAvailable != null && (
          <Row label="KVM" value={basic.kvmAvailable ? 'Available' : 'Not available'} color={basic.kvmAvailable ? 'green' : 'red'} />
        )}
      </Box>

      {/* Detailed info — premium+ only */}
      {isPremium ? (
        <>
          {detailed?.nixosVersion && (
            <Box marginTop={1} flexDirection="column">
              <Row label="NixOS Version" value={detailed.nixosVersion} />
            </Box>
          )}

          {cpu && (
            <Box marginTop={1} flexDirection="column">
              <Text bold underline>CPU Topology</Text>
              <Row label="Sockets" value={String(cpu.sockets)} />
              <Row label="Cores / Socket" value={String(cpu.coresPerSocket)} />
              <Row label="Threads / Core" value={String(cpu.threadsPerCore)} />
              {cpu.virtualizationType && <Row label="Virtualization" value={cpu.virtualizationType} />}
              {cpu.l3Cache && <Row label="L3 Cache" value={cpu.l3Cache} />}
            </Box>
          )}

          {detailed?.diskUsage && detailed.diskUsage.length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Text bold underline>Disk Usage</Text>
              {detailed.diskUsage.map(d => (
                <Row key={d.mountPoint} label={d.mountPoint} value={`${d.usedHuman} / ${d.sizeHuman} (${d.usePercent}%)`} />
              ))}
            </Box>
          )}

          {detailed?.networkInterfaces && detailed.networkInterfaces.length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Text bold underline>Network Interfaces</Text>
              {detailed.networkInterfaces.map(iface => (
                <Row key={iface.name} label={iface.name} value={iface.state} color={iface.state === 'UP' ? 'green' : 'gray'} />
              ))}
            </Box>
          )}

          {metrics && (
            <Box marginTop={1} flexDirection="column">
              <Text bold underline>Live Metrics</Text>
              <Row label="Free Memory" value={`${(metrics.freeMemMb / 1024).toFixed(1)} GB`} />
              <Row label="Load Average" value={`${metrics.loadAvg1} / ${metrics.loadAvg5} / ${metrics.loadAvg15}`} />
            </Box>
          )}
        </>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>CPU topology, disk usage, and live metrics require </Text>
          <Text color="yellow">Weaver Solo</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>[b]ack</Text>
      </Box>
    </Box>
  )
}

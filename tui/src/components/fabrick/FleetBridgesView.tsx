// Copyright (c) 2026 whizBANG Developers LLC. All rights reserved.
// Licensed under AGPL-3.0 (Free) or BSL-1.1 (Solo/Team/Fabrick) with AI Training Restriction. See LICENSE.
import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TuiApiClient } from '../../client/api.js'
import type { FleetBridge } from '../../types/fleet-bridge.js'
import { TierGateMessage } from '../TierGateMessage.js'
import { FeatureUnavailable } from '../FeatureUnavailable.js'

interface FleetBridgesViewProps {
  api: TuiApiClient
  tier: string
  onBack: () => void
}

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

function healthColor(health: string): string {
  switch (health) {
    case 'healthy':  return 'green'
    case 'degraded': return 'yellow'
    case 'draining': return 'gray'
    default:         return 'red'
  }
}

export function FleetBridgesView({ api, tier, onBack }: FleetBridgesViewProps) {
  const [bridges, setBridges] = useState<FleetBridge[]>([])
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)

  useEffect(() => {
    void api.getFleetBridges().then(result => {
      if (result.status === 200) {
        setBridges(result.data as FleetBridge[])
      } else if (result.status === 403) {
        setBlocked(true)
      } else {
        setUnavailable(true)
      }
      setLoading(false)
    })
  }, [api])

  useInput((input, key) => {
    if (key.escape || input === 'b') onBack()
    if (key.upArrow && selectedIdx > 0) setSelectedIdx(i => i - 1)
    if (key.downArrow && selectedIdx < bridges.length - 1) setSelectedIdx(i => i + 1)
  })

  if (blocked) {
    return <TierGateMessage feature="Fleet bridges" requiredTier="fabrick" currentTier={tier} onBack={onBack} />
  }

  if (unavailable) {
    return <FeatureUnavailable feature="Fleet Bridges" onBack={onBack} />
  }

  if (loading) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text color="yellow">Loading fleet bridges...</Text>
      </Box>
    )
  }

  const selected = bridges[selectedIdx] ?? null

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>Fleet Virtual Bridges</Text>
      <Text dimColor>One primitive — replaces K8s CNI + Ingress + MetalLB + Rollouts. AI-operated.</Text>

      {/* Bridge list */}
      <Box marginTop={1}>
        <Text bold dimColor>
          {'  '}{pad('BRIDGE', 18)}{pad('GROUP', 14)}{pad('OVERLAY', 12)}{pad('SUBNET', 18)}{pad('HEALTH', 10)}{pad('ENDPOINTS', 10)}
        </Text>
      </Box>
      {bridges.map((fb, i) => (
        <Box key={fb.name}>
          <Text inverse={i === selectedIdx}>
            {i === selectedIdx ? '▸ ' : '  '}
            {pad(fb.name, 18)}
          </Text>
          <Text>{pad(fb.workloadGroupId, 14)}</Text>
          <Text color={fb.overlay === 'vxlan' ? 'blue' : 'yellow'}>{pad(fb.overlay.toUpperCase(), 12)}</Text>
          <Text dimColor>{pad(fb.subnet, 18)}</Text>
          <Text color={healthColor(fb.health)}>{pad(fb.health, 10)}</Text>
          <Text>{pad(String(fb.endpoints.length), 10)}</Text>
        </Box>
      ))}

      {/* Selected bridge detail */}
      {selected && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" paddingX={1} paddingY={0}>
          <Text bold color="cyan">{selected.label} — {selected.name}</Text>
          <Text dimColor>Replaces: {selected.replaces}</Text>
          <Text dimColor>Balance: {selected.policy.balanceMode} · Health check: {selected.policy.healthCheckIntervalSec}s · Drain: {selected.policy.drainTimeoutSec}s</Text>

          {/* Blue/green banner */}
          {selected.blueGreen && (
            <Box marginTop={1}>
              <Text color="blue" bold>⇄ Blue/Green: </Text>
              <Text>{selected.blueGreen.phase} — </Text>
              <Text color="blue">{selected.blueGreen.blueEndpointId} ({selected.blueGreen.blueWeight}%)</Text>
              <Text> → </Text>
              <Text color="green">{selected.blueGreen.greenEndpointId} ({selected.blueGreen.greenWeight}%)</Text>
              {selected.blueGreen.initiatedBy && (
                <Text dimColor>  🤖 {selected.blueGreen.initiatedBy}</Text>
              )}
            </Box>
          )}

          {/* Endpoints table */}
          <Box marginTop={1}>
            <Text bold dimColor>
              {'  '}{pad('ENDPOINT', 30)}{pad('HOST', 22)}{pad('WEIGHT', 8)}{pad('HEALTH', 10)}{pad('BRIDGE', 12)}{pad('GPU', 8)}
            </Text>
          </Box>
          {selected.endpoints.map(ep => (
            <Box key={ep.id}>
              <Text>{'  '}{pad(ep.id, 30)}</Text>
              <Text dimColor>{pad(ep.hostId, 22)}</Text>
              <Text color={ep.weight === 0 ? 'gray' : 'white'} bold>{pad(`${ep.weight}%`, 8)}</Text>
              <Text color={healthColor(ep.health)}>{pad(ep.health, 10)}</Text>
              <Text dimColor>{pad(ep.localBridge, 12)}</Text>
              <Text color="magenta">{pad(ep.gpuVendor ?? '-', 8)}</Text>
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>[↑/↓] select  [b]ack</Text>
      </Box>
    </Box>
  )
}

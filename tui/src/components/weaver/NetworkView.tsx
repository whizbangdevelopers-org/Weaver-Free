import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TuiApiClient } from '../../client/api.js'
import type { NetworkTopology } from '../../types/network.js'
import { STATUSES } from '../../constants/vocabularies.js'
import { TierGateMessage } from '../TierGateMessage.js'
import { FeatureUnavailable } from '../FeatureUnavailable.js'

interface NetworkViewProps {
  api: TuiApiClient
  tier: string
  onBack: () => void
}

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

export function NetworkView({ api, tier, onBack }: NetworkViewProps) {
  const [data, setData] = useState<NetworkTopology | null>(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    void api.getNetworkTopology().then(result => {
      if (result.status === 200) {
        setData(result.data as NetworkTopology)
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
  })

  if (blocked) {
    return <TierGateMessage feature="Network topology" requiredTier="weaver" currentTier={tier} onBack={onBack} />
  }

  if (unavailable) {
    return <FeatureUnavailable feature="Network Topology" onBack={onBack} />
  }

  if (loading) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text color="yellow">Loading network topology...</Text>
      </Box>
    )
  }

  if (!data) return null

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>Network Topology</Text>

      {data.bridges.map(br => (
        <Box key={br.name} flexDirection="column" marginTop={1}>
          <Text color="cyan" bold>{br.name}</Text>
          <Text dimColor>  Gateway: {br.gateway}  Subnet: {br.subnet}</Text>
          <Box marginTop={1}>
            <Text bold dimColor>
              {'  '}{pad('VM', 18)}{pad('IP', 16)}{pad('STATUS', 10)}{pad('HYPERVISOR', 18)}{pad('DISTRO', 14)}
            </Text>
          </Box>
          {data.nodes
            .filter(n => n.bridge === br.name)
            .map(node => (
              <Box key={node.name}>
                <Text>{'  '}{pad(node.name, 18)}</Text>
                <Text>{pad(node.ip, 16)}</Text>
                <Text color={node.status === STATUSES.RUNNING ? 'green' : node.status === STATUSES.STOPPED ? 'gray' : 'red'}>
                  {pad(node.status, 10)}
                </Text>
                <Text dimColor>{pad(node.hypervisor ?? '-', 18)}</Text>
                <Text dimColor>{pad(node.distro ?? '-', 14)}</Text>
              </Box>
            ))}
        </Box>
      ))}

      <Box marginTop={1}>
        <Text dimColor>[b]ack</Text>
      </Box>
    </Box>
  )
}

import React from 'react'
import { Box, Text } from 'ink'

interface StatusBarProps {
  connected: boolean
  tier: string
  demo: boolean
  vmCount: number
}

export function StatusBar({ connected, tier, demo, vmCount }: StatusBarProps) {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text bold>Weaver</Text>
      <Box gap={2}>
        <Text color={connected ? 'green' : 'red'}>
          {connected ? '● connected' : '○ disconnected'}
        </Text>
        <Text color="cyan">tier: {tier}</Text>
        <Text dimColor>{vmCount} VMs</Text>
        {demo && <Text color="yellow">[DEMO]</Text>}
      </Box>
    </Box>
  )
}

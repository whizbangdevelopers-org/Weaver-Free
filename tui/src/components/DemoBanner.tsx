import React from 'react'
import { Box, Text } from 'ink'
import { DEMO_VERSIONS, tierDisplayLabel, type DemoVersionEntry } from '../demo/mock.js'

interface DemoBannerProps {
  tier: string
  version: string
}

export function DemoBanner({ tier, version }: DemoBannerProps) {
  const vInfo: DemoVersionEntry | undefined = DEMO_VERSIONS.find(v => v.version === version)
  const label = tierDisplayLabel(tier)
  return (
    <Box paddingX={1} flexDirection="column">
      <Box>
        <Text backgroundColor="yellow" color="black" bold>
          {' DEMO MODE '}
        </Text>
        <Text color="cyan" bold> {label} </Text>
        <Text dimColor>| </Text>
        <Text color="magenta" bold>v{version}</Text>
        <Text dimColor> {vInfo?.headline ?? ''} </Text>
        <Text dimColor>| </Text>
        <Text dimColor>[Tab] tier  [←/→] version</Text>
      </Box>
    </Box>
  )
}

import React from 'react'
import { Box, Text, useInput } from 'ink'

interface TierGateMessageProps {
  feature: string
  requiredTier: string
  currentTier: string
  onBack: () => void
}

export function TierGateMessage({ feature, requiredTier, currentTier, onBack }: TierGateMessageProps) {
  useInput((input, key) => {
    if (key.escape || key.return || input === 'b') onBack()
  })

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="yellow">Feature Locked</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>{feature} requires <Text bold color="cyan">{requiredTier}</Text> tier or higher.</Text>
        <Text>Your current tier: <Text bold>{currentTier}</Text></Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Esc, b, or Enter to go back</Text>
      </Box>
    </Box>
  )
}

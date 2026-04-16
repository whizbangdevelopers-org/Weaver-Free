import React from 'react'
import { Box, Text, useInput } from 'ink'

interface FeatureUnavailableProps {
  feature: string
  onBack: () => void
}

export function FeatureUnavailable({ feature, onBack }: FeatureUnavailableProps) {
  useInput((input, key) => {
    if (key.escape || key.return || input === 'b') onBack()
  })

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="yellow">Not Available</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>{feature} is not available on this server.</Text>
        <Text dimColor>This feature may require a newer server version.</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Esc, b, or Enter to go back</Text>
      </Box>
    </Box>
  )
}

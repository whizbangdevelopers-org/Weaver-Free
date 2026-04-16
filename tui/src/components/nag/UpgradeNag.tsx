import React from 'react'
import { Box, Text, useInput } from 'ink'
import { TIERS, TIER_LABELS } from '../../constants/vocabularies.js'

interface UpgradeNagProps {
  featureName: string
  featureDescription?: string
  requiredTier: typeof TIERS.SOLO | typeof TIERS.FABRICK
  features?: string[]
  onBack: () => void
}

export function UpgradeNag({ featureName, featureDescription, requiredTier, features, onBack }: UpgradeNagProps) {
  useInput((input, key) => {
    if (key.escape || key.return || input === 'b') onBack()
  })

  const tierColor = requiredTier === TIERS.FABRICK ? 'magenta' : 'yellow'
  const tierLabel = TIER_LABELS[requiredTier] ?? 'Weaver'

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color={tierColor}>Upgrade to {tierLabel}</Text>

      <Box marginTop={1} flexDirection="column">
        <Text bold>{featureName}</Text>
        <Text dimColor>
          {featureDescription || `This feature requires a ${tierLabel} license.`}
        </Text>
      </Box>

      {features && features.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          {features.map(f => (
            <Text key={f}>  <Text color="green">+</Text> {f}</Text>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Learn more: https://weaver-demo.github.io/pricing</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press Esc, b, or Enter to go back</Text>
      </Box>
    </Box>
  )
}

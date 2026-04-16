import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TuiApiClient } from '../../client/api.js'
import { TIERS } from '../../constants/vocabularies.js'
import { TIER_ORDER } from '../../config/tier-views.js'

interface SettingsViewProps {
  api: TuiApiClient
  tier: string
  demo: boolean
  host: string
  onBack: () => void
}

interface HealthData {
  hasServerKey?: boolean
  tier?: string
  tierExpiry?: string | null
  tierGraceMode?: boolean
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box>
      <Box width={24}><Text dimColor>{label}:</Text></Box>
      <Text color={color}>{value}</Text>
    </Box>
  )
}

const TIER_LABELS: Record<string, string> = {
  [TIERS.DEMO]: 'Demo',
  [TIERS.FREE]: 'Free',
  [TIERS.SOLO]: 'Weaver Solo',
  [TIERS.FABRICK]: 'FabricK',
}

const TIER_COLORS: Record<string, string> = {
  [TIERS.DEMO]: 'gray',
  [TIERS.FREE]: 'green',
  [TIERS.SOLO]: 'magenta',
  [TIERS.FABRICK]: 'yellow',
}

function tierDescription(tier: string): string {
  switch (tier) {
    case TIERS.FABRICK: return 'FabricK license — all features unlocked'
    case TIERS.SOLO: return 'Weaver license — advanced features enabled'
    case TIERS.FREE: return 'Free license — standard features'
    default: return 'Demo mode — limited evaluation'
  }
}

function formatExpiry(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString()
}

export function SettingsView({ api, tier, demo, host, onBack }: SettingsViewProps) {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [editingKey, setEditingKey] = useState(false)

  const isPremium = (TIER_ORDER[tier] ?? 0) >= (TIER_ORDER[TIERS.SOLO] ?? 99)

  useEffect(() => {
    void api.getHealth().then(result => {
      if (result.status === 200) {
        setHealth(result.data as HealthData)
      }
    })
  }, [api])

  useInput((input, key) => {
    if (editingKey) {
      if (key.escape || (key.ctrl && input === 'd')) {
        setEditingKey(false)
        setApiKeyInput('')
        return
      }
      if (key.return) {
        // Save key — stored in TUI config (credentials file)
        setEditingKey(false)
        // Key is now set in apiKeyInput state
        return
      }
      if (key.backspace || key.delete) {
        setApiKeyInput(k => k.slice(0, -1))
        return
      }
      if (input && !key.ctrl && !key.meta) {
        setApiKeyInput(k => k + input)
        return
      }
      return
    }

    if (key.escape || input === 'b') onBack()
    if (input === 'k') setEditingKey(true)
    if (input === 'c') {
      setApiKeyInput('')
    }
  })

  const hasServerKey = health?.hasServerKey ?? false
  const tierExpiry = health?.tierExpiry ?? null
  const tierGraceMode = health?.tierGraceMode ?? false

  // Current mode
  let modeLabel: string
  let modeColor: string
  if (hasServerKey && isPremium) {
    modeLabel = 'Using server-configured API key'
    modeColor = 'cyan'
  } else if (apiKeyInput) {
    modeLabel = 'Using your API key (BYOK)'
    modeColor = 'green'
  } else {
    modeLabel = 'Mock mode (no API key configured)'
    modeColor = 'yellow'
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold>Settings</Text>

      {/* Connection */}
      <Box marginTop={1} flexDirection="column">
        <Text bold underline>Connection</Text>
        <Row label="Mode" value={demo ? 'Demo (mock data)' : 'Live'} />
        <Row label="Backend URL" value={host} />
        <Row label="Tier" value={tier} color="cyan" />
      </Box>

      {/* License */}
      <Box marginTop={1} flexDirection="column">
        <Text bold underline>License</Text>
        <Row label="Tier" value={TIER_LABELS[tier] ?? 'Unknown'} color={TIER_COLORS[tier] ?? 'gray'} />
        <Text dimColor>  {tierDescription(tier)}</Text>
        {tierExpiry && (
          <Row label="Expires" value={formatExpiry(tierExpiry)} color={tierGraceMode ? 'red' : 'gray'} />
        )}
        {tierGraceMode && (
          <Box marginTop={1}>
            <Text color="yellow">  License expired — 30-day grace period active. Please renew.</Text>
          </Box>
        )}
      </Box>

      {/* AI Agent */}
      <Box marginTop={1} flexDirection="column">
        <Text bold underline>AI Agent</Text>
        <Row label="Server API Key" value={health === null ? 'checking...' : hasServerKey ? 'configured' : 'not configured'} color={hasServerKey ? 'green' : 'yellow'} />
        {editingKey ? (
          <Box>
            <Box width={24}><Text dimColor>API Key:</Text></Box>
            <Text>{apiKeyInput ? '*'.repeat(Math.min(apiKeyInput.length, 40)) : ''}<Text color="cyan">|</Text></Text>
          </Box>
        ) : (
          <Row label="Your API Key" value={apiKeyInput ? `set (${'*'.repeat(4)}${apiKeyInput.slice(-4)})` : 'not set'} color={apiKeyInput ? 'green' : 'gray'} />
        )}
        {editingKey && (
          <Text dimColor>  Type your API key, Enter to save, Esc to cancel</Text>
        )}
      </Box>

      {/* Current Mode */}
      <Box marginTop={1} flexDirection="column">
        <Text bold underline>Current Mode</Text>
        <Row label="AI Mode" value={modeLabel} color={modeColor} />
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{editingKey ? '[Enter] save  [Esc] cancel' : '[k] set API key  [c] clear key  [b]ack'}</Text>
      </Box>
    </Box>
  )
}

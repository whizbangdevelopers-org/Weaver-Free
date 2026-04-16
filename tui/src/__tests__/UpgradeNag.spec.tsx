import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import React from 'react'
import { UpgradeNag } from '../components/nag/UpgradeNag.js'

const tick = () => new Promise(r => setTimeout(r, 50))

function defaultProps(overrides?: Partial<Parameters<typeof UpgradeNag>[0]>) {
  return {
    featureName: 'Network Topology',
    featureDescription: 'View bridge topology and VM mappings.',
    requiredTier: 'weaver' as const,
    features: ['Bridge visualization', 'VM-to-bridge mapping'],
    onBack: vi.fn(),
    ...overrides,
  }
}

describe('UpgradeNag', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders feature name', () => {
    const { lastFrame } = render(<UpgradeNag {...defaultProps()} />)
    expect(lastFrame()).toContain('Network Topology')
  })

  it('renders feature description', () => {
    const { lastFrame } = render(<UpgradeNag {...defaultProps()} />)
    expect(lastFrame()).toContain('View bridge topology and VM mappings.')
  })

  it('renders feature bullets', () => {
    const { lastFrame } = render(<UpgradeNag {...defaultProps()} />)
    const frame = lastFrame()!
    expect(frame).toContain('Bridge visualization')
    expect(frame).toContain('VM-to-bridge mapping')
  })

  it('shows Weaver Solo tier label for weaver features', () => {
    const { lastFrame } = render(<UpgradeNag {...defaultProps({ requiredTier: 'weaver' })} />)
    expect(lastFrame()).toContain('Upgrade to Weaver Solo')
  })

  it('shows FabricK tier label for fabrick features', () => {
    const { lastFrame } = render(<UpgradeNag {...defaultProps({ requiredTier: 'fabrick' })} />)
    expect(lastFrame()).toContain('Upgrade to FabricK')
  })

  it('shows default description when none provided', () => {
    const { lastFrame } = render(<UpgradeNag {...defaultProps({ featureDescription: undefined })} />)
    expect(lastFrame()).toContain('requires a Weaver Solo license')
  })

  it('shows pricing URL', () => {
    const { lastFrame } = render(<UpgradeNag {...defaultProps()} />)
    expect(lastFrame()).toContain('weaver-demo.github.io/pricing')
  })

  it('Esc triggers onBack', async () => {
    const onBack = vi.fn()
    const { stdin } = render(<UpgradeNag {...defaultProps({ onBack })} />)
    await tick()

    stdin.write('\x1B')
    await tick()

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('Enter triggers onBack', async () => {
    const onBack = vi.fn()
    const { stdin } = render(<UpgradeNag {...defaultProps({ onBack })} />)
    await tick()

    stdin.write('\r')
    await tick()

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('renders without features list', () => {
    const { lastFrame } = render(<UpgradeNag {...defaultProps({ features: undefined })} />)
    expect(lastFrame()).toContain('Network Topology')
    expect(lastFrame()).not.toContain('Bridge visualization')
  })
})
